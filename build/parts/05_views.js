<script>
"use strict";
/* ==========================================================================
   Card scaffolding
   ========================================================================== */
function card(title, sub, opts){
  opts = opts || {};
  const c = document.createElement('div');
  c.className = 'card';
  const h = document.createElement('div');
  h.className = 'card-head';
  h.innerHTML = '<h3>'+esc(title)+'</h3>';
  const tools = document.createElement('div');
  tools.className = 'card-tools';
  h.appendChild(tools);
  c.appendChild(h);
  if(sub){
    const s = document.createElement('div');
    s.className = 'card-sub';
    s.innerHTML = sub;
    c.appendChild(s);
  }
  c._tools = tools;
  return c;
}
function metricPicker(value, onChange, codes){
  const sel = document.createElement('select');
  sel.title = 'Choose metric';
  (codes || S.metrics).forEach(code => {
    const o = document.createElement('option');
    o.value = code; o.textContent = metricLabel(code);
    if(code === value) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}
const DL_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>';
function addChartExport(cardEl, target, name){
  const b = document.createElement('button');
  b.className = 'btn ghost sm';
  b.title = 'Download this chart';
  b.innerHTML = DL_ICO;
  b.addEventListener('click', async () => {
    const r = await modal('Download chart',
      '<p style="font-size:12.5px;color:var(--text-secondary)">Save “'+esc(name)+'” as an image ' +
      'you can drop into a board deck or memo.</p>',
      [{label:'PNG', act:'png', primary:true}, {label:'SVG (vector)', act:'svg'}]);
    if(!r) return;
    const fn = name.replace(/[^\w\- ]+/g,'').replace(/\s+/g,'_').slice(0,60);
    /* A redraw replaces the element, so resolve the current one at click time.
       Immediately after a re-render the chart may not have painted yet. */
    const svg = (target && target._svg) ? target._svg
              : (target && target.querySelector) ? target.querySelector('svg') : target;
    if(!svg || svg.tagName !== 'svg'){ toast('The chart is still drawing. Try again in a moment.','err'); return; }
    if(r.act === 'png') exportChartPng(svg, fn); else exportChartSvg(svg, fn);
  });
  cardEl._tools.appendChild(b);
}
function legendRow(items){
  const l = document.createElement('div');
  l.className = 'legend';
  l.innerHTML = items.map(i => {
    const cls = 'swatch' + (i.type === 'line' ? ' line' : i.type === 'dot' ? ' dot' : '');
    if(i.type === 'note') return '<span class="k" style="color:var(--muted)">'+esc(i.label)+'</span>';
    return '<span class="k"><span class="'+cls+'" style="background:'+i.color+
      (i.opacity ? ';opacity:'+i.opacity : '')+'"></span>'+esc(i.label)+'</span>';
  }).join('');
  return l;
}
/* The arrow always shows which way the number moved; the colour shows whether
   that is the good direction for this particular metric. */
/* Appended to a time-series caption when the reset would otherwise read as a fall. */
function ytdNote(code){
  if(!isYtdFlow(code) || !windowMixesQuarters()) return '';
  return ' <b style="color:var(--serious)">Year-to-date item:</b> the step down from ' +
    'Q4 to Q1 is the annual reset, not a fall. Compare Q4 with Q4, or switch ' +
    '“Show as” to year-over-year change.';
}

function deltaPill(delta, code){
  const d = fmtDelta(delta);
  if(!d) return '<span class="pill flat">no benchmark</span>';
  if(d.dir === 0) return '<span class="pill flat">at benchmark</span>';
  const good = d.dir * betterDir(code) > 0;
  return '<span class="pill '+(good?'up':'down')+'" title="' +
    (d.dir>0 ? 'Above' : 'Below') + ' the benchmark' +
    (betterDir(code) < 0 ? ' — for this ratio, lower is better' : '') + '">' +
    (d.dir>0 ? '▲' : '▼') + ' ' + d.t.replace(/^[+−]/,'') + '</span>';
}

/* ==========================================================================
   Stat tiles
   ========================================================================== */
function tiles(codes){
  const wrap = document.createElement('div');
  wrap.className = 'tiles';
  codes.forEach(code => {
    const unit = unitOf(code);
    const st = stat(code);
    const t = document.createElement('div');
    t.className = 'tile' + (code === S.primary ? ' on' : '');
    t.setAttribute('role','button');
    t.tabIndex = 0;
    t.title = 'Open ' + metricLabel(code) + ' in detail';
    const rankTxt = st.rank ? ('rank ' + st.rank + '/' + st.n) : 'not reported';
    t.innerHTML =
      '<div class="lb">'+esc(metricLabel(code))+'</div>' +
      '<div class="vl">'+fmt(st.focus, unit)+'</div>' +
      '<div class="sub">'+deltaPill(st.delta, code)+'<span>'+rankTxt+'</span></div>' +
      '<span class="tile-open" aria-hidden="true">' + ICO.expand + '</span>';
    /* No inline sparkline. A line drawn across a 226px tile had to share space
       with the figure and the label, and there is no arrangement where it stays
       clear of both. The trend now lives in the drill-in below, at a size where
       it can carry axes. */
    const act = () => { S.primary = code; render(); openMetricDetail(code); };
    t.addEventListener('click', act);
    t.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); act(); } });
    t.addEventListener('mousemove', ev => tipShow(
      '<div class="tt">'+esc(metricTitle(code))+'</div>' +
      '<div class="tr">'+tipKey(FOCUS_COLOR(), shortName(S.focus.CERT,20))+'<span>'+fmt(st.focus,unit)+'</span></div>' +
      '<div class="tr">'+tipKey(cssv('--bench-ink'), BENCH_LABEL[S.benchmark])+'<span>'+fmt(st.bench,unit)+'</span></div>' +
      '<div class="tr"><span>Difference</span><span>'+fmt(st.diff,unit)+'</span></div>' +
      '<div class="tr"><span>Percentile</span><span>'+(st.pct!=null?Math.round(st.pct)+'%':'—')+'</span></div>' +
      (betterDir(code) < 0 ? '<div class="tfoot">For this ratio a lower number is the better result.</div>' : '') +
      '<div class="tfoot">Click to open this metric in detail</div>', ev));
    t.addEventListener('mouseleave', tipHide);
    wrap.appendChild(t);
  });
  evenGrid(wrap, codes.length, 150, {emphasise:true});
  return wrap;
}

/* ==========================================================================
   Metric drill-in

   Opened from a stat tile. Shows the same figures at a size where the trend can
   carry axis labels, plus where the bank sits in the group.
   ========================================================================== */
function openMetricDetail(code){
  const unit = unitOf(code);
  const st = stat(code);
  const rows = [
    [shortName(S.focus.CERT, 30), fmt(st.focus, unit)],
    [BENCH_LABEL[S.benchmark], fmt(st.bench, unit)],
    ['Difference', fmt(st.diff, unit)],
    ['Rank', st.rank ? (st.rank + ' of ' + st.n) : '—'],
    ['Percentile', st.pct != null ? Math.round(st.pct) + '%' : '—'],
    ['Peer range', st.min != null ? (fmt(st.min, unit) + ' – ' + fmt(st.max, unit)) : '—']
  ];
  const head =
    '<div class="detail-stats">' +
    rows.map(r => '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>').join('') +
    '</div>' +
    '<p class="hint" style="margin-bottom:2px">' +
    esc(metricTitle(code)) + ' · field <b>' + code + '</b> · period ' + prettyDate(S.repdte) +
    ' · benchmark ' + esc(BENCH_LABEL[S.benchmark]) +
    (betterDir(code) < 0 ? ' · for this ratio a lower number is the better result' : '') +
    '</p>' +
    (isYtdFlow(code) && windowMixesQuarters()
      ? '<p class="hint"><b style="color:var(--serious)">Year-to-date item:</b> the step down ' +
        'from Q4 to Q1 is the annual reset, not a fall.</p>' : '');

  modal(metricLabel(code), head, [{label:'Close', act:'__close', primary:true}], {
    wide: true,
    onMount: function(body){
      const strip = body.querySelector('.detail-stats');
      if(strip) evenGrid(strip, rows.length, 132);
      const t = document.createElement('div');
      t.className = 'card-head';
      t.style.marginTop = '12px';
      t.innerHTML = '<h3>Trend · ' + S.activePeriods.length + ' quarters</h3>';
      body.appendChild(t);
      const th = document.createElement('div');
      th.className = 'chartbox';
      body.appendChild(th);
      mountChart(th, w => chartTrend(code, w, {h: clampN(Math.round(w * 0.42), 240, 320)}));

      const r = document.createElement('div');
      r.className = 'card-head';
      r.style.marginTop = '14px';
      r.innerHTML = '<h3>Peer ranking · ' + prettyDate(S.repdte) + '</h3>';
      body.appendChild(r);
      const rh = document.createElement('div');
      rh.className = 'chartbox';
      body.appendChild(rh);
      mountChart(rh, w => chartRank(code, w));
    }
  });
}

/* ==========================================================================
   Profile
   ========================================================================== */
function profileCard(){
  const inst = S.inst[String(S.focus.CERT)] || S.focus;
  const c = card('Institution profile', null);
  const dl = document.createElement('dl');
  dl.className = 'profile';
  const est = inst.ESTYMD ? String(inst.ESTYMD).slice(-4) : null;
  const items = [
    ['FDIC cert', String(inst.CERT)],
    ['Location', [inst.CITY, inst.STALP].filter(Boolean).join(', ') || '—'],
    ['Charter', inst.BKCLASS || '—'],
    ['Established', est || '—'],
    ['Offices', inst.OFFICES != null ? String(inst.OFFICES) : '—'],
    ['Total assets', fmt(raw(S.focus.CERT,'ASSET'), 'usd')],
    ['Employees', fmt(raw(S.focus.CERT,'NUMEMP'), 'num')],
    ['Specialization', inst.SPECGRPN || '—'],
    ['Holding company', inst.NAMEHCR || '—']
  ];
  if(inst.WEBADDR)
    items.push(['Website', '<a href="'+esc(/^https?:/.test(inst.WEBADDR)?inst.WEBADDR:'https://'+inst.WEBADDR)+
      '" target="_blank" rel="noopener noreferrer">'+esc(String(inst.WEBADDR).replace(/^https?:\/\//,''))+'</a>']);
  dl.innerHTML = items.map(i =>
    '<div><dt>'+esc(i[0])+'</dt><dd>'+(i[0]==='Website'?i[1]:esc(i[1]))+'</dd></div>').join('');
  c.appendChild(dl);
  evenGrid(dl, items.length, 128);
  return c;
}

/* ==========================================================================
   Comparison table
   ========================================================================== */
function tableCard(compact){
  const certs = allCerts();
  const c = card('Comparison matrix',
    'Every selected metric at ' + prettyDate(S.repdte) + ', shown as ' +
    TRANSFORM_LABEL[S.transform] + '. Sort by any bank\'s column, or click a metric ' +
    'name to draw it in the chart below. Hover any figure for its standing in the group.');

  /* toolbar */
  const tb = document.createElement('div');
  tb.className = 'tbl-toolbar';
  const search = document.createElement('input');
  search.className = 'inp grow';
  search.placeholder = 'Filter metrics…';
  search.value = S.tableFilter;
  search.addEventListener('input', debounce(() => { S.tableFilter = search.value; render(); }, 260));
  tb.appendChild(search);
  if(S.sortBy){
    const b = document.createElement('button');
    b.className = 'btn sm';
    b.textContent = 'Clear sort';
    b.addEventListener('click', () => { S.sortBy = null; render(); });
    tb.appendChild(b);
  }
  const cnt = document.createElement('span');
  cnt.style.cssText = 'font-size:11px;color:var(--muted);margin-left:auto';
  tb.appendChild(cnt);
  c.appendChild(tb);

  /* rows */
  let codes = S.metrics.slice();
  const f = S.tableFilter.trim().toLowerCase();
  if(f) codes = codes.filter(x =>
    metricLabel(x).toLowerCase().indexOf(f) >= 0 || x.toLowerCase().indexOf(f) >= 0);
  let grouped = !S.sortBy;
  if(S.sortBy){
    codes.sort((a,b) => {
      const av = val(S.sortBy,a), bv = val(S.sortBy,b);
      if(av == null && bv == null) return 0;
      if(av == null) return 1;
      if(bv == null) return -1;
      return S.sortDir < 0 ? bv-av : av-bv;
    });
  }else{
    codes.sort((a,b) => {
      const ca = CAT_ORDER.indexOf((M_BY_CODE[a]||{}).cat), cb = CAT_ORDER.indexOf((M_BY_CODE[b]||{}).cat);
      if(ca !== cb) return ca-cb;
      return ((M_BY_CODE[a]||{}).n||0) - ((M_BY_CODE[b]||{}).n||0);
    });
  }
  cnt.textContent = codes.length + ' of ' + S.metrics.length + ' metrics';

  const wrap = document.createElement('div');
  wrap.className = 'tablewrap';
  if(compact) wrap.style.maxHeight = '460px';
  const tbl = document.createElement('table');

  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  const th0 = document.createElement('th');
  th0.className = 'mcol'; th0.textContent = 'Metric'; th0.style.cursor = 'default';
  tr.appendChild(th0);
  [['Rank','Rank of your bank, largest value first'],
   [BENCH_LABEL[S.benchmark],'The benchmark selected in the toolbar'],
   ['vs bench','Your value against the benchmark, in percent']].forEach(h => {
    const th = document.createElement('th');
    th.textContent = h[0]; th.title = h[1]; th.style.cursor = 'default';
    tr.appendChild(th);
  });
  certs.forEach(ct => {
    const th = document.createElement('th');
    const isF = ct === String(S.focus.CERT);
    if(isF) th.className = 'focuscol';
    th.innerHTML = esc(shortName(ct,20)) +
      (S.sortBy === ct ? '<span class="sortcue">'+(S.sortDir<0?'▼':'▲')+'</span>' : '');
    th.title = bankName(ct) + ' (cert ' + ct + ')' + (isInactive(ct) ? ' — no longer filing' : '') +
      '\nClick to sort by this bank';
    th.addEventListener('click', () => {
      if(S.sortBy === ct) S.sortDir = -S.sortDir; else { S.sortBy = ct; S.sortDir = -1; }
      render();
    });
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  tbl.appendChild(thead);

  const tbody = document.createElement('tbody');
  let lastCat = null;
  if(!codes.length){
    const r = document.createElement('tr');
    r.innerHTML = '<td class="mcol" colspan="'+(4+certs.length)+'" style="color:var(--muted)">No metrics match that filter.</td>';
    tbody.appendChild(r);
  }
  codes.forEach(code => {
    const m = M_BY_CODE[code] || {};
    const unit = unitOf(code);
    const st = stat(code);
    if(grouped && m.cat !== lastCat){
      lastCat = m.cat;
      const cr = document.createElement('tr');
      cr.className = 'catrow';
      const td = document.createElement('td');
      td.colSpan = 4 + certs.length;
      td.textContent = m.cat || 'Other';
      cr.appendChild(td);
      tbody.appendChild(cr);
    }
    const row = document.createElement('tr');
    if(code === S.primary) row.className = 'on';

    const tdm = document.createElement('td');
    tdm.className = 'mcol';
    tdm.innerHTML = esc(m.label || code) + ' <span class="code">' + code + '</span>' +
      (betterDir(code) < 0 ? ' <span class="code" title="Lower is better for this ratio">▾ lower is better</span>' : '');
    tdm.title = 'Click to make this the focus metric';
    tdm.addEventListener('click', () => { S.primary = code; render(); });
    row.appendChild(tdm);

    const tdr = document.createElement('td');
    tdr.className = 'num';
    tdr.innerHTML = st.rank ? (st.rank + ' <span class="na">/ ' + st.n + '</span>') : '<span class="na">—</span>';
    row.appendChild(tdr);

    const tdb = document.createElement('td');
    tdb.className = 'num';
    tdb.textContent = fmt(st.bench, unit);
    row.appendChild(tdb);

    const tdv = document.createElement('td');
    tdv.className = 'num';
    const dd = fmtDelta(st.delta);
    if(!dd) tdv.innerHTML = '<span class="na">—</span>';
    else if(dd.dir === 0) tdv.innerHTML = '<span class="na">even</span>';
    else{
      const good = dd.dir * betterDir(code) > 0;
      tdv.innerHTML = '<span style="color:' +
        (good ? cssv('--delta-up') : cssv('--delta-down')) + ';font-weight:650" title="' +
        (dd.dir > 0 ? 'Above' : 'Below') + ' benchmark' +
        (betterDir(code) < 0 ? ' — lower is better for this ratio' : '') + '">' + dd.t + '</span>';
    }
    row.appendChild(tdv);

    const rowVals = certs.map(ct => val(ct, code));
    const present = rowVals.filter(x => x != null);
    certs.forEach((ct,i) => {
      const td = document.createElement('td');
      const isF = ct === String(S.focus.CERT);
      td.className = 'num' + (isF ? ' focuscol' : '');
      const v = rowVals[i];
      if(v == null){
        td.innerHTML = '<span class="na">—</span>';
        td.title = bankName(ct) + ' did not report this item for ' + prettyDate(S.repdte);
      }else{
        /* Figures only. Magnitude is carried by the ranked chart under the
           table, where a bar has room to be read, rather than by a rule drawn
           through the number itself. */
        const p = pctRank(v, present);
        td.textContent = fmt(v, unit);
        td.title = bankName(ct) + '\n' + (m.label||code) + ': ' + fmt(v,unit) +
          (p != null ? '\n' + Math.round(p) + 'th percentile in this group' : '');
      }
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  c.appendChild(wrap);
  return c;
}

/* ==========================================================================
   Views
   ========================================================================== */
const VIEW_META = {
  overview:{title:'Overview',  sub:'Headline standing against the peer group.'},
  trends:  {title:'Trends',    sub:'How the numbers and the rankings have moved.'},
  explore: {title:'Explore',   sub:'Relationships between any two metrics.'},
  market:  {title:'Market',    sub:'Deposit share in the counties this bank operates in.'},
  compare: {title:'Compare',   sub:'Every metric, every bank, side by side.'}
};

function viewOverview(d){
  const head = S.metrics.slice(0,6);
  d.appendChild(tiles(head.indexOf(S.primary) >= 0 ? head :
    [S.primary].concat(S.metrics.filter(c => c !== S.primary)).slice(0,6)));

  const g = document.createElement('div');
  g.className = 'grid2';

  const c1 = card('Peer ranking',
    esc(bankName(S.focus.CERT)) + ' against ' + (allCerts().length - 1) + ' peers at ' +
    prettyDate(S.repdte) + '. Click a bar to pin that bank into Trends.');
  c1._tools.appendChild(metricPicker(S.primary, v => { S.primary = v; render(); }));
  chartBox(c1, w => chartRank(S.primary, w), 'Peer ranking — ' + metricLabel(S.primary));
  c1.appendChild(legendRow([
    {color:FOCUS_COLOR(), label:bankName(S.focus.CERT)},
    {color:PEER_COLOR(),  label:'Peer banks'},
    {color:cssv('--bench-ink'), label:BENCH_LABEL[S.benchmark], type:'line'}
  ]));
  g.appendChild(c1);

  const c2 = card('Trend',
    S.activePeriods.length + ' quarters through ' + prettyDate(S.repdte) +
    ', against ' + esc(BENCH_LABEL[S.benchmark]).toLowerCase() + '.' + ytdNote(S.primary));
  c2._tools.appendChild(metricPicker(S.primary, v => { S.primary = v; render(); }));
  chartBox(c2, w => chartTrend(S.primary, w), 'Trend — ' + metricLabel(S.primary));
  g.appendChild(c2);
  d.appendChild(g);

  const pos = S.metrics.slice(0, 14);
  const c3 = card('Peer position across metrics',
    'Each row is one metric rescaled to the peer group\'s own range: left is the ' +
    'group low, right is the group high. The block spans the middle half of peers, ' +
    'the vertical rule is the benchmark, and the blue marker is ' +
    esc(bankName(S.focus.CERT)) + '.' +
    (S.metrics.length > 14 ? ' Showing the first 14 of ' + S.metrics.length + ' metrics.' : ''));
  chartBox(c3, w => chartPosition(pos, w), 'Peer position');
  c3.appendChild(legendRow([
    {color:FOCUS_COLOR(), label:bankName(S.focus.CERT), type:'dot'},
    {color:PEER_COLOR(), label:'Individual peers', type:'dot'},
    {color:PEER_COLOR(), label:'Middle half of peers', opacity:'.42'},
    {color:cssv('--bench-ink'), label:BENCH_LABEL[S.benchmark], type:'line'},
    {type:'note', label:'↗ marks a value outside the peer range'}
  ]));
  d.appendChild(c3);

  d.appendChild(profileCard());
}

function viewTrends(d){
  const g = document.createElement('div');
  g.className = 'grid2';

  const c1 = card('Trend', esc(bankName(S.focus.CERT)) + ' against ' +
    esc(BENCH_LABEL[S.benchmark]).toLowerCase() + '. Peers pinned from the Overview ' +
    'ranking chart appear here.' + ytdNote(S.primary));
  c1._tools.appendChild(metricPicker(S.primary, v => { S.primary = v; render(); }));
  chartBox(c1, w => chartTrend(S.primary, w), 'Trend — ' + metricLabel(S.primary));
  g.appendChild(c1);

  const c2 = card('Rank over time',
    'Position within the group each quarter, best at the top. Your bank and any ' +
    'pinned peers are drawn in full; everyone else stays faint for context.' +
    ytdNote(S.primary));
  chartBox(c2, w => chartBump(S.primary, w), 'Rank over time — ' + metricLabel(S.primary));
  g.appendChild(c2);
  d.appendChild(g);

  if(S.pinned.length){
    const bar = document.createElement('div');
    bar.className = 'card';
    bar.style.marginBottom = '12px';
    bar.innerHTML = '<div class="card-head"><h3>Pinned peers</h3></div>';
    const chips = document.createElement('div');
    chips.className = 'chips';
    S.pinned.forEach((ct,i) => {
      const ch = document.createElement('span');
      ch.className = 'chip';
      ch.innerHTML = '<span class="swatch" style="background:'+seriesColor(i+1)+'"></span>' +
        '<span class="cn">'+esc(bankName(ct))+'</span><button title="Unpin">'+ICO.x+'</button>';
      qs('button',ch).addEventListener('click', () => {
        S.pinned = S.pinned.filter(x => x !== ct); render();
      });
      chips.appendChild(ch);
    });
    bar.appendChild(chips);
    d.appendChild(bar);
  }

  const c3 = card('All selected metrics over time',
    'One panel per metric: your bank solid, the benchmark dashed. Click a panel to ' +
    'make it the focus metric.' +
    (S.metrics.some(isYtdFlow) && windowMixesQuarters()
      ? ' <b style="color:var(--serious)">Income and expense panels are year-to-date</b> ' +
        'and reset each Q1; the sawtooth is the reset, not a swing in performance.' : '') +
    (S.metrics.length > 24 ? ' Showing the first 24 of ' + S.metrics.length + '.' : ''));
  c3.appendChild(chartSmallMultiples(S.metrics.slice(0,24)));
  d.appendChild(c3);
}

function viewExplore(d){
  if(!S.scatterX || S.metrics.indexOf(S.scatterX) < 0)
    S.scatterX = S.metrics.filter(c => c !== S.primary)[0] || S.metrics[0];
  if(!S.scatterY || S.metrics.indexOf(S.scatterY) < 0) S.scatterY = S.primary;

  const g = document.createElement('div');
  g.className = 'grid2';

  const c1 = card('Two metrics against each other',
    'Every bank in the group plotted on the two metrics you choose. Bubble size is ' +
    'total assets. A dashed fit line appears only when the relationship explains at ' +
    'least 15% of the variation, so weak patterns are not dressed up as signal.');
  const xs = metricPicker(S.scatterX, v => { S.scatterX = v; render(); });
  xs.title = 'Horizontal axis';
  const ys = metricPicker(S.scatterY, v => { S.scatterY = v; render(); });
  ys.title = 'Vertical axis';
  const lx = document.createElement('label'); lx.style.cssText='font-size:var(--t-1);color:var(--muted);font-family:var(--font-mono);font-weight:650;letter-spacing:.07em'; lx.textContent='X';
  const ly = document.createElement('label'); ly.style.cssText='font-size:var(--t-1);color:var(--muted);font-family:var(--font-mono);font-weight:650;letter-spacing:.07em'; ly.textContent='Y';
  c1._tools.appendChild(lx); c1._tools.appendChild(xs);
  c1._tools.appendChild(ly); c1._tools.appendChild(ys);
  chartBox(c1, w => chartScatter(S.scatterX, S.scatterY, w),
    'Scatter — ' + metricLabel(S.scatterY) + ' vs ' + metricLabel(S.scatterX));
  c1.appendChild(legendRow([
    {color:FOCUS_COLOR(), label:bankName(S.focus.CERT), type:'dot'},
    {color:PEER_COLOR(), label:'Peer banks', type:'dot'},
    {type:'note', label:'bubble area is total assets'}
  ]));
  g.appendChild(c1);

  const c2 = card('Peer ranking', 'Ranking on the vertical-axis metric.');
  c2._tools.appendChild(metricPicker(S.scatterY, v => { S.scatterY = v; render(); }));
  chartBox(c2, w => chartRank(S.scatterY, w), 'Peer ranking — ' + metricLabel(S.scatterY));
  g.appendChild(c2);
  d.appendChild(g);

  const c3 = card('Peer position across metrics',
    'Standing on every selected metric at ' + prettyDate(S.repdte) + '.' +
    (S.metrics.length > 20 ? ' Showing the first 20 of ' + S.metrics.length + '.' : ''));
  chartBox(c3, w => chartPosition(S.metrics.slice(0,20), w), 'Peer position');
  d.appendChild(c3);
}

function viewMarket(d){
  const M = S.market;

  if(M.loading){
    const c = card('Deposit market share', 'Loading branch deposits from the FDIC Summary of Deposits\u2026');
    c.innerHTML += '<p class="hint"><span class="spin"></span> This survey is separate from the ' +
      'quarterly Call Report and is fetched only when this view is opened.</p>';
    d.appendChild(c); return;
  }
  if(M.error){
    const c = card('Deposit market share', '');
    c.innerHTML += '<p class="hint" style="color:var(--critical)">' + esc(M.error) + '</p>';
    d.appendChild(c); return;
  }
  if(!M.loaded || !M.counties.length){
    const c = card('Deposit market share', '');
    c.innerHTML += '<p class="hint">No branch records found for this institution.</p>';
    d.appendChild(c); return;
  }

  const n = document.createElement('div');
  n.className = 'notice';
  n.style.borderLeftColor = cssv('--axis');
  n.innerHTML = ICO.info + '<div>Deposit figures on this page come from the FDIC ' +
    '<b>Summary of Deposits</b>, an annual survey taken every 30 June \u2014 not from the ' +
    'quarterly Call Report used elsewhere in this dashboard. Latest survey: <b>30 June ' +
    M.year + '</b>. Share is calculated from branch deposits; the FDIC does not publish it.</div>';
  n.querySelector('svg').style.color = cssv('--text-secondary');
  d.appendChild(n);

  /* ---- footprint: every county the bank has a branch in ---- */
  const foot = card('Footprint by county',
    esc(bankName(S.focus.CERT)) + ' holds deposits in ' + M.counties.length +
    ' count' + (M.counties.length === 1 ? 'y' : 'ies') + ' at 30 June ' + M.year +
    '. Select one to see the competitive picture.');
  const wrap = document.createElement('div');
  wrap.className = 'tablewrap';
  wrap.style.maxHeight = '320px';
  const t = document.createElement('table');
  t.innerHTML = '<thead><tr><th class="mcol">County</th><th>Branches</th>' +
    '<th>Deposits</th><th>County total</th><th>Share</th><th>Rank</th></tr></thead>';
  const tb = document.createElement('tbody');
  M.counties.forEach(c => {
    const tr = document.createElement('tr');
    if(c.code === M.sel) tr.className = 'on';
    const known = M.countyRows[c.code];
    tr.innerHTML =
      '<td class="mcol">' + esc(c.name) + '</td>' +
      '<td class="num">' + c.branches + '</td>' +
      '<td class="num">' + fmt(c.dep, 'usd') + '</td>' +
      '<td class="num">' + (known ? fmt(known.total, 'usd') : '<span class="na">\u2014</span>') + '</td>' +
      '<td class="num"><b>' + (known ? known.focusShare.toFixed(1) + '%' : '<span class="na">\u2014</span>') + '</b></td>' +
      '<td class="num">' + (known ? known.focusRank + ' <span class="na">/ ' + known.list.length + '</span>'
                                  : '<span class="na">\u2014</span>') + '</td>';
    tr.style.cursor = 'pointer';
    tr.title = 'Show the competitive picture for ' + c.name;
    tr.addEventListener('click', () => selectCounty(c.code));
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  wrap.appendChild(t);
  foot.appendChild(wrap);
  d.appendChild(foot);

  const sel = M.sel && M.countyRows[M.sel];
  if(!sel) return;
  const cty = M.counties.filter(c => c.code === M.sel)[0] || {name:M.sel};

  const g = document.createElement('div');
  g.className = 'grid2';

  const c1 = card('Deposit share \u2014 ' + esc(cty.name),
    'All FDIC-insured institutions with a branch in the county at 30 June ' + M.year +
    '. County deposits total ' + fmt(sel.total, 'usd') + ' across ' + sel.list.length +
    ' institutions.');
  chartBox(c1, w => chartShare(sel.list, sel.total, S.focus.CERT, w),
    'Deposit share ' + cty.name);
  c1.appendChild(legendRow([
    {color:FOCUS_COLOR(), label:bankName(S.focus.CERT)},
    {color:PEER_COLOR(), label:'Other institutions in the county'}
  ]));
  g.appendChild(c1);

  const tr = M.trend[M.sel] || [];
  if(!tr.length){
    const cW = card('Share over time — ' + esc(cty.name), '');
    cW.innerHTML += '<p class="hint"><span class="spin"></span> Loading ten years of survey history…</p>';
    g.appendChild(c1); g.appendChild(cW); d.appendChild(g);
    return;
  }
  const c2 = card('Share over time \u2014 ' + esc(cty.name),
    tr.length + ' annual surveys. Share is this bank\u2019s branch deposits over all ' +
    'branch deposits reported in the county.');
  chartBox(c2, w => chartShareTrend(tr, shortName(S.focus.CERT, 18), w),
    'Deposit share trend ' + cty.name);
  g.appendChild(c2);
  d.appendChild(g);

  /* ---- branches in the selected county ---- */
  const br = M.branches.filter(b => String(b.STCNTYBR) === String(M.sel));
  if(br.length){
    const c3 = card('Branches in ' + esc(cty.name),
      br.length + ' office' + (br.length === 1 ? '' : 's') + ' reporting deposits at 30 June ' + M.year + '.');
    const w3 = document.createElement('div');
    w3.className = 'tablewrap';
    const t3 = document.createElement('table');
    t3.innerHTML = '<thead><tr><th class="mcol">Office</th><th class="mcol" style="min-width:180px">Address</th>' +
      '<th>Deposits</th><th>Share of county</th></tr></thead>';
    const b3 = document.createElement('tbody');
    br.sort((a,b) => (Number(b.DEPSUMBR)||0) - (Number(a.DEPSUMBR)||0)).forEach(b => {
      const dep = Number(b.DEPSUMBR) || 0;
      const row = document.createElement('tr');
      row.innerHTML =
        '<td class="mcol">' + esc(b.NAMEBR || b.CITYBR || ('Branch ' + b.BRNUM)) + '</td>' +
        '<td class="mcol" style="min-width:180px">' + esc([b.ADDRESBR, b.CITYBR, b.STALPBR].filter(Boolean).join(', ')) + '</td>' +
        '<td class="num">' + fmt(dep, 'usd') + '</td>' +
        '<td class="num">' + (sel.total ? (dep/sel.total*100).toFixed(2) + '%' : '\u2014') + '</td>';
      b3.appendChild(row);
    });
    t3.appendChild(b3);
    w3.appendChild(t3);
    c3.appendChild(w3);
    d.appendChild(c3);
  }

  /* ---- structural events ---- */
  if(M.events.length){
    const c4 = card('Structural changes',
      'Openings, closings, purchases and mergers on file with the FDIC. These explain ' +
      'step changes in the deposit and branch figures above.');
    const w4 = document.createElement('div');
    w4.className = 'tablewrap';
    w4.style.maxHeight = '300px';
    const t4 = document.createElement('table');
    t4.innerHTML = '<thead><tr><th class="mcol">Effective</th><th class="mcol" style="min-width:230px">Event</th>' +
      '<th class="mcol" style="min-width:170px">Counterparty</th></tr></thead>';
    const b4 = document.createElement('tbody');
    M.events.slice(0, 40).forEach(e => {
      const other = e.OUT_INSTNAME || e.ACQ_INSTNAME || '';
      const row = document.createElement('tr');
      row.innerHTML =
        '<td class="mcol num">' + esc(String(e.EFFDATE || '').slice(0,10)) + '</td>' +
        '<td class="mcol" style="min-width:230px">' + esc(e.CHANGECODE_DESC || '\u2014') + '</td>' +
        '<td class="mcol" style="min-width:170px">' +
          (other && other !== bankName(S.focus.CERT) ? esc(other) : '<span class="na">\u2014</span>') + '</td>';
      b4.appendChild(row);
    });
    t4.appendChild(b4);
    w4.appendChild(t4);
    c4.appendChild(w4);
    d.appendChild(c4);
  }
}

function viewCompare(d){
  d.appendChild(tableCard(false));

  /* The same row of the table, drawn. Reading nine figures across a row tells
     you the numbers; the bars tell you the shape of the gap. */
  const c = card('Ranked comparison — ' + metricLabel(S.primary),
    'The row highlighted above, drawn largest first. The dashed rule is the ' +
    esc(BENCH_LABEL[S.benchmark]).toLowerCase() + '. Click any metric name in the ' +
    'table to draw it here, or pick one on the right. Click a bar to pin that bank ' +
    'into Trends.' + ytdNote(S.primary));
  c._tools.appendChild(metricPicker(S.primary, v => { S.primary = v; render(); }));
  chartBox(c, w => chartRank(S.primary, w), 'Ranked comparison — ' + metricLabel(S.primary));
  c.appendChild(legendRow([
    {color:FOCUS_COLOR(), label:bankName(S.focus.CERT)},
    {color:PEER_COLOR(),  label:'Peer banks'},
    {color:cssv('--bench-ink'), label:BENCH_LABEL[S.benchmark], type:'line'}
  ]));
  d.appendChild(c);
}

/* ==========================================================================
   Master render
   ========================================================================== */
function render(){
  const d = $('dash');
  if(!S.built){ return; }

  const meta = VIEW_META[S.view] || VIEW_META.overview;
  $('viewTitle').textContent = meta.title;
  const inact = allCerts().filter(isInactive).length;
  /* A status line of facts, not a description of the page. */
  $('viewSub').innerHTML = [
    esc(bankName(S.focus.CERT)),
    'cert ' + S.focus.CERT,
    '<b>' + allCerts().length + '</b> institutions',
    '<b>' + S.metrics.length + '</b> metrics',
    'period <b>' + prettyDate(S.repdte) + '</b>',
    esc(BENCH_LABEL[S.benchmark]),
    'fdic index built <b>' + (S.vintage ? S.vintage.slice(0,10) : 'n/a') + '</b>'
  ].join(' &nbsp;·&nbsp; ');

  $('subject').hidden = false;
  $('subjName').textContent = bankName(S.focus.CERT);
  $('subjMeta').textContent = 'Cert ' + S.focus.CERT + ' · ' +
    [(S.inst[String(S.focus.CERT)]||{}).CITY, (S.inst[String(S.focus.CERT)]||{}).STALP]
      .filter(Boolean).join(', ');

  $('ctxbar').hidden = false;
  syncCtxBar();

  $('printhead').innerHTML =
    '<h1>' + esc(bankName(S.focus.CERT)) + ' — peer comparison</h1>' +
    '<p>' + esc(meta.title) + ' · report period ' + prettyDate(S.repdte) +
    ' · ' + allCerts().length + ' institutions · benchmark: ' + esc(BENCH_LABEL[S.benchmark]) +
    ' · shown as ' + esc(TRANSFORM_LABEL[S.transform]) +
    ' · source: FDIC BankFind Suite, index built ' + (S.vintage ? S.vintage.slice(0,10) : 'n/a') + '</p>';

  clearChartObservers();
  d.innerHTML = '';

  if(inact){
    const n = document.createElement('div');
    n.className = 'notice';
    n.innerHTML = ICO.warn + '<div><b>' + inact + ' institution' + (inact>1?'s in this group are':' in this group is') +
      ' no longer filing Call Reports</b> after merging or closing. Figures stop at ' +
      'their final report, and later periods show as “—”. Consider removing them, or ' +
      'keep them for historical context.</div>';
    d.appendChild(n);
  }
  if(S.transform === 'qoq' && S.metrics.some(isYtdFlow)){
    const n = document.createElement('div');
    n.className = 'notice';
    n.innerHTML = ICO.warn + '<div><b>Quarter-over-quarter does not work on year-to-date items.</b> ' +
      'Income and expense figures accumulate through the year and restart at Q1, so a Q1 ' +
      'reading is compared against a full prior year and will always look severe. Use ' +
      '<b>year-over-year change</b>, which compares like periods.</div>';
    d.appendChild(n);
  }
  if(S.transform !== 'level'){
    const n = document.createElement('div');
    n.className = 'notice';
    n.style.borderColor = cssv('--accent');
    n.style.background = cssv('--accent-wash');
    n.innerHTML = ICO.info.replace('currentColor','currentColor') +
      '<div>Every figure below is shown as <b>' + TRANSFORM_LABEL[S.transform] + '</b>, ' +
      'not the reported dollar amount. Switch “Show as” back to <b>Reported value</b> ' +
      'for the raw Call Report figures.</div>';
    n.querySelector('svg').style.color = cssv('--accent');
    d.appendChild(n);
  }

  if(S.view === 'overview') viewOverview(d);
  else if(S.view === 'trends') viewTrends(d);
  else if(S.view === 'explore') viewExplore(d);
  else if(S.view === 'market') viewMarket(d);
  else viewCompare(d);

  const f = document.createElement('div');
  f.className = 'foot';
  f.innerHTML = S.view === 'market' ?
    ('<b>Source.</b> FDIC Summary of Deposits (api.fdic.gov/banks/sod), an annual survey of branch ' +
     'deposits taken every 30 June, plus FDIC institution history. Deposits are in thousands. ' +
     'Market share is calculated here as branch deposits over the sum of all branch deposits ' +
     'reported in the county; the FDIC publishes the branch totals but not the share.<br>' +
     '<b>Coverage.</b> Only FDIC-insured institutions file this survey. Credit unions, farm credit ' +
     'associations and other non-insured competitors hold deposits that are not counted here, so a ' +
     'share figure describes the insured-bank market rather than all local deposit-taking.') :
    ('<b>Source.</b> FDIC BankFind Suite API (api.fdic.gov/banks), retrieved live in this browser. ' +
    'Dollar figures are reported in thousands. Income and expense items are year-to-date, so a ' +
    'fourth-quarter figure covers the full year. Ratios are taken as the FDIC publishes them and are ' +
    'not recalculated here.<br>' +
    '<b>Restatements.</b> Banks amend Call Reports, so a figure pulled today can differ from the same ' +
    'figure exported months ago. The “FDIC index built” date above is when the FDIC last rebuilt the ' +
    'financial index this dashboard queries; it is not a filing deadline.<br>' +
    '<b>Benchmark.</b> Peer statistics exclude ' + esc(bankName(S.focus.CERT)) + ' itself, so “' +
    esc(BENCH_LABEL[S.benchmark]) + '” describes the comparison group rather than the group plus you.');
  d.appendChild(f);

  renderPageTools();
}

function renderPageTools(){
  const h = $('phTools');
  h.innerHTML = '';
  if(!S.built) return;
  const mk2 = (label, title, fn) => {
    const b = document.createElement('button');
    b.className = 'btn sm';
    b.textContent = label; b.title = title;
    b.addEventListener('click', fn);
    return b;
  };
  if(S.pinned.length)
    h.appendChild(mk2('Unpin all (' + S.pinned.length + ')', 'Remove pinned peers from the trend charts',
      () => { S.pinned = []; render(); }));
  h.appendChild(mk2('Print / PDF', 'Print the current view', () => window.print()));
}

function syncCtxBar(){
  const sel = $('ctxMetric');
  const cur = S.primary;
  sel.innerHTML = '';
  let lastCat = null, grp = null;
  S.metrics.slice().sort((a,b) => {
    const ca = CAT_ORDER.indexOf((M_BY_CODE[a]||{}).cat), cb = CAT_ORDER.indexOf((M_BY_CODE[b]||{}).cat);
    return ca !== cb ? ca-cb : ((M_BY_CODE[a]||{}).n||0)-((M_BY_CODE[b]||{}).n||0);
  }).forEach(code => {
    const cat = (M_BY_CODE[code]||{}).cat || 'Other';
    if(cat !== lastCat){
      lastCat = cat;
      grp = document.createElement('optgroup');
      grp.label = cat;
      sel.appendChild(grp);
    }
    const o = document.createElement('option');
    o.value = code; o.textContent = metricLabel(code);
    if(code === cur) o.selected = true;
    grp.appendChild(o);
  });
  $('ctxBench').value = S.benchmark;
  $('ctxTransform').value = S.transform;
  $('ctxUnits').value = S.units;
}

/* ==========================================================================
   CSV export
   ========================================================================== */
function exportCsv(){
  const certs = allCerts();
  const q = s => '"' + String(s==null?'':s).replace(/"/g,'""') + '"';
  const L = [];
  L.push([q('FDIC peer comparison'), q(bankName(S.focus.CERT))].join(','));
  L.push([q('Report period'), q(prettyDate(S.repdte)),
          q('Shown as'), q(TRANSFORM_LABEL[S.transform]),
          q('Benchmark'), q(BENCH_LABEL[S.benchmark])].join(','));
  L.push([q('Generated'), q(new Date().toISOString().slice(0,19).replace('T',' ')),
          q('FDIC index built'), q(S.vintage || '')].join(','));
  L.push([q('Dollar figures in thousands of US dollars; income items are year-to-date')].join(','));
  L.push('');
  L.push([q('Metric'), q('Field'), q('Unit')]
    .concat(certs.map(ct => q(bankName(ct))))
    .concat([q(BENCH_LABEL[S.benchmark]), q('Your rank'), q('Percentile'), q('vs benchmark %')]).join(','));
  L.push([q(''), q('FDIC cert'), q('')]
    .concat(certs.map(ct => q(ct))).concat([q(''),q(''),q(''),q('')]).join(','));

  const codes = S.metrics.slice().sort((a,b) => {
    const ca = CAT_ORDER.indexOf((M_BY_CODE[a]||{}).cat), cb = CAT_ORDER.indexOf((M_BY_CODE[b]||{}).cat);
    return ca !== cb ? ca-cb : ((M_BY_CODE[a]||{}).n||0)-((M_BY_CODE[b]||{}).n||0);
  });
  let lastCat = null;
  codes.forEach(code => {
    const m = M_BY_CODE[code] || {};
    if(m.cat !== lastCat){ lastCat = m.cat; L.push([q(String(m.cat||'Other').toUpperCase())].join(',')); }
    const st = stat(code);
    const num = v => (v == null || !isFinite(v)) ? q('N/A') : Number(v).toFixed(6).replace(/\.?0+$/,'');
    L.push([q(m.label||code), q(code), q(unitOf(code))]
      .concat(certs.map(ct => num(val(ct,code))))
      .concat([num(st.bench),
               st.rank ? q(st.rank + ' of ' + st.n) : q('N/A'),
               st.pct != null ? Math.round(st.pct) : q('N/A'),
               num(st.delta)]).join(','));
  });
  const name = 'FDIC_peer_' + bankName(S.focus.CERT).replace(/[^\w]+/g,'_').slice(0,28) +
    '_' + S.repdte + '.csv';
  downloadBlob(new Blob(['﻿' + L.join('\r\n')], {type:'text/csv;charset=utf-8'}), name);
  toast('Exported ' + codes.length + ' metrics for ' + certs.length + ' banks.', 'ok');
}
function exportMarketCsv(){
  const M = S.market;
  if(!M.loaded || !M.counties.length){ toast('Open the Market view first.', 'err'); return; }
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const L = [];
  L.push([q('FDIC deposit market share'), q(bankName(S.focus.CERT))].join(','));
  L.push([q('Source'), q('FDIC Summary of Deposits, annual survey as of 30 June ' + M.year)].join(','));
  L.push([q('Generated'), q(new Date().toISOString().slice(0,19).replace('T',' '))].join(','));
  L.push([q('Deposits in thousands of US dollars. Share covers FDIC-insured institutions only.')].join(','));
  L.push('');

  L.push([q('FOOTPRINT BY COUNTY')].join(','));
  L.push([q('County'), q('Branches'), q('Deposits'), q('County total'), q('Share %'), q('Rank'), q('Institutions')].join(','));
  M.counties.forEach(c => {
    const k = M.countyRows[c.code];
    L.push([q(c.name), c.branches, c.dep,
      k ? k.total : q('N/A'),
      k ? k.focusShare.toFixed(4) : q('N/A'),
      k && k.focusRank ? k.focusRank : q('N/A'),
      k ? k.list.length : q('N/A')].join(','));
  });

  Object.keys(M.countyRows).forEach(code => {
    const cty = M.counties.filter(c => c.code === code)[0];
    const roll = M.countyRows[code];
    if(!cty || !roll) return;
    L.push('');
    L.push([q('COUNTY DETAIL: ' + cty.name)].join(','));
    L.push([q('Institution'), q('FDIC cert'), q('Branches'), q('Deposits'), q('Share %'), q('Rank')].join(','));
    roll.list.forEach(x =>
      L.push([q(x.name), q(x.cert), x.branches, x.dep, x.share.toFixed(4), x.rank].join(',')));
    const tr = M.trend[code];
    if(tr && tr.length){
      L.push([q('Share history — ' + cty.name)].join(','));
      L.push([q('Survey year'), q('Its deposits'), q('County total'), q('Share %')].join(','));
      tr.forEach(y => L.push([y.year, y.focus, y.total,
        y.share == null ? q('N/A') : y.share.toFixed(4)].join(',')));
    }
  });

  if(M.branches.length){
    L.push('');
    L.push([q('BRANCHES')].join(','));
    L.push([q('Office'), q('Address'), q('City'), q('State'), q('County'), q('Deposits')].join(','));
    M.branches.forEach(b => L.push([
      q(b.NAMEBR || b.CITYBR || ('Branch ' + b.BRNUM)), q(b.ADDRESBR), q(b.CITYBR),
      q(b.STALPBR), q(b.CNTYNAMB), Number(b.DEPSUMBR) || 0].join(',')));
  }

  if(M.events.length){
    L.push('');
    L.push([q('STRUCTURAL CHANGES')].join(','));
    L.push([q('Effective'), q('Event'), q('Counterparty')].join(','));
    M.events.forEach(e => L.push([
      q(String(e.EFFDATE || '').slice(0,10)), q(e.CHANGECODE_DESC),
      q(e.OUT_INSTNAME || e.ACQ_INSTNAME || '')].join(',')));
  }

  const name = 'FDIC_market_share_' + bankName(S.focus.CERT).replace(/[^\w]+/g,'_').slice(0,28) +
    '_' + M.year + '.csv';
  downloadBlob(new Blob(['\ufeff' + L.join('\r\n')], {type:'text/csv;charset=utf-8'}), name);
  toast('Exported deposit market share for ' + M.counties.length + ' counties.', 'ok');
}

function exportJson(){
  const certs = allCerts();
  const out = {
    generated: new Date().toISOString(),
    source: 'https://api.fdic.gov/banks',
    fdicIndexBuilt: S.vintage,
    reportPeriod: S.repdte,
    transform: S.transform,
    benchmark: S.benchmark,
    focus: {cert:S.focus.CERT, name:bankName(S.focus.CERT)},
    institutions: certs.map(c => ({
      cert:Number(c), name:bankName(c), active:!isInactive(c),
      city:(S.inst[c]||{}).CITY, state:(S.inst[c]||{}).STALP
    })),
    periods: S.activePeriods,
    metrics: S.metrics.map(code => ({
      code:code, label:metricLabel(code), unit:unitOf(code),
      values: Object.fromEntries(certs.map(c => [c, S.activePeriods.map(d => val(c,code,d))]))
    }))
  };
  downloadBlob(new Blob([JSON.stringify(out,null,2)], {type:'application/json'}),
    'FDIC_peer_' + S.repdte + '.json');
  toast('Exported full dataset as JSON.', 'ok');
}
</script>
