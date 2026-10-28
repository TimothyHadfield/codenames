// Word packs (2026-10-28) + the "unlimited guesses" house rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../js/engine.js';
import { game, setAssoc, setPacks } from '../js/game.js';
import { loadAssoc, loadPacks } from '../tools/load-node.mjs';

const P = JSON.parse(readFileSync(new URL('../data/packs.json', import.meta.url), 'utf8'));
const A = loadAssoc();
const meanBefore = Float32Array.from(A.clueMean);
const baseN = A.nB;
loadPacks(A); // every pack's rows
setAssoc(A); setPacks(P);
const json = x => JSON.parse(JSON.stringify(x));

test('packs.json: 6+ packs of 60+ words, no word twice, no two words in a pack that clash under the clue rule', () => {
  assert.ok(P.packs.length >= 6);
  for (const p of P.packs) {
    assert.ok(p.words.length >= 60, p.id + ' size');
    assert.equal(new Set(p.words).size, p.words.length, p.id + ' repeats');
    for (let i = 0; i < p.words.length; i++) for (let j = i + 1; j < p.words.length; j++)
      assert.ok(!E.related(p.words[i], p.words[j]), `${p.id}: ${p.words[i]} / ${p.words[j]}`);
  }
});

test('every pack word has a real row in the word table (in GloVe), base table untouched', () => {
  assert.equal(P.base, baseN);
  assert.equal(A.nB, baseN + P.extra.length);
  for (const p of P.packs) for (const w of p.words) {
    const b = A.boardIdx.get(w);
    assert.ok(b != null, w + ' missing');
    let nz = 0;
    for (let c = 0; c < A.nC; c++) if (A.sims[b * A.nC + c]) nz++;
    assert.ok(nz > A.nC * 0.9, w + ' has an empty row');
  }
  assert.deepEqual(A.clueMean, meanBefore, 'clue means come from the base words only');
  assert.equal(A.board.slice(0, baseN).join(), JSON.parse(readFileSync(new URL('../data/words.json', import.meta.url), 'utf8')).board.join());
});

test('base boards do not change with packs loaded; a pack board mixes that pack with base words, same code = same board', () => {
  const base = game.setup(4, { variant: 'classic', code: 'FROG' }, Math.random, []);
  assert.deepEqual(base.words, E.genClassic('FROG', baseN).words);
  for (const p of P.packs) {
    const a = game.setup(4, { variant: 'classic', code: 'FROG', pack: p.id }, Math.random, []);
    const b = game.setup(2, { variant: 'duet', code: 'FROG', pack: p.id }, Math.random, []);
    const again = game.setup(4, { variant: 'classic', code: 'FROG', pack: p.id }, Math.random, []);
    assert.deepEqual(again.w, a.w);
    for (const s of [a, b]) {
      assert.equal(new Set(s.w).size, 25);
      assert.equal(s.w.filter(w => p.words.includes(w)).length, p.mix ?? E.PACK_MIX, p.id + ': pack words on the board');
      assert.ok(s.words.every(i => i < baseN || p.words.includes(A.board[i])), p.id + ': the rest are base words');
      assert.ok(s.words.every((i, k) => A.board[i] === s.w[k]));
      assert.equal(s.pack, p.id);
    }
  }
  assert.throws(() => game.setup(4, { variant: 'classic', pack: 'nope' }, Math.random, []), /pack/i);
});

test('computer-only games finish on every pack and variant', () => {
  for (const p of P.packs) for (const variant of ['classic', 'coop', 'duet']) {
    const n = variant === 'classic' ? 4 : 2;
    let s = game.setup(n, { variant, pack: p.id, code: 'PK' + variant }, E.mulberry32(5), []);
    let steps = 0;
    while (!game.isOver(s)) {
      const seat = game.toAct(s)[0];
      s = game.apply(json(s), seat, game.bot({ state: s }, seat));
      assert.ok(++steps < 400);
    }
  }
});

test('house rule "unlimited guesses": no number + 1 cap; off = the rulebook cap', () => {
  for (const unlimited of [false, true]) {
    let s = game.setup(4, { variant: 'classic', code: 'CAP1', rules: { unlimited } }, Math.random, []);
    const team = s.turn;
    s = game.apply(s, 0 + (team === 'B'), { type: 'clue', word: 'zzzq', n: 1 });
    const mine = s.key.map((k, p) => (k === team ? p : -1)).filter(p => p >= 0);
    const guesser = team === 'R' ? 2 : 3;
    for (let i = 0; i < 2; i++) s = game.apply(s, guesser, { type: 'guess', pos: mine[i] });
    // 1 + 1 guesses used: the rulebook ends the turn; the house rule keeps it
    assert.equal(s.turn === team && s.phase === 'guess', unlimited, 'turn continues only with the house rule');
    if (unlimited) {
      s = game.apply(s, guesser, { type: 'guess', pos: mine[2] });
      assert.equal(s.turn, team);
      assert.equal(game.publicView(s).rules.unlimited, true);
    }
  }
});
