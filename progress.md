# Codenames — progress

## START HERE
Read this file, then `CLAUDE.md`, then the last entry of `chat.md`. Last updated: 2026-10-20.

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
| Visual design pass (2026-10-20) | Done: deeper key tints + thicker edge, cards with thickness and a press-down, heat bar on the top edge, team-tinted clue bar (pulses while the computer thinks), team-tinted pass screen (opaque), laptop board fills the height, 2-column setup on laptop, bigger Links tap areas |

## Authorized next steps
- 2026-10-19 (manager brief): finish phase 2, push, Pages live, QA pass. Nothing else authorized.

## Standing instructions (Tim's words)
- Phase-2 brief: "build regular play online with a computer or other online players for all the games and their common varients that match exactly the play of the in-person game. 2. Brainstorm what additions you can do to the game with data, exploration, theory, etc. (ex: using connections to measure how similar words are to each other in codenames). 3. Implement your good ideas. 4. Really work on the webdesign of the games, aswell as art, fitting it with an iphone and computer, or anything else. 5. make sure that everything works properlly without errors or whatnot. ... Make sure to get everything right like rules and artwork and specific numbers of cards, routes, details, etc."
- First brief: "Pass-the-phone play; computer clue-giver that grades how risky your clue is"; key only on the spymaster's phone; seeded by a code, no backend; measured computer accuracy.
- $0, static GitHub Pages, no copyrighted art or rulebook text, Hub look.

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
- `js/engine.js` and `js/game.js` are imported without `?v=`; Pages caches 10 min, so a hard refresh may be needed right after a deploy.
- The computer's clue list is WordNet-filtered nouns (4,247 words) so it avoids "careful"-style clues; people may type any of the 9,119 words.
- Never show or send a game's board seed (`s.code`) to players: a guesser could rebuild the key from it. Games make an 8-character secret seed; only the Table tab uses short shareable codes (that's its job).
- The pass-the-phone cover must stay fully opaque (it hides the key). A semi-transparent tint leaked the key in the 10-20 design pass before it was caught.
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
- Risk-odds temperature T = 0.05 is not calibrated against real people.
- Duet invalid-clue token penalty not implemented; the classic invalid-clue call is local Two teams only (not online).
- Online with 3+ real people and host takeover (shared module's own tests cover takeover).

## Rejected / parked
- ~~Board difficulty score~~ no decision depends on it.
- ~~Leaderboards~~ free-tier writes better spent on games.
- ~~Custom word packs~~ no closeness data for unknown words.
- ~~Calibrating odds to human guesses~~ parked: needs real play data.
