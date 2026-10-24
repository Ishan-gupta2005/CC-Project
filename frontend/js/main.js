import { S, $, on, boot, session, signIn, signUp, signOut, api, toast, refresh, esc, markKnown } from './core.js';
import { PAGES, icon, wireActions } from './pages.js';

const GUEST = 'relief.guest';
const guest = () => { try { return sessionStorage.getItem(GUEST) === '1'; } catch { return false; } };
const setGuest = (v) => { try { v ? sessionStorage.setItem(GUEST, '1') : sessionStorage.removeItem(GUEST); } catch { /* ignore */ } };

let current = null;
let pageKey = null;

// ---------- chrome ----------
function renderNav() {
  $('nav').innerHTML = Object.entries(PAGES).map(([k, p]) => `<a href="#/${k}" data-k="${k}">${icon(k)}${p.title.split(' &')[0]}</a>`).join('');
}

function renderUser() {
  const me = session();
  $('u-email').textContent = me ? me.email : 'Guest';
  $('u-role').textContent = me ? me.role : 'read-only';
  $('avatar').textContent = (me ? me.email : 'G')[0].toUpperCase();
  $('auth-btn').textContent = me ? 'Sign out' : 'Sign in';
  $('btn-sim').hidden = !me?.staff;
  $('btn-reset').hidden = me?.role !== 'admin';
}

function route() {
  const key = (location.hash.replace('#/', '') || 'dashboard');
  const k = PAGES[key] ? key : 'dashboard';
  if (current?.destroy) current.destroy();
  pageKey = k;
  const p = PAGES[k];
  $('title').textContent = p.title;
  $('subtitle').textContent = p.sub;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.k === k));
  $('side').classList.remove('open');
  const v = $('view');
  v.onclick = null;
  v.scrollTop = 0;
  current = p.render(v) || {};
}

function showApp() {
  $('landing').hidden = true;
  $('app').hidden = false;
  renderUser();
  route();
}

function showLanding() {
  $('app').hidden = true;
  $('landing').hidden = false;
  window.scrollTo(0, 0);
  renderLanding();
}

// ---------- auth modal ----------
let mode = 'signin';
function openAuth(m = 'signin') {
  mode = m;
  const up = m === 'signup';
  $('auth-title').textContent = up ? 'Create your account' : 'Sign in';
  $('auth-sub').textContent = up ? 'Citizens can report incidents instantly.' : 'Use your ReliefNet account.';
  $('auth-submit').textContent = up ? 'Create account' : 'Sign in';
  $('auth-swap-text').textContent = up ? 'Already registered?' : 'New here?';
  $('auth-swap').textContent = up ? 'Sign in' : 'Create an account';
  $('auth-err').textContent = '';
  $('demo-row').hidden = up;
  $('auth-form').querySelector('[name=password]').autocomplete = up ? 'new-password' : 'current-password';
  $('auth-modal').hidden = false;
}

$('auth-swap').onclick = () => openAuth(mode === 'signin' ? 'signup' : 'signin');
$('auth-close').onclick = () => { $('auth-modal').hidden = true; };
$('auth-modal').addEventListener('mousedown', (e) => { if (e.target === $('auth-modal')) $('auth-modal').hidden = true; });
$('auth-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const btn = $('auth-submit');
  btn.disabled = true;
  $('auth-err').textContent = '';
  try {
    await (mode === 'signup' ? signUp : signIn)(f.email.trim().toLowerCase(), f.password);
    $('auth-modal').hidden = true;
    e.target.reset();
    setGuest(false);
    showApp();
    toast(`Signed in as ${session().email}`);
  } catch (err) {
    $('auth-err').textContent = err.message;
  }
  btn.disabled = false;
};

$('auth-btn').onclick = () => {
  if (session()) { signOut(); setGuest(false); showLanding(); } else openAuth('signin');
};
on('signedout', () => { toast('Session expired, please sign in again'); renderUser(); });

// ---------- landing ----------
const enterAsGuest = () => { setGuest(true); showApp(); };
$('l-guest').onclick = () => document.querySelector('#how').scrollIntoView({ behavior: 'smooth' });
$('l-guest2').onclick = enterAsGuest;
$('l-open').onclick = enterAsGuest;
$('l-signin').onclick = () => openAuth('signin');
$('l-start2').onclick = () => openAuth('signup');
const DEMO_PW = 'Relief2026demo';
async function demoLogin(role) {
  try {
    await signIn(`${role}@relief.demo`, DEMO_PW);
    setGuest(false);
    $('auth-modal').hidden = true;
    showApp();
    toast(`Signed in as demo ${role}`);
  } catch (e) { toast(e.message); }
}
$('l-start').onclick = () => demoLogin('responder');
document.querySelectorAll('[data-demo]').forEach((b) => { b.onclick = () => demoLogin(b.dataset.demo); });
document.querySelectorAll('[data-guest]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); setGuest(true); location.hash = '#/' + a.dataset.guest; showApp(); }));
document.querySelectorAll('[data-ic]').forEach((el) => { el.innerHTML = icon(el.dataset.ic); });
document.querySelectorAll('[data-scroll]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth' }); }));

// live preview on the landing page, fed by the real API
function renderLanding() {
  const { incidents, teams, shelters } = S.data;
  const open = incidents.filter((i) => i.status !== 'resolved').sort((a, b) => b.severity - a.severity || b.createdAt.localeCompare(a.createdAt));
  const cls = { 4: ['r', 'CRITICAL'], 3: ['o', 'HIGH'], 2: ['y', 'MEDIUM'], 1: ['b', 'LOW'] };
  const free = teams.filter((t) => t.status === 'available').length;
  $('term').innerHTML = `<div><span class="g">$</span> <span class="w">relief watch --region india</span></div>
    <div><span class="g">[*]</span> connected via WebSocket &middot; ${open.length} active incidents &middot; ${free} teams ready</div>` +
    open.slice(0, 4).map((i) => `<div><span class="${cls[i.severity][0]}">[!] ${cls[i.severity][1].padEnd(8, ' ').replace(/ /g, '&nbsp;')}</span> <span class="w">${esc(i.title)}</span> <span>&middot; ${esc(i.place)}</span></div>`).join('') +
    `<div><span class="g">[+]</span> smart dispatch ready <span class="g">&#9608;</span></div>`;
  $('l-stats').innerHTML = [[open.length, 'Active incidents'], [teams.length, 'Response teams'], [shelters.length, 'Relief shelters'], [open.reduce((a, i) => a + (i.peopleAffected || 0), 0).toLocaleString(), 'People affected']].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
}
on('data', () => { if (!$('landing').hidden) renderLanding(); });
$('menu').onclick = () => $('side').classList.toggle('open');

// ---------- live updates ----------
on('data', () => {
  if (!current?.update || $('app').hidden) return;
  try { current.update(); } catch (e) { console.error(e); }
});

$('btn-reset').onclick = async () => {
  if (!confirm('Reset all demo data to the original seeded scenario? Incidents you created will be removed.')) return;
  $('btn-reset').disabled = true;
  try { await api('/seed', 'POST'); toast('Demo data reset'); await refresh(); } catch (e) { toast(e.message); }
  $('btn-reset').disabled = false;
};

// ---------- simulate ----------
$('btn-sim').onclick = async () => {
  $('btn-sim').disabled = true;
  try { await api('/simulate', 'POST'); } catch (e) { toast(e.message); }
  $('btn-sim').disabled = false;
};

// ---------- report incident ----------
let picking = null;
let pickMode = false;
let photoB64 = null;

const reportModal = $('report-modal');

function openReport() {
  if (!session()) { toast('Sign in to report an incident'); openAuth('signin'); return; }
  $('report-err').textContent = '';
  reportModal.hidden = false;
}
$('btn-report').onclick = openReport;
$('report-cancel').onclick = () => { reportModal.hidden = true; };
reportModal.addEventListener('mousedown', (e) => { if (e.target === reportModal) reportModal.hidden = true; });

$('pick').onclick = () => {
  pickMode = true;
  reportModal.hidden = true;
  if (pageKey !== 'map') location.hash = '#/map';
  toast('Click the map to place the incident', 4500);
};
on('mapclick', (ll) => {
  if (!pickMode) return;
  pickMode = false;
  picking = ll;
  $('pin-hint').textContent = `Location set: ${ll.lat.toFixed(3)}, ${ll.lng.toFixed(3)}`;
  $('pin-hint').className = 'hint ok';
  reportModal.hidden = false;
});

// resize to <= 1024px JPEG before upload, to keep the request small and fast
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, 1024 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r);
      c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = URL.createObjectURL(file);
  });
}

$('photo').onchange = async (e) => {
  const f = e.target.files[0];
  const prev = $('photo-prev');
  photoB64 = null;
  prev.hidden = true;
  if (!f) return;
  try {
    const url = await shrink(f);
    photoB64 = url.split(',')[1];
    prev.innerHTML = `<img src="${url}" alt=""><span class="hint">Amazon Rekognition will analyse this photo.</span>`;
    prev.hidden = false;
  } catch (err) { $('report-err').textContent = err.message; }
};

$('report-form').onsubmit = async (e) => {
  e.preventDefault();
  if (!picking) { $('report-err').textContent = 'Please pick the incident location on the map.'; return; }
  const f = Object.fromEntries(new FormData(e.target));
  delete f.photo;
  const btn = $('report-submit');
  btn.disabled = true;
  btn.textContent = photoB64 ? 'Analysing photo...' : 'Submitting...';
  try {
    const r = await api('/incidents', 'POST', { ...f, severity: +f.severity, peopleAffected: +f.peopleAffected, lat: picking.lat, lng: picking.lng, photo: photoB64 || undefined });
    markKnown(r.id);
    reportModal.hidden = true;
    e.target.reset();
    picking = null; photoB64 = null;
    $('photo-prev').hidden = true;
    $('pin-hint').textContent = 'No location selected';
    $('pin-hint').className = 'hint';
    const ai = r.aiLabels?.length ? ` AI saw: ${r.aiLabels.slice(0, 3).map((l) => `${l.name} ${l.confidence}%`).join(', ')}.` : '';
    toast('Incident reported.' + ai, 6000);
    refresh();
  } catch (err) { $('report-err').textContent = err.message; }
  btn.disabled = false;
  btn.textContent = 'Submit report';
};

// ---------- start ----------
window.addEventListener('hashchange', () => { if (!$('app').hidden) route(); });
wireActions($('view'));
renderNav();
boot().then(() => {
  if (session() || guest()) showApp(); else showLanding();
}).catch((e) => { document.body.insertAdjacentHTML('beforeend', `<p style="padding:40px;color:#fca5a5">Could not load: ${esc(e.message)}</p>`); });
