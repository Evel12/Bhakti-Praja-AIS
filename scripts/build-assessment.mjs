// Builds the standalone assessment app (assessment-frontend/) into the
// main AIS frontend so it can be embedded at /assessment-app/ behind
// the "Assessment" navigation item.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const frontendDir = fileURLToPath(new URL('../assessment-frontend', import.meta.url));
const result = spawnSync(
  'npm',
  ['run', 'build', '--', '--base=/assessment-app/', '--outDir=../frontend/public/assessment-app'],
  { cwd: frontendDir, stdio: 'inherit', shell: true },
);
process.exit(result.status ?? 1);
