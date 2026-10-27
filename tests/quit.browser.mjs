// Browser test: quitting a game vs the computer after your first move counts as a loss in My stats;
// quitting before you've moved, or the guided game, never counts; a Daily puzzle counts from the start.
//   node tests/quit.browser.mjs        (needs Playwright in ~/.claude/tools; WebKit)
//   CN_ROOT=<other checkout> runs it against older code.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import fs from 'node:fs';
const require = createRequire(join(homedir(), '.claude/tools/') + 'x.js');
const pw = require('playwright');
const ROOT = process.env.CN_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');

const T = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain', '.bin': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[extname(p)] || 'application/octet-stream' }); r.end(d); } });
});
await new Promise(ok => srv.listen(0, ok));
const url = 'http://localhost:' + srv.address().port + '/?nosw';
let failed = 0;
const check = (ok, msg) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + msg); if (!ok) failed++; };

const browser = await pw.webkit.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 659 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.Profile);
  // no guided-game offer
  await page.evaluate(() => { for (const k of ['coach-offer:codenames-first', 'coach:codenames-first']) localStorage.setItem(k, '1'); });
  await page.reload();
  await page.waitForFunction(() => window.Profile);
  await page.addStyleTag({ content: '.coach-layer,.coach-offer{display:none!important}' });
  const stats = () => page.evaluate(() => Profile.stats());
  const play = () => page.evaluate(() => (JSON.parse(localStorage.getItem('codenames:v1')) || {}).play);
  const start = async () => {
    await page.waitForSelector('[data-act="start"]:not([disabled])', { state: 'visible', timeout: 20000 });
    await page.waitForTimeout(400);
    await page.click('[data-act="start"]');
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem('codenames:v1')) || {}).play);
  };
  // You guess: wait for the computer's clue, then tap one of your own agents (never ends the game on the first guess)
  const guessOne = async () => {
    await page.waitForFunction(() => { const p = JSON.parse(localStorage.getItem('codenames:v1')).play; return p && p.state && JSON.stringify(p.state).includes('"phase":"guess"'); }, null, { timeout: 30000 });
    const pos = await page.evaluate(() => {
      const st = JSON.parse(localStorage.getItem('codenames:v1')).play.state;
      const e = st.key ? st : Object.values(st).find(v => v && v.key && v.revealed);
      return e.key.findIndex((c, i) => c === e.start && !e.revealed[i]);
    });
    const n0 = JSON.stringify(await play()).length;
    await page.evaluate(p => document.querySelector(`#tab-play .card[data-pos="${p}"]`).click(), pos);
    await page.waitForFunction(n => JSON.stringify(JSON.parse(localStorage.getItem('codenames:v1')).play).length !== n, n0);
  };
  const quit = async () => {
    await page.evaluate(() => document.querySelector('[data-act="quit"]').click());
    await page.waitForSelector('#yes', { state: 'visible' });
    await page.click('#yes');
    await page.waitForFunction(() => !(JSON.parse(localStorage.getItem('codenames:v1')) || {}).play);
  };

  await start();
  await quit();
  let s = await stats();
  check(s.games === 0, 'quitting before your first move is not counted (' + s.games + ' games)');

  await start();
  await guessOne();
  check((await stats()).games === 0, 'nothing counted while you play');
  await quit();
  s = await stats();
  check(s.games === 1 && s.losses === 1, 'quitting after a guess counts as a loss (' + s.games + ' games, ' + s.losses + ' lost)');

  // the guided game, quit after a guess: never counts
  await page.evaluate(() => document.querySelector('[data-tab="settings"]').click());
  await page.waitForSelector('[data-act="tutorial"]', { state: 'attached' });
  await page.evaluate(() => document.querySelector('[data-act="tutorial"]').click());
  await page.waitForFunction(() => { const p = (JSON.parse(localStorage.getItem('codenames:v1')) || {}).play; return p && p.tutorial; });
  await page.addStyleTag({ content: '.coach-layer,.coach-offer{display:none!important}' });
  await guessOne();
  await quit();
  s = await stats();
  check(s.games === 1 && s.losses === 1, 'quitting the guided game is not counted (' + s.games + ' games, ' + s.losses + ' lost)');

  // today's Daily puzzle counts from the start
  await page.evaluate(() => { document.querySelector('.pf-open, [data-act="mystats"]').click(); });
  await page.waitForTimeout(300);
  const daily = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /daily/i.test(x.textContent) && x.offsetParent); if (b) { b.click(); return true; } return false; });
  check(daily, 'found the Daily puzzle button');
  await page.waitForFunction(() => { const p = (JSON.parse(localStorage.getItem('codenames:v1')) || {}).play; return p && p.daily; });
  await quit();
  s = await stats();
  check(s.games === 2 && s.losses === 2, 'quitting the Daily puzzle counts as a loss (' + s.games + ' games, ' + s.losses + ' lost)');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await ctx.close();
} finally {
  await browser.close();
  srv.close();
}
console.log(failed ? failed + ' FAILED' : 'all passed');
process.exit(failed ? 1 : 0);
