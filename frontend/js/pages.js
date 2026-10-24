import { S, $, esc, SEV, TYPES, ago, api, toast, session, emit } from './core.js';

const ICONS = {
  dashboard: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  map: 'M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z',
  incidents: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  shelters: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  teams: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  analytics: 'M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z',
  alerts: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  architecture: 'M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z',
};
export const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="${ICONS[k]}"/></svg>`;

const EMOJI = { flood: 'Flood', fire: 'Fire', earthquake: 'Earthquake', cyclone: 'Cyclone', landslide: 'Landslide', medical: 'Medical' };
const isOpen = (i) => i.status !== 'resolved';
const sevTag = (n) => `<span class="tag" style="--c:${SEV[n][1]}">${SEV[n][0]}</span>`;
const stTag = (s) => `<span class="tag st-${s}">${s.replace('_', ' ')}</span>`;
const photoUrl = (id) => `${S.cfg.apiUrl}/photo/${id}`;
const sorted = (list) => [...list].sort((a, b) => (isOpen(b) - isOpen(a)) || b.severity - a.severity || b.createdAt.localeCompare(a.createdAt));
const mins = (a, b) => Math.round((new Date(b) - new Date(a)) / 60000);

// ---------- maps ----------
const TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
const mapIcon = (cls, size, color) => L.divIcon({ className: '', html: `<div class="${cls}" style="--c:${color || 'transparent'}"></div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });

function makeMap(el, { full = false, heat = false } = {}) {
  const map = L.map(el, { zoomControl: full, attributionControl: true }).setView([22.5, 80.5], 5);
  L.tileLayer(TILE, { attribution: 'Tiles &copy; Esri', maxZoom: 16 }).addTo(map);
  L.tileLayer(LABELS, { maxZoom: 16, opacity: 0.7 }).addTo(map);
  map.on('click', (e) => emit('mapclick', e.latlng));
  const ro = new ResizeObserver(() => map.invalidateSize());
  ro.observe(el);
  const group = L.layerGroup().addTo(map);
  const cache = new Map();
  let heatLayer;

  const sync = () => {
    const want = new Map();
    const staff = session()?.staff;
    S.data.incidents.filter(isOpen).forEach((i) => {
      const sig = [i.status, i.severity, i.teamName].join('|');
      want.set('i' + i.id, [sig, () => L.marker([i.lat, i.lng], { icon: mapIcon('pin live', 20, SEV[i.severity][1]), zIndexOffset: i.severity * 100 })
        .bindPopup(`<b>${esc(i.title)}</b><br>${esc(i.place)} &middot; ${SEV[i.severity][0]}<br>${(i.peopleAffected || 0).toLocaleString()} affected &middot; ${i.status.replace('_', ' ')}${i.teamName ? `<br>Team: ${esc(i.teamName)}` : ''}${i.photo ? `<img class="pop-img" src="${photoUrl(i.id)}" alt="">` : ''}${staff && !i.assignedTeam ? `<br><button class="btn primary sm" style="margin-top:8px" data-act="dispatch" data-id="${i.id}">Dispatch nearest team</button>` : ''}`)]);
    });
    if (full) {
      S.data.shelters.forEach((s) => want.set('s' + s.id, [`${s.occupied}`, () => L.marker([s.lat, s.lng], { icon: mapIcon('sh', 14) }).bindPopup(`<b>${esc(s.name)}</b><br>${s.occupied}/${s.capacity} occupied`)]));
      S.data.teams.forEach((t) => want.set('t' + t.id, [t.status, () => L.marker([t.lat, t.lng], { icon: mapIcon('tm ' + t.status, 14) }).bindPopup(`<b>${esc(t.name)}</b><br>${t.kind} &middot; ${t.status}`)]));
    }
    for (const [k, v] of cache) if (!want.has(k) || want.get(k)[0] !== v.sig) { group.removeLayer(v.m); cache.delete(k); }
    for (const [k, [sig, build]] of want) if (!cache.has(k)) { const m = build().addTo(group); cache.set(k, { m, sig }); }
    if (heat) {
      heatLayer?.remove();
      const pts = S.data.incidents.map((i) => [i.lat, i.lng, i.severity / 4]);
      heatLayer = L.heatLayer(pts, { radius: 38, blur: 30, maxZoom: 7, gradient: { 0.3: '#1d4ed8', 0.55: '#10b981', 0.8: '#eab308', 1: '#ef4444' } }).addTo(map);
    }
  };
  sync();
  return { map, sync, focus: (id) => { const i = S.data.incidents.find((x) => x.id === id); if (i) { map.flyTo([i.lat, i.lng], 9, { duration: 0.8 }); cache.get('i' + id)?.m.openPopup(); } }, destroy: () => { ro.disconnect(); map.stop(); map.remove(); } };
}

// ---------- shared UI bits ----------
function incActions(i) {
  if (!session()?.staff || !isOpen(i)) return '';
  return `<div class="actions">${!i.assignedTeam ? `<button class="btn primary sm" data-act="dispatch" data-id="${i.id}">Dispatch</button>` : i.status !== 'in_progress' ? `<button class="btn sm" data-act="in_progress" data-id="${i.id}">On-site</button>` : ''}<button class="btn ghost sm" data-act="resolved" data-id="${i.id}">Resolve</button></div>`;
}

const kpi = (label, val, sub = '', cls = '') => `<div class="card kpi ${cls}"><p>${label}</p><b>${val}</b><span>${sub}</span></div>`;

function stats() {
  const { incidents, teams, shelters } = S.data;
  const open = incidents.filter(isOpen);
  const cap = shelters.reduce((a, s) => a + s.capacity, 0);
  const occ = shelters.reduce((a, s) => a + s.occupied, 0);
  return {
    open, crit: open.filter((i) => i.severity === 4).length, people: open.reduce((a, i) => a + (i.peopleAffected || 0), 0),
    free: teams.filter((t) => t.status === 'available').length, teams: teams.length, load: cap ? Math.round((occ / cap) * 100) : 0,
  };
}

const lowSupplies = () => S.data.shelters.flatMap((s) => ['food', 'water', 'medical'].filter((k) => s[k] < 35).map((k) => ({ s, k, v: s[k] }))).sort((a, b) => a.v - b.v);

// ---------- pages ----------
export const PAGES = {
  dashboard: {
    title: 'Dashboard', sub: 'Live overview of incidents, teams and relief supplies',
    render(view) {
      view.innerHTML = `<div class="grid g4 mb" id="kpis"></div>
        <div class="grid g32 mb"><div class="card map-card"><div class="map-mini" id="mini"></div></div><div class="card"><header><h2>Active incidents</h2><a class="link" href="#/incidents">View all</a></header><div id="recent"></div></div></div>
        <div class="grid g2"><div class="card"><header><h2>Low supplies</h2><a class="link" href="#/shelters">Shelters</a></header><div id="low"></div></div>
        <div class="card"><header><h2>Team status</h2><a class="link" href="#/teams">Teams</a></header><div id="tstat"></div></div></div>`;
      const m = makeMap(view.querySelector('#mini'));
      const fill = () => {
        const k = stats();
        $('kpis').innerHTML = kpi('Active incidents', k.open.length, 'not yet resolved') + kpi('Critical', k.crit, 'need immediate response', 'crit') +
          kpi('People affected', k.people.toLocaleString(), 'across active incidents') + kpi('Teams available', `${k.free}/${k.teams}`, 'ready to dispatch', 'ok') + kpi('Shelter load', k.load + '%', 'of total capacity');
        const top = sorted(k.open).slice(0, 6);
        $('recent').innerHTML = top.length ? top.map((i) => `<div class="row-item" data-focus="${i.id}"><span class="sev" style="--c:${SEV[i.severity][1]}"></span><div><div class="t">${esc(i.title)}</div><div class="m">${esc(i.place)} &middot; ${ago(i.createdAt)}</div></div><div class="r">${stTag(i.status)}</div></div>`).join('') : '<div class="empty">No active incidents</div>';
        const low = lowSupplies().slice(0, 6);
        $('low').innerHTML = low.length ? low.map(({ s, k, v }) => `<div class="row-item" style="cursor:default"><div><div class="t">${esc(s.name)}</div><div class="m">${k} supply</div></div><div class="r"><span class="tag" style="--c:${v < 20 ? SEV[4][1] : SEV[3][1]}">${v}% left</span></div></div>`).join('') : '<div class="empty">All shelters are well stocked</div>';
        $('tstat').innerHTML = S.data.teams.map((t) => `<div class="row-item team ${t.status}" style="cursor:default"><span class="dot sev" style="--c:${t.status === 'available' ? '#10b981' : '#60a5fa'}"></span><div><div class="t">${esc(t.name)}</div><div class="m">${t.kind}</div></div><div class="r">${t.status === 'deployed' ? '<span class="tag st-dispatched">deployed</span>' : '<span class="tag st-resolved">available</span>'}</div></div>`).join('');
        m.sync();
      };
      fill();
      return { update: fill, destroy: m.destroy };
    },
  },

  map: {
    title: 'Live map', sub: 'Incidents, shelters and response teams',
    render(view) {
      view.innerHTML = `<div class="card map-card map-full"><div id="bigmap"></div><div class="legend">${[4, 3, 2, 1].map((n) => `<span><i style="background:${SEV[n][1]}"></i>${SEV[n][0]}</span>`).join('')}<span><i style="background:#10b981;border-radius:2px"></i>Shelter</span><span><i style="background:#60a5fa;border-radius:1px"></i>Team</span></div></div>`;
      const m = makeMap(view.querySelector('#bigmap'), { full: true });
      if (S.focus) { const id = S.focus; S.focus = null; setTimeout(() => m.focus(id), 200); }
      return { update: m.sync, destroy: m.destroy };
    },
  },

  incidents: {
    title: 'Incidents', sub: 'Everything reported, with AI photo analysis',
    render(view) {
      let filter = 'open', q = '', sev = '', type = '';
      view.innerHTML = `<div class="toolbar"><div class="seg" id="seg"><button data-f="open" class="on">Active</button><button data-f="all">All</button><button data-f="resolved">Resolved</button></div><input class="search" id="q" placeholder="Search incidents or places"><select class="fsel" id="fsev" aria-label="Filter by severity"><option value="">All severities</option><option value="4">Critical</option><option value="3">High</option><option value="2">Medium</option><option value="1">Low</option></select><select class="fsel" id="ftype" aria-label="Filter by type"><option value="">All types</option>${TYPES.map((t) => `<option value="${t}">${EMOJI[t]}</option>`).join('')}</select></div>
        <div class="card"><div class="tbl-wrap"><table><thead><tr><th></th><th>Incident</th><th>Type</th><th>Severity</th><th>Status</th><th>Team</th><th>Reported</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div>`;
      const fill = () => {
        const list = sorted(S.data.incidents).filter((i) => (filter === 'all' || (filter === 'open' ? isOpen(i) : !isOpen(i))) && (!q || (i.title + i.place).toLowerCase().includes(q)) && (!sev || i.severity === +sev) && (!type || i.type === type));
        $('rows').innerHTML = list.length ? list.map((i) => `<tr>
          <td>${i.photo ? `<img class="thumb" src="${photoUrl(i.id)}" data-lightbox="${photoUrl(i.id)}" alt="">` : ''}</td>
          <td><div style="font-weight:500">${esc(i.title)}</div><div class="m" style="color:var(--dim);font-size:12px">${esc(i.place)} &middot; ${(i.peopleAffected || 0).toLocaleString()} affected${i.aiLabels?.length ? ` &middot; <span class="tag photo-tag" title="Amazon Rekognition">AI: ${esc(i.aiLabels.slice(0, 3).map((l) => l.name).join(', '))}</span>` : ''}</div></td>
          <td>${EMOJI[i.type] || i.type}</td><td>${sevTag(i.severity)}</td><td>${stTag(i.status)}</td>
          <td>${i.teamName ? `${esc(i.teamName)}${i.etaMinutes && i.status === 'dispatched' ? `<div style="color:var(--dim);font-size:12px">ETA ${i.etaMinutes} min${i.distanceKm ? ` &middot; ${i.distanceKm} km straight-line` : ''}</div>` : ''}` : '<span style="color:var(--dim)">Unassigned</span>'}</td>
          <td style="color:var(--muted);white-space:nowrap">${ago(i.createdAt)}</td><td>${incActions(i)}</td></tr>`).join('') : '<tr><td colspan="8" class="empty">No incidents match.</td></tr>';
      };
      view.querySelector('#seg').onclick = (e) => { if (!e.target.dataset.f) return; filter = e.target.dataset.f; view.querySelectorAll('#seg button').forEach((b) => b.classList.toggle('on', b === e.target)); fill(); };
      view.querySelector('#q').oninput = (e) => { q = e.target.value.toLowerCase(); fill(); };
      view.querySelector('#fsev').onchange = (e) => { sev = e.target.value; fill(); };
      view.querySelector('#ftype').onchange = (e) => { type = e.target.value; fill(); };
      fill();
      return { update: fill };
    },
  },

  shelters: {
    title: 'Shelters & supplies', sub: 'Occupancy and relief stock across all camps',
    render(view) {
      const fill = () => {
        const staff = session()?.staff;
        view.innerHTML = `<div class="grid g4">${S.data.shelters.map((s) => {
          const pct = Math.round((s.occupied / s.capacity) * 100);
          const c = pct > 90 ? SEV[4][1] : pct > 70 ? SEV[3][1] : '#10b981';
          const meter = (l, v) => `<div class="meter"><span>${l}</span><div class="bar-track"><i style="width:${v}%;--c:${v < 35 ? SEV[4][1] : '#10b981'}"></i></div><em>${v}%</em></div>`;
          return `<div class="card shelter"><div class="top"><b>${esc(s.name)}</b><span>${s.occupied}/${s.capacity}</span></div>
            <div class="bar-track"><i style="width:${pct}%;--c:${c}"></i></div><div class="m" style="color:var(--dim);font-size:12px;margin-top:6px">${pct}% occupied</div>
            <div class="meters">${meter('Food', s.food)}${meter('Water', s.water)}${meter('Medical', s.medical)}</div>
            ${staff ? `<div class="alloc" data-shelter="${s.id}"><select><option value="food">Food</option><option value="water">Water</option><option value="medical">Medical</option></select><input type="number" min="1" max="100" value="20" aria-label="Amount"><button class="btn primary sm" data-alloc>Allocate</button></div>` : ''}</div>`;
        }).join('')}</div>${staff ? '' : '<p class="m" style="color:var(--dim);margin-top:14px">Sign in as a responder or admin to allocate supplies.</p>'}`;
      };
      fill();
      view.onclick = async (e) => {
        const b = e.target.closest('[data-alloc]');
        if (!b) return;
        const box = b.closest('.alloc');
        b.disabled = true;
        try {
          const r = await api(`/shelters/${box.dataset.shelter}/allocate`, 'POST', { item: box.querySelector('select').value, amount: box.querySelector('input').value });
          toast(`${r.item} supply now ${r.level}%`);
        } catch (err) { toast(err.message); b.disabled = false; }
      };
      return { update: () => { if (!view.contains(document.activeElement) || document.activeElement === view) fill(); } };
    },
  },

  teams: {
    title: 'Response teams', sub: 'Availability and current deployments',
    render(view) {
      view.innerHTML = `<div class="card"><div class="tbl-wrap"><table><thead><tr><th>Team</th><th>Specialty</th><th>Status</th><th>Assignment</th></tr></thead><tbody id="rows"></tbody></table></div></div>`;
      const fill = () => {
        $('rows').innerHTML = S.data.teams.map((t) => {
          const inc = S.data.incidents.find((i) => i.id === t.incidentId);
          return `<tr><td style="font-weight:500">${esc(t.name)}</td><td style="text-transform:capitalize">${t.kind}</td><td>${t.status === 'deployed' ? '<span class="tag st-dispatched">deployed</span>' : '<span class="tag st-resolved">available</span>'}</td><td>${inc ? `${esc(inc.title)} <span style="color:var(--dim)">&middot; ${esc(inc.place)}</span>` : '<span style="color:var(--dim)">Standing by</span>'}</td></tr>`;
        }).join('');
      };
      fill();
      return { update: fill };
    },
  },

  analytics: {
    title: 'Analytics', sub: 'Response performance and incident hotspots',
    render(view) {
      view.innerHTML = `<div class="grid g4 mb" id="akpi"></div>
        <div class="grid g2 mb"><div class="card"><header><h2>Incidents by type</h2></header><div class="chart"><canvas id="c1"></canvas></div></div><div class="card"><header><h2>Active by severity</h2></header><div class="chart"><canvas id="c2"></canvas></div></div></div>
        <div class="grid g2 mb"><div class="card"><header><h2>Avg. dispatch time by severity (min)</h2></header><div class="chart"><canvas id="c3"></canvas></div></div><div class="card"><header><h2>Incidents, last 7 days</h2></header><div class="chart"><canvas id="c4"></canvas></div></div></div>
        <div class="card map-card"><div style="padding:18px 18px 0"><h2>Hotspot heatmap</h2></div><div class="map-mini" id="heat" style="margin-top:12px"></div></div>`;
      const m = makeMap(view.querySelector('#heat'), { heat: true });
      let charts = [];
      Chart.defaults.color = '#94a3b8';
      Chart.defaults.borderColor = '#1e293b';
      Chart.defaults.font.family = 'system-ui, sans-serif';
      const draw = () => {
        charts.forEach((c) => c.destroy());
        const inc = S.data.incidents;
        const disp = inc.filter((i) => i.dispatchedAt);
        const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
        const resolved = inc.filter((i) => i.resolvedAt);
        $('akpi').innerHTML = kpi('Avg. dispatch time', avg(disp.map((i) => mins(i.createdAt, i.dispatchedAt))) + ' min', `${disp.length} dispatched incidents`) +
          kpi('Avg. resolution', (avg(resolved.map((i) => mins(i.createdAt, i.resolvedAt))) / 60).toFixed(1) + ' h', `${resolved.length} resolved`) +
          kpi('People assisted', resolved.reduce((a, i) => a + (i.peopleAffected || 0), 0).toLocaleString(), 'in resolved incidents', 'ok') + kpi('Total incidents', inc.length, 'all time');
        const tc = TYPES.map((t) => inc.filter((i) => i.type === t).length);
        charts.push(new Chart($('c1'), { type: 'bar', data: { labels: TYPES.map((t) => EMOJI[t]), datasets: [{ data: tc, backgroundColor: '#10b981', borderRadius: 6 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } }));
        const open = inc.filter(isOpen);
        charts.push(new Chart($('c2'), { type: 'doughnut', data: { labels: [4, 3, 2, 1].map((n) => SEV[n][0]), datasets: [{ data: [4, 3, 2, 1].map((n) => open.filter((i) => i.severity === n).length), backgroundColor: [4, 3, 2, 1].map((n) => SEV[n][1]), borderWidth: 0 }] }, options: { maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom' } } } }));
        charts.push(new Chart($('c3'), { type: 'bar', data: { labels: [4, 3, 2, 1].map((n) => SEV[n][0]), datasets: [{ data: [4, 3, 2, 1].map((n) => avg(disp.filter((i) => i.severity === n).map((i) => mins(i.createdAt, i.dispatchedAt)))), backgroundColor: [4, 3, 2, 1].map((n) => SEV[n][1]), borderRadius: 6 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } }));
        const days = [...Array(7)].map((_, k) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - k)); return d; });
        charts.push(new Chart($('c4'), { type: 'line', data: { labels: days.map((d) => d.toLocaleDateString(undefined, { weekday: 'short' })), datasets: [{ data: days.map((d) => inc.filter((i) => { const t = new Date(i.createdAt); return t >= d && t < new Date(+d + 864e5); }).length), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.15)', fill: true, tension: 0.35, pointRadius: 3 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } }));
        m.sync();
      };
      draw();
      return { update: draw, destroy: () => { charts.forEach((c) => c.destroy()); m.destroy(); } };
    },
  },

  alerts: {
    title: 'Alerts', sub: 'Get emailed when new incidents are reported',
    render(view) {
      view.innerHTML = `<div class="grid g2"><div class="card"><header><h2>Subscribe to alerts</h2></header>
        <form class="form" id="sub"><label>Email<input name="email" type="email" required placeholder="you@example.com"></label>
        <label>Notify me for<select name="minSeverity"><option value="4">Critical only</option><option value="3" selected>High and above</option><option value="2">Medium and above</option><option value="1">Everything</option></select></label>
        <button class="btn primary">Subscribe</button><p class="m" id="sub-msg" style="color:var(--muted)"></p></form></div>
        <div class="card"><header><h2>Recent alerts sent</h2></header><div id="log"></div></div></div>
        <p class="m" style="color:var(--dim);margin-top:14px">Each new incident triggers a DynamoDB Stream event, a Lambda function publishes it to an Amazon SNS topic, and SNS delivers it to subscribers whose severity filter matches.</p>`;
      view.querySelector('#sub').onsubmit = async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        const msg = $('sub-msg');
        msg.textContent = 'Subscribing...';
        try { const r = await api('/subscribe', 'POST', f); msg.textContent = r.note; msg.style.color = 'var(--accent-hi)'; }
        catch (err) { msg.textContent = err.message; msg.style.color = '#fca5a5'; }
      };
      const fill = () => {
        $('log').innerHTML = [...S.data.incidents].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8).map((i) => `<div class="row-item" style="cursor:default"><span class="sev" style="--c:${SEV[i.severity][1]}"></span><div><div class="t">${esc(i.title)}</div><div class="m">${esc(i.place)}</div></div><div class="r"><div class="m">${ago(i.createdAt)}</div></div></div>`).join('');
      };
      fill();
      return { update: fill };
    },
  },

  architecture: {
    title: 'Architecture', sub: 'AWS services behind this app, with live counters',
    render(view) {
      const R = 'ap-south-1', C = `https://${R}.console.aws.amazon.com`;
      const node = (n, d, link, hot) => `<a class="node ${hot ? 'hot' : ''}" href="${link}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><b>${n}</b><span>${d}</span></a>`;
      view.innerHTML = `<div class="grid g32"><div class="card arch">
        <div class="layer"><b>Client</b><div class="nodes">${node('Amazon S3', 'Static website hosting', `https://s3.console.aws.amazon.com/s3/buckets?region=${R}`)}${node('Amazon Cognito', 'Sign-in, roles (admin, responder, citizen)', `${C}/cognito/v2/idp/user-pools?region=${R}`)}</div></div>
        <div class="flow">HTTPS &middot; JWT &nbsp;&nbsp;|&nbsp;&nbsp; WebSocket</div>
        <div class="layer"><b>API</b><div class="nodes">${node('API Gateway (HTTP)', 'REST routes + JWT authorizer', `${C}/apigateway/main/apis?region=${R}`)}${node('API Gateway (WebSocket)', 'Live push to dashboards', `${C}/apigateway/main/apis?region=${R}`, true)}</div></div>
        <div class="flow">&#8595;</div>
        <div class="layer"><b>Compute</b><div class="nodes">${node('Lambda: relief-api', 'Business logic, dispatch, allocation', `${C}/lambda/home?region=${R}#/functions/relief-api`)}${node('Lambda: alert-stream', 'Triggered by DynamoDB Streams', `${C}/lambda/home?region=${R}#/functions/relief-alert-stream`)}${node('Amazon Rekognition', 'Photo analysis of reports', `${C}/rekognition/home?region=${R}`, true)}</div></div>
        <div class="flow">&#8595;</div>
        <div class="layer"><b>Data &amp; alerts</b><div class="nodes">${node('Amazon DynamoDB', 'Incidents, teams, shelters', `${C}/dynamodbv2/home?region=${R}#tables`)}${node('Amazon S3', 'Incident photos (private)', `https://s3.console.aws.amazon.com/s3/buckets?region=${R}`)}${node('Amazon SNS', 'Email alerts with severity filters', `${C}/sns/v3/home?region=${R}#/topics`)}</div></div>
        <div class="layer"><b>Operations</b><div class="nodes">${node('CloudWatch', 'Dashboard: Disaster-Relief-Ops', `${C}/cloudwatch/home?region=${R}#dashboards/dashboard/Disaster-Relief-Ops`)}${node('CloudFormation (CDK)', 'Infrastructure as code', `${C}/cloudformation/home?region=${R}#/stacks`)}</div></div>
        </div>
        <div class="card"><header><h2>Live system stats</h2><button class="btn sm" id="h-refresh">Refresh</button></header><div id="health" class="empty">Loading...</div></div></div>
        <div class="card" style="margin-top:16px"><header><h2>Notes and limitations</h2></header><ul class="notes">
          <li>All incidents, teams and shelters are fictional demo data. No real emergency notifications are sent.</li>
          <li>Records persist in DynamoDB. Status changes are pushed to open dashboards over a WebSocket, with a 30 second polling fallback.</li>
          <li>Dispatch picks the nearest available team of the matching specialty using straight-line (Haversine) distance, not road distance. Severity is chosen by the reporter; lists are ordered by severity, then recency.</li>
          <li>Photo labels come from Amazon Rekognition and are suggestions only, not a verified assessment.</li>
          <li>Application logs go to CloudWatch Logs (7 day retention); metrics are on the Disaster-Relief-Ops dashboard.</li>
          <li>The site is served over HTTP from an S3 website endpoint. HTTPS through CloudFront is pending AWS account verification.</li>
        </ul></div>`;
      const load = async () => {
        try {
          const h = await api('/health');
          const r = (k, v) => `<div class="row-item" style="cursor:default"><div class="t">${k}</div><div class="r">${v}</div></div>`;
          $('health').className = '';
          $('health').innerHTML = r('Region', h.region) + r('Lambda runtime', h.runtime.replace('AWS_Lambda_', '')) + r('Incidents stored', h.tables.incidents) + r('Teams', h.tables.teams) + r('Shelters', h.tables.shelters) + r('Open WebSocket connections', h.wsConnections) + r('Email subscribers', h.subscribers + (h.pendingSubscribers ? ` (+${h.pendingSubscribers} pending)` : ''));
        } catch (e) { $('health').textContent = e.message; }
      };
      view.querySelector('#h-refresh').onclick = load;
      load();
      return {};
    },
  },
};

// ---------- row/button actions shared by every page ----------
export function wireActions(view) {
  view.addEventListener('click', async (e) => {
    const lb = e.target.closest('[data-lightbox]');
    if (lb) { const d = document.createElement('div'); d.className = 'lightbox'; d.innerHTML = `<img src="${lb.dataset.lightbox}" alt="">`; d.onclick = () => d.remove(); document.body.append(d); return; }
    const b = e.target.closest('[data-act]');
    if (b) {
      b.disabled = true;
      try {
        const r = await api(`/incidents/${b.dataset.id}/${b.dataset.act}`, 'POST');
        if (r.dispatched) toast(`${r.dispatched} dispatched: ${r.distanceKm} km straight-line, ETA ${r.etaMinutes} min`, 5000);
      } catch (err) { toast(err.message); b.disabled = false; }
      return;
    }
    const f = e.target.closest('[data-focus]');
    if (f) { S.focus = f.dataset.focus; location.hash = '#/map'; }
  });
}
