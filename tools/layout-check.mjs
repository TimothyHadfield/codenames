// Layout check (2026-10-21 visibility pass): can a player see the board clearly at phone, phone-on-its-side
// and laptop sizes? Serves this folder, opens the Table and Links tabs on a board with the longest words
// (code LFX: SATELLITE, ASTRONAUT, UNICORN, VOLCANO, CHICKEN, CAPTAIN) and measures.
//   node tools/layout-check.mjs [webkit|chrome]
// Needs Playwright (installed in ~/.claude/tools). Exit code 1 if any check fails.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const ROOT = process.env.SITE_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..'); // SITE_ROOT: check another copy (e.g. the old build)
const engine = process.argv[2] || 'webkit';
let pw;
try { pw = (await import(pathToFileURL(join(homedir(), '.claude/tools/node_modules/playwright/index.mjs')).href)).default; }
catch { console.log('Playwright not found in ~/.claude/tools: skipped'); process.exit(0); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.bin': 'application/octet-stream' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try { const body = await readFile(join(ROOT, p)); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const LS = 'codenames:v1';
const S = (tab, table) => JSON.stringify({ tab, settings: { style: 'normal', odds: true, heat: true, duetTimer: 9, name: '' },
  table: { variant: 'classic', code: 'LFX', revealed: Array(25).fill(false), order: [], spy: false, team: null, side: 'A', marks: Array(25).fill(0), ...table }, play: null,
  setup: { pick: 'guess', seats: ['human', 'human', 'computer', 'computer'], duetPartner: 'computer', onlineVariant: 'classic', onlineSeats: 4 } });
const all = Array(25).fill(true);
const SIZES = [
  { id: '393x659', w: 393, h: 659, phone: true },
  { id: '320x568', w: 320, h: 568, phone: true },
  { id: '659x393', w: 659, h: 393, phone: true, land: true },
  { id: '852x393', w: 852, h: 393, phone: true, land: true },
  { id: '1280x800', w: 1280, h: 800 },
  { id: '1440x900', w: 1440, h: 900 },
];
const CASES = [
  { id: 'words', s: S('table', { spy: true }), fill: ['#clue-table', 'music'] },
  { id: 'covered', s: S('table', { revealed: all }) },
  { id: 'duet', s: S('table', { variant: 'duet', marks: Array.from({ length: 25 }, (_, i) => (i % 3 === 0 ? 2 : i % 3 === 1 ? 1 : 0)) }) },
  { id: 'links', s: S('links', {}) },
];

const fails = [], lines = [];
const check = (ok, what) => { if (!ok) fails.push(what); return ok; };
const browser = engine === 'chrome' ? await pw.chromium.launch({ channel: 'chrome' }) : await pw.webkit.launch();
for (const sz of SIZES) for (const c of CASES) {
  const opts = { viewport: { width: sz.w, height: sz.h } };
  if (sz.phone) Object.assign(opts, { hasTouch: true, deviceScaleFactor: 2 });
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, [LS, c.s]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector(c.id === 'links' ? '.map svg text' : '#tab-table .card', { timeout: 20000 });
  if (c.fill) { await page.fill(c.fill[0], c.fill[1]); await page.evaluate(() => document.activeElement?.blur()); }
  await page.waitForTimeout(900);
  const m = await page.evaluate(() => {
    const tab = document.querySelector('.tab.on'), main = document.querySelector('main').getBoundingClientRect();
    const fs = el => parseFloat(getComputedStyle(el).fontSize);
    // the size a word is drawn at: font size, and how much it is squeezed sideways to fit
    const sx = el => { const t = getComputedStyle(el).transform; const mm = /matrix\(([^,]+)/.exec(t); return mm ? +mm[1] : 1; };
    const out = { vw: innerWidth, vh: innerHeight, overflowX: document.documentElement.scrollWidth > innerWidth, mainH: main.height, mainW: main.width };
    const board = tab.querySelector('.board, .map svg');
    const b = board.getBoundingClientRect();
    out.boardShare = (b.width * b.height) / (innerWidth * innerHeight);
    out.boardInMain = b.top >= main.top - 1 && b.bottom <= main.bottom + 1 && b.left >= main.left - 1 && b.right <= main.right + 1;
    const wrap = tab.querySelector('.boardwrap').getBoundingClientRect();
    out.emptyBelow = main.bottom - wrap.bottom;
    const panel = tab.querySelector('.panel');
    out.panelOverflow = panel ? panel.scrollWidth > panel.clientWidth + 1 : false;
    // the board at the largest size its free space allows: it fills that space's width or its height
    const box = board.parentElement;
    const bw = board.offsetWidth ?? b.width, bh = board.offsetHeight ?? b.height; // layout size (the tilt is drawn on top)
    out.fill = Math.max(bw / box.clientWidth, bh / box.clientHeight);
    out.wrapH = wrap.height;
    const card = tab.querySelector('.card');
    if (card) { const r = card.getBoundingClientRect(); out.cardRatio = card.offsetWidth / card.offsetHeight; out.cardW = card.offsetWidth; }
    const words = [...tab.querySelectorAll('.card')].filter(c => !c.querySelector('.cover-tile:not(.half)')).map(c => c.querySelector('.w'));
    out.words = words.map(w => ({ t: w.textContent, fs: fs(w), sx: sx(w), clip: w.getBoundingClientRect().width > w.closest('.strip').getBoundingClientRect().width + 0.5 }));
    const cov = [...tab.querySelectorAll('.cover-tile .cw')];
    out.covers = cov.map(w => ({ t: w.textContent, fs: fs(w), sx: sx(w), clip: w.scrollWidth > w.clientWidth + 0.5 || w.getBoundingClientRect().width > w.closest('.cover-tile').getBoundingClientRect().width + 0.5 }));
    // a tap on the middle of each card lands on that card (the board is tilted and the cards askew)
    out.misses = [...tab.querySelectorAll('.card')].filter(c => { const r = c.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit?.closest('.card') !== c; }).map(c => c.dataset.pos);
    const kc = tab.querySelector('.keycard'); out.keycard = kc && kc.offsetParent ? kc.offsetWidth : null;
    const svg = tab.querySelector('.map svg');
    if (svg) {
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      out.mapText = [...svg.querySelectorAll('text')].map(t => ({ t: t.textContent, px: parseFloat(getComputedStyle(t).fontSize) * scale, w: t.getBoundingClientRect().width, box: t.previousElementSibling.getBoundingClientRect().width }));
    }
    return out;
  });
  const tag = `${sz.id} ${c.id}`;
  check(!m.overflowX, `${tag}: page scrolls sideways`);
  check(m.boardInMain, `${tag}: board not fully on screen`);
  check(!errs.length, `${tag}: page errors ${errs.join('; ')}`);
  check(!m.panelOverflow, `${tag}: side panel content is wider than the panel`);
  check(!m.misses.length, `${tag}: a tap on card(s) ${m.misses.join(',')} lands elsewhere`);
  if (c.id !== 'links') {
    check(Math.abs(m.cardRatio / (68 / 44) - 1) < 0.02, `${tag}: card shape ${m.cardRatio.toFixed(3)} is not 68:44`);
    for (const w of m.words) {
      check(!w.clip, `${tag}: word ${w.t} runs off its strip`);
      // the drawn letter height is the font size; squeezing sideways may not go below 70%
      check(w.fs >= (sz.w <= 360 ? 10 : 12), `${tag}: word ${w.t} only ${w.fs}px`);
      check(w.sx >= 0.7, `${tag}: word ${w.t} squeezed to ${w.sx.toFixed(2)}`);
    }
    for (const w of m.covers) {
      check(!w.clip, `${tag}: covered word ${w.t} cut off`);
      check(w.fs >= 10, `${tag}: covered word ${w.t} only ${w.fs}px`);
    }
  } else {
    for (const t of m.mapText) {
      check(t.px >= 10, `${tag}: map word ${t.t} only ${t.px.toFixed(1)}px`);
      check(t.w <= t.box + 0.5, `${tag}: map word ${t.t} wider than its box`);
    }
  }
  if (sz.land) check(m.boardShare >= 0.3, `${tag}: board only ${(m.boardShare * 100).toFixed(0)}% of the screen`);
  if (sz.land || !sz.phone) {
    check(m.emptyBelow <= 24, `${tag}: ${Math.round(m.emptyBelow)}px empty band under the table`);
    check(m.fill >= 0.97, `${tag}: board uses only ${(m.fill * 100).toFixed(0)}% of its free space`);
    check(m.boardShare >= 0.33, `${tag}: board only ${(m.boardShare * 100).toFixed(0)}% of the screen`);
  }
  if (c.id === 'words' && sz.phone && !sz.land) check(m.keycard >= 40, `${tag}: key card only ${m.keycard}px`);
  lines.push(`${tag.padEnd(18)} board ${(m.boardShare * 100).toFixed(0)}% card ${m.cardW ?? '-'}px words ${m.words?.length ? Math.min(...m.words.map(w => w.fs)) : '-'}px covers ${m.covers?.length ? Math.min(...m.covers.map(w => w.fs)) : '-'}px empty ${Math.round(m.emptyBelow)} fill ${(m.fill * 100).toFixed(0)}% key ${m.keycard ?? '-'}${m.mapText ? ' map ' + Math.min(...m.mapText.map(t => t.px)).toFixed(1) + 'px' : ''}`);
  await ctx.close();
}
await browser.close();
server.close();
console.log(lines.join('\n'));
if (fails.length) { console.log(`\n${fails.length} FAILED (${engine}):\n` + [...new Set(fails)].slice(0, 60).join('\n')); process.exit(1); }
console.log(`\nall layout checks passed (${engine})`);
