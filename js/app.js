// Codenames site: Table (real-table companion), Play (computer / pass-the-phone / online),
// Links (word connections explorer), Settings. Rules live in engine.js + game.js.
import * as E from './engine.js';
import { game, setAssoc, setBoardWords, role, seatName } from './game.js';

const BUILD = '2026-10-19.1';
const LS = 'codenames:v1';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = x => JSON.parse(JSON.stringify(x));
const pct = x => (x < 0.005 && x > 0 ? '<1' : Math.round(100 * x)) + '%';

// ------------------------------------------------------------------ art (own drawings)
const ART = {
  agent: '<svg viewBox="0 0 40 40" aria-hidden="true"><path fill="currentColor" d="M8.5 16.8h23l-3.4-2.3-1.9-6.2c-.5-1.7-2.3-2.5-3.9-1.8L20 7.4l-2.3-.9c-1.6-.7-3.4.1-3.9 1.8l-1.9 6.2z"/><circle fill="currentColor" cx="20" cy="21.4" r="5.4"/><path fill="currentColor" d="M7 38c0-8 5.8-12.4 13-12.4S33 30 33 38z"/></svg>',
  bystander: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle fill="currentColor" cx="20" cy="15" r="6.4"/><path fill="currentColor" d="M8 37c0-8 5.4-13 12-13s12 5 12 13z"/></svg>',
  assassin: '<svg viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="20" cy="20" r="11"/><path d="M20 4v9M20 27v9M4 20h9M27 20h9"/><circle cx="20" cy="20" r="2.2" fill="currentColor" stroke="none"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  robot: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="8" y="12" width="24" height="18" rx="5"/><circle cx="15.5" cy="21" r="2.2" fill="currentColor"/><circle cx="24.5" cy="21" r="2.2" fill="currentColor"/><path d="M20 12V7M17 34h6"/></svg>',
  person: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="20" cy="14" r="6"/><path d="M8 34c0-7 5.4-11 12-11s12 4 12 11"/></svg>',
  teams: '<svg viewBox="0 0 40 40"><circle cx="13" cy="14" r="5" fill="#e5544b"/><path d="M4 32c0-6 4-9.5 9-9.5s9 3.5 9 9.5z" fill="#e5544b"/><circle cx="27" cy="14" r="5" fill="#4d8dff"/><path d="M18 32c0-6 4-9.5 9-9.5s9 3.5 9 9.5z" fill="#4d8dff"/></svg>',
  duet: '<svg viewBox="0 0 40 40"><circle cx="14" cy="14" r="5" fill="#3fb35f"/><path d="M5 32c0-6 4-9.5 9-9.5s9 3.5 9 9.5z" fill="#3fb35f"/><circle cx="26" cy="14" r="5" fill="#2e8a49"/><path d="M17 32c0-6 4-9.5 9-9.5s9 3.5 9 9.5z" fill="#2e8a49"/></svg>',
  globe: '<svg viewBox="0 0 40 40" fill="none" stroke="#6ea8fe" stroke-width="2.2"><circle cx="20" cy="20" r="13"/><path d="M7 20h26M20 7c4 4 5.5 8.5 5.5 13S24 29 20 33M20 7c-4 4-5.5 8.5-5.5 13S16 29 20 33"/></svg>',
};
const coverArt = c => (c === 'A' ? ART.assassin : c === 'N' ? ART.bystander : ART.agent);

// ------------------------------------------------------------------ saved state
function defaults() {
  return {
    tab: 'table',
    settings: { style: 'normal', odds: true, heat: true, duetTimer: 9, name: '' },
    table: { variant: 'classic', code: '', revealed: Array(25).fill(false), order: [], spy: false, team: null, side: 'A', marks: Array(25).fill(0) },
    play: null,
    setup: { pick: 'guess', seats: ['human', 'human', 'computer', 'computer'], duetPartner: 'computer', onlineVariant: 'classic', onlineSeats: 4 },
  };
}
let S = defaults();
try {
  const saved = JSON.parse(localStorage.getItem(LS));
  if (saved && typeof saved === 'object') S = { ...S, ...saved, settings: { ...S.settings, ...saved.settings }, table: { ...S.table, ...saved.table }, setup: { ...S.setup, ...saved.setup } };
} catch (e) { /* private mode or bad data: start fresh */ }
function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { /* storage blocked */ } }

// drafts (not saved): clue being typed
const draft = { table: { word: '', n: 1 }, play: { word: '', n: 1 } };
let META = null, ASSOC = null, assocErr = null;
let gen = 0, botTimer = null, online = null, osnap = null, hint = null;

// ------------------------------------------------------------------ data loading
async function loadData() {
  META = await fetch('data/words.json').then(r => { if (!r.ok) throw new Error('words ' + r.status); return r.json(); });
  setBoardWords(META.board);
  if (!S.table.code) { S.table.code = E.randomCode(); save(); }
  fetch('data/strength.json').then(r => r.ok ? r.json() : null).then(j => { STRENGTH = j; if (S.tab === 'settings') renderSettings(); }).catch(() => {});
  renderAll();
  try {
    const buf = await fetch('data/assoc.bin').then(r => { if (!r.ok) throw new Error('table ' + r.status); return r.arrayBuffer(); });
    ASSOC = new E.Assoc(new Int8Array(buf), META.board, META.clues, META.cpu);
    setAssoc(ASSOC);
  } catch (e) { assocErr = e.message; }
  renderAll();
  scheduleBots();
}

// ------------------------------------------------------------------ helpers
function wordsOf(idx) { return idx.map(i => META.board[i]); }
function lenClass(w) { return w.length >= 9 ? 'l9' : w.length === 8 ? 'l8' : w.length === 7 ? 'l7' : ''; }
function teamName(t) { return t === 'R' ? 'Red' : t === 'B' ? 'Blue' : t; }
// red (bad) -> green (good). x in 0..1 where 1 = good
function scaleColor(x) { x = Math.max(0, Math.min(1, x)); return `hsl(${Math.round(x * 130)} 70% 58%)`; }

function cardHTML(p, word, o) {
  // o: {tint, cover, coverWord, half, heat, pick, disabled}
  const cls = ['card'];
  if (o.tint) cls.push('k-' + o.tint);
  if (o.pick) cls.push('pick');
  let inner = `<span class="mirror">${esc(word)}</span><span class="w ${lenClass(word)}">${esc(word)}</span>`;
  if (o.heat != null && !o.cover) inner += `<i class="heat" style="transform:scaleX(${o.heat.toFixed(3)})"></i>`;
  if (o.cover) inner += `<span class="cover-tile c-${o.cover}${o.half ? ' half' : ''}${o.noAnim ? ' still' : ''}">${coverArt(o.cover)}${o.half ? `<span class="cw">${esc(o.half)}</span>` : `<span class="cw">${esc(word)}</span>`}</span>`;
  return `<button class="${cls.join(' ')}" data-pos="${p}" ${o.disabled ? 'disabled' : ''} aria-label="${esc(word)}">${inner}</button>`;
}

// Covers that were already showing don't flip again on every render.
const seenCovers = new Map(); // boardKey -> Set(pos)
function boardHTML(key, words, optsFor) {
  const seen = seenCovers.get(key) || new Set();
  const html = words.map((w, p) => {
    const o = optsFor(p);
    if (o.cover && seen.has(p + o.cover + (o.half || ''))) o.noAnim = true;
    return cardHTML(p, w, o);
  }).join('');
  const now = new Set();
  words.forEach((w, p) => { const o = optsFor(p); if (o.cover) now.add(p + o.cover + (o.half || '')); });
  seenCovers.set(key, now);
  return `<div class="board" data-board="${esc(key)}">${html}</div>`;
}

function stepper(ctx) {
  const n = draft[ctx].n;
  return `<div class="stepper"><button data-act="n-" data-ctx="${ctx}" aria-label="Fewer">−</button><b>${n < 0 ? '∞' : n}</b><button data-act="n+" data-ctx="${ctx}" aria-label="More">+</button></div>`;
}

function clueInput(ctx, placeholder) {
  return `<div class="clue-in"><input id="clue-${ctx}" data-ctx="${ctx}" placeholder="${placeholder}" value="${esc(draft[ctx].word)}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="Clue">${stepper(ctx)}</div>`;
}

// items for the odds: unrevealed words with their colour as the clue team sees it
function riskItems(words, key, open, clueIdx) {
  const items = [];
  for (let p = 0; p < 25; p++) if (open[p]) items.push({ p, sim: ASSOC.sim(words[p], clueIdx), color: key[p] });
  return items;
}

// odds + nearest words for a clue. Returns {html, heat: Map(pos -> 0..1)}
function oddsBlock(boardIdx, key, open, team, word, n, opts = {}) {
  if (!word) return { html: `<div class="msg">${esc(opts.empty || 'Type a clue to see how risky it is.')}</div>`, heat: null };
  const chk = E.checkClue(word, wordsOf(boardIdx));
  if (!chk.ok) return { html: `<div class="msg bad">${esc(chk.reason)}</div>`, heat: null, bad: true };
  if (!ASSOC) return { html: `<div class="msg">${assocErr ? 'Word links failed to load.' : 'Loading word links…'}</div>`, heat: null };
  const c = ASSOC.clueIndex(word);
  if (c < 0) return { html: `<div class="msg">Not in the computer's ${ASSOC.nC.toLocaleString()} words, so no odds. You can still give it.</div>`, heat: null, unknown: true };
  const items = riskItems(boardIdx, key, open, c);
  const guesses = n > 0 ? n : 1;
  const r = E.riskOfClue(items, team, guesses);
  const T = E.DEFAULT_T;
  const tot = items.reduce((s, it) => s + Math.exp(it.sim / T), 0);
  const sorted = items.slice().sort((a, b) => b.sim - a.sim);
  const heat = new Map();
  const top = sorted[0].sim, bot = sorted[sorted.length - 1].sim;
  for (const it of items) heat.set(it.p, Math.max(0.04, (it.sim - bot) / Math.max(0.05, top - bot)));
  const duet = team === 'G';
  const cells = [
    [`${r.expRight.toFixed(1)}<small style="font-size:12px;color:var(--muted)">/${r.guesses}</small>`, 'Right', scaleColor(r.expRight / r.guesses)],
    [pct(r.assassin), 'Assassin', scaleColor(1 - r.assassin / 0.08)],
    duet ? null : [pct(r.opponent), 'Their word', scaleColor(1 - r.opponent / 0.3)],
    [pct(r.neutral), 'Bystander', scaleColor(1 - r.neutral / (duet ? 0.3 : 0.45))],
  ].filter(Boolean);
  let html = `<div class="odds" style="grid-template-columns:repeat(${cells.length},1fr)">${cells.map(([v, l, col]) => `<div class="odd"><b style="color:${col}">${v}</b><span>${l}</span></div>`).join('')}</div>`;
  html += `<div class="near">${sorted.slice(0, opts.rows || 6).map(it => {
    const w = META.board[boardIdx[it.p]];
    return `<div class="near-row"><span class="dot ${it.color || 'N'}"></span><span class="nm">${esc(w)}</span><span class="track"><i style="width:${Math.max(3, Math.min(100, it.sim / 0.7 * 100)).toFixed(0)}%;background:${it.color === team ? 'var(--good)' : it.color === 'A' ? '#ff5d52' : it.color === 'N' ? 'var(--tan)' : 'var(--bad)'}"></i></span><span class="pc">${pct(Math.exp(it.sim / T) / tot)}</span></div>`;
  }).join('')}</div>`;
  html += `<div class="row small muted" style="margin-top:4px;justify-content:space-between"><span>Bar = closeness · % = picked first</span><button class="q" data-help="odds" aria-label="Why these odds">?</button></div>`;
  return { html, heat, r };
}

// ------------------------------------------------------------------ toast / sheet / cover
let toastTimer = null;
function toast(msg, undo) {
  const layer = $('#layer');
  layer.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button>Undo</button>' : ''}`;
  if (undo) el.querySelector('button').onclick = () => { el.remove(); undo(); };
  layer.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3500);
}
function sheet(html, onBind) {
  closeSheet();
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  back.addEventListener('click', e => { if (e.target === back) closeSheet(); });
  $('#layer').appendChild(back);
  onBind && onBind(back.firstChild);
}
function closeSheet() { $('#layer .sheet-back')?.remove(); }

const HELP = {
  odds: ['Why these odds', 'Closeness comes from GloVe word links (Stanford, learned from Wikipedia and news text). The odds assume your guessers usually pick the closest words, but not always, and keep guessing until they have made as many guesses as your number. "Picked first" is the chance each word is the first guess.'],
  strength: ['How strong is the computer?', null],
  style: ['Clue style', 'Safe gives clues only when its words are clearly closer than every wrong word, so fewer words per clue. Bold links more words and takes more risk.'],
  links: ['Word links', 'Lines join pairs of board words that the word data puts close together. Thick lines are the strongest links: a good clue usually sits between words that are linked.'],
  heat: ['Board heat', 'While you type a clue, a gold bar under each word shows how close it is to your clue.'],
  coop: ['Two-player rules', 'From the rulebook: your team plays a pretend opponent. After each of your turns, your spymaster covers one of their agents. Win before all 8 are covered; your score is how many of theirs are left.'],
};

// ------------------------------------------------------------------ TABLE tab
function tableBoard() {
  const t = S.table;
  if (t.variant === 'duet') { const d = E.genDuet(t.code, META.board.length); return { words: d.words, key: t.side === 'A' ? d.keyA : d.keyB, d }; }
  return E.genClassic(t.code, META.board.length);
}

function renderTable() {
  const el = $('#tab-table');
  if (!META) { el.innerHTML = '<div class="stage"><div class="msg">Loading words…</div></div>'; return; }
  const t = S.table, b = tableBoard();
  const duet = t.variant === 'duet';
  const ctx = 'table';
  let barHTML, panel = '', heat = null;
  if (duet) {
    const found = t.marks.filter(m => m === 1).length;
    barHTML = `<button class="chip" data-act="code">${esc(t.code)} ${ART.pencil}</button>
      <div class="seg" role="group" aria-label="Your side">${['A', 'B'].map(s => `<button data-act="side" data-v="${s}" class="${t.side === s ? 'on' : ''}">Side ${s}</button>`).join('')}</div>
      <span class="grow"></span><span class="counts"><span><i class="dot G"></i>${found}/15</span></span>`;
    const open = b.words.map((_, p) => t.marks[p] !== 1);
    const o = oddsBlock(b.words, b.key, open, 'G', draft.table.word, draft.table.n);
    heat = S.settings.heat ? o.heat : null;
    panel = `<h3>Check a clue</h3>${clueInput(ctx, 'Your clue')}${S.settings.odds ? o.html : ''}
      <div class="row" style="margin-top:8px"><button class="btn small" data-act="idea" data-ctx="table">${ART.robot.replace('<svg', '<svg width="16" height="16"')}Idea</button><button class="btn small" data-act="table-undo" ${t.order.length ? '' : 'disabled'}>Undo</button></div>
      <p class="small muted" style="margin-top:10px">Tap a word: agent found → bystander → clear. Colours show your side of the key.</p>`;
  } else {
    const c = { R: 0, B: 0 };
    b.key.forEach((k, p) => { if ((k === 'R' || k === 'B') && !t.revealed[p]) c[k]++; });
    barHTML = `<button class="chip" data-act="code" aria-label="Change board">${esc(t.code)} ${ART.pencil}</button>
      <span class="counts" title="Agents left"><span><i class="dot R"></i>${c.R}</span><span><i class="dot B"></i>${c.B}</span></span>
      <span class="grow"></span>
      <button class="switch ${t.spy ? 'on' : ''}" data-act="spy" aria-pressed="${t.spy}"><i></i>Spymaster</button>`;
    if (t.spy) {
      const team = t.team || b.start;
      const open = t.revealed.map(r => !r);
      const o = oddsBlock(b.words, b.key, open, team, draft.table.word, draft.table.n);
      heat = S.settings.heat ? o.heat : null;
      panel = `<div class="row" style="justify-content:space-between"><h3 style="margin:0">Check a clue</h3>
        <div class="seg" role="group" aria-label="Clue for">${['R', 'B'].map(x => `<button data-act="team" data-v="${x}" class="${team === x ? 'on' : ''}">${teamName(x)}</button>`).join('')}</div></div>
        <div style="margin-top:8px">${clueInput(ctx, 'Your clue')}</div>${S.settings.odds ? o.html : (o.bad ? o.html : '')}
        <div class="row" style="margin-top:8px"><button class="btn small" data-act="idea" data-ctx="table">${ART.robot.replace('<svg', '<svg width="16" height="16"')}Idea</button><button class="btn small" data-act="table-undo" ${t.order.length ? '' : 'disabled'}>Undo</button>
        <span class="small muted">${teamName(b.start)} goes first</span></div>`;
    } else {
      panel = `<div class="result" style="text-align:left"><b style="font-size:16px">${teamName(b.start)} team goes first</b>
        <p class="small muted" style="margin-top:4px">Same code on every phone = same board. Tap a word when a guesser picks it. Spymasters switch on <b>Spymaster</b> to see the key.</p></div>
        <div class="row" style="margin-top:8px"><button class="btn small" data-act="table-undo" ${t.order.length ? '' : 'disabled'}>Undo</button><button class="btn small" data-act="code">New board</button></div>`;
    }
  }
  const boardKey = `t:${t.variant}:${t.code}:${duet ? t.side : ''}`;
  const words = wordsOf(b.words);
  const bHTML = boardHTML(boardKey, words, p => {
    if (duet) {
      const m = t.marks[p];
      return { tint: b.key[p] === 'N' ? null : b.key[p], cover: m === 1 ? 'G' : m === 2 ? 'N' : null, half: m === 2 ? 'Bystander' : null, heat: heat && heat.get(p) };
    }
    return { tint: t.spy ? b.key[p] : null, cover: t.revealed[p] ? b.key[p] : null, heat: t.spy && heat ? heat.get(p) : null };
  });
  keepFocus(el, () => {
    el.innerHTML = `<div class="stage"><div class="boardwrap"><div class="bar">${barHTML}</div>${bHTML}</div><div class="panel">${panel}</div></div>`;
  });
}

// re-render without losing the caret in the clue box (the keyboard must not close on iPhone)
function keepFocus(el, fn) {
  const a = document.activeElement;
  const id = a && el.contains(a) && a.id;
  const sel = id && a.selectionStart;
  fn();
  if (id) { const n = document.getElementById(id); if (n) { n.focus({ preventScroll: true }); try { n.setSelectionRange(sel, sel); } catch (e) {} } }
}

function tableTap(p) {
  const t = S.table;
  if (t.variant === 'duet') {
    t.marks[p] = (t.marks[p] + 1) % 3;
    t.order.push({ p, prev: (t.marks[p] + 2) % 3 });
  } else {
    if (t.revealed[p]) return;
    t.revealed[p] = true; t.order.push({ p });
    const b = tableBoard();
    if (b.key[p] === 'A') toast('Assassin! ' + (t.spy ? '' : 'That team loses.'));
  }
  save(); renderTable();
}
function tableUndo() {
  const t = S.table, last = t.order.pop();
  if (!last) return;
  if (t.variant === 'duet') t.marks[last.p] = last.prev; else t.revealed[last.p] = false;
  save(); renderTable();
}
function codeSheet() {
  const t = S.table;
  const today = new Date();
  const daily = 'D' + String(today.getFullYear()).slice(2) + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
  sheet(`<h2>Board code</h2><p>Type the same code on every phone to get the same board and key.</p>
    <div class="field"><input id="codeIn" value="${esc(t.code)}" maxlength="8" autocapitalize="characters" autocomplete="off" aria-label="Board code" style="text-transform:uppercase;font-weight:800;letter-spacing:.15em;font-size:20px"></div>
    <div class="row" style="margin-top:10px"><div class="seg" role="group" aria-label="Game">${[['classic', 'Codenames'], ['duet', 'Duet']].map(([v, l]) => `<button data-v="${v}" class="${t.variant === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    <button class="btn small" id="rnd">Random</button><button class="btn small" id="daily">Today's</button></div>
    <div class="btns"><button class="btn" id="cancel">Cancel</button><button class="btn main" id="go">Use this board</button></div>`, sh => {
    let variant = t.variant;
    sh.querySelectorAll('.seg button').forEach(bt => bt.onclick = () => { variant = bt.dataset.v; sh.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === bt)); });
    $('#rnd', sh).onclick = () => { $('#codeIn', sh).value = E.randomCode(); };
    $('#daily', sh).onclick = () => { $('#codeIn', sh).value = daily; };
    $('#cancel', sh).onclick = closeSheet;
    $('#go', sh).onclick = () => {
      const code = E.normCode($('#codeIn', sh).value);
      if (!code) return;
      Object.assign(t, { code, variant, revealed: Array(25).fill(false), marks: Array(25).fill(0), order: [], team: null });
      draft.table.word = '';
      save(); closeSheet(); renderAll();
    };
  });
}

// ------------------------------------------------------------------ PLAY: local runner
// Same snapshot shape as online.js, plus it survives a reload (state saved in localStorage).
function localSnap() {
  const P = S.play, st = P.state;
  const toAct = game.isOver(st) ? [] : game.toAct(st);
  const humans = P.seats.map((k, i) => (k === 'human' ? i : -1)).filter(i => i >= 0);
  let seat = toAct.find(i => P.seats[i] === 'human');
  if (seat == null) seat = P.lastSeat ?? humans[0] ?? -1;
  return {
    mode: 'local', status: game.isOver(st) ? 'finished' : 'playing', toAct, mySeat: seat,
    seats: P.seats.map(k => ({ kind: k, name: '' })), pub: game.publicView(st),
    mine: seat >= 0 ? game.privateView(st, seat) : game.privateView(st, 0), myTurn: toAct.includes(seat), isHost: true,
  };
}
function localAct(seat, action) {
  const P = S.play;
  try {
    P.state = game.apply(clone(P.state), seat, clone(action));
  } catch (e) { toast(e.message); return false; }
  save(); renderAll(); scheduleBots();
  return true;
}
function scheduleBots() {
  if (!S.play || S.play.kind !== 'local' || !ASSOC) return;
  const P = S.play, st = P.state;
  if (botTimer || game.isOver(st)) return;
  const bots = game.toAct(st).filter(i => P.seats[i] === 'computer');
  if (!bots.length) return;
  const myGen = gen;
  const delay = st.phase === 'clue' ? 1100 : 800;
  botTimer = setTimeout(() => {
    botTimer = null;
    if (myGen !== gen || !S.play) return;
    const s2 = S.play.state;
    const seat = game.toAct(s2).find(i => S.play.seats[i] === 'computer');
    if (seat == null) return;
    try {
      const a = game.bot({ pub: game.publicView(s2), mine: game.privateView(s2, seat), state: s2 }, seat);
      S.play.state = game.apply(clone(s2), seat, a);
    } catch (e) { toast('Computer error: ' + e.message); return; }
    save(); renderAll(); scheduleBots();
  }, delay);
}
function stopGame() { gen++; clearTimeout(botTimer); botTimer = null; hint = null; }

function startLocal(variant, seats, extra = {}) {
  stopGame();
  const options = { variant, code: E.randomCode(), style: S.settings.style, timer: S.settings.duetTimer };
  const st = game.setup(seats.length, options, Math.random, seats.map(k => ({ kind: k })));
  S.play = { kind: 'local', variant, seats, state: st, lastSeat: null, shown: null, ratings: {}, hints: 0, ...extra };
  draft.play = { word: '', n: 1 };
  save(); renderAll(); scheduleBots();
}

function currentSnap() {
  if (!S.play) return null;
  if (S.play.kind === 'online') return osnap;
  return localSnap();
}
function act(action) {
  hint = null;
  if (S.play.kind === 'online') {
    online.act(action).then(r => { if (!r.ok) toast(r.message); });
    return true;
  }
  const snap = localSnap();
  return localAct(snap.mySeat, action);
}

// ------------------------------------------------------------------ PLAY tab render
function renderPlay() {
  const el = $('#tab-play');
  if (!META) { el.innerHTML = ''; return; }
  if (!S.play) { renderSetup(el); return; }
  const snap = currentSnap();
  if (!snap || !snap.pub) { renderOnlineLobby(el, snap); return; }
  const pub = snap.pub, mine = snap.mine || {};
  const seat = snap.mySeat;
  const duet = pub.variant === 'duet';
  const over = pub.phase === 'over';

  // pass-the-phone cover (local only): hide secrets while the phone changes hands
  if (S.play.kind === 'local' && !over) {
    const humans = S.play.seats.filter(k => k === 'human').length;
    if (humans > 1 && seat >= 0 && S.play.shown !== seat) {
      const prev = S.play.shown;
      const st = S.play.state;
      const secretChange = prev == null || duet || role(st, prev).spy !== role(st, seat).spy || role(st, seat).spy;
      if (secretChange) { showCover(seat, seatName(st, seat)); }
      else { S.play.shown = seat; S.play.lastSeat = seat; }
    }
  }

  const myRole = duet ? { side: seat === 0 ? 'A' : 'B' } : roleFromPub(pub, seat);
  const myTurn = snap.myTurn;
  const boardIdx = pub.w.map(w => META.board.indexOf(w));
  const key = duet ? (mine.key || (over ? (myRole.side === 'A' ? pub.keyA : pub.keyB) : null)) : (mine.key || pub.key);

  // ---- status line + clue banner
  let status = '';
  if (over) status = resultLine(pub, myRole);
  else if (duet) status = `<span class="turnline">Turns left <b style="color:var(--text)">${pub.timer}</b> · Agents left <b style="color:var(--text)">${pub.left}</b></span>`;
  else status = `<span class="counts"><span><i class="dot R"></i>${pub.counts.R}</span><span><i class="dot B"></i>${pub.counts.B}</span></span>`;
  const turnTeam = duet ? null : pub.turn;
  const actorName = over ? '' : who(pub, snap);
  const banner = pub.clue
    ? `<div class="cluebar"><span class="who">${duet ? 'Clue' : `<i class="dot ${turnTeam}"></i>`}</span><span class="cw">${esc(pub.clue.word)}</span><span class="cn">${pub.clue.n < 0 ? '∞' : pub.clue.n}</span>${!duet ? `<span class="who">${pub.guessesLeft >= 99 ? 'no limit' : pub.guessesLeft + ' left'}</span>` : ''}</div>`
    : `<div class="cluebar"><span class="who">${esc(actorName)}</span></div>`;

  // ---- what can I tap?
  let tapMode = null; // 'guess' | 'cover' | 'sd'
  if (myTurn && !over) {
    if (duet) tapMode = pub.phase === 'guess' ? 'guess' : pub.phase === 'sudden' ? 'sd' : null;
    else if (pub.phase === 'guess') tapMode = 'guess';
    else if (pub.phase === 'dummy' || pub.phase === 'penalty') tapMode = 'cover';
  }
  const iGive = myTurn && !over && pub.phase === 'clue';
  let odds = null;
  if (iGive && key) {
    const open = duet ? pub.found.map((f, p) => !f && !pub.byst[p].includes(myRole.side === 'A' ? 'B' : 'A')) : pub.revealed.map(r => !r);
    odds = oddsBlock(boardIdx, key, open, duet ? 'G' : pub.turn, draft.play.word, draft.play.n);
  }
  const heat = odds && S.settings.heat ? odds.heat : null;
  const boardKey = `p:${pub.code}:${pub.variant}`;
  const coverTeam = pub.phase === 'dummy' ? (pub.turn) : pub.turn;
  const bHTML = boardHTML(boardKey, pub.w, p => {
    let cover = null, half = null, tint = null, disabled = true, pick = false;
    if (duet) {
      if (pub.found[p]) cover = 'G';
      else if (pub.byst[p]) { cover = 'N'; half = pub.byst[p].split('').map(x => (x === myRole.side ? 'You' : 'Partner')).join('+'); }
      if (over) {
        const a = pub.keyA[p], b2 = pub.keyB[p];
        if (!cover) tint = a === 'A' || b2 === 'A' ? 'A' : (a === 'G' || b2 === 'G') ? 'G' : null;
      } else if (key && !pub.found[p]) tint = key[p] === 'N' ? null : key[p];
      if (tapMode === 'guess') disabled = pub.found[p] || pub.byst[p].includes(myRole.side);
      if (tapMode === 'sd') disabled = pub.found[p];
    } else {
      if (pub.revealed[p]) cover = pub.key[p];
      else if (key && key[p]) tint = key[p];
      if (tapMode === 'guess') disabled = pub.revealed[p];
      if (tapMode === 'cover') disabled = pub.revealed[p] || !key || key[p] !== coverTeam;
    }
    if (hint && hint.has(p)) pick = true;
    return { cover, half, tint, disabled, pick, heat: heat && heat.get(p) };
  });

  // ---- panel
  let panel = '';
  if (over) panel = reviewHTML(pub, myRole);
  else if (iGive) {
    panel = `<h3>Your clue</h3>${clueInput('play', 'One word')}${S.settings.odds ? odds.html : (odds.bad ? odds.html : '')}
      <div class="row" style="margin-top:10px"><button class="btn main" data-act="give" ${!draft.play.word || odds?.bad ? 'disabled' : ''}>Give clue</button><button class="btn" data-act="idea" data-ctx="play">${ART.robot.replace('<svg', '<svg width="16" height="16"')}Idea</button></div>`;
  } else if (tapMode === 'guess') {
    panel = `<div class="row"><b>Tap a word</b><span class="grow"></span>${pub.guessesMade > 0 ? '<button class="btn" data-act="pass">End turn</button>' : ''}<button class="btn" data-act="hint" ${ASSOC ? '' : 'disabled'}>Hint</button></div>${hintHTML(pub, boardIdx)}`;
  } else if (tapMode === 'cover') {
    panel = `<div class="row"><b>${pub.phase === 'dummy' ? `Their turn: cover one of their agents` : 'Penalty: cover one of your agents'}</b><span class="grow"></span><button class="btn" data-act="autocover" ${ASSOC ? '' : 'disabled'}>Pick for me</button></div>
      ${pub.phase === 'dummy' ? '<p class="small muted" style="margin-top:4px">Two-player rules <button class="q" data-help="coop">?</button></p>' : ''}`;
  } else if (tapMode === 'sd') {
    panel = `<div class="result"><b>Sudden death</b><p class="small muted">No more clues. Tap a word you think is green for your partner. Any miss loses.</p></div>`;
  } else {
    panel = `<div class="row muted"><span>${esc(actorName)}</span></div>`;
  }
  panel += logHTML(pub, boardIdx);
  panel += `<div class="row" style="margin-top:12px"><button class="btn small" data-act="quit">${over ? 'New game' : 'Quit game'}</button>${S.play.kind === 'online' ? `<span class="small muted">Room <b style="color:var(--warm)">${esc(snap.code)}</b></span>` : `<span class="small muted">Board ${esc(pub.code)}</span>`}</div>`;

  keepFocus(el, () => {
    el.innerHTML = `<div class="stage"><div class="boardwrap"><div class="bar">${status}<span class="grow"></span>${seat >= 0 ? `<span class="chip">${esc(seatLabel(pub, seat, snap))}</span>` : ''}</div>${banner}${bHTML}</div><div class="panel">${panel}</div></div>`;
  });
}

function roleFromPub(pub, seat) {
  if (seat < 0) return {};
  if (pub.variant === 'coop') return { team: pub.start, spy: seat === 0 };
  if (seat === 0) return { team: 'R', spy: true };
  if (seat === 1) return { team: 'B', spy: true };
  return { team: seat % 2 === 0 ? 'R' : 'B', spy: false };
}
function seatLabel(pub, seat, snap) {
  const st = { variant: pub.variant, start: pub.start };
  const base = seatName(st, seat);
  return snap.seats.filter(s => s.kind === 'human').length > 1 || snap.mode === 'online' ? base : 'You: ' + base.toLowerCase();
}
function who(pub, snap) {
  const t = snap.toAct || [];
  if (!t.length) return '';
  const st = { variant: pub.variant, start: pub.start };
  const s = t[0];
  const kind = snap.seats[s]?.kind;
  const name = snap.seats[s]?.name;
  const label = pub.variant === 'coop' && pub.phase === 'dummy' ? 'Spymaster covers one of theirs' : seatName(st, s);
  if (kind === 'computer') return `Computer (${label.toLowerCase()}) is thinking…`;
  if (snap.mode === 'online' && !snap.myTurn) return `Waiting for ${name || label}`;
  return label;
}
function resultLine(pub, myRole) {
  if (pub.variant === 'duet') return `<b>${pub.winner ? 'You both win!' : pub.reason === 'assassin' ? 'Assassin. You both lose.' : 'Out of time.'}</b>`;
  const w = teamName(pub.winner);
  const why = pub.reason === 'assassin' ? ' (assassin)' : '';
  if (pub.variant === 'coop') return `<b>${pub.winner === pub.start ? `You win! Score ${pub.score}` : 'You lose' + why}</b>`;
  return `<b><i class="dot ${pub.winner}"></i> ${w} wins${why}</b>`;
}

function hintHTML(pub, boardIdx) {
  if (!hint || !ASSOC || !pub.clue) return '';
  const c = ASSOC.clueIndex(pub.clue.word);
  if (c < 0) return '<p class="msg">The computer doesn\'t know that clue word.</p>';
  const rows = [...hint].map(p => `<span class="tag">${esc(pub.w[p])}</span>`).join(' ');
  return `<p class="small muted" style="margin-top:6px">Closest to <b>${esc(pub.clue.word.toUpperCase())}</b>: ${rows}</p>`;
}

function logHTML(pub, boardIdx) {
  const rows = pub.history.slice().reverse().map(h => {
    const g = h.guesses.map(x => `<span class="tag ${x.color}">${esc(pub.w[x.pos])}</span>`).join('');
    if (h.dummy || h.penalty) return `<div class="log-row muted"><span>${h.penalty ? 'Penalty' : 'Their turn'}:</span>${g}</div>`;
    if (h.sudden) return `<div class="log-row"><span class="muted">Sudden death</span>${g}</div>`;
    const team = h.team ? `<i class="dot ${h.team}"></i>` : `<span class="muted">${h.giver}</span>`;
    const meant = h.targets ? `<span class="muted small">meant</span>${h.targets.map(p => `<span class="tag">${esc(pub.w[p])}</span>`).join('')}` : '';
    return `<div class="log-row">${team}<span class="lc">${esc(h.clue)} ${h.n < 0 ? '∞' : h.n}</span>${g}${meant}</div>`;
  }).join('');
  return rows ? `<h3>Turns</h3><div class="log">${rows}</div>` : '';
}

function reviewHTML(pub, myRole) {
  let html = `<div class="result">${resultLine(pub, myRole)}`;
  if (pub.variant === 'duet') html += `<p class="small muted">${pub.left} agents left · ${pub.timer} turns left</p>`;
  html += `</div>`;
  // study: how good was each human clue at the time it was given (local games only)
  const rs = S.play.kind === 'local' ? S.play.ratings : {};
  const lines = Object.entries(rs).map(([i, r]) => `<div class="log-row"><span class="lc">${esc(r.clue)} ${r.n}</span><span class="small">expected ${r.exp.toFixed(1)} right${r.alt ? ` · computer: <b>${esc(r.alt.clue.toUpperCase())} ${r.alt.n}</b> (${r.alt.exp.toFixed(1)})` : ''}</span>${r.alt ? `<span class="tag" style="color:${scaleColor(1 - Math.max(0, r.alt.exp - r.exp) / 1.5)}">${r.alt.exp > r.exp ? '−' + (r.alt.exp - r.exp).toFixed(1) : 'best'}</span>` : ''}</div>`).join('');
  if (lines) html += `<h3>Your clues</h3><div class="log">${lines}</div>`;
  if (S.play.kind === 'local' && S.play.hints) html += `<p class="small muted" style="margin-top:6px">Hints used: ${S.play.hints}</p>`;
  return html;
}

function showCover(seat, name) {
  if ($('#layer .cover')) return;
  const el = document.createElement('div');
  el.className = 'cover';
  el.innerHTML = `${ART.person.replace('<svg', '<svg width="60" height="60"')}<h2>Pass to ${esc(name)}</h2><p>${/spymaster|Player/.test(name) ? 'Only they should look: the key is on the next screen.' : 'The key is hidden now.'}</p><button class="btn main">I'm ${esc(name)}</button>`;
  el.querySelector('button').onclick = () => { S.play.shown = seat; S.play.lastSeat = seat; save(); el.remove(); renderPlay(); };
  $('#layer').appendChild(el);
}

// ------------------------------------------------------------------ PLAY setup
function renderSetup(el) {
  const su = S.setup;
  const opt = (id, icon, title, sub) => `<button class="choice ${su.pick === id ? 'on' : ''}" data-act="pick" data-v="${id}">${icon}<div><b>${title}</b><span>${sub}</span></div></button>`;
  let extra = '';
  if (su.pick === 'teams') {
    const names = ['Red spymaster', 'Blue spymaster', 'Red guesser', 'Blue guesser'];
    extra = `<h3>Seats</h3><div class="seats">${names.map((n, i) => `<button class="seatbtn" data-act="seat" data-v="${i}">${n}<em>${su.seats[i] === 'human' ? 'You' : 'Computer'}</em></button>`).join('')}</div>
      <p class="small muted" style="margin-top:6px">Several "You" seats = pass the phone.</p>`;
  } else if (su.pick === 'duet') {
    extra = `<h3>Partner</h3><div class="seg">${[['computer', 'Computer'], ['human', 'Pass the phone']].map(([v, l]) => `<button data-act="partner" data-v="${v}" class="${su.duetPartner === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  } else if (su.pick === 'online') {
    extra = onlineSetupHTML();
  }
  el.innerHTML = `<div class="stage"><div class="panel" style="flex:1;max-width:560px;margin:0 auto;width:100%">
    <h3>New game</h3>
    <div class="choices">
      ${opt('guess', ART.person.replace('<svg', '<svg style="color:#6ea8fe"'), 'You guess', 'Computer spymaster gives you clues')}
      ${opt('give', ART.robot.replace('<svg', '<svg style="color:#f0b354"'), 'You give clues', 'Computer guesses, you see the odds')}
      ${opt('teams', ART.teams, 'Two teams', 'Full rules, any seat a computer')}
      ${opt('duet', ART.duet, 'Duet', 'Co-op, 15 agents, 9 turns')}
      ${opt('online', ART.globe, 'Online room', 'Friends join with a code')}
    </div>
    ${extra}
    ${su.pick !== 'online' ? `<div class="row" style="margin-top:14px"><button class="btn main" data-act="start" ${ASSOC ? '' : 'disabled'}>${ASSOC ? 'Start' : 'Loading word links…'}</button>
      ${su.pick === 'guess' || su.pick === 'give' ? '<span class="small muted">Two-player rules <button class="q" data-help="coop">?</button></span>' : ''}</div>` : ''}
  </div></div>`;
}

function startPicked() {
  const su = S.setup;
  if (su.pick === 'guess') startLocal('coop', ['computer', 'human']);
  else if (su.pick === 'give') startLocal('coop', ['human', 'computer']);
  else if (su.pick === 'teams') {
    if (!su.seats.includes('human')) su.seats[2] = 'human';
    startLocal('classic', su.seats.slice());
  } else if (su.pick === 'duet') startLocal('duet', ['human', su.duetPartner]);
}

// ------------------------------------------------------------------ online
function onlineSetupHTML() {
  const su = S.setup;
  return `<h3>Online room</h3>
    <div class="field"><input id="oname" maxlength="20" placeholder="Your name" value="${esc(S.settings.name)}" aria-label="Your name"></div>
    <div class="row" style="margin-top:10px"><div class="seg">${[['classic', 'Two teams'], ['coop', 'Two-player'], ['duet', 'Duet']].map(([v, l]) => `<button data-act="ovar" data-v="${v}" class="${su.onlineVariant === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${su.onlineVariant === 'classic' ? `<div class="stepper" style="height:34px"><button data-act="oseats-">−</button><b style="font-size:15px;padding:0 4px">${su.onlineSeats}</b><button data-act="oseats+">+</button></div><span class="small muted">seats</span>` : ''}</div>
    <div class="row" style="margin-top:10px"><button class="btn main" data-act="ocreate">Create room</button></div>
    <div class="field" style="margin-top:14px"><input id="ocode" maxlength="5" placeholder="Room code" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.15em;font-weight:700" aria-label="Room code"></div>
    <div class="row" style="margin-top:8px"><button class="btn" data-act="ojoin">Join</button><span class="small muted">Free online play; empty seats become computers.</span></div>`;
}

async function ensureOnline() {
  if (online) return online;
  const mod = await import('./online.js');
  online = mod.createOnline({ game, gameId: 'codenames', botDelayMs: 900 });
  online.on('change', snap => {
    osnap = snap;
    if (snap.status === 'closed' || snap.status === 'left') { if (S.play?.kind === 'online') { S.play = null; save(); toast(snap.status === 'closed' ? 'Room closed' : 'You left the room'); } }
    renderAll();
  });
  online.on('error', msg => toast(msg));
  return online;
}
async function onlineCreate() {
  if (!ASSOC) return toast('Word links still loading');
  const name = ($('#oname')?.value || '').trim() || 'Player';
  S.settings.name = name; save();
  const su = S.setup;
  const n = su.onlineVariant === 'classic' ? su.onlineSeats : 2;
  const seats = Array(n).fill('empty'); seats[0] = 'human';
  const o = await ensureOnline();
  toast('Making a room…');
  const r = await o.createRoom({ name, seats, options: { variant: su.onlineVariant, code: E.randomCode(), style: S.settings.style, timer: S.settings.duetTimer } });
  if (!r.ok) return toast(r.message);
  stopGame();
  S.play = { kind: 'online' }; save(); renderAll();
}
async function onlineJoin() {
  const name = ($('#oname')?.value || '').trim() || 'Player';
  const code = ($('#ocode')?.value || '').trim().toUpperCase();
  if (!code) return toast('Type the room code');
  S.settings.name = name; save();
  const o = await ensureOnline();
  toast('Joining…');
  const r = await o.joinRoom(code, name);
  if (!r.ok) return toast(r.message);
  stopGame();
  S.play = { kind: 'online' }; save(); renderAll();
}
function renderOnlineLobby(el, snap) {
  if (!snap || snap.status === 'none' || snap.status === 'joining') {
    el.innerHTML = `<div class="stage"><div class="panel" style="flex:1;max-width:560px;margin:0 auto;width:100%"><div class="result"><b>${snap?.status === 'joining' ? 'Waiting for the host…' : 'Connecting…'}</b></div><div class="row" style="margin-top:10px"><button class="btn small" data-act="quit">Cancel</button></div></div></div>`;
    return;
  }
  const v = snap.options?.variant || 'classic';
  const st = { variant: v, start: 'R' };
  const seats = snap.seats.map((s, i) => `<div class="seatbtn"><span>${esc(seatName(st, i))}</span><em>${s.kind === 'human' ? esc(s.name) + (s.online ? '' : ' (away)') : s.kind === 'computer' ? 'Computer' : '<span class="muted">open</span>'}</em>${snap.isHost && i !== snap.mySeat && s.kind !== 'human' ? `<button class="btn small" data-act="oseat" data-v="${i}" data-k="${s.kind === 'empty' ? 'computer' : 'empty'}">${s.kind === 'empty' ? 'Computer' : 'Open'}</button>` : ''}</div>`).join('');
  el.innerHTML = `<div class="stage"><div class="panel" style="flex:1;max-width:560px;margin:0 auto;width:100%">
    <div class="result"><span class="small muted">Room code</span><div class="big-code">${esc(snap.code)}</div><span class="small muted">${v === 'classic' ? 'Two teams' : v === 'coop' ? 'Two-player' : 'Duet'} · friends open this site, Play → Online room → Join</span></div>
    <h3>Seats</h3><div class="seats" style="grid-template-columns:1fr">${seats}</div>
    <div class="row" style="margin-top:12px">${snap.isHost ? '<button class="btn main" data-act="ostart">Start game</button>' : '<span class="muted">Waiting for the host to start…</span>'}<button class="btn small" data-act="quit">Leave</button></div>
  </div></div>`;
}

// ------------------------------------------------------------------ LINKS tab
const links = { word: '', sel: null };
function linksBoard() {
  if (S.play && S.play.kind === 'local') { const st = S.play.state; return { idx: st.words, code: st.code, from: 'game' }; }
  const b = tableBoard();
  return { idx: b.words, code: S.table.code, from: 'table' };
}
function renderLinks() {
  const el = $('#tab-links');
  if (!META) { el.innerHTML = ''; return; }
  const b = linksBoard();
  let mapHTML = '', side = '';
  if (!ASSOC) mapHTML = `<div class="msg">${assocErr ? 'Word links failed to load.' : 'Loading word links…'}</div>`;
  else {
    // all pairs, strongest first
    const pairs = [];
    for (let i = 0; i < 25; i++) for (let j = i + 1; j < 25; j++) pairs.push([i, j, E.boardSim(ASSOC, b.idx[i], b.idx[j])]);
    pairs.sort((x, y) => y[2] - x[2]);
    const shown = pairs.slice(0, 16);
    const W = 500, H = 340, cx = i => 50 + (i % 5) * 100, cy = i => 34 + Math.floor(i / 5) * 68;
    const sel = links.sel;
    const lines = shown.map(([i, j, s]) => {
      const on = sel == null || sel === i || sel === j;
      const mx = (cx(i) + cx(j)) / 2, my = (cy(i) + cy(j)) / 2;
      const bend = (Math.abs(cx(i) - cx(j)) > 100 || Math.abs(cy(i) - cy(j)) > 68) ? 18 : 0;
      return `<path d="M${cx(i)} ${cy(i)} Q${mx + bend} ${my - bend} ${cx(j)} ${cy(j)}" fill="none" stroke="${on ? 'var(--warm)' : '#3a4157'}" stroke-opacity="${on ? 0.35 + s : 0.5}" stroke-width="${(1 + (s - shown.at(-1)[2]) * 18).toFixed(1)}" stroke-linecap="round"/>`;
    }).join('');
    const nodes = b.idx.map((w, i) => {
      const word = META.board[w];
      const on = sel === i;
      const fs = word.length > 7 ? 10 : 11.5;
      return `<g data-node="${i}" style="cursor:pointer"><rect x="${cx(i) - 45}" y="${cy(i) - 14}" width="90" height="28" rx="6" fill="${on ? 'var(--warm)' : 'var(--paper)'}" stroke="${on ? '#fff' : 'rgba(0,0,0,.2)'}"/><text x="${cx(i)}" y="${cy(i) + 4}" text-anchor="middle" fill="var(--ink)" style="font-size:${fs}px">${esc(word)}</text></g>`;
    }).join('');
    mapHTML = `<div class="map"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Links between board words">${lines}${nodes}</svg></div>`;
    if (sel != null) {
      const bw = b.idx[sel];
      const near = ASSOC.nearestClues(bw, 14, new Set(wordsOf(b.idx)));
      const mates = b.idx.map((w, i) => [i, i === sel ? -9 : E.boardSim(ASSOC, bw, w)]).sort((x, y) => y[1] - x[1]).slice(0, 4);
      side += `<h3>${esc(META.board[bw])}: closest words</h3><div class="wordlist">${near.map(n => `<button class="tag" data-act="lookup" data-v="${esc(n.word)}">${esc(n.word)}</button>`).join('')}</div>
        <h3>Closest on this board</h3><div class="wordlist">${mates.map(([i, s]) => `<span class="tag">${esc(META.board[b.idx[i]])} ${Math.round(s * 100)}</span>`).join('')}</div>`;
    } else {
      side += `<p class="small muted">Tap a word to see the words closest to it. <button class="q" data-help="links">?</button></p>`;
      side += `<h3>Strongest links</h3><div class="wordlist">${shown.slice(0, 6).map(([i, j, s]) => `<span class="tag">${esc(META.board[b.idx[i]])} + ${esc(META.board[b.idx[j]])}</span>`).join('')}</div>`;
    }
    if (links.word) {
      const c = ASSOC.clueIndex(links.word);
      if (c < 0) side += `<p class="msg">"${esc(links.word)}" isn't in the ${ASSOC.nC.toLocaleString()} known words.</p>`;
      else {
        const onBoard = b.idx.map((w, i) => [i, ASSOC.sim(w, c)]).sort((x, y) => y[1] - x[1]).slice(0, 6);
        const all = META.board.map((w, i) => [w, ASSOC.sim(i, c)]).filter(x => x[0] !== links.word).sort((x, y) => y[1] - x[1]).slice(0, 12);
        side += `<h3>${esc(links.word)} → this board</h3><div class="near">${onBoard.map(([i, s]) => `<div class="near-row"><span></span><span class="nm">${esc(META.board[b.idx[i]])}</span><span class="track"><i style="width:${Math.max(3, Math.min(100, s / 0.7 * 100)).toFixed(0)}%"></i></span><span class="pc">${Math.round(s * 100)}</span></div>`).join('')}</div>
          <h3>${esc(links.word)} → all ${META.board.length} board words</h3><div class="wordlist">${all.map(([w, s]) => `<span class="tag">${esc(w)} ${Math.round(s * 100)}</span>`).join('')}</div>`;
      }
    }
  }
  keepFocus(el, () => {
    el.innerHTML = `<div class="stage"><div class="boardwrap"><div class="bar"><span class="chip">${b.from === 'game' ? 'Game' : 'Table'} ${esc(b.code)}</span><input id="linkWord" class="grow" style="height:36px;border-radius:9px;border:1px solid var(--line);background:var(--bg-soft);padding:0 10px;outline:none" placeholder="Any word…" value="${esc(links.word)}" autocomplete="off" autocapitalize="off" aria-label="Look up a word"></div>${mapHTML}</div><div class="panel">${side}</div></div>`;
  });
}

// ------------------------------------------------------------------ SETTINGS tab
let STRENGTH = null; // data/strength.json, written by tools/simulate.mjs
function renderSettings() {
  const el = $('#tab-settings');
  const st = S.settings;
  const sw = (k, label, help) => `<div class="set-row"><span class="lab">${label}${help ? ` <button class="q" data-help="${help}">?</button>` : ''}</span><button class="switch ${st[k] ? 'on' : ''}" data-act="toggle" data-v="${k}" aria-pressed="${!!st[k]}"><i></i></button></div>`;
  el.innerHTML = `<div class="stage"><div class="panel" style="flex:1;max-width:560px;margin:0 auto;width:100%">
    <div class="set-row"><span class="lab">Computer clues <button class="q" data-help="style">?</button></span><div class="seg">${['safe', 'normal', 'bold'].map(s => `<button data-act="style" data-v="${s}" class="${st.style === s ? 'on' : ''}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div></div>
    ${sw('odds', 'Show odds')}
    ${sw('heat', 'Board heat', 'heat')}
    <div class="set-row"><span class="lab">Duet turns</span><div class="seg">${[9, 10, 11].map(n => `<button data-act="timer" data-v="${n}" class="${st.duetTimer === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
    <div class="set-row"><span class="lab">How strong? <button class="q" data-help="strength">?</button></span><span class="small muted">measured</span></div>
    ${strengthTable()}
    <p class="small muted" style="margin-top:14px">Word links: GloVe 6B (Stanford NLP, public domain), cut to ${META ? META.board.length : '…'} board words × ${META ? META.clues.length.toLocaleString() : '…'} clue words. Board list is this site's own. Build ${BUILD}.</p>
  </div></div>`;
}
function strengthTable() {
  if (!STRENGTH) return '';
  const rows = STRENGTH.rows.filter(r => r.who === 'cpu-clues');
  const g = STRENGTH.rows.find(r => r.who === 'cpu-guesses' && r.style === 'normal');
  return `<table class="strength"><tr><th>Computer clues</th><th>Guesses right</th><th>Words/clue</th><th>Win</th><th>Assassin</th></tr>${rows.map(r => `<tr><td>${r.style[0].toUpperCase() + r.style.slice(1)}</td><td style="color:${scaleColor((r.right - 70) / 30)}">${r.right}%</td><td>${r.wpc}</td><td>${r.win}%</td><td>${r.ass}%</td></tr>`).join('')}</table>
    ${g ? `<p class="small muted" style="margin-top:6px">Computer guessing someone else's clues: <b style="color:${scaleColor((g.right - 70) / 30)}">${g.right}%</b> right.</p>` : ''}`;
}

// ------------------------------------------------------------------ top bar + render all
function renderTop() {
  const t = $('#topInfo');
  if (S.tab === 'play' && S.play && S.play.kind === 'online' && osnap?.code) t.innerHTML = `<span class="chip">Room ${esc(osnap.code)}</span>`;
  else t.innerHTML = '';
}
function renderAll() {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + S.tab));
  renderTop();
  if (S.tab === 'table') renderTable();
  else if (S.tab === 'play') renderPlay();
  else if (S.tab === 'links') renderLinks();
  else renderSettings();
}

// ------------------------------------------------------------------ events
document.addEventListener('click', e => {
  const tabBtn = e.target.closest('.tabs button');
  if (tabBtn) { goTab(tabBtn.dataset.tab); return; }
  const help = e.target.closest('[data-help]');
  if (help) {
    const [title, body] = HELP[help.dataset.help];
    sheet(`<h2>${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : strengthHelp()}<div class="btns"><span></span><button class="btn main" id="ok">OK</button></div>`, sh => { $('#ok', sh).onclick = closeSheet; });
    return;
  }
  const node = e.target.closest('[data-node]');
  if (node) { const i = +node.dataset.node; links.sel = links.sel === i ? null : i; renderLinks(); return; }
  const card = e.target.closest('.card');
  if (card && !card.disabled) {
    const p = +card.dataset.pos;
    if (S.tab === 'table') return tableTap(p);
    if (S.tab === 'play') return playTap(p);
  }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act, v = b.dataset.v;
  switch (a) {
    case 'code': codeSheet(); break;
    case 'spy':
      if (!S.table.spy) {
        sheet(`<h2>Spymasters only</h2><p>The key will show on this screen. Guessers, look away.</p><div class="btns"><button class="btn" id="no">Cancel</button><button class="btn main" id="yes">Show key</button></div>`, sh => {
          $('#no', sh).onclick = closeSheet;
          $('#yes', sh).onclick = () => { S.table.spy = true; save(); closeSheet(); renderTable(); };
        });
      } else { S.table.spy = false; save(); renderTable(); }
      break;
    case 'team': S.table.team = v; save(); renderTable(); break;
    case 'side': S.table.side = v; S.table.marks = Array(25).fill(0); S.table.order = []; save(); renderTable(); break;
    case 'table-undo': tableUndo(); break;
    case 'n-': case 'n+': {
      const d = draft[b.dataset.ctx];
      const order = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, -1];
      const i = order.indexOf(d.n);
      d.n = order[Math.max(0, Math.min(order.length - 1, i + (a === 'n+' ? 1 : -1)))];
      renderAll(); break;
    }
    case 'idea': idea(b.dataset.ctx); break;
    case 'give': giveClue(); break;
    case 'pass': act({ type: 'pass' }); break;
    case 'hint': {
      const snap = currentSnap(), pub = snap.pub;
      const c = ASSOC.clueIndex(pub.clue.word);
      const open = [];
      for (let p = 0; p < 25; p++) if (pub.variant === 'duet' ? !pub.found[p] && !pub.byst[p].includes(snap.mySeat === 0 ? 'A' : 'B') : !pub.revealed[p]) open.push(p);
      const idx = pub.w.map(w => META.board.indexOf(w));
      const ranked = c < 0 ? [] : open.map(p => [p, ASSOC.sim(idx[p], c)]).sort((x, y) => y[1] - x[1]);
      const k = Math.max(1, Math.min(3, pub.clue.n > 0 ? pub.clue.n : 2));
      hint = new Set(ranked.slice(0, k).map(x => x[0]));
      if (S.play.kind === 'local') { S.play.hints = (S.play.hints || 0) + 1; save(); }
      renderPlay(); break;
    }
    case 'autocover': {
      const st = S.play.kind === 'local' ? S.play.state : null;
      if (!st) break;
      const snap = localSnap();
      const ba = game.bot({ state: st }, snap.mySeat);
      act(ba); break;
    }
    case 'quit':
      if (S.play && !(currentSnap()?.status === 'finished') && S.play.kind === 'local') {
        sheet(`<h2>Quit this game?</h2><div class="btns"><button class="btn" id="no">Keep playing</button><button class="btn main" id="yes">Quit</button></div>`, sh => {
          $('#no', sh).onclick = closeSheet;
          $('#yes', sh).onclick = () => { closeSheet(); stopGame(); S.play = null; save(); renderAll(); };
        });
      } else {
        if (S.play?.kind === 'online' && online) online.leave();
        stopGame(); S.play = null; osnap = null; save(); renderAll();
      }
      break;
    case 'pick': S.setup.pick = v; save(); renderPlay(); break;
    case 'seat': S.setup.seats[+v] = S.setup.seats[+v] === 'human' ? 'computer' : 'human'; save(); renderPlay(); break;
    case 'partner': S.setup.duetPartner = v; save(); renderPlay(); break;
    case 'start': startPicked(); break;
    case 'ovar': S.setup.onlineVariant = v; save(); renderPlay(); break;
    case 'oseats-': case 'oseats+': S.setup.onlineSeats = Math.max(4, Math.min(10, S.setup.onlineSeats + (a === 'oseats+' ? 1 : -1))); save(); renderPlay(); break;
    case 'ocreate': onlineCreate(); break;
    case 'ojoin': onlineJoin(); break;
    case 'oseat': online.setSeat(+v, b.dataset.k).then(r => { if (!r.ok) toast(r.message); }); break;
    case 'ostart': online.start().then(r => { if (!r.ok) toast(r.message); }); break;
    case 'style': S.settings.style = v; save(); renderSettings(); break;
    case 'toggle': S.settings[v] = !S.settings[v]; save(); renderSettings(); break;
    case 'timer': S.settings.duetTimer = +v; save(); renderSettings(); break;
    case 'lookup': links.word = v; renderLinks(); break;
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'clue-table' || e.target.id === 'clue-play') {
    draft[e.target.dataset.ctx].word = e.target.value.trim().toLowerCase().replace(/[‘’]/g, "'");
    if (e.target.id === 'clue-table') renderTable(); else renderPlay();
  } else if (e.target.id === 'linkWord') {
    links.word = e.target.value.trim().toLowerCase();
    renderLinks();
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'clue-play') { e.preventDefault(); giveClue(); }
  if (e.key === 'Enter' && e.target.id === 'clue-table') e.target.blur();
});

function playTap(p) {
  const snap = currentSnap(); if (!snap) return;
  const pub = snap.pub;
  if (pub.variant === 'duet') act({ type: pub.phase === 'sudden' ? 'sdguess' : 'guess', pos: p });
  else if (pub.phase === 'guess') act({ type: 'guess', pos: p });
  else act({ type: 'cover', pos: p });
}

function idea(ctx) {
  if (!ASSOC) return toast('Word links still loading');
  let c;
  if (ctx === 'table') {
    const t = S.table, b = tableBoard();
    if (t.variant === 'duet') c = E.bestClue(ASSOC, { words: b.words, key: b.key }, b.words.map((_, p) => t.marks[p] === 1), 'G', S.settings.style);
    else c = E.bestClue(ASSOC, b, t.revealed, t.team || b.start, S.settings.style);
  } else {
    const snap = currentSnap(), pub = snap.pub, key = snap.mine.key;
    const idx = pub.w.map(w => META.board.indexOf(w));
    if (pub.variant === 'duet') {
      const other = snap.mySeat === 0 ? 'B' : 'A';
      c = E.bestClue(ASSOC, { words: idx, key }, pub.found.map((f, p) => f || pub.byst[p].includes(other)), 'G', S.settings.style);
    } else c = E.bestClue(ASSOC, { words: idx, key }, pub.revealed, pub.turn, S.settings.style);
  }
  if (!c) return toast('No agents left to clue');
  draft[ctx].word = c.clue; draft[ctx].n = c.n;
  renderAll();
}

function giveClue() {
  const snap = currentSnap();
  if (!snap) return;
  const word = draft.play.word, n = draft.play.n;
  if (!word) return;
  const pub = snap.pub;
  // remember how good this clue looked, for the study list at the end (local games)
  if (S.play.kind === 'local' && ASSOC && snap.mine.key) {
    try {
      const idx = pub.w.map(w => META.board.indexOf(w));
      const duet = pub.variant === 'duet';
      const other = snap.mySeat === 0 ? 'B' : 'A';
      const open = duet ? pub.found.map((f, p) => !f && !pub.byst[p].includes(other)) : pub.revealed.map(r => !r);
      const team = duet ? 'G' : pub.turn;
      const c = ASSOC.clueIndex(word);
      const expOf = (ci, nn) => E.riskOfClue(riskItems(idx, snap.mine.key, open, ci), team, nn > 0 ? nn : 1).expRight;
      const alt = E.bestClue(ASSOC, { words: idx, key: snap.mine.key }, open.map(o => !o), team, 'normal', new Set(S.play.state.used));
      const rating = { clue: word, n: n < 0 ? '∞' : n, exp: c >= 0 ? expOf(c, n) : 0 };
      if (alt) rating.alt = { clue: alt.clue, n: alt.n, exp: expOf(ASSOC.clueIndex(alt.clue), alt.n) };
      S.play.ratings[pub.history.length] = rating;
    } catch (e) { /* rating is optional */ }
  }
  if (act({ type: 'clue', word, n })) { draft.play = { word: '', n: 1 }; renderPlay(); }
}

function strengthHelp() {
  const n = STRENGTH ? STRENGTH.games : '…';
  return `<p>Measured, not guessed: ${n} computer games per row under the official two-player rules. The guesser is a second, smaller word model (GloVe 50-d), standing in for a person who links words a bit differently. Real people link words differently again, so expect lower numbers at a real table.</p><p>"Win" = all 9 agents found before the pretend opponent's 8 are covered.</p>`;
}

// Back goes to where you just were (Tim's rule): each tab change is a history step.
function goTab(tab) {
  if (tab === S.tab) return;
  S.tab = tab; save();
  try { history.pushState({ tab }, ''); } catch (e) {}
  renderAll();
}
try { history.replaceState({ tab: S.tab }, ''); } catch (e) {}
window.addEventListener('popstate', e => { if (e.state && e.state.tab) { S.tab = e.state.tab; save(); closeSheet(); renderAll(); } });

loadData().catch(e => { $('#tab-table').innerHTML = `<div class="stage"><div class="msg bad">Couldn't load the word list (${esc(e.message)}). Check your connection and reload.</div></div>`; });
renderAll();
if (online == null) {
  try { if (localStorage.getItem('online.codenames')) ensureOnline().then(o => o.resume()).then(ok => { if (ok) { S.play = { kind: 'online' }; S.tab = 'play'; save(); renderAll(); } }); } catch (e) {}
}
if (S.play && S.play.kind === 'online' && !localStorage.getItem('online.codenames')) { S.play = null; save(); }
