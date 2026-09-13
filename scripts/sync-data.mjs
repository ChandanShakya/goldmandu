import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, 'data', 'prices.json');
const destDir = join(root, 'public', 'data');
const dest = join(destDir, 'prices.json');

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`synced ${src} -> ${dest}`);
