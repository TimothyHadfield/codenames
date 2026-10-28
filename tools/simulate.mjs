// Measure the computer honestly (Tim: "measured accuracy of the computer (how often its
// guesses are right in simulation)").
//
// Plays the official two-player game (your team vs a pretend opponent who loses one agent
// per turn) with a computer spymaster and a computer guesser, many boards.
// "Same mind": guesser uses the same 300-d table as the spymaster (best case).
// "Other mind": the other side uses the 50-d GloVe table, a stand-in for a human who
// links words differently. Needs the eval table from build_assoc.py --eval-out.
//
// usage: node tools/simulate.mjs <assoc50.bin> [games=300] [--pack <id>]
//   --pack: boards from that word pack (needs packs50.bin from build_packs.py --eval-out beside
//   assoc50.bin); prints only, data/strength.json stays the base list's numbers.
import { loadAssoc, loadPacks } from './load-node.mjs';
import { dirname, join } from 'node:path';
import * as E from '../js/engine.js';

const args = process.argv.slice(2);
const PACK_ID = args.includes('--pack') ? args.splice(args.indexOf('--pack'), 2)[1] : null;
const evalBin = args[0];
const GAMES = +(args[1] || 300);
const A300 = loadAssoc();
const A50 = evalBin ? loadAssoc(evalBin) : null;
let PACK = null;
if (PACK_ID) {
  const P = loadPacks(A300, [PACK_ID]);
  if (A50) loadPacks(A50, null, join(dirname(evalBin), 'packs50.bin'));
  const all = A300.board;
  PACK = { id: PACK_ID, version: P.version, k: process.env.PACK_K ? +process.env.PACK_K : P.packs.find(p => p.id === PACK_ID).mix, idx: P.packs.find(p => p.id === PACK_ID).words.map(w => all.indexOf(w)) };
}

// spymaster mind S gives clues, guesser mind G guesses; returns game stats
export function playCoop(code, S, G, style) {
  let s = E.newClassic(code, S.nBase ?? S.nB, { mode: 'coop', pack: PACK });
  const used = new Set();
  const st = { clues: 0, words: 0, guesses: 0, right: 0, wrong: 0 };
  while (s.phase !== 'over') {
    if (s.phase === 'dummy') { s = E.apply(s, { type: 'dummy', team: s.turn, pos: E.dummyPick(S, s) }); continue; }
    const team = s.turn;
    const c = E.bestClue(S, s, s.revealed, team, style, used);
    used.add(c.clue);
    st.clues++; st.words += c.n;
    s = E.apply(s, { type: 'clue', team, word: c.clue, n: c.n, targets: c.targets });
    const ranked = E.rankForClue(G, s, s.revealed, c.clue);
    const k = E.computerGuessCount(c.n, ranked);
    for (let i = 0; i < k && s.phase === 'guess' && s.turn === team; i++) {
      const pos = ranked[i].pos;
      st.guesses++;
      if (s.key[pos] === team) st.right++; else st.wrong++;
      s = E.apply(s, { type: 'guess', team, pos });
    }
    if (s.phase === 'guess' && s.turn === team) s = E.apply(s, { type: 'pass', team });
  }
  return { ...st, won: s.winner === s.start, assassin: s.reason === 'assassin', score: E.coopScore(s), turns: s.history.filter(h => !h.dummy).length };
}

function run(label, S, G, style) {
  const agg = { games: 0, won: 0, assassin: 0, score: 0, turns: 0, clues: 0, words: 0, guesses: 0, right: 0 };
  for (let g = 0; g < GAMES; g++) {
    const r = playCoop('SIM' + g, S, G, style);
    agg.games++; agg.won += r.won; agg.assassin += r.assassin; agg.clues += r.clues; agg.words += r.words;
    agg.guesses += r.guesses; agg.right += r.right;
    if (r.won) { agg.score += r.score; agg.turns += r.turns; }
  }
  const pct = x => (100 * x).toFixed(0) + '%';
  console.log([label.padEnd(26), style.padEnd(7),
    'win ' + pct(agg.won / agg.games), 'assassin ' + pct(agg.assassin / agg.games),
    'right ' + pct(agg.right / agg.guesses), 'words/clue ' + (agg.words / agg.clues).toFixed(2),
    'avg score ' + (agg.won ? (agg.score / agg.won).toFixed(1) : '-'),
    'turns ' + (agg.won ? (agg.turns / agg.won).toFixed(1) : '-')].join('  '));
  return agg;
}

const row = (who, style, a) => ({
  who, style, right: Math.round(100 * a.right / a.guesses), wpc: +(a.words / a.clues).toFixed(2),
  win: Math.round(100 * a.won / a.games), ass: Math.round(100 * a.assassin / a.games),
  score: a.won ? +(a.score / a.won).toFixed(1) : null, turns: a.won ? +(a.turns / a.won).toFixed(1) : null,
});

if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  console.log(`${GAMES} games each, official two-player rules${PACK ? ', pack ' + PACK.id : ''}`);
  const rows = [];
  for (const style of ['safe', 'normal', 'bold']) {
    rows.push(row('same-mind', style, run('same mind (300d/300d)', A300, A300, style)));
    if (A50) rows.push(row('cpu-clues', style, run('computer clues, other guesses', A300, A50, style)));
    if (A50) rows.push(row('cpu-guesses', style, run('other clues, computer guesses', A50, A300, style)));
  }
  if (A50 && !PACK) {
    const { writeFileSync } = await import('node:fs');
    const out = new URL('../data/strength.json', import.meta.url);
    writeFileSync(out, JSON.stringify({ measured: new Date().toISOString().slice(0, 10), games: GAMES, rows }, null, 1));
    console.log('wrote data/strength.json');
  }
}
