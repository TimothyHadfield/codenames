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
