// Codenames' part of the shared kits (js/coach.js, js/profile.js: never edit those here):
// the computer levels' ratings, the achievement list, the rules sheet, the guided first game's
// steps, and the Daily puzzle's share line. Pure data + small helpers, no page state.

// Two teams against the computer: the computer team's clue style is its level.
// Elo from computer-vs-computer team games (tools/head2head.mjs, 400 games per pair, colours swapped,
// 2026-10-27): Normal beats Safe 68.3% (+133), Bold beats Normal 80.3% (+244).
export const LEVELS = [
  { id: 'safe', name: 'Safe', rating: 1200 },
  { id: 'normal', name: 'Normal', rating: 1333 },
  { id: 'bold', name: 'Bold', rating: 1577 },
];

const won = c => !!(c.last && c.last.won);
const ex = c => (c.last && c.last.extra) || {};
export const ACHIEVEMENTS = [
  { id: 'first', title: 'First win', desc: 'Win any game', test: c => c.stats.wins >= 1 },
  { id: 'guess', title: 'Field agent', desc: 'Win "You guess"', test: c => won(c) && c.last.mode === 'guess' },
  { id: 'give', title: 'Spymaster', desc: 'Win "You give clues"', test: c => won(c) && c.last.mode === 'give' },
  { id: 'duet', title: 'Partners', desc: 'Win a game of Duet', test: c => won(c) && c.last.mode === 'duet' },
  { id: 'teams', title: 'Team captain', desc: 'Beat a computer team in Two teams', test: c => won(c) && c.last.mode === 'computer' },
  { id: 'bold', title: 'Bold move', desc: 'Beat the Bold computer team', test: c => won(c) && c.last.mode === 'computer' && c.last.level === 'bold' },
  { id: 'run4', title: 'Mind reader', desc: '4 right on one clue', test: c => ex(c).bestRun >= 4 },
  { id: 'clean', title: 'Clean sweep', desc: 'Win without one wrong guess', test: c => won(c) && ex(c).wrong === 0 && ex(c).guessed > 0 },
  { id: 'score4', title: 'Way ahead', desc: 'Win two-player rules with 4 of theirs left', test: c => won(c) && (c.last.mode === 'guess' || c.last.mode === 'give') && c.last.score >= 4 },
  { id: 'streak', title: 'Hat trick', desc: 'Win 3 in a row', test: c => c.stats.bestStreak >= 3 },
  { id: 'daily', title: 'Daily habit', desc: '3-day Daily puzzle streak', test: c => c.daily.streak >= 3 },
];

// What one finished local game adds to the player's stats.
// g: { variant, seats: ['human'|'computer'], pub, myTeam, style, helped, daily }
export function result(g) {
  const { pub } = g;
  const humans = g.seats.map((k, i) => (k === 'human' ? i : -1)).filter(i => i >= 0);
  // how the human side guessed: right answers in a row on one clue, wrong guesses
  let bestRun = 0, wrong = 0, guessed = 0;
  for (const h of pub.history) {
    if (h.dummy || h.penalty) continue;
    const mine = pub.variant === 'duet' ? true : h.team === g.myTeam;
    if (!mine) continue;
    let run = 0;
    for (const x of h.guesses) {
      guessed++;
      const ok = pub.variant === 'duet' ? x.color === 'G' : x.color === h.team;
      if (ok) { run++; bestRun = Math.max(bestRun, run); } else wrong++;
    }
  }
  const turns = pub.history.filter(h => !h.dummy && !h.penalty && !h.sudden).length;
  const extra = { variant: pub.variant, bestRun, wrong, guessed, turns, reason: pub.reason };
  let mode, level = null, w, score = null;
  if (pub.variant === 'duet') { mode = 'duet'; w = !!pub.winner; score = pub.left; }
  else if (pub.variant === 'coop') { mode = g.seats[0] === 'human' ? 'give' : 'guess'; w = pub.winner === pub.start; score = w ? pub.score : 0; }
  else {
    const teams = new Set(humans.map(i => (i === 0 || (i >= 2 && i % 2 === 0) ? 'R' : 'B')));
    if (teams.size !== 1) return { mode: 'pass', won: null, extra };
    mode = 'computer'; level = g.style; w = pub.winner === [...teams][0];
  }
  // Hint or Undo (or a second go at today's Daily): counted, but not rated, not a Daily result, no skill badges
  if (g.helped) return { mode: 'help', level: null, won: w, score, daily: false, extra: { variant: pub.variant, turns, reason: pub.reason } };
  const out = { mode, level, won: w, score, daily: !!g.daily, extra };
  if (g.daily && typeof g.daily === 'string') out.date = g.daily; // a Daily finished after midnight counts for its own day
  return out;
}

// The Daily puzzle's result as a line to paste in a chat: one square per guess, by turn.
export function shareLine(day, pub) {
  const sq = { R: '🟥', B: '🟦', N: '🟨', A: '⬛', G: '🟩' };
  const rows = [];
  for (const h of pub.history) {
    if (h.dummy || h.penalty || !h.guesses.length) continue;
    rows.push(h.guesses.map(x => (x.color === h.team ? '🟩' : sq[x.color] || '⬜')).join(''));
  }
  const w = pub.winner === pub.start;
  const head = `Codenames daily ${day}: ${w ? `won in ${rows.length} turns, ${pub.score} of theirs left` : pub.reason === 'assassin' ? 'hit the assassin' : 'ran out of time'}`;
  return head + '\n' + rows.join('\n');
}

// ---------------------------------------------------------------- rules sheet (own words)
// Videos checked 2026-10-28: YouTube oEmbed answered 200 with these titles and channels.
export const VIDEOS = [
  { id: '9BSi6Gi3Bzo', title: 'Official how to play', by: 'Czech Games Edition' },
  { id: 'J8RWBooJivg', title: 'Codenames: how to play', by: 'Watch It Played' },
  { id: 'BCf_APiCr-Q', title: 'Codenames Duet: how to play', by: 'Top TableTop' },
  { id: '3-jmnTW9O0E', title: 'Mastering spymaster clues', by: 'Rapid Rules' },
  { id: '5yZqoSOpb1s', title: 'Strategy guide', by: 'Legendary Tactics' },
];
export function rules() {
  return {
    title: 'How to play Codenames',
    sections: [
      { id: 'goal', short: 'Goal', title: 'Goal', html: `<p>Two teams, red and blue. 25 code words lie on the table. Each team's <b>spymaster</b> knows which words are their team's <b>agents</b>; the rest of the team (the <b>guessers</b>) don't.</p>
        <p>The first team to find all its agents wins. One word is the <b>assassin</b>: the team that picks it loses at once.</p>` },
      { id: 'setup', short: 'Setup', title: 'Setup', html: `<ul><li>Lay out 25 words in a 5×5 grid.</li><li>The spymasters sit on the same side and share a <b>key card</b>: it shows 8 or 9 red squares, 8 or 9 blue, 7 bystanders and 1 assassin.</li>
        <li>The lights on the key card's edge say who starts. That team has <b>9</b> agents to find; the other has 8.</li></ul>
        <p class="tip">On this site the Table tab is the key card: same code on every phone = same board.</p>` },
      { id: 'clue', short: 'Clues', title: 'Giving a clue', html: `<p>On your turn your spymaster says <b>one word and one number</b>, like <b>ocean 2</b>: the word links to some of your agents, the number says how many.</p>
        <ul><li>The word can't be a word still showing on the board, or part of one (no <i>fire</i> while FIREMAN shows).</li><li>No hints by voice, pointing or faces.</li>
        <li><b>0</b> means "none of these", and <b>∞</b> (unlimited) means "as many as you like", both with no guess limit.</li></ul>` },
      { id: 'guess', short: 'Guessing', title: 'Guessing', html: `<p>The guessers talk it over and touch one word. The spymaster covers it with its card:</p>
        <ul><li><b>Your agent</b>: keep going (up to the number plus one).</li><li><b>A bystander</b>: your turn ends.</li><li><b>The other team's agent</b>: your turn ends, and they're one closer.</li><li><b>The assassin</b>: you lose.</li></ul>
        <p>You must make at least one guess, and you can stop any time after that.</p>
        <p class="tip">The extra guess (number + 1) is for a word you missed on an earlier clue.</p>` },
      { id: 'end', short: 'End', title: 'End of the game', html: `<p>The game ends when one team has found all its agents (it wins), or someone picks the assassin (their team loses). Covering the last of the other team's agents by mistake makes <b>them</b> win.</p>` },
      { id: 'two', short: 'Two players', title: 'Two or three players', html: `<p>One spymaster, one or two guessers, against a pretend team. Play your turn as usual. After each of your turns, the spymaster covers one of the pretend team's agents.</p>
        <p>Find all yours before all theirs are covered. Your score is how many of theirs are still showing. That's what <b>You guess</b> and <b>You give clues</b> play here.</p>` },
      { id: 'duet', short: 'Duet', title: 'Duet (co-op for two)', html: `<p>Both players are spymasters and guessers. Each sees a different side of the key; there are 15 agents to find between you, in 9 turns.</p>
        <ul><li>Clues come from either side, taking turns. A guess is checked against the <b>clue giver's</b> side.</li><li>A bystander ends the turn and uses up a turn token.</li>
        <li>When the tokens run out: <b>sudden death</b>. No more clues; point at words, and any miss loses.</li></ul>` },
      { id: 'house', short: 'House rules', title: 'House rules and word packs', html: `<p>Off unless you turn them on in <b>Settings</b>:</p>
        <ul><li><b>Unlimited guesses</b>: keep guessing while you keep finding your own agents, instead of stopping at the number plus one. A common house rule, not in the rulebook.</li>
        <li><b>Word pack</b>: mix a themed list (Food, Animals, Places, Science, Sports, Pop &amp; fun) into the board, about a third of the words. Our own lists; the computer knows every word.</li></ul>
        <p class="tip">Daily puzzle, the guided game and the Table tab always use the base words and the rulebook.</p>` },
      { id: 'videos', short: 'Videos', title: 'Videos', html: `<p>Learn by watching (opens YouTube):</p>
        <ul>${VIDEOS.map(v => `<li><a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">${v.title}</a> <span class="muted">(${v.by})</span></li>`).join('')}</ul>` },
    ],
  };
}

// ---------------------------------------------------------------- guided first game
// A fixed board (code TUT7): the computer spymaster's first clue is INSTRUMENT 2, for GUITAR and ORGAN
// (both word models put those two first). ctx: { snap() -> the game's snapshot or null }
export const TUTORIAL = { id: 'codenames-first', code: 'TUT7' };
export function tutorialSteps(ctx) {
  const pub = () => { const s = ctx.snap(); return s && s.pub; };
  const phase = () => (pub() ? pub().phase : '');
  const guesses = () => { const p = pub(); return p ? p.history.filter(h => !h.dummy).reduce((n, h) => n + h.guesses.length, 0) : 0; };
  const turns = () => { const p = pub(); return p ? p.history.length : 0; };
  return [
    { title: 'Your first game', html: 'You are the <b>guesser</b>. The computer is your spymaster: it knows which words are your agents and gives you one-word clues. Find all your agents to win.' },
    { target: '#tab-play .cluebar', title: 'The clue', html: 'A word and a number: <b>INSTRUMENT 2</b> means two words on the board go with "instrument".', when: () => phase() === 'guess', skipIf: () => guesses() > 0 },
    { target: '#tab-play .board', title: 'Tap a word', html: 'Tap the word you think the clue means. Which two words are instruments?', when: () => phase() === 'guess', until: () => guesses() >= 1, skipIf: () => guesses() >= 1 },
    { target: '#tab-play [data-act=pass]', when: () => !!document.querySelector('#tab-play [data-act=pass]'), title: 'Keep going or stop', html: 'Each agent you find leaves your pile. You may guess up to the number plus one; a <b>bystander</b> or <b>their agent</b> ends your turn, and the <b>assassin</b> loses the game. Not sure? Tap <b>End turn</b>.' },
    { target: '#tab-play .panel .log', title: 'The other side', html: 'Two-player rules: after each of your turns your spymaster covers one of the other side\'s agents. Win before all 8 are covered.', when: () => turns() >= 2 || phase() === 'over' },
    { title: "You've got it", html: 'Play on to the end. <b>Hint</b> shows the closest words if you\'re stuck. The full rules are in <b>Settings → Rules</b>.' },
  ];
}
