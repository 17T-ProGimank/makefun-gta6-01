// SOLMARA hand-in: gathers the finished game and its screenshots into the
// output folder and stamps the dossier the judge reads. Node 22, standard
// library only — the only outside import is the kit's dossier builder.
// Run from the repo root:  MAKEFUN_OUTPUT_DIR=out node main.ts
// (without the variable it writes to /output, the grader's folder).

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start from a clean slate so a stale file from an older run can never
// ride along into the entry.
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

const gameOut = join(outputDir, 'game');
cpSync(join(repoRoot, 'game'), gameOut, { recursive: true });

// Fail fast with a readable message instead of letting the dossier
// builder complain about a missing page.
if (!existsSync(join(gameOut, 'index.html'))) {
  throw new Error('SOLMARA hand-in: game/index.html is missing, nothing to hand in');
}

const shotsOut = join(outputDir, 'screenshots');
mkdirSync(shotsOut, { recursive: true });
const shotsIn = join(repoRoot, 'screenshots');
if (existsSync(shotsIn)) cpSync(shotsIn, shotsOut, { recursive: true });

// Caps from the competition's gate: the text budget shapes the dossier,
// the rest refuse anything the scorer would refuse (too many screenshots,
// one too big, game/ too large or too many files).
const dossierBytes = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossierBytes);
console.log(`SOLMARA entry written to ${outputDir}`);
