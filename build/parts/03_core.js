<script>
"use strict";
/* ==========================================================================
   Peer Analytics — FDIC Call Report comparison
   Plain JavaScript. No frameworks, no CDN, no build step at runtime, no AI.
   Source: https://api.fdic.gov/banks   (public data; API key optional)
   ========================================================================== */

/* ##########################################################################

     CONFIGURATION — the only block you need to edit

     Everything below this block is machinery. If you want to change which
     bank the dashboard opens on, or which peer groups appear as one-click
     buttons, change it here and nowhere else.

     You do NOT have to edit code to change the peer group day to day. In the
     app: Peer group → Criteria (search by state, size, charter, specialisation)
     or → By name (search any FDIC-insured bank by name or cert number), tick
     what you want, then "Save current group" to keep it as your own button.
     Saved groups live in the browser and appear beside the built-in ones.

     Editing this block is only for changing the defaults everyone starts with.

     Bank identifiers are FDIC certificate numbers, not RSSD numbers. To find
     one: search the bank by name in the app, or look it up at
     https://banks.data.fdic.gov/bankfind-suite/bankfind

   ########################################################################## */

/* The institution the dashboard opens on, and whose newest filing sets the
   default reporting period. */
const DEFAULT_INSTITUTION = 16265;          /* Peoples Bank, Rock Valley, IA */

/* One-click peer groups. Add, remove or reorder freely.
     name  — the button label
     focus — the bank the group is built around (used only if none is chosen)
     certs — the peer banks, by FDIC certificate number
     note  — one line shown after the group loads                            */
const PEER_GROUPS = [
  {
    id:    'local',
    name:  'Northwest Iowa market',
    focus: DEFAULT_INSTITUTION,
    certs: [228, 13953, 34384, 8101, 4506, 5800, 57505, 235],
    note:  'Banks headquartered in Sioux, Lyon, O’Brien, Plymouth and Woodbury counties.'
  },
  {
    id:    'size',
    name:  'Iowa size peers ($600M–$2.5B)',
    focus: DEFAULT_INSTITUTION,
    certs: [14521, 15555, 253, 4433, 14207, 18272, 11771, 1552, 12855, 228, 5170, 13953],
    note:  'Active Iowa banks of comparable size that hold trust powers.'
  }
];

/* ######################## end of configuration ########################### */

/* ---- trust / fiduciary metrics, generated from the Call Report export ---- */
const TRUST_METRICS = /*__METRIC_CATALOG__*/[];

/* ---- core performance metrics, from the financials endpoint defaults ---- */
const CORE_METRICS = [
  {code:'ASSET',    label:'Total assets',                          cat:'Balance sheet', unit:'usd'},
  {code:'DEP',      label:'Total deposits',                        cat:'Balance sheet', unit:'usd'},
  {code:'COREDEP',  label:'Core deposits',                         cat:'Balance sheet', unit:'usd'},
  {code:'DEPINS',   label:'Estimated insured deposits',            cat:'Balance sheet', unit:'usd'},
  {code:'DEPUNINS', label:'Estimated uninsured deposits',          cat:'Balance sheet', unit:'usd'},
  {code:'LNLSNET',  label:'Net loans and leases',                  cat:'Balance sheet', unit:'usd'},
  {code:'LNLSGR',   label:'Total loans and leases, gross',         cat:'Balance sheet', unit:'usd'},
  {code:'SC',       label:'Total securities',                      cat:'Balance sheet', unit:'usd'},
  {code:'EQTOT',    label:'Total equity capital',                  cat:'Balance sheet', unit:'usd'},
  {code:'BKPREM',   label:'Premises and fixed assets',             cat:'Balance sheet', unit:'usd'},

  {code:'NETINC',   label:'Net income',                            cat:'Earnings', unit:'usd'},
  {code:'INTINC',   label:'Total interest income',                 cat:'Earnings', unit:'usd'},
  {code:'EINTEXP',  label:'Total interest expense',                cat:'Earnings', unit:'usd'},
  {code:'NIM',      label:'Net interest income',                   cat:'Earnings', unit:'usd'},
  {code:'NONII',    label:'Total noninterest income',              cat:'Earnings', unit:'usd'},
  {code:'NONIX',    label:'Total noninterest expense',             cat:'Earnings', unit:'usd'},
  {code:'ELNATR',   label:'Provision for credit losses',           cat:'Earnings', unit:'usd'},
  {code:'ITAX',     label:'Applicable income taxes',               cat:'Earnings', unit:'usd'},

  {code:'ROA',      label:'Return on assets',                      cat:'Performance ratios', unit:'pct'},
  {code:'ROAPTX',   label:'Pretax return on assets',               cat:'Performance ratios', unit:'pct'},
  {code:'ROE',      label:'Return on equity',                      cat:'Performance ratios', unit:'pct'},
  {code:'NIMY',     label:'Net interest margin',                   cat:'Performance ratios', unit:'pct'},
  {code:'EEFFR',    label:'Efficiency ratio',                      cat:'Performance ratios', unit:'pct'},
  {code:'NONIIAY',  label:'Noninterest income to average assets',  cat:'Performance ratios', unit:'pct'},
  {code:'NONIXAY',  label:'Noninterest expense to average assets', cat:'Performance ratios', unit:'pct'},
  {code:'INTINCY',  label:'Interest income to earning assets',     cat:'Performance ratios', unit:'pct'},
  {code:'INTEXPY',  label:'Interest expense to earning assets',    cat:'Performance ratios', unit:'pct'},
  {code:'LNLSDEPR', label:'Net loans and leases to deposits',      cat:'Performance ratios', unit:'pct'},
  {code:'IDERNCVR', label:'Earnings coverage of net charge-offs',  cat:'Performance ratios', unit:'num'},

  {code:'EQV',      label:'Equity capital to assets',              cat:'Capital', unit:'pct'},
  {code:'RBC1AAJ',  label:'Leverage (core capital) ratio',         cat:'Capital', unit:'pct'},
  {code:'IDT1RWAJR',label:'Tier 1 risk-based capital ratio',       cat:'Capital', unit:'pct'},
  {code:'RBCRWAJ',  label:'Total risk-based capital ratio',        cat:'Capital', unit:'pct'},
  {code:'RBCT1J',   label:'Tier 1 (core) capital',                 cat:'Capital', unit:'usd'},

  {code:'LNATRESR', label:'Loss allowance to loans',               cat:'Asset quality', unit:'pct'},
  {code:'LNATRES',  label:'Loan loss allowance',                   cat:'Asset quality', unit:'usd'},
  {code:'NTLNLSR',  label:'Net charge-offs to loans',              cat:'Asset quality', unit:'pct'},
  {code:'NTLNLS',   label:'Net charge-offs',                       cat:'Asset quality', unit:'usd'},
  {code:'NPERFV',   label:'Noncurrent assets plus OREO to assets', cat:'Asset quality', unit:'pct'},
  {code:'NCLNLSR',  label:'Noncurrent loans to loans',             cat:'Asset quality', unit:'pct'},
  /* NALTOT ("total noncurrent loans and leases") was withdrawn by the FDIC after
     30 June 2023 and returns null at every period since, so it is replaced by the
     two components that are still filed. Their sum is noncurrent, and it ties to
     NCLNLSR and NPERFV exactly. */
  {code:'NAASSET',  label:'Assets in nonaccrual status',           cat:'Asset quality', unit:'usd'},
  {code:'P9ASSET',  label:'Assets past due 90+ days, accruing',    cat:'Asset quality', unit:'usd'},
  {code:'ORE',      label:'Other real estate owned',               cat:'Asset quality', unit:'usd'},

  {code:'LNRE',     label:'Real estate loans, total',              cat:'Loan composition', unit:'usd'},
  {code:'LNAG',     label:'Agricultural production loans',         cat:'Loan composition', unit:'usd'},
  {code:'LNREAG',   label:'Farmland, secured by real estate',      cat:'Loan composition', unit:'usd'},
  {code:'LNCI',     label:'Commercial and industrial loans',       cat:'Loan composition', unit:'usd'},
  {code:'LNRENRES', label:'Nonfarm nonresidential real estate',    cat:'Loan composition', unit:'usd'},
  {code:'LNRERES',  label:'1-4 family residential real estate',    cat:'Loan composition', unit:'usd'},
  {code:'LNRECONS', label:'Construction and land development',     cat:'Loan composition', unit:'usd'},
  {code:'LNREMULT', label:'Multifamily residential real estate',   cat:'Loan composition', unit:'usd'},
  {code:'LNCON',    label:'Consumer loans',                        cat:'Loan composition', unit:'usd'},

  {code:'LNAGR',     label:'Agricultural production loans to total assets',     cat:'Loan concentration', unit:'pct'},
  {code:'LNREAGR',   label:'Farmland loans to total assets',                    cat:'Loan concentration', unit:'pct'},
  {code:'LNCIR',     label:'Commercial and industrial loans to total assets',   cat:'Loan concentration', unit:'pct'},
  {code:'LNRENRESR', label:'Nonfarm nonresidential loans to total assets',      cat:'Loan concentration', unit:'pct'},
  {code:'LNRERESR',  label:'1-4 family residential loans to total assets',      cat:'Loan concentration', unit:'pct'},
  {code:'LNRECONSR', label:'Construction and land development to total assets', cat:'Loan concentration', unit:'pct'},
  {code:'LNREMULTR', label:'Multifamily loans to total assets',                 cat:'Loan concentration', unit:'pct'},
  {code:'LNCONR',    label:'Consumer loans to total assets',                    cat:'Loan concentration', unit:'pct'},

  {code:'NUMEMP',   label:'Full-time equivalent employees',        cat:'Scale and structure', unit:'num'},
  {code:'OFFDOM',   label:'Domestic offices',                      cat:'Scale and structure', unit:'num'},
  {code:'ASSET5',   label:'Average assets',                        cat:'Scale and structure', unit:'usd'}
];

const ALL_METRICS = CORE_METRICS.concat(TRUST_METRICS);
const M_BY_CODE = Object.fromEntries(ALL_METRICS.map(m => [m.code, m]));

const CAT_ORDER = [
  'Balance sheet','Loan composition','Loan concentration','Earnings','Performance ratios',
  'Capital','Asset quality','Scale and structure',
  'Structure & Powers','Fiduciary Assets','Fiduciary Income','Account Counts',
  'Managed Assets','Non-Managed Assets','Collective Investment Funds','Losses & Recoveries'
];

/* Metrics always fetched, because the display transforms divide by them. */
const ALWAYS = ['ASSET','NUMEMP','OFFDOM','DEP','EQTOT','NETINC','LNLSGR'];

/* Ratios where a smaller number is the better result, so "above the benchmark"
   should not be painted green. Deliberately limited to ratios: for dollar
   amounts a bigger figure usually just means a bigger bank, which is a scale
   difference rather than a good or bad result. */
const LOWER_IS_BETTER = {
  EEFFR:1,      /* efficiency ratio — cost per dollar of revenue */
  NONIXAY:1,    /* noninterest expense to average assets */
  INTEXPY:1,    /* interest expense to earning assets */
  NTLNLSR:1,    /* net charge-offs to loans */
  NPERFV:1,     /* noncurrent assets plus OREO to assets */
  NCLNLSR:1     /* noncurrent loans to loans */
};
const betterDir = code => LOWER_IS_BETTER[code] ? -1 : 1;

/* Income and expense items are filed year-to-date, so Q1 restarts the count and
   Q4 holds twelve months. Plotted across quarters they step down every January,
   which reads as a collapse in earnings when it is only the reset. Balance-sheet
   items are point-in-time and carry across quarters cleanly. */
const YTD_FLOW_CATS = {'Earnings':1, 'Fiduciary Income':1, 'Losses & Recoveries':1};
function isYtdFlow(code){
  const m = M_BY_CODE[code];
  if(!m) return false;
  if(code === 'NTLNLS') return true;          /* charge-offs are a flow too */
  return !!YTD_FLOW_CATS[m.cat];
}
/* Months a year-to-date figure covers at a given report date: Q1 is three,
   Q4 is twelve. Reading a Q1 income figure as an annual one is the easiest
   mistake to make on an interim quarter. */
const ytdMonths = d => d ? Number(d.slice(4,6)) : 12;
const isYearEnd  = d => !!d && d.slice(4,6) === '12';

/* Call Report Schedule RC-T -- the whole trust and fiduciary section -- is filed
   once a year, every December, by every bank under the FDIC's quarterly
   threshold. For the quarters in between the API publishes a hard 0 rather than
   an empty field, so an untreated interim quarter shows a bank with $768M of
   fiduciary assets at year-end holding $0 in March. That is a filing convention,
   not a balance. See rctBlank(). */
const RCT_CATS = {'Structure & Powers':1, 'Fiduciary Assets':1, 'Fiduciary Income':1,
  'Account Counts':1, 'Managed Assets':1, 'Non-Managed Assets':1,
  'Collective Investment Funds':1, 'Losses & Recoveries':1};
const isRctItem = code => !!RCT_CATS[(M_BY_CODE[code] || {}).cat];
/* True when the plotted window mixes quarters, which is when the reset shows. */
function windowMixesQuarters(){
  const qs = {};
  S.activePeriods.forEach(d => qs[d.slice(4,6)] = 1);
  return Object.keys(qs).length > 1;
}

/* ---- starting metric sets ---- */
const METRIC_SETS = [
  {id:'exec',   name:'Executive summary', codes:[
    'ASSET','DEP','LNLSNET','EQTOT','NETINC','ROA','ROE','NIMY','EEFFR','EQV','LNLSDEPR','NPERFV']},
  {id:'perf',   name:'Performance', codes:[
    'ROA','ROAPTX','ROE','NIMY','EEFFR','NONIIAY','NONIXAY','INTINCY','INTEXPY','NETINC','NONII','NONIX']},
  {id:'balance',name:'Balance sheet', codes:[
    'ASSET','DEP','COREDEP','DEPINS','DEPUNINS','LNLSNET','LNLSGR','SC','EQTOT','LNLSDEPR']},
  {id:'risk',   name:'Credit & capital', codes:[
    'LNATRESR','NTLNLSR','NPERFV','NCLNLSR','NAASSET','P9ASSET','ORE','EQV','RBC1AAJ','IDT1RWAJR','RBCRWAJ']},
  {id:'loans',  name:'Loan mix', codes:[
    'LNLSGR','LNAG','LNREAG','LNCI','LNRENRES','LNRERES','LNRECONS','LNREMULT','LNCON',
    'LNAGR','LNCIR','NCLNLSR']},
  {id:'trusthi',name:'Trust highlights', codes:[
    'TFRA','TTMA','TTNMA','NFAA','TTNANUM','TTNMNUM','IFIDUC','TIP','TIMA','TIOR','TICS','TFEMA']},
  {id:'trustall',name:'Trust — full Call Report set', codes:null}   /* filled at runtime */
];

/* Built-in groups come from the configuration block at the top of this file;
   groups the user saves in the app are kept in the browser and merged in. */
function readSavedGroups(){
  try{
    const a = JSON.parse(store.get(LS.groups) || '[]');
    return Array.isArray(a) ? a : [];
  }catch(e){ return []; }
}
function writeSavedGroups(a){
  if(store.set(LS.groups, JSON.stringify(a))) return true;
  toast('Browser storage is full or blocked; the group was not saved.','err');
  return false;
}
const allPeerGroups = () => PEER_GROUPS.concat(readSavedGroups());

const SERIES_VARS = ['--series-1','--series-2','--series-3','--series-4','--series-5','--series-6'];
const API = 'https://api.fdic.gov/banks';
const LS = {key:'fdic.key', theme:'fdic.theme', cfgs:'fdic.configs', last:'fdic.last',
            groups:'fdic.groups'};

/* Reading localStorage is not safe to do bare. A managed workstation with
   third-party storage disabled, or some private-browsing configurations, make
   every access throw SecurityError rather than return null -- and one unguarded
   read during startup would leave the page blank with nothing to explain it.
   Everything that touches storage goes through here. */
const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); return true; }catch(e){ return false; } },
  del(k){ try{ localStorage.removeItem(k); return true; }catch(e){ return false; } },
  /* True when the browser will actually keep what we write. */
  available(){
    try{ localStorage.setItem('fdic.probe','1'); localStorage.removeItem('fdic.probe'); return true; }
    catch(e){ return false; }
  }
};

/* ==========================================================================
   State
   ========================================================================== */
const S = {
  apiKey:'',
  focus:null, peers:[], metrics:[], primary:null,
  repdte:null, nq:8, periods:[], activePeriods:[], fetchPeriods:[],
  fin:{}, inst:{}, vintage:null, lastRate:null,
  view:'overview', benchmark:'median', transform:'level', units:'auto',
  pinned:[], sortBy:null, sortDir:-1, tableFilter:'',
  scatterX:null, scatterY:null,
  built:false, dirty:false, building:false,
  market:{loaded:false, loading:false, error:null, year:null, counties:[], sel:null,
          countyRows:{}, trend:{}, branches:[], events:[]}
};

/* ==========================================================================
   Utilities
   ========================================================================== */
const $ = id => document.getElementById(id);
const qs = (s,r) => (r||document).querySelector(s);
const qsa = (s,r) => Array.from((r||document).querySelectorAll(s));
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

function debounce(fn,ms){
  let t; return function(){ const a=arguments,c=this; clearTimeout(t); t=setTimeout(()=>fn.apply(c,a),ms); };
}

/* -- number formatting ---------------------------------------------------- */
function fmt(v, unit){
  if(v==null || v==='' || !isFinite(v)) return '—';
  const n = Number(v);
  if(unit === 'pct') return (Math.abs(n)<100 ? n.toFixed(2) : n.toFixed(1)) + '%';
  if(unit === 'ratio') return n.toFixed(2) + '×';
  if(unit === 'usd'){
    const a = Math.abs(n), sg = n<0 ? '−' : '';
    const u = S.units;
    const grp = (x,dp) => x.toLocaleString(undefined,{minimumFractionDigits:dp, maximumFractionDigits:dp});
    if(u === 'raw') return sg + '$' + Math.round(a*1000).toLocaleString();
    if(u === 'k')   return sg + '$' + grp(Math.round(a),0) + 'K';
    if(u === 'm')   return sg + '$' + grp(a/1e3,2) + 'M';
    if(u === 'b')   return sg + '$' + grp(a/1e6,3) + 'B';
    if(a >= 1e6) return sg + '$' + (a/1e6).toFixed(2) + 'B';
    if(a >= 1e3) return sg + '$' + (a/1e3).toFixed(2) + 'M';
    if(a >= 1)   return sg + '$' + Math.round(a).toLocaleString() + 'K';
    return sg + '$' + Math.round(a*1000).toLocaleString();
  }
  if(Math.abs(n) < 1 && n !== 0) return n.toFixed(3);
  return Math.round(n).toLocaleString();
}
function fmtAxis(v, unit){
  if(v==null || !isFinite(v)) return '';
  const n = Number(v), a = Math.abs(n), sg = n<0 ? '−' : '';
  if(unit === 'pct')   return (a>=100 ? n.toFixed(0) : n.toFixed(a<1?2:1)) + '%';
  if(unit === 'ratio') return n.toFixed(1) + '×';
  if(unit === 'usd'){
    if(a >= 1e6) return sg + '$' + (a/1e6).toFixed(a/1e6>=10?0:1) + 'B';
    if(a >= 1e3) return sg + '$' + (a/1e3).toFixed(a/1e3>=10?0:1) + 'M';
    if(a >= 1)   return sg + '$' + Math.round(a) + 'K';
    return sg + '$0';
  }
  if(a >= 1e6) return sg + (a/1e6).toFixed(1) + 'M';
  if(a >= 1e3) return sg + (a/1e3).toFixed(a/1e3>=10?0:1) + 'k';
  if(a < 1 && a > 0) return n.toFixed(2);
  return String(Math.round(n));
}
/* A gap against the benchmark reads better as a multiple once it runs into the
   thousands of percent — "92×" rather than "+9,098%". */
function fmtDelta(d){
  if(d == null || !isFinite(d)) return null;
  if(Math.abs(d) < 0.05) return {t:'even', dir:0};
  if(Math.abs(d) < 1000) return {t:(d>0?'+':'−') + Math.abs(d).toFixed(1) + '%', dir:d>0?1:-1};
  const ratio = 1 + d/100;
  return {t:ratio.toFixed(ratio>=10?0:1) + '×', dir:1};
}

const prettyDate = d => d ? d.slice(4,6)+'/'+d.slice(6,8)+'/'+d.slice(0,4) : '—';
const qLabel = d => d ? 'Q'+Math.ceil(Number(d.slice(4,6))/3)+" '"+d.slice(2,4) : '';
const qLabelLong = d => d ? 'Q'+Math.ceil(Number(d.slice(4,6))/3)+' '+d.slice(0,4) : '';

/* -- statistics ----------------------------------------------------------- */
const clean = a => a.filter(x => x!=null && isFinite(x));
function median(a){
  const s = clean(a).sort((x,y)=>x-y);
  if(!s.length) return null;
  const m = s.length>>1;
  return s.length%2 ? s[m] : (s[m-1]+s[m])/2;
}
function mean(a){
  const s = clean(a);
  return s.length ? s.reduce((x,y)=>x+y,0)/s.length : null;
}
function quantile(a,q){
  const s = clean(a).sort((x,y)=>x-y);
  if(!s.length) return null;
  const p = (s.length-1)*q, lo = Math.floor(p), hi = Math.ceil(p);
  return lo===hi ? s[lo] : s[lo] + (s[hi]-s[lo])*(p-lo);
}
function pctRank(v, arr){
  const s = clean(arr);
  if(!s.length || v==null || !isFinite(v)) return null;
  const below = s.filter(x=>x<v).length, eq = s.filter(x=>x===v).length;
  return ((below + eq/2) / s.length) * 100;
}
function niceTicks(min,max,count){
  if(!isFinite(min) || !isFinite(max)) return [0];
  if(min===max){ min -= Math.abs(min||1)*0.5; max += Math.abs(max||1)*0.5; }
  const raw = (max-min)/Math.max(1,count);
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(raw)||1)));
  const norm = raw/mag;
  const step = (norm<=1?1:norm<=2?2:norm<=2.5?2.5:norm<=5?5:10)*mag;
  const out = []; let v = Math.ceil(min/step)*step;
  for(let i=0; i<200 && v <= max + step*1e-9; i++){ out.push(Number(v.toFixed(10))); v += step; }
  return out.length ? out : [min,max];
}

/* ==========================================================================
   Toasts, status, modal
   ========================================================================== */
const ICO = {
  ok:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  err:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5"/><circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r="1" fill="currentColor" stroke="none"/></svg>',
  warn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3.5 1.8 20.5h20.4z"/><path d="M12 9.5v5"/><circle cx="12" cy="17.6" r="1" fill="currentColor" stroke="none"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  expand:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/></svg>'
};
function toast(msg, kind, ms){
  const t = document.createElement('div');
  t.className = 'toast ' + (kind||'info');
  t.innerHTML = (ICO[kind==='ok'?'ok':kind==='err'?'err':'info']) + '<div>' + msg + '</div>';
  $('toasts').appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity .25s, transform .25s';
    t.style.opacity = '0'; t.style.transform = 'translateY(6px)';
    setTimeout(() => t.remove(), 260);
  }, ms || 3600);
}
function setStatus(el, msg, kind){ el.className = 'status show ' + (kind||'info'); el.innerHTML = msg; }
function clearStatus(el){ el.className = 'status'; el.innerHTML = ''; }

function modal(title, bodyHtml, buttons, opts){
  opts = opts || {};
  return new Promise(resolve => {
    const host = $('modalHost');
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML =
      '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="'+esc(title)+'">' +
        '<div class="modal-head"><h3>'+esc(title)+'</h3>' +
          '<button class="btn ghost sm" data-act="__close" style="margin-left:auto">'+ICO.x+'</button></div>' +
        '<div class="modal-body">'+bodyHtml+'</div>' +
        '<div class="modal-foot">' +
          (buttons||[{label:'Close',act:'__close'}]).map(b =>
            '<button class="btn '+(b.primary?'primary':'')+'" data-act="'+esc(b.act)+'">'+esc(b.label)+'</button>').join('') +
        '</div></div>';
    host.appendChild(bg);
    const done = v => { bg.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if(e.key === 'Escape') done(null); };
    document.addEventListener('keydown', onKey);
    bg.addEventListener('click', e => {
      if(e.target === bg) return done(null);
      const b = e.target.closest('[data-act]');
      if(!b) return;
      done(b.dataset.act === '__close' ? null : {act:b.dataset.act, root:bg});
    });
    /* Lets a caller drop live content — charts, for instance — into the body
       once the dialog is in the document and has a measurable width. */
    if(opts.onMount) opts.onMount(qs('.modal-body', bg), bg);
    const f = qs('input,select,textarea', bg);
    if(f) setTimeout(() => f.focus(), 30);
  });
}

/* ==========================================================================
   Tooltip
   ========================================================================== */
const TIP = $('tip');
function tipShow(html, ev){
  TIP.innerHTML = html;
  TIP.classList.add('on');
  const r = TIP.getBoundingClientRect();
  let x = ev.clientX + 15, y = ev.clientY + 15;
  if(x + r.width  > innerWidth  - 8) x = ev.clientX - r.width  - 15;
  if(y + r.height > innerHeight - 8) y = ev.clientY - r.height - 15;
  TIP.style.left = Math.max(6, x) + 'px';
  TIP.style.top  = Math.max(6, y) + 'px';
}
const tipHide = () => TIP.classList.remove('on');
const tipKey = (color,label) =>
  '<span class="tk"><span class="swatch" style="background:'+color+'"></span>'+esc(label)+'</span>';

/* ==========================================================================
   API
   ========================================================================== */
async function apiGet(path, params){
  const u = new URL(API + path);
  for(const k in params) if(params[k]!=null && params[k]!=='') u.searchParams.set(k, params[k]);
  const headers = {'Accept':'application/json'};
  if(S.apiKey) headers['X-Api-Key'] = S.apiKey;

  let res;
  try{
    res = await fetch(u.toString(), {headers});
  }catch(e){
    throw new Error('Could not reach api.fdic.gov. Check the internet connection, ' +
      'or whether a corporate proxy or firewall is blocking it.');
  }
  const rem = res.headers.get('X-Ratelimit-Remaining');
  if(rem != null) S.lastRate = rem;

  if(res.status === 403){
    let m = 'The API key was rejected.';
    try{ const j = await res.json(); if(j && j.error && j.error.message) m = j.error.message; }catch(e){}
    throw new Error(m + ' Clear the key field to fall back to public access.');
  }
  if(res.status === 429)
    throw new Error('FDIC rate limit reached. Wait about a minute, or add a free api.data.gov key.');
  if(res.status >= 500)
    throw new Error('The FDIC service returned an error (HTTP ' + res.status + '). This is on their end — try again shortly.');
  if(res.status === 401 || res.status === 403)
    throw new Error('The FDIC rejected the API key (HTTP ' + res.status + '). Use the key ' +
      'button in the header to correct it, or choose “Use anonymous” — the dashboard works ' +
      'without a key at a lower request limit.');
  if(!res.ok)
    throw new Error('FDIC API returned HTTP ' + res.status + '.');

  const j = await res.json();
  if(j && j.meta && j.meta.index && j.meta.index.createTimestamp) S.vintage = j.meta.index.createTimestamp;
  return j;
}
const unwrap = j => ((j && j.data) || []).map(r => r.data);
const certList = cs => 'CERT:(' + cs.join(' OR ') + ')';
const INST_FIELDS = 'CERT,NAME,CITY,STALP,COUNTY,ASSET,BKCLASS,ACTIVE,TRUST,OFFICES,NAMEHCR,ESTYMD,WEBADDR,SPECGRPN,ZIP';

async function searchInstitutions(term){
  const t = (term||'').trim();
  if(!t) return [];
  const p = {fields:INST_FIELDS, limit:'40', sort_by:'ASSET', sort_order:'DESC'};
  if(/^\d+$/.test(t)) p.filters = 'CERT:' + t;
  else p.search = 'NAME:' + t;
  return unwrap(await apiGet('/institutions', p));
}
async function findPeersByCriteria(c){
  const f = [];
  if(c.active) f.push('ACTIVE:1');
  if(c.states && c.states.length) f.push('STALP:(' + c.states.join(' OR ') + ')');
  if(c.min != null || c.max != null)
    f.push('ASSET:[' + (c.min != null ? c.min : 0) + ' TO ' + (c.max != null ? c.max : 999999999999) + ']');
  if(c.bkclass) f.push('BKCLASS:' + c.bkclass);
  if(c.spec)    f.push('SPECGRP:' + c.spec);
  if(c.trust)   f.push('NOT TRUST:00');
  const j = await apiGet('/institutions', {
    filters: f.join(' AND ') || 'ACTIVE:1',
    fields: INST_FIELDS, limit:'250', sort_by:'ASSET', sort_order:'DESC'
  });
  return {rows: unwrap(j), total: (j && j.meta && j.meta.total) || 0};
}
async function fetchInstitutions(certs){
  if(!certs.length) return {};
  const rows = unwrap(await apiGet('/institutions',
    {filters:certList(certs), fields:INST_FIELDS, limit:'500'}));
  const out = {};
  rows.forEach(r => out[String(r.CERT)] = r);
  return out;
}
async function fetchLatestPeriod(cert){
  const rows = unwrap(await apiGet('/financials',
    {filters:'CERT:'+cert, fields:'REPDTE', limit:'1', sort_by:'REPDTE', sort_order:'DESC'}));
  return rows.length ? rows[0].REPDTE : null;
}
async function fetchFinancials(certs, codes, from, to, onProgress){
  const out = {};
  const list = Array.from(new Set(codes.concat(ALWAYS)));
  const chunks = [];
  for(let i=0; i<list.length; i+=50) chunks.push(list.slice(i, i+50));
  if(!chunks.length) chunks.push([]);
  for(let i=0; i<chunks.length; i++){
    if(onProgress) onProgress(i, chunks.length);
    const rows = unwrap(await apiGet('/financials', {
      filters: certList(certs) + ' AND REPDTE:[' + from + ' TO ' + to + ']',
      fields: ['CERT','REPDTE'].concat(chunks[i]).join(','),
      limit:'10000', sort_by:'REPDTE', sort_order:'ASC'
    }));
    for(const r of rows){
      const c = String(r.CERT), d = r.REPDTE;
      if(!out[c]) out[c] = {};
      out[c][d] = Object.assign(out[c][d] || {}, r);
    }
    if(i < chunks.length-1) await new Promise(r => setTimeout(r, 110));
  }
  return out;
}

/* --------------------------------------------------------------------------
   Summary of Deposits and structural history.

   SOD is an annual survey taken every 30 June, so it lags the quarterly Call
   Report and is reported branch by branch rather than bank by bank. Market
   share is computed here from branch deposits, because the FDIC publishes the
   branch totals but not the share.
   -------------------------------------------------------------------------- */
const SOD_FIELDS = 'CERT,NAMEFULL,YEAR,BRNUM,NAMEBR,CITYBR,STALPBR,CNTYNAMB,STCNTYBR,DEPSUMBR,ADDRESBR';

async function fetchSodLatestYear(cert){
  const rows = unwrap(await apiGet('/sod', {filters:'CERT:'+cert, fields:'YEAR',
    limit:'1', sort_by:'YEAR', sort_order:'DESC'}));
  return rows.length ? Number(rows[0].YEAR) : null;
}
async function fetchSodBranches(cert, year){
  return unwrap(await apiGet('/sod', {filters:'CERT:'+cert+' AND YEAR:'+year,
    fields:SOD_FIELDS, limit:'2000', sort_by:'DEPSUMBR', sort_order:'DESC'}));
}
async function fetchCountySod(stcnty, fromYear, toYear){
  return unwrap(await apiGet('/sod', {
    filters:'STCNTYBR:' + stcnty + ' AND YEAR:[' + fromYear + ' TO ' + toYear + ']',
    fields:SOD_FIELDS, limit:'10000'}));
}
async function fetchHistory(cert){
  return unwrap(await apiGet('/history', {filters:'CERT:'+cert,
    fields:'CERT,EFFDATE,CHANGECODE_DESC,INSTNAME,ACQ_INSTNAME,OUT_INSTNAME,OUT_CNTYNAME',
    limit:'200', sort_by:'EFFDATE', sort_order:'DESC'}));
}
/* Branch rows rolled up to one line per institution, ranked by deposits. */
function rollupByCert(rows){
  const by = {};
  rows.forEach(r => {
    const c = String(r.CERT);
    if(!by[c]) by[c] = {cert:c, name:r.NAMEFULL || ('Cert ' + c), dep:0, branches:0};
    by[c].dep += Number(r.DEPSUMBR) || 0;
    by[c].branches += 1;
  });
  const list = Object.keys(by).map(k => by[k]).sort((a,b) => b.dep - a.dep);
  const total = list.reduce((a,b) => a + b.dep, 0);
  list.forEach((x,i) => { x.share = total ? x.dep/total*100 : null; x.rank = i+1; });
  return {list:list, total:total};
}

/* ==========================================================================
   Periods
   ========================================================================== */
function buildPeriods(latest){
  let yy = Number(latest.slice(0,4)), mm = Number(latest.slice(4,6));
  const out = [];
  for(let i=0; i<80; i++){
    const dd = (mm===6 || mm===9) ? '30' : '31';
    out.push(String(yy) + String(mm).padStart(2,'0') + dd);
    mm -= 3; if(mm < 3){ mm = 12; yy -= 1; }
  }
  return out;
}
/* n periods ending at `from`, oldest first */
function periodsBack(from, n){
  const i = S.periods.indexOf(from);
  if(i < 0) return [from];
  return S.periods.slice(i, i + n).reverse();
}

/* ==========================================================================
   Data access, transforms, statistics
   ========================================================================== */
function allCerts(){
  if(!S.focus) return [];
  const seen = new Set(), out = [];
  [S.focus].concat(S.peers).forEach(b => {
    const c = String(b.CERT);
    if(!seen.has(c)){ seen.add(c); out.push(c); }
  });
  return out;
}
const peerCerts = () => allCerts().filter(c => c !== String(S.focus.CERT));
const bankName = c => (S.inst[String(c)] && S.inst[String(c)].NAME) || ('Cert ' + c);
const shortName = (c,n) => { const s = bankName(c); return s.length > (n||22) ? s.slice(0,(n||22)-1) + '…' : s; };
const isInactive = c => String((S.inst[String(c)]||{}).ACTIVE) === '0';

/* Reads a field straight out of the fetched response, with no interpretation.
   Used by rctBlank(), which must not recurse through raw(). */
function field(cert, code, d){
  const rec = S.fin[String(cert)] && S.fin[String(cert)][d];
  if(!rec) return null;
  const v = rec[code];
  return (v == null || v === '' || !isFinite(v)) ? null : Number(v);
}
/* True when a zero should be read as "did not file this quarter" rather than as
   a balance of nothing: an RC-T item, at an interim quarter, for a bank that
   filed a real figure at the year-end anchoring this window. A bank with no
   trust business files zero in December too, so its zeros are left alone. */
function rctBlank(cert, code, d){
  if(isYearEnd(d) || !isRctItem(code)) return false;
  const P = S.fetchPeriods;
  for(let j = P.indexOf(d); j >= 0; j--){
    if(!isYearEnd(P[j])) continue;
    const y = field(cert, code, P[j]);
    return y != null && y !== 0;
  }
  return false;
}
/* raw reported value */
function raw(cert, code, dte){
  const d = dte || S.repdte;
  const v = field(cert, code, d);
  return (v === 0 && rctBlank(cert, code, d)) ? null : v;
}
/* period offset helper on the full fetched window */
function shift(dte, backQuarters){
  const i = S.fetchPeriods.indexOf(dte);
  if(i < 0) return null;
  const j = i - backQuarters;
  return j >= 0 ? S.fetchPeriods[j] : null;
}
/* Transformed value. Returns null when the transform cannot be computed —
   never a zero, because zero is a real reported figure. */
function val(cert, code, dte){
  const d = dte || S.repdte;
  const t = S.transform;
  if(t === 'level') return raw(cert, code, d);

  const m = M_BY_CODE[code];
  if(t === 'yoy' || t === 'qoq'){
    const back = t === 'yoy' ? 4 : 1;
    const prevD = shift(d, back);
    if(!prevD) return null;
    const a = raw(cert, code, d), b = raw(cert, code, prevD);
    if(a == null || b == null || b === 0) return null;
    return (a - b) / Math.abs(b) * 100;
  }
  if(t === 'pctloans'){
    /* Share of the loan book. The FDIC's own *R ratio fields divide by total
       assets instead, which answers a different question -- so both are offered
       and both are labelled for what they actually are. */
    if(m && m.unit === 'pct') return raw(cert, code, d);
    const a = raw(cert, code, d), g = raw(cert, 'LNLSGR', d);
    return (a == null || !g) ? null : a / g * 100;
  }
  if(t === 'pctassets'){
    if(m && m.unit === 'pct') return raw(cert, code, d);   /* already a ratio */
    const a = raw(cert, code, d), s = raw(cert, 'ASSET', d);
    return (a == null || !s) ? null : a / s * 100;
  }
  if(t === 'peremp' || t === 'peroff'){
    if(m && m.unit === 'pct') return raw(cert, code, d);
    const a = raw(cert, code, d);
    const den = raw(cert, t === 'peremp' ? 'NUMEMP' : 'OFFDOM', d);
    return (a == null || !den) ? null : a / den;
  }
  return raw(cert, code, d);
}
/* Unit of the displayed value after transform */
function unitOf(code){
  const m = M_BY_CODE[code];
  const base = m ? m.unit : 'num';
  const t = S.transform;
  if(t === 'yoy' || t === 'qoq') return 'pct';
  if(t === 'pctassets' || t === 'pctloans') return 'pct';
  if(t === 'peremp' || t === 'peroff') return base;
  return base;
}
const TRANSFORM_LABEL = {
  level:'reported value', yoy:'year-over-year change', qoq:'quarter-over-quarter change',
  pctassets:'percent of total assets', pctloans:'percent of gross loans',
  peremp:'per employee', peroff:'per office'
};
function metricLabel(code){
  const m = M_BY_CODE[code];
  return m ? m.label : code;
}
function metricTitle(code){
  const base = metricLabel(code);
  if(S.transform === 'level') return base;
  return base + ' — ' + TRANSFORM_LABEL[S.transform];
}

const peerVals = (code, dte) => peerCerts().map(c => val(c, code, dte)).filter(v => v != null);

const BENCH_LABEL = {median:'Peer median', mean:'Peer average',
  p75:'Peer 75th pct', p25:'Peer 25th pct', max:'Peer maximum'};
function benchOf(code, dte){
  const p = peerVals(code, dte);
  if(!p.length) return null;
  switch(S.benchmark){
    case 'mean': return mean(p);
    case 'p75':  return quantile(p, 0.75);
    case 'p25':  return quantile(p, 0.25);
    case 'max':  return Math.max.apply(null, p);
    default:     return median(p);
  }
}
function stat(code, dte){
  const f = val(S.focus.CERT, code, dte);
  const p = peerVals(code, dte);
  const b = benchOf(code, dte);
  const all = p.concat(f == null ? [] : [f]).sort((x,y) => y-x);
  return {
    focus:f, bench:b, peers:p,
    med: median(p), q1: quantile(p,0.25), q3: quantile(p,0.75),
    min: p.length ? Math.min.apply(null,p) : null,
    max: p.length ? Math.max.apply(null,p) : null,
    rank: f == null ? null : all.indexOf(f) + 1,
    n: all.length,
    pct: pctRank(f, p),
    delta: (f != null && b != null && b !== 0) ? (f - b) / Math.abs(b) * 100 : null,
    diff: (f != null && b != null) ? f - b : null
  };
}
function varies(code){
  const vs = allCerts().map(c => val(c, code)).filter(v => v != null);
  return new Set(vs).size > 1;
}
/* The headline charts are about the focus bank, so a metric it did not report
   makes an empty panel however much the peers vary. At an interim quarter that
   rules out most of the trust set, which is filed annually. */
const usableAsPrimary = code => varies(code) && val(S.focus.CERT, code) != null;
function pickPrimary(){
  const pref = ['ASSET','TFRA','NETINC','ROA','TTMA','IFIDUC','NFAA'];
  for(const p of pref) if(S.metrics.indexOf(p) >= 0 && usableAsPrimary(p)) return p;
  for(const c of S.metrics) if(usableAsPrimary(c)) return c;
  for(const c of S.metrics) if(varies(c)) return c;
  return S.metrics[0];
}
</script>
