import * as cdk from 'aws-cdk-lib';
import { ReliefStack } from '../lib/stack';

const app = new cdk.App();
new ReliefStack(app, 'DisasterReliefStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'ap-south-1' },
});
cdk.Tags.of(app).add('Project', 'disaster-relief');
