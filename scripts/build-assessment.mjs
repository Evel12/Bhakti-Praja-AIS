import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
if (!existsSync(vite)) {
  console.error('Jalankan npm ci pada root repository untuk memasang dependensi assessment.');
  process.exit(1);
}
const result = spawnSync(process.execPath, [vite, 'build', '--base=/assessment-app/', '--outDir=frontend/public/assessment-app'], { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
