<script>
"use strict";
/* ==========================================================================
   Rail — bank pickers
   ========================================================================== */
function bankRow(b, checked, onToggle, radio){
  const d = document.createElement('div');
  d.className = 'pickrow';
  const inactive = String(b.ACTIVE) === '0';
  d.innerHTML =
    '<input type="' + (radio ? 'radio' : 'checkbox') + '"' + (radio ? ' name="focuspick"' : '') +
      (checked ? ' checked' : '') + '>' +
    '<span class="nm"><b>' + esc(b.NAME) +
      (inactive ? ' <span style="color:var(--serious);font-weight:600">· closed</span>' : '') + '</b>' +
      '<small>' + esc([b.CITY, b.STALP].filter(Boolean).join(', ')) + ' · cert ' + b.CERT +
      ' · ' + esc(b.BKCLASS || '') + (b.TRUST && b.TRUST !== '00' ? ' · trust powers' : '') + '</small></span>' +
    '<span class="sz">' + fmt(b.ASSET, 'usd') + '</span>';
  const inp = qs('input', d);
  inp.addEventListener('change', e => onToggle(b, e.target.checked));
  d.addEventListener('click', e => {
    if(e.target !== inp){ inp.checked = radio ? true : !inp.checked; onToggle(b, inp.checked); }
  });
  d._cert = String(b.CERT);
  return d;
}
function renderList(host, banks, checkedFn, onToggle, radio, headline){
  host.innerHTML = '';
  if(!banks.length){
    host.innerHTML = '<p class="hint">No institutions matched. Try a shorter name, ' +
      'or search by FDIC cert number.</p>';
    return;
  }
  const wrap = document.createElement('div');
  wrap.className = 'picklist';
  if(headline){
    const h = document.createElement('div');
    h.className = 'grp-head';
    h.innerHTML = esc(headline) + '<span class="r">' + banks.length + '</span>';
    wrap.appendChild(h);
  }
  banks.forEach(b => wrap.appendChild(bankRow(b, checkedFn(b), onToggle, radio)));
  host.appendChild(wrap);
}
function syncListChecks(){
  qsa('#critResults .pickrow, #peerResults .pickrow').forEach(row => {
    const inp = qs('input', row);
    if(inp && inp.type === 'checkbox')
      inp.checked = S.peers.some(p => String(p.CERT) === row._cert);
  });
}

function renderFocusChip(){
  const h = $('focusChip');
  h.innerHTML = '';
  $('focusBadge').textContent = S.focus ? ('cert ' + S.focus.CERT) : 'not set';
  $('focusBadge').className = 'badge' + (S.focus ? ' on' : '');
  if(!S.focus) return;
  const c = document.createElement('span');
  c.className = 'chip focus';
  c.innerHTML = '<span class="cn">' + esc(S.focus.NAME) + '</span><button title="Clear">' + ICO.x + '</button>';
  qs('button', c).addEventListener('click', () => { S.focus = null; renderFocusChip(); markDirty(); });
  h.appendChild(c);
}
function renderPeerChips(){
  const h = $('peerChips');
  h.innerHTML = '';
  $('peerBadge').textContent = S.peers.length;
  $('peerBadge').className = 'badge' + (S.peers.length ? ' on' : '');
  $('peerClearRow').hidden = !S.peers.length;
  S.peers.forEach(p => {
    const c = document.createElement('span');
    c.className = 'chip';
    c.innerHTML = '<span class="cn">' + esc(p.NAME) + '</span><button title="Remove">' + ICO.x + '</button>';
    qs('button', c).addEventListener('click', () => {
      S.peers = S.peers.filter(x => String(x.CERT) !== String(p.CERT));
      renderPeerChips(); syncListChecks(); markDirty();
    });
    h.appendChild(c);
  });
}
function togglePeer(b, on){
  if(on){
    if(!S.peers.some(p => String(p.CERT) === String(b.CERT))) S.peers.push(b);
  }else{
    S.peers = S.peers.filter(p => String(p.CERT) !== String(b.CERT));
  }
  renderPeerChips(); markDirty();
}

/* ==========================================================================
   Rail — metric picker
   ========================================================================== */
function renderMetricList(filter){
  const host = $('metricList');
  const f = (filter || '').trim().toLowerCase();
  const sel = new Set(S.metrics);
  host.innerHTML = '';
  const byCat = {};
  ALL_METRICS.forEach(m => {
    if(f && m.label.toLowerCase().indexOf(f) < 0 && m.code.toLowerCase().indexOf(f) < 0) return;
    (byCat[m.cat] = byCat[m.cat] || []).push(m);
  });
  const cats = CAT_ORDER.filter(c => byCat[c]);
  if(!cats.length){
    host.innerHTML = '<p class="hint" style="padding:10px">No metrics match that search.</p>';
    return;
  }
  cats.forEach(cat => {
    const list = byCat[cat];
    const nSel = list.filter(m => sel.has(m.code)).length;
    const h = document.createElement('div');
    h.className = 'grp-head';
    h.style.cursor = 'pointer';
    h.title = 'Select or clear this whole group';
    h.innerHTML = esc(cat) + '<span class="r">' + (nSel ? nSel + ' / ' : '') + list.length + '</span>';
    h.addEventListener('click', () => {
      const codes = list.map(m => m.code);
      const allOn = codes.every(c => S.metrics.indexOf(c) >= 0);
      if(allOn) S.metrics = S.metrics.filter(c => codes.indexOf(c) < 0);
      else codes.forEach(c => { if(S.metrics.indexOf(c) < 0) S.metrics.push(c); });
      updateMetricBadge(); renderMetricList(filter); markDirty();
    });
    host.appendChild(h);
    list.forEach(m => {
      const d = document.createElement('div');
      d.className = 'pickrow';
      d.innerHTML = '<input type="checkbox"' + (sel.has(m.code) ? ' checked' : '') + '>' +
        '<span class="nm"><b style="font-weight:500">' + esc(m.label) + '</b></span>' +
        '<span class="sz" style="font-size:10px;color:var(--muted)">' + m.code + '</span>';
      const inp = qs('input', d);
      const flip = on => {
        if(on){ if(S.metrics.indexOf(m.code) < 0) S.metrics.push(m.code); }
        else S.metrics = S.metrics.filter(c => c !== m.code);
        updateMetricBadge(); markDirty();
      };
      inp.addEventListener('change', e => flip(e.target.checked));
      d.addEventListener('click', e => {
        if(e.target !== inp){ inp.checked = !inp.checked; flip(inp.checked); }
      });
      host.appendChild(d);
    });
  });
}
function updateMetricBadge(){
  $('metricBadge').textContent = S.metrics.length;
  $('metricBadge').className = 'badge' + (S.metrics.length ? ' on' : '');
}
function applyMetricSet(id){
  const s = METRIC_SETS.filter(x => x.id === id)[0];
  if(!s) return;
  const codes = s.codes || TRUST_METRICS.map(m => m.code);
  S.metrics = codes.filter(c => M_BY_CODE[c]);
  if(S.primary && S.metrics.indexOf(S.primary) < 0) S.primary = null;
  updateMetricBadge();
  renderMetricList($('metricSearch').value);
  markDirty();
}

/* ==========================================================================
   Dirty tracking
   ========================================================================== */
function markDirty(){
  if(!S.built) return;
  S.dirty = true;
  $('buildLabel').innerHTML = '<span class="dirty-dot"></span>Refresh dashboard';
}
function clearDirty(){
  S.dirty = false;
  $('buildLabel').textContent = S.built ? 'Refresh dashboard' : 'Build dashboard';
}

/* ==========================================================================
   Build
   ========================================================================== */
async function build(){
  const st = $('buildStatus');
  if(!S.focus){ setStatus(st, 'Choose your institution first.', 'err'); toast('Pick your institution first.','err'); return; }
  if(!S.peers.length){ setStatus(st, 'Add at least one peer bank.', 'err'); toast('Add at least one peer bank.','err'); return; }
  if(!S.metrics.length){ setStatus(st, 'Select at least one metric.', 'err'); toast('Select at least one metric.','err'); return; }
  if(S.building) return;

  /* A bank cannot be both the subject and its own peer — that would pull it
     into the benchmark it is being measured against. */
  S.peers = S.peers.filter(p => String(p.CERT) !== String(S.focus.CERT));
  renderPeerChips();
  if(!S.peers.length){
    setStatus(st, 'The only peer selected is your own institution. Add at least one other bank.', 'err');
    return;
  }

  S.building = true;
  $('btnBuild').disabled = true;
  setStatus(st, '<span class="spin"></span> Contacting the FDIC…', 'info');
  try{
    S.repdte = $('repdte').value;
    S.nq = Number($('nq').value);

    /* fetch four extra quarters so year-over-year works across the whole window */
    S.activePeriods = periodsBack(S.repdte, S.nq);
    S.fetchPeriods  = periodsBack(S.repdte, S.nq + 4);
    const from = S.fetchPeriods[0], to = S.fetchPeriods[S.fetchPeriods.length-1];

    const certs = Array.from(new Set(allCerts())).map(Number);
    S.inst = await fetchInstitutions(certs);
    S.fin  = await fetchFinancials(certs, S.metrics, from, to,
      (i,n) => setStatus(st, '<span class="spin"></span> Loading metrics — batch ' + (i+1) + ' of ' + n, 'info'));

    const got = certs.filter(c => S.fin[String(c)]).length;
    if(!got) throw new Error('The FDIC returned no financial data for this group and period. ' +
      'Try an earlier report period.');

    if(!S.primary || S.metrics.indexOf(S.primary) < 0) S.primary = pickPrimary();
    S.market = {loaded:false, loading:false, error:null, year:null, counties:[], sel:null,
                countyRows:{}, trend:{}, branches:[], events:[]};
    S.built = true;
    S.sortBy = null;
    $('btnExport').disabled = false;
    $('btnSave').disabled = false;
    clearDirty();
    render();
    saveLast();
    setStatus(st, 'Loaded ' + got + ' banks · ' + S.metrics.length + ' metrics · ' +
      S.activePeriods.length + ' quarters.', 'ok');
    if(got < certs.length)
      toast((certs.length-got) + ' bank(s) returned no data for this period.', 'info', 5200);
    setTimeout(() => clearStatus(st), 6000);
  }catch(e){
    setStatus(st, esc(e.message), 'err');
    toast(esc(e.message), 'err', 7000);
  }finally{
    S.building = false;
    $('btnBuild').disabled = false;
  }
}

/* ==========================================================================
   Saved setups
   ========================================================================== */
function currentConfig(){
  return {
    v:2,
    focus: S.focus ? Number(S.focus.CERT) : null,
    peers: S.peers.map(p => Number(p.CERT)),
    metrics: S.metrics.slice(),
    primary: S.primary,
    repdte: S.repdte,
    nq: S.nq,
    view: S.view,
    benchmark: S.benchmark,
    transform: S.transform,
    units: S.units
  };
}
function readCfgs(){
  try{ return JSON.parse(localStorage.getItem(LS.cfgs) || '{}'); }catch(e){ return {}; }
}
function writeCfgs(o){
  try{ localStorage.setItem(LS.cfgs, JSON.stringify(o)); }
  catch(e){ toast('Browser storage is full or blocked; the setup was not saved.','err'); }
}
function refreshCfgList(){
  const o = readCfgs(), names = Object.keys(o).sort();
  const sel = $('cfgList');
  const cur = sel.value;
  sel.innerHTML = names.length ? '' : '<option value="">— none saved —</option>';
  names.forEach(n => {
    const op = document.createElement('option');
    op.value = n; op.textContent = n;
    sel.appendChild(op);
  });
  if(names.indexOf(cur) >= 0) sel.value = cur;
  $('cfgCount').textContent = names.length;
  $('cfgCount').className = 'badge' + (names.length ? ' on' : '');
}
async function saveConfig(){
  if(!S.focus){ toast('Nothing to save yet.','err'); return; }
  const suggested = bankName(S.focus.CERT) + ' — ' + (VIEW_META[S.view]||{}).title;
  const r = await modal('Save this setup',
    '<label class="fl">Name</label><input class="inp" id="cfgName" value="' + esc(suggested) + '">' +
    '<p class="hint">Stores the institution, peers, metrics, period and display options ' +
    'so you can return to exactly this comparison. No data values are stored.</p>',
    [{label:'Save', act:'save', primary:true}, {label:'Cancel', act:'__close'}]);
  if(!r || r.act !== 'save') return;
  const name = (qs('#cfgName', r.root).value || suggested).trim();
  if(!name) return;
  const o = readCfgs();
  o[name] = currentConfig();
  writeCfgs(o);
  refreshCfgList();
  $('cfgList').value = name;
  toast('Saved “' + esc(name) + '”.', 'ok');
}
async function applyConfig(cfg, quiet){
  if(!cfg || !cfg.focus) return false;
  const certs = [cfg.focus].concat(cfg.peers || []);
  const map = await fetchInstitutions(certs);
  const f = map[String(cfg.focus)];
  if(!f){ toast('Could not load the institution in that setup.','err'); return false; }
  S.focus = f;
  S.peers = (cfg.peers||[]).map(c => map[String(c)]).filter(Boolean);
  S.metrics = (cfg.metrics||[]).filter(c => M_BY_CODE[c]);
  S.primary = cfg.primary && S.metrics.indexOf(cfg.primary) >= 0 ? cfg.primary : null;
  S.nq = cfg.nq || 8;
  S.view = cfg.view || 'overview';
  S.benchmark = cfg.benchmark || 'median';
  S.transform = cfg.transform || 'level';
  S.units = cfg.units || 'auto';
  if(cfg.repdte){
    S.repdte = cfg.repdte;
    if(!qsa('#repdte option').some(o => o.value === cfg.repdte)){
      $('decOnly').checked = false;
      fillPeriodSelect();
    }
    $('repdte').value = cfg.repdte;
  }
  $('nq').value = String(S.nq);
  setView(S.view, true);
  renderFocusChip(); renderPeerChips(); updateMetricBadge();
  renderMetricList($('metricSearch').value);
  if(!quiet) toast('Setup loaded. Building…','info',2000);
  await build();
  return true;
}
function encodeConfig(cfg){
  try{ return btoa(unescape(encodeURIComponent(JSON.stringify(cfg)))).replace(/=+$/,''); }
  catch(e){ return null; }
}
function decodeConfig(s){
  try{ return JSON.parse(decodeURIComponent(escape(atob(s)))); }catch(e){ return null; }
}
async function shareLink(){
  if(!S.focus){ toast('Build a dashboard first.','err'); return; }
  const enc = encodeConfig(currentConfig());
  const url = location.href.split('#')[0] + '#c=' + enc;
  let copied = false;
  try{ await navigator.clipboard.writeText(url); copied = true; }catch(e){}
  await modal('Shareable link',
    '<p style="font-size:12.5px;color:var(--text-secondary);margin-bottom:8px">' +
    (copied ? 'Copied to the clipboard. ' : '') +
    'Anyone who opens this link with the same HTML file gets exactly this setup. ' +
    'The link carries settings only — the data is fetched fresh from the FDIC.</p>' +
    '<textarea class="inp" rows="4" readonly onclick="this.select()">' + esc(url) + '</textarea>',
    [{label:'Done', act:'__close', primary:true}]);
}

/* ==========================================================================
   Periods
   ========================================================================== */
function fillPeriodSelect(){
  const sel = $('repdte');
  const keep = sel.value;
  const decOnly = $('decOnly').checked;
  const list = S.periods.filter(d => !decOnly || d.slice(4,6) === '12').slice(0, decOnly ? 20 : 40);
  sel.innerHTML = '';
  list.forEach(d => {
    const o = document.createElement('option');
    o.value = d;
    o.textContent = qLabelLong(d) + ' — ' + prettyDate(d);
    sel.appendChild(o);
  });
  if(list.indexOf(keep) >= 0) sel.value = keep;
  else if(list.length) sel.value = list[0];
  S.repdte = sel.value;
}
async function initPeriods(){
  let latest = '20251231';
  try{
    const p = await fetchLatestPeriod(DEFAULT_INSTITUTION);
    if(p) latest = p;
  }catch(e){}
  S.periods = buildPeriods(latest);
  fillPeriodSelect();
}

/* ==========================================================================
   Theme, key, view
   ========================================================================== */
function initTheme(){
  const saved = localStorage.getItem(LS.theme);
  if(saved) document.documentElement.setAttribute('data-theme', saved);
  $('btnTheme').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const isDark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(LS.theme, next);
    if(S.built) render();
  });
}
/* SOD is a separate dataset from the Call Report, so it is fetched only when
   the Market view is actually opened rather than on every build. */
async function loadMarket(){
  const M = S.market;
  if(M.loading || M.loaded || !S.focus) return;
  M.loading = true; M.error = null;
  if(S.view === 'market') render();
  try{
    const cert = S.focus.CERT;
    const year = await fetchSodLatestYear(cert);
    if(!year) throw new Error('No Summary of Deposits records for this institution.');
    M.year = year;
    M.branches = await fetchSodBranches(cert, year);
    const by = {};
    M.branches.forEach(b => {
      const k = String(b.STCNTYBR);
      if(!by[k]) by[k] = {code:k, name:(b.CNTYNAMB || k) + ', ' + (b.STALPBR || ''), dep:0, branches:0};
      by[k].dep += Number(b.DEPSUMBR) || 0;
      by[k].branches += 1;
    });
    M.counties = Object.keys(by).map(k => by[k]).sort((a,b) => b.dep - a.dep);

    /* One request covers every county in the footprint at the latest survey,
       so the table can show share and rank on all rows straight away. The
       ten-year history stays lazy, since only the selected county needs it. */
    const codes = M.counties.map(c => c.code).slice(0, 40);
    if(codes.length < M.counties.length)
      toast('Showing the largest ' + codes.length + ' of ' + M.counties.length + ' counties.', 'info', 5000);
    if(codes.length){
      const all = unwrap(await apiGet('/sod', {
        filters:'STCNTYBR:(' + codes.join(' OR ') + ') AND YEAR:' + year,
        fields:SOD_FIELDS, limit:'10000'}));
      const perCounty = {};
      all.forEach(r => {
        const k = String(r.STCNTYBR);
        (perCounty[k] = perCounty[k] || []).push(r);
      });
      codes.forEach(k => {
        const roll = rollupByCert(perCounty[k] || []);
        const me = roll.list.filter(x => String(x.cert) === String(cert))[0];
        roll.focusShare = me ? me.share : 0;
        roll.focusRank = me ? me.rank : null;
        M.countyRows[k] = roll;
      });
    }

    M.events = await fetchHistory(cert).catch(() => []);
    M.loaded = true;
    if(M.counties.length) M.sel = M.counties[0].code;
    if(M.sel) await loadCountyTrend(M.sel);
  }catch(e){
    M.error = e.message;
  }finally{
    M.loading = false;
    if(S.view === 'market') render();
  }
}

/* Ten years of one county, aggregated into a share series. */
async function loadCountyTrend(code){
  const M = S.market;
  if(M.trend[code]) return;
  try{
    const to = M.year, from = to - 9;
    const rows = await fetchCountySod(code, from, to);
    if(!M.countyRows[code]){
      const roll = rollupByCert(rows.filter(r => Number(r.YEAR) === to));
      const me = roll.list.filter(x => String(x.cert) === String(S.focus.CERT))[0];
      roll.focusShare = me ? me.share : 0;
      roll.focusRank = me ? me.rank : null;
      M.countyRows[code] = roll;
    }
    const byYear = {};
    rows.forEach(r => {
      const y = Number(r.YEAR);
      if(!byYear[y]) byYear[y] = {year:y, total:0, focus:0};
      const v = Number(r.DEPSUMBR) || 0;
      byYear[y].total += v;
      if(String(r.CERT) === String(S.focus.CERT)) byYear[y].focus += v;
    });
    M.trend[code] = Object.keys(byYear).map(k => byYear[k])
      .sort((a,b) => a.year - b.year)
      .map(x => ({year:x.year, total:x.total, focus:x.focus,
                  share: x.total ? x.focus/x.total*100 : null}));
  }catch(e){
    toast('Could not load county history: ' + esc(e.message), 'err');
  }
}

async function selectCounty(code){
  S.market.sel = code;
  render();
  await loadCountyTrend(code);
  if(S.view === 'market') render();
}

function setView(v, quiet){
  S.view = v;
  if(v === 'market') loadMarket();
  qsa('.viewtab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === v)));
  if(!quiet && S.built) render();
}
function saveLast(){
  try{ localStorage.setItem(LS.last, JSON.stringify(currentConfig())); }catch(e){}
}

/* ==========================================================================
   Help
   ========================================================================== */
function showHelp(){
  modal('How to use this dashboard',
    '<div style="font-size:12.5px;line-height:1.65;color:var(--text-secondary)">' +
    '<p style="margin-bottom:9px"><b style="color:var(--text-primary)">The idea.</b> Pick your bank, ' +
    'build a group of peers, choose the Call Report items you care about, and compare. ' +
    'Everything is pulled live from the FDIC each time you build.</p>' +
    '<p style="margin-bottom:9px"><b style="color:var(--text-primary)">Four views.</b> ' +
    '<b>Overview</b> is the headline standing. <b>Trends</b> shows movement over time and how your ' +
    'rank shifted. <b>Explore</b> plots any two metrics against each other. <b>Compare</b> is the ' +
    'full matrix you can sort and filter.</p>' +
    '<p style="margin-bottom:9px"><b style="color:var(--text-primary)">The toolbar.</b> ' +
    '<b>Benchmark</b> switches between peer median, average and quartiles. <b>Show as</b> converts ' +
    'every figure to growth rates, percent of assets, or per-employee and per-office terms — useful ' +
    'when peers are different sizes. <b>Units</b> fixes dollars to thousands, millions or billions.</p>' +
    '<p style="margin-bottom:9px"><b style="color:var(--text-primary)">Reading the numbers.</b> ' +
    'Dollars are in thousands, as the FDIC files them. Income items are year-to-date, so a Q4 figure ' +
    'is a full year and a Q2 figure is six months. Peer statistics always exclude your own bank.</p>' +
    '<p style="margin-bottom:9px"><b style="color:var(--text-primary)">Keyboard.</b> ' +
    '<kbd>1</kbd>–<kbd>4</kbd> switch views · <kbd>B</kbd> build or refresh · ' +
    '<kbd>S</kbd> save setup · <kbd>E</kbd> export · <kbd>D</kbd> light/dark · <kbd>?</kbd> this help</p>' +
    '<p><b style="color:var(--text-primary)">Privacy.</b> Nothing is uploaded. Requests go directly ' +
    'from this browser to api.fdic.gov, which serves public data. Saved setups and any API key stay ' +
    'in this browser only.</p></div>',
    [{label:'Got it', act:'__close', primary:true}]);
}

/* ==========================================================================
   Quick start
   ========================================================================== */
async function loadQuickSet(id){
  const q = allPeerGroups().filter(x => x.id === id)[0];
  if(!q) return;
  const st = $('critStatus');
  setStatus(st, '<span class="spin"></span> Loading ' + esc(q.name) + '…', 'info');
  try{
    const certs = [q.focus].concat(q.certs);
    const map = await fetchInstitutions(certs);
    const f = map[String(q.focus)];
    /* Keep whatever institution the user already chose; only adopt the set's
       own anchor when nothing is selected yet. */
    if(!S.focus && f) S.focus = f;
    if(!S.focus) throw new Error('Could not load that peer set.');
    const focusCert = String(S.focus.CERT);
    /* The set's anchor becomes an ordinary peer when it is not the focus,
       otherwise picking a different bank would silently drop it. */
    S.peers = certs.map(c => map[String(c)]).filter(Boolean)
      .filter(b => String(b.CERT) !== focusCert);
    renderFocusChip(); renderPeerChips(); syncListChecks(); markDirty();
    setStatus(st, 'Loaded ' + S.peers.length + ' peers. ' + esc(q.note), 'ok');
    toast('Peer group set: ' + esc(q.name), 'ok');
  }catch(e){
    setStatus(st, esc(e.message), 'err');
  }
}

/* Rebuilds the one-click group buttons. Saved groups carry a remove control so
   a peer set can be swapped without touching the file. */
function renderQuickSets(){
  const host = $('quickSets');
  host.innerHTML = '';
  const saved = readSavedGroups();
  allPeerGroups().forEach(q => {
    const isSaved = saved.some(x => x.id === q.id);
    const wrap = document.createElement('span');
    wrap.style.cssText = 'display:inline-flex;align-items:stretch';
    const b = document.createElement('button');
    b.className = 'btn sm';
    b.textContent = q.name;
    b.title = q.note || (q.certs.length + ' banks');
    b.addEventListener('click', () => loadQuickSet(q.id));
    wrap.appendChild(b);
    if(isSaved){
      const x = document.createElement('button');
      x.className = 'btn sm';
      x.style.cssText = 'margin-left:-1px;padding-left:5px;padding-right:5px';
      x.title = 'Delete this saved group';
      x.innerHTML = ICO.x;
      x.addEventListener('click', () => {
        if(!confirm('Delete the saved group “' + q.name + '”?')) return;
        writeSavedGroups(readSavedGroups().filter(g => g.id !== q.id));
        renderQuickSets();
        toast('Deleted “' + esc(q.name) + '”.', 'ok');
      });
      wrap.appendChild(x);
    }
    host.appendChild(wrap);
  });
  const n = saved.length;
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.style.width = '100%';
  hint.textContent = n ? (n + ' saved group' + (n===1?'':'s') + ' on this computer.')
                       : 'Build a group under Criteria or By name, then save it here.';
  host.appendChild(hint);
}

/* Stores whatever is currently selected as a reusable one-click button. */
async function saveCurrentGroup(){
  if(!S.focus){ toast('Choose your institution first.','err'); return; }
  if(!S.peers.length){ toast('Add at least one peer bank first.','err'); return; }
  const suggested = S.peers.length + '-bank group';
  const r = await modal('Save this peer group',
    '<label class="fl">Name</label><input class="inp" id="grpName" value="' + esc(suggested) + '">' +
    '<p class="hint">Saves ' + S.peers.length + ' peer banks as a one-click button next to the ' +
    'built-in groups. Stored in this browser only — use <b>Saved setups → Export file</b> to ' +
    'share it with a colleague.</p>' +
    '<p class="hint" style="margin-top:8px">' +
    S.peers.map(pp => esc(pp.NAME)).join(' · ') + '</p>',
    [{label:'Save group', act:'save', primary:true}, {label:'Cancel', act:'__close'}]);
  if(!r || r.act !== 'save') return;
  const name = (qs('#grpName', r.root).value || suggested).trim();
  if(!name) return;
  const groups = readSavedGroups().filter(g => g.name !== name);
  groups.push({
    id: 'saved_' + name.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,32) + '_' + groups.length,
    name: name,
    focus: Number(S.focus.CERT),
    certs: S.peers.map(pp => Number(pp.CERT)),
    note: 'Saved group — ' + S.peers.length + ' banks.'
  });
  if(writeSavedGroups(groups)){
    renderQuickSets();
    toast('Saved “' + esc(name) + '” as a one-click group.', 'ok');
  }
}

/* ==========================================================================
   Wiring
   ========================================================================== */
function initRail(){
  /* quick sets: built-in groups from the configuration block, plus any the
     user has saved in this browser */
  renderQuickSets();
  $('btnSaveGroup').addEventListener('click', saveCurrentGroup);

  /* metric presets */
  const mhost = $('metricPresets');
  METRIC_SETS.forEach(s => {
    const b = document.createElement('button');
    b.className = 'btn sm';
    b.textContent = s.name;
    b.title = s.codes ? s.codes.length + ' metrics' : TRUST_METRICS.length + ' metrics';
    b.addEventListener('click', () => applyMetricSet(s.id));
    mhost.appendChild(b);
  });

  /* peer sub-tabs */
  qsa('.subtab').forEach(t => t.addEventListener('click', () => {
    qsa('.subtab').forEach(x => x.classList.toggle('on', x === t));
    ['quick','crit','name'].forEach(k => $('ptab-' + k).hidden = (k !== t.dataset.ptab));
  }));

  /* focus search */
  const doFocusSearch = async () => {
    const host = $('focusResults');
    host.innerHTML = '<p class="hint"><span class="spin"></span> Searching…</p>';
    try{
      const r = await searchInstitutions($('focusSearch').value);
      renderList(host, r, b => S.focus && String(S.focus.CERT) === String(b.CERT),
        (b,on) => { if(on){ S.focus = b; renderFocusChip(); markDirty(); } }, true, 'Choose one');
    }catch(e){ host.innerHTML = '<p class="hint" style="color:var(--critical)">' + esc(e.message) + '</p>'; }
  };
  $('btnFocusSearch').addEventListener('click', doFocusSearch);
  $('focusSearch').addEventListener('keydown', e => { if(e.key === 'Enter') doFocusSearch(); });

  /* peer search */
  const doPeerSearch = async () => {
    const host = $('peerResults');
    host.innerHTML = '<p class="hint"><span class="spin"></span> Searching…</p>';
    try{
      const r = await searchInstitutions($('peerSearch').value);
      renderList(host, r, b => S.peers.some(p => String(p.CERT) === String(b.CERT)),
        togglePeer, false, 'Tick to add as peers');
    }catch(e){ host.innerHTML = '<p class="hint" style="color:var(--critical)">' + esc(e.message) + '</p>'; }
  };
  $('btnPeerSearch').addEventListener('click', doPeerSearch);
  $('peerSearch').addEventListener('keydown', e => { if(e.key === 'Enter') doPeerSearch(); });

  /* asset band shortcuts */
  qsa('[data-band]').forEach(b => b.addEventListener('click', () => {
    const a = S.focus ? Number(S.focus.ASSET) : null;
    if(!a){ toast('Choose your institution first so the band has a centre.','err'); return; }
    const f = Number(b.dataset.band);
    $('cMin').value = Math.round(a*(1-f));
    $('cMax').value = Math.round(a*(1+f));
    toast('Asset band set around ' + fmt(a,'usd') + '.', 'info', 2600);
  }));

  /* criteria search */
  $('btnFindPeers').addEventListener('click', async () => {
    const st = $('critStatus'), host = $('critResults');
    setStatus(st, '<span class="spin"></span> Searching the FDIC…', 'info');
    host.innerHTML = '';
    try{
      const states = $('cState').value.split(/[,\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      const min = $('cMin').value === '' ? null : Number($('cMin').value);
      const max = $('cMax').value === '' ? null : Number($('cMax').value);
      const res = await findPeersByCriteria({
        states:states, min:min, max:max,
        bkclass:$('cClass').value, spec:$('cSpec').value,
        trust:$('cTrust').checked, active:$('cActive').checked
      });
      const rows = res.rows.filter(b => !S.focus || String(b.CERT) !== String(S.focus.CERT));
      setStatus(st, '<b>' + res.total + '</b> institution' + (res.total === 1 ? '' : 's') + ' matched' +
        (res.total > res.rows.length ? ' — showing the largest ' + res.rows.length + '.' : '.') +
        ' Tick the ones to compare against.', 'ok');
      renderList(host, rows, b => S.peers.some(p => String(p.CERT) === String(b.CERT)),
        togglePeer, false, 'Largest first');
      const add = document.createElement('div');
      add.className = 'btnrow';
      const b1 = document.createElement('button');
      b1.className = 'btn sm';
      b1.textContent = 'Add top 10';
      b1.addEventListener('click', () => {
        rows.slice(0,10).forEach(b => togglePeer(b, true));
        syncListChecks();
      });
      const b2 = document.createElement('button');
      b2.className = 'btn sm';
      b2.textContent = 'Add all shown';
      b2.addEventListener('click', () => {
        if(rows.length > 30 && !confirm('Add all ' + rows.length +
          ' banks? Large groups make the charts hard to read.')) return;
        rows.forEach(b => togglePeer(b, true));
        syncListChecks();
      });
      add.appendChild(b1); add.appendChild(b2);
      host.appendChild(add);
    }catch(e){ setStatus(st, esc(e.message), 'err'); }
  });

  $('btnClearPeers').addEventListener('click', () => {
    S.peers = []; renderPeerChips(); syncListChecks(); markDirty();
  });
  $('btnSortPeers').addEventListener('click', () => {
    S.peers.sort((a,b) => (Number(b.ASSET)||0) - (Number(a.ASSET)||0));
    renderPeerChips();
  });

  /* metrics */
  $('metricSearch').addEventListener('input', debounce(function(){
    renderMetricList(this.value);
  }, 180));
  $('btnMetricClear').addEventListener('click', () => {
    S.metrics = []; updateMetricBadge(); renderMetricList($('metricSearch').value); markDirty();
  });

  /* period */
  $('decOnly').addEventListener('change', () => { fillPeriodSelect(); markDirty(); });
  $('repdte').addEventListener('change', () => { S.repdte = $('repdte').value; markDirty(); });
  $('nq').addEventListener('change', () => { S.nq = Number($('nq').value); markDirty(); });

  $('btnBuild').addEventListener('click', build);
}

function initTopbar(){
  qsa('.viewtab').forEach(t => t.addEventListener('click', () => setView(t.dataset.view)));

  $('ctxMetric').addEventListener('change', e => { S.primary = e.target.value; render(); });
  $('ctxBench').addEventListener('change', e => { S.benchmark = e.target.value; render(); saveLast(); });
  $('ctxTransform').addEventListener('change', e => { S.transform = e.target.value; render(); saveLast(); });
  $('ctxUnits').addEventListener('change', e => { S.units = e.target.value; render(); saveLast(); });

  $('btnSave').addEventListener('click', saveConfig);
  $('btnHelp').addEventListener('click', showHelp);
  $('btnExport').addEventListener('click', async () => {
    const hasMarket = S.market.loaded && S.market.counties.length;
    const buttons = [{label:'Metrics CSV', act:'csv', primary:true}];
    if(hasMarket) buttons.push({label:'Market share CSV', act:'market'});
    buttons.push({label:'JSON', act:'json'});
    const r = await modal('Export',
      '<p style="font-size:12.5px;color:var(--text-secondary)">' +
      '<b>Metrics CSV</b> gives one row per Call Report metric with every bank as a ' +
      'column, plus rank, percentile and benchmark — ready for Excel.<br><br>' +
      (hasMarket ? '<b>Market share CSV</b> gives the deposit footprint: every county, ' +
        'every competing institution, ten years of share history, the branch list and ' +
        'structural changes.<br><br>' : '') +
      '<b>JSON</b> gives the full multi-quarter metric dataset for anyone wanting to ' +
      'do their own analysis.</p>', buttons);
    if(!r) return;
    if(r.act === 'csv') exportCsv();
    else if(r.act === 'market') exportMarketCsv();
    else exportJson();
  });

  /* saved setups */
  $('btnCfgLoad').addEventListener('click', async () => {
    const n = $('cfgList').value;
    if(!n) { toast('No saved setup selected.','err'); return; }
    const cfg = readCfgs()[n];
    if(cfg) await applyConfig(cfg);
  });
  $('btnCfgDelete').addEventListener('click', () => {
    const n = $('cfgList').value;
    if(!n) return;
    if(!confirm('Delete the saved setup “' + n + '”?')) return;
    const o = readCfgs(); delete o[n]; writeCfgs(o); refreshCfgList();
    toast('Deleted “' + esc(n) + '”.', 'ok');
  });
  $('btnCfgShare').addEventListener('click', shareLink);
  $('btnCfgExport').addEventListener('click', () => {
    const o = readCfgs();
    if(!Object.keys(o).length){ toast('No saved setups to export.','err'); return; }
    downloadBlob(new Blob([JSON.stringify(o,null,2)],{type:'application/json'}),
      'fdic_peer_setups.json');
    toast('Exported ' + Object.keys(o).length + ' setup(s).','ok');
  });
  $('btnCfgImport').addEventListener('click', () => $('cfgFile').click());
  $('cfgFile').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try{
        const inc = JSON.parse(rd.result);
        const o = readCfgs();
        let n = 0;
        Object.keys(inc).forEach(k => { o[k] = inc[k]; n++; });
        writeCfgs(o); refreshCfgList();
        toast('Imported ' + n + ' setup(s).','ok');
      }catch(err){ toast('That file is not a valid setup export.','err'); }
    };
    rd.readAsText(file);
    e.target.value = '';
  });

  $('btnQuickStart').addEventListener('click', async () => {
    await loadQuickSet('local');
    applyMetricSet('exec');
    await build();
  });
}

function initKeyboard(){
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if(tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if(e.ctrlKey || e.metaKey || e.altKey){
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'){ e.preventDefault(); saveConfig(); }
      return;
    }
    if(qs('.modal-bg')) return;
    const k = e.key.toLowerCase();
    const views = ['overview','trends','explore','market','compare'];
    if(k >= '1' && k <= '5'){ setView(views[Number(k)-1]); }
    else if(k === 'b'){ build(); }
    else if(k === 's'){ saveConfig(); }
    else if(k === 'e'){ if(!$('btnExport').disabled) $('btnExport').click(); }
    else if(k === 'd'){ $('btnTheme').click(); }
    else if(k === '?' || (k === '/' && e.shiftKey)){ showHelp(); }
  });
}

/* ==========================================================================
   Boot
   ========================================================================== */
async function init(){
  initTheme();
  initRail();
  initTopbar();
  initKeyboard();
  refreshCfgList();
  updateMetricBadge();
  renderFocusChip();
  renderPeerChips();
  renderMetricList('');
  await initPeriods();

  /* a link with #c=… restores a shared setup */
  const h = location.hash;
  if(h && h.indexOf('#c=') === 0){
    const cfg = decodeConfig(h.slice(3));
    if(cfg){
      const ok = await applyConfig(cfg, true);
      if(ok){ toast('Loaded the setup from the link.','ok'); return; }
    }
    toast('That shared link could not be read.','err');
  }

  /* otherwise offer a sensible default without fetching anything */
  applyMetricSet('exec');
  try{
    const map = await fetchInstitutions([DEFAULT_INSTITUTION]);
    if(map[String(DEFAULT_INSTITUTION)]){
      S.focus = map[String(DEFAULT_INSTITUTION)];
      renderFocusChip();
      $('focusSearch').value = '';
    }
  }catch(e){}
}
document.addEventListener('DOMContentLoaded', init);
</script>
</body>
</html>
