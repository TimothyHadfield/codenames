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
