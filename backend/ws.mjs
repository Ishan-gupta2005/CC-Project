import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.CONNECTIONS;

// $connect / $disconnect routes of the WebSocket API
export const connHandler = async (event) => {
  const id = event.requestContext.connectionId;
  if (event.requestContext.eventType === 'CONNECT') {
    await db.send(new PutCommand({ TableName: TABLE, Item: { id, ttl: Math.floor(Date.now() / 1000) + 7200 } }));
  } else {
    await db.send(new DeleteCommand({ TableName: TABLE, Key: { id } }));
  }
  return { statusCode: 200 };
};

export const listConnections = async () => {
  const r = await db.send(new ScanCommand({ TableName: TABLE }));
  return r.Items ?? [];
};

// Push a message to every open dashboard
export async function broadcast(message) {
  const mgmt = new ApiGatewayManagementApiClient({ endpoint: process.env.WS_ENDPOINT });
  const data = Buffer.from(JSON.stringify({ ...message, at: new Date().toISOString() }));
  await Promise.all((await listConnections()).map(async ({ id }) => {
    try {
      await mgmt.send(new PostToConnectionCommand({ ConnectionId: id, Data: data }));
    } catch (e) {
      if (e.name === 'GoneException' || e.$metadata?.httpStatusCode === 410) await db.send(new DeleteCommand({ TableName: TABLE, Key: { id } }));
      else console.error('ws post failed', e.name);
    }
  }));
}
