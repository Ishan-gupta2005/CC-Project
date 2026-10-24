import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, UpdateCommand, GetCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { RekognitionClient, DetectLabelsCommand } from '@aws-sdk/client-rekognition';
import { SNSClient, SubscribeCommand, ListSubscriptionsByTopicCommand } from '@aws-sdk/client-sns';
import { randomUUID } from 'node:crypto';
import { SEED_TEAMS, SEED_SHELTERS, SEED_INCIDENTS, SEED_HISTORY, SCENARIOS, PLACES } from './seed.mjs';
import { broadcast, listConnections } from './ws.mjs';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
const s3 = new S3Client({});
const rek = new RekognitionClient({});
const sns = new SNSClient({});
const T = { incidents: process.env.INCIDENTS, teams: process.env.TEAMS, shelters: process.env.SHELTERS };

const res = (code, body) => ({
  statusCode: code,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

const scan = async (TableName) => {
  const items = [];
  let ExclusiveStartKey;
  do {
    const r = await db.send(new ScanCommand({ TableName, ExclusiveStartKey }));
    items.push(...(r.Items ?? []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
};

const km = (a, b) => {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

const KIND_FOR = { flood: 'rescue', earthquake: 'rescue', fire: 'fire', cyclone: 'logistics', landslide: 'rescue', medical: 'medical' };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const jitter = (v) => v + (Math.random() - 0.5) * 0.08;

// Rekognition label -> incident type
const LABEL_TYPE = [
  [/flood|flooding|water|river|sea|ocean/i, 'flood'],
  [/fire|flame|smoke|bonfire|explosion/i, 'fire'],
  [/rubble|wreckage|demolition|collapse|destruction|debris/i, 'earthquake'],
  [/storm|hurricane|tornado|cyclone|thunderstorm/i, 'cyclone'],
  [/landslide|mud|soil|rock/i, 'landslide'],
  [/injury|ambulance|stretcher|hospital|patient/i, 'medical'],
];

const auth = (event) => {
  const c = event.requestContext?.authorizer?.jwt?.claims ?? {};
  const groups = String(c['cognito:groups'] ?? '');
  return { email: c.email, staff: /admin|responder/.test(groups), admin: /admin/.test(groups) };
};

const newIncident = (p) => {
  const now = new Date().toISOString();
  return {
    id: randomUUID().slice(0, 8),
    type: p.type,
    severity: p.severity,
    title: p.title,
    description: p.description ?? '',
    place: p.place,
    lat: p.lat,
    lng: p.lng,
    peopleAffected: p.peopleAffected ?? 0,
    status: 'reported',
    assignedTeam: null,
    reportedBy: p.reportedBy,
    createdAt: p.createdAt ?? now,
    updatedAt: now,
  };
};

async function wipe(TableName) {
  const old = await scan(TableName);
  for (let i = 0; i < old.length; i += 25) {
    await db.send(new BatchWriteCommand({ RequestItems: { [TableName]: old.slice(i, i + 25).map((o) => ({ DeleteRequest: { Key: { id: o.id } } })) } }));
  }
}

async function seed() {
  const write = async (TableName, items) => {
    for (let i = 0; i < items.length; i += 25) {
      await db.send(new BatchWriteCommand({ RequestItems: { [TableName]: items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } })) } }));
    }
  };
  await wipe(T.incidents);
  await write(T.teams, SEED_TEAMS);
  await write(T.shelters, SEED_SHELTERS);
  const now = Date.now();
  const active = SEED_INCIDENTS.map((s, i) => newIncident({ ...s, createdAt: new Date(now - (i + 1) * 9 * 60000).toISOString() }));
  const history = SEED_HISTORY.map(([type, severity, title, place, lat, lng, peopleAffected, respMin, resolveHrs, teamName], i) => {
    const created = now - (i + 1) * 7 * 3600 * 1000 - 3600 * 1000 * 12;
    const inc = newIncident({ type, severity, title, place, lat, lng, peopleAffected, createdAt: new Date(created).toISOString() });
    return { ...inc, status: 'resolved', teamName, assignedTeam: 'T-00', dispatchedAt: new Date(created + respMin * 60000).toISOString(), resolvedAt: new Date(created + resolveHrs * 3600000).toISOString(), updatedAt: new Date(created + resolveHrs * 3600000).toISOString() };
  });
  await write(T.incidents, [...active, ...history]);
  return { seeded: true, incidents: active.length + history.length };
}

async function dispatch(id) {
  const { Item: inc } = await db.send(new GetCommand({ TableName: T.incidents, Key: { id } }));
  if (!inc) return res(404, { error: 'incident not found' });
  if (inc.assignedTeam) return res(409, { error: 'already dispatched' });
  const teams = (await scan(T.teams)).filter((t) => t.status === 'available');
  const want = KIND_FOR[inc.type];
  // score = distance, with a heavy penalty for the wrong kind of team
  const score = (t) => km(t, inc) + (t.kind === want ? 0 : 400);
  const team = teams.sort((a, b) => score(a) - score(b))[0];
  if (!team) return res(409, { error: 'no available teams' });
  const dist = Math.round(km(team, inc));
  const eta = Math.max(4, Math.round((dist / 45) * 60));
  const now = new Date().toISOString();
  await db.send(new UpdateCommand({ TableName: T.teams, Key: { id: team.id }, UpdateExpression: 'SET #s = :s, incidentId = :i', ConditionExpression: '#s = :a', ExpressionAttributeNames: { '#s': 'status' }, ExpressionAttributeValues: { ':s': 'deployed', ':i': id, ':a': 'available' } }));
  await db.send(new UpdateCommand({ TableName: T.incidents, Key: { id }, UpdateExpression: 'SET #s = :s, assignedTeam = :t, teamName = :n, etaMinutes = :e, distanceKm = :d, dispatchedAt = :u, updatedAt = :u', ExpressionAttributeNames: { '#s': 'status' }, ExpressionAttributeValues: { ':s': 'dispatched', ':t': team.id, ':n': team.name, ':e': eta, ':d': dist, ':u': now } }));
  await broadcast({ type: 'update', reason: 'dispatch', id });
  return res(200, { dispatched: team.name, etaMinutes: eta, distanceKm: dist });
}

async function setStatus(id, status) {
  const { Item: inc } = await db.send(new GetCommand({ TableName: T.incidents, Key: { id } }));
  if (!inc) return res(404, { error: 'incident not found' });
  const now = new Date().toISOString();
  await db.send(new UpdateCommand({ TableName: T.incidents, Key: { id }, UpdateExpression: 'SET #s = :s, updatedAt = :u' + (status === 'resolved' ? ', resolvedAt = :u' : ''), ExpressionAttributeNames: { '#s': 'status' }, ExpressionAttributeValues: { ':s': status, ':u': now } }));
  if (status === 'resolved' && inc.assignedTeam) {
    await db.send(new UpdateCommand({ TableName: T.teams, Key: { id: inc.assignedTeam }, UpdateExpression: 'SET #s = :s REMOVE incidentId', ExpressionAttributeNames: { '#s': 'status' }, ExpressionAttributeValues: { ':s': 'available' } }));
  }
  await broadcast({ type: 'update', reason: status, id });
  return res(200, { id, status });
}

async function analyzePhoto(id, b64) {
  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length > 4_000_000) throw new Error('photo too large');
  await s3.send(new PutObjectCommand({ Bucket: process.env.UPLOADS, Key: `photos/${id}.jpg`, Body: bytes, ContentType: 'image/jpeg' }));
  const out = { photo: true };
  try {
    const r = await rek.send(new DetectLabelsCommand({ Image: { Bytes: bytes }, MaxLabels: 12, MinConfidence: 70 }));
    out.aiLabels = (r.Labels ?? []).slice(0, 8).map((l) => ({ name: l.Name, confidence: Math.round(l.Confidence) }));
    for (const [re, type] of LABEL_TYPE) {
      const hit = out.aiLabels.find((l) => re.test(l.name));
      if (hit) { out.aiSuggestedType = type; out.aiConfidence = hit.confidence; break; }
    }
  } catch (e) {
    console.error('rekognition failed', e.name);
  }
  return out;
}

async function createIncident(body, email) {
  const { type, severity, title, place, lat, lng, photo } = body;
  if (!type || !title || typeof lat !== 'number' || typeof lng !== 'number') return res(400, { error: 'type, title, lat, lng required' });
  const inc = newIncident({ ...body, title: String(title).slice(0, 120), place: String(place || 'Reported location').slice(0, 80), severity: Math.min(4, Math.max(1, Number(severity) || 2)), reportedBy: email });
  if (photo) Object.assign(inc, await analyzePhoto(inc.id, photo));
  delete inc.photoB64;
  await db.send(new PutCommand({ TableName: T.incidents, Item: inc }));
  await broadcast({ type: 'update', reason: 'new', id: inc.id });
  return res(201, inc);
}

async function simulate() {
  const sc = pick(SCENARIOS);
  const place = pick(PLACES);
  const inc = newIncident({ ...sc, place: place.name, lat: jitter(place.lat), lng: jitter(place.lng), peopleAffected: Math.round(20 + Math.random() * 400), reportedBy: 'simulator' });
  await db.send(new PutCommand({ TableName: T.incidents, Item: inc }));
  // a simulated incident also strains one shelter's supplies
  const shelters = await scan(T.shelters);
  const s = pick(shelters);
  const item = pick(['food', 'water', 'medical']);
  await db.send(new UpdateCommand({ TableName: T.shelters, Key: { id: s.id }, UpdateExpression: `SET ${item} = :v, occupied = :o`, ExpressionAttributeValues: { ':v': Math.max(5, s[item] - 6 - Math.floor(Math.random() * 8)), ':o': Math.min(s.capacity, s.occupied + Math.round(Math.random() * 40)) } }));
  await broadcast({ type: 'update', reason: 'new', id: inc.id });
  return res(201, inc);
}

async function allocate(id, { item, amount }) {
  if (!['food', 'water', 'medical'].includes(item)) return res(400, { error: 'item must be food, water or medical' });
  const amt = Math.round(Number(amount));
  if (!amt || amt < 1 || amt > 100) return res(400, { error: 'amount must be 1-100' });
  const { Item: s } = await db.send(new GetCommand({ TableName: T.shelters, Key: { id } }));
  if (!s) return res(404, { error: 'shelter not found' });
  const v = Math.min(100, s[item] + amt);
  await db.send(new UpdateCommand({ TableName: T.shelters, Key: { id }, UpdateExpression: `SET ${item} = :v`, ExpressionAttributeValues: { ':v': v } }));
  await broadcast({ type: 'update', reason: 'allocate', id });
  return res(200, { id, item, level: v });
}

async function subscribe({ email, minSeverity }) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email ?? '')) return res(400, { error: 'valid email required' });
  const min = Math.min(4, Math.max(1, Number(minSeverity) || 3));
  await sns.send(new SubscribeCommand({
    TopicArn: process.env.TOPIC_ARN, Protocol: 'email', Endpoint: email,
    Attributes: { FilterPolicy: JSON.stringify({ severity: [{ numeric: ['>=', min] }] }) },
  }));
  return res(200, { subscribed: email, minSeverity: min, note: 'Check your inbox and confirm the subscription.' });
}

async function health() {
  const count = async (TableName) => (await db.send(new ScanCommand({ TableName, Select: 'COUNT' }))).Count;
  const [incidents, teams, shelters, conns, subs] = await Promise.all([
    count(T.incidents), count(T.teams), count(T.shelters), listConnections(),
    sns.send(new ListSubscriptionsByTopicCommand({ TopicArn: process.env.TOPIC_ARN })).then((r) => r.Subscriptions ?? []).catch(() => []),
  ]);
  return res(200, {
    region: process.env.AWS_REGION, runtime: process.env.AWS_EXECUTION_ENV, memoryMb: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
    tables: { incidents, teams, shelters }, wsConnections: conns.length,
    subscribers: subs.filter((s) => s.SubscriptionArn.startsWith('arn:')).length, pendingSubscribers: subs.filter((s) => !s.SubscriptionArn.startsWith('arn:')).length,
    serverTime: new Date().toISOString(),
  });
}

async function photo(id) {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: process.env.UPLOADS, Key: `photos/${id}.jpg` }));
    const bytes = Buffer.from(await r.Body.transformToByteArray());
    return { statusCode: 200, isBase64Encoded: true, headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=3600' }, body: bytes.toString('base64') };
  } catch {
    return res(404, { error: 'no photo' });
  }
}

export const handler = async (event) => {
  // direct invocation (admin scripts): { "action": "seed" }
  if (event.action === 'seed') return seed();

  const method = event.requestContext.http.method;
  const route = event.rawPath.replace(/\/+$/, '') || '/';
  if (method === 'OPTIONS') return { statusCode: 204 };
  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch { return res(400, { error: 'invalid json' }); }
  const me = auth(event);

  try {
    let m;
    if (method === 'GET' && route === '/state') {
      const [incidents, teams, shelters] = await Promise.all([scan(T.incidents), scan(T.teams), scan(T.shelters)]);
      incidents.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return res(200, { incidents, teams, shelters, serverTime: new Date().toISOString() });
    }
    if (method === 'GET' && route === '/health') return health();
    if (method === 'GET' && (m = route.match(/^\/photo\/([\w-]+)$/))) return photo(m[1]);
    if (method === 'POST' && route === '/subscribe') return subscribe(body);

    // everything below needs a signed-in user (enforced by the JWT authorizer)
    if (method === 'POST' && route === '/incidents') return createIncident(body, me.email);

    // staff only: responders and admins
    const needStaff = () => (me.staff ? null : res(403, { error: 'responder or admin role required' }));
    if (method === 'POST' && route === '/simulate') return needStaff() ?? simulate();
    if (method === 'POST' && route === '/seed') {
      if (!me.admin) return res(403, { error: 'admin role required' });
      const r = await seed();
      await broadcast({ type: 'update', reason: 'reset' });
      return res(200, r);
    }
    if (method === 'POST' && (m = route.match(/^\/incidents\/([\w-]+)\/dispatch$/))) return needStaff() ?? dispatch(m[1]);
    if (method === 'POST' && (m = route.match(/^\/incidents\/([\w-]+)\/(in_progress|resolved)$/))) return needStaff() ?? setStatus(m[1], m[2]);
    if (method === 'POST' && (m = route.match(/^\/shelters\/([\w-]+)\/allocate$/))) return needStaff() ?? allocate(m[1], body);
    return res(404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    return res(e.name === 'ConditionalCheckFailedException' ? 409 : 500, { error: e.message });
  }
};
