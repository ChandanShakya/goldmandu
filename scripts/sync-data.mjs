import { copyFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, 'data', 'prices.json');
const destDir = join(root, 'public', 'data');
const dest = join(destDir, 'prices.json');

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`synced ${src} -> ${dest}`);

const api = spawnSync(
  process.execPath,
  [join(root, 'scripts', 'sync-api.mjs')],
  { stdio: 'inherit' },
);
if (api.status !== 0) process.exit(api.status ?? 1);
