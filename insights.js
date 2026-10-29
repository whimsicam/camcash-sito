/* CAM Cash — Insights: frasi automatiche (regole) + nota "The Piggy Brief" (D.nota, scritta da Claude il 2 e il 17).
   Usa le funzioni globali di app.js (agg, budget, infoMese, sposta, eur0, ...). Nessun dato esce dal browser. */

const PIGGY = `<svg class="piggy" viewBox="-18 -18 136 136" aria-hidden="true"><defs>
<filter id="pgA" filterUnits="userSpaceOnUse" x="-18" y="-18" width="136" height="136"><feGaussianBlur stdDeviation="11"/></filter>
<filter id="pgB" filterUnits="userSpaceOnUse" x="-18" y="-18" width="136" height="136"><feGaussianBlur stdDeviation="3.5"/></filter></defs>
<g filter="url(#pgA)" fill="#F8B4D9"><circle cx="50" cy="58" r="32"/><path d="M28 42 L28 12 L48 31 Z" stroke="#F8B4D9" stroke-width="7" stroke-linejoin="round"/><path d="M72 42 L72 12 L52 31 Z" stroke="#F8B4D9" stroke-width="7" stroke-linejoin="round"/></g>
<g filter="url(#pgB)" fill="#F8B4D9"><circle cx="50" cy="58" r="22"/><path d="M30 42 L30 20 L47 33 Z" stroke="#F8B4D9" stroke-width="7" stroke-linejoin="round"/><path d="M70 42 L70 20 L53 33 Z" stroke="#F8B4D9" stroke-width="7" stroke-linejoin="round"/></g>
<circle cx="37" cy="55" r="9.5" fill="#fff" fill-opacity=".3" stroke="#1C1B1B" stroke-width="2.8"/><circle cx="63" cy="55" r="9.5" fill="#fff" fill-opacity=".3" stroke="#1C1B1B" stroke-width="2.8"/>
<path d="M46.5 54 q3.5 -3 7 0" fill="none" stroke="#1C1B1B" stroke-width="2.8" stroke-linecap="round"/><circle cx="37" cy="56" r="2.8" fill="#1C1B1B"/><circle cx="63" cy="56" r="2.8" fill="#1C1B1B"/></svg>`;

const COPPA = '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v2.5H8V17h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1a2 2 0 0 0 1.2 1.8A5 5 0 0 1 7 8V7zm10 0v1c0 .6-.1 1.2-.2 1.8A2 2 0 0 0 18 8V7h-1z"/><rect x="7" y="20" width="10" height="1.6" rx=".8"/></svg>';
const TIPI = {
  stop: ['Fermati', 'c-coral', '!'], slow: ['Rallenta', 'c-yel', '→'], budget: ['Rivedi il budget', 'c-yel', '✎'],
  info: ['Da sapere', 'c-yel', 'i'], ok: ['Bene', 'c-mint', '✓'], margine: ['Puoi spendere', 'c-mint', '+'],
  abit: ['Abitudine', 'c-lav', '◐'], tantum: ['Una tantum', 'c-lav', '✦'], record: ['Record', 'c-mint', '★'], coppa: ['Record', 'c-yel', COPPA], over: ['Sopra budget', 'c-coral', '!'],
};
const b = s => `<b>${esc(s)}</b>`;
const e0 = v => `${num(v, 0)} €`;
const gg = n => `${n} ${n === 1 ? 'giorno' : 'giorni'}`;

// mesi chiusi (completi) prima di k
function mesiChiusiPrima(k, quanti) {
  const out = []; let m = sposta(k, -1);
  for (let i = 0; i < 24 && out.length < quanti; i++, m = sposta(m, -1)) {
    const inf = infoMese(m);
    if (inf.importato && D.tx.some(t => t[1] === m)) out.push(m);   // un mese passato con dati conta come chiuso
  }
  return out;
}

// giorno con più spese (costi variabili, viaggi inclusi; esclusi affitto e abbonamenti)
function giornoRecord(dal, al) {
  const tot = {}, perCat = {};
  for (const [d, m, c, s, i] of D.tx) {
    if (d < dal || d > al || !COSTI.includes(c) || ['Housing', 'Subscriptions'].includes(c)) continue;
    tot[d] = (tot[d] || 0) - i; perCat[d] = perCat[d] || {}; perCat[d][c] = (perCat[d][c] || 0) - i;
  }
  const best = Object.entries(tot).sort((x, y) => y[1] - x[1])[0];
  if (!best || best[1] <= 0) return null;
  const [d, v] = best, cats = Object.entries(perCat[d]).filter(x => x[1] > 0.5).sort((x, y) => y[1] - x[1]);
  return { d, v, cats };
}
function frRecord(r, quando) {
  const [y, m, g] = ymd(r.d), wd = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'][dow(y, m, g)];
  const dett = r.cats.length === 1 ? r.cats[0][0] : r.cats.slice(0, 2).map(([c, v]) => `${c} ${e0(v)}`).join(', ');
  return { t: 'coppa', p: 22, x: `Il giorno più caro ${quando}: ${b(`${wd} ${g} ${MESI[m - 1]}`)}, ${b(e0(r.v))}${dett ? ` (${dett}${r.cats.length > 2 ? '…' : ''})` : ''}.` };
}

// ---- regole sul mese in corso (k con dati fino al giorno `fino`)
function regoleMese(k, info) {
  const out = [], a = agg(k, info.fino), bud = budget(k), n = info.n, f = info.fino, frac = f / n, resto = n - f;
  const nome = meseNome(k);
  let varSp = 0, varBud = 0;
  for (const c of VARIAB) {
    const s = a.spese[c] || 0, bb = bud[c] || 0;
    varSp += s; varBud += bb;
    if (bb <= 0 && s <= 0.5) continue;
    if (bb > 0 && s > bb + 0.5 && s - bb < Math.max(10, bb * 0.05)) {
      out.push({ t: 'slow', p: 75, x: `${b(c)} è al limite: ${e0(s)} su ${e0(bb)} di budget${resto > 0 ? `, a ${gg(resto)} dalla fine del mese` : ''}. Da qui in poi ogni spesa va oltre.` });
    } else if (bb > 0 && s > bb + 0.5) {
      out.push({ t: 'stop', p: 100 + (s - bb) / bb * 50, x: `${b(c)} è a ${e0(s)} su ${e0(bb)} di budget: sei già ${e0(s - bb)} oltre. Per ${nome} meglio fermarsi qui.` });
    } else if (bb > 0 && frac >= 0.2 && resto > 0 && s / frac > bb * 1.1 && s > 15) {
      const proj = s / frac, r = bb - s;
      out.push({ t: 'slow', p: 80 + (proj - bb) / bb * 30, x: `${b(c)}: a questo ritmo chiudi ${nome} a circa ${e0(proj)}, budget ${e0(bb)}. Restano ${e0(r)} per ${gg(resto)}: al massimo ${e0(r / resto)} al giorno.` });
    } else if (bb >= 30 && frac >= 0.6 && resto > 0 && s < bb * frac * 0.6 && bb - s >= 20) {
      out.push({ t: 'margine', p: 35 + (bb - s) / 10, x: `${b(c)}: ${e0(s)} su ${e0(bb)}. Restano ${e0(bb - s)} per ${gg(resto)}, se ti serve hai margine.` });
    }
  }
  const marg = out.filter(r => r.t === 'margine');
  if (marg.length > 2) marg.slice(2).forEach(r => out.splice(out.indexOf(r), 1));
  // ritmo complessivo delle spese variabili
  if (varBud > 0 && frac >= 0.15 && resto > 0) {
    const atteso = varBud * frac, q = varSp / varBud;
    if (varSp > varBud) out.push({ t: 'stop', p: 95, x: `Spese variabili già oltre il budget del mese: ${e0(varSp)} su ${e0(varBud)}, ${e0(varSp - varBud)} sopra con ${gg(resto)} ancora da fare. Da qui a fine mese solo l'indispensabile.` });
    else if (varSp > atteso * 1.1) out.push({ t: 'slow', p: 70, x: `Spese variabili al ${pct(q)} del budget al giorno ${f}, cioè al ${pct(frac)} del mese. Per rientrare: al massimo ${e0((varBud - varSp) / resto)} al giorno fino a fine mese.` });
    else out.push({ t: 'ok', p: 30, x: `Spese variabili al ${pct(q)} del budget al giorno ${f} (${pct(frac)} del mese): sei in linea. Restano ${e0(varBud - varSp)}, circa ${e0((varBud - varSp) / resto)} al giorno.` });
  }
  const rec = f >= 3 ? giornoRecord(`${k}-01`, `${k}-${String(f).padStart(2, '0')}`) : null;
  if (rec) out.push(frRecord(rec, 'del mese'));
  // frequenza bar & ristoranti rispetto ai mesi prima, a parità di giorni
  const BR = 'Bar & Restaurant';
  if (VARIAB.includes(BR) && f >= 7) {
    const conta = (m, fino) => D.tx.filter(t => t[1] === m && t[2] === BR && t[4] < 0 && ymd(t[0])[2] <= fino && meseDi(t[0]) === m).length;
    const prev = mesiChiusiPrima(k, 3), cur = conta(k, f);
    if (prev.length && cur >= 3) {
      const media = prev.reduce((s, m) => s + conta(m, f), 0) / prev.length;
      if (media > 0 && Math.abs(cur - media) / media >= 0.3) {
        const tk = (a.spese[BR] || 0) / cur;
        out.push({ t: 'abit', p: 25, x: `${cur} uscite tra bar e ristoranti nei primi ${f} giorni, contro una media di ${num(media, 0)} nello stesso periodo dei mesi prima. Scontrino medio ${e0(tk)}.` });
      }
    }
  }
  return out;
}

// ---- regole sui mesi chiusi (revisione budget, una tantum, record, abitudini)
function regoleStoria(k) {
  const out = [], chiusi = mesiChiusiPrima(k, 6);
  if (!chiusi.length) return out;
  const ult = chiusi[0], a3 = chiusi.slice(0, 3), ag = Object.fromEntries(chiusi.map(m => [m, agg(m)]));
  for (const c of VARIAB) {
    // rivedi budget: ultimi 3 mesi chiusi tutti molto sotto o tutti molto sopra
    if (a3.length === 3) {
      const sp = a3.map(m => ag[m].spese[c] || 0), bd = a3.map(m => budget(m)[c] || 0), bk = budget(k)[c] || 0;
      const media = sp.reduce((s, v) => s + v, 0) / 3;
      const nuovo = Math.max(5, Math.round(media * 1.1 / 5) * 5);
      if (bk > 0 && bd.every(v => v > 0) && sp.every((v, i) => v < bd[i] * 0.6) && bk - nuovo >= 15)
        out.push({ t: 'budget', p: 50, x: `${b(c)} negli ultimi 3 mesi: in media ${e0(media)}, contro un budget di ${e0(bk)}. Si può scendere a ${e0(nuovo)} e liberare ${e0(bk - nuovo)} al mese.` });
      else if (bk > 0 && sp.every((v, i) => bd[i] > 0 && v > bd[i] * 1.3) && nuovo - bk >= 15)
        out.push({ t: 'budget', p: 55, x: `${b(c)} sopra budget per 3 mesi di fila (media ${e0(media)} contro ${e0(bk)}). O si taglia, o il budget realistico è circa ${e0(nuovo)}.` });
    }
    // una tantum o abitudine nuova: ultimo mese chiuso molto sopra la media dei mesi prima
    if (chiusi.length >= 4) {
      const v = m => ag[m].spese[c] || 0, base = chiusi.slice(2).map(v).reduce((t, x) => t + x, 0) / (chiusi.length - 2);
      const alto = x => x > Math.max(base * 3, base + 100), quasi = x => x > Math.max(base * 2, 50);
      const s = v(ult), p1 = v(chiusi[1]), ora = infoMese(k).importato ? (agg(k, infoMese(k).fino).spese[c] || 0) : 0;
      if (alto(s) && (quasi(p1) || quasi(ora))) {
        const [m2, v2] = quasi(ora) ? [k, ora] : [chiusi[1], p1];
        const [ma, va, mb, vb] = m2 > ult ? [ult, s, m2, v2] : [m2, v2, ult, s];
        out.push({ t: 'abit', p: 48, x: `${b(c)} non è più occasionale: ${e0(va)} a ${meseNome(ma)} e ${e0(vb)} a ${meseNome(mb)}${mb === k ? ' (finora)' : ''}, contro una media di ${e0(base)} nei mesi prima. Conviene darle un budget realistico o un tetto.` });
      } else if (alto(s)) {
        const anno = -D.tx.filter(t => t[2] === c && t[1].slice(0, 4) === ult.slice(0, 4) && t[1] <= ult).reduce((t, x) => t + x[4], 0);
        out.push({ t: 'tantum', p: 40, x: `${b(c)} a ${meseNome(ult)}: ${e0(s)}, il ${pct(s / anno)} di quanto speso nell'anno. È un picco, non un trend: non serve cambiare budget.` });
      }
    }
  }
  // record di savings rate tra i mesi chiusi dell'anno
  const anno = chiusi.filter(m => m.slice(0, 4) === ult.slice(0, 4));
  const sr = m => { const x = ag[m], en = entrateSR(x); return en > 0 ? (en - x.costi) / en : null; };
  if (anno.length >= 3 && sr(ult) !== null && anno.every(m => sr(m) === null || sr(m) <= sr(ult) + 1e-9))
    out.push({ t: 'record', p: 45, x: `${meseTit(ult)} è il mese con il savings rate più alto dell'anno: ${pct(sr(ult))}${conExtra() ? '' : ' senza extra'}.` });
  // weekend
  const y = ymd(k)[0], giorni = spesaGiorni(`${y}-01-01`, D.data_al);
  let tot = 0, we = 0, sab = 0;
  for (const [d, v] of Object.entries(giorni)) { const [yy, mm, dd] = ymd(d), w = dow(yy, mm, dd); tot += v; if (w >= 5) we += v; if (w === 5) sab += v; }
  if (tot > 0 && we / tot >= 0.4)
    out.push({ t: 'abit', p: 20, x: `Il ${pct(we / tot)} delle spese variabili dell'anno arriva il sabato e la domenica; il sabato da solo vale ${e0(sab)}.` });
  return out;
}

// ---- riepilogo del mese appena chiuso (primi giorni del mese nuovo)
function regoleMesePrima(k) {
  const m = sposta(k, -1), inf = infoMese(m);
  if (!inf.importato) return [];
  const a = agg(m, inf.fino), bud = budget(m), out = [];
  const sopra = VARIAB.filter(c => (bud[c] || 0) > 0 && (a.spese[c] || 0) > bud[c] + 0.5).sort((x, y) => (a.spese[y] - bud[y]) - (a.spese[x] - bud[x]));
  const sotto = VARIAB.filter(c => (bud[c] || 0) >= 30 && (a.spese[c] || 0) <= bud[c]);
  const vs = VARIAB.reduce((s, c) => s + (a.spese[c] || 0), 0), vb = VARIAB.reduce((s, c) => s + (bud[c] || 0), 0);
  if (vb > 0) out.push({ t: vs > vb ? 'over' : 'ok', p: 90, x: `${meseTit(m)} chiude con ${e0(vs)} di spese variabili su ${e0(vb)} di budget (viaggi esclusi): ${vs > vb ? `${e0(vs - vb)} sopra` : `${e0(vb - vs)} sotto`}${inf.chiuso ? '' : `, dati al ${inf.fino}`}.` });
  if (sopra.length) out.push({ t: 'over', p: 85, x: `Sopra budget: ${sopra.slice(0, 3).map(c => `${b(c)} ${e0(a.spese[c])} su ${e0(bud[c])}`).join(', ')}.` });
  const rec = giornoRecord(`${m}-01`, `${m}-31`);
  if (rec) out.push(Object.assign(frRecord(rec, `di ${meseNome(m)}`), { p: 55 }));
  if (sotto.length) out.push({ t: 'ok', p: 60, x: `Sotto budget: ${sotto.slice(0, 4).map(c => b(c)).join(', ')}.` });
  return out;
}
function regoleInizio(k) {
  const bud = budget(k), out = [], n = giorniMese(k);
  const vb = VARIAB.reduce((s, c) => s + (bud[c] || 0), 0);
  if (vb > 0) out.push({ t: 'info', p: 75, x: `Budget di ${meseNome(k)}: ${e0(budgetCosti(k))} in tutto, di cui ${e0(vb)} di spese variabili, circa ${e0(vb / n)} al giorno.` });
  // voci con budget diverso dal solito questo mese
  const prev = mesiChiusiPrima(k, 1)[0], speciali = prev ? VARIAB.filter(c => Math.abs((bud[c] || 0) - (budget(prev)[c] || 0)) >= 15) : [];
  if (speciali.length) out.push({ t: 'info', p: 65, x: `Questo mese il budget cambia per ${speciali.map(c => `${b(c)} ${e0(bud[c] || 0)}`).join(', ')}.` });
  return out;
}

function insights(k) {
  const info = infoMese(k), inizio = !info.importato || info.fino < 7;
  let gruppi;
  if (inizio) gruppi = [[`${meseTit(sposta(k, -1)).split(' ')[0]} in tre righe`, regoleMesePrima(k)],
                        [`${meseTit(k).split(' ')[0]}, si parte`, regoleInizio(k).concat(info.importato ? regoleMese(k, info) : [])],
                        ['Dallo storico', regoleStoria(k)]];
  else gruppi = [['Da fare adesso', regoleMese(k, info).filter(r => ['stop', 'slow'].includes(r.t))],
                 ['Come sta andando', regoleMese(k, info).filter(r => !['stop', 'slow'].includes(r.t)).concat(regoleStoria(k))]];
  const coppe = gruppi.flatMap(g => g[1].filter(r => r.t === 'coppa'));
  gruppi.forEach(g => { g[1] = g[1].filter(r => r.t !== 'coppa'); g[1].sort((x, y) => y.p - x.p); });
  const tutte = gruppi.flatMap(g => g[1]);   // senza i record (coppe), che vanno in testa a "Vedi tutte"
  const urg = inizio ? 0 : tutte.filter(r => ['stop', 'slow'].includes(r.t)).length;
  return { gruppi, tutte, urg, inizio, coppe };
}

function riga(r) {
  const [lab, cls, ic] = TIPI[r.t];
  return `<div class="ins"><div class="ic ${cls}">${ic}</div><div class="tx"><span class="tag ${cls}">${lab}</span>${r.x}</div></div>`;
}

function cardInsights(k) {
  const { gruppi, tutte, urg, inizio, coppe } = insights(k);
  const nota = D.nota && D.nota.testo && D.nota.testo.length ? D.nota : null;
  const dNota = nota ? nota.data.split('-').reverse().slice(0, 2).join('/') : '';
  const sub = [urg ? `${urg} da sistemare` : (inizio ? `${meseNome(sposta(k, -1))} chiuso` : 'tutto in linea'), nota ? `brief del ${dNota}` : ''].filter(Boolean).join(' · ');
  const MAX = 3;
  let mostrate = 0, corpo = '', resto = '';
  for (const [tit, righe] of gruppi) {
    if (!righe.length) continue;
    const vis = righe.slice(0, Math.max(0, MAX - mostrate)), nas = righe.slice(vis.length);
    if (vis.length) corpo += `<div class="ins-sep">${tit}</div>` + vis.map(riga).join('');
    if (nas.length) resto += (vis.length ? '' : `<div class="ins-sep">${tit}</div>`) + nas.map(riga).join('');
    mostrate += vis.length;
  }
  if (coppe.length) resto = `<div class="ins-coppa">${coppe.map(riga).join('')}</div>` + resto;
  const altre = tutte.length + coppe.length - mostrate, totale = tutte.length + coppe.length;
  const notaHtml = nota ? `<div class="brief"><div class="k"><span>The Piggy Brief</span><span>${dNota}</span></div>${nota.testo.map(p => `<p>${p}</p>`).join('')}</div>` : '';
  const open = (stato.aperti || {}).ins ? 'open' : '';
  return `<details class="card insights" data-id="ins" ${open}><summary>${PIGGY}<div class="t"><h3>Insights</h3><div class="sub">${sub}</div></div>${CHEV}</summary>
    <div class="body">${notaHtml}${corpo || '<p class="muted">Ancora niente da segnalare: torna fra qualche giorno.</p>'}
    ${altre > 0 ? `<details class="ins-altre"><summary>Vedi tutte (${totale})</summary>${resto}</details>` : ''}</div></details>`;
}

// ---- scheda Insights dell'anno
function cardInsightsAnno(y) {
  const mesi = Array.from({ length: 12 }, (_, i) => mk(y, i + 1)).filter(m => infoMese(m).importato && D.tx.some(t => t[1] === m));
  if (!mesi.length) return '';
  const out = [], ag = Object.fromEntries(mesi.map(m => [m, agg(m, infoMese(m).fino)]));
  const chiusi = mesi.filter(m => !infoMese(m).corrente);
  const rec = giornoRecord(`${y}-01-01`, `${y}-12-31`);
  if (rec) out.push(Object.assign(frRecord(rec, `dell'anno`), { p: 90 }));
  if (chiusi.length) {
    const caro = chiusi.slice().sort((a, b) => ag[b].costi - ag[a].costi)[0];
    out.push({ t: 'coppa', p: 80, x: `Il mese più caro: ${b(meseTit(caro))}, ${b(e0(ag[caro].costi))} di spese, viaggi inclusi.` });
  }
  // categoria che pesa di più
  const tot = {}; VARIAB.forEach(c => tot[c] = mesi.reduce((s, m) => s + (ag[m].spese[c] || 0), 0));
  const totV = Object.values(tot).reduce((s, v) => s + v, 0), [cTop, vTop] = Object.entries(tot).sort((a, b) => b[1] - a[1])[0] || [];
  if (cTop && totV > 0) out.push({ t: 'abit', p: 60, x: `La voce che pesa di più tra le spese variabili: ${b(cTop)}, ${e0(vTop)}, il ${pct(vTop / totV)} del totale (viaggi esclusi).` });
  regoleStoria(sposta(mesi[mesi.length - 1], 1)).filter(r => ['abit', 'budget'].includes(r.t)).forEach(r => out.push(r));
  out.sort((a, b) => b.p - a.p);
  const coppe = out.filter(r => r.t === 'coppa'), altre = out.filter(r => r.t !== 'coppa');
  const vis = altre.slice(0, 3), nas = altre.slice(3);
  const open = (stato.aperti || {}).insA ? 'open' : '';
  return `<details class="card insights" data-id="insA" ${open}><summary>${PIGGY}<div class="t"><h3>Insights</h3><div class="sub">il ${y} finora</div></div>${CHEV}</summary>
    <div class="body"><div class="ins-sep">L'anno in pillole</div>${vis.map(riga).join('')}
    ${coppe.length + nas.length ? `<details class="ins-altre"><summary>Vedi tutte (${out.length})</summary>${coppe.length ? `<div class="ins-coppa">${coppe.map(riga).join('')}</div>` : ''}${nas.map(riga).join('')}</details>` : ''}</div></details>`;
}
