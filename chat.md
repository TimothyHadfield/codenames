# Codenames — chat log

## 2026-10-19 — built from scratch (board-game wave, phase 1 + 2)
- **Asked:** manager brief: Codenames site modelled on Wavelength; table companion with seeded key, offline word-link odds, solo vs computer with measured accuracy. Phase 2 added exact-rules play with variants, online seats, ideas list, art/design, rules check, QA.
- **Decided:** GloVe 300d table (int8) for word links; computer clues limited to WordNet nouns; two-player official rules for solo modes; Duet with 9/10/11 turns; online via shared `_online/online.js`.
- **Built:** engine (classic, two-player, Duet, clue rules, risk odds, computer spymaster/guesser), app with Table / Play / Links / Settings tabs, phone bottom tabs + laptop sidebar, icons, docs (rules-check, ideas).
- **Verified:** `node --test` 24/24 (each engine rule test seen failing on a mutated engine); 300-game simulation per style; WebKit 393 px + 1440 px screenshots with full games to the end, zero console errors, no overflow; two headless browsers in one online room (clue seen, guesser key hidden, reload rejoins, guess syncs).
- **Open:** real-iPhone check; odds temperature not calibrated to people.

## 2026-10-20 — QA pass fixes
- **Asked:** brief's QA step: a fresh agent tried to break the site.
- **Found → fixed:** game board seed shown/sent to guessers (key could be rebuilt) → secret 8-char seed, never in the public view; Duet sudden death could be unwinnable → turn rule above; 200-letter clue broke the width → 20-letter cap + ellipsis; spaces eaten while typing → box keeps typed text; stem rule too strict → word-ending list; empty board code gave no message → toast; Start/Give clue below the fold → sticky Start row, Give clue moved under the box; Back left the pass cover up → cover only on Play.
- **Verified:** 3 new tests seen failing on the old code, now 27/27; WebKit 393 px full games (all 4 modes) to the end, zero console errors, no overflow; desktop 3 modes to the end.

## 2026-10-20 — visual design pass
- **Asked:** manager brief, Tim's words: "review them again for design improvements especially visually."
- **Built (CSS + small app.js render changes, no rule changes):** deeper spymaster tints with a 5px team edge (assassin edge red); cards have a printed-card thickness and sink 2px when pressed; heat bar moved to the top edge; clue bar tinted by the team whose turn it is, with a pulse while the computer thinks; panel no longer repeats "thinking" text; pass screen tinted by team (opaque); revealed covers show the word larger; laptop cards fill the height (about 3:2), bigger words, mirror word fainter; laptop setup in 2 columns; Links word chips bigger with whole-cell tap areas; phone slightly tighter so clue odds show without scrolling.
- **Verified:** `node --test` 27/27; before/after WebKit shots of 11 states at 393 px and 1440 px (scratchpad `design/codenames/before|after`), zero console errors, no overflow.
- **Open:** real iPhone look.

## 2026-10-20 — sounds, celebrations, animations
- **Asked:** manager brief (Tim: optional sounds that match the game, win celebrations, fun animations, all customizable in Settings).
- **Built:** `js/fx.js` (shared, unchanged copy), `js/sfx.js` (diff of public views → sounds/animations/celebrations; custom thud + buzz), Settings → Sound & effects, error sound on illegal moves, Table-tab sounds, `.fx-still`/`.fx-fast` for the cover flip, `tests/fx.test.mjs`.
- **Verified:** new test file failed first (module missing), now `node --test` 33/33; headless WebKit 393 px + 1440 px: You-guess game logged stamp, turn, cardFlip, buzz, whoosh, place; near-win click logged cardFlip, ding, celebrate win + confetti canvas; Animations off → no canvas, cover animation none; zero console errors, no overflow.
- **Open:** hear it on a real iPhone; online room sounds not run live.

## 2026-10-20 — table look (like the real game)
- **Asked:** manager brief, Tim's words: the game should look "almost identical to how the board or card layout looks like in real life ... like you're looking through a camera that is connected to a user's glasses" (full quote in progress.md).
- **Built (no rule changes):** dark-wood table from the shared `_table` kit; real-ratio beige codename cards with the upside-down word and the white strip; agent cover cards with jitter; R/B/G agent stacks with counts; notepad clue slip; seat plates across and yours at the bottom; key card in a stand at the spymaster's edge; 7° tilt; deal-in on start; cover card flies from its stack (drop for bystanders and assassin); `fx.js` 1.0.3. Research in the scratchpad `table/codenames/real.md`.
- **Verified:** `node --test` 33/33; headless WebKit before/after shots of 7 states at 393×659 and 1440×900, plus checks at 320×568, 659×393 landscape and 1280×800: zero console errors, no page scroll, no horizontal overflow; motion script: deal class on start, ghost tracked from stack to slot, counts drop. Two read-only reviews; fixed clipped plates, slip overflow, long words, the flight landing over the nav bar.
- **Open:** real iPhone; live online room with real names.

## 2026-10-20 — weird-scenario pass
- **Asked:** manager brief, Tim: make each game "perfect especially in scenarios that the game doesn't expect or are a little weird"; known issue: the clue slip showed only a small "Spymaster" while a clue was being written.
- **Built:** slip says what's happening ("Your turn: give a clue", "Red spymaster: give a clue", "Bob is giving a clue", "Sudden death: your pick"), slightly larger slip text; covered board words are legal clues (rulebook); two tabs stay in sync; computer waits while the tab is hidden; plates capped with ellipsis and the acting plate scrolled into view; online Pick for me works; Links shows the online game's board; clearer Duet sudden-death and two-player loss lines; online double-send guards; `game.js?v=8`.
- **Verified:** `node --test` 35/35 (new edge test failed first on the old rule); `edge.mjs` 39 browser scenarios before 25/36 → after 39/39 (3 added later); `online.mjs` real room before/after (Pick for me 1→2 covers, Links same 25 words); slip at 320/393/1440, no overflow.
- **Open:** two real phones in one room for the double-send guard.

## 2026-10-21 — visibility pass (see what's happening)
- **Asked:** manager brief, Tim: "the cards or board layout is too small to easily see what's going on ... Fix this so the view of what's happening and where everything is is very clear."
- **Built (CSS + small app.js, no rule changes):** every word the same letter height from the card's size (cqw), long words squeezed sideways (`fitText`) instead of shrunk or cut; covered-card words bigger and never ellipsised (Duet "BYSTANDER" too); laptop table fills the column and the board takes all free height (`.boardbox` container), narrower panel `clamp(270px,25vw,380px)`, slip capped at 760px, bigger stacks/badges/plates/key card; phone on its side: header hidden, 44px tab bar, board fills the height, panel 200-300px with odds 2×2; key card 42px on phone; Links map fills the column and its words are ≥10.5px on screen.
- **Verified:** new `tools/layout-check.mjs` (6 sizes × 4 screens, WebKit + Chrome) failed 421 checks on the old build, passes now; `node --test` 35/35; before/after shots of 11 states × 5 sizes (+852×393, 1024×700, 1920×1080) in scratchpad `vis/codenames/`; one read-only review, its landscape-odds and laptop findings fixed; real taps via phone-view (393 + desktop) hit the right card.
- **Open:** real iPhone; 320 px cards are still 56×36.

## 2026-10-27 — improvement pass (competitor analysis follow-up)
- **Asked:** manager per-game brief: fix the phone Table's empty bottom and the laptop band above the cards; stronger computer (measure clues + guesser); every $0 offline rival feature (turn timer, Daily puzzle + share line, achievements + stats, Undo, replay); kits `_coach`/`_profile`/`_pwa`, `_fx` re-copy; richer original art and bigger moments. Tim: "start building every single improvement you can think of", "the best in every single metric we can".
- **Built (3 live commits, c2ed210 → 7ce0f76 → 5a6b35d → d7385ed):** wider assassin berth for Normal/Bold; `tools/head2head.mjs`; `js/kit.js` (levels, 11 achievements, rules sheet, tutorial on board TUT7, result + share line); guided first game, Rules, My stats, Daily puzzle, Undo, replay, sand timers (Play + Table), PWA install + offline; laptop cards start under the bar; 4 agent + 2 bystander cover figures; assassin scene + win wave. Reviewer fixes: Hint/Undo unrated in every mode, no Undo in Daily, Daily dated by its own day, one record across two tabs.
- **Verified:** simulate.mjs before → after (assassin Normal 2→0%, Bold 5→1%; wins 86/86, 87/89); `node --test` 43/43 (new kit/fx tests failed first on the old build); `pwa-check` 18/18 (old build fails); `layout-check` WebKit + Chrome pass; WebKit e2e 18 checks at 393; screenshots at 393/320/659×393/1280/1440 in scratchpad `improve/codenames/shots/`.
- **Open:** real iPhone install/offline and share sheet; quitting a rated game records nothing.

## 2026-10-28 — wave 3 (make every game better)
- **Asked:** Tim: "go through each project adding features or changing things ... layout, customization, practical settings, links to youtube videos ... variations like common house rules ... more cards". Manager menu: videos, themed word packs (all in GloVe, strength must not collapse, work online), sourced house rules, computer speed + bigger text, phone Table bottom check.
- **Built:** 6 word packs (`tools/packs.txt` → `tools/build_packs.py` → `data/packs.json` + per-pack `.bin`, lazy-loaded, online-safe); mixed pack boards (8 pack words, animals 5); house rule Unlimited guesses; Computer speed; Bigger words; Rules → Videos (5 oEmbed-checked links). Phone Table bottom was already filled by the timer (10-27), no change.
- **Decided:** all-theme boards rejected after measuring (wins 86% → 24%); soft assassin / bonus card not built (no source).
- **Verified:** `node --test` 48/48 (new packs test failed first on the old code); simulate per pack (progress.md table); base strength rerun matched shipped numbers; `layout-check` WebKit + Chrome, normal and BIG words, all pass; WebKit 393 + 1440 screenshots of Settings, pack sheet, Rules → Videos and a Food game.
- **Open:** packs in a real two-browser online room; real iPhone.
