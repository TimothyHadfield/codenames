// Two computer teams play the full two-team game against each other; each board is played twice
// with the styles swapped between red and blue, so who starts doesn't matter. The win rate gives
// the Elo gap between clue styles (used for the levels in My stats: js/kit.js).
//   node tools/head2head.mjs [boards=200] [guesser.bin]
// guesser.bin: an "other mind" word table for the guessers (default: the shipped one, like the site's computer guessers)
import { loadAssoc } from './load-node.mjs';
import * as E from '../js/engine.js';

const N = +(process.argv[2] || 200);
const S = loadAssoc();
const G = process.argv[3] ? loadAssoc(process.argv[3]) : S;

function game(code, styles) {
  let s = E.newClassic(code, S.nB, { mode: 'teams' });
  const used = new Set();
  while (s.phase !== 'over') {
    const team = s.turn;
    const c = E.bestClue(S, s, s.revealed, team, styles[team], used); used.add(c.clue);
    s = E.apply(s, { type: 'clue', team, word: c.clue, n: c.n });
    const k = E.computerGuessCount(c.n, E.rankForClue(G, s, s.revealed, c.clue));
    for (let i = 0; i < k && s.phase === 'guess' && s.turn === team; i++) s = E.apply(s, { type: 'guess', team, pos: E.rankForClue(G, s, s.revealed, c.clue)[0].pos });
    if (s.phase === 'guess' && s.turn === team) s = E.apply(s, { type: 'pass', team });
  }
  return s;
}
for (const [a, b] of [['normal', 'safe'], ['bold', 'normal'], ['bold', 'safe']]) {
  let wa = 0;
  for (let g = 0; g < N; g++) for (const sw of [0, 1]) {
    const s = game('H2H' + g, sw ? { R: b, B: a } : { R: a, B: b });
    if (s.winner === (sw ? 'B' : 'R')) wa++;
  }
  const p = wa / (2 * N);
  console.log(`${a} beats ${b} ${(100 * p).toFixed(1)}%  (Elo +${Math.round(400 * Math.log10(p / (1 - p)))})`);
}
