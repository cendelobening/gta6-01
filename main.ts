// SOLMAR HEAT — the entry program for make.fun's gta6-01 bounty.
// Node 22, standard library only. It takes this repository's game/ (plain
// static files: game/index.html plus its ES modules, no build step, no
// network) and screenshots/ (3-4 JPEG renders of the game itself) and hands
// them in: it copies both into the output directory and writes
// /output/dossier.json with the vendored make.fun library, so the scorer can
// check the game and the judge can read its dossier.
//
// Run it locally like this:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader MAKEFUN_OUTPUT_DIR stands in for /output; inside the
// grader the variable is unset and /output is used. Both runs must write
// byte-identical output, so nothing here depends on the time or the machine.

import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Refuse to hand in a game that breaks the gate's own caps, rather than
// letting the scorer be the first to notice. index.html is checked on its
// own because the gate caps it separately at 1 MiB.
function checkGameTree(dir) {
  const index = join(dir, 'index.html');
  if (!existsSync(index)) throw new Error('game/index.html is missing');
  if (statSync(index).size > 1024 * 1024) throw new Error('game/index.html is over the 1 MiB cap');
  const stack = [dir];
  let entries = 0;
  let bytes = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      const stats = statSync(path);
      entries += 1;
      if (stats.isDirectory()) {
        stack.push(path);
      } else if (stats.isFile()) {
        bytes += stats.size;
        if (path.length > 1000) throw new Error(`game path too long: ${path}`);
      } else {
        throw new Error(`game/ must hold plain files and directories only: ${path}`);
      }
    }
  }
  if (entries > 993) throw new Error(`game/ holds ${entries} entries, over the 993 cap`);
  if (bytes > 48 * 1024 * 1024) throw new Error(`game/ is ${bytes} bytes, over the 48 MiB cap`);
}

function checkScreenshots(dir) {
  if (!existsSync(dir)) throw new Error('screenshots/ is missing');
  const shots = readdirSync(dir).filter((name) => !name.startsWith('.'));
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`screenshots/ holds ${shots.length} images, need 3 or 4`);
  }
  for (const name of shots) {
    const stats = statSync(join(dir, name));
    if (!stats.isFile() || stats.size > 256 * 1024) {
      throw new Error(`screenshot ${name} is not a file under 256 KiB`);
    }
  }
}

checkGameTree(join(repoRoot, 'game'));
checkScreenshots(join(repoRoot, 'screenshots'));

// The copy is deterministic: cpSync walks each directory in readdir order and
// buildDossier sorts what it reads, so a second run writes the same bytes.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });

writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// The grader reads /output as another user, so every directory the program
// creates must be traversable and every file readable whatever the umask is
// where this runs: chmod ignores the umask, a mode passed to mkdir/write
// would not. Copied files already carry the repository's 0644 modes.
function makeWorldReadable(dir) {
  chmodSync(dir, 0o755);
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) makeWorldReadable(path);
    else chmodSync(path, 0o644);
  }
}
makeWorldReadable(outputDir);
