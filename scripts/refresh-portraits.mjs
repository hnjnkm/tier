import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const python = existsSync('.runtime/music-venv/bin/python') ? '.runtime/music-venv/bin/python' : 'python3';
for (const [command, args] of [
  ['node', ['--import', 'tsx', 'scripts/export-music-artists.ts']],
  [python, ['scripts/refresh-youtube-portraits.py', '--artists', '/tmp/tier-music-artists.json', ...process.argv.slice(2)]],
  ['node', ['--import', 'tsx', 'scripts/cache-portraits.ts', '--youtube']],
]) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
