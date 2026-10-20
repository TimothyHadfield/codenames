// Sounds, celebrations and animations (js/sfx.js driving the shared js/fx.js).
// Scripted short games through the real rules; the event -> sound map is checked by
// spying on FX, and the real fx.js is used to prove the Sound / Animations switches gate it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { game, setAssoc } from '../js/game.js';
import { createSfx } from '../js/sfx.js';
import { loadAssoc } from '../tools/load-node.mjs';

setAssoc(loadAssoc());
const now = (fn) => fn(); // run staggered sounds at once in tests

// ---- fake page bits (only what sfx/fx touch)
let animateCalls = 0;
function fakeEl() {
  return {
    style: { cssText: '' }, classList: { toggle() {}, contains: () => false, add() {}, remove() {} },
    getBoundingClientRect: () => ({ left: 10, top: 10, width: 60, height: 40 }),
    animate() { animateCalls++; const a = { onfinish: null, oncancel: null }; return a; },
    remove() {}, appendChild() {}, setAttribute() {}, removeAttribute() {}, cloneNode() { return fakeEl(); },
    textContent: '',
  };
}
const ui = { card: () => fakeEl(), board: () => fakeEl(), cluebar: () => fakeEl(), count: () => fakeEl(), timer: () => fakeEl() };

// ---- a spy FX with the same surface as fx.js
function spyFX() {
  const log = { sounds: [], celebrate: [], anims: [] };
  const anim = name => () => { log.anims.push(name); return Promise.resolve(); };
  const FX = {
    play: (name, o) => { log.sounds.push(name); return true; },
    define: () => true,
    celebrate: o => { log.celebrate.push(o); return Promise.resolve(); },
    pop: anim('pop'), shake: anim('shake'), pulse: anim('pulse'), flash: anim('flash'),
    flyTo: anim('flyTo'), floatText: anim('floatText'), countUp: anim('countUp'),
  };
  return { FX, log };
}

// run a scripted game: steps = [seat, action] pairs; returns per-step sound lists
function runScript(fx, variant, seats, human, code, steps) {
  const sfx = createSfx(fx, ui, { later: now });
  let s = game.setup(seats.length, { variant, code }, Math.random, seats.map(k => ({ kind: k })));
  const snap = st => ({ pub: game.publicView(st), myTurn: game.toAct(st).includes(human), teams: new Set([st.start || 'G']) });
  sfx.check(snap(s));
  const out = [];
  for (const step of steps) {
    const [seat, a] = typeof step === 'function' ? step(s) : step;
    s = game.apply(s, seat, a);
    const before = fx.__log ? fx.__log.sounds.length : 0;
    sfx.check(snap(s));
    out.push(fx.__log ? fx.__log.sounds.slice(before) : []);
  }
  return { out, state: s };
}

const posOf = (s, color, skip = new Set()) => s.key.findIndex((k, p) => k === color && !s.revealed[p] && !skip.has(p));
const other = t => (t === 'R' ? 'B' : 'R');

test('event -> sound map: clue, own agent, bystander, turn pass, cover, assassin, your turn', () => {
  const { FX, log } = spyFX(); FX.__log = log;
  const { out, state } = runScript(FX, 'coop', ['computer', 'human'], 1, 'FXTEST1', [
    s => [0, { type: 'clue', word: 'zebra', n: 2 }],
    s => [1, { type: 'guess', pos: posOf(s, s.start) }],
    s => [1, { type: 'guess', pos: posOf(s, 'N') }],
    s => [0, { type: 'cover', pos: posOf(s, other(s.start)) }],
    s => [0, { type: 'clue', word: 'zebra', n: 1 }],
    s => [1, { type: 'guess', pos: s.key.indexOf('A') }],
  ]);
  assert.deepEqual(out[0], ['stamp', 'turn']);                 // clue given, then it's my turn to guess
  assert.deepEqual(out[1], ['cardFlip', 'ding']);              // own agent
  assert.deepEqual(out[2], ['cardFlip', 'thud', 'whoosh']);    // bystander, turn passes
  assert.deepEqual(out[3], ['cardFlip', 'place', 'whoosh']);   // pretend opponent covers one, turn back
  assert.deepEqual(out[4], ['stamp', 'turn']);
  assert.deepEqual(out[5], ['cardFlip', 'explosion']);         // assassin
  assert.ok(log.anims.includes('shake'), 'assassin shakes the board');
  assert.equal(state.phase, 'over');
  assert.equal(log.celebrate.length, 1);
  assert.equal(log.celebrate[0].kind, 'lose');
});

test('other team agent buzzes (two teams)', () => {
  const { FX, log } = spyFX(); FX.__log = log;
  const { out } = runScript(FX, 'classic', ['computer', 'computer', 'human', 'human'], 2, 'FXTEST2', [
    s => [s.turn === 'R' ? 0 : 1, { type: 'clue', word: 'zebra', n: 1 }],
    s => [s.turn === 'R' ? 2 : 3, { type: 'guess', pos: posOf(s, other(s.turn)) }],
  ]);
  assert.deepEqual(out[1].slice(0, 2), ['cardFlip', 'buzz']);
});

test('win: celebrate win with team colours, and a big moment at 3 agents on one clue', () => {
  const { FX, log } = spyFX(); FX.__log = log;
  const s0 = game.setup(2, { variant: 'coop', code: 'FXTEST3' }, Math.random, []);
  const mine = s0.key.map((k, p) => (k === s0.start ? p : -1)).filter(p => p >= 0);
  const steps = [s => [0, { type: 'clue', word: 'zebra', n: 9 }], ...mine.map(p => s => [1, { type: 'guess', pos: p }])];
  const { state } = runScript(FX, 'coop', ['computer', 'human'], 1, 'FXTEST3', steps);
  assert.equal(state.phase, 'over'); assert.equal(state.winner, state.start);
  const kinds = log.celebrate.map(c => c.kind);
  assert.deepEqual(kinds, ['big', 'win']);
  assert.ok(log.celebrate[1].colors.length >= 2);
});

test('Duet: bystander thud, timer token, sudden death alarm', () => {
  const { FX, log } = spyFX(); FX.__log = log;
  const steps = [];
  for (let i = 0; i < 2; i++) {
    steps.push(s => [s.turn === 'A' ? 0 : 1, { type: 'clue', word: 'zebra', n: 1 }]);
    steps.push(s => { const g = s.turn === 'A' ? 1 : 0; const key = s.turn === 'A' ? s.keyA : s.keyB; const p = key.findIndex((k, q) => k === 'N' && !s.found[q] && !s.byst[q].includes(g === 0 ? 'A' : 'B')); return [g, { type: 'guess', pos: p }]; });
  }
  const sfx = createSfx(FX, ui, { later: now });
  let s = game.setup(2, { variant: 'duet', code: 'FXTEST4', timer: 2 }, Math.random, []);
  sfx.check({ pub: game.publicView(s), myTurn: true });
  const out = [];
  for (const st of steps) { const [seat, a] = st(s); s = game.apply(s, seat, a); const b = log.sounds.length; sfx.check({ pub: game.publicView(s), myTurn: true }); out.push(log.sounds.slice(b)); }
  assert.deepEqual(out[1].slice(0, 3), ['cardFlip', 'thud', 'chip']);
  assert.equal(s.phase, 'sudden');
  assert.ok(out[3].includes('alarm'));
});

test('no sounds when a game is loaded or resumed (only real changes make sound)', () => {
  const { FX, log } = spyFX();
  const sfx = createSfx(FX, ui, { later: now });
  let s = game.setup(2, { variant: 'coop', code: 'FXTEST5' }, Math.random, []);
  s = game.apply(s, 0, { type: 'clue', word: 'zebra', n: 2 });
  sfx.check({ pub: game.publicView(s), myTurn: true });
  sfx.check({ pub: game.publicView(s), myTurn: true });
  assert.deepEqual(log.sounds, []);
});

// ---- the real fx.js: Sound off = no sound, Animations off = no animation
function fakeAudio() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = extra => Object.assign({ connect() {}, disconnect() {}, start() {}, stop() {} }, extra);
  return class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = node(); }
    resume() { return Promise.resolve(); }
    createGain() { return node({ gain: param() }); }
    createDynamicsCompressor() { return node(); }
    createOscillator() { return node({ type: 'sine', frequency: param() }); }
    createBiquadFilter() { return node({ type: 'lowpass', frequency: param(), Q: param() }); }
    createBufferSource() { return node({ buffer: null, loop: false }); }
    createStereoPanner() { return node({ pan: param() }); }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
  };
}

test('real fx.js: Sound off plays nothing, Animations off animates nothing', async () => {
  globalThis.AudioContext = fakeAudio();
  globalThis.document = { addEventListener() {}, removeEventListener() {}, createElement: () => fakeEl(), body: fakeEl(), head: fakeEl(), getElementById: () => null };
  await import('../js/fx.js');
  const FX = globalThis.FX;
  FX.init({ game: 'codenames-test', clicks: false });
  FX.unlock();
  const script = [
    s => [0, { type: 'clue', word: 'zebra', n: 2 }],
    s => [1, { type: 'guess', pos: posOf(s, s.start) }],
    s => [1, { type: 'guess', pos: s.key.indexOf('A') }],
  ];
  const go = () => runScript(FX, 'coop', ['computer', 'human'], 1, 'FXTEST6', script);

  FX.set('sound', true); FX.set('animations', true);
  let p0 = FX.stats.plays; animateCalls = 0;
  go();
  assert.ok(FX.stats.plays - p0 > 0, 'sound on: sounds play (test is not vacuous)');
  assert.ok(animateCalls > 0, 'animations on: something animates');

  FX.set('sound', false); FX.set('animations', false);
  p0 = FX.stats.plays; animateCalls = 0;
  go();
  assert.equal(FX.stats.plays - p0, 0, 'sound off: no sound');
  assert.equal(animateCalls, 0, 'animations off: no animation');

  FX.set('sound', true); FX.set('moves', false); FX.set('celebrations', false);
  p0 = FX.stats.plays;
  go();
  assert.equal(FX.stats.plays - p0, 1, 'game sounds off, celebrations off: only the your-turn alert plays');
});
