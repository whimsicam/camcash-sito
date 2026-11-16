/* Spese rapide dal telefono.
   Apple Pay → automazione "Transazione" di Comandi Rapidi → apre il sito con  #add&i=<importo>&m=<esercente>&c=<carta>
   Il sito mette la spesa in categoria (regole esercenti dell'Excel + esercenti ricordati), la cifra con la password
   e la salva in spese-rapide.enc.json sul repo (API GitHub, token salvato una volta sul dispositivo).
   Le spese restano provvisorie finché l'aggiornamento del 2 e del 17 non le abbina all'estratto e le toglie dal file. */
const RAP_API = 'https://api.github.com/repos/whimsicam/camcash-sito/contents/spese-rapide.enc.json';
const RAP_FILE = 'spese-rapide.enc.json';
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { } };
let RAP = { v: 1, dal: null, spese: [], ricordati: {} }, RAP_SHA = null, RAP_PW = null;

/* ---------------------------------------------------------------- cifratura (stesso formato del programma) */
const b64e = u8 => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
async function cifra(obj, pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iter = 310000;
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { v: 1, kdf: 'PBKDF2-SHA256', iter, salt: b64e(salt), iv: b64e(iv), ct: b64e(new Uint8Array(ct)) };
}

/* ---------------------------------------------------------------- lettura e scrittura sul repo */
const intest = () => { const t = lsGet('camcash.gh'); return Object.assign({ Accept: 'application/vnd.github+json' }, t ? { Authorization: 'Bearer ' + t } : {}); };
async function leggiRapide(pw) {
  let env = null;
  try {
    const r = await fetch(RAP_API + '?ref=main&t=' + Date.now(), { headers: intest(), cache: 'no-store' });
    if (r.status === 404) RAP_SHA = null;
    else if (r.ok) { const j = await r.json(); RAP_SHA = j.sha; env = JSON.parse(atob(j.content.replace(/\s/g, ''))); }
    else throw new Error('api ' + r.status);
  } catch (e) {
    try { const r = await fetch(RAP_FILE, { cache: 'no-store' }); if (r.ok) env = await r.json(); } catch (_) { }
  }
  const o = env ? await decifra(env, pw) : { v: 1, dal: null, spese: [], ricordati: {} };
  o.spese = o.spese || []; o.ricordati = o.ricordati || {};
  return o;
}
const coda = () => { try { return JSON.parse(lsGet('camcash.coda') || '[]'); } catch (e) { return []; } };
function unisci(o, spese) {
  const r = { ...o, spese: o.spese.slice(), ricordati: { ...o.ricordati } };
  for (const s of spese) {
    const i = r.spese.findIndex(x => x.id === s.id);
    if (i < 0) r.spese.push(s); else r.spese[i] = s;
    if (s.ricorda && s.cat) r.ricordati[nomeEs(s.esercente)] = s.cat;
  }
  if (!r.dal && r.spese.length) r.dal = r.spese.map(s => s.data).sort()[0];
  return r;
}
// invia la coda del dispositivo: rilegge il file, unisce, riscrive (riprova se nel frattempo è cambiato)
async function inviaCoda() {
  const q = coda();
  if (!q.length) return 'ok';
  if (!lsGet('camcash.gh')) return 'token';
  for (let t = 0; t < 3; t++) {
    try {
      const o = unisci(await leggiRapide(RAP_PW), q);
      const body = { message: 'spesa rapida', branch: 'main', content: btoa(JSON.stringify(await cifra(o, RAP_PW))) };
      if (RAP_SHA) body.sha = RAP_SHA;
      const r = await fetch(RAP_API, { method: 'PUT', headers: { ...intest(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.ok) { RAP_SHA = (await r.json()).content.sha; RAP = o; lsSet('camcash.coda', null); return 'ok'; }
      if (r.status === 401 || r.status === 403) return 'token';
      if (r.status !== 409 && r.status !== 422) return 'rete';
    } catch (e) { return 'rete'; }
  }
  return 'rete';
}

/* ---------------------------------------------------------------- dati: le spese rapide entrano nei movimenti */
const tutteRapide = () => unisci(RAP, coda()).spese;
function txRapida(s) { return [s.data, s.data.slice(0, 7), s.cat || 'Other', '', -Math.abs(+s.imp), 'R']; }
// chiamata da caricaTutto(): stessi movimenti per tutti i calcoli (grafici, ritmo, Posso comprarlo, insights)
async function caricaRapide(d, pw) {
  RAP_PW = pw;
  try { RAP = await leggiRapide(pw); } catch (e) { RAP = { v: 1, dal: null, spese: [], ricordati: {} }; }
  d.data_banca = d.data_al;
  for (const s of tutteRapide()) {
    d.tx.push(txRapida(s));
    if (s.data > d.data_al) d.data_al = s.data;
  }
  d.tx.sort((x, y) => x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0);
}
const rapideMese = k => D.tx.filter(t => t[5] === 'R' && t[1] === k);
const chipRapide = k => { const n = k ? rapideMese(k).length : 0; return n ? ` <span class="chip prov">+ ${n} ${n === 1 ? 'spesa rapida' : 'spese rapide'}</span>` : ''; };

/* ---------------------------------------------------------------- categoria */
const PREF = /^(SUMUP|SQ|ZETTLE|SATISPAY|PAYPAL|NEXI|SMP|IZ|STRIPE)\s*[*_\-]\s*/;
function nomeEs(s) { return String(s || '').toUpperCase().replace(/\s+/g, ' ').trim().replace(PREF, '').trim(); }
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function categoriaPer(es) {
  const U = nomeEs(es);
  if (!U) return null;
  const ric = unisci(RAP, coda()).ricordati;
  if (ric[U] && COSTI.includes(ric[U])) return ric[U];
  for (const [kw, cat] of (D.regole || [])) {
    if (!COSTI.includes(cat)) continue;
    try { if (new RegExp('(?<![A-Z0-9])' + reEsc(String(kw).toUpperCase())).test(U)) return cat; } catch (e) { }
  }
  return null;
}
function importoDa(s) {
  s = String(s || '').replace(/[^\d,.]/g, '');
  const p = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  s = p >= 0 && s.length - p - 1 <= 2 ? s.slice(0, p).replace(/[.,]/g, '') + '.' + s.slice(p + 1) : s.replace(/[.,]/g, '');
  const v = parseFloat(s);
  return isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
}
function restaDaSpendere() {
  const k = meseDi(OGGI), info = infoMese(k);
  if (!info.importato) return null;
  return budgetCosti(k, false) - agg(k, info.fino).costiNoWT;
}

/* ---------------------------------------------------------------- foglio "spesa aggiunta" / "dove la metto?" */
const CAT_RAPIDE = ['Groceries', 'Bar & Restaurant', 'Going Out', 'Transport', 'Shopping', 'Health & Care', 'Weekend & Travel', 'Gifts', 'Collectibles', 'Other'];
const SPUNTA = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#2E7D57" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>';
function foglio(html) {
  let w = document.getElementById('rap-wrap');
  if (!w) {
    w = document.createElement('div'); w.id = 'rap-wrap'; w.className = 'sheet-wrap';
    w.innerHTML = '<div class="sheet-backdrop" data-rclose></div><section class="sheet rap-sheet" role="dialog" aria-label="Spesa rapida"></section>';
    document.body.appendChild(w);
    w.addEventListener('click', ev => { if (ev.target.closest('[data-rclose]')) w.hidden = true; });
  }
  w.querySelector('.rap-sheet').innerHTML = `<div class="grab"></div>
    <div class="rs-head"><img src="icon-192.png" alt=""><div class="t">CAM Cash</div>
    <button class="sheet-x" data-rclose aria-label="Chiudi"><svg viewBox="0 0 24 24" class="ico"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>` + html;
  w.hidden = false;
  return w;
}
const ora = s => s.ts.slice(11, 16);
const tile = (s, cat) => `<div class="rs-tile"><div class="ic" style="${cat ? `background:${COLORI[cat]}33` : ''}">${cat ? `<i class="dot" style="background:${COLORI[cat]}"></i>` : '?'}</div>
  <div class="tx"><div class="m">${esc(s.esercente)}</div><div class="w">oggi ${ora(s)}</div></div><div class="amt">${num(s.imp)} €</div></div>`;
function avviso(esito) {
  if (esito === 'ok') return '';
  if (esito === 'token') return `<div class="rs-tok"><div class="q">Collega GitHub (una volta su questo dispositivo)</div>
    <input id="rs-token" type="password" placeholder="token GitHub" autocomplete="off"><button class="btn-dark" id="rs-token-ok">Salva e invia</button>
    <p class="note">La spesa è al sicuro sul telefono: parte appena il token è salvato.</p></div>`;
  return '<p class="note rs-err">Senza rete: la spesa è salvata sul telefono e parte alla prossima apertura.</p>';
}
function fogliofatto(s, prima, esito) {
  const dopo = restaDaSpendere();
  const w = foglio(tile(s, s.cat) +
    `<div class="rs-kv"><span>Categoria</span><span class="chip"><i class="dot" style="background:${COLORI[s.cat]}"></i> ${esc(s.cat)}</span></div>` +
    (dopo != null ? `<div class="rs-kv"><span>Puoi ancora spendere</span><b>${num(dopo)} €</b></div>` : '') +
    `<div class="rs-kv last"><span>Stato</span><span class="chip prov">provvisoria</span></div>` +
    `<div class="rs-done"><div class="c">${SPUNTA}</div><span>Spesa aggiunta</span></div>` + avviso(esito));
  const b = w.querySelector('#rs-token-ok');
  if (b) b.addEventListener('click', async () => {
    const v = w.querySelector('#rs-token').value.trim();
    if (!v) return;
    lsSet('camcash.gh', v);
    fogliofatto(s, prima, await inviaCoda());
  });
}
function foglioScegli(s) {
  const w = foglio(tile(s, null) + `<div class="rs-q">Dove la metto?</div><div class="rs-grid">${CAT_RAPIDE.filter(c => COSTI.includes(c))
    .map(c => `<button data-rcat="${esc(c)}"><i style="background:${COLORI[c]}"></i>${esc(c)}</button>`).join('')}</div>
    <label class="check rs-check"><input type="checkbox" id="rs-ric" checked> Ricorda per questo esercente</label>`);
  w.querySelectorAll('[data-rcat]').forEach(b => b.addEventListener('click', () => {
    w.querySelectorAll('[data-rcat]').forEach(x => x.classList.toggle('sel', x === b));
    s.cat = b.dataset.rcat; s.ricorda = w.querySelector('#rs-ric').checked;
    setTimeout(() => salva(s), 180);
  }));
}
async function salva(s) {
  const prima = restaDaSpendere();
  lsSet('camcash.coda', JSON.stringify(unisci({ spese: coda(), ricordati: {} }, [s]).spese));
  D.tx.push(txRapida(s)); D.tx.sort((x, y) => x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0);
  if (s.data > D.data_al) D.data_al = s.data;
  render();
  fogliofatto(s, prima, 'ok');
  const esito = await inviaCoda();
  if (esito !== 'ok') fogliofatto(s, prima, esito);
}

/* ---------------------------------------------------------------- avvio: #add dal comando rapido, coda in sospeso */
function dopoAvvio() {
  const h = location.hash;
  if (h.startsWith('#add')) {
    const p = new URLSearchParams(h.slice(4).replace(/^[?&]/, ''));
    history.replaceState(null, '', location.pathname + location.search);
    const imp = importoDa(p.get('i'));
    if (imp) {
      const n = new Date(), hh = String(n.getHours()).padStart(2, '0'), mm = String(n.getMinutes()).padStart(2, '0');
      const es = (p.get('m') || '').trim() || 'Apple Pay';
      const s = { id: `${OGGI}T${hh}${mm}-${imp.toFixed(2)}-${nomeEs(es).replace(/[^A-Z0-9]/g, '').slice(0, 16)}`, ts: `${OGGI}T${hh}:${mm}`,
        data: OGGI, imp, esercente: es, carta: (p.get('c') || '').trim(), cat: null, ricorda: false };
      if (!tutteRapide().some(x => x.id === s.id)) {
        const cat = categoriaPer(es);
        if (cat) { s.cat = cat; salva(s); } else foglioScegli(s);
        return;
      }
    }
  }
  if (coda().length) inviaCoda();
}
// se il sito è già aperto nella stessa scheda, l'apertura dal comando rapido cambia solo l'hash: nessun ricaricamento
window.addEventListener('hashchange', () => { if (D && location.hash.startsWith('#add')) dopoAvvio(); });
