import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const sns = new SNSClient({});
const SEV = { 1: 'LOW', 2: 'MEDIUM', 3: 'HIGH', 4: 'CRITICAL' };

// Triggered by DynamoDB Streams on every new incident. Subscribers filter by severity.
export const handler = async (event) => {
  for (const r of event.Records) {
    const inc = unmarshall(r.dynamodb.NewImage);
    console.log('new incident', JSON.stringify({ id: inc.id, type: inc.type, severity: inc.severity, place: inc.place }));
    await sns.send(new PublishCommand({
      TopicArn: process.env.TOPIC_ARN,
      Subject: `${SEV[inc.severity]} ${inc.type.toUpperCase()}: ${inc.place}`.slice(0, 100),
      Message: `${inc.title}\n${inc.place} (${inc.lat}, ${inc.lng})\nPeople affected: ${inc.peopleAffected}\nIncident ${inc.id} reported ${inc.createdAt}`,
      MessageAttributes: { severity: { DataType: 'Number', StringValue: String(inc.severity) } },
    }));
  }
};
