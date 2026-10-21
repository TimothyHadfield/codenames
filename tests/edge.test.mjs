// Odd-situation tests from the 2026-10-20 edge pass (Tim: "making each game perfect especially
// in scenarios that the game doesn't expect or are a little weird").
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { game, setAssoc, visibleWords, stateFromViews } from '../js/game.js';
import { loadAssoc } from '../tools/load-node.mjs';

const A = loadAssoc();
setAssoc(A);
const json = x => JSON.parse(JSON.stringify(x));

test('clue rule: a board word that is already covered may be said again (rulebook: only visible words are off limits)', () => {
  // classic / two-player: cover a bystander, then its word is a legal clue; a visible word is still refused
  for (const variant of ['classic', 'coop']) {
    const s = game.setup(variant === 'classic' ? 4 : 2, { variant, code: 'COVERED' }, E.mulberry32(2), []);
    const p = s.key.indexOf('N');
    s.revealed[p] = true; s.by[p] = s.turn;
    const spy = variant === 'coop' ? 0 : s.turn === 'R' ? 0 : 1;
    assert.ok(!visibleWords(s).includes(s.w[p]), 'covered word is not visible');
    const after = game.apply(json(s), spy, { type: 'clue', word: s.w[p], n: 1 });
    assert.equal(after.clue.word, s.w[p]);
    const q = s.revealed.findIndex(r => !r);
    assert.throws(() => game.apply(json(s), spy, { type: 'clue', word: s.w[q], n: 1 }), /on the board/);
  }
  // Duet: a found agent (green card laid over it) is covered; a bystander card does not hide the word
  const d = game.setup(2, { variant: 'duet', code: 'COVERED' }, E.mulberry32(2), []);
  const g = d.keyA.indexOf('G'), n = d.keyB.indexOf('N');
  d.found[g] = true; d.byst[n] = 'A';
  assert.ok(game.apply(json(d), 0, { type: 'clue', word: d.w[g], n: 1 }).clue);
  assert.throws(() => game.apply(json(d), 0, { type: 'clue', word: d.w[n], n: 1 }), /on the board/);
});

test('online "Pick for me": the computer can choose a cover from what the spymaster sees', () => {
  let s = game.setup(2, { variant: 'coop', code: 'PICK' }, E.mulberry32(4), []);
  s = game.apply(json(s), 0, { type: 'clue', word: 'zebra', n: 1 });
  while (s.phase === 'guess') s = game.apply(json(s), 1, s.guessesMade ? { type: 'pass' } : { type: 'guess', pos: s.revealed.findIndex((r, p) => !r && s.key[p] !== 'A') });
  if (s.phase !== 'dummy') return;
  const st = stateFromViews(game.publicView(s), game.privateView(s, 0));
  const a = game.bot({ state: st }, 0);
  assert.equal(a.type, 'cover');
  const after = game.apply(json(s), 0, a);
  assert.ok(after.revealed[a.pos]);
});
