"""Build the word-closeness table the site ships (data/assoc.bin + data/words.json).

Why: Tim wants "using connections to measure how similar words are to each other in
codenames", offline and free. We use Stanford's open GloVe vectors (glove.6B, trained on
Wikipedia 2014 + Gigaword 5, Public Domain Dedication and License), and keep only
board words x clue words, so the browser never needs the 800 MB original.

Usage:
  python -I tools/build_assoc.py <glove.6B.zip> <google-10000-english-no-swears.txt> [--eval-out DIR]

Output:
  data/words.json   {"version", "dims", "board": [...], "clues": [...]}
  data/assoc.bin    Int8, row-major [board][clue], value = round(cosine * 127)
  DIR/assoc50.bin   same table from the 50-d vectors (a "different mind" used only to
                    measure the computer honestly in tools/simulate.mjs; not shipped)
"""
import json
import os
import sys
import zipfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
VERSION = 1  # bump if board-words.txt or the clue list changes (changes every seeded board)

STOP = set("""
a about above after again against all also am an and any are aren as at be because been before being below
between both but by can cannot could did do does doing don down during each few for from further had has have
having he her here hers herself him himself his how i if in into is it its itself just let me more most my
myself no nor not now of off on once only or other ought our ours ourselves out over own same she should so
some such than that the their theirs them themselves then there these they this those through to too under
until up very was we were what when where which while who whom why will with would you your yours yourself
yourselves may might must shall also within without upon via per etc yes yet however therefore thus whether
though although every many much one two three four five six seven eight nine ten first second third last next
new old get got make made use used using like well even still back way say said says see seen go goes went
gone come came take took give gave know knew think thought want need find found tell told ask asked feel felt
seem seemed try tried keep kept put mean meant become became begin began happen include
""".split())

# Web/abbreviation junk that is common online but not a fair Codenames clue.
BLOCK = set("""
html http https www com org edu gov net php xml rss faq pdf jpg gif png usr inc ltd llc corp dept
ebay amazon google yahoo msn aol paypal myspace youtube facebook twitter linkedin
sex sexy porn nude xxx gay lesbian viagra cialis
info http href url api css usa los las san del der von van und
mon tue wed thu fri sat sun jan feb mar apr jun jul aug sep sept oct nov dec
""".split())


def read_lines(path):
    with open(path, encoding="utf-8") as f:
        return [w.strip().lower() for w in f if w.strip()]


def load_vectors(zf, name, wanted):
    vecs = {}
    with zf.open(name) as f:
        for raw in f:
            line = raw.decode("utf-8", errors="ignore").rstrip()
            sp = line.find(" ")
            w = line[:sp]
            if w in wanted and w not in vecs:
                vecs[w] = np.array(line[sp + 1:].split(), dtype=np.float32)
    return vecs


NUMBERS = set("""zero eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty
forty fifty sixty seventy eighty ninety hundred thousand million billion fourth fifth sixth seventh eighth ninth
tenth half monday tuesday wednesday thursday friday saturday sunday january february march april may june july
august september october november december""".split())


def cpu_ok(w):
    """Can the computer spymaster use this word? Plain dictionary nouns/adjectives in base form.
    Typed clues from people may use any word in the list; this only keeps the computer from
    clues like "governments" or "pressing" (GloVe likes them, people don't say them)."""
    from nltk.corpus import wordnet as wn
    if w in NUMBERS:
        return False
    # plurals and superlatives WordNet lists as their own entries (leaders, earliest)
    if w.endswith("s") and not w.endswith("ss") and (wn.synsets(w[:-1]) or (w.endswith("es") and wn.synsets(w[:-2]))):
        return False
    if w.endswith("est") and (wn.synsets(w[:-3]) or wn.synsets(w[:-4] + "y") or wn.synsets(w[:-4])):
        return False
    syn = wn.synsets(w)
    if not syn:
        return False
    def cnt(pos, base):
        return sum(l.count() for s in wn.synsets(w, pos) for l in s.lemmas() if l.name().lower() == base)
    n_base = wn.morphy(w, wn.NOUN)
    a_base = wn.morphy(w, wn.ADJ)
    v_base = wn.morphy(w, wn.VERB)
    noun = cnt(wn.NOUN, w) if n_base == w else 0
    adj = (cnt(wn.ADJ, w) + cnt(wn.ADJ_SAT, w)) if a_base == w else 0
    if n_base != w:
        return False  # not a noun in base form (plural, verb form, adjective-only)
    # Mostly-adjective words (careful, heavy, crucial) make vague GloVe clues; keep nouns.
    n_syn = len(wn.synsets(w, wn.NOUN))
    a_syn = len(wn.synsets(w, wn.ADJ)) + len(wn.synsets(w, wn.ADJ_SAT))
    if noun < adj or (noun == adj == 0 and n_syn < a_syn):
        return False
    if v_base and v_base != w and noun + adj <= cnt(wn.VERB, v_base) * 0.5:
        return False  # mostly a verb form (pressing, covered)
    return True


def table(vecs, board, clues):
    B = np.stack([vecs[w] for w in board])
    C = np.stack([vecs[w] for w in clues])
    B /= np.linalg.norm(B, axis=1, keepdims=True)
    C /= np.linalg.norm(C, axis=1, keepdims=True)
    S = B @ C.T
    return np.clip(np.rint(S * 127), -127, 127).astype(np.int8)


def main():
    glove_zip, google = sys.argv[1], sys.argv[2]
    eval_out = sys.argv[sys.argv.index("--eval-out") + 1] if "--eval-out" in sys.argv else None

    board_raw = read_lines(os.path.join(HERE, "board-words.txt"))
    seen, board = set(), []
    for w in board_raw:
        if w not in seen:
            seen.add(w)
            board.append(w)

    clue_raw = []
    for w in read_lines(google):
        if (w.isalpha() and w.isascii() and len(w) >= 3 and w not in STOP and w not in BLOCK
                and any(v in w for v in "aeiouy")):
            clue_raw.append(w)
    wanted = set(board) | set(clue_raw)

    zf = zipfile.ZipFile(glove_zip)
    v300 = load_vectors(zf, "glove.6B.300d.txt", wanted)
    v50 = load_vectors(zf, "glove.6B.50d.txt", wanted)

    missing = [w for w in board if w not in v300 or w not in v50]
    if missing:
        print("board words missing from GloVe (dropped):", missing)
    board = [w for w in board if w in v300 and w in v50]

    clues, cs = [], set()
    for w in clue_raw + board:  # board words can be clues on boards they are not on
        if w in v300 and w in v50 and w not in cs:
            cs.add(w)
            clues.append(w)

    S = table(v300, board, clues)
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    S.tofile(os.path.join(ROOT, "data", "assoc.bin"))
    with open(os.path.join(ROOT, "data", "words.json"), "w", encoding="utf-8") as f:
        cpu = [i for i, w in enumerate(clues) if cpu_ok(w)]
        json.dump({"version": VERSION, "dims": [len(board), len(clues)], "source": "GloVe 6B 300d",
                   "board": board, "clues": clues, "cpu": cpu}, f, separators=(",", ":"))
    print(f"board {len(board)}  clues {len(clues)}  computer clues {len(cpu)}  bytes {S.size}")

    if eval_out:
        os.makedirs(eval_out, exist_ok=True)
        table(v50, board, clues).tofile(os.path.join(eval_out, "assoc50.bin"))
        print("eval table written to", eval_out)


if __name__ == "__main__":
    main()
