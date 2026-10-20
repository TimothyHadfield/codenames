// The online.js adapter: invariants from _online/README.md §6.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { game, setAssoc, role } from '../js/game.js';
import { createLocal } from '../js/online.js';
import { loadAssoc } from '../tools/load-node.mjs';

const A = loadAssoc();
setAssoc(A);
const json = x => JSON.parse(JSON.stringify(x));
const SEATS = { classic: 4, coop: 2, duet: 2 };

// a random legal-looking move for whoever must act (exercises odd human play, not just bots)
function randomMove(s, seat, rng) {
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  if (s.phase === 'clue') {
    for (;;) {
      const w = pick(A.clues);
      if (E.checkClue(w, s.w).ok) return { type: 'clue', word: w, n: pick([-1, 0, 1, 2, 3, 4]) };
    }
  }
  const open = [];
  for (let p = 0; p < 25; p++) {
    if (s.variant === 'duet') { if (!s.found[p] && !s.byst[p].includes(role(s, seat).side)) open.push(p); }
    else if (s.phase === 'dummy' || s.phase === 'penalty') { if (!s.revealed[p] && s.key[p] === s.turn) open.push(p); }
    else if (!s.revealed[p]) open.push(p);
  }
  if (s.phase === 'dummy' || s.phase === 'penalty') return { type: 'cover', pos: pick(open) };
  if (s.phase === 'sudden') return { type: 'sdguess', pos: pick(open) };
  if (s.guessesMade > 0 && rng() < 0.3) return { type: 'pass' };
  return { type: 'guess', pos: pick(open) };
}

test('600 random games per variant: never stuck, never throws on legal moves, JSON-safe', () => {
  for (const variant of ['classic', 'coop', 'duet']) {
    for (let g = 0; g < 600; g++) {
      const rng = E.mulberry32(g + 1);
      let s = game.setup(SEATS[variant], { variant, code: 'R' + g }, rng, []);
      let steps = 0;
      while (!game.isOver(s)) {
        const toAct = game.toAct(s);
        assert.ok(toAct.length > 0, `${variant} stuck in ${s.phase}`);
        const seat = toAct[0];
        s = game.apply(json(s), seat, randomMove(s, seat, rng));
        assert.deepEqual(json(s), s, 'state survives JSON');
        assert.ok(++steps < 500, 'game ends');
      }
      if (variant !== 'duet') {
        const left = E.counts(s);
        assert.ok(s.reason === 'assassin' || left[s.winner] === 0, 'winner found all agents unless assassin');
      }
    }
  }
});

test('computer-only games finish for every variant (bots never make an illegal move)', () => {
  for (const variant of ['classic', 'coop', 'duet']) {
    for (let g = 0; g < 6; g++) {
      const rng = E.mulberry32(99 + g);
      const kinds = Array(SEATS[variant]).fill({ kind: 'computer' });
      let s = game.setup(SEATS[variant], { variant, code: 'B' + g }, rng, kinds);
      while (!game.isOver(s)) {
        for (const seat of game.toAct(s)) {
          if (game.isOver(s) || !game.toAct(s).includes(seat)) continue;
          const ctx = { pub: game.publicView(s), mine: game.privateView(s, seat), state: s };
          s = game.apply(json(s), seat, game.bot(ctx, seat, rng));
        }
      }
    }
  }
});

test('secrecy: guessers and the public view never see unrevealed key colours', () => {
  const s = game.setup(6, { variant: 'classic', code: 'SECRET' }, Math.random, []);
  const pub = game.publicView(s);
  assert.ok(pub.key.every(k => k === null));
  assert.ok(!('keyA' in pub && pub.keyA));
  for (const seat of [2, 3, 4, 5]) assert.deepEqual(game.privateView(s, seat), {});
  assert.deepEqual(game.privateView(s, 0).key, s.key);
  assert.deepEqual(game.privateView(s, 1).key, s.key);
  const d = game.setup(2, { variant: 'duet', code: 'SECRET' }, Math.random, []);
  const dp = JSON.stringify(game.publicView(d));
  assert.equal(game.publicView(d).keyA, null); assert.equal(game.publicView(d).keyB, null);
  assert.ok(!dp.includes('"G"'), 'no key letters in the duet public view');
  assert.deepEqual(game.privateView(d, 0).key, d.keyA);
  assert.deepEqual(game.privateView(d, 1).key, d.keyB);
});

test('secrecy: the board seed never reaches the public view and is too long to guess (QA 2026-10-19)', () => {
  for (const variant of ['classic', 'coop', 'duet']) {
    const s = game.setup(SEATS[variant], { variant }, E.mulberry32(7), []);
    const pub = game.publicView(s);
    assert.ok(!('code' in pub), `${variant}: no seed in the public view`);
    assert.ok(!JSON.stringify(pub).includes(s.code), `${variant}: seed text not in the public view`);
    assert.ok(s.code.length >= 8, `${variant}: seed is not a short guessable code`);
  }
});

test('duet sudden death: the player who can still find agents gets to point (QA 2026-10-19)', () => {
  let s = game.setup(2, { variant: 'duet', code: 'SD1' }, E.mulberry32(3), [{ kind: 'human' }, { kind: 'computer' }]);
  // leave only words that are green on A's side alone: only B (scored on A's key) can find them
  s.found = s.keyA.map((a, p) => !(a === 'G' && s.keyB[p] !== 'G'));
  s.phase = 'sudden'; s.timer = 0;
  assert.deepEqual(game.toAct(s), [1]);
  // and the other way round
  s.found = s.keyB.map((b, p) => !(b === 'G' && s.keyA[p] !== 'G'));
  assert.deepEqual(game.toAct(s), [0]);
  // both have words left: they take turns, A first
  s.found = Array(25).fill(false);
  assert.deepEqual(game.toAct(s), [0]);
  s.history.push({ sudden: true, guesser: 'A', guesses: [] });
  assert.deepEqual(game.toAct(s), [1]);
});

test('only the right seat may act; bad clues are refused', () => {
  let s = game.setup(4, { variant: 'classic', code: 'TURN' }, Math.random, []);
  const spy = s.turn === 'R' ? 0 : 1, otherSpy = 1 - spy;
  assert.throws(() => game.apply(json(s), otherSpy, { type: 'clue', word: 'tree', n: 1 }), /Not your turn/);
  assert.throws(() => game.apply(json(s), spy, { type: 'clue', word: s.w[3], n: 1 }), /on the board/);
  assert.throws(() => game.apply(json(s), spy, { type: 'clue', word: 'two words', n: 1 }), /One word/);
});

test('createLocal plays a computer-only classic game to the end', async () => {
  const room = createLocal({ game, seats: ['computer', 'computer', 'computer', 'computer'], botDelayMs: 0, options: { code: 'LOCAL' }, rng: E.mulberry32(5) });
  let last = null;
  room.on('change', snap => { last = snap; });
  room.on('error', e => { throw e; });
  room.start();
  for (let i = 0; i < 400 && last.status !== 'finished'; i++) await new Promise(r => setTimeout(r, 5));
  assert.equal(last.status, 'finished');
  room.close();
});
