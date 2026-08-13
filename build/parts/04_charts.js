<script>
"use strict";
/* ==========================================================================
   SVG chart primitives
   ========================================================================== */
/* The drawing is produced at the width the container actually has, so the
   viewBox and the viewport agree and nothing is letterboxed. Height comes from
   the aspect ratio, which keeps the box hugging the drawing instead of holding
   a fixed pixel height the content may not fill. */
function svgEl(w,h,label){
  const s = document.createElementNS('http://www.w3.org/2000/svg','svg');
  s.setAttribute('viewBox','0 0 '+w+' '+h);
  s.setAttribute('preserveAspectRatio','xMidYMid meet');
  s.setAttribute('class','chart');
  s.setAttribute('role','img');
  if(label) s.setAttribute('aria-label',label);
  s._w = w; s._h = h;
  return s;
}

/* ==========================================================================
   Shared chart geometry

   Every chart draws against the same margins so axis labels, tick spacing and
   the gap to the panel edge read the same from box to box. The two gutters
   that must vary -- the row-label column and the value-label column -- are
   measured from the strings actually being drawn rather than guessed, which is
   what stops a long figure running past the edge.
   ========================================================================== */
const CM = {
  top:     12,   /* clearance above the plot */
  bottom:  30,   /* x-axis tick row */
  right:   16,   /* breathing room at the right edge */
  pad:     10,   /* gap between a label column and the plot */
  rowH:    23,   /* one bar / one metric row */
  endGap:  11    /* gap between a line end and its direct label */
};

let _measCtx = null;
/* Width of a string as it will actually be painted, so gutters can be sized to
   content instead of to a hardcoded guess. */
function textW(str, px, mono){
  if(!_measCtx) _measCtx = document.createElement('canvas').getContext('2d');
  /* Measured at the heaviest weight any label uses. Emphasised labels are drawn
     at 650 and run about 17% wider than the same string at normal weight, so
     measuring light would under-reserve the gutter and let text run past the
     edge. Over-reserving by a few pixels costs nothing. */
  _measCtx.font = '650 ' + (px || 10) + 'px ' + (mono
    ? "'IBM Plex Mono','JetBrains Mono','Cascadia Mono',Consolas,monospace"
    : 'system-ui,-apple-system,sans-serif');
  return _measCtx.measureText(String(str == null ? '' : str)).width;
}
const maxTextW = (arr, px, mono) =>
  arr.reduce((a,x) => Math.max(a, textW(x, px, mono)), 0);

/* Longest y-axis tick label decides the left gutter. */
function axisGutter(ticks){
  return Math.ceil(maxTextW(ticks.map(t => t.lab), 10, true)) + CM.pad + 4;
}
const clampN = (v,a,b) => Math.max(a, Math.min(b, v));

/* Trim a label until it fits the gutter it will be drawn in. Character-count
   truncation is not enough: when a narrow panel forces the gutter to its clamp,
   a "short enough" name can still be wider than the space reserved for it. */
function ellipsize(str, maxPx, px, mono){
  str = String(str == null ? '' : str);
  if(textW(str, px, mono) <= maxPx) return str;
  let lo = 0, hi = str.length;
  while(lo < hi){
    const mid = (lo + hi + 1) >> 1;
    if(textW(str.slice(0, mid) + '…', px, mono) <= maxPx) lo = mid; else hi = mid - 1;
  }
  return lo > 0 ? str.slice(0, lo) + '…' : '';
}

/* ==========================================================================
   Responsive mounting

   Charts are hand-drawn SVG, so responsive means redrawing at the container's
   current width -- not rescaling one fixed drawing. A ResizeObserver on the
   wrapper redraws when the box changes, which covers window resizes, the rail
   collapsing at narrow widths, and print.
   ========================================================================== */
let CHART_OBSERVERS = [];
function clearChartObservers(){
  CHART_OBSERVERS.forEach(o => { try{ o.disconnect(); }catch(e){} });
  CHART_OBSERVERS = [];
}
function mountChart(host, build){
  const draw = () => {
    const w = Math.floor(host.clientWidth);
    /* Cards are assembled detached and inserted afterwards, so a draw before
       layout would measure zero and fall back to the minimum width. Wait for a
       real measurement rather than bake in a placeholder size. */
    if(w < 40) return;
    if(host._lastW === w && host._svg) return;
    host._lastW = w;
    const svg = build(Math.max(300, w));
    host.textContent = '';
    host.appendChild(svg);
    host._svg = svg;
  };
  if(typeof ResizeObserver === 'function'){
    const ro = new ResizeObserver(debounce(draw, 60));
    ro.observe(host);
    CHART_OBSERVERS.push(ro);
  }else{
    const onResize = debounce(draw, 120);
    addEventListener('resize', onResize);
    CHART_OBSERVERS.push({disconnect:() => removeEventListener('resize', onResize)});
  }
  /* If the box is already laid out — a dialog appended to the live document,
     say — draw straight away. Only wait for a frame when it is not, which is
     the case for cards assembled detached. Waiting unconditionally would leave
     the chart blank in a background tab, where frame callbacks are throttled
     to nothing until the tab is looked at again. */
  if(host.clientWidth >= 40) draw();
  else requestAnimationFrame(draw);
  return host;
}
/* ==========================================================================
   Even grids

   `auto-fit` picks its own column count from the available width. For a fixed
   number of items that regularly lands on a count which leaves one item alone
   on the last row — six tiles in five columns is five and one. Choosing the
   count deliberately, preferring one that divides the item count, keeps every
   row full at every window size.
   ========================================================================== */
function gridColumns(width, count, minPx){
  const max = Math.max(1, Math.min(count, Math.floor(width / minPx)));
  for(let c = max; c >= 2; c--) if(count % c === 0) return c;   /* every row full */
  for(let c = max; c >= 2; c--) if(count % c !== 1) return c;   /* no lone orphan */
  return 1;
}
/* opts.emphasise: allow one item to be drawn double-width, but only when the
   whole set still fits on a single row. Widening one item is what pushes
   another onto a row of its own once space is tight. */
function evenGrid(el, count, minPx, opts){
  opts = opts || {};
  const apply = () => {
    const w = Math.floor(el.clientWidth);
    if(w < 40 || !count) return;
    let cols = gridColumns(w, count, minPx);
    const wide = !!opts.emphasise && cols === count && w >= (count + 1) * minPx;
    if(wide) cols = count + 1;
    if(el._cols === cols && el._wide === wide) return;
    el._cols = cols; el._wide = wide;
    el.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
    el.classList.toggle('emph', wide);
  };
  if(typeof ResizeObserver === 'function'){
    const ro = new ResizeObserver(debounce(apply, 60));
    ro.observe(el);
    CHART_OBSERVERS.push(ro);
  }
  if(el.clientWidth >= 40) apply();
  else requestAnimationFrame(apply);
  return el;
}

/* Adds a chart to a card as a self-sizing block, and wires its download button
   to whichever SVG is current after a redraw. */
function chartBox(cardEl, build, exportName){
  const host = document.createElement('div');
  host.className = 'chartbox';
  cardEl.appendChild(host);
  mountChart(host, build);
  if(exportName) addChartExport(cardEl, host, exportName);
  return host;
}
function mk(tag, attrs, parent){
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for(const k in attrs) if(attrs[k] != null) e.setAttribute(k, attrs[k]);
  if(parent) parent.appendChild(e);
  return e;
}
function txt(parent, x, y, s, cls, style, anchor){
  const t = mk('text', {x:x, y:y, class:cls||'tick', style:style||null, 'text-anchor':anchor||null}, parent);
  t.textContent = s;
  return t;
}
/* Ticks with duplicate labels collapsed — tiny ranges otherwise print "1,1,1". */
function tickList(lo, hi, n, unit){
  const seen = new Set(), out = [];
  for(const t of niceTicks(lo, hi, n)){
    const lab = fmtAxis(t, unit);
    if(seen.has(lab)) continue;
    seen.add(lab); out.push({v:t, lab:lab});
  }
  return out;
}
/* Push overlapping end-of-line labels apart, keeping them inside the plot. */
function delabel(ends, gap, top, bottom){
  ends.sort((a,b) => a.y - b.y);
  ends.forEach(e => e.ly = e.y);
  for(let i=1; i<ends.length; i++)
    if(ends[i].ly - ends[i-1].ly < gap) ends[i].ly = ends[i-1].ly + gap;
  const over = ends.length ? ends[ends.length-1].ly - bottom : 0;
  if(over > 0) ends.forEach(e => e.ly -= over);
  if(ends.length && ends[0].ly < top){
    const under = top - ends[0].ly;
    ends.forEach(e => e.ly += under);
  }
  return ends;
}
/* Literal stacks: exported SVG files render outside this page, where CSS
   custom properties do not resolve. */
const MONO_STACK = "'IBM Plex Mono','JetBrains Mono','Cascadia Mono',Consolas,monospace";
const seriesColor = i => cssv(SERIES_VARS[i % SERIES_VARS.length]);

/* Focus bank keeps slot 1 blue; peers stay recessive so identity is carried
   by the direct label, not by inventing a tenth hue. */
const FOCUS_COLOR = () => cssv('--series-1');
const PEER_COLOR  = () => cssv('--peer-mark');

/* ==========================================================================
   Sparkline (used inside stat tiles)
   ========================================================================== */
function sparkline(values, w, h, color){
  const s = svgEl(w,h);
  s.removeAttribute('width'); s.setAttribute('width', w);
  const v = values.filter(x => x != null && isFinite(x));
  if(v.length < 2) return s;
  const lo = Math.min.apply(null,v), hi = Math.max.apply(null,v), span = (hi-lo)||1;
  let d = '', open = false;
  values.forEach((x,i) => {
    if(x == null || !isFinite(x)){ open = false; return; }
    const px = (i/(values.length-1))*(w-3)+1.5;
    const py = h-2 - ((x-lo)/span)*(h-5);
    d += (open?' L ':' M ') + px.toFixed(1) + ' ' + py.toFixed(1);
    open = true;
  });
  mk('path',{d:d.trim(), fill:'none', stroke:color, 'stroke-width':1.6,
    'stroke-linecap':'round','stroke-linejoin':'round', opacity:.75}, s);
  return s;
}

/* ==========================================================================
   Ranking bars
   ========================================================================== */
/* Height of a trend panel at a given width. Shared so the ranking chart beside
   it on the Overview can be asked for the same height and the pair ends level
   instead of leaving a hundred pixels of hole under the shorter one. */
const trendHeight = W => clampN(Math.round(W*0.40), 232, 330);

function chartRank(code, W, opts){
  opts = opts || {};
  W = W || 640;
  const unit = unitOf(code);
  const certs = allCerts();
  const rows = certs.map(c => ({cert:c, name:bankName(c), v:val(c,code)}))
    .sort((a,b) => (b.v==null ? -Infinity : b.v) - (a.v==null ? -Infinity : a.v));

  const padT = CM.top - 4, padB = CM.bottom - 4;
  /* opts.h is a height to fill, not a height to obey: rows stretch towards it,
     but a group large enough to need more space still gets it. */
  const rowH = opts.h
    ? clampN(Math.floor((opts.h - padT - padB) / Math.max(1, rows.length)), CM.rowH, 44)
    : CM.rowH;
  /* Both gutters are measured: the name column from the longest bank name, the
     value column from the longest formatted figure. A wide unit setting such as
     "exact dollars" therefore widens the gutter instead of overflowing it. */
  const rawNames = rows.map(r => (r.cert === String(S.focus.CERT) ? '\u25b8 ' : '') + r.name);
  const L = clampN(Math.ceil(maxTextW(rawNames, 10.5, false)) + CM.pad, 90, Math.round(W*0.42));
  const names = rawNames.map(n => ellipsize(n, L - CM.pad, 10.5, false));
  const valLabels = rows.map(r => r.v == null ? 'not reported' : fmt(r.v, unit));
  const R = clampN(Math.ceil(maxTextW(valLabels, 10, true)) + CM.pad + 6, 44, Math.round(W*0.3));
  const H = Math.max(padT + rows.length*rowH + padB, opts.h || 0);
  const s = svgEl(W,H,'Ranking of '+metricTitle(code));

  const vals = rows.map(r => r.v).filter(v => v != null);
  if(!vals.length){ txt(s, W/2, H/2, 'No values reported', 'tick', null, 'middle'); return s; }
  const maxV = Math.max(0, Math.max.apply(null,vals));
  const minV = Math.min(0, Math.min.apply(null,vals));
  const span = (maxV - minV) || 1;
  const xOf = v => L + (v - minV)/span*(W-L-R);
  const x0 = xOf(0);

  for(const t of tickList(minV, maxV, 4, unit)){
    mk('line',{x1:xOf(t.v), x2:xOf(t.v), y1:padT, y2:H-padB, class:'gridline'}, s);
    txt(s, xOf(t.v), H-padB+13, t.lab, 'tick', null, 'middle');
  }
  /* benchmark reference line */
  const b = benchOf(code);
  if(b != null && b >= minV && b <= maxV){
    mk('line',{x1:xOf(b), x2:xOf(b), y1:padT, y2:H-padB, stroke:cssv('--bench-ink'),
      'stroke-width':1.5, 'stroke-dasharray':'4 3', opacity:.85}, s);
  }
  mk('line',{x1:x0, x2:x0, y1:padT, y2:H-padB, class:'axisline'}, s);

  rows.forEach((r,i) => {
    const y = padT + i*rowH;
    const isF = r.cert === String(S.focus.CERT);
    const color = isF ? FOCUS_COLOR() : PEER_COLOR();
    const nm = names[i];
    txt(s, L-CM.pad, y+rowH/2+4, nm, 'barlab',
      'fill:'+(isF?cssv('--text-primary'):cssv('--text-secondary'))+';font-weight:'+(isF?'650':'400'), 'end');

    if(r.v == null){
      txt(s, x0+7, y+rowH/2+4, 'not reported', 'tick');
    }else{
      const xv = xOf(r.v);
      const bx = Math.min(x0,xv), bw = Math.max(1.5, Math.abs(xv-x0));
      mk('rect',{x:bx, y:y+3, width:bw, height:rowH-8, rx:4, fill:color}, s);
      /* square off the baseline end so only the data end is rounded */
      if(bw > 6) mk('rect',{x:(xv>=x0?bx:bx+bw-4), y:y+3, width:4, height:rowH-8, fill:color}, s);
      /* A long negative bar -- year-over-year change puts several on screen --
         leaves no room to label its left end without printing over the name
         column, so that label goes to the empty side of the baseline instead. */
      const lab = fmt(r.v, unit);
      const room = xv - CM.pad - textW(lab, 10, true) >= L;
      txt(s, xv >= x0 ? xv + 7 : (room ? xv - 7 : x0 + 7), y+rowH/2+4, lab, 'dlab', null,
        (xv >= x0 || !room) ? 'start' : 'end');
    }

    const hit = mk('rect',{x:0, y:y, width:W, height:rowH, class:'hit'}, s);
    hit.addEventListener('mousemove', ev => {
      const st = stat(code);
      tipShow('<div class="tt">'+esc(r.name)+'</div>' +
        '<div class="tr"><span>'+esc(metricLabel(code))+'</span><span>'+fmt(r.v,unit)+'</span></div>' +
        '<div class="tr"><span>Rank</span><span>'+(i+1)+' of '+rows.length+'</span></div>' +
        '<div class="tr">'+tipKey(cssv('--bench-ink'), BENCH_LABEL[S.benchmark])+'<span>'+fmt(st.bench,unit)+'</span></div>' +
        (isInactive(r.cert) ? '<div class="tfoot">No longer filing Call Reports</div>' :
          '<div class="tfoot">Cert '+r.cert+' · click to pin into Trends</div>'), ev);
    });
    hit.addEventListener('mouseleave', tipHide);
    hit.addEventListener('click', () => {
      if(r.cert === String(S.focus.CERT)) return;
      S.pinned = S.pinned.indexOf(r.cert) >= 0
        ? S.pinned.filter(x => x !== r.cert)
        : S.pinned.concat(r.cert).slice(-4);
      tipHide(); render();
    });
  });
  return s;
}

/* ==========================================================================
   Trend lines
   ========================================================================== */
function chartTrend(code, W, opts){
  opts = opts || {};
  W = W || 640;
  const unit = unitOf(code);
  const P = S.activePeriods;
  const series = [{
    key:'focus', name:shortName(S.focus.CERT,18), color:FOCUS_COLOR(), width:2.5,
    pts:P.map(d => val(S.focus.CERT, code, d))
  }];
  if(opts.bench !== false) series.push({
    key:'bench', name:BENCH_LABEL[S.benchmark], color:cssv('--bench-ink'), width:2, dash:'5 4',
    pts:P.map(d => benchOf(code, d))
  });
  S.pinned.forEach((ct,i) => series.push({
    key:ct, name:shortName(ct,16), color:seriesColor(i+1), width:2,
    pts:P.map(d => val(ct, code, d))
  }));

  /* Optional quartile band: where the middle half of the peer group sat each
     quarter. It answers a different question from a pinned-competitor line --
     "are we inside the pack or outside it" rather than "how do we compare with
     that bank" -- which is what separates the Overview panel from the Trends one. */
  const band = opts.band
    ? P.map(d => { const st = stat(code, d); return {lo:st.q1, hi:st.q3}; })
    : null;

  /* Height follows the width so a full-bleed panel does not end up a thin
     letterbox, and a narrow one does not end up a tall stripe. */
  const H = opts.h || trendHeight(W);
  const T = CM.top, B = CM.bottom;
  const s = svgEl(W,H, (band ? 'Trend against the peer range of ' : 'Trend of ') + metricTitle(code));
  const flat = series.reduce((a,x) => a.concat(x.pts), [])
    .concat(band ? band.reduce((a,b) => a.concat([b.lo, b.hi]), []) : [])
    .filter(v => v != null);
  if(!flat.length){ txt(s, W/2, H/2, 'No values reported over this period', 'tick', null, 'middle'); return s; }
  /* Reserve the end-label column from the longest series name, then trim the
     names to whatever that column ends up being on a narrow panel. */
  const R = clampN(Math.ceil(maxTextW(series.map(x => x.name), 11, false)) + CM.endGap + 8,
                   70, Math.round(W*0.34));
  series.forEach(x => { x.name = ellipsize(x.name, R - CM.endGap - 8, 11, false); });

  let lo = Math.min.apply(null,flat), hi = Math.max.apply(null,flat);
  if(lo > 0 && unit !== 'pct') lo = 0;            /* magnitudes anchor at zero */
  if(lo === hi){ hi = lo + Math.abs(lo||1)*0.1; lo = lo - Math.abs(lo||1)*0.1; }
  const padv = (hi-lo)*0.08; hi += padv; if(lo < 0) lo -= padv;

  const ticksY = tickList(lo, hi, 5, unit);
  const L = axisGutter(ticksY);
  const xOf = i => L + (P.length===1 ? (W-L-R)/2 : i/(P.length-1)*(W-L-R));
  const yOf = v => T + (1 - (v-lo)/(hi-lo))*(H-T-B);

  for(const t of ticksY){
    const y = yOf(t.v);
    if(y < T-1 || y > H-B+1) continue;
    mk('line',{x1:L, x2:W-R, y1:y, y2:y, class:'gridline'}, s);
    txt(s, L-CM.pad, y+4, t.lab, 'tick', null, 'end');
  }
  if(lo < 0 && hi > 0) mk('line',{x1:L, x2:W-R, y1:yOf(0), y2:yOf(0), class:'axisline'}, s);
  mk('line',{x1:L, x2:W-R, y1:H-B, y2:H-B, class:'axisline'}, s);

  const step = P.length > 12 ? 3 : P.length > 8 ? 2 : 1;
  P.forEach((d,i) => {
    if(i % step && i !== P.length-1) return;
    txt(s, xOf(i), H-B+15, qLabel(d), 'tick', null, 'middle');
  });

  /* Drawn before the lines so the series sit on top of it. */
  if(band){
    const top = [], bot = [];
    band.forEach((b,i) => {
      if(b.lo == null || b.hi == null) return;
      top.push(xOf(i).toFixed(1) + ' ' + yOf(b.hi).toFixed(1));
      bot.unshift(xOf(i).toFixed(1) + ' ' + yOf(b.lo).toFixed(1));
    });
    if(top.length > 1)
      mk('path',{d:'M ' + top.concat(bot).join(' L ') + ' Z', fill:PEER_COLOR(),
        'fill-opacity':.20, stroke:'none'}, s);
  }

  const ends = [];
  for(const ser of series){
    let d = '', open = false;
    ser.pts.forEach((v,i) => {
      if(v == null){ open = false; return; }
      d += (open?' L ':' M ') + xOf(i).toFixed(1) + ' ' + yOf(v).toFixed(1);
      open = true;
    });
    if(d) mk('path',{d:d.trim(), fill:'none', stroke:ser.color, 'stroke-width':ser.width,
      'stroke-linecap':'round','stroke-linejoin':'round','stroke-dasharray':ser.dash||null}, s);
    let last = -1;
    ser.pts.forEach((v,i) => { if(v != null) last = i; });
    if(last >= 0) ends.push({ser:ser, x:xOf(last), y:yOf(ser.pts[last])});
  }
  delabel(ends, 13, T+5, H-B);
  for(const e of ends){
    mk('circle',{cx:e.x, cy:e.y, r:4.5, fill:e.ser.color,
      stroke:cssv('--surface-1'), 'stroke-width':2}, s);
    if(Math.abs(e.ly - e.y) > 1)
      mk('path',{d:'M '+(e.x+5)+' '+e.y+' L '+(e.x+CM.endGap-2)+' '+e.ly, fill:'none',
        stroke:e.ser.color, 'stroke-width':1, opacity:.5}, s);
    txt(s, e.x+CM.endGap, e.ly+4, e.ser.name, null,
      'fill:'+e.ser.color+';font-size:10px;font-weight:650');
  }

  const cross = mk('line',{x1:0,x2:0,y1:T,y2:H-B, class:'axisline', opacity:0, 'stroke-dasharray':'3 3'}, s);
  P.forEach((d,i) => {
    const half = (W-L-R)/Math.max(1,P.length-1)/2;
    const hit = mk('rect',{x:xOf(i)-half, y:T, width:Math.max(10,half*2), height:H-T-B, class:'hit'}, s);
    hit.addEventListener('mousemove', ev => {
      cross.setAttribute('x1',xOf(i)); cross.setAttribute('x2',xOf(i)); cross.setAttribute('opacity','1');
      let rows = '';
      for(const ser of series)
        rows += '<div class="tr">'+tipKey(ser.color, ser.name)+'<span>'+fmt(ser.pts[i],unit)+'</span></div>';
      if(band && band[i] && band[i].lo != null)
        rows += '<div class="tr">'+tipKey(PEER_COLOR(), 'Middle half of peers')+
          '<span>'+fmt(band[i].lo,unit)+' – '+fmt(band[i].hi,unit)+'</span></div>';
      tipShow('<div class="tt">'+qLabelLong(d)+' · '+prettyDate(d)+'</div>'+rows, ev);
    });
    hit.addEventListener('mouseleave', () => { cross.setAttribute('opacity','0'); tipHide(); });
  });
  return s;
}

/* ==========================================================================
   Peer position strip
   ========================================================================== */
function chartPosition(codes, W){
  W = W || 1020;
  const rowH = CM.rowH + 5, T = CM.top + 10, B = CM.top - 6;
  /* Metric names get as much of the gutter as they need, capped so the plot
     itself never shrinks below roughly half the panel. */
  const rawLabels = codes.map(metricLabel);
  const L = clampN(Math.ceil(maxTextW(rawLabels, 10.5, false)) + CM.pad + 4, 150, Math.round(W*0.40));
  const labels = rawLabels.map(l => ellipsize(l, L - CM.pad - 4, 10.5, false));
  const R = clampN(Math.ceil(maxTextW(['100%ile \u2197'], 10, true)) + CM.pad + 8, 58, 96);
  const H = T + codes.length*rowH + B;
  const s = svgEl(W,H,'Peer position across metrics');

  [0,25,50,75,100].forEach(p => {
    const x = L + p/100*(W-L-R);
    mk('line',{x1:x, x2:x, y1:T-6, y2:H-B, class:'gridline'}, s);
    txt(s, x, T-11, p===0?'low':p===100?'high':p+'%', 'tick', null, 'middle');
  });

  codes.forEach((code,i) => {
    const unit = unitOf(code);
    const st = stat(code);
    const y = T + i*rowH + rowH/2;
    const lab = metricLabel(code);
    const isP = code === S.primary;
    txt(s, L-CM.pad, y+4, labels[i], 'barlab',
      'cursor:pointer;font-weight:'+(isP?'650':'400')+';fill:'+(isP?cssv('--accent'):cssv('--text-secondary')), 'end');

    const pv = st.peers;
    if(pv.length < 2){ txt(s, L+6, y+4, 'too few peer values', 'tick'); return; }
    const lo = st.min, hi = st.max, span = (hi-lo) || 1;
    const xOf = v => L + clamp((v-lo)/span, 0, 1)*(W-L-R);

    mk('line',{x1:xOf(lo), x2:xOf(hi), y1:y, y2:y, stroke:cssv('--axis'),
      'stroke-width':2, 'stroke-linecap':'round'}, s);
    if(st.q1 != null && st.q3 != null)
      mk('rect',{x:xOf(st.q1), y:y-8, width:Math.max(2, xOf(st.q3)-xOf(st.q1)), height:16,
        rx:3, fill:PEER_COLOR(), opacity:.42}, s);
    pv.forEach(v => mk('circle',{cx:xOf(v), cy:y, r:3, fill:PEER_COLOR()}, s));
    if(st.bench != null)
      mk('line',{x1:xOf(st.bench), x2:xOf(st.bench), y1:y-9, y2:y+9,
        stroke:cssv('--bench-ink'), 'stroke-width':2}, s);

    if(st.focus != null){
      const inR = st.focus >= lo && st.focus <= hi;
      mk('circle',{cx:xOf(st.focus), cy:y, r:6.5, fill:FOCUS_COLOR(),
        stroke:cssv('--surface-1'), 'stroke-width':2}, s);
      txt(s, W-R+CM.pad, y+4, (st.pct!=null ? Math.round(st.pct)+'%ile' : '—') + (inR?'':' ↗'), 'dlab');
    }else{
      txt(s, W-R+CM.pad, y+4, '—', 'tick');
    }

    const hit = mk('rect',{x:0, y:y-rowH/2, width:W, height:rowH, class:'hit'}, s);
    hit.addEventListener('mousemove', ev => tipShow(
      '<div class="tt">'+esc(lab)+'</div>' +
      '<div class="tr">'+tipKey(FOCUS_COLOR(), shortName(S.focus.CERT,20))+'<span>'+fmt(st.focus,unit)+'</span></div>' +
      '<div class="tr">'+tipKey(cssv('--bench-ink'), BENCH_LABEL[S.benchmark])+'<span>'+fmt(st.bench,unit)+'</span></div>' +
      '<div class="tr"><span>Peer range</span><span>'+fmt(lo,unit)+' – '+fmt(hi,unit)+'</span></div>' +
      '<div class="tr"><span>Rank</span><span>'+(st.rank||'—')+' of '+st.n+'</span></div>' +
      '<div class="tfoot">Click to make this the focus metric</div>', ev));
    hit.addEventListener('mouseleave', tipHide);
    hit.addEventListener('click', () => { S.primary = code; tipHide(); render(); });
  });
  return s;
}

/* ==========================================================================
   Scatter — two metrics against each other, bubble area by total assets
   ========================================================================== */
function chartScatter(xCode, yCode, W){
  W = W || 640;
  const ux = unitOf(xCode), uy = unitOf(yCode);
  const pts = allCerts().map(c => ({
    cert:c, name:bankName(c),
    x:val(c,xCode), y:val(c,yCode), a:raw(c,'ASSET'),
    focus: c === String(S.focus.CERT)
  })).filter(p => p.x != null && p.y != null);

  const H = clampN(Math.round(W*0.56), 300, 440);
  const R = CM.right, T = CM.top, B = CM.bottom + 18;   /* extra row for the axis title */
  const s = svgEl(W,H,'Scatter of '+metricLabel(yCode)+' against '+metricLabel(xCode));
  if(pts.length < 2){ txt(s, W/2, H/2, 'Not enough banks report both metrics', 'tick', null, 'middle'); return s; }

  const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
  let xlo = Math.min.apply(null,xs), xhi = Math.max.apply(null,xs);
  let ylo = Math.min.apply(null,ys), yhi = Math.max.apply(null,ys);
  const px = (xhi-xlo)*0.1 || Math.abs(xhi||1)*0.1, py = (yhi-ylo)*0.1 || Math.abs(yhi||1)*0.1;
  xlo -= px; xhi += px; ylo -= py; yhi += py;
  const ticksY = tickList(ylo,yhi,5,uy);
  /* Left gutter holds the widest tick plus the rotated axis title. */
  const L = axisGutter(ticksY) + 16;
  const X = v => L + (v-xlo)/(xhi-xlo)*(W-L-R);
  const Y = v => T + (1-(v-ylo)/(yhi-ylo))*(H-T-B);

  for(const t of ticksY){
    const y = Y(t.v); if(y<T-1||y>H-B+1) continue;
    mk('line',{x1:L,x2:W-R,y1:y,y2:y,class:'gridline'},s);
    txt(s, L-CM.pad, y+4, t.lab, 'tick', null, 'end');
  }
  for(const t of tickList(xlo,xhi,5,ux)){
    const x = X(t.v); if(x<L-1||x>W-R+1) continue;
    mk('line',{x1:x,x2:x,y1:T,y2:H-B,class:'gridline'},s);
    txt(s, x, H-B+14, t.lab, 'tick', null, 'middle');
  }
  mk('line',{x1:L,x2:W-R,y1:H-B,y2:H-B,class:'axisline'},s);
  mk('line',{x1:L,x2:L,y1:T,y2:H-B,class:'axisline'},s);
  txt(s, L+(W-L-R)/2, H-8, metricLabel(xCode), 'barlab',
    'fill:'+cssv('--text-secondary')+';font-weight:600', 'middle');
  const yl = txt(s, 0, 0, metricLabel(yCode), 'barlab',
    'fill:'+cssv('--text-secondary')+';font-weight:600', 'middle');
  yl.setAttribute('transform','translate(13,'+(T+(H-T-B)/2)+') rotate(-90)');

  /* least-squares fit, drawn only when the relationship is not noise */
  const n = pts.length;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  pts.forEach(p => { sxy += (p.x-mx)*(p.y-my); sxx += (p.x-mx)*(p.x-mx); syy += (p.y-my)*(p.y-my); });
  const r2 = (sxx && syy) ? (sxy*sxy)/(sxx*syy) : 0;
  if(sxx && n >= 4 && r2 >= 0.15){
    const b1 = sxy/sxx, b0 = my - b1*mx;
    mk('line',{x1:X(xlo), y1:Y(b0+b1*xlo), x2:X(xhi), y2:Y(b0+b1*xhi),
      stroke:cssv('--bench-ink'), 'stroke-width':1.5, 'stroke-dasharray':'5 4', opacity:.6}, s);
    txt(s, W-R-4, T+12, 'trend R² '+r2.toFixed(2), 'tick', null, 'end');
  }

  const amax = Math.max.apply(null, pts.map(p => p.a || 0)) || 1;
  const rOf = a => 5 + Math.sqrt((a||0)/amax) * 11;

  pts.sort((a,b) => (b.a||0)-(a.a||0));
  pts.forEach(p => {
    const c = p.focus ? FOCUS_COLOR() : PEER_COLOR();
    mk('circle',{cx:X(p.x), cy:Y(p.y), r:rOf(p.a), fill:c,
      'fill-opacity': p.focus ? 1 : .62,
      stroke:cssv('--surface-1'), 'stroke-width':2}, s);
    if(p.focus)
      txt(s, X(p.x), Y(p.y)-rOf(p.a)-6, shortName(p.cert,20), null,
        'fill:'+FOCUS_COLOR()+';font-size:10px;font-weight:650', 'middle');
    const hit = mk('circle',{cx:X(p.x), cy:Y(p.y), r:Math.max(11,rOf(p.a)), class:'hit'}, s);
    hit.addEventListener('mousemove', ev => tipShow(
      '<div class="tt">'+esc(p.name)+'</div>' +
      '<div class="tr"><span>'+esc(metricLabel(xCode))+'</span><span>'+fmt(p.x,ux)+'</span></div>' +
      '<div class="tr"><span>'+esc(metricLabel(yCode))+'</span><span>'+fmt(p.y,uy)+'</span></div>' +
      '<div class="tr"><span>Total assets</span><span>'+fmt(p.a,'usd')+'</span></div>' +
      '<div class="tfoot">Bubble size is total assets</div>', ev));
    hit.addEventListener('mouseleave', tipHide);
  });
  return s;
}

/* ==========================================================================
   Rank over time
   ========================================================================== */
function chartBump(code, W, opts){
  opts = opts || {};
  W = W || 640;
  const P = S.activePeriods;
  const certs = allCerts();
  const ranks = {};
  certs.forEach(c => ranks[c] = []);
  P.forEach(d => {
    const rows = certs.map(c => ({c:c, v:val(c,code,d)}))
      .filter(r => r.v != null).sort((a,b) => b.v-a.v);
    const pos = {};
    rows.forEach((r,i) => pos[r.c] = i+1);
    certs.forEach(c => ranks[c].push(pos[c] == null ? null : pos[c]));
  });

  const N = certs.length;
  /* Matches the trend panel beside it; the rank scale is proportional to the
     plot height, so the rows simply spread out. */
  const H = Math.max(210, CM.top + CM.bottom + N*19, opts.h || 0);
  const T = CM.top + 6, B = CM.bottom;
  const rawNames = certs.map(c => bankName(c));
  const R = clampN(Math.ceil(maxTextW(certs.map(c => shortName(c,16)), 10.5, false)) + CM.endGap + 6,
                   84, Math.round(W*0.32));
  const endNames = {};
  /* A few pixels of slack: canvas metrics and SVG text rendering disagree
     slightly, and the end labels sit hard against the right edge. */
  certs.forEach((c,i) => endNames[c] = ellipsize(rawNames[i], R - CM.endGap - 12, 10.5, false));
  const L = Math.ceil(maxTextW(['rank', String(N)], 10, true)) + CM.pad + 4;
  const s = svgEl(W,H,'Rank over time for '+metricTitle(code));
  const any = certs.some(c => ranks[c].some(v => v != null));
  if(!any){ txt(s, W/2, H/2, 'No values reported over this period', 'tick', null, 'middle'); return s; }

  const xOf = i => L + (P.length===1 ? (W-L-R)/2 : i/(P.length-1)*(W-L-R));
  const yOf = r => T + ((r-1)/Math.max(1,N-1))*(H-T-B);

  for(let r=1; r<=N; r++){
    mk('line',{x1:L, x2:W-R, y1:yOf(r), y2:yOf(r), class:'gridline'}, s);
    if(r===1 || r===N || r%2===0) txt(s, L-CM.pad, yOf(r)+4, String(r), 'tick', null, 'end');
  }
  txt(s, L-CM.pad, T-13, 'rank', 'tick', 'font-weight:600', 'end');
  const step = P.length > 12 ? 3 : P.length > 8 ? 2 : 1;
  P.forEach((d,i) => {
    if(i % step && i !== P.length-1) return;
    txt(s, xOf(i), H-B+15, qLabel(d), 'tick', null, 'middle');
  });

  const pinnedSet = S.pinned.slice();
  const ends = [];
  certs.forEach(c => {
    const isF = c === String(S.focus.CERT);
    const pi = pinnedSet.indexOf(c);
    const emph = isF || pi >= 0;
    const color = isF ? FOCUS_COLOR() : (pi >= 0 ? seriesColor(pi+1) : PEER_COLOR());
    let d = '', open = false, last = -1;
    ranks[c].forEach((r,i) => {
      if(r == null){ open = false; return; }
      d += (open?' L ':' M ') + xOf(i).toFixed(1) + ' ' + yOf(r).toFixed(1);
      open = true; last = i;
    });
    if(d) mk('path',{d:d.trim(), fill:'none', stroke:color,
      'stroke-width': emph ? 2.5 : 1.5, opacity: emph ? 1 : .45,
      'stroke-linecap':'round','stroke-linejoin':'round'}, s);
    ranks[c].forEach((r,i) => {
      if(r == null) return;
      mk('circle',{cx:xOf(i), cy:yOf(r), r: emph ? 4 : 2.6, fill:color,
        opacity: emph ? 1 : .5, stroke:cssv('--surface-1'), 'stroke-width': emph ? 1.6 : 0}, s);
    });
    if(last >= 0) ends.push({c:c, x:xOf(last), y:yOf(ranks[c][last]), color:color, emph:emph});
  });
  delabel(ends, 12, T, H-B);
  ends.forEach(e => {
    txt(s, e.x+CM.endGap, e.ly+4, endNames[e.c], null,
      'fill:'+(e.emph ? e.color : cssv('--muted'))+';font-size:10px;font-weight:'+(e.emph?'650':'400'));
  });

  P.forEach((d,i) => {
    const half = (W-L-R)/Math.max(1,P.length-1)/2;
    const hit = mk('rect',{x:xOf(i)-half, y:T, width:Math.max(10,half*2), height:H-T-B, class:'hit'}, s);
    hit.addEventListener('mousemove', ev => {
      const rows = certs.map(c => ({c:c, r:ranks[c][i], v:val(c,code,d)}))
        .filter(x => x.r != null).sort((a,b) => a.r-b.r).slice(0,6);
      tipShow('<div class="tt">'+qLabelLong(d)+'</div>' + rows.map(x =>
        '<div class="tr">'+tipKey(x.c===String(S.focus.CERT)?FOCUS_COLOR():PEER_COLOR(),
          x.r+'. '+shortName(x.c,18))+'<span>'+fmt(x.v, unitOf(code))+'</span></div>').join('') +
        (certs.length > 6 ? '<div class="tfoot">top 6 of '+certs.length+'</div>' : ''), ev);
    });
    hit.addEventListener('mouseleave', tipHide);
  });
  return s;
}

/* ==========================================================================
   Standing heatmap — the whole comparison matrix as one picture

   The table beside it holds 12 metrics across 9 banks: correct, complete, and
   impossible to scan. This shades every cell by where that bank stands in its
   row, so "who is strong across the board" is a glance instead of a read.

   The ramp is direction-aware. On efficiency ratio a low number is the good
   one, so shading by raw percentile would paint the best performer palest.
   Every cell is shaded by standing, not by size.
   ========================================================================== */
const SEQ_VARS = ['--seq-100','--seq-250','--seq-400','--seq-550','--seq-700'];
function chartHeatmap(codes, W, onPickMetric){
  W = W || 900;
  const certs = allCerts();
  const n = codes.length, m = certs.length;
  const labs = codes.map(metricLabel);
  const names = certs.map(c => shortName(c, 20));

  /* The row-label column is sized to the strings it holds, not to a share of the
     panel, and the block that follows -- labels and grid together -- is centred
     as one composition. Centring the grid alone drags the labels right with it
     and leaves a lopsided gap down the left. */
  const rowText = labs.map((l,i) => l + (betterDir(codes[i]) < 0 ? ' ▾' : ''));
  const labW = clampN(Math.ceil(maxTextW(rowText, 10, false)), 90, Math.round(W*0.30));
  const T = clampN(Math.ceil(maxTextW(names, 10, false)) + 10, 60, 150);
  const B = 6, MARGIN = 8;
  /* Cells grow to use the panel, capped so they stay tiles rather than stripes,
     and the row height follows the width so the proportion holds at any size. */
  const cellW = clampN(Math.floor((W - labW - CM.pad - MARGIN*2) / m), 18, 110);
  /* Row height is held down deliberately. Cells could be square, but sixteen
     square rows is taller than a laptop screen, and a panel called "at a glance"
     that has to be scrolled is not one. */
  const rowH  = clampN(Math.round(cellW * 0.30), 22, 34);
  const gridW = cellW * m;
  const X0 = Math.max(MARGIN, Math.floor((W - (labW + CM.pad + gridW)) / 2));
  const G = X0 + labW + CM.pad;
  const H = T + n*rowH + B;
  const s = svgEl(W, H, 'Standing of every bank on every selected metric');
  if(!n || !m){ txt(s, W/2, H/2, 'Nothing selected', 'tick', null, 'middle'); return s; }

  certs.forEach((c,j) => {
    const isF = c === String(S.focus.CERT);
    const t = txt(s, 0, 0, ellipsize(names[j], T - 12, 10, false), 'barlab',
      'fill:'+(isF ? cssv('--text-primary') : cssv('--text-secondary'))+
      ';font-weight:'+(isF ? '650' : '400'), 'start');
    t.setAttribute('transform',
      'translate(' + (G + j*cellW + cellW/2 + 3.5) + ',' + (T-8) + ') rotate(-90)');
  });

  codes.forEach((code,i) => {
    const unit = unitOf(code);
    const dir = betterDir(code);
    const y = T + i*rowH;
    const isP = code === S.primary;
    const lab = txt(s, G-CM.pad, y + rowH/2 + 3.5,
      ellipsize(rowText[i], labW, 10, false), 'barlab',
      'cursor:pointer;font-weight:'+(isP?'650':'400')+
      ';fill:'+(isP?cssv('--accent'):cssv('--text-secondary')), 'end');
    lab.addEventListener('click', () => { if(onPickMetric) onPickMetric(code); });

    const vals = certs.map(c => val(c, code));
    const present = vals.filter(v => v != null);
    certs.forEach((c,j) => {
      const x = G + j*cellW, v = vals[j];
      if(v == null){
        mk('rect',{x:x, y:y, width:cellW-1, height:rowH-1, fill:cssv('--surface-sunk')}, s);
        txt(s, x + cellW/2, y + rowH/2 + 3.5, '—', 'tick', null, 'middle');
        return;
      }
      const p = present.length > 1 ? pctRank(v, present) : 50;
      /* Standing, not magnitude: flipped where a lower number is the better one. */
      const good = dir < 0 ? 100 - p : p;
      const step = SEQ_VARS[Math.min(SEQ_VARS.length-1, Math.floor(good/100 * SEQ_VARS.length))];
      mk('rect',{x:x, y:y, width:cellW-1, height:rowH-1, fill:cssv(step)}, s);

      const hit = mk('rect',{x:x, y:y, width:cellW-1, height:rowH-1, class:'hit'}, s);
      hit.addEventListener('mousemove', ev => tipShow(
        '<div class="tt">'+esc(bankName(c))+'</div>' +
        '<div class="tr"><span>'+esc(labs[i])+'</span><span>'+fmt(v,unit)+'</span></div>' +
        '<div class="tr"><span>Standing in group</span><span>'+Math.round(good)+' of 100</span></div>' +
        (dir < 0 ? '<div class="tfoot">Lower is better for this ratio, so the shading is inverted</div>'
                 : '<div class="tfoot">Click the metric name to focus it</div>'), ev));
      hit.addEventListener('mouseleave', tipHide);
    });
  });

  /* The focus bank's column, outlined rather than recoloured so the ramp stays
     the only thing carrying value. */
  const fj = certs.indexOf(String(S.focus.CERT));
  if(fj >= 0)
    mk('rect',{x:G + fj*cellW - 1, y:T - 3, width:cellW+1, height:n*rowH+4,
      fill:'none', stroke:cssv('--series-1'), 'stroke-width':2}, s);
  return s;
}

/* ==========================================================================
   Correlation matrix — which metrics move together across the group

   The scatter answers one pair at a time. This says which pairs are worth
   plotting at all, so choosing the axes stops being guesswork. Correlation is
   measured across the banks at the selected period, not through time.
   ========================================================================== */
function corrOf(a, b){
  const xs = [], ys = [];
  for(const c of allCerts()){
    const x = val(c, a), y = val(c, b);
    if(x == null || y == null) continue;
    xs.push(x); ys.push(y);
  }
  if(xs.length < 4) return null;              /* too few points to mean anything */
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for(let i=0; i<xs.length; i++){
    sxy += (xs[i]-mx)*(ys[i]-my);
    sxx += (xs[i]-mx)*(xs[i]-mx);
    syy += (ys[i]-my)*(ys[i]-my);
  }
  return (sxx && syy) ? sxy/Math.sqrt(sxx*syy) : null;
}
/* One metric against all the others, as bars rather than a grid.

   A full N x N matrix is a lot of screen for a reader who only ever asks one
   question at a time -- "what moves with the thing I am looking at" -- and it
   asks them to decode a colour scale to answer it. Anchoring on the plotted
   metric and ranking the rest by strength answers the same question in a form
   that needs no key, and leaves the dashboard with a single grid visual. */
function chartDrivers(target, codes, W, onPick){
  W = W || 640;
  const others = codes.filter(c => c !== target);
  const rows = others
    .map(c => ({code:c, name:metricLabel(c), r:corrOf(target, c)}))
    .filter(x => x.r != null)
    .sort((a,b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, 14);

  const rowH = CM.rowH, padT = CM.top + 6, padB = CM.bottom - 4;
  const rawNames = rows.map(x => x.name);
  const L = clampN(Math.ceil(maxTextW(rawNames, 10.5, false)) + CM.pad, 100, Math.round(W*0.42));
  const names = rawNames.map(n => ellipsize(n, L - CM.pad, 10.5, false));
  const R = clampN(Math.ceil(maxTextW(['-0.00'], 10, true)) + CM.pad + 6, 46, 90);
  const H = padT + Math.max(1, rows.length)*rowH + padB;
  const s = svgEl(W, H, 'What moves with ' + metricLabel(target));
  if(!rows.length){
    /* Two different reasons for an empty panel, and telling a reader the wrong
       one sends them looking for a data problem that is not there. */
    txt(s, W/2, H/2, others.length
      ? 'Fewer than four banks report both metrics'
      : 'Select a second metric to compare this one against', 'tick', null, 'middle');
    return s;
  }

  /* Fixed -1..+1 domain: correlation has natural bounds, and holding the scale
     still is what lets one panel be compared with the next. */
  const xOf = v => L + (v + 1)/2*(W - L - R);
  const x0 = xOf(0);
  for(const t of [-1,-0.5,0,0.5,1]){
    mk('line',{x1:xOf(t), x2:xOf(t), y1:padT-6, y2:H-padB, class:'gridline'}, s);
    txt(s, xOf(t), H-padB+13, t === 0 ? '0' : (t > 0 ? '+' : '') + t, 'tick', null, 'middle');
  }
  txt(s, xOf(-0.5), padT-12, 'moves opposite', 'tick', 'fill:'+cssv('--muted'), 'middle');
  txt(s, xOf(0.5),  padT-12, 'moves together', 'tick', 'fill:'+cssv('--muted'), 'middle');
  mk('line',{x1:x0, x2:x0, y1:padT-6, y2:H-padB, class:'axisline'}, s);

  rows.forEach((row,i) => {
    const y = padT + i*rowH;
    /* Below about 0.3 the relationship is not worth reading, so it is drawn
       recessive rather than given the same weight as a real one. */
    const weak = Math.abs(row.r) < 0.3;
    const color = row.r >= 0 ? cssv('--series-1') : cssv('--series-2');
    txt(s, L-CM.pad, y+rowH/2+4, names[i], 'barlab',
      'cursor:pointer;fill:'+(weak ? cssv('--muted') : cssv('--text-secondary')), 'end');

    const xv = xOf(row.r);
    const bx = Math.min(x0, xv), bw = Math.max(1.5, Math.abs(xv - x0));
    mk('rect',{x:bx, y:y+3, width:bw, height:rowH-8, rx:4, fill:color,
      'fill-opacity': weak ? .32 : 1}, s);
    if(bw > 6) mk('rect',{x:(xv>=x0?bx:bx+bw-4), y:y+3, width:4, height:rowH-8,
      fill:color, 'fill-opacity': weak ? .32 : 1}, s);
    txt(s, xv + (xv>=x0?7:-7), y+rowH/2+4, row.r.toFixed(2), 'dlab', null, xv>=x0?'start':'end');

    const hit = mk('rect',{x:0, y:y, width:W, height:rowH, class:'hit'}, s);
    hit.addEventListener('mousemove', ev => tipShow(
      '<div class="tt">'+esc(row.name)+'</div>' +
      '<div class="tr"><span>vs '+esc(metricLabel(target))+'</span><span>'+row.r.toFixed(2)+'</span></div>' +
      '<div class="tr"><span>Reading</span><span>'+
        (weak ? 'little or none' : row.r > 0 ? 'rise together' : 'one rises, one falls')+'</span></div>' +
      '<div class="tfoot">Click to plot it on the horizontal axis</div>', ev));
    hit.addEventListener('mouseleave', tipHide);
    hit.addEventListener('click', () => { tipHide(); if(onPick) onPick(row.code); });
  });
  return s;
}

/* ==========================================================================
   Small multiples — one mini trend per metric
   ========================================================================== */
function chartSmallMultiples(codes){
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px';
  codes.forEach(code => {
    const unit = unitOf(code);
    const P = S.activePeriods;
    const f = P.map(d => val(S.focus.CERT, code, d));
    const b = P.map(d => benchOf(code, d));
    const cell = document.createElement('div');
    cell.style.cssText = 'border:1px solid var(--border);border-radius:var(--r-md);padding:8px 9px;'+
      'background:var(--surface-1);cursor:pointer';
    if(code === S.primary) cell.style.borderColor = cssv('--accent');

    const W = 240, H = 84, T = 4, B = 4, L = 3, R = 3;
    const s = svgEl(W,H,metricLabel(code));
    const flat = f.concat(b).filter(v => v != null);
    if(flat.length){
      let lo = Math.min.apply(null,flat), hi = Math.max.apply(null,flat);
      if(lo === hi){ hi = lo + Math.abs(lo||1)*0.1; lo -= Math.abs(lo||1)*0.1; }
      const xOf = i => L + (P.length===1?(W-L-R)/2 : i/(P.length-1)*(W-L-R));
      const yOf = v => T + (1-(v-lo)/(hi-lo))*(H-T-B);
      [[b, cssv('--bench-ink'), 1.4, '4 3'], [f, FOCUS_COLOR(), 2, null]].forEach(sp => {
        let d='', open=false;
        sp[0].forEach((v,i) => {
          if(v==null){ open=false; return; }
          d += (open?' L ':' M ')+xOf(i).toFixed(1)+' '+yOf(v).toFixed(1); open=true;
        });
        if(d) mk('path',{d:d.trim(), fill:'none', stroke:sp[1], 'stroke-width':sp[2],
          'stroke-dasharray':sp[3], 'stroke-linecap':'round','stroke-linejoin':'round'}, s);
      });
      let last=-1; f.forEach((v,i)=>{ if(v!=null) last=i; });
      if(last>=0) mk('circle',{cx:xOf(last), cy:yOf(f[last]), r:3.5, fill:FOCUS_COLOR(),
        stroke:cssv('--surface-1'), 'stroke-width':1.5}, s);
    }
    const st = stat(code);
    const lab = metricLabel(code);
    cell.innerHTML =
      '<div style="font-size:10px;font-weight:650;color:var(--text-secondary);line-height:1.3;text-transform:uppercase;letter-spacing:.04em;font-family:var(--font-mono);'+
        'height:27px;overflow:hidden" title="'+esc(lab)+'">'+esc(lab)+'</div>' +
      '<div style="font-size:15px;font-weight:650;letter-spacing:-.02em;margin:3px 0;font-family:var(--font-mono)">'+fmt(st.focus,unit)+'</div>';
    cell.appendChild(s);
    const foot = document.createElement('div');
    foot.style.cssText = 'font-size:10px;color:var(--muted);margin-top:4px;font-family:var(--font-mono);display:flex;'+
      'justify-content:space-between;gap:6px';
    foot.innerHTML = '<span>'+esc(BENCH_LABEL[S.benchmark])+' '+fmt(st.bench,unit)+'</span>' +
      '<span>'+(st.rank ? '#'+st.rank+'/'+st.n : '—')+'</span>';
    cell.appendChild(foot);
    cell.addEventListener('click', () => { S.primary = code; render(); });
    wrap.appendChild(cell);
  });
  return wrap;
}

/* ==========================================================================
   Deposit market share within one county
   ========================================================================== */
function chartShare(list, total, focusCert, W){
  W = W || 640;
  const rowH = CM.rowH, padT = CM.top - 4, padB = CM.bottom - 4;
  const rows = list.slice(0, 14);
  const rawNames = rows.map(r => (String(r.cert) === String(focusCert) ? '\u25b8 ' : '') + r.name);
  const L = clampN(Math.ceil(maxTextW(rawNames, 10.5, false)) + CM.pad, 110, Math.round(W*0.42));
  const names = rawNames.map(n => ellipsize(n, L - CM.pad, 10.5, false));
  const R = clampN(Math.ceil(maxTextW(rows.map(r => (r.share||0).toFixed(1)+'%'), 10, true))
                   + CM.pad + 6, 44, 110);
  const H = padT + rows.length*rowH + padB;
  const s = svgEl(W, H, 'Deposit market share by institution');
  if(!rows.length){ txt(s, W/2, H/2, 'No branch deposits reported', 'tick', null, 'middle'); return s; }

  const maxShare = Math.max.apply(null, rows.map(r => r.share || 0)) || 1;
  const xOf = v => L + (v/maxShare)*(W-L-R);

  for(const t of tickList(0, maxShare, 4, 'pct')){
    mk('line',{x1:xOf(t.v), x2:xOf(t.v), y1:padT, y2:H-padB, class:'gridline'}, s);
    txt(s, xOf(t.v), H-padB+13, t.lab, 'tick', null, 'middle');
  }
  mk('line',{x1:L, x2:L, y1:padT, y2:H-padB, class:'axisline'}, s);

  rows.forEach((r,i) => {
    const y = padT + i*rowH;
    const isF = String(r.cert) === String(focusCert);
    const color = isF ? FOCUS_COLOR() : PEER_COLOR();
    const nm = names[i];
    txt(s, L-CM.pad, y+rowH/2+4, nm, 'barlab',
      'fill:'+(isF?cssv('--text-primary'):cssv('--text-secondary'))+';font-weight:'+(isF?'650':'400'), 'end');
    const w = Math.max(1.5, xOf(r.share) - L);
    mk('rect',{x:L, y:y+3, width:w, height:rowH-8, rx:4, fill:color}, s);
    if(w > 6) mk('rect',{x:L, y:y+3, width:4, height:rowH-8, fill:color}, s);
    txt(s, xOf(r.share)+CM.pad, y+rowH/2+4, r.share.toFixed(1)+'%', 'dlab');

    const hit = mk('rect',{x:0, y:y, width:W, height:rowH, class:'hit'}, s);
    hit.addEventListener('mousemove', ev => tipShow(
      '<div class="tt">'+esc(r.name)+'</div>' +
      '<div class="tr"><span>Deposits</span><span>'+fmt(r.dep,'usd')+'</span></div>' +
      '<div class="tr"><span>Share of county</span><span>'+r.share.toFixed(2)+'%</span></div>' +
      '<div class="tr"><span>Rank</span><span>'+r.rank+' of '+list.length+'</span></div>' +
      '<div class="tr"><span>Branches</span><span>'+r.branches+'</span></div>' +
      '<div class="tfoot">Cert '+r.cert+'</div>', ev));
    hit.addEventListener('mouseleave', tipHide);
  });
  if(list.length > rows.length)
    txt(s, L-CM.pad, H-padB+13, 'plus '+(list.length-rows.length)+' smaller institutions', 'tick', null, 'end');
  return s;
}

/* ==========================================================================
   Share of a county over time
   ========================================================================== */
function chartShareTrend(series, label, W){
  W = W || 640;
  const H = clampN(Math.round(W*0.36), 214, 300);
  const T = CM.top, B = CM.bottom;
  const R = clampN(Math.ceil(textW('100.0%', 10, true)) + CM.endGap + 8, 56, 92);
  const s = svgEl(W, H, 'Deposit share over time');
  const pts = series.filter(x => x.share != null);
  if(pts.length < 2){ txt(s, W/2, H/2, 'Not enough years reported', 'tick', null, 'middle'); return s; }

  let lo = 0, hi = Math.max.apply(null, pts.map(x => x.share));
  hi = hi * 1.15;
  const ticksY = tickList(lo, hi, 5, 'pct');
  const L = axisGutter(ticksY);
  const xOf = i => L + i/(series.length-1)*(W-L-R);
  const yOf = v => T + (1-(v-lo)/(hi-lo))*(H-T-B);

  for(const t of ticksY){
    const y = yOf(t.v); if(y < T-1 || y > H-B+1) continue;
    mk('line',{x1:L, x2:W-R, y1:y, y2:y, class:'gridline'}, s);
    txt(s, L-CM.pad, y+4, t.lab, 'tick', null, 'end');
  }
  mk('line',{x1:L, x2:W-R, y1:H-B, y2:H-B, class:'axisline'}, s);
  const step = series.length > 12 ? 3 : series.length > 7 ? 2 : 1;
  series.forEach((x,i) => {
    if(i % step && i !== series.length-1) return;
    txt(s, xOf(i), H-B+14, String(x.year).slice(2), 'tick', null, 'middle');
  });

  let d = '', open = false;
  series.forEach((x,i) => {
    if(x.share == null){ open = false; return; }
    d += (open?' L ':' M ') + xOf(i).toFixed(1) + ' ' + yOf(x.share).toFixed(1);
    open = true;
  });
  mk('path',{d:d.trim(), fill:'none', stroke:FOCUS_COLOR(), 'stroke-width':2.5,
    'stroke-linecap':'round','stroke-linejoin':'round'}, s);
  series.forEach((x,i) => {
    if(x.share == null) return;
    mk('circle',{cx:xOf(i), cy:yOf(x.share), r:3.5, fill:FOCUS_COLOR(),
      stroke:cssv('--surface-1'), 'stroke-width':1.5}, s);
    const hit = mk('rect',{x:xOf(i)-12, y:T, width:24, height:H-T-B, class:'hit'}, s);
    hit.addEventListener('mousemove', ev => tipShow(
      '<div class="tt">30 June ' + x.year + '</div>' +
      '<div class="tr">'+tipKey(FOCUS_COLOR(), esc(label))+'<span>'+x.share.toFixed(2)+'%</span></div>' +
      '<div class="tr"><span>Its deposits</span><span>'+fmt(x.focus,'usd')+'</span></div>' +
      '<div class="tr"><span>County total</span><span>'+fmt(x.total,'usd')+'</span></div>', ev));
    hit.addEventListener('mouseleave', tipHide);
  });
  const last = pts[pts.length-1];
  const li = series.map(x => x.share).lastIndexOf(last.share);
  txt(s, xOf(li)+CM.endGap, yOf(last.share)+4, last.share.toFixed(1)+'%', null,
    'fill:'+FOCUS_COLOR()+';font-size:11px;font-weight:650');
  return s;
}

/* ==========================================================================
   Chart export
   ========================================================================== */
function svgMarkup(svg){
  const c = svg.cloneNode(true);
  c.setAttribute('xmlns','http://www.w3.org/2000/svg');
  c.setAttribute('width', c._w || svg._w || 640);
  c.setAttribute('height', c._h || svg._h || 400);
  /* inline the computed styles the stylesheet would otherwise supply */
  const css =
    '.tick{fill:'+cssv('--muted')+';font-size:10px;font-family:'+MONO_STACK+'}' +
    '.barlab{fill:'+cssv('--text-secondary')+';font-size:10px}' +
    '.dlab{fill:'+cssv('--text-primary')+';font-size:10px;font-family:'+MONO_STACK+'}' +
    '.gridline{stroke:'+cssv('--grid')+';stroke-width:1}' +
    '.axisline{stroke:'+cssv('--axis')+';stroke-width:1}' +
    '.hit{fill:transparent}' +
    'text{font-family:system-ui,-apple-system,sans-serif}';
  const st = document.createElementNS('http://www.w3.org/2000/svg','style');
  st.textContent = css;
  c.insertBefore(st, c.firstChild);
  const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
  bg.setAttribute('width','100%'); bg.setAttribute('height','100%');
  bg.setAttribute('fill', cssv('--surface-1'));
  c.insertBefore(bg, c.firstChild);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(c);
}
function downloadBlob(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function exportChartSvg(svg, name){
  downloadBlob(new Blob([svgMarkup(svg)], {type:'image/svg+xml;charset=utf-8'}), name + '.svg');
  toast('Saved ' + esc(name) + '.svg', 'ok');
}
function exportChartPng(svg, name){
  const w = (svg._w || 640) * 2, h = (svg._h || 400) * 2;
  const img = new Image();
  const svgBlob = new Blob([svgMarkup(svg)], {type:'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(svgBlob);
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = cssv('--surface-1');
    ctx.fillRect(0,0,w,h);
    ctx.drawImage(img,0,0,w,h);
    cv.toBlob(b => {
      URL.revokeObjectURL(url);
      if(!b){ toast('Could not render the PNG. The SVG download still works.','err'); return; }
      downloadBlob(b, name + '.png');
      toast('Saved ' + esc(name) + '.png', 'ok');
    }, 'image/png');
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Could not render the PNG. Try the SVG download.','err'); };
  img.src = url;
}
</script>
