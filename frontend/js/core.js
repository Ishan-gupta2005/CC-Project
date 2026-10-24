// Shared state, API client, Cognito auth and the WebSocket live connection.
export const S = { cfg: null, data: { incidents: [], teams: [], shelters: [] }, loaded: false, link: 'connecting' };

const listeners = {};
export const on = (ev, fn) => { (listeners[ev] ||= []).push(fn); };
export const emit = (ev, arg) => (listeners[ev] || []).forEach((fn) => fn(arg));

export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const SEV = { 4: ['Critical', '#ef4444'], 3: ['High', '#f97316'], 2: ['Medium', '#eab308'], 1: ['Low', '#60a5fa'] };
export const TYPES = ['flood', 'fire', 'earthquake', 'cyclone', 'landslide', 'medical'];

export function toast(msg, ms = 3200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), ms);
}

export const ago = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// ---------- auth (Cognito user pool, called directly over HTTPS) ----------
const KEY = 'relief.auth';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const save = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch { /* storage blocked */ } };

async function cognito(target, body) {
  const r = await fetch(`https://cognito-idp.${S.cfg.region}.amazonaws.com/`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-amz-json-1.1', 'x-amz-target': `AWSCognitoIdentityProviderService.${target}` },
    body: JSON.stringify({ ClientId: S.cfg.clientId, ...body }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.message || j.__type || 'Authentication failed');
  return j;
}

const decode = (jwt) => JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));

export const session = () => {
  const a = load();
  if (!a) return null;
  const c = decode(a.idToken);
  const groups = [].concat(c['cognito:groups'] ?? []);
  const role = groups.includes('admin') ? 'admin' : groups.includes('responder') ? 'responder' : 'citizen';
  return { email: c.email, role, staff: role !== 'citizen', ...a };
};

function store(r, prev) {
  const a = r.AuthenticationResult;
  save({ idToken: a.IdToken, refreshToken: a.RefreshToken ?? prev?.refreshToken, exp: Date.now() + a.ExpiresIn * 1000 });
}

export async function signIn(email, password) {
  store(await cognito('InitiateAuth', { AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: email, PASSWORD: password } }));
}

export async function signUp(email, password) {
  await cognito('SignUp', { Username: email, Password: password, UserAttributes: [{ Name: 'email', Value: email }] });
  await signIn(email, password);
}

export const signOut = () => save(null);

async function token() {
  const a = load();
  if (!a) return null;
  if (a.exp - Date.now() < 60000) {
    try { store(await cognito('InitiateAuth', { AuthFlow: 'REFRESH_TOKEN_AUTH', AuthParameters: { REFRESH_TOKEN: a.refreshToken } }), a); }
    catch { save(null); emit('signedout'); return null; }
  }
  return load().idToken;
}

// ---------- API ----------
export async function api(path, method = 'GET', body) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  const t = await token();
  if (t) headers.authorization = t;
  const r = await fetch(S.cfg.apiUrl + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 401 ? 'Please sign in to do that' : j.error || j.message || r.statusText);
  return j;
}

let known = null;
export const markKnown = (id) => known?.add(id);
export async function refresh() {
  try {
    const d = await api('/state');
    if (known) {
      const fresh = d.incidents.filter((i) => !known.has(i.id));
      if (fresh.length) toast(`New incident: ${fresh[0].title}`);
    }
    known = new Set(d.incidents.map((i) => i.id));
    S.data = d;
    S.loaded = true;
    emit('data');
    if (S.link === 'off') setLink('poll');
  } catch {
    setLink('off');
  }
}

// ---------- live link ----------
function setLink(v) {
  S.link = v;
  const el = $('live');
  if (!el) return;
  el.className = 'live' + (v === 'live' ? '' : v === 'poll' ? ' poll' : ' off');
  el.lastChild.textContent = v === 'live' ? 'Live' : v === 'poll' ? 'Polling' : 'Offline';
}

let ws, retry = 0, debounce;
export function connectLive() {
  try { ws = new WebSocket(S.cfg.wsUrl); } catch { setLink('poll'); return; }
  ws.onopen = () => { retry = 0; setLink('live'); refresh(); };
  ws.onmessage = () => { clearTimeout(debounce); debounce = setTimeout(refresh, 150); };
  ws.onclose = () => { setLink('poll'); setTimeout(connectLive, Math.min(15000, 1000 * 2 ** retry++)); };
  ws.onerror = () => ws.close();
}

export async function boot() {
  S.cfg = await (await fetch('config.json', { cache: 'no-store' })).json();
  await refresh();
  connectLive();
  setInterval(refresh, 30000); // safety net if the socket drops
}
