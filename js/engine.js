// Codenames engine: pure functions only (no DOM), so the browser, the node tests and
// the simulator all run the same rules. Game flow is apply(state, action) -> new state,
// and view(state, seat) hides what that seat may not see, so local, computer and
// online seats are interchangeable (phase 2 brief, 2026-10-19).

export const VERSION = 1;
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (look like 1 and 0)

// ---------------------------------------------------------------- random
export function hashStr(s) {
  // cyrb53-style 32-bit mix; stable across browsers and node
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomCode(rng = Math.random) {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  return s;
}

export function normCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

// ---------------------------------------------------------------- boards
// Classic: 25 words; the starting team has 9 agents, the other 8, 7 bystanders, 1 assassin.
export function genClassic(code, nWords, version = VERSION) {
  const rng = mulberry32(hashStr(`cn${version}:classic:${normCode(code)}`));
  const words = shuffle([...Array(nWords).keys()], rng).slice(0, 25);
  const start = rng() < 0.5 ? 'R' : 'B';
  const other = start === 'R' ? 'B' : 'R';
  const pos = shuffle([...Array(25).keys()], rng);
  const key = Array(25);
  pos.forEach((p, i) => { key[p] = i < 9 ? start : i < 17 ? other : i < 24 ? 'N' : 'A'; });
  return { code: normCode(code), words, key, start };
}

// Duet: one two-sided key. Each side has 9 agents (G), 3 assassins (A), 13 bystanders (N).
// Overlaps: 3 agents are agents on both sides; of side A's 3 assassins, 1 is an assassin on
// side B, 1 is an agent on side B, 1 is a bystander on side B (and the same for side B).
// So 15 different agents in all. Sources in docs/rules-check.md.
export function genDuet(code, nWords, version = VERSION) {
  const rng = mulberry32(hashStr(`cn${version}:duet:${normCode(code)}`));
  const words = shuffle([...Array(nWords).keys()], rng).slice(0, 25);
  // cell types as [sideA, sideB]
  const cells = [
    ...Array(3).fill(['G', 'G']),
    ...Array(5).fill(['G', 'N']),
    ...Array(5).fill(['N', 'G']),
    ['G', 'A'], ['A', 'G'],
    ['A', 'A'],
    ['A', 'N'], ['N', 'A'],
    ...Array(7).fill(['N', 'N']),
  ];
  const order = shuffle(cells, rng);
  return { code: normCode(code), words, keyA: order.map(c => c[0]), keyB: order.map(c => c[1]) };
}

// ---------------------------------------------------------------- word table
// sims: Int8Array [nBoard * nClue], value = round(cos * 127)
export class Assoc {
  // cpu: indexes of clue words the computer spymaster may use (plain base-form words)
  constructor(sims, board, clues, cpu = null) {
    this.sims = sims; this.board = board; this.clues = clues;
    this.nB = board.length; this.nC = clues.length;
    this.cpu = new Uint8Array(this.nC).fill(cpu ? 0 : 1);
    if (cpu) for (const i of cpu) this.cpu[i] = 1;
    this.clueIdx = new Map(clues.map((w, i) => [w, i]));
    this.boardIdx = new Map(board.map((w, i) => [w, i]));
    // How close each clue word is to board words in general. Words like "heavy" are a bit
    // close to everything; the computer spymaster subtracts this so it prefers specific links.
    this.clueMean = new Float32Array(this.nC);
    for (let b = 0; b < this.nB; b++) {
      const row = b * this.nC;
      for (let c = 0; c < this.nC; c++) this.clueMean[c] += sims[row + c];
    }
    for (let c = 0; c < this.nC; c++) this.clueMean[c] /= this.nB * 127;
  }
  sim(b, c) { return this.sims[b * this.nC + c] / 127; }
  clueIndex(word) {
    const w = String(word || '').trim().toLowerCase();
    return this.clueIdx.has(w) ? this.clueIdx.get(w) : -1;
  }
  // nearest clue words to one board word (for the word explorer)
  nearestClues(b, k = 10, exclude = new Set()) {
    const out = [];
    for (let c = 0; c < this.nC; c++) {
      const w = this.clues[c];
      if (exclude.has(w) || w === this.board[b] || related(w, this.board[b])) continue;
      out.push([c, this.sims[b * this.nC + c]]);
    }
    out.sort((x, y) => y[1] - x[1]);
    return out.slice(0, k).map(([c, s]) => ({ word: this.clues[c], sim: s / 127 }));
  }
}

// ---------------------------------------------------------------- clue rules
// "related" = one word starts with the other (e.g. apple / apples, fire / fireman).
// The official rules forbid saying a board word or part of a compound word on the board.
export function related(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length >= 3 && (l.startsWith(s) || l.endsWith(s))) return true;
  // same stem with only word-ending changes: make / making, happy / happiness, story / stories.
  // Look-alikes with different endings (star / stay, moon / mood) are fine.
  let k = 0;
  while (k < s.length && s[k] === l[k]) k++;
  if (k < 3) return false;
  return ENDINGS.has(s.slice(k)) && ENDINGS.has(l.slice(k));
}
const ENDINGS = new Set(['', 's', 'es', 'e', 'ed', 'd', 'ing', 'er', 'ers', 'est', 'y', 'ies', 'ied', 'ier', 'iest',
  'ily', 'iness', 'ness', 'ly', 'en', 'ment', 'ments', 'ion', 'ions', 'ation', 'al', 'ful', 'less', 'ish']);

// boardWords: the 25 words on the table (strings). Returns {ok, reason}
export function checkClue(word, boardWords) {
  const w = String(word || '').trim().toLowerCase();
  if (!w) return { ok: false, reason: 'Type a clue' };
  if (/\s/.test(w)) return { ok: false, reason: 'One word only' };
  if (w.length > 20) return { ok: false, reason: 'Too long' };
  if (!/^[a-z][a-z'-]*$/.test(w)) return { ok: false, reason: 'Letters only' };
  for (const b of boardWords) {
    if (b === w) return { ok: false, reason: `${b.toUpperCase()} is on the board` };
    if (related(w, b)) return { ok: false, reason: `Too close to ${b.toUpperCase()}` };
  }
  return { ok: true, reason: '' };
}

// ---------------------------------------------------------------- the odds layer
// Guesser model: each guess picks an unrevealed word with chance proportional to
// exp(closeness / T) (a "softmax" choice), and the team keeps guessing until it has
// made n guesses or hits a wrong word. Exact, by recursion over which own words are gone.
export const DEFAULT_T = 0.05;

export function riskOfClue(items, team, n, T = DEFAULT_T) {
  // items: [{sim, color}] unrevealed words only. color in R/B/N/A (or G for duet own).
  const m = items.length;
  const own = []; items.forEach((it, i) => { if (it.color === team) own.push(i); });
  const w = items.map(it => Math.exp(it.sim / T));
  const res = { assassin: 0, opponent: 0, neutral: 0, allRight: 0, expRight: 0 };
  const guesses = Math.max(1, Math.min(n, own.length));
  const memo = new Map();
  // returns [assassin, opponent, neutral, allRight, expRight] from this state
  function rec(gone, left) {
    if (left === 0) return [0, 0, 0, 1, 0];
    const k = gone * 16 + left;
    if (memo.has(k)) return memo.get(k);
    let tot = 0;
    for (let i = 0; i < m; i++) if (!isGone(i, gone)) tot += w[i];
    const r = [0, 0, 0, 0, 0];
    for (let i = 0; i < m; i++) {
      if (isGone(i, gone)) continue;
      const p = w[i] / tot;
      const c = items[i].color;
      if (c === team) {
        const bit = 1 << own.indexOf(i);
        const sub = rec(gone | bit, left - 1);
        r[0] += p * sub[0]; r[1] += p * sub[1]; r[2] += p * sub[2]; r[3] += p * sub[3];
        r[4] += p * (1 + sub[4]);
      } else if (c === 'A') r[0] += p;
      else if (c === 'N') r[2] += p;
      else r[1] += p;
    }
    memo.set(k, r);
    return r;
  }
  function isGone(i, gone) {
    if (items[i].color !== team) return false;
    return (gone >> own.indexOf(i)) & 1;
  }
  const r = rec(0, guesses);
  res.assassin = r[0]; res.opponent = r[1]; res.neutral = r[2]; res.allRight = r[3]; res.expRight = r[4];
  res.guesses = guesses;
  return res;
}

// ---------------------------------------------------------------- computer spymaster
export const STYLES = {
  // margin: how much closer the weakest target must be than any wrong word; raw: minimum
  // closeness; floor: minimum closeness above the clue's everyday closeness to all words.
  // Tuned 2026-10-19 with tools/simulate.mjs (numbers in progress.md). 2026-10-27: a wider berth
  // round the assassin (assPad) and bystanders counted a bit less (neuCut) cut assassin hits by a
  // person-like guesser from 2% to 0% (Normal) and 5% to 1% (Bold) of games, wins 86/87% -> 86/89% (300 held-out boards).
  safe:   { margin: 0.09, floor: 0.21, raw: 0.35, maxN: 3, assPad: 0.08, neuCut: 0 }, // already 0% assassin; the wider berth only slowed it
  normal: { margin: 0.08, floor: 0.20, raw: 0.33, maxN: 4, assPad: 0.09, neuCut: 0.03 },
  bold:   { margin: 0.05, floor: 0.15, raw: 0.28, maxN: 5, assPad: 0.12, neuCut: 0.03 },
};

// Which clue words are legal for this set of 25 board words (cached per word set).
const maskCache = new Map();
export function validClueMask(assoc, boardWords) {
  const k = boardWords.join(',');
  if (maskCache.has(k)) return maskCache.get(k);
  const words = boardWords.map(b => assoc.board[b]);
  const ok = new Uint8Array(assoc.nC);
  for (let c = 0; c < assoc.nC; c++) {
    const cw = assoc.clues[c];
    ok[c] = words.some(bw => related(cw, bw)) ? 0 : 1;
  }
  if (maskCache.size > 50) maskCache.clear();
  maskCache.set(k, ok);
  return ok;
}

// board: {words:[25 board-index], key:[25 color]}, revealed: [25 bool], team: color of the clue team
// avoid: Set of clue words already used this game
export function bestClue(assoc, board, revealed, team, style = 'normal', avoid = new Set()) {
  const P = typeof style === 'object' ? style : (STYLES[style] || STYLES.normal);
  const center = P.center ?? 1;
  const words = board.words.map(b => assoc.board[b]);
  const live = [];
  for (let p = 0; p < 25; p++) if (!revealed[p]) live.push(p);
  const ownPos = live.filter(p => board.key[p] === team);
  if (!ownPos.length) return null;
  let best = null;
  const nC = assoc.nC;
  const ok = validClueMask(assoc, board.words);
  for (let c = 0; c < nC; c++) {
    if (!ok[c] || !assoc.cpu[c]) continue;
    const cw = assoc.clues[c];
    if (avoid.has(cw)) continue;
    const own = [];
    let opp = -1, neu = -1, ass = -1;
    for (const p of live) {
      const s = assoc.sims[board.words[p] * nC + c] / 127;
      const k = board.key[p];
      if (k === team) own.push([s, p]);
      else if (k === 'A') ass = Math.max(ass, s);
      else if (k === 'N') neu = Math.max(neu, s);
      else opp = Math.max(opp, s);
    }
    own.sort((a, b) => b[0] - a[0]);
    const threat = Math.max(opp, neu - P.neuCut, ass + P.assPad);
    const mu = center * assoc.clueMean[c];
    for (let n = Math.min(P.maxN, own.length); n >= 1; n--) {
      const low = own[n - 1][0];
      const gap = low - threat;
      if (gap >= P.margin && low - mu >= P.floor && low >= (P.raw ?? 0)) {
        const score = n + 2 * gap;
        if (!best || score > best.score) best = { clue: cw, n, targets: own.slice(0, n).map(x => x[1]), score, gap };
        break;
      }
    }
    // fallback: best single-word clue even below the bar
    if (!best || best.fallback) {
      const gap = own[0][0] - threat;
      if (!best || gap > best.gap) best = { clue: cw, n: 1, targets: [own[0][1]], score: gap, gap, fallback: true };
    }
  }
  return best;
}

// ---------------------------------------------------------------- computer guesser
// Returns positions in the order it would guess them (all unrevealed, best first).
export function rankForClue(assoc, board, revealed, clueWord) {
  const c = assoc.clueIndex(clueWord);
  const live = [];
  for (let p = 0; p < 25; p++) if (!revealed[p]) live.push(p);
  if (c < 0) return live.map(p => ({ pos: p, sim: 0 }));
  return live.map(p => ({ pos: p, sim: assoc.sim(board.words[p], c) })).sort((a, b) => b.sim - a.sim);
}

// How many guesses the computer makes for clue number n (0 = "none of these", -1 = unlimited)
export function computerGuessCount(n, ranked) {
  if (n === 0) return 1;
  if (n < 0) return Math.max(1, ranked.filter(r => r.sim >= 0.3).length);
  return n;
}

// Closeness of two board words (every board word is also in the clue list).
export function boardSim(assoc, b1, b2) {
  const c = assoc.clueIdx.get(assoc.board[b2]);
  return c === undefined ? 0 : assoc.sim(b1, c);
}

// Two-player rules: on the pretend opponent's turn your spymaster covers one of their agents.
// The computer covers the one most likely to be confused with your own remaining agents.
export function dummyPick(assoc, s) {
  const them = s.turn, us = other(them);
  let best = -1, bestS = -9;
  for (let p = 0; p < 25; p++) {
    if (s.revealed[p] || s.key[p] !== them) continue;
    let m = -9;
    for (let q = 0; q < 25; q++) if (!s.revealed[q] && s.key[q] === us) m = Math.max(m, boardSim(assoc, s.words[p], s.words[q]));
    if (m > bestS) { bestS = m; best = p; }
  }
  return best;
}

// ---------------------------------------------------------------- classic game
export const other = t => (t === 'R' ? 'B' : 'R');

// opts: {mode: 'teams' | 'coop'}  coop = the official two-player rules: one team (the starting
// team) plays against an imaginary opponent who covers one of its own agents each turn.
export function newClassic(code, nWords, opts = {}) {
  const b = genClassic(code, nWords, opts.version);
  return {
    game: 'classic', mode: opts.mode || 'teams', code: b.code, words: b.words, key: b.key,
    start: b.start, turn: b.start, phase: 'clue', revealed: Array(25).fill(false), by: Array(25).fill(null),
    clue: null, guessesLeft: 0, guessesMade: 0, winner: null, reason: '', history: [], turnNo: 1,
  };
}

function remaining(s, team) {
  let n = 0;
  for (let p = 0; p < 25; p++) if (s.key[p] === team && !s.revealed[p]) n++;
  return n;
}
export function counts(s) { return { R: remaining(s, 'R'), B: remaining(s, 'B') }; }

function endTurn(s) {
  s.clue = null; s.guessesLeft = 0; s.guessesMade = 0;
  s.turn = other(s.turn); s.phase = s.mode === 'coop' && s.turn !== s.start ? 'dummy' : 'clue';
  s.turnNo++;
}

function finish(s, winner, reason) { s.phase = 'over'; s.winner = winner; s.reason = reason; }

// Throws Error(message) on an illegal action; never mutates the input.
export function apply(state, action) {
  const s = structuredClone(state);
  if (s.phase === 'over') throw new Error('Game is over');
  const t = action.team;
  if (action.type === 'invalid') {
    // The other team calls out an invalid clue: the clue team's turn ends at once, and the
    // calling team's spymaster covers one of their own agents (rulebook penalty).
    if (s.phase !== 'guess' || t !== other(s.turn)) throw new Error('Only the other team can call a bad clue during guessing');
    s.history[s.history.length - 1].invalid = true;
    s.clue = null; s.guessesLeft = 0; s.guessesMade = 0;
    s.turn = t; s.phase = 'penalty'; s.turnNo++;
    return s;
  }
  if (t !== s.turn) throw new Error('Not your turn');
  switch (action.type) {
    case 'clue': {
      if (s.phase !== 'clue') throw new Error('Not time for a clue');
      const n = action.n;
      if (!(Number.isInteger(n) && n >= -1 && n <= 9)) throw new Error('Bad number');
      s.clue = { word: String(action.word).trim().toLowerCase(), n };
      s.guessesLeft = n <= 0 ? 99 : n + 1; // n+1 guesses; 0 and unlimited have no cap (99 = no cap, JSON-safe)
      s.guessesMade = 0;
      s.phase = 'guess';
      s.history.push({ team: t, clue: s.clue.word, n, guesses: [], targets: action.targets || null });
      return s;
    }
    case 'guess': {
      if (s.phase !== 'guess') throw new Error('Not time to guess');
      const p = action.pos;
      if (!(p >= 0 && p < 25) || s.revealed[p]) throw new Error('Pick a covered word');
      s.revealed[p] = true; s.by[p] = t;
      s.guessesMade++; s.guessesLeft--;
      const color = s.key[p];
      s.history[s.history.length - 1].guesses.push({ pos: p, color });
      if (color === 'A') { finish(s, other(t), 'assassin'); return s; }
      if (remaining(s, 'R') === 0) { finish(s, 'R', 'all'); return s; }
      if (remaining(s, 'B') === 0) { finish(s, 'B', 'all'); return s; }
      if (color !== t || s.guessesLeft <= 0) endTurn(s);
      return s;
    }
    case 'pass': {
      if (s.phase !== 'guess') throw new Error('Not time to guess');
      if (s.guessesMade < 1) throw new Error('Make at least one guess first');
      endTurn(s);
      return s;
    }
    case 'dummy': {
      // coop: the imaginary opponent's turn = your spymaster covers one of their agents.
      // penalty: after an invalid clue, the other spymaster covers one of their own agents.
      if (s.phase !== 'dummy' && s.phase !== 'penalty') throw new Error('Not time to cover a word');
      const p = action.pos;
      if (!(p >= 0 && p < 25) || s.revealed[p] || s.key[p] !== t) throw new Error('Pick one of their agents');
      s.revealed[p] = true; s.by[p] = t;
      s.history.push({ team: t, dummy: s.phase === 'dummy', penalty: s.phase === 'penalty', guesses: [{ pos: p, color: t }] });
      if (remaining(s, t) === 0) { finish(s, t, 'all'); return s; }
      if (s.phase === 'penalty') { s.phase = 'clue'; return s; } // it is now that team's normal turn
      endTurn(s);
      return s;
    }
    default: throw new Error('Unknown action');
  }
}

// seat: 'R-spy' | 'B-spy' | 'R-op' | 'B-op' | 'board' (shared screen) | 'all'
export function view(state, seat) {
  const spy = seat === 'all' || /-spy$/.test(seat) || state.phase === 'over';
  const v = structuredClone(state);
  if (!spy) v.key = state.key.map((k, p) => (state.revealed[p] ? k : null));
  if (!spy) v.history = v.history.map(h => ({ ...h, targets: null }));
  return v;
}

// Two-player score (official rules): if you win, score = opposing agents still uncovered.
export function coopScore(s) {
  if (s.phase !== 'over' || s.winner !== s.start) return null;
  return remaining(s, other(s.start));
}

// ---------------------------------------------------------------- duet game
// Two players, each sees one side of the key. Clue-giver's side decides the colour of a guess.
// 9 timer turns (standard). Players alternate giving clues. After the last timer turn,
// sudden death: no more clues, players guess in turn and any non-agent loses.
export function newDuet(code, nWords, opts = {}) {
  const b = genDuet(code, nWords, opts.version);
  return {
    game: 'duet', code: b.code, words: b.words, keyA: b.keyA, keyB: b.keyB,
    found: Array(25).fill(false), // agent contacted (green covers)
    byst: Array(25).fill(''),      // '' | 'A' | 'B' | 'AB': which guesser hit a bystander here
    turn: 'A', phase: 'clue', timer: opts.timer || 9, clue: null, guessesMade: 0,
    winner: null, reason: '', history: [], startTimer: opts.timer || 9,
  };
}

export const duetOther = x => (x === 'A' ? 'B' : 'A');
export function duetAgentsLeft(s) {
  let n = 0;
  for (let p = 0; p < 25; p++) if ((s.keyA[p] === 'G' || s.keyB[p] === 'G') && !s.found[p]) n++;
  return n;
}
// agents still to find on one side (side = whose key)
export function duetSideLeft(s, side) {
  const k = side === 'A' ? s.keyA : s.keyB;
  let n = 0;
  for (let p = 0; p < 25; p++) if (k[p] === 'G' && !s.found[p]) n++;
  return n;
}

// action.team = the clue-giver for 'clue'; the guesser for 'guess'/'pass'/'sdguess'
export function applyDuet(state, action) {
  const s = structuredClone(state);
  if (s.phase === 'over') throw new Error('Game is over');
  const giver = s.turn; const guesser = duetOther(giver);
  const key = giver === 'A' ? s.keyA : s.keyB;
  const take = (p) => {
    // returns 'G' | 'N' | 'A' using the clue-giver's side
    if (!(p >= 0 && p < 25) || s.found[p]) throw new Error('Pick a covered word');
    if (s.byst[p].includes(guesser)) throw new Error('You already hit a bystander there');
    return key[p];
  };
  switch (action.type) {
    case 'clue': {
      if (s.phase !== 'clue' || action.team !== giver) throw new Error('Not time for your clue');
      if (duetSideLeft(s, giver) === 0) throw new Error('You have no agents left to clue');
      const n = action.n;
      if (!(Number.isInteger(n) && n >= -1 && n <= 9)) throw new Error('Bad number');
      s.clue = { word: String(action.word).trim().toLowerCase(), n };
      s.phase = 'guess'; s.guessesMade = 0;
      s.history.push({ giver, clue: s.clue.word, n, guesses: [], targets: action.targets || null });
      return s;
    }
    case 'guess': {
      if (s.phase !== 'guess' || action.team !== guesser) throw new Error('Not time to guess');
      const p = action.pos; const c = take(p);
      s.guessesMade++;
      s.history[s.history.length - 1].guesses.push({ pos: p, color: c });
      if (c === 'A') { finishDuet(s, false, 'assassin'); return s; }
      if (c === 'G') {
        s.found[p] = true;
        if (duetAgentsLeft(s) === 0) { finishDuet(s, true, 'all'); return s; }
        return s; // Duet has no guess cap: keep going while you hit agents
      }
      s.byst[p] += guesser;
      duetEndTurn(s);
      return s;
    }
    case 'pass': {
      if (s.phase !== 'guess' || action.team !== guesser) throw new Error('Not time to guess');
      if (s.guessesMade < 1) throw new Error('Make at least one guess first');
      duetEndTurn(s);
      return s;
    }
    case 'sdguess': {
      // sudden death: either player may point at a word; colour comes from the OTHER player's side
      if (s.phase !== 'sudden') throw new Error('Not sudden death');
      const side = action.team === 'A' ? s.keyB : s.keyA;
      const p = action.pos;
      if (!(p >= 0 && p < 25) || s.found[p]) throw new Error('Pick a covered word');
      const c = side[p];
      s.history.push({ sudden: true, guesser: action.team, guesses: [{ pos: p, color: c }] });
      if (c !== 'G') { finishDuet(s, false, c === 'A' ? 'assassin' : 'sudden'); return s; }
      s.found[p] = true;
      if (duetAgentsLeft(s) === 0) finishDuet(s, true, 'all');
      return s;
    }
    default: throw new Error('Unknown action');
  }
}

function duetEndTurn(s) {
  s.timer--; s.clue = null; s.guessesMade = 0;
  if (s.timer <= 0) { s.phase = 'sudden'; return; }
  // the next clue-giver is the other player, unless they have no agents left to clue
  const next = duetOther(s.turn);
  s.turn = duetSideLeft(s, next) > 0 ? next : s.turn;
  s.phase = 'clue';
}
function finishDuet(s, won, reason) { s.phase = 'over'; s.winner = won ? 'us' : null; s.reason = reason; }

// seat 'A' sees keyA, 'B' sees keyB (plus anything revealed by play)
export function viewDuet(state, seat) {
  const v = structuredClone(state);
  if (state.phase === 'over' || seat === 'all') return v;
  if (seat === 'A') v.keyB = null; else if (seat === 'B') v.keyA = null; else { v.keyA = null; v.keyB = null; }
  return v;
}
