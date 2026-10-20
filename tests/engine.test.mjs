// node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { loadAssoc } from '../tools/load-node.mjs';

const A = loadAssoc();
const count = (arr, v) => arr.filter(x => x === v).length;

test('word table: 400+ board words, sizes match, all board words are also clue words', () => {
  assert.ok(A.nB >= 400, 'board words ' + A.nB);
  assert.equal(A.sims.length, A.nB * A.nC);
  for (const w of A.board) assert.ok(A.clueIndex(w) >= 0, w);
  assert.equal(new Set(A.board).size, A.nB, 'no duplicate board words');
});

test('word table: closeness makes sense (bank~money beats bank~zebra)', () => {
  const bank = A.boardIdx.get('bank');
  assert.ok(A.sim(bank, A.clueIndex('money')) > A.sim(bank, A.clueIndex('zebra')) + 0.2);
  // the int8 table is the 300-d cosine to within rounding
  assert.ok(Math.abs(A.sim(bank, A.clueIndex('bank')) - 1) < 0.01, 'self closeness is 1');
});

test('classic board: 25 different words, 9/8/7/1 split, starting team has 9', () => {
  for (let i = 0; i < 300; i++) {
    const b = E.genClassic('X' + i, A.nB);
    assert.equal(b.words.length, 25);
    assert.equal(new Set(b.words).size, 25);
    assert.equal(count(b.key, b.start), 9);
    assert.equal(count(b.key, E.other(b.start)), 8);
    assert.equal(count(b.key, 'N'), 7);
    assert.equal(count(b.key, 'A'), 1);
  }
});

test('same code = same board and key on every phone; different codes differ', () => {
  const a = E.genClassic('frog', A.nB), b = E.genClassic('FROG', A.nB), c = E.genClassic('FROH', A.nB);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.words, c.words);
  // pinned so an accidental change to the word list or the shuffle is caught (would split two phones)
  assert.equal(E.hashStr('cn1:classic:FROG'), E.hashStr('cn1:classic:FROG'));
  const snapshot = a.words.slice(0, 5).map(w => A.board[w]).join(',') + '|' + a.start;
  assert.equal(snapshot, 'sand,brush,head,circus,paper|R');
});

test('starting team is about half red, half blue', () => {
  let r = 0;
  for (let i = 0; i < 2000; i++) if (E.genClassic('S' + i, A.nB).start === 'R') r++;
  assert.ok(r > 900 && r < 1100, 'red starts ' + r);
});

test('duet key: 9 green / 3 assassin / 13 bystander per side, 15 agents, rulebook overlaps', () => {
  for (let i = 0; i < 200; i++) {
    const d = E.genDuet('D' + i, A.nB);
    for (const k of [d.keyA, d.keyB]) {
      assert.equal(count(k, 'G'), 9); assert.equal(count(k, 'A'), 3); assert.equal(count(k, 'N'), 13);
    }
    const pair = (x, y) => d.keyA.filter((a, p) => a === x && d.keyB[p] === y).length;
    assert.equal(pair('G', 'G'), 3);
    assert.equal(pair('G', 'N') + pair('N', 'G'), 10);
    assert.equal(pair('G', 'A') + pair('A', 'G'), 2);
    assert.equal(pair('A', 'A'), 1);
    assert.equal(pair('A', 'N') + pair('N', 'A'), 2);
    assert.equal(pair('N', 'N'), 7);
    assert.equal(d.keyA.filter((a, p) => a === 'G' || d.keyB[p] === 'G').length, 15);
  }
});

test('clue rules: board words, forms of board words and two words are refused', () => {
  const board = ['apple', 'horseshoe', 'face', 'bank'];
  assert.equal(E.checkClue('apple', board).ok, false);
  assert.equal(E.checkClue('apples', board).ok, false);
  assert.equal(E.checkClue('horse', board).ok, false);  // part of a compound on the board
  assert.equal(E.checkClue('facing', board).ok, false);
  assert.equal(E.checkClue('fruit salad', board).ok, false);
  assert.equal(E.checkClue('fruit', board).ok, true);
  assert.equal(E.checkClue('money', board).ok, true);
});

// brute force: enumerate every guess order with the softmax chances, compare to riskOfClue
function bruteRisk(items, team, n, T) {
  const out = { assassin: 0, opponent: 0, neutral: 0, allRight: 0, expRight: 0 };
  (function go(left, k, prob, right) {
    if (k === 0) { out.allRight += prob; out.expRight += prob * right; return; }
    const tot = left.reduce((s, i) => s + Math.exp(items[i].sim / T), 0);
    for (const i of left) {
      const p = prob * Math.exp(items[i].sim / T) / tot;
      const c = items[i].color;
      if (c === team) go(left.filter(j => j !== i), k - 1, p, right + 1);
      else { out.expRight += p * right; if (c === 'A') out.assassin += p; else if (c === 'N') out.neutral += p; else out.opponent += p; }
    }
  })(items.map((_, i) => i), n, 1, 0);
  return out;
}

test('risk grade: exact recursion matches brute force on small boards', () => {
  const rng = E.mulberry32(7);
  for (let trial = 0; trial < 30; trial++) {
    const colors = E.shuffle(['B', 'B', 'B', 'B', 'R', 'R', 'R', 'N', 'N', 'A'], rng);
    const items = colors.map(color => ({ color, sim: rng() * 0.6 - 0.1 }));
    for (const n of [1, 2, 3]) {
      const a = E.riskOfClue(items, 'B', n, 0.05), b = bruteRisk(items, 'B', n, 0.05);
      for (const k of Object.keys(b)) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, `${k} ${a[k]} vs ${b[k]}`);
      const total = a.assassin + a.opponent + a.neutral + a.allRight;
      assert.ok(Math.abs(total - 1) < 1e-9, 'outcomes add to 100%');
    }
  }
});

test('risk grade: hand-worked 1-word case (2 words, equal closeness = 50/50)', () => {
  const r = E.riskOfClue([{ sim: 0.3, color: 'B' }, { sim: 0.3, color: 'A' }], 'B', 1);
  assert.ok(Math.abs(r.assassin - 0.5) < 1e-12 && Math.abs(r.allRight - 0.5) < 1e-12);
});

test('classic game: guesses = number + 1, wrong colour ends the turn, assassin loses', () => {
  let s = E.newClassic('GAME', A.nB);
  const t = s.turn, o = E.other(t);
  const own = s.key.map((k, p) => [k, p]).filter(x => x[0] === t).map(x => x[1]);
  s = E.apply(s, { type: 'clue', team: t, word: 'zzz', n: 1 });
  assert.throws(() => E.apply(s, { type: 'pass', team: t }), /at least one/);
  s = E.apply(s, { type: 'guess', team: t, pos: own[0] });
  assert.equal(s.turn, t);
  s = E.apply(s, { type: 'guess', team: t, pos: own[1] }); // the +1 guess
  assert.equal(s.turn, o, 'turn passes after n+1 guesses');
  const opp = s.key.findIndex((k, p) => k === t && !s.revealed[p]);
  s = E.apply(s, { type: 'clue', team: o, word: 'yyy', n: 2 });
  s = E.apply(s, { type: 'guess', team: o, pos: opp }); // their guess hits our agent
  assert.equal(s.turn, t, 'wrong colour ends the turn');
  s = E.apply(s, { type: 'clue', team: t, word: 'xxx', n: 2 });
  s = E.apply(s, { type: 'guess', team: t, pos: s.key.indexOf('A') });
  assert.equal(s.phase, 'over'); assert.equal(s.winner, o); assert.equal(s.reason, 'assassin');
});

test('classic game: a team wins when its last agent is revealed, even by the other team', () => {
  let s = E.newClassic('LAST', A.nB);
  const t = s.turn, o = E.other(t);
  // reveal all but one of o's agents directly, then let t guess the last one
  const oPos = s.key.map((k, p) => [k, p]).filter(x => x[0] === o).map(x => x[1]);
  for (const p of oPos.slice(0, -1)) s.revealed[p] = true;
  s = E.apply(s, { type: 'clue', team: t, word: 'oops', n: 1 });
  s = E.apply(s, { type: 'guess', team: t, pos: oPos.at(-1) });
  assert.equal(s.phase, 'over'); assert.equal(s.winner, o);
});

test('zero and unlimited clues have no guess cap but still need one guess', () => {
  for (const n of [0, -1]) {
    let s = E.newClassic('ZERO', A.nB);
    const t = s.turn;
    s = E.apply(s, { type: 'clue', team: t, word: 'none', n });
    const own = s.key.map((k, p) => [k, p]).filter(x => x[0] === t).map(x => x[1]);
    for (let i = 0; i < 5; i++) s = E.apply(s, { type: 'guess', team: t, pos: own[i] });
    assert.equal(s.turn, t);
  }
});

test('invalid clue penalty: turn ends and the calling team covers one of its own agents', () => {
  let s = E.newClassic('PEN', A.nB);
  const t = s.turn, o = E.other(t);
  s = E.apply(s, { type: 'clue', team: t, word: 'bad', n: 2 });
  assert.throws(() => E.apply(s, { type: 'invalid', team: t }));
  s = E.apply(s, { type: 'invalid', team: o });
  assert.equal(s.phase, 'penalty'); assert.equal(s.turn, o);
  const mine = s.key.indexOf(o);
  assert.throws(() => E.apply(s, { type: 'dummy', team: o, pos: s.key.indexOf(t) }));
  s = E.apply(s, { type: 'dummy', team: o, pos: mine });
  assert.equal(s.phase, 'clue'); assert.equal(s.turn, o);
});

test('two-player (coop) game: pretend opponent covers one agent per turn; score = their agents left', () => {
  let s = E.newClassic('COOP', A.nB, { mode: 'coop' });
  const us = s.start;
  s = E.apply(s, { type: 'clue', team: us, word: 'a', n: 1 });
  s = E.apply(s, { type: 'guess', team: us, pos: s.key.indexOf('N') });
  assert.equal(s.phase, 'dummy');
  s = E.apply(s, { type: 'dummy', team: s.turn, pos: E.dummyPick(A, s) });
  assert.equal(s.turn, us); assert.equal(s.phase, 'clue');
  // finish: reveal our agents
  s = E.apply(s, { type: 'clue', team: us, word: 'b', n: -1 });
  for (let p = 0; p < 25 && s.phase !== 'over'; p++) if (s.key[p] === us && !s.revealed[p]) s = E.apply(s, { type: 'guess', team: us, pos: p });
  assert.equal(s.winner, us);
  assert.equal(E.coopScore(s), 7);
});

test('view hides the key from operatives, shows it to spymasters', () => {
  let s = E.newClassic('VIEW', A.nB);
  const op = E.view(s, 'R-op'), spy = E.view(s, 'B-spy');
  assert.ok(op.key.every(k => k === null));
  assert.deepEqual(spy.key, s.key);
  s = E.apply(s, { type: 'clue', team: s.turn, word: 'q', n: 1 });
  s = E.apply(s, { type: 'guess', team: s.turn, pos: 0 });
  assert.equal(E.view(s, 'R-op').key[0], s.key[0], 'revealed words show their colour');
});

test('duet: clue-giver side decides colour, unlimited correct guesses, bystander ends turn and uses a timer', () => {
  let s = E.newDuet('DUET', A.nB);
  const g = s.keyA.map((k, p) => [k, p]).filter(x => x[0] === 'G').map(x => x[1]);
  s = E.applyDuet(s, { type: 'clue', team: 'A', word: 'x', n: 1 });
  for (let i = 0; i < 4; i++) s = E.applyDuet(s, { type: 'guess', team: 'B', pos: g[i] });
  assert.equal(s.phase, 'guess', 'no cap on correct guesses in Duet');
  const by = s.keyA.findIndex((k, p) => k === 'N' && s.keyB[p] !== 'A');
  s = E.applyDuet(s, { type: 'guess', team: 'B', pos: by });
  assert.equal(s.timer, 8); assert.equal(s.turn, 'B'); assert.equal(s.byst[by], 'B');
  const view = E.viewDuet(s, 'A');
  assert.equal(view.keyB, null); assert.ok(view.keyA);
});

test('duet: sudden death after the last timer turn; any non-agent loses', () => {
  let s = E.newDuet('SD', A.nB, { timer: 1 });
  s = E.applyDuet(s, { type: 'clue', team: 'A', word: 'x', n: 1 });
  const g = s.keyA.indexOf('G');
  s = E.applyDuet(s, { type: 'guess', team: 'B', pos: g });
  s = E.applyDuet(s, { type: 'pass', team: 'B' });
  assert.equal(s.phase, 'sudden');
  const by = s.keyB.findIndex((k, p) => k === 'N' && !s.found[p]);
  s = E.applyDuet(s, { type: 'sdguess', team: 'A', pos: by });
  assert.equal(s.phase, 'over'); assert.equal(s.winner, null);
});

test('computer spymaster: clue is legal and its targets are its own team', () => {
  for (let i = 0; i < 20; i++) {
    const b = E.genClassic('C' + i, A.nB);
    const c = E.bestClue(A, b, Array(25).fill(false), b.start, 'normal');
    assert.ok(E.checkClue(c.clue, b.words.map(w => A.board[w])).ok, c.clue);
    assert.equal(c.targets.length, c.n);
    for (const p of c.targets) assert.equal(b.key[p], b.start);
  }
});

test('computer guesser ranks the obvious word first', () => {
  const b = E.genClassic('FROG', A.nB);
  const r = E.rankForClue(A, b, Array(25).fill(false), 'motorcycle');
  assert.equal(A.board[b.words[r[0].pos]], 'bike');
});
