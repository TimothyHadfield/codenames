// Load the shipped word table in node (tests + simulator).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Assoc } from '../js/engine.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadAssoc(binPath = join(ROOT, 'data', 'assoc.bin')) {
  const meta = JSON.parse(readFileSync(join(ROOT, 'data', 'words.json'), 'utf8'));
  const buf = readFileSync(binPath);
  const sims = new Int8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  if (sims.length !== meta.board.length * meta.clues.length) throw new Error('table size mismatch: ' + binPath);
  return new Assoc(sims, meta.board, meta.clues, meta.cpu);
}

// Word packs (data/packs.json + data/packs/<id>.bin): adds the rows of the given packs (all by default)
// to an Assoc. evalDir: read the 50d "other mind" rows from DIR/packs50.bin (all extra rows) instead.
export function loadPacks(assoc, ids = null, evalBin = null) {
  const P = JSON.parse(readFileSync(join(ROOT, 'data', 'packs.json'), 'utf8'));
  const full = assoc.board.slice(0, P.base).concat(P.extra);
  if (evalBin) {
    const buf = readFileSync(evalBin);
    assoc.addRows(full, P.extra.map((_, i) => i), new Int8Array(buf.buffer, buf.byteOffset, buf.byteLength));
    return P;
  }
  for (const p of P.packs) {
    if (ids && !ids.includes(p.id)) continue;
    const buf = readFileSync(join(ROOT, 'data', 'packs', p.id + '.bin'));
    assoc.addRows(full, p.rows, new Int8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  }
  return P;
}
