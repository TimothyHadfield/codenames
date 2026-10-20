# Rules check

Every rule the site enforces, where it lives in code, and where it was checked. Rules are written in my own words (no rulebook text copied).

Sources:
- **S1** Codenames rulebook (Czech Games Edition, English), PDF copies hosted by public libraries: buffalolib.org and lot.ahml.info (board-game kit lending pages).
- **S2** Codenames: Duet rulebook (CGE), same library PDF hosts.
- **S3** rulespal.com Codenames and Duet summaries (cross-check only).

## Codenames (classic)

| Rule | Source | Code | Test |
|---|---|---|---|
| 25 words in a 5x5 grid | S1 | `genClassic` | engine "9/8/7/1" |
| Starting team has 9 agents, other 8, 7 bystanders, 1 assassin | S1, S3 | `genClassic` | engine "9/8/7/1" |
| Spymaster gives one word plus one number | S1 | `apply` clue | engine "clue rules" |
| Clue can't be a board word still showing, or part of / built from one | S1 | `checkClue`, `related` | engine "clue rules" |
| Up to number + 1 guesses | S1 | `guessesLeft = n + 1` | engine "n+1 guesses" |
| Clue 0 or unlimited: no cap, but at least one guess is required | S1 | `guessesLeft = 99`, pass blocked before first guess | engine "0 and unlimited" |
| Own agent: keep guessing. Bystander or other team's agent: turn ends | S1 | `apply` guess | engine + game random games |
| Assassin: the team that touched it loses at once | S1 | `apply` guess | engine "assassin" |
| A team wins when its last agent is revealed, even by the other team | S1 | `apply` guess | engine "last agent revealed by other team" |
| Invalid clue: turn ends and the other spymaster covers one of their own agents | S1 | `invalid` action, phase `penalty` | engine "penalty" (local Two teams only; not exposed online) |
| Two-player / co-op variant: one team vs a pretend opponent who covers one of its agents after each of your turns; score = its agents left | S1 | `mode:'coop'`, phase `dummy`, `coopScore` | engine "coop score" |
| Three-player variant: two spymasters share one guesser | S1 | Two teams with one seat "You" guessing for both (seats are free-form) | NOT a separate mode |

## Duet

| Rule | Source | Code | Test |
|---|---|---|---|
| Each side of the key: 9 green, 3 assassins, 13 bystanders | S2 | `genDuet` | engine "Duet overlaps" |
| Whole grid: 3 green on both sides, 10 green on one side only, 2 green/assassin, 1 assassin both, 2 assassin/bystander, 7 bystander both; 15 agents in all | S2 | `genDuet` | engine "Duet overlaps" |
| 9 timer tokens (10 or 11 for an easier game) | S2 | Settings "Duet turns" | engine "Duet rules" |
| Every turn uses one token | S2 | `applyDuet` | engine "Duet rules" |
| Unlimited correct guesses; only the clue-giver's side of the key decides | S2 | `applyDuet` | engine "Duet rules" |
| Bystander ends the turn and is marked for that guesser only | S2 | `applyDuet` | engine "Duet rules" |
| When one player's 9 are found, the partner gives every remaining clue | S2 | `applyDuet` | engine "Duet rules" |
| Tokens run out: sudden death, any wrong guess loses | S2 | `sdguess` | engine "sudden death" |
| Assassin on the clue-giver's side: both lose | S2 | `applyDuet` | engine "Duet rules" |

## Known gaps / single-source
- Duet invalid-clue penalty (costs a token) is not implemented.
- Number of key cards per box (100 vs 60) differs by edition and is single-source; irrelevant here since keys are generated from the seed.
- Board words are our own list (~414 plain words), not the boxed word cards.
