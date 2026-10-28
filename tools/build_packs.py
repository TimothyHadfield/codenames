"""Build the themed word packs (data/packs.json + data/packs/<id>.bin) from tools/packs.txt.

Why: Tim, wave 3 (2026-10-28): "Maybe it's just adding variations like ... more cards".
The computer can only clue and guess words it has closeness numbers for, so every pack word
must be in GloVe 6B (the same vectors as data/assoc.bin). Base board words keep their rows in
assoc.bin; each NEW pack word gets one row against the same 9,119 clue words, in its pack's file.
The clue list, words.json and assoc.bin are not touched, so base boards and the computer's base
play stay exactly the same.

Usage:
  python -I tools/build_packs.py <glove.6B.zip> [--eval-out DIR]

Output:
  data/packs.json  {"version", "base", "dims": [new words, clues], "extra": [...], "packs": [...]}
  data/packs/<id>.bin  Int8, row-major [the pack's rows][clue], value = round(cosine * 127) (300d)
  DIR/packs50.bin, DIR/assoc50.bin   the same from the 50d vectors ("other mind" for
                   tools/simulate.mjs; not shipped)
Also checks the zip reproduces data/assoc.bin byte for byte.
"""
import json
import os
import sys
import zipfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
VERSION = 1  # bump if a pack's words or order change (changes that pack's seeded boards)
RARE = 60000  # GloVe frequency rank above which a word's vector is too noisy to trust


def read_packs(path):
    packs, cur = [], None
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("## "):
                f = [x.strip() for x in line[3:].split("|")]
                pid, name, desc = f[:3]
                cur = {"id": pid, "name": name, "desc": desc, "words": []}
                for opt in f[3:]:  # "mix=5": pack words per board (default PACK_MIX in js/engine.js)
                    if opt.startswith("mix="):
                        cur["mix"] = int(opt[4:])
                packs.append(cur)
            elif line and not line.startswith("#") and cur is not None:
                cur["words"] += [w.lower() for w in line.split()]
    return packs


def load_vectors(zf, name, wanted):
    vecs, rank = {}, {}
    with zf.open(name) as f:
        for i, raw in enumerate(f):
            line = raw.decode("utf-8", errors="ignore").rstrip()
            sp = line.find(" ")
            w = line[:sp]
            if w in wanted and w not in vecs:
                vecs[w] = np.array(line[sp + 1:].split(), dtype=np.float32)
                rank[w] = i + 1
    return vecs, rank


def table(vecs, rows, clues):
    B = np.stack([vecs[w] for w in rows])
    C = np.stack([vecs[w] for w in clues])
    B /= np.linalg.norm(B, axis=1, keepdims=True)
    C /= np.linalg.norm(C, axis=1, keepdims=True)
    return np.clip(np.rint((B @ C.T) * 127), -127, 127).astype(np.int8)


def main():
    glove_zip = sys.argv[1]
    eval_out = sys.argv[sys.argv.index("--eval-out") + 1] if "--eval-out" in sys.argv else None
    meta = json.load(open(os.path.join(ROOT, "data", "words.json"), encoding="utf-8"))
    base, clues = meta["board"], meta["clues"]
    packs = read_packs(os.path.join(HERE, "packs.txt"))

    bad = False
    for p in packs:
        dup = sorted({w for w in p["words"] if p["words"].count(w) > 1})
        if dup:
            print(f"{p['id']}: repeated words {dup}"); bad = True
        p["words"] = list(dict.fromkeys(p["words"]))
    extra = []
    for p in packs:
        for w in p["words"]:
            if w not in base and w not in extra:
                extra.append(w)
    wanted = set(base) | set(clues) | set(extra)

    zf = zipfile.ZipFile(glove_zip)
    v300, rank = load_vectors(zf, "glove.6B.300d.txt", wanted)
    v50, _ = load_vectors(zf, "glove.6B.50d.txt", wanted)

    missing = [w for w in extra if w not in v300 or w not in v50]
    if missing:
        print("pack words missing from GloVe:", missing); bad = True
    rare = [(w, rank[w]) for p in packs for w in p["words"] if w in rank and rank[w] > RARE]
    if rare:
        print("rare pack words (rank >", RARE, "):", rare); bad = True
    if bad:
        sys.exit(1)

    # the zip must be the one the shipped table came from
    shipped = np.fromfile(os.path.join(ROOT, "data", "assoc.bin"), dtype=np.int8)
    again = table(v300, base, clues).ravel()
    diff = int((shipped != again).sum())
    print(f"assoc.bin check: {diff} of {shipped.size} values differ")
    if diff:
        sys.exit(1)

    # one file per pack (a phone downloads only the pack it plays): rows for that pack's new words,
    # in the order of their index in "extra" (listed as the pack's "rows")
    S = table(v300, extra, clues)
    os.makedirs(os.path.join(ROOT, "data", "packs"), exist_ok=True)
    for p in packs:
        p["rows"] = sorted(extra.index(w) for w in p["words"] if w not in base)
        S[p["rows"]].tofile(os.path.join(ROOT, "data", "packs", p["id"] + ".bin"))
    out = {"version": VERSION, "base": len(base), "dims": [len(extra), len(clues)], "source": "GloVe 6B 300d",
           "extra": extra,
           "packs": [{"id": p["id"], "name": p["name"], "desc": p["desc"], "words": p["words"], "rows": p["rows"],
                      **({"mix": p["mix"]} if "mix" in p else {})} for p in packs]}
    with open(os.path.join(ROOT, "data", "packs.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    for p in packs:
        new = sum(1 for w in p["words"] if w not in base)
        print(f"{p['id']:8} {len(p['words'])} words ({new} new)")
    print(f"extra {len(extra)} rows ({S.size} bytes in all)")

    if eval_out:
        os.makedirs(eval_out, exist_ok=True)
        table(v50, extra, clues).tofile(os.path.join(eval_out, "packs50.bin"))
        table(v50, base, clues).tofile(os.path.join(eval_out, "assoc50.bin"))
        print("eval tables written to", eval_out)


if __name__ == "__main__":
    main()
