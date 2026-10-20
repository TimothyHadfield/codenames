# Ideas: what word data adds to Codenames

Tim's example: "using connections to measure how similar words are to each other in codenames". All of these run offline from one table: how close each of 414 board words is to each of 9,119 clue words (GloVe 300d, Stanford, public domain), stored as one byte per pair (3.8 MB).

| # | Idea | Why it helps | Verdict |
|---|---|---|---|
| 1 | **Clue odds** while you type a clue: chance all n are right, chance of the assassin, their word, a bystander | The decision a spymaster actually makes is "how risky is this clue"; this puts a number on it | **Built** (Table + Play) |
| 2 | **Nearest words list** under the odds: the 6 board words closest to your clue, with bars | Shows *which* word is the danger, not just a percentage | **Built** |
| 3 | **Heat bar** under every card for the current clue | Spymaster sees at a glance which cards the clue pulls toward | **Built** (switch in Settings) |
| 4 | **Computer spymaster** that picks the clue with the widest safety gap; Safe / Normal / Bold styles | Solo play; style is the player's risk taste | **Built**, strength measured |
| 5 | **Computer guesser** that ranks words by closeness and stops early on weak links | "You give clues" mode, and computer teammates | **Built**, strength measured |
| 6 | **Measured strength table** (300 simulated games per row, against a different word model standing in for a person) | Honest numbers instead of "AI is smart" | **Built** (Settings → How strong?) |
| 7 | **Links map**: the 16 strongest pairs on this board drawn as lines; tap a word for its closest clue words and board mates | Exactly Tim's example: see how similar the board's words are | **Built** (Links tab) |
| 8 | **Word lookup**: type any word, see how close it is to each word on this board and to all 414 board words | Settle table arguments ("is MOUSE closer to CAT or COMPUTER?") | **Built** (Links tab) |
| 9 | **Idea button** for a human spymaster at the table: the computer's best clue for your team | Learning; unstick a slow spymaster | **Built** (Table, spymaster only) |
| 10 | **Hint** for a guesser: highlight the words closest to the clue | Learning mode for new players | **Built** (Play); hints used are counted in the review |
| 11 | **After-game review**: each of your clues rated against the computer's idea for the same moment, plus what each clue was meant for | Study mode: see where you left words on the table | **Built** |
| 12 | **Daily board code** (same board for everyone that day) | Friends compare scores on the same board | **Built** (code sheet → Today's) |
| 13 | **Pick for me** for the pretend opponent's cover in the two-player game | Fewer taps, rule stays exact | **Built** |
| 14 | Board "difficulty" score (how tangled the 25 words are) | Nice, but no decision depends on it | Skip |
| 15 | Clue suggestions for *every* number 1..4 at once | Clutters the table; Idea button covers it | Skip |
| 16 | Multiplayer leaderboards | Needs accounts and writes; free-tier budget better spent on games | Skip |
| 17 | Custom word packs typed by players | No closeness data for unknown words without shipping the full model | Skip |
| 18 | Voice clue entry | iPhone keyboard already has dictation | Skip |
| 19 | Calibrating the odds model to real human guesses | Needs real play data we don't have; revisit if Tim wants | Skip (parked) |
