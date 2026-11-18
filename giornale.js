/* Giornale delle spese: tutti i movimenti di spesa, per giorno, con filtro per periodo, categoria e sottocategoria.
   Movimento: [data, mese, categoria, sottocategoria, importo, origine ('R' = spesa rapida), nome esercente]. */
'use strict';

const ICONA_GIORNALE = '<svg viewBox="0 0 24 24" class="ico"><rect x="5" y="3.5" width="14" height="17" rx="3"/><path d="M9 8.5h6M9 12h6M9 15.5h3.5"/></svg>';
const GIORNI_L = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

// periodi: mesi con spese (+ mese in corso) e, in fondo, gli anni
function periodiGiornale() {
  const mesi = [...new Set(D.tx.filter(t => COSTI.includes(t[2])).map(t => t[1]))];
  if (!mesi.includes(meseDi(OGGI))) mesi.push(meseDi(OGGI));
  mesi.sort();
  const anni = [...new Set(mesi.map(m => m.slice(0, 4)))].sort();
  return { mesi, anni };
}
function periodoGiornale() {
  const { mesi, anni } = periodiGiornale(), p = stato.gPer;
  return mesi.includes(p) || anni.includes(p) ? p : meseDi(OGGI);
}
const inPeriodo = (t, p) => p.length === 4 ? t[1].slice(0, 4) === p : t[1] === p;
const nomeMov = t => t[6] || t[3] || t[2];

function vistaGiornale() {
  const p = periodoGiornale(), anno = p.length === 4, { mesi, anni } = periodiGiornale();
  const piuAnni = anni.length > 1;
  const chipPer = `<div class="mchips" data-mchips>${mesi.map(m => `<button data-gper="${m}" class="${m === p ? 'on' : ''}">${MESI_B[ymd(m)[1] - 1]}${piuAnni ? ' ' + m.slice(2, 4) : ''}</button>`).join('')}${anni.map(a => `<button data-gper="${a}" class="anno ${a === p ? 'on' : ''}">Anno ${a}</button>`).join('')}</div>`;

  const nelPeriodo = D.tx.filter(t => COSTI.includes(t[2]) && inPeriodo(t, p));
  // categorie del periodo, dalla più alta
  const perCat = {};
  nelPeriodo.forEach(t => perCat[t[2]] = (perCat[t[2]] || 0) - t[4]);
  const cats = Object.keys(perCat).sort((a, b) => perCat[b] - perCat[a]);
  const cat = cats.includes(stato.gCat) ? stato.gCat : null;
  const conCat = cat ? nelPeriodo.filter(t => t[2] === cat) : nelPeriodo;
  const perSub = {};
  if (cat) conCat.forEach(t => { const s = t[3] || 'Altro'; perSub[s] = (perSub[s] || 0) - t[4]; });
  const subs = Object.keys(perSub).sort((a, b) => perSub[b] - perSub[a]);
  const sub = cat && subs.includes(stato.gSub) ? stato.gSub : null;
  const movs = sub ? conCat.filter(t => (t[3] || 'Altro') === sub) : conCat;

  const chipCat = `<div class="gchips" data-mchips><button data-gcat="" class="${cat ? '' : 'on'}">Tutte</button>${cats.map(c =>
    `<button data-gcat="${esc(c)}" class="${c === cat ? 'on' : ''}"><i class="dot" style="background:${COLORI[c]}"></i>${esc(c)}</button>`).join('')}</div>`;
  const chipSub = cat && subs.length > 1 ? `<div class="gchips sub" data-mchips>${subs.map(s =>
    `<button data-gsub="${esc(s)}" class="${s === sub ? 'on' : ''}">${esc(s)} <small>${num(perSub[s], 0)} €</small></button>`).join('')}</div>` : '';

  // riepilogo del filtro
  const tot = -movs.reduce((s, t) => s + t[4], 0), n = movs.length, nRap = movs.filter(t => t[5] === 'R').length;
  let bud = '';
  if (cat && !sub) {
    const b = anno ? budgetPeriodo(mesi.filter(m => m.slice(0, 4) === p && m <= meseDi(OGGI)))[cat] : budget(p)[cat];
    if (b > 0) { const r = b - tot; bud = `<div class="line">budget ${eur0(b)}${anno ? ' da inizio anno' : ''} · <span class="${r < -0.5 ? 'neg' : 'pos'}">${Math.abs(r) < 0.5 ? 'in linea' : `${num(Math.abs(r), 0)} € ${r > 0 ? 'sotto' : 'oltre'}`}</span>${isFondo(cat, anno ? meseDi(OGGI) : p) ? ' <span class="tag-f">fondo</span>' : ''}</div>`; }
  }
  const [ii, dd] = num(tot).split(',');
  const titoloFiltro = sub ? `${esc(cat)} · ${esc(sub)}` : cat ? esc(cat) : 'Tutte le spese';
  const riepilogo = card(`<div class="card-head"><span class="label">${titoloFiltro}</span><span class="chip">${n} ${n === 1 ? 'movimento' : 'movimenti'}</span></div>
    <div class="big g-big">${ii}<span class="dec">,${dd} €</span></div>${bud}
    ${nRap ? `<div class="note">${nRap === 1 ? 'Una spesa rapida' : nRap + ' spese rapide'} dal telefono, da confermare con l'estratto.</div>` : ''}`, 'g-sum');

  // lista per giorno, dal più recente
  const giorni = {};
  movs.forEach(t => (giorni[t[0]] = giorni[t[0]] || []).push(t));
  const lista = Object.keys(giorni).sort().reverse().map(d => {
    const rs = giorni[d], [y, m, g] = ymd(d), tg = -rs.reduce((s, t) => s + t[4], 0);
    const righe = rs.slice().sort((a, b) => a[4] - b[4]).map(t => {
      const rimb = t[4] > 0, nm = nomeMov(t);
      const dett = [...new Set((t[6] ? [cat ? '' : t[2], t[3]] : [cat || !t[3] ? '' : t[2]]).filter(Boolean))].filter(x => x !== nm).join(' · ');
      const pall = t[5] === 'R' ? `background:repeating-linear-gradient(45deg,${COLORI[t[2]]} 0 2px,#fff 2px 4px);box-shadow:inset 0 0 0 1px ${COLORI[t[2]]}` : `background:${COLORI[t[2]]}`;
      return `<div class="g-row ${t[5] === 'R' ? 'rap' : ''}"><i class="dot" style="${pall}"></i>
        <div class="tx"><div class="n">${esc(nm)}</div><div class="d">${rimb ? '<span class="chip mint sm">rimborso</span>' : ''}${dett ? esc(dett) : '&nbsp;'}</div></div>
        <div class="a ${rimb ? 'pos' : ''}">${rimb ? '+' : ''}${num(Math.abs(t[4]))} €</div></div>`;
    }).join('');
    return `<div class="g-day"><div class="g-dh"><span>${GIORNI_L[dow(y, m, g)]} ${g} ${MESI[m - 1]}${anno || y !== ymd(OGGI)[0] ? ' ' + y : ''}</span><b>${num(tg)} €</b></div>${righe}</div>`;
  }).join('');
  const corpo = n ? card(lista, 'g-list') : card(`<div class="empty-card"><h3>Nessuna spesa</h3><p class="muted">${p === meseDi(OGGI) && !D.tx.some(t => t[1] === p) ? `${meseTit(p)} non è ancora stato importato: i dati arrivano al ${(D.data_banca || D.data_al).split('-').reverse().join('/')}.` : 'Nessun movimento con questo filtro.'}</p></div>`);
  return headPagina('Giornale', anno ? `Anno ${p}` : meseTit(p), chipDati(anno ? null : p)) + chipPer + chipCat + chipSub +
    `<div class="g-wrap">${riepilogo}${corpo}</div>`;
}

// apre il Giornale già filtrato (da Ripartizione spese, Confronto...)
function apriGiornale(per, cat) {
  stato.tab = 'gior'; stato.gPer = per; stato.gCat = cat || null; stato.gSub = null;
  salvaUI(); render(); window.scrollTo({ top: 0 });
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-gio]');
  if (a && !e.target.closest('summary')) { apriGiornale(a.dataset.gm, a.dataset.gio); return; }
  const p = e.target.closest('[data-gper]');
  if (p) { stato.gPer = p.dataset.gper; salvaUI(); render(); return; }
  const c = e.target.closest('[data-gcat]');
  if (c) { const v = c.dataset.gcat || null; stato.gCat = stato.gCat === v ? null : v; stato.gSub = null; salvaUI(); render(); return; }
  const s = e.target.closest('[data-gsub]');
  if (s) { stato.gSub = stato.gSub === s.dataset.gsub ? null : s.dataset.gsub; salvaUI(); render(); }
});
