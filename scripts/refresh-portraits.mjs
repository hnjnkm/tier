import { spawnSync } from 'node:child_process';

for (const [command, args] of [
  ['node', ['--import', 'tsx', 'scripts/refresh-portraits.ts', ...process.argv.slice(2)]],
  ['node', ['--import', 'tsx', 'scripts/cache-portraits.ts', '--profiles']],
]) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
