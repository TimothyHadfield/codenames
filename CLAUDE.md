# Codenames — project rules

Live: https://timothyhadfield.github.io/codenames/ · Repo: https://github.com/TimothyHadfield/codenames (public)

Read `progress.md` first (START HERE), then `chat.md` for history. Tim's global rules and `Code Projects/CLAUDE.md` apply.

## What it is
A Codenames site: a table companion (seeded board + spymaster key on any phone with the same code), exact-rules play against the computer or friends (classic two teams, two-player, Duet, online rooms), clue odds from word links, and a Links tab that shows how close the board's words are.

## Layout
- `index.html`, `css/style.css`, `js/app.js` (UI), `js/engine.js` (pure rules + word maths), `js/game.js` (adapter for the shared `online.js`), `js/online.js` (copied **unchanged** from `Board and Card Games/_online/`).
- `data/words.json` + `data/assoc.bin` are built by `tools/build_assoc.py` from GloVe; `data/strength.json` is written by `tools/simulate.mjs`.
- Tests: `node --test` (from the project folder; `node --test tests/` fails on Windows).

## Rules for changing it
- Keep the engine as pure functions (`apply(state, action)`, `view(state, seat)`), JSON-safe state.
- Changing `tools/board-words.txt` order or content changes every seeded board: bump `VERSION` in `build_assoc.py` and `engine.js`, and update the pinned snapshot test.
- After changing the computer's clue logic, re-run `tools/simulate.mjs` so Settings → How strong? stays measured.
- Bump `?v=` in `index.html` and `BUILD` in `app.js` on every deploy.
