// Codenames as an online.js game (see _online/README.md): pure setup / toAct / apply /
// publicView / privateView / bot / isOver around the rules in engine.js.
//
// Seats
//   classic (two teams, 4-10 seats): 0 = Red spymaster, 1 = Blue spymaster,
//            then guessers alternate Red (even seats) and Blue (odd seats).
//   coop    (official two-player rules, 2-6 seats): 0 = spymaster, the rest guess.
//   duet    (2 seats): 0 = player A, 1 = player B (each sees one side of the key).
import * as E from './engine.js';

let ASSOC = null;           // the word table (loaded by the page, or by tests in node)
let BOARD_WORDS = null;     // board word strings, needed by setup before the table loads
export function setAssoc(a) { ASSOC = a; if (a) BOARD_WORDS = a.board; }
export function setBoardWords(list) { BOARD_WORDS = list; }
export const getAssoc = () => ASSOC;

export function role(s, seat) {
  if (s.variant === 'duet') return { side: seat === 0 ? 'A' : 'B' };
  if (s.variant === 'coop') return { team: s.start, spy: seat === 0 };
  if (seat === 0) return { team: 'R', spy: true };
  if (seat === 1) return { team: 'B', spy: true };
  return { team: seat % 2 === 0 ? 'R' : 'B', spy: false };
}
export function seatName(s, seat) {
  const r = role(s, seat);
  if (s.variant === 'duet') return 'Player ' + r.side;
  if (s.variant === 'coop') return r.spy ? 'Spymaster' : 'Guesser';
  return (r.team === 'R' ? 'Red ' : 'Blue ') + (r.spy ? 'spymaster' : 'guesser');
}
// Words a clue may not echo: only those still showing. The rulebook bars a visible word and its
// forms "until it is covered"; Duet's green cards cover a word, its bystander cards do not.
export function visibleWords(s) {
  return s.w.filter((w, p) => (s.variant === 'duet' ? !s.found[p] : !s.revealed[p]));
}
// A state the computer can choose from, built from what this seat sees (online "Pick for me").
export function stateFromViews(pub, mine = {}) {
  return { ...pub, key: mine.key || pub.key, words: pub.w.map(w => BOARD_WORDS.indexOf(w)), used: [] };
}
const spySeat = (s, team) => (s.variant === 'coop' ? 0 : team === 'R' ? 0 : 1);
const opSeats = (s, team) => {
  const out = [];
  for (let i = 0; i < s.n; i++) { const r = role(s, i); if (!r.spy && r.team === team) out.push(i); }
  return out;
};

export const game = {
  id: 'codenames',
  minSeats: 2,
  maxSeats: 10,

  setup(n, options = {}, rng = Math.random, seats = []) {
    const variant = options.variant || 'classic';
    if (!BOARD_WORDS) throw new Error('Word list not loaded');
    // The seed stays in the host's state only: a short or public seed would let a guesser
    // rebuild the key with genClassic/genDuet (QA 2026-10-19). 8 of A-Z0-9 covers the 32-bit seed space.
    let code = E.normCode(options.code);
    if (!code) { code = ''; for (let i = 0; i < 8; i++) code += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(rng() * 36)]; }
    const nW = BOARD_WORDS.length;
    let s;
    if (variant === 'duet') {
      if (n !== 2) throw new Error('Duet is for 2 seats');
      s = E.newDuet(code, nW, { timer: options.timer || 9 });
    } else {
      if (variant === 'classic' && n < 4) throw new Error('Two teams need 4 seats');
      s = E.newClassic(code, nW, { mode: variant === 'coop' ? 'coop' : 'teams' });
    }
    s.variant = variant; s.n = n;
    s.w = s.words.map(i => BOARD_WORDS[i]);
    s.kinds = seats.map(x => x.kind || 'human');
    s.style = options.style || 'normal';
    s.used = [];
    return s;
  },

  toAct(s) {
    if (s.phase === 'over') return [];
    if (s.variant === 'duet') {
      if (s.phase === 'clue') return [s.turn === 'A' ? 0 : 1];
      if (s.phase === 'guess') return [s.turn === 'A' ? 1 : 0];
      // Sudden death: a guess by A is checked on B's side and vice versa, so a seat may point
      // only while its partner's side still has agents. When both can, they take turns (A first).
      const can = [0, 1].filter(i => E.duetSideLeft(s, i === 0 ? 'B' : 'A') > 0);
      if (can.length < 2) return can;
      const last = [...s.history].reverse().find(h => h.sudden);
      return [last && last.guesser === 'A' ? 1 : 0];
    }
    if (s.phase === 'clue' || s.phase === 'penalty') return [spySeat(s, s.turn)];
    if (s.phase === 'guess') return opSeats(s, s.turn);
    if (s.phase === 'dummy') return [0];
    return [];
  },

  apply(s, seat, a) {
    if (!game.toAct(s).includes(seat)) throw new Error('Not your turn');
    if (!a || typeof a !== 'object') throw new Error('No move');
    if (s.variant === 'duet') {
      const side = role(s, seat).side;
      if (a.type === 'clue') {
        const chk = E.checkClue(a.word, visibleWords(s));
        if (!chk.ok) throw new Error(chk.reason);
        s = E.applyDuet(s, { type: 'clue', team: side, word: a.word, n: a.n, targets: a.targets });
        s.used.push(String(a.word).toLowerCase());
        return s;
      }
      if (a.type === 'guess' || a.type === 'pass') return E.applyDuet(s, { type: a.type, team: side, pos: a.pos });
      if (a.type === 'sdguess') return E.applyDuet(s, { type: 'sdguess', team: side, pos: a.pos });
      throw new Error('Unknown move');
    }
    const team = s.turn;
    if (a.type === 'clue') {
      const chk = E.checkClue(a.word, visibleWords(s));
      if (!chk.ok) throw new Error(chk.reason);
      s = E.apply(s, { type: 'clue', team, word: a.word, n: a.n, targets: a.targets });
      s.used.push(String(a.word).toLowerCase());
      return s;
    }
    if (a.type === 'guess' || a.type === 'pass') return E.apply(s, { type: a.type, team, pos: a.pos });
    if (a.type === 'cover') return E.apply(s, { type: 'dummy', team, pos: a.pos });
    throw new Error('Unknown move');
  },

  publicView(s) {
    const over = s.phase === 'over';
    const v = {
      variant: s.variant, n: s.n, w: s.w, phase: s.phase, turn: s.turn, clue: s.clue,
      winner: s.winner, reason: s.reason, style: s.style, kinds: s.kinds,
      history: s.history.map(h => ({ ...h, targets: over ? h.targets : null })),
    };
    if (s.variant === 'duet') {
      Object.assign(v, { found: s.found, byst: s.byst, timer: s.timer, startTimer: s.startTimer, guessesMade: s.guessesMade,
        left: E.duetAgentsLeft(s), keyA: over ? s.keyA : null, keyB: over ? s.keyB : null });
    } else {
      Object.assign(v, { start: s.start, mode: s.mode, revealed: s.revealed, by: s.by,
        guessesLeft: s.guessesLeft, guessesMade: s.guessesMade, counts: E.counts(s),
        key: s.key.map((k, p) => (over || s.revealed[p] ? k : null)), score: E.coopScore(s) });
    }
    return v;
  },

  privateView(s, seat) {
    if (seat == null || seat < 0) return {};
    if (s.variant === 'duet') return { key: seat === 0 ? s.keyA : s.keyB };
    return role(s, seat).spy ? { key: s.key } : {};
  },

  bot(ctx, seat, rng = Math.random) {
    if (!ASSOC) throw new Error('Word table still loading');
    const s = ctx.state;
    const used = new Set(s.used);
    if (s.variant === 'duet') return duetBot(s, seat, used);
    const team = s.turn;
    if (s.phase === 'clue') {
      const c = E.bestClue(ASSOC, s, s.revealed, team, s.style, used);
      return { type: 'clue', word: c.clue, n: c.n, targets: c.targets };
    }
    if (s.phase === 'dummy') return { type: 'cover', pos: E.dummyPick(ASSOC, s) };
    if (s.phase === 'penalty') {
      // cover our own agent that sits closest to the assassin (the riskiest one to clue later)
      const ass = s.key.indexOf('A');
      let best = -1, bs = -9;
      for (let p = 0; p < 25; p++) if (s.key[p] === team && !s.revealed[p]) {
        const v = E.boardSim(ASSOC, s.words[p], s.words[ass]);
        if (v > bs) { bs = v; best = p; }
      }
      return { type: 'cover', pos: best };
    }
    // guesser: only uses what everyone can see (words, revealed, the clue)
    const ranked = E.rankForClue(ASSOC, s, s.revealed, s.clue.word);
    if (s.clue.n === 0) return s.guessesMade ? { type: 'pass' } : { type: 'guess', pos: ranked[ranked.length - 1].pos };
    const k = E.computerGuessCount(s.clue.n, ranked);
    if (s.guessesMade >= k) return { type: 'pass' };
    return { type: 'guess', pos: ranked[0].pos };
  },

  isOver(s) { return s.phase === 'over'; },
};

function duetBot(s, seat, used) {
  const side = seat === 0 ? 'A' : 'B';
  const myKey = side === 'A' ? s.keyA : s.keyB;
  if (s.phase === 'clue') {
    const guesser = side === 'A' ? 'B' : 'A';
    const revealed = s.found.map((f, p) => f || s.byst[p].includes(guesser));
    const c = E.bestClue(ASSOC, { words: s.words, key: myKey }, revealed, 'G', s.style, used);
    return { type: 'clue', word: c.clue, n: c.n, targets: c.targets };
  }
  const open = p => !s.found[p] && !s.byst[p].includes(side);
  if (s.phase === 'guess') {
    const c = ASSOC.clueIndex(s.clue.word);
    const ranked = [];
    for (let p = 0; p < 25; p++) if (open(p)) ranked.push({ pos: p, sim: c < 0 ? 0 : ASSOC.sim(s.words[p], c) });
    ranked.sort((a, b) => b.sim - a.sim);
    const k = E.computerGuessCount(s.clue.n, ranked);
    if (s.guessesMade >= k || !ranked.length) return { type: 'pass' };
    return { type: 'guess', pos: ranked[0].pos };
  }
  // sudden death: pick the open word that best fits the partner's clues, avoiding our own assassins
  const partnerClues = s.history.filter(h => h.giver && h.giver !== side).map(h => ASSOC.clueIndex(h.clue)).filter(c => c >= 0);
  let best = -1, bs = -1e9;
  for (let p = 0; p < 25; p++) {
    if (s.found[p] || s.byst[p].includes(side)) continue; // our earlier bystander there = not green on their side
    let v = 0;
    for (const c of partnerClues) v = Math.max(v, ASSOC.sim(s.words[p], c));
    if (myKey[p] === 'A') v -= 0.2;
    if (v > bs) { bs = v; best = p; }
  }
  return { type: 'sdguess', pos: best };
}
