# Codenames — progress

## START HERE
Read this file, then `CLAUDE.md`, then the last entry of `chat.md`. Last updated: 2026-10-21 (visibility pass).

Live: https://timothyhadfield.github.io/codenames/ · Repo: https://github.com/TimothyHadfield/codenames

## Goal right now
Phase 2 of the board-game wave is built: exact-rules play (classic, two-player, Duet) with computer or online seats, clue odds, Links map, measured computer. Next: Tim plays it on his phone.

## Status
| Part | State |
|---|---|
| Table companion (seeded board, spymaster key, clue checker, Idea, Duet marks, daily code) | Done |
| Play: You guess / You give clues (two-player rules) | Done, played to the end in WebKit |
| Play: Two teams (any seat You or Computer, pass-the-phone cover) | Done, played to the end |
| Play: Duet vs computer or pass-the-phone, 9/10/11 turns, sudden death | Done |
| Online rooms (shared `_online/online.js`, Firebase th-board-games) | Done; two headless browsers verified 2026-10-19 |
| Clue odds + nearest words + heat bars | Done |
| Links tab (connection map, word lookup) | Done |
| Measured computer strength (Settings → How strong?) | Done, 300 games per row |
| `docs/rules-check.md`, `docs/ideas.md` | Done |
| Sound & effects (2026-10-20) | Done: shared `js/fx.js` (copied unchanged from `_fx/`) + `js/sfx.js` (event → sound from public-view diffs, so computer and online moves sound too), Settings → Sound & effects, win/lose/big celebrations |
| Visual design pass (2026-10-20) | Done: deeper key tints + thicker edge, cards with thickness and a press-down, heat bar on the top edge, team-tinted clue bar (pulses while the computer thinks), team-tinted pass screen (opaque), laptop board fills the height, 2-column setup on laptop, bigger Links tap areas |
| Weird-scenario pass (2026-10-20) | Done: 48 scenarios, 14 failed before, all fixed (table below) |
| Visibility pass (2026-10-21) | Done: words one letter height (long ones squeezed, not shrunk), covered words readable, laptop + phone-on-its-side boards fill their free space, Links map fills too. Before → after: 9-letter words 9 → 12px at 393; landscape board 24% → 41% of screen; laptop empty band 88-180 → 18px. Check: `node tools/layout-check.mjs [webkit|chrome]` |
| Table look (2026-10-20) | Done: dark-wood table (shared `_table` copied unchanged into `css/table.css` + `js/table.js`), 5×5 beige codename cards at the real ratio (68:44) with the upside-down word on top and the white word strip, agent cover cards dropped with slight jitter, red/blue (Duet: green) agent stacks with counts, the clue on a notepad slip, seat plates for others across the board, your plate + key card in a stand at your edge, a 7° board tilt, a deal-in on start, and the cover card flying from its stack. `fx.js` re-copied as 1.0.3 |

## Authorized next steps
- 2026-10-19 (manager brief): finish phase 2, push, Pages live, QA pass. Nothing else authorized.

## Standing instructions (Tim's words)
- Phase-2 brief: "build regular play online with a computer or other online players for all the games and their common varients that match exactly the play of the in-person game. 2. Brainstorm what additions you can do to the game with data, exploration, theory, etc. (ex: using connections to measure how similar words are to each other in codenames). 3. Implement your good ideas. 4. Really work on the webdesign of the games, aswell as art, fitting it with an iphone and computer, or anything else. 5. make sure that everything works properlly without errors or whatnot. ... Make sure to get everything right like rules and artwork and specific numbers of cards, routes, details, etc."
- First brief: "Pass-the-phone play; computer clue-giver that grades how risky your clue is"; key only on the spymaster's phone; seeded by a code, no backend; measured computer accuracy.
- $0, static GitHub Pages, no copyrighted art or rulebook text, Hub look.
- Sound brief (2026-10-20): "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered."

- Table-look brief (2026-10-20): "could you also make sure that each of the games also have a look to them so that the game (either board or card layout) looks almost identical to how the board or card layout looks like in real life, so it's easy to understand if you've already played it before, and also so it feels more like you're actually playing in real life rather than you're playing it online. Even things like how youre cards or other things are laid out infront of you, make it look like they are actual cards laid out similar to how it looks like in real life. Make the decks look like actual decks. Make the board have the same design as it does in real life with the same layouts. It should look kind of like you're looking through a camera that is connected to a user's glasses that is playing in real life (not actually, but the layout and style of everything should be similar)."

- Visibility brief (2026-10-21): "for a lot of the games the cards or board layout is too small to easily see what's going on. Some games just need small design imporvements like filling the screen with the board view and fitting the cards and other things in the empty space ... Fix this so the view of what's happening and where everything is is very clear. Consider parts of the board that are dense in what's happening and if the user can reasonably see it."

- Edge-pass brief (2026-10-20): "I've noticed the games often have good user interfaces but could be improved especially when a scenario happens that the game might've not really thought about or whatnot. Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird."

## Weird-scenario pass (2026-10-20)
48 scenarios (full list + before/after evidence: scratchpad `edge/codenames/scenarios.md`; harness `edge.mjs`, `online.mjs`). Fixed:
| Scenario | Was | Now |
|---|---|---|
| Clue slip while a clue is being written | bare "Spymaster" / "Player A" | "Your turn: give a clue", "Red spymaster: give a clue", "Bob is giving a clue", "Sudden death: your pick" |
| Clue = a covered board word | refused | allowed (rulebook), Play + Table checker |
| Same game in two tabs | drifted apart, stale tab could overwrite | `storage` event takes the newer save |
| Tab in the background | computer kept moving unseen | waits, moves when you come back |
| 10 seats / long or emoji names | plates 240 px wide, acting seat off-screen | plates capped (ellipsis), acting plate scrolled into view |
| Online "Pick for me" | did nothing | works from the spymaster's own view |
| Links tab during an online game | showed the Table board | shows the game's board |
| Duet miss in sudden death / two-player loss | "Out of time." / "You lose" | says why |
| Online double taps (word, Create, Join) | could send twice | ignored while the first is in flight |
Passed unchanged: double taps, reload mid-turn/cover, Back, private mode, 320/393/landscape/zoom 200%/1280/1920, long logs, odd clue text (emoji, 21 letters, two words, curly quotes), all-computer seats, first-guess assassin, Table undo.

## Event → sound map (js/sfx.js)
| Event | Sound | Animation |
|---|---|---|
| Clue given | stamp | clue word pops |
| Own agent revealed | cardFlip, then ding | card pops, team count pops |
| Bystander | cardFlip, then thud (custom) | (cover flip only) |
| Other team's agent | cardFlip, then buzz (custom) | card shakes |
| Assassin | cardFlip, then explosion | board shakes, card flashes red |
| Two-player cover / penalty | cardFlip, then place | |
| Turn passes (not to you) | whoosh (soft) | |
| Becomes YOUR turn | turn chime | clue bar pulses |
| Duet timer token | chip | "−1" floats off Turns left |
| Duet sudden death | alarm | turns counter pulses |
| 3 right on one clue | celebrate big | sparkles at the card |
| Game over | celebrate win (team colours) / lose | confetti / dim |
| Illegal move | error | |
| Table tab | cardFlip + thud / place / ding (Duet agent) / explosion; Undo = cardSlide | |
Others' and computer moves play at 0.85 volume. Card taps don't make the button "tap" click. Animations off also stops the cover flip; Fast halves it.

## Measured strength (tools/simulate.mjs, 300 games per row, official two-player rules, 2026-10-19)
"Other mind" = GloVe 50d table standing in for a person who links words differently.
| Style | Computer clues → other guesser: right / words per clue / win / assassin | Other's clues → computer guesser: right |
|---|---|---|
| Safe | 97% / 1.25 / 79% / 0% | 89% |
| Normal | 96% / 1.36 / 86% / 2% | 86% |
| Bold | 91% / 1.72 / 87% / 5% | 81% |

## Traps
- Changing `tools/board-words.txt` changes every seeded board (bump VERSION in both `build_assoc.py` and `engine.js`, update the pinned FROG snapshot test).
- `node --test tests/` fails on Windows; use `node --test`.
- Port 8231 is used by other agents' servers; this project used 8673 for local checks.
- `js/engine.js` is imported without `?v=`; Pages caches 10 min, so a hard refresh may be needed right after a deploy. `game.js` is now imported as `./game.js?v=N` from app.js: bump it whenever game.js gains an export, or a cached old game.js breaks the whole page.
- Never edit files with PowerShell `Get-Content`/`Set-Content`: 5.1 reads UTF-8 as ANSI and turned ∞ / curly quotes into mojibake (caught 10-20). Use the Edit tool.
- Local test servers: port 18473 was already taken by another game's server (Windows let both bind); check the page title before trusting a run.
- The computer's clue list is WordNet-filtered nouns (4,247 words) so it avoids "careful"-style clues; people may type any of the 9,119 words.
- Never show or send a game's board seed (`s.code`) to players: a guesser could rebuild the key from it. Games make an 8-character secret seed; only the Table tab uses short shareable codes (that's its job).
- The pass-the-phone cover must stay fully opaque (it hides the key). A semi-transparent tint leaked the key in the 10-20 design pass before it was caught.
- Load `css/table.css` BEFORE `css/style.css`: table.css sets `--ink` on `:root`, and the app's own value must win. Don't edit `css/table.css`, `js/table.js` or `js/fx.js` (shared copies).
- The flying cover's ghost uses `position:fixed` on `<body>`; `inset:auto` must come before `left/top` in its cssText, or it falls to the page bottom. `.board` has a perspective tilt, so never put fixed elements inside it.
- Board grid needs `minmax(0,1fr)` + `.card{min-width:0}` + `.stage{min-width:0}`, or long words widen the page at 393 px.
- Card print is sized in `cqw` (each `.card` is a container) and `fitText()` in app.js squeezes long words with scaleX + negative margins; call it after any render that rebuilds cards or the Links map (it also runs on resize). On laptop / phone-on-its-side the board sits in `.boardbox` (container-type: size) and its width formula assumes the board's gaps (laptop 10/12 px, landscape 5 px): change both together.
- Phone on its side (≤999 px wide, ≤520 px tall) hides the brand header; the online room code still shows at the bottom of the panel.
- The 403 from Firestore seen once in a headless run came from a request that retried; the room still worked on the next run. Watch for it.

## Decisions
- Word links: GloVe 6B 300d cosine, int8, 414 board × 9,119 clue words (3.8 MB), loaded once.
- Risk odds: softmax choice over closeness, T = 0.05; exact recursion over found words.
- Two-player rules for solo modes (pretend opponent covers one agent per turn); score = their agents left.
- Infinity/0 clues stored as a 99 guess cap (JSON-safe).
- Safe style loosened 2026-10-19 (was 45% wins, now 79%).
- Duet sudden death: a player may point only while the partner's side has agents; alternate when both can (2026-10-20, after QA found an unwinnable case).
- Clue "same stem" rule = shared start of 3+ letters and both endings are plain word endings (s, ed, ing, y/ies...), so stay/STAR is allowed and making/MAKE is not.

## NOT verified
- Real iPhone (only WebKit at 393 px).
- Visibility pass: real iPhone landscape with Safari's toolbars; 320 px cards stay 56×36 (tap height under 40 px, the board already spans the width); the spymaster key card is still hidden in landscape (tints show the key); at 1920+ the tilt leaves ~70 px of wood above the board.
- Risk-odds temperature T = 0.05 is not calibrated against real people.
- Duet invalid-clue token penalty not implemented; the classic invalid-clue call is local Two teams only (not online).
- Online with 3+ real people and host takeover (shared module's own tests cover takeover).
- Sounds never heard: headless WebKit on Windows has no Web Audio; only the FX.play calls were checked. Confetti motion looks slow in headless (rAF throttled); real phone not checked.
- Table look on a real iPhone (notch, Safari toolbar) and in a live online room with real names on the seat plates; checked only in headless WebKit at 320/393/659-landscape/1280/1440.
- Online sounds: driven by the same snapshot diff as local, but not run in a live two-browser room.
- Edge pass: online double-tap guard and Create/Join guard checked by code only (a single browser couldn't make the double send happen); two real phones in one room not run. Two tabs both visible side by side may both move the computer (same move, so harmless) — not run.

## Rejected / parked
- ~~Board difficulty score~~ no decision depends on it.
- ~~Leaderboards~~ free-tier writes better spent on games.
- ~~Custom word packs~~ no closeness data for unknown words.
- ~~Calibrating odds to human guesses~~ parked: needs real play data.
