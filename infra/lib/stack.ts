import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class ReliefStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = (name: string) =>
      new dynamodb.Table(this, name, {
        tableName: `relief-${name.toLowerCase()}`,
        partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        stream: name === 'Incidents' ? dynamodb.StreamViewType.NEW_AND_OLD_IMAGES : undefined,
      });
    const incidents = table('Incidents');
    const teams = table('Teams');
    const shelters = table('Shelters');
    const connections = new dynamodb.Table(this, 'Connections', {
      tableName: 'relief-connections',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Incident photos (private; served through the API)
    const uploads = new s3.Bucket(this, 'UploadsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(30) }],
    });

    // Alerts: every new incident is published; subscribers filter on `severity`.
    const alerts = new sns.Topic(this, 'CriticalAlerts', { topicName: 'relief-critical-alerts', displayName: 'Disaster Relief Alerts' });
    const alertEmail = this.node.tryGetContext('alertEmail');
    if (alertEmail) {
      alerts.addSubscription(new subs.EmailSubscription(alertEmail, { filterPolicy: { severity: sns.SubscriptionFilter.numericFilter({ greaterThanOrEqualTo: 3 }) } }));
    }

    // Auth: Cognito user pool. Self sign-up is auto-confirmed so citizens can register instantly.
    const preSignUp = new lambda.Function(this, 'PreSignUp', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async (e) => { e.response.autoConfirmUser = true; e.response.autoVerifyEmail = true; return e; };'),
    });
    const pool = new cognito.UserPool(this, 'Users', {
      userPoolName: 'relief-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: { minLength: 8, requireLowercase: true, requireDigits: true, requireUppercase: false, requireSymbols: false },
      lambdaTriggers: { preSignUp },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const client = pool.addClient('Web', { userPoolClientName: 'relief-web', authFlows: { userPassword: true }, generateSecret: false });
    ['admin', 'responder'].forEach((g) => new cognito.CfnUserPoolGroup(this, `Group-${g}`, { userPoolId: pool.userPoolId, groupName: g }));

    const common = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      logRetention: logs.RetentionDays.ONE_WEEK,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend')),
    };

    // Real-time: a WebSocket API tracks open dashboards and the API pushes updates to them.
    const wsFn = new lambda.Function(this, 'WsFunction', { ...common, functionName: 'relief-ws-connect', handler: 'ws.connHandler', environment: { CONNECTIONS: connections.tableName } });
    connections.grantReadWriteData(wsFn);
    const wsApi = new apigw.WebSocketApi(this, 'WsApi', {
      apiName: 'relief-ws-api',
      connectRouteOptions: { integration: new integrations.WebSocketLambdaIntegration('WsConnect', wsFn) },
      disconnectRouteOptions: { integration: new integrations.WebSocketLambdaIntegration('WsDisconnect', wsFn) },
    });
    const wsStage = new apigw.WebSocketStage(this, 'WsStage', { webSocketApi: wsApi, stageName: 'prod', autoDeploy: true });

    const api = new lambda.Function(this, 'ApiFunction', {
      ...common,
      functionName: 'relief-api',
      handler: 'api.handler',
      environment: {
        INCIDENTS: incidents.tableName, TEAMS: teams.tableName, SHELTERS: shelters.tableName,
        TOPIC_ARN: alerts.topicArn, UPLOADS: uploads.bucketName,
        CONNECTIONS: connections.tableName, WS_ENDPOINT: wsStage.callbackUrl,
      },
    });
    [incidents, teams, shelters, connections].forEach((t) => t.grantReadWriteData(api));
    uploads.grantReadWrite(api);
    wsStage.grantManagementApiAccess(api);
    api.addToRolePolicy(new iam.PolicyStatement({ actions: ['rekognition:DetectLabels'], resources: ['*'] }));
    api.addToRolePolicy(new iam.PolicyStatement({ actions: ['sns:Subscribe', 'sns:ListSubscriptionsByTopic'], resources: [alerts.topicArn] }));

    const alertFn = new lambda.Function(this, 'AlertFunction', {
      ...common,
      functionName: 'relief-alert-stream',
      handler: 'alert.handler',
      environment: { TOPIC_ARN: alerts.topicArn },
    });
    alerts.grantPublish(alertFn);
    alertFn.addEventSource(
      new sources.DynamoEventSource(incidents, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        retryAttempts: 2,
        filters: [lambda.FilterCriteria.filter({ eventName: lambda.FilterRule.isEqual('INSERT') })],
      }),
    );

    const httpApi = new apigw.HttpApi(this, 'HttpApi', {
      apiName: 'relief-http-api',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigw.CorsHttpMethod.ANY],
        allowHeaders: ['content-type', 'authorization'],
      },
    });
    const integration = new integrations.HttpLambdaIntegration('ApiIntegration', api);
    const jwt = new authorizers.HttpJwtAuthorizer('Jwt', `https://cognito-idp.${this.region}.amazonaws.com/${pool.userPoolId}`, { jwtAudience: [client.userPoolClientId] });
    // public reads, alert sign-up and CORS preflight
    httpApi.addRoutes({ path: '/state', methods: [apigw.HttpMethod.GET], integration });
    httpApi.addRoutes({ path: '/health', methods: [apigw.HttpMethod.GET], integration });
    httpApi.addRoutes({ path: '/photo/{id}', methods: [apigw.HttpMethod.GET], integration });
    httpApi.addRoutes({ path: '/subscribe', methods: [apigw.HttpMethod.POST], integration });
    httpApi.addRoutes({ path: '/{proxy+}', methods: [apigw.HttpMethod.OPTIONS], integration });
    // everything else needs a valid Cognito token (role checks happen in the Lambda)
    httpApi.addRoutes({ path: '/{proxy+}', methods: [apigw.HttpMethod.POST], integration, authorizer: jwt });
    // Cap the blast radius of a public demo API
    const stage = httpApi.defaultStage?.node.defaultChild as apigw.CfnStage;
    stage.defaultRouteSettings = { throttlingBurstLimit: 50, throttlingRateLimit: 25 };

    // Static site on S3 website hosting (CloudFront needs account verification on this account).
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({ blockPublicAcls: true, ignorePublicAcls: true, blockPublicPolicy: false, restrictPublicBuckets: false }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    new s3deploy.BucketDeployment(this, 'DeploySite', {
      destinationBucket: siteBucket,
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../../frontend')),
        s3deploy.Source.jsonData('config.json', { apiUrl: httpApi.apiEndpoint, wsUrl: wsStage.url, region: this.region, clientId: client.userPoolClientId }),
      ],
    });

    const wsMessages = new cw.Metric({ namespace: 'AWS/ApiGateway', metricName: 'MessageCount', dimensionsMap: { ApiId: wsApi.apiId, Stage: 'prod' }, statistic: 'Sum' });
    const signIns = new cw.Metric({ namespace: 'AWS/Cognito', metricName: 'SignInSuccesses', dimensionsMap: { UserPool: pool.userPoolId, UserPoolClient: client.userPoolClientId }, statistic: 'Sum' });
    const dash = new cw.Dashboard(this, 'Dashboard', { dashboardName: 'Disaster-Relief-Ops' });
    dash.addWidgets(
      new cw.GraphWidget({ title: 'API requests', left: [httpApi.metricCount()], width: 8 }),
      new cw.GraphWidget({ title: 'API latency (ms)', left: [httpApi.metricLatency()], width: 8 }),
      new cw.GraphWidget({ title: 'Lambda invocations / errors', left: [api.metricInvocations(), alertFn.metricInvocations()], right: [api.metricErrors()], width: 8 }),
    );
    dash.addWidgets(
      new cw.GraphWidget({ title: 'DynamoDB writes (incidents)', left: [incidents.metricConsumedWriteCapacityUnits()], width: 12 }),
      new cw.GraphWidget({ title: 'SNS alerts published', left: [alerts.metricNumberOfMessagesPublished()], width: 12 }),
    );
    dash.addWidgets(
      new cw.GraphWidget({ title: 'WebSocket messages', left: [wsMessages], width: 12 }),
      new cw.GraphWidget({ title: 'Cognito sign-ins', left: [signIns], width: 12 }),
    );

    new cdk.CfnOutput(this, 'SiteUrl', { value: siteBucket.bucketWebsiteUrl });
    new cdk.CfnOutput(this, 'UserPoolId', { value: pool.userPoolId });
    new cdk.CfnOutput(this, 'ClientId', { value: client.userPoolClientId });
    new cdk.CfnOutput(this, 'WsUrl', { value: wsStage.url });
    new cdk.CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
  }
}
