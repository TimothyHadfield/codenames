// The improvement pass (2026-10-27): computer clue safety, the guided first game's board,
// and what a finished game adds to My stats / the Daily share line (js/kit.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { game, setAssoc } from '../js/game.js';
import * as KIT from '../js/kit.js';
import { loadAssoc } from '../tools/load-node.mjs';

const A = loadAssoc();
setAssoc(A);

// The computer spymaster keeps the assassin well clear of its clue: the weakest target word must be
// at least margin + assPad closer to the clue than the assassin (Normal 0.17, Bold 0.17; was 0.16 / 0.13).
test('computer clues keep a wide berth round the assassin (Normal and Bold)', () => {
  for (const style of ['normal', 'bold']) {
    let worst = 9, n = 0;
    for (let i = 0; i < 120; i++) {
      const s = E.newClassic('ASN' + i, A.nB, { mode: 'coop' });
      const c = E.bestClue(A, s, s.revealed, s.start, style, new Set());
      if (!c || c.fallback) continue;
      const ci = A.clueIndex(c.clue);
      const low = Math.min(...c.targets.map(p => A.sims[s.words[p] * A.nC + ci] / 127));
      const ass = A.sims[s.words[s.key.indexOf('A')] * A.nC + ci] / 127;
      worst = Math.min(worst, low - ass); n++;
    }
    assert.ok(n > 100, `${style}: ${n} clues checked`);
    assert.ok(worst >= 0.17 - 1e-9, `${style}: closest assassin call ${worst.toFixed(3)}`);
  }
});

test('guided first game: board TUT7 opens with INSTRUMENT 2 for GUITAR and ORGAN', () => {
  const s = E.newClassic(KIT.TUTORIAL.code, A.nB, { mode: 'coop' });
  const c = E.bestClue(A, s, s.revealed, s.start, 'normal', new Set());
  assert.equal(c.clue, 'instrument');
  assert.equal(c.n, 2);
  assert.deepEqual(c.targets.map(p => A.board[s.words[p]]).sort(), ['guitar', 'organ']);
});

// play a real local game to the end with the computer in every seat
function playOut(variant, n, code, style = 'normal') {
  let s = game.setup(n, { variant, code, style }, () => 0.5, Array.from({ length: n }, () => ({ kind: 'computer' })));
  for (let k = 0; k < 400 && !game.isOver(s); k++) {
    const seat = game.toAct(s)[0];
    s = game.apply(s, seat, game.bot({ state: s }, seat));
  }
  assert.ok(game.isOver(s), 'game ended');
  return s;
}

test('My stats: a "You guess" game is counted with its runs and wrong guesses', () => {
  const s = playOut('coop', 2, 'KITA1');
  const pub = game.publicView(s);
  const r = KIT.result({ seats: ['computer', 'human'], pub, myTeam: pub.start, style: 'normal', helped: false, daily: false });
  assert.equal(r.mode, 'guess');
  assert.equal(r.won, pub.winner === pub.start);
  const all = pub.history.filter(h => !h.dummy).flatMap(h => h.guesses);
  assert.equal(r.extra.guessed, all.length);
  assert.equal(r.extra.wrong, all.filter(x => x.color !== pub.start).length);
  assert.ok(r.extra.bestRun >= 1);
  // the spymaster seat makes it "You give clues"
  assert.equal(KIT.result({ seats: ['human', 'computer'], pub, myTeam: pub.start, style: 'normal' }).mode, 'give');
});

test('My stats: Two teams vs the computer is rated at its level unless Hint/Undo was used; people on both sides are not counted', () => {
  const s = playOut('classic', 4, 'KITB2', 'bold');
  const pub = game.publicView(s);
  const red = KIT.result({ seats: ['human', 'computer', 'human', 'computer'], pub, myTeam: 'R', style: 'bold' });
  assert.equal(red.mode, 'computer');
  assert.equal(red.level, 'bold');
  assert.equal(red.won, pub.winner === 'R');
  const helped = KIT.result({ seats: ['human', 'computer', 'human', 'computer'], pub, myTeam: 'R', style: 'bold', helped: true });
  assert.equal(helped.mode, 'help');
  assert.equal(helped.level, null);
  const both = KIT.result({ seats: ['human', 'human', 'computer', 'computer'], pub, myTeam: 'R', style: 'bold' });
  assert.equal(both.mode, 'pass');
  assert.equal(both.won, null);
});

test('Hint or Undo makes any game unrated: not a Daily result, no skill badges; a Daily keeps its own date', () => {
  const s = playOut('coop', 2, 'KITA1');
  const pub = game.publicView(s);
  const base = { seats: ['computer', 'human'], pub, myTeam: pub.start, style: 'normal' };
  for (const seats of [['computer', 'human'], ['human', 'computer']]) {
    const r = KIT.result({ ...base, seats, helped: true, daily: '2026-10-26' });
    assert.equal(r.mode, 'help');
    assert.equal(r.level, null);
    assert.equal(r.daily, false);
    assert.equal(r.extra.bestRun, undefined);
  }
  const d = KIT.result({ ...base, daily: '2026-10-26' });
  assert.equal(d.daily, true);
  assert.equal(d.date, '2026-10-26');
  assert.equal(KIT.result(base).date, undefined);
});

test('Daily share line: a header and one square per guess, one row per turn', () => {
  const s = playOut('coop', 2, 'KITC3');
  const pub = game.publicView(s);
  const line = KIT.shareLine('2026-10-27', pub);
  const [head, ...rows] = line.split('\n');
  assert.match(head, /^Codenames daily 2026-10-27: /);
  const turns = pub.history.filter(h => !h.dummy && !h.penalty && h.guesses.length);
  assert.equal(rows.length, turns.length);
  turns.forEach((h, i) => assert.equal([...rows[i]].length, h.guesses.length));
  assert.ok(!/[A-Za-z]/.test(rows.join('')), 'no words leak into the share line');
});

test('achievements: ids are unique and each test runs on an empty profile', () => {
  const ids = KIT.ACHIEVEMENTS.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length);
  const c = { stats: { wins: 0, bestStreak: 0 }, last: null, daily: { streak: 0 } };
  for (const a of KIT.ACHIEVEMENTS) assert.equal(!!a.test(c), false, a.id);
});
