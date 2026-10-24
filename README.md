# ReliefNet: Real-Time Disaster Emergency & Relief Coordinator

Serverless AWS app (region ap-south-1), defined in `infra/` (CDK). All resources are tagged `Project=disaster-relief`.

- Site: http://disasterreliefstack-sitebucket397a1860-1yhnyt3o1jkm.s3-website.ap-south-1.amazonaws.com
- API:  https://qn8kojdbz1.execute-api.ap-south-1.amazonaws.com
- Live updates: wss://fm9t3x41m6.execute-api.ap-south-1.amazonaws.com/prod

## Demo accounts
| Role | Email | Password | Can do |
|---|---|---|---|
| Admin | admin@relief.demo | Relief2026demo | everything |
| Responder | responder@relief.demo | Relief2026demo | dispatch, resolve, allocate supplies, simulate |
| Citizen | (self sign-up on the site) | any 8+ chars with a digit | report incidents with photos |
| Guest | "View live dashboard" | none | read-only |

## Features
- Cognito sign-in with roles; JWT authorizer on API Gateway; role checks in Lambda
- Live map, incident feed, WebSocket push (API Gateway WebSocket + DynamoDB connection table)
- Photo upload, Amazon Rekognition labels (stored in S3, shown on the incident)
- Smart dispatch: nearest team of the right specialty, with ETA
- Shelter supply tracking and allocation
- Analytics: response times, severity mix, 7-day trend, hotspot heatmap
- Email alerts: DynamoDB Stream -> Lambda -> SNS, subscribers pick a minimum severity
- Architecture page with links into the AWS console and live counters
- CloudWatch dashboard `Disaster-Relief-Ops`

## Architecture
Browser -> S3 website -> API Gateway HTTP (JWT) -> Lambda `relief-api` -> DynamoDB / S3 / Rekognition / SNS
Lambda -> API Gateway WebSocket -> every open dashboard
DynamoDB Stream (new incident) -> Lambda `relief-alert-stream` -> SNS `relief-critical-alerts`

## Commands (AWS profile `envhack`)
    cd infra
    npx cdk deploy --require-approval never     # deploy / update
    npx cdk deploy -c alertEmail=you@x.com      # also subscribe an inbox to alerts
    aws lambda invoke --function-name relief-api --cli-binary-format raw-in-base64-out --payload '{"action":"seed"}' out.json   # reset demo data
    npx cdk destroy                             # remove everything

## Demo walkthrough (about 3 minutes)
1. Landing page, click **Launch interactive demo** (signs in as the demo responder; all data is fictional).
2. **Dashboard**: KPIs, map, low supplies. **Report incident** (pick a location on the map, optionally attach a photo).
3. **Incidents**: filter by severity or type, then **Dispatch**. The nearest team of the right specialty is assigned (straight-line distance and ETA shown).
4. **On-site** then **Resolve** to free the team. **Shelters**: allocate supplies and watch the levels change.
5. **Analytics**, **Alerts** (subscribe an email), **Architecture** (service map, live counters, limitations, console links).
6. Sign in as **admin** (sign-in dialog, Admin) and use **Reset demo data** to restore the original scenario.

## Limitations
- Demo data only; no real notifications are sent. HTTP only (S3 website endpoint); CloudFront HTTPS needs AWS account verification.
- Dispatch uses straight-line distance. Demo credentials are published on the sign-in dialog on purpose; do not reuse them for anything real.
