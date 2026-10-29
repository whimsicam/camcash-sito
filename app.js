/* CAM Cash — sito. Legge data.enc.json (cifrato), calcola tutto nel browser. */
'use strict';

/* ------------------------------------------------------------------ costanti */
const COLORI_BASE = {
  'Housing': '#B8C0EC', 'Subscriptions': '#D4BBFC', 'Groceries': '#FDE293', 'Bar & Restaurant': '#F8B4D9',
  'Going Out': '#C3A6EE', 'Transport': '#A8DADC', 'Weekend & Travel': '#A9D4F5', 'Shopping': '#F9C9A8',
  'Health & Care': '#F3D9B1', 'Collectibles': '#C5E0B4', 'Gifts': '#F6C1C9', 'Admin': '#D9D4CB', 'Other': '#E8D5C4',
  'Altre spese': '#E2DCD0', 'PAC': '#9FD8B8', 'Investimenti extra': '#B9E3CC', 'In liquidità': '#EFE9DD',
  'Non ancora speso': '#EFE9DD'
};
const EXTRA = ['#BFD7F2', '#E4D1F5', '#CDE8D9', '#FBD9A6', '#D8E4B8', '#F2CFE6', '#C9E4EC'];
const COLORI = new Proxy(COLORI_BASE, { get: (t, k) => t[k] || EXTRA[[...String(k)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % EXTRA.length] });
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MESI_B = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const WT = 'Weekend & Travel';
const ICONE = {
  mese: '<svg viewBox="0 0 24 24" class="ico"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>',
  prec: '<svg viewBox="0 0 24 24" class="ico"><path d="M4.6 8.2A8.5 8.5 0 1 1 3.5 12"/><path d="M3.2 4.6v3.9h3.9"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>',
  conf: '<svg viewBox="0 0 24 24" class="ico"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6" fill="currentColor" fill-opacity=".35"/></svg>',
  anno: '<svg viewBox="0 0 24 24" class="ico" stroke="none" fill="currentColor">' +
    Array.from({ length: 12 }, (_, i) => { const a = i / 12 * 2 * Math.PI - Math.PI / 2; return `<circle cx="${(12 + 8.5 * Math.cos(a)).toFixed(2)}" cy="${(12 + 8.5 * Math.sin(a)).toFixed(2)}" r="${i === 0 ? 2.1 : 1.45}"/>`; }).join('') + '</svg>'
};
const CHEV = '<svg viewBox="0 0 24 24" class="chev ico"><path d="m6 9 6 6 6-6"/></svg>';
const TABS = [['mese', 'Mese'], ['prec', 'Mesi'], ['conf', 'Confronto'], ['anno', 'Anno']];

/* ------------------------------------------------------------------ formato */
function num(v, dec = 2) {
  const neg = v < 0, s = Math.abs(v).toFixed(dec);
  let [i, d] = s.split('.');
  i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '−' : '') + i + (dec ? ',' + d : '');
}
const eur = (v, dec = 2) => `<span class="eur">${num(v, dec)} €</span>`;
const eur0 = v => eur(v, 0);
const sgn = (v, dec = 0) => `<span class="eur">${v > 0 ? '+' : ''}${num(v, dec)} €</span>`;
const pct = (v, dec = 0) => `${num(v * 100, dec)}%`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const meseNome = k => { const [y, m] = k.split('-').map(Number); return MESI[m - 1]; };
const meseTit = k => { const [y, m] = k.split('-').map(Number); return MESI[m - 1][0].toUpperCase() + MESI[m - 1].slice(1) + ' ' + y; };

/* ------------------------------------------------------------------ date */
const ymd = s => s.split('-').map(Number);
const mk = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
const giorniMese = k => { const [y, m] = ymd(k); return new Date(y, m, 0).getDate(); };
const meseDi = s => s.slice(0, 7);
function sposta(k, n) { let [y, m] = ymd(k); m += n; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return mk(y, m); }
const dow = (y, m, d) => (new Date(y, m - 1, d).getDay() + 6) % 7; // 0 = lunedì

/* ------------------------------------------------------------------ stato */
let D = null;                // dati decifrati
let OGGI = null;             // 'YYYY-MM-DD'
let COSTI = [], VARIAB = [];
let stato = { tab: 'mese', confRif: 'prec', askCat: null };
try { stato = Object.assign(stato, JSON.parse(localStorage.getItem('camcash.ui') || '{}')); } catch (e) { }
function salvaUI() { try { localStorage.setItem('camcash.ui', JSON.stringify({ tab: stato.tab, confRif: stato.confRif, vistaCat: stato.vistaCat, viaggi: stato.viaggi, extra: stato.extra, aperti: stato.aperti || {} })); } catch (e) { } }

/* ------------------------------------------------------------------ calcoli */
// con/senza 13ª, 14ª e bonus (categoria Extra): utile e savings rate "ordinari"
const conExtra = () => stato.extra !== 'senza';
const entrateSR = a => conExtra() ? a.entrate : a.entrate - a.ricavi.Extra;
const GIFT = '<rect x="4.5" y="11" width="15" height="9" rx="1.6" fill="currentColor" stroke="none"/><rect x="3" y="7.5" width="18" height="4.2" rx="1.2" fill="currentColor" stroke="none"/><path d="M12 7.5c-1.2-3.2-5.2-3.6-5.2-1.6S10 7.5 12 7.5c2 0 5.2.4 5.2-1.6S13.2 4.3 12 7.5z" stroke-width="1.7"/>';
function segExtra(nessuno) {
  if (nessuno) return `<span class="seg ico2 seg-off" title="Nessun extra in questo mese" aria-label="Nessun extra in questo mese"><span class="b"><svg viewBox="0 0 24 24" class="ico">${GIFT}<path d="M3.5 20.5 20.5 3.5" stroke-width="2.4" stroke="#fff"/><path d="M3.5 20.5 20.5 3.5" stroke-width="1.6"/></svg></span></span>`;
  const c = conExtra();
  return `<div class="seg ico2" data-seg="extra"><button data-v="senza" title="Senza extra (13ª, 14ª, bonus)" aria-label="Senza extra" class="${c ? '' : 'on'}"><svg viewBox="0 0 24 24" class="ico">${GIFT}<path d="M3.5 20.5 20.5 3.5" stroke-width="2.4" stroke="#fff"/><path d="M3.5 20.5 20.5 3.5" stroke-width="1.6"/></svg></button><button data-v="con" title="Con extra (13ª, 14ª, bonus)" aria-label="Con extra" class="${c ? 'on' : ''}"><svg viewBox="0 0 24 24" class="ico">${GIFT}</svg></button></div>`;
}
// aggregato di un mese di competenza fino al giorno `fino` (incluso)
function agg(k, fino = 31) {
  const r = { spese: {}, ricavi: { Salary: 0, Extra: 0, 'Other Revenues': 0 }, pac: 0, invExtra: 0, giorno: {} };
  COSTI.forEach(c => r.spese[c] = 0);
  const [y, m] = ymd(k), n = giorniMese(k);
  for (const t of D.tx) {
    if (t[1] !== k) continue;
    const md = meseDi(t[0]);
    let g = md < k ? 1 : md > k ? n : ymd(t[0])[2];
    if (g > fino) continue;
    const [, , cat, sub, imp] = t;
    if (cat in r.spese) { r.spese[cat] -= imp; if (cat !== WT) r.giorno[g] = (r.giorno[g] || 0) - imp; }
    else if (cat in r.ricavi) r.ricavi[cat] += imp;
    else if (cat === 'Investments') { if (sub === 'PAC') r.pac -= imp; else r.invExtra -= imp; }
  }
  r.costi = COSTI.reduce((s, c) => s + r.spese[c], 0);
  r.costiNoWT = r.costi - r.spese[WT];
  r.entrate = r.ricavi.Salary + r.ricavi.Extra + r.ricavi['Other Revenues'];
  r.utile = r.entrate - r.costi;
  return r;
}
function budget(k) { return D.budget[k] || {}; }
function budgetCosti(k, conWT = true) { const b = budget(k); return COSTI.reduce((s, c) => s + (c === WT && !conWT ? 0 : (b[c] || 0)), 0); }

// spese quotidiane per data effettiva (costi variabili senza viaggi), per heatmap e giorni della settimana
function spesaGiorni(dal, al) {
  const out = {};
  for (const t of D.tx) {
    if (t[0] < dal || t[0] > al || !VARIAB.includes(t[2])) continue;
    out[t[0]] = (out[t[0]] || 0) - t[4];
  }
  return out;
}

// stato del mese: aperto (mese di oggi), importato?, giorno a cui arrivano i dati
function infoMese(k) {
  const dal = D.data_al, kd = meseDi(dal), n = giorniMese(k);
  const corrente = k === meseDi(OGGI);
  const fino = k < kd ? n : k === kd ? ymd(dal)[2] : 0;
  return { k, n, corrente, fino, importato: fino > 0, chiuso: !corrente && fino === n };
}

/* ------------------------------------------------------------------ svg helpers */
const svg = (w, h, inner, cls = '') => `<svg viewBox="0 0 ${w} ${h}" width="100%" class="${cls}" style="display:block;overflow:visible">${inner}</svg>`;
function larghezza(sel, def = 340) { const el = document.querySelector(sel); return el ? Math.max(260, Math.floor(el.clientWidth)) : def; }

/* donut: spicchi con angoli arrotondati e stacchi fissi, senza sovrapposizioni */
function donut(items, centro, size = 230) {
  const tot = items.reduce((s, i) => s + i.v, 0) || 1;
  const c = size / 2, R0 = size / 2 - 4, th = 32, r0 = R0 - th, rm = (R0 + r0) / 2, gap = 6;
  const P = (r, a) => `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`;
  let a = 0, segs = '';
  for (const it of items) {
    const span = it.v / tot * 2 * Math.PI, arc = span * rm - gap;
    if (arc <= 0.5) { a += span; continue; }
    const cr = Math.min(8, arc / 2 - 0.2, th / 2 - 0.5);          // raggio degli angoli
    const R = R0 - cr, r = r0 + cr, d = (gap / 2 + cr) / rm;        // forma ridotta, poi "gonfiata" dal tratto
    const a0 = a + d, a1 = a + span - d, big = a1 - a0 > Math.PI ? 1 : 0;
    const path = a1 > a0
      ? `M${P(R, a0)} A${R} ${R} 0 ${big} 1 ${P(R, a1)} L${P(r, a1)} A${r} ${r} 0 ${big} 0 ${P(r, a0)} Z`
      : `M${P(R, (a0 + a1) / 2)} L${P(r, (a0 + a1) / 2)}`;
    segs += `<path d="${path}" fill="${it.c}" stroke="${it.c}" stroke-width="${2 * cr}" stroke-linejoin="round" stroke-linecap="round"/>`;
    a += span;
  }
  const testo = `<text x="${c}" y="${c - 24}" text-anchor="middle" style="font-size:11px;font-weight:600;fill:#8B867D;letter-spacing:.06em">${esc(centro.label)}</text>
    <text x="${c}" y="${c}" text-anchor="middle" dominant-baseline="central" style="font-size:26px;font-weight:800;fill:#1C1B1B;letter-spacing:-.03em">${esc(centro.big)}</text>
    <text x="${c}" y="${c + 30}" text-anchor="middle" style="font-size:12px;font-weight:400;fill:#55524C">${esc(centro.sub)}</text>`;
  return svg(size, size, segs + testo, 'donut').replace('width="100%"', `width="${size}"`);
}

/* sankey verticale: una barra di entrate in alto che si apre verso le destinazioni */
function sankey(w, entrateLbl, entrate, dest) {
  const tot = dest.reduce((s, d) => s + d.v, 0) || 1;
  const pillH = 40, y0 = pillH, y1 = 186, yE = 200, gap = 6, H = yE;
  const usable = w - gap * (dest.length - 1), src = w * 0.62;
  let xs = (w - src) / 2, xd = 0, ribbons = '', nodes = '';
  dest.forEach(d => {
    const ws = d.v / tot * src, wd = Math.max(d.v / tot * usable, 3);
    const a0 = xs, a1 = xs + ws, b0 = xd, b1 = xd + wd, ym = (y0 + y1) / 2;
    const rr = Math.min(5, (b1 - b0) / 2);
    ribbons += `<path d="M${a0} ${y0} C${a0} ${ym} ${b0} ${ym} ${b0} ${y1} L${b0} ${yE - rr} Q${b0} ${yE} ${b0 + rr} ${yE} L${b1 - rr} ${yE} Q${b1} ${yE} ${b1} ${yE - rr} L${b1} ${y1} C${b1} ${ym} ${a1} ${ym} ${a1} ${y0} Z" fill="${d.c}"/>`;
    xs = a1; xd = b1 + gap;
  });
  const pill = `<rect x="0" y="0" width="${w}" height="${pillH}" rx="${pillH / 2}" fill="#1C1B1B"/>
    <text x="18" y="${pillH / 2 + 5}" style="font-size:14px;font-weight:700;fill:#fff">${esc(entrateLbl)}</text>
    <text x="${w - 18}" y="${pillH / 2 + 5}" text-anchor="end" style="font-size:15px;font-weight:800;fill:#fff">${num(entrate)} €</text>`;
  const legenda = `<div class="legend flow">${dest.map(d => `<div><i class="dot" style="background:${d.c}"></i><span class="n">${esc(d.l)}${d.over ? ` <span class="chip coral sm">+${num(d.over, 0)}\u00A0€</span>` : ''}</span><span class="v">${eur0(d.v)}</span></div>`).join('')}</div>`;
  return svg(w, H, ribbons + nodes + pill) + legenda;
}

/* linea cumulata vs budget */
function ritmo(w, n, punti, budgetTot, opts = {}) {
  const h = 170, padL = 4, padR = 8, padT = 26, padB = 22;
  const maxY = Math.max(budgetTot, ...punti.map(p => p[1]), opts.rif ? Math.max(...opts.rif.map(p => p[1])) : 0) * 1.08 || 1;
  const X = g => padL + (g - 1) / (n - 1) * (w - padL - padR), Y = v => padT + (1 - v / maxY) * (h - padT - padB);
  let s = '';
  [0.25, 0.5, 0.75, 1].forEach(f => s += `<line x1="${padL}" x2="${w - padR}" y1="${Y(maxY * f / 1.08)}" y2="${Y(maxY * f / 1.08)}" stroke="#EEE7DC"/>`);
  if (budgetTot) s += `<line x1="${X(1)}" y1="${Y(budgetTot / n)}" x2="${X(n)}" y2="${Y(budgetTot)}" stroke="#8B867D" stroke-width="2" stroke-dasharray="5 6"/>
    <text x="${X(n)}" y="${Math.min(Y(budgetTot) + 18, h - padB - 4)}" text-anchor="end" class="lbl">budget ${num(budgetTot, 0)} €</text>`;
  if (opts.rif && opts.rif.length) s += `<polyline points="${opts.rif.map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}" fill="none" stroke="#C3A6EE" stroke-width="2.5" stroke-linejoin="round"/>`;
  if (punti.length) {
    const pl = punti.map(p => `${X(p[0])},${Y(p[1])}`).join(' ');
    const last = punti[punti.length - 1];
    s += `<defs><linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1C1B1B" stop-opacity=".10"/><stop offset="1" stop-color="#1C1B1B" stop-opacity="0"/></linearGradient></defs>
      <polygon points="${X(punti[0][0])},${Y(0)} ${pl} ${X(last[0])},${Y(0)}" fill="url(#ga)"/>
      <polyline points="${pl}" fill="none" stroke="#1C1B1B" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${X(last[0])}" cy="${Y(last[1])}" r="5.5" fill="#fff" stroke="#1C1B1B" stroke-width="2.5"/>`;
    if (opts.etichetta) {
      const tw = opts.etichetta.length * 6.6 + 18, tx = Math.min(Math.max(X(last[0]) - tw / 2, 0), w - tw);
      s += `<rect x="${tx}" y="${Math.max(Y(last[1]) - 34, 0)}" width="${tw}" height="22" rx="11" fill="#1C1B1B"/>
        <text x="${tx + tw / 2}" y="${Math.max(Y(last[1]) - 34, 0) + 15}" text-anchor="middle" style="font-size:11.5px;font-weight:700;fill:#fff">${esc(opts.etichetta)}</text>`;
    }
  }
  const ticks = [1, 10, 20, n];
  ticks.forEach(g => s += `<text x="${X(g)}" y="${h - 4}" text-anchor="${g === 1 ? 'start' : g === n ? 'end' : 'middle'}" class="lbl">${g}</text>`);
  return svg(w, h, s);
}

/* ------------------------------------------------------------------ legende con simboli */
function chiave(voci) {
  const sym = (t, c) => {
    const st = c || '#1C1B1B';
    if (t === 'linea') return `<svg width="20" height="10"><line x1="1" y1="5" x2="19" y2="5" stroke="${st}" stroke-width="2.6" stroke-linecap="round"/></svg>`;
    if (t === 'tratt') return `<svg width="20" height="10"><line x1="1" y1="5" x2="19" y2="5" stroke="${c || '#8B867D'}" stroke-width="2" stroke-dasharray="4 3"/></svg>`;
    if (t === 'tacca') return `<svg width="10" height="12"><line x1="5" y1="1" x2="5" y2="11" stroke="${st}" stroke-width="2.5" stroke-linecap="round"/></svg>`;
    if (t === 'trattino') return `<svg width="16" height="10"><line x1="2" y1="5" x2="14" y2="5" stroke="${st}" stroke-width="2.4" stroke-linecap="round"/></svg>`;
    if (t === 'chip') return `<span class="chip coral sm">+€</span>`;
    return `<i style="display:inline-block;width:16px;height:8px;border-radius:99px;background:${c}"></i>`;
  };
  return `<div class="key">${voci.map(([t, c, l]) => `<span>${sym(t, c)}${l}</span>`).join('')}</div>`;
}

/* ------------------------------------------------------------------ componenti */
function card(html, cls = '') { return `<section class="card ${cls}">${html}</section>`; }
function acc(id, titolo, chip, body, cls = '') {
  const aperti = stato.aperti || {};
  const open = aperti[id] ? 'open' : '';
  return `<details class="card ${cls}" data-id="${id}" ${open}><summary><div class="t"><h3>${titolo}</h3></div>${chip || ''}${CHEV}</summary><div class="body">${body}</div></details>`;
}

function sintesiCategorie(a, k) {
  const b = budget(k);
  return COSTI.map(c => ({ c, v: a.spese[c], b: b[c] || 0 })).filter(x => Math.abs(x.v) > 0.004 || x.b > 0);
}

function cardCategorie(a, k, id) {
  const conV = stato.viaggi === 'con';
  const righe = sintesiCategorie(a, k).filter(r => conV || r.c !== WT);
  const tot = righe.reduce((s, r) => s + Math.max(r.v, 0), 0), btot = righe.reduce((s, r) => s + r.b, 0);
  // donut: categorie sotto il 3% raccolte in "Altre spese"
  const items = [], piccole = { c: 'Altre spese', v: 0 };
  righe.filter(r => r.v > 0).sort((x, y) => y.v - x.v).forEach(r => (r.v / tot < 0.03 ? piccole.v += r.v : items.push({ c: COLORI[r.c], v: r.v })));
  if (piccole.v > 0) items.push({ c: COLORI['Altre spese'], v: piccole.v });
  const centro = { label: 'SPESO', big: `${num(tot, 0)}\u00A0€`, sub: btot ? pct(tot / btot) + ' del budget' : '' };
  const lista = righe.slice().sort((x, y) => y.v - x.v).map(r => {
    const d = r.v - r.b, over = r.b > 0 ? d > 0.5 : r.v > 0.5;
    return `<div class="cg"><div class="l1"><i class="dot" style="background:${COLORI[r.c]}"></i><span class="n">${esc(r.c)}</span><span class="a">${eur0(r.v)}</span></div>
      <div class="l2">${over ? `<span class="chip coral sm">+${num(d, 0)} €</span>` : '<span></span>'}<small>su ${eur0(r.b)}</small></div></div>`;
  }).join('');
  const BM = 70; // posizione della tacca del budget (% della larghezza), uguale per tutte
  const barre = righe.slice().sort((x, y) => y.v - x.v).map(r => {
    const v = Math.max(r.v, 0), over = v - r.b;
    let dentro, fuori;
    if (r.b > 0) { dentro = Math.min(v, r.b) / r.b * BM; fuori = over > 0 ? Math.min(over / r.b * BM, 100 - BM) : 0; }
    else { dentro = 0; fuori = v > 0 ? Math.min(v / 100 * BM, 100) : 0; }
    return `<div class="bar-row"><div class="top"><span>${esc(r.c)}</span><span class="v">${over > 0.5 ? `<span class="chip coral sm">+${num(over, 0)} €</span> ` : ''}${eur0(r.v)} <small>/ ${eur0(r.b)}</small></span></div>
      <div class="bar-track">${dentro ? `<div class="fill" style="width:${dentro}%;background:${COLORI[r.c]}"></div>` : ''}
      ${fuori ? `<div class="fill over" style="left:${r.b > 0 ? BM : 0}%;width:${fuori}%"></div>` : ''}
      <div class="mark" style="left:calc(${r.b > 0 ? BM : 0}% - 1px)"></div></div></div>`;
  }).join('') + `<div class="bar-key"><span><i class="mk"></i>budget</span><span><i class="sw" style="background:var(--coral)"></i>oltre il budget</span></div>`;
  const vista = (stato.vistaCat || 'donut');
  return card(`<div class="card-head"><div><h3>Ripartizione spese</h3><div class="card-sub nowrap">Budget ${eur0(btot)} · ${conV ? 'con' : 'senza'} viaggi</div></div>
    <div class="toggles"><div class="seg ico2" data-seg="vistaCat"><button data-v="donut" title="Ciambella" aria-label="Ciambella" class="${vista === 'donut' ? 'on' : ''}"><svg viewBox="0 0 24 24" class="ico"><circle cx="12" cy="12" r="7.5" stroke-width="3.2" stroke-dasharray="14 3.5"/></svg></button><button data-v="barre" title="Barre" aria-label="Barre" class="${vista === 'barre' ? 'on' : ''}"><svg viewBox="0 0 24 24" class="ico"><path d="M5 7h14M5 12h9M5 17h11" stroke-width="2.6"/></svg></button></div>
    <div class="seg ico2" data-seg="viaggi"><button data-v="senza" title="Senza viaggi" aria-label="Senza viaggi" class="${conV ? '' : 'on'}"><svg viewBox="0 0 24 24" class="ico"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="currentColor" stroke="none"/><path d="M3.5 20.5 20.5 3.5" stroke-width="2.4" stroke="#fff" /><path d="M3.5 20.5 20.5 3.5" stroke-width="1.6"/></svg></button><button data-v="con" title="Con viaggi" aria-label="Con viaggi" class="${conV ? 'on' : ''}"><svg viewBox="0 0 24 24" class="ico"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="currentColor" stroke="none"/></svg></button></div></div></div>
    ${vista === 'donut' ? `<div class="donut-wrap">${donut(items, centro)}</div><div class="cat-grid">${lista}</div>` : `<div class="bars-list">${barre}</div>`}`, 's7');
}

function datiRitmo(a, info) {
  const pts = []; let c = 0;
  for (let g = 1; g <= info.fino; g++) {
    c += a.giorno[g] || 0; pts.push([g, c]);
  }
  return pts;
}

function cardRitmo(a, info, id) {
  const bud = budgetCosti(info.k, false);
  const pts = datiRitmo(a, info);
  const speso = pts.length ? pts[pts.length - 1][1] : 0;
  const atteso = bud * info.fino / info.n, diff = speso - atteso;
  const chip = info.fino ? `<span class="chip ${diff > 0 ? 'coral' : 'mint'}">${diff > 0 ? '+' : '−'}${num(Math.abs(diff), 0)} € ${diff > 0 ? 'sopra il ritmo' : 'sotto il ritmo'}</span>` : '';
  return acc(id, 'Ritmo di spesa', chip,
    `<div class="panel" data-w="${id}">${ritmo(larghezza(`[data-w="${id}"]`) - 28, info.n, pts, bud, { etichetta: info.fino ? `${info.fino} ${MESI_B[ymd(info.k)[1] - 1].toLowerCase()} · ${num(speso, 0)} €` : '' })}</div>
     ${chiave([['linea', '', 'spesa cumulata'], ['tratt', '', 'budget del mese']])}<div class="note">Viaggi esclusi (Fondo viaggi).</div>`, 's5');
}

function destinazioni(a, k, aperto) {
  const b = budget(k);
  const cats = COSTI.map(c => ({ c, v: a.spese[c] })).filter(x => x.v > 0.5).sort((x, y) => y.v - x.v);
  const top = cats.slice(0, 5), resto = cats.slice(5).reduce((s, x) => s + x.v, 0);
  const dest = top.map(x => ({ l: x.c, v: x.v, c: COLORI[x.c], over: (b[x.c] || 0) > 0 && x.v > (b[x.c] || 0) + 0.5 ? x.v - b[x.c] : 0 }));
  if (resto > 0.5) dest.push({ l: 'Altre spese', v: resto, c: COLORI['Altre spese'] });
  if (a.pac > 0.5) dest.push({ l: 'PAC', v: a.pac, c: COLORI.PAC });
  if (a.invExtra > 0.5) dest.push({ l: 'Investimenti extra', v: a.invExtra, c: COLORI['Investimenti extra'] });
  return dest;
}

function cardFlusso(a, info, id, titoloPeriodo) {
  let entrate = a.entrate, lbl = 'Entrate', atteso = false;
  const comp = [];
  if (a.ricavi.Salary > 0) comp.push('stipendio'); if (a.ricavi.Extra > 0) comp.push('extra'); if (a.ricavi['Other Revenues'] > 0) comp.push('altre entrate');
  if (info.corrente && a.ricavi.Salary <= 0 && D.stipendio_atteso) { entrate += D.stipendio_atteso; atteso = true; comp.unshift('stipendio atteso'); }
  if (comp.length === 1) lbl = comp[0][0].toUpperCase() + comp[0].slice(1);
  const dest = destinazioni(a, info.k);
  const usciti = dest.reduce((s, d) => s + d.v, 0);
  const resto = entrate - usciti;
  let chip;
  if (resto >= 0.5) { dest.push({ l: info.corrente ? 'Non ancora speso' : 'In liquidità', v: resto, c: COLORI['In liquidità'] }); chip = `<span class="chip mint">${num(resto, 0)} € ${info.corrente ? 'non spesi' : 'in liquidità'}</span>`; }
  else { entrate = usciti; lbl = comp.length === 1 ? lbl + ' + liquidità' : 'Entrate + liquidità'; chip = `<span class="chip coral">${num(-resto, 0)} € dalla liquidità</span>`; }
  const w = larghezza(`[data-w="${id}"]`) - 28;
  return acc(id, 'Dove vanno i soldi', chip,
    `<div class="panel" data-w="${id}">${sankey(w, lbl, entrate, dest)}</div>
     <div class="note">${atteso ? 'Lo stipendio del mese non è ancora arrivato: uso quello atteso (' + num(D.stipendio_atteso, 0) + ' €). ' : ''}Le prime 5 categorie per spesa, le altre raccolte in "Altre spese".</div>${chiave([['chip', '', 'quanto la categoria è sopra budget']])}`, 's7');
}

function colore(v, max) {
  if (v <= 0.004) return '#FFFDF8';
  const scala = ['#FFF1C2', '#FDE293', '#F9C9A8', '#F8B4D9', '#E996C4'];
  return scala[Math.min(scala.length - 1, Math.floor(v / max * scala.length * 0.999))];
}
function legendaScala(max) {
  return `<div class="scale">0 € <i style="background:#FFFDF8;border:1px solid #EEE7DC"></i>${['#FFF1C2', '#FDE293', '#F9C9A8', '#F8B4D9', '#E996C4'].map(c => `<i style="background:${c}"></i>`).join('')} ${num(max, 0)} €+</div>`;
}

function cardCalendario(info, id) {
  const [y, m] = ymd(info.k);
  const dal = `${info.k}-01`, al = `${info.k}-${String(info.n).padStart(2, '0')}`;
  const g = spesaGiorni(dal, al);
  const vals = Object.values(g), max = Math.max(60, ...vals.map(v => Math.min(v, 200)));
  const vuoti = Array.from({ length: info.fino }, (_, i) => g[`${info.k}-${String(i + 1).padStart(2, '0')}`] || 0).filter(v => v <= 0.004).length;
  let cells = GIORNI.map(d => `<div class="h">${d[0]}</div>`).join('');
  for (let i = 0; i < dow(y, m, 1); i++) cells += '<div class="d empty"></div>';
  for (let d = 1; d <= info.n; d++) {
    const key = `${info.k}-${String(d).padStart(2, '0')}`, v = g[key] || 0;
    if (d > info.fino) { cells += `<div class="d future">${d}</div>`; continue; }
    cells += `<div class="d ${info.corrente && d === info.fino ? 'today' : ''}" style="background:${colore(v, max)}" title="${num(v)} €">${d}<small>${v > 0.004 ? num(v, 0) : ''}</small></div>`;
  }
  return acc(id, 'Calendario delle spese', `<span class="chip">${vuoti} giorni a zero</span>`,
    `<div class="panel"><div class="cal">${cells}</div>${legendaScala(max)}</div>
     <div class="note">Spese quotidiane per data: costi variabili, senza affitto, abbonamenti e viaggi.</div>`, 's5');
}

function cardSettimana(info, id) {
  const dal = `${info.k}-01`, al = `${info.k}-${String(Math.max(info.fino, 1)).padStart(2, '0')}`;
  const g = spesaGiorni(dal, al), [y, m] = ymd(info.k);
  const tot = Array(7).fill(0), cnt = Array(7).fill(0);
  for (let d = 1; d <= info.fino; d++) { const w = dow(y, m, d); cnt[w]++; tot[w] += g[`${info.k}-${String(d).padStart(2, '0')}`] || 0; }
  const media = tot.map((t, i) => cnt[i] ? t / cnt[i] : 0), max = Math.max(...media, 1), pk = media.indexOf(Math.max(...media));
  const cols = media.map((v, i) => `<div class="c"><span class="v">${num(v, 0)} €</span><div class="b ${i === pk ? 'peak' : ''}" style="height:${Math.max(v / max * 100, 6)}%"></div><span class="l">${GIORNI[i]}</span></div>`).join('');
  return acc(id, 'Giorni della settimana', `<span class="chip">Picco: ${GIORNI[pk].toLowerCase()}</span>`,
    `<div class="panel"><div class="wk">${cols}</div></div><div class="note">Spesa media per giorno della settimana nel mese (stesse spese del calendario).</div>`, 's7');
}

/* ------------------------------------------------------------------ viste */
// due colonne su desktop; su telefono una sola colonna nell'ordine dato da `o`
function colonne(sx, dx, sotto = '') {
  const it = a => a.map(([o, h]) => `<div class="it" style="order:${o}">${h}</div>`).join('');
  return `<div class="cols"><div class="col l">${it(sx)}</div><div class="col r">${it(dx)}</div></div>${sotto}`;
}
function headPagina(eyebrow, titolo, chips = '') {
  return `<div class="page-head"><div class="eyebrow">${eyebrow}</div><h1>${titolo}</h1><div class="sub">${chips}</div></div>`;
}
const chipDati = () => `<span class="chip">dati al ${D.data_al.split('-').reverse().slice(0, 2).join('/')}</span>`;

// entrate e spese del mese + barra dello stipendio (spese / investito / resto)
function soldiMese(a, info) {
  let ent = a.entrate, att = false;
  if (info.corrente && a.ricavi.Salary <= 0 && D.stipendio_atteso) { ent += D.stipendio_atteso; att = true; }
  const sp = Math.max(a.costi, 0), inv = Math.max(a.pac, 0) + Math.max(a.invExtra, 0);
  const resto = ent - sp - inv, tot = Math.max(ent, sp + inv) || 1;
  const invLbl = a.invExtra > 0.5 ? 'Investito' : 'PAC';
  const extra = a.ricavi.Extra > 0.5 ? `<div class="k">di cui extra ${eur0(a.ricavi.Extra)}</div>` : '';
  const seg = (v, c) => v > 0.5 ? `<i style="flex:${v};background:${c}"></i>` : '';
  return `<div class="duo"><div><div class="k">Entrate</div><div class="v in ${att ? 'att' : ''}">${eur0(ent)}${att ? ' <small>attesi</small>' : ''}</div>${extra}</div>
      <div><div class="k">Spese</div><div class="v out">${eur0(sp)}</div></div></div>
    <div class="sbar ${att ? 'dashed' : ''}">${seg(sp, 'var(--ink)')}${seg(inv, '#9FD8B8')}${seg(Math.max(resto, 0), '#EFE9DD')}</div>
    <div class="sleg"><span><i class="dot" style="background:var(--ink)"></i>Spese <b>${eur0(sp)}</b></span>${inv > 0.5 ? `<span><i class="dot" style="background:#9FD8B8"></i>${invLbl} <b>${eur0(inv)}</b></span>` : ''}
      ${resto >= 0 ? `<span><i class="dot" style="background:#E2DCD0"></i>${info.corrente ? 'Restano' : 'In liquidità'} <b>${eur0(resto)}</b></span>` : `<span class="neg">Dalla liquidità <b>${eur0(-resto)}</b></span>`}</div>`;
}

// mesi con spese registrate (fino all'ultimo mese con dati)
function mesiConDati() {
  const kd = meseDi(D.data_al);
  return [...new Set(D.tx.filter(t => COSTI.includes(t[2])).map(t => t[1]))].filter(m => m <= kd).sort();
}
function sceltaMesi(chiave, mesi, sel) {
  const anni = new Set(mesi.map(m => m.slice(0, 4))).size > 1;
  return `<div class="mchips" data-mchips>${mesi.map(m => `<button data-msel="${chiave}" data-v="${m}" class="${m === sel ? 'on' : ''}">${MESI_B[ymd(m)[1] - 1]}${anni ? ' ' + m.slice(2, 4) : ''}</button>`).join('')}</div>`;
}

function vistaMese(k, chiusoForzato) {
  const info = infoMese(k);
  const prec = chiusoForzato;
  const eyebrow = prec ? 'Mesi' : 'Mese in corso';
  const scelta = prec ? sceltaMesi('meseSel', mesiConDati().filter(m => m !== meseDi(OGGI)), k) : '';
  if (!info.importato) {
    return headPagina(eyebrow, meseTit(k), chipDati()) + scelta + card(`<div class="empty-card"><h3>${meseTit(k)} non ancora importato</h3>
      <p class="muted">I dati arrivano al ${D.data_al.split('-').reverse().join('/')}. Il mese comparirà al prossimo aggiornamento del file.</p></div>`);
  }
  const a = agg(k, info.fino);
  const bud = budgetCosti(k, false), spesoNoWT = a.costiNoWT;
  let hero;
  const gg = info.n - info.fino;
  if (info.corrente) {
    const resta = bud - spesoNoWT, atteso = info.fino / info.n;
    const ritmoChip = spesoNoWT > bud * atteso ? '<span class="chip coral">Sopra il ritmo</span>' : '<span class="chip mint">In linea</span>';
    const [ii, dd] = num(Math.abs(resta)).split(',');
    const quando = resta > 0 && gg > 0 ? `≈ ${eur0(resta / gg)} al giorno · ${gg} ${gg === 1 ? 'giorno' : 'giorni'}` : gg > 0 ? `${gg} ${gg === 1 ? 'giorno' : 'giorni'} alla fine` : 'ultimo giorno del mese';
    hero = card(`<div class="card-head"><span class="label">${resta >= 0 ? 'Puoi ancora spendere' : 'Sei oltre il budget di'}</span>${ritmoChip}</div>
      <div class="big ${resta < 0 ? 'neg' : ''}">${ii}<span class="dec">,${dd} €</span></div>
      <div class="line">budget ${eur0(bud)} · ${quando}</div>
      ${soldiMese(a, info)}
      <div class="note">${gg > 0 && info.fino < ymd(OGGI)[2] ? `Dati fino al ${info.fino}: la cifra al giorno vale dal ${info.fino + 1}. ` : ''}Viaggi esclusi dal budget (Fondo viaggi).</div>`, 'hero s5');
  } else {
    const ext = a.ricavi.Extra > 0.5 ? a.ricavi.Extra : 0;
    const av = conExtra() || !ext ? a : { ...a, entrate: a.entrate - ext, utile: a.utile - ext, ricavi: { ...a.ricavi, Extra: 0 } };
    const [ii, dd] = num(av.utile).split(',');
    const q = spesoNoWT / (bud || 1);
    hero = card(`<div class="card-head"><span class="label">Risultato del mese</span><span class="head-r"><span class="chip ${av.utile >= 0 ? 'mint' : 'coral'}">${av.utile >= 0 ? 'Risparmio' : 'In perdita'}</span>${segExtra(!ext)}</span></div>
      <div class="big ${av.utile < 0 ? 'neg' : ''}">${av.utile > 0 ? '+' : ''}${ii}<span class="dec">,${dd} €</span></div>
      <div class="line">savings rate ${av.entrate > 0 ? pct(av.utile / av.entrate) : '–'} · budget usato ${pct(q)}</div>
      ${soldiMese(av, info)}
      <div class="note">Viaggi esclusi dal budget (Fondo viaggi); l'utile li comprende.</div>`, 'hero s5');
  }
  const p = prec ? 'p' : 'm';
  return headPagina(eyebrow, meseTit(k), chipDati() + (info.corrente ? '' : '<span class="chip">mese chiuso</span>')) + scelta +
    colonne([[1, hero], [3, cardRitmo(a, info, p + 'rit')], [5, cardCalendario(info, p + 'cal')]],
            [[2, cardCategorie(a, k, p + 'cat')], [4, cardFlusso(a, info, p + 'flu')], [6, cardSettimana(info, p + 'set')]]);
}

function vistaConfronto() {
  const disp = mesiConDati(), oggiM = meseDi(OGGI);
  const k = disp.includes(stato.confMese) ? stato.confMese : (disp.includes(oggiM) || !disp.length ? oggiM : disp[disp.length - 1]), info = infoMese(k);
  const scelta = sceltaMesi('confMese', disp.includes(oggiM) ? disp : disp.concat([oggiM]), k);
  const seg = `<div class="seg wide" data-seg="confRif"><button data-v="prec" class="${stato.confRif === 'prec' ? 'on' : ''}">vs mese precedente</button><button data-v="media" class="${stato.confRif === 'media' ? 'on' : ''}">vs media 3 mesi</button></div>`;
  if (!info.importato) return headPagina('Confronto', meseTit(k), chipDati()) + scelta + seg + '<div style="height:14px"></div>' + card(`<div class="empty-card"><h3>${meseTit(k)} non ancora importato</h3><p class="muted">Il confronto riparte al prossimo aggiornamento.</p></div>`);
  const g = info.fino, cur = agg(k, g);
  const rifMesi = stato.confRif === 'prec' ? [sposta(k, -1)] : [sposta(k, -1), sposta(k, -2), sposta(k, -3)];
  const mancano = rifMesi.filter(m => !disp.includes(m));
  if (mancano.length) return headPagina('Confronto', meseTit(k), chipDati()) + scelta + seg + '<div style="height:14px"></div>' + card(`<div class="empty-card"><h3>Non ci sono abbastanza dati</h3><p class="muted">Per questo confronto servono anche ${mancano.map(meseTit).join(', ')}, che non sono nel file.</p></div>`);
  const rifAgg = rifMesi.map(m => agg(m, Math.min(g, giorniMese(m))));
  const media = f => rifAgg.reduce((s, r) => s + f(r), 0) / rifAgg.length;
  const rifNome = stato.confRif === 'prec' ? meseNome(rifMesi[0]) : `media ${MESI_B[ymd(rifMesi[2])[1] - 1].toLowerCase()}–${MESI_B[ymd(rifMesi[0])[1] - 1].toLowerCase()}`;
  const parita = g < info.n ? `al giorno ${g}` : 'mese intero';
  const totC = cur.costi, totR = media(r => r.costi), dT = totC - totR;
  const kpi = card(`<div class="card-head"><div><div class="card-sub" style="margin:0">Spese ${meseNome(k)} ${parita}</div>
      <div class="kpi"><div class="v">${eur(totC)}</div></div></div>
      <span class="chip ${dT > 0 ? 'coral' : 'mint'}">${dT > 0 ? '▲' : '▼'} ${sgn(dT)}${totR ? ' (' + (dT > 0 ? '+' : '') + num(dT / totR * 100, 1) + '%)' : ''}</span></div>
    <div class="vs"><div><div class="k">${meseTit(k)}</div><div class="v">${eur0(totC)}</div></div><div><div class="k">${rifNome[0].toUpperCase() + rifNome.slice(1)}</div><div class="v">${eur0(totR)}</div></div></div>
    <div class="note">${g < info.n ? `Confronto a parità di giorni (1–${g})` : 'Confronto tra mesi interi'}, viaggi inclusi.</div>`, 's5');
  const righe = COSTI.map(c => ({ c, a: cur.spese[c], r: media(x => x.spese[c]) })).filter(x => Math.abs(x.a) > 0.5 || Math.abs(x.r) > 0.5);
  righe.forEach(x => x.d = x.a - x.r);
  const maxD = Math.max(...righe.map(x => Math.abs(x.d)), 1);
  const div = righe.slice().sort((x, y) => y.d - x.d).map(x => {
    const w = Math.abs(x.d) / maxD * 50, cls = x.d > 0 ? 'coral' : 'mint';
    return `<div class="div-row"><div class="top"><span>${esc(x.c)}</span><span class="v ${Math.abs(x.d) < 0.5 ? '' : cls}">${sgn(x.d)}</span></div>
      <div class="div-track"><div class="axis"></div><div class="f" style="${x.d > 0 ? `left:50%;width:${w}%;background:var(--coral)` : `left:${50 - w}%;width:${w}%;background:var(--mint)`}"></div></div></div>`;
  }).join('');
  const piu = righe.filter(x => x.d > 0.5).length, meno = righe.filter(x => x.d < -0.5).length;
  const cardDiv = acc('cdiv', 'Scostamenti per categoria', `<span class="chip">${meno} in calo · ${piu} in aumento</span>`,
    `<div class="panel"><div class="div-list">${div}</div></div>${chiave([['bar', 'var(--mint)', 'meno di ' + rifNome], ['bar', 'var(--coral)', 'più di ' + rifNome]])}`, 's7');
  // ritmo a confronto
  const ptsCur = []; let c = 0; for (let d = 1; d <= g; d++) { c += cur.giorno[d] || 0; ptsCur.push([d, c]); }
  const n = info.n, rifFull = rifMesi.map(m => agg(m));
  const ptsRif = []; let cr = rifFull.map(() => 0);
  for (let d = 1; d <= n; d++) { cr = cr.map((v, i) => v + (d <= giorniMese(rifMesi[i]) ? (rifFull[i].giorno[d] || 0) : 0)); ptsRif.push([d, cr.reduce((s, v) => s + v, 0) / cr.length]); }
  const cardRit = acc('crit', 'Ritmo a confronto', `<span class="chip">${meseNome(k)} vs ${rifNome}</span>`,
    `<div class="panel" data-w="crit">${ritmo(larghezza('[data-w="crit"]') - 28, n, ptsCur, 0, { rif: ptsRif, etichetta: `${g} · ${num(c, 0)} €` })}</div>
     ${chiave([['linea', '', meseTit(k)], ['linea', '#C3A6EE', rifNome[0].toUpperCase() + rifNome.slice(1)]])}<div class="note">Spesa cumulata senza viaggi.</div>`, 's5');
  const maxP = Math.max(...righe.map(x => Math.max(x.a, x.r)), 1);
  const pair = righe.slice().sort((x, y) => y.a - x.a).map(x => `<div class="pair"><div class="bar-row"><div class="top"><span>${esc(x.c)}</span><span class="v">${eur0(x.a)} <small>vs ${eur0(x.r)}</small></span></div></div>
      <div class="tr"><i style="width:${Math.max(x.a, 0) / maxP * 100}%;background:${COLORI[x.c]}"></i></div><div class="tr"><i style="width:${Math.max(x.r, 0) / maxP * 100}%;background:#D9D4CB"></i></div></div>`).join('');
  const cardPair = acc('cpair', 'Categorie a confronto', `<span class="chip">${righe.length} categorie</span>`,
    `<div class="panel"><div class="bars-list" style="margin-top:0">${pair}</div></div>${chiave([['bar', '#B8C0EC', meseTit(k)], ['bar', '#D9D4CB', rifNome[0].toUpperCase() + rifNome.slice(1)]])}`, 's7');
  return headPagina('Confronto', meseTit(k), chipDati() + `<span class="chip">${parita}</span>`) + scelta + seg + '<div style="height:14px"></div>' +
    colonne([[1, kpi], [3, cardRit]], [[2, cardDiv], [4, cardPair]]);
}

function vistaAnno() {
  const anni = [...new Set(D.tx.map(t => +t[1].slice(0, 4)))].sort((a, b) => b - a);
  const y = anni.includes(+stato.anno) ? +stato.anno : ymd(OGGI)[0], mesi = Array.from({ length: 12 }, (_, i) => mk(y, i + 1));
  const kd = meseDi(D.data_al);
  const att = mesi.filter(m => m <= kd && D.tx.some(t => t[1] === m));
  if (!att.length) return headPagina('Anno', String(y), chipDati()) + card(`<div class="empty-card"><h3>Nessun dato per il ${y}</h3><p class="muted">Compariranno al primo aggiornamento dell'anno.</p></div>`);
  const ag = Object.fromEntries(mesi.map(m => [m, att.includes(m) ? agg(m, infoMese(m).fino) : null]));
  const somma = f => att.reduce((s, m) => s + f(ag[m]), 0);
  const costi = somma(a => a.costi), entrate = somma(a => a.entrate), utile = entrate - costi;
  const budAnno = att.reduce((s, m) => s + budgetCosti(m), 0);
  const entSR = somma(entrateSR), utileSR = entSR - costi, extraTot = somma(a => a.ricavi.Extra);
  const cur = meseDi(OGGI), chiusi = att.filter(m => m !== cur && infoMese(m).chiuso);
  const periodo = `${MESI_B[ymd(att[0])[1] - 1]}–${MESI_B[ymd(att[att.length - 1])[1] - 1]}`;
  const kpi = card(`<div class="kpis">
      <div class="kpi wide kpi-top"><div class="row1"><div class="k">Spese ${periodo}</div>${segExtra()}</div>
        <div class="row2"><div><div class="v">${eur(costi)}</div><div class="s">budget ${eur0(budAnno)}</div><div class="s ${costi > budAnno + 0.5 ? 'neg' : 'pos'}">${costi > budAnno + 0.5 ? '+' + eur0(costi - budAnno) + ' sopra il budget' : eur0(budAnno - costi) + ' sotto il budget'}</div></div>
        <div class="mini"><span class="chip"><span>spese <b>${eur0(costi / att.length)}</b>/mese</span></span><span class="chip ${costi > budAnno + 0.5 ? 'coral' : 'mint'}"><span>budget <b>${eur0(budAnno / att.length)}</b>/mese</span></span></div></div></div>
      <div class="kpi"><div class="k">${conExtra() ? 'Utile' : 'Utile senza extra'}</div><div class="v">${sgn(utileSR)}</div><div class="s">entrate ${eur0(entSR)}</div>${conExtra() && extraTot > 0.5 ? `<div class="s">di cui extra ${eur0(extraTot)}</div>` : ''}</div>
      <div class="kpi"><div class="k">${conExtra() ? 'Savings rate' : 'Savings rate senza extra'}</div><div class="v">${entSR > 0 ? pct(utileSR / entSR, 1) : '–'}</div><div class="s">utile / entrate</div></div></div>
      <div class="note">${att.includes(cur) && !ag[cur].ricavi.Salary ? `${meseTit(cur)} è in corso e lo stipendio non è ancora arrivato: abbassa l'utile finché non entra.` : ''}</div>`, 's5');
  // sankey annuale
  const tot = { spese: {}, ricavi: { Salary: 0, Extra: 0, 'Other Revenues': 0 }, pac: 0, invExtra: 0 };
  COSTI.forEach(c => tot.spese[c] = somma(a => a.spese[c]));
  ['Salary', 'Extra', 'Other Revenues'].forEach(c => tot.ricavi[c] = somma(a => a.ricavi[c]));
  tot.pac = somma(a => a.pac); tot.invExtra = somma(a => a.invExtra);
  let ent = entrate;
  const dest = COSTI.map(c => ({ c, v: tot.spese[c] })).filter(x => x.v > 0.5).sort((a, b) => b.v - a.v);
  const bAnno = c => att.reduce((s, m) => s + (budget(m)[c] || 0), 0);
  const ds = dest.slice(0, 5).map(x => ({ l: x.c, v: x.v, c: COLORI[x.c], over: x.v > bAnno(x.c) + 0.5 ? x.v - bAnno(x.c) : 0 }));
  const resto = dest.slice(5).reduce((s, x) => s + x.v, 0);
  if (resto > 0.5) ds.push({ l: 'Altre spese', v: resto, c: COLORI['Altre spese'] });
  if (tot.pac > 0.5) ds.push({ l: 'PAC', v: tot.pac, c: COLORI.PAC });
  if (tot.invExtra > 0.5) ds.push({ l: 'Investimenti extra', v: tot.invExtra, c: COLORI['Investimenti extra'] });
  const usc = ds.reduce((s, d) => s + d.v, 0), liq = ent - usc;
  let lbl = tot.ricavi.Extra > 0 ? 'Stipendio + extra' : 'Stipendio', chipF;
  if (liq >= 0.5) { ds.push({ l: 'In liquidità', v: liq, c: COLORI['In liquidità'] }); chipF = `<span class="chip mint">${num(liq, 0)} € in liquidità</span>`; }
  else { ent = usc; lbl = 'Entrate + liquidità'; chipF = `<span class="chip coral">${num(-liq, 0)} € dalla liquidità</span>`; }
  const cardFlu = acc('aflu', 'Dove vanno i soldi', chipF, `<div class="panel" data-w="aflu">${sankey(larghezza('[data-w="aflu"]') - 28, lbl, ent, ds)}</div>
    <div class="note">${periodo}.</div>${chiave([['chip', '', 'quanto la categoria è sopra il budget cumulato']])}`, 's7');
  // barre mensili impilate
  const W = larghezza('[data-w="abar"]') - 28, H = 200, pT = 18, pB = 22, bw = (W / 12) * 0.62;
  const maxV = Math.max(...mesi.map(m => Math.max(ag[m] ? ag[m].costi : 0, budgetCosti(m)))) * 1.08 || 1;
  const Yv = v => pT + (1 - v / maxV) * (H - pT - pB);
  let sb = '';
  mesi.forEach((m, i) => {
    const x = (i + 0.5) * W / 12 - bw / 2;
    if (ag[m]) {
      let acc0 = 0; const pos = COSTI.map(c => ({ c, v: Math.max(ag[m].spese[c], 0) })).filter(s => s.v > 0);
      sb += `<clipPath id="cl${i}"><rect x="${x}" y="${Yv(ag[m].costi > 0 ? pos.reduce((s, p) => s + p.v, 0) : 0)}" width="${bw}" height="${H - pB - Yv(pos.reduce((s, p) => s + p.v, 0))}" rx="${Math.min(bw / 2, 7)}"/></clipPath><g clip-path="url(#cl${i})">`;
      pos.forEach(p => { sb += `<rect x="${x}" y="${Yv(acc0 + p.v)}" width="${bw}" height="${Yv(acc0) - Yv(acc0 + p.v) + 0.5}" fill="${COLORI[p.c]}"/>`; acc0 += p.v; });
      sb += '</g>';
    } else sb += `<rect x="${x}" y="${H - pB - 30}" width="${bw}" height="30" rx="${Math.min(bw / 2, 7)}" fill="none" stroke="#E6DFD2" stroke-dasharray="3 3"/>`;
    const bv = budgetCosti(m);
    sb += `<line x1="${x - 3}" x2="${x + bw + 3}" y1="${Yv(bv)}" y2="${Yv(bv)}" stroke="#1C1B1B" stroke-width="2" stroke-linecap="round"/>`;
    sb += `<text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle" class="lbl">${MESI_B[i][0]}</text>`;
  });
  const legCat = COSTI.filter(c => att.some(m => ag[m].spese[c] > 0)).map(c => `<div><i class="dot" style="background:${COLORI[c]}"></i><span class="n">${esc(c)}</span></div>`).join('');
  const cardBar = acc('abar', 'Spese per mese', `<span class="chip">media ${num(costi / att.length, 0)} €</span>`,
    `<div class="panel" data-w="abar">${svg(W, H, sb)}</div><div class="legend">${legCat}</div>${chiave([['trattino', '', 'budget del mese (viaggi inclusi)']])}`, 's7');
  // cumulata vs budget
  const H2 = 180, pT2 = 22, pB2 = 22;
  let cA = 0, cB = 0; const pa = [], pb = [];
  mesi.forEach((m, i) => { cB += budgetCosti(m); pb.push([i, cB]); if (ag[m]) { cA += ag[m].costi; pa.push([i, cA]); } });
  const mx = cB * 1.06, X2 = i => 6 + i / 11 * (W - 12), Y2 = v => pT2 + (1 - v / mx) * (H2 - pT2 - pB2);
  const diffC = cA - pb[pa.length - 1][1];
  let s2 = `<polyline points="${pb.map(p => `${X2(p[0])},${Y2(p[1])}`).join(' ')}" fill="none" stroke="#8B867D" stroke-width="2" stroke-dasharray="5 6"/>
    <polyline points="${pa.map(p => `${X2(p[0])},${Y2(p[1])}`).join(' ')}" fill="none" stroke="#1C1B1B" stroke-width="2.8" stroke-linejoin="round"/>`;
  pa.forEach(p => s2 += `<circle cx="${X2(p[0])}" cy="${Y2(p[1])}" r="3.2" fill="#1C1B1B"/>`);
  s2 += `<text x="${X2(11)}" y="${Y2(cB) - 8}" text-anchor="end" class="lbl">budget anno ${num(cB, 0)} €</text>`;
  mesi.forEach((m, i) => s2 += `<text x="${X2(i)}" y="${H2 - 4}" text-anchor="middle" class="lbl">${MESI_B[i][0]}</text>`);
  const cardCum = acc('acum', 'Spesa cumulata vs budget', `<span class="chip ${diffC > 0 ? 'coral' : 'mint'}">${num(Math.abs(diffC), 0)} € ${diffC > 0 ? 'sopra' : 'sotto'}</span>`,
    `<div class="panel">${svg(W, H2, s2)}</div>${chiave([['linea', '', 'spese cumulate'], ['tratt', '', 'budget cumulato']])}<div class="note">Viaggi inclusi. Il budget è stato fissato a ottobre: per i mesi prima è un metro di paragone, non un impegno preso allora.</div>`, 's5');
  // savings rate mensile
  const sr = mesi.map(m => (ag[m] && chiusi.includes(m) && entrateSR(ag[m]) > 0) ? (entrateSR(ag[m]) - ag[m].costi) / entrateSR(ag[m]) : null);
  const vals = sr.filter(v => v !== null), mxS = Math.max(0.1, ...vals), mnS = Math.min(0, ...vals);
  const H3 = 180, Y3 = v => 22 + (mxS - v) / (mxS - mnS) * (H3 - 62);
  let s3 = `<line x1="0" x2="${W}" y1="${Y3(0)}" y2="${Y3(0)}" stroke="#D9D4CB"/>`;
  const bw3 = (W / 12) * 0.56;
  sr.forEach((v, i) => {
    const x = (i + 0.5) * W / 12 - bw3 / 2;
    if (v === null) { s3 += `<rect x="${x}" y="${Y3(0) - 3}" width="${bw3}" height="6" rx="3" fill="#EEE7DC"/>`; }
    else {
      const y0 = Y3(Math.max(v, 0)), y1 = Y3(Math.min(v, 0));
      s3 += `<rect x="${x}" y="${y0}" width="${bw3}" height="${Math.max(y1 - y0, 3)}" rx="${Math.min(bw3 / 2, 6)}" fill="${v >= 0 ? '#9FD8B8' : '#F2A48F'}"/>
        <text x="${x + bw3 / 2}" y="${v >= 0 ? y0 - 5 : y1 + 12}" text-anchor="middle" class="lbl-b" style="font-size:10px">${num(v * 100, 0)}%</text>`;
    }
    s3 += `<text x="${x + bw3 / 2}" y="${H3 - 2}" text-anchor="middle" class="lbl">${MESI_B[i][0]}</text>`;
  });
  const mediaSR = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  const cardSR = acc('asr', 'Savings rate mensile', `<span class="chip">media ${pct(mediaSR)}</span>`,
    `<div class="seg-row">${segExtra()}</div><div class="panel">${svg(W, H3, s3)}</div>${chiave([['bar', '#9FD8B8', 'risparmio'], ['bar', '#F2A48F', 'perdita']])}<div class="note">Utile / entrate dei mesi chiusi (extra ${conExtra() ? 'inclusi' : 'esclusi'}: 13ª, 14ª e bonus). Media semplice dei mesi.</div>`, 's7');
  // calendario annuale
  const dal = `${y}-01-01`, al = D.data_al < `${y}-12-31` ? D.data_al : `${y}-12-31`;
  const g = spesaGiorni(dal, al), maxG = 120;
  const start = new Date(y, 0, 1), off = (start.getDay() + 6) % 7, cs = 12, gp = 3;
  let s4 = '', zero = 0, attivi = 0, somG = 0;
  GIORNI.forEach((d, i) => { if (i % 2 === 0) s4 += `<text x="0" y="${16 + i * (cs + gp) + cs - 2}" class="lbl" style="font-size:9px">${d[0]}</text>`; });
  for (let i = 0; i < 366; i++) {
    const dt = new Date(y, 0, 1 + i); if (dt.getFullYear() !== y) break;
    const key = `${y}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const col = Math.floor((i + off) / 7), row = (i + off) % 7, x = 14 + col * (cs + gp), yy = 16 + row * (cs + gp);
    if (dt.getDate() === 1) s4 += `<text x="${x}" y="10" class="lbl" style="font-size:9.5px">${MESI_B[dt.getMonth()]}</text>`;
    if (key > al) { s4 += `<rect x="${x}" y="${yy}" width="${cs}" height="${cs}" rx="3" fill="none" stroke="#E6DFD2"/>`; continue; }
    const v = g[key] || 0; if (v <= 0.004) zero++; else { attivi++; somG += v; }
    s4 += `<rect x="${x}" y="${yy}" width="${cs}" height="${cs}" rx="3" fill="${colore(v, maxG)}"><title>${key.split('-').reverse().join('/')}: ${num(v)} €</title></rect>`;
  }
  const W4 = 14 + 54 * (cs + gp);
  const cardCal = acc('acal', 'Calendario dell\'anno', `<span class="chip">${zero} giorni a zero</span>`,
    `<div class="panel"><div class="yearmap">${svg(W4, 16 + 7 * (cs + gp), s4).replace('width="100%"', `width="${W4}"`)}</div>${legendaScala(maxG)}</div>
     <div class="note">Media nei giorni con spese: ${eur(attivi ? somG / attivi : 0)}. Costi variabili per data, senza affitto, abbonamenti e viaggi.</div>`, 's12');
  const selAnni = anni.length > 1 ? `<div class="seg" data-seg="anno" style="margin:-4px 0 14px">${anni.map(a => `<button data-v="${a}" class="${a === y ? 'on' : ''}">${a}</button>`).join('')}</div>` : '';
  return headPagina('Anno', String(y), chipDati() + `<span class="chip">${periodo} · ${att.length} mesi</span>`) + selAnni +
    colonne([[1, kpi], [3, cardCum], [5, cardSR]], [[2, cardFlu], [4, cardBar]], `<div style="margin-top:14px">${cardCal}</div>`);
}

/* ------------------------------------------------------------------ posso comprarlo */
function renderAsk() {
  const chips = document.getElementById('ask-chips');
  chips.innerHTML = COSTI.map(c => `<button data-cat="${esc(c)}" class="${c === stato.askCat ? 'on' : ''}"><i class="dot" style="background:${COLORI[c]}"></i>${esc(c)}</button>`).join('');
  const raw = document.getElementById('ask-amount').value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const imp = parseFloat(raw);
  const out = document.getElementById('ask-result');
  if (!(imp > 0) || !stato.askCat) { out.innerHTML = '<div class="hint">Scegli importo e categoria.</div>'; return; }
  const k = meseDi(OGGI), info = infoMese(k), cat = stato.askCat;
  const tre = [sposta(k, -2), sposta(k, -1), k];
  const spesoM = info.importato ? agg(k, info.fino).spese[cat] : 0, budM = budget(k)[cat] || 0;
  const spes3 = tre.reduce((s, m) => s + (infoMese(m).importato ? agg(m, infoMese(m).fino).spese[cat] : 0), 0), bud3 = tre.reduce((s, m) => s + (budget(m)[cat] || 0), 0);
  const restM = budM - spesoM, rest3 = bud3 - spes3, dopoM = restM - imp, dopo3 = rest3 - imp;
  let v, tit, txt;
  if (dopoM >= 0 && dopo3 >= 0) { v = 'si'; tit = 'Sì'; txt = 'Ci sta sia nel budget del mese sia in quello degli ultimi 3 mesi.'; }
  else if (dopo3 >= 0) { v = 'attento'; tit = 'Attento'; txt = 'Sfori il budget del mese, ma rientri in quello degli ultimi 3 mesi.'; }
  else if (dopoM >= 0) { v = 'attento'; tit = 'Attento'; txt = 'Rientri nel budget del mese, ma sfori quello degli ultimi 3 mesi.'; }
  else { v = 'no'; tit = 'No'; txt = 'Sfori sia il budget del mese sia quello degli ultimi 3 mesi.'; }
  const blocco = (titolo, sub, speso, bud, rest, dopo) => {
    const max = Math.max(bud, speso + imp, 1);
    return `<div class="blk"><div class="bh"><b>${titolo}</b><span class="muted" style="font-size:13px">${sub}</span></div>
    <div class="trio"><div><div class="k">Speso</div><div class="v">${eur(speso)}</div></div><div><div class="k">Budget</div><div class="v">${eur(bud)}</div></div><div><div class="k">${rest >= 0 ? 'Restano' : 'Sforato'}</div><div class="v" style="color:${rest >= 0 ? 'inherit' : 'var(--coral-ink)'}">${eur(Math.abs(rest))}</div></div></div>
    <div class="cap"><i style="width:${Math.max(speso, 0) / max * 100}%;background:var(--ink)"></i><i style="left:${Math.max(speso, 0) / max * 100}%;width:${imp / max * 100}%;background:${dopo >= 0 ? 'var(--mint)' : 'var(--coral)'}"></i>
    ${bud ? `<b style="position:absolute;left:calc(${bud / max * 100}% - 1px);top:0;bottom:0;width:2px;background:#8B867D"></b>` : ''}</div>
    <div class="after ${dopo >= 0 ? 'pos' : 'neg'}"><span>Dopo l'acquisto</span><span class="eur">${dopo >= 0 ? 'restano ' + num(dopo) : 'sfori di ' + num(-dopo)} €</span></div></div>`;
  };
  const nota = !info.importato ? `<div class="note">${meseTit(k)} non è ancora importato: il mese risulta senza spese.</div>` :
    info.fino < ymd(OGGI)[2] ? `<div class="note">Spese aggiornate al ${D.data_al.split('-').reverse().join('/')}.</div>` : '';
  out.innerHTML = `<div class="verdict ${v}"><div class="w">${tit}</div><p>${txt}</p></div>` +
    blocco('Questo mese', meseNome(k), spesoM, budM, restM, dopoM) +
    blocco('Ultimi 3 mesi', `${MESI_B[ymd(tre[0])[1] - 1].toLowerCase()}–${MESI_B[ymd(tre[2])[1] - 1].toLowerCase()}`, spes3, bud3, rest3, dopo3) + nota;
}

/* ------------------------------------------------------------------ navigazione */
function renderNav() {
  document.getElementById('tabbar').innerHTML = TABS.map(([id, l]) => `<button class="tab ${stato.tab === id ? 'on' : ''}" data-tab="${id}" aria-label="${l}">${ICONE[id]}<span class="lab">${l}</span></button>`).join('');
  document.getElementById('side-nav').innerHTML = TABS.map(([id, l]) => `<button class="side-tab ${stato.tab === id ? 'on' : ''}" data-tab="${id}">${ICONE[id]}${l}</button>`).join('');
  document.getElementById('side-data').textContent = 'Dati al ' + D.data_al.split('-').reverse().join('/');
}
function render() {
  renderNav();
  const v = document.getElementById('view');
  const k = meseDi(OGGI);
  // primo passaggio per misurare le larghezze, secondo con le misure giuste
  for (let i = 0; i < 2; i++) {
    v.innerHTML = stato.tab === 'mese' ? vistaMese(k, false) : stato.tab === 'prec' ? vistaMese(mesiConDati().includes(stato.meseSel) && stato.meseSel !== k ? stato.meseSel : sposta(k, -1), true) : stato.tab === 'conf' ? vistaConfronto() : vistaAnno();
    if (i === 0) v.querySelectorAll('details.card').forEach(d => d.open = true);
  }
  v.querySelectorAll('[data-mchips]').forEach(r => { const on = r.querySelector('.on'); if (on) r.scrollLeft = on.offsetLeft - r.clientWidth / 2 + on.clientWidth / 2; });
  v.querySelectorAll('details.card').forEach(d => d.addEventListener('toggle', () => { stato.aperti = stato.aperti || {}; stato.aperti[d.dataset.id] = d.open; salvaUI(); }));
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab]');
  if (t) { stato.tab = t.dataset.tab; salvaUI(); render(); window.scrollTo({ top: 0 }); return; }
  const ms = e.target.closest('[data-msel]');
  if (ms) { stato[ms.dataset.msel] = ms.dataset.v; salvaUI(); render(); return; }
  const s = e.target.closest('[data-seg] button');
  if (s) { stato[s.parentElement.dataset.seg] = s.dataset.v; salvaUI(); render(); return; }
  if (e.target.closest('[data-ask]')) { document.getElementById('sheet-wrap').hidden = false; renderAsk(); setTimeout(() => document.getElementById('ask-amount').focus(), 50); return; }
  if (e.target.closest('[data-close]')) { document.getElementById('sheet-wrap').hidden = true; document.getElementById('ask-amount').value = ''; stato.askCat = null; return; }
  const c = e.target.closest('[data-cat]');
  if (c) { stato.askCat = c.dataset.cat; renderAsk(); }
});
document.getElementById('ask-amount').addEventListener('input', renderAsk);
document.getElementById('logout').addEventListener('click', () => { try { localStorage.removeItem('camcash.pw'); } catch (e) { } location.reload(); });
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => D && render(), 200); });

/* ------------------------------------------------------------------ accesso e decifratura */
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function decifra(env, pw) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(env.salt), iterations: env.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(env.iv) }, key, b64(env.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
function avvia(dati) {
  D = dati;
  const q = new URLSearchParams(location.search).get('oggi');
  const n = new Date();
  OGGI = q || `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  COSTI = D.categorie.filter(c => String(c.gruppo).startsWith('Costo')).map(c => c.nome);
  VARIAB = D.categorie.filter(c => c.gruppo === 'Costo variabile' && c.nome !== WT).map(c => c.nome);
  document.getElementById('login').hidden = true;
  document.getElementById('app').hidden = false;
  render();
}
// archivi degli anni chiusi (anno-AAAA.enc.json): stessa password, uniti ai dati dell'anno in corso
async function caricaTutto(env, pw) {
  const d = await decifra(env, pw);
  for (const f of (d.archivi || [])) {
    try {
      const a = await decifra(await (await fetch(f, { cache: 'no-store' })).json(), pw);
      d.tx = a.tx.concat(d.tx);
      d.budget = Object.assign({}, a.budget, d.budget);
      a.categorie.forEach(c => { if (!d.categorie.some(x => x.nome === c.nome)) d.categorie.push(c); });
    } catch (e) { console.warn('archivio non caricato', f); }
  }
  d.tx.sort((x, y) => x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0);
  return d;
}
async function init() {
  let env;
  try { env = await (await fetch('data.enc.json', { cache: 'no-store' })).json(); }
  catch (e) { document.body.innerHTML = '<p style="padding:24px">Dati non disponibili.</p>'; return; }
  let pw = null; try { pw = localStorage.getItem('camcash.pw'); } catch (e) { }
  if (pw) { try { return avvia(await caricaTutto(env, pw)); } catch (e) { try { localStorage.removeItem('camcash.pw'); } catch (_) { } } }
  document.getElementById('login').hidden = false;
  document.getElementById('login-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const p = document.getElementById('pw').value, err = document.getElementById('login-err');
    err.hidden = true;
    try {
      const d = await caricaTutto(env, p);
      if (document.getElementById('remember').checked) { try { localStorage.setItem('camcash.pw', p); } catch (e) { } }
      avvia(d);
    } catch (e) { err.textContent = 'Password errata.'; err.hidden = false; }
  });
}
init();
