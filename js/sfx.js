// Codenames sounds, celebrations and small animations, driven by the shared js/fx.js.
// Everything comes from comparing the previous public view with the new one, so computer
// moves, online players' moves and your own taps all make the same sounds.
//
// Event -> sound (see progress.md for the full table)
//   clue given            stamp            + the clue word pops
//   own agent revealed    cardFlip, ding   + the card pops
//   bystander revealed    cardFlip, thud
//   other team's agent    cardFlip, buzz   + the card shakes
//   assassin revealed     cardFlip, explosion + the board shakes, the card flashes red, the assassin scene
//   two-player cover      cardFlip, place  (the pretend opponent's agent is covered)
//   turn passes           whoosh (soft)    ; when it becomes YOUR turn: turn chime + clue bar pulses
//   Duet timer token      chip             + "-1" floats off the turns counter
//   Duet sudden death     alarm
//   3 agents on one clue  celebrate 'big' at the card
//   game over             celebrate 'win' (team colours) or 'lose'; a win also sweeps a wave over your agents

const COLORS = {
  R: ['#e5544b', '#ff8a80', '#efe6cf', '#f0b354'],
  B: ['#4d8dff', '#9cc0ff', '#efe6cf', '#f0b354'],
  G: ['#3fb35f', '#7fd99a', '#efe6cf', '#f0b354'],
};

// custom synthesised sounds the shared palette doesn't have
export function defineSounds(FX) {
  // bystander: a dull thud of a card landing on the table
  FX.define('thud', k => {
    k.tone({ f: 150, f2: 70, dur: 0.14, vol: 0.32 });
    k.noise({ f: 700, f2: 250, filter: 'lowpass', dur: 0.09, vol: 0.3 });
  }, 'moves');
  // other team's agent: a low buzzer
  FX.define('buzz', k => {
    k.tone({ f: 120, dur: 0.32, vol: 0.12, type: 'sawtooth', lp: 900, a: 0.01 });
    k.tone({ f: 123, dur: 0.32, vol: 0.1, type: 'square', lp: 700, a: 0.01 });
  }, 'moves');
}

const gameKey = pub => (pub ? pub.variant + ':' + pub.w.join(',') : '');

// my result for a finished game. teams = the teams of this phone's human seats
export function outcome(pub, teams) {
  if (pub.variant === 'duet') return pub.winner ? 'win' : 'lose';
  if (pub.variant === 'coop') return pub.winner === pub.start ? 'win' : 'lose';
  return teams && teams.has(pub.winner) ? 'win' : 'lose';
}

// List what happened between two public views of the same game, in order.
export function diffEvents(prev, next) {
  const ev = [];
  const duet = next.variant === 'duet';
  next.history.forEach((h, i) => {
    const old = prev.history[i];
    if (!old && h.clue != null) ev.push({ type: 'clue' });
    const from = old ? old.guesses.length : 0;
    h.guesses.slice(from).forEach((g, j) => {
      if (h.dummy || h.penalty) { ev.push({ type: 'cover', pos: g.pos }); return; }
      const team = duet ? 'G' : h.team;
      const kind = g.color === 'A' ? 'assassin' : g.color === 'N' ? 'bystander' : g.color === team || (duet && g.color === 'G') ? 'agent' : 'enemy';
      // a run of right guesses on one clue
      const upto = h.guesses.slice(0, from + j + 1);
      const run = h.sudden ? 0 : upto.every(x => x.color === team) ? upto.length : 0;
      ev.push({ type: 'reveal', pos: g.pos, kind, team: duet ? 'G' : h.team, run });
    });
  });
  if (duet && next.timer < prev.timer && next.phase !== 'over') ev.push({ type: 'timer', left: next.timer });
  if (next.phase === 'sudden' && prev.phase !== 'sudden') ev.push({ type: 'sudden' });
  if (next.phase !== 'over' && !duet && next.turn !== prev.turn) ev.push({ type: 'pass' });
  if (next.phase === 'over' && prev.phase !== 'over') ev.push({ type: 'over' });
  return ev;
}

// ui: functions returning the live elements (or null): card(pos), board(), cluebar(), clueWord(), count(team), timer()
// opts.later(fn, ms): scheduler (tests run it at once)
export function createSfx(FX, ui, opts = {}) {
  const later = opts.later || ((fn, ms) => (ms > 0 ? setTimeout(fn, ms) : fn()));
  defineSounds(FX);
  let last = null, lastKey = '', lastMine = false;
  const play = (name, vol) => { try { FX.play(name, vol != null && vol !== 1 ? { vol } : undefined); } catch (e) { /* never break the game */ } };
  const anim = (fn, ...a) => { try { const el = a[0]; if (el) FX[fn](...a); } catch (e) { /* ignore */ } };
  // the big scenes (assassin, win) are drawn by the page: ui.moment(kind, el, team), optional
  const moment = (kind, el, team) => { try { if (ui.moment) ui.moment(kind, el, team); } catch (e) { /* ignore */ } };

  // snap: { pub, myTurn, teams:Set, mine:bool (this phone made the move) }
  function check(snap) {
    const pub = snap && snap.pub;
    const key = gameKey(pub);
    if (!pub || key !== lastKey || !last) { // new game, reload or resume: no sounds, just remember
      last = pub ? JSON.parse(JSON.stringify(pub)) : null; lastKey = key; lastMine = !!(snap && snap.myTurn);
      return [];
    }
    const prev = last;
    last = JSON.parse(JSON.stringify(pub));
    const ev = diffEvents(prev, pub);
    const myTurnNow = !!snap.myTurn && pub.phase !== 'over';
    const rising = myTurnNow && !lastMine;
    lastMine = myTurnNow;
    if (!ev.length && !rising) return ev;
    const vol = snap.mine ? 1 : 0.85; // other players and the computer are never louder than you
    let t = 0; // stagger when several things happened at once (online catch-up)
    for (const e of ev) {
      const at = t;
      switch (e.type) {
        case 'clue':
          later(() => { play('stamp', vol); anim('pop', ui.clueWord ? ui.clueWord() : null); }, at);
          t += 200; break;
        case 'cover':
          later(() => { play('cardFlip', vol); later(() => play('place', vol), 160); }, at);
          t += 350; break;
        case 'reveal': {
          const res = { agent: 'ding', bystander: 'thud', enemy: 'buzz', assassin: 'explosion' }[e.kind];
          later(() => {
            play('cardFlip', vol);
            // the cover flips in .42s: the result sound lands as it settles
            later(() => {
              play(res, vol);
              const card = ui.card(e.pos);
              if (e.kind === 'agent') { anim('pop', card); anim('pop', ui.count(e.team)); }
              else if (e.kind === 'enemy') { anim('shake', card); anim('pop', ui.count(e.team === 'R' ? 'B' : 'R')); }
              else if (e.kind === 'assassin') { anim('shake', ui.board()); anim('flash', card, '#ff5d52'); moment('assassin', card); }
              if (e.kind === 'agent' && e.run === 3 && pub.phase !== 'over') {
                try { FX.celebrate({ kind: 'big', at: card, colors: COLORS[e.team] }); } catch (x) { /* ignore */ }
              }
            }, 220);
          }, at);
          t += 380; break;
        }
        case 'timer':
          later(() => { play('chip', vol); const el = ui.timer(); anim('pop', el); anim('floatText', el, '−1', 'var(--warm)'); }, at + 120);
          t += 250; break;
        case 'sudden':
          later(() => { play('alarm'); anim('pulse', ui.timer()); }, at + 200);
          t += 300; break;
        case 'pass':
          if (!rising) later(() => play('whoosh', 0.5 * vol), at + 150);
          t += 150; break;
        case 'over': {
          const kind = outcome(pub, snap.teams);
          const team = pub.variant === 'duet' ? 'G' : kind === 'win' ? (pub.variant === 'coop' ? pub.start : pub.winner) : pub.winner;
          later(() => { try { FX.celebrate({ kind, colors: COLORS[team] || COLORS.G }); } catch (x) { /* ignore */ } }, at + 450);
          if (kind === 'win') later(() => moment('win', ui.board(), team), at + 300);
          break;
        }
      }
    }
    if (rising) later(() => { play('turn'); anim('pulse', ui.cluebar()); }, t + 150);
    return ev;
  }

  // Table tab (real-table tracker): the phone knows the colour of each tapped word.
  function table(kind, pos) {
    const card = (ui.tableCard || ui.card)(pos), board = ui.tableBoard || ui.board;
    if (kind === 'undo') { play('cardSlide'); return; }
    play('cardFlip');
    later(() => {
      if (kind === 'A') { play('explosion'); anim('shake', board()); anim('flash', card, '#ff5d52'); }
      else if (kind === 'N') play('thud');
      else if (kind === 'G') { play('ding'); anim('pop', card); }
      else play('place'); // a red or blue agent: who guessed isn't tracked here
    }, 220);
  }

  return { check, table, reset() { last = null; lastKey = ''; } };
}
