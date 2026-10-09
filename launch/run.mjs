import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = join(root, '.runtime');
mkdirSync(runtime, { recursive: true });
let child;

function openBrowser(url) {
  if (process.env.MY_TIER_NO_BROWSER === '1') return;
  const command = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/d', '/c', 'start', '', url] : [url];
  const opener = spawn(command, args, { detached: true, stdio: 'ignore' });
  opener.on('error', () => console.log(`Open this address in your browser: ${url}`));
  opener.unref();
}

async function isOurApp(port) {
  try {
    const base = `http://127.0.0.1:${port}`;
    const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) }).then(response => response.json());
    const response = await fetch(base, { signal: AbortSignal.timeout(1000) });
    return health.status === 'ok' && response.ok && (await response.text()).includes('my tier.');
  } catch { return false; }
}

async function portAvailable(port) {
  return new Promise(resolve => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

async function run(command, args) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { cwd: root, stdio: 'inherit', shell: false });
    process.once('error', reject);
    process.once('exit', code => code === 0 ? resolve() : reject(new Error(`Installation failed (exit ${code}). Check your internet connection and retry.`)));
  });
}

async function main() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) throw new Error('Node.js 22.12 or later is required. Use the included START file.');
  const savedPortFile = join(runtime, 'port.txt');
  const savedPort = existsSync(savedPortFile) ? Number(readFileSync(savedPortFile, 'utf8')) : 5273;
  const preferred = Number(process.env.MY_TIER_PORT || savedPort);
  if (!Number.isInteger(preferred) || preferred < 1024 || preferred > 65525) throw new Error('MY_TIER_PORT must be between 1024 and 65525.');
  let port = preferred;
  for (; port < preferred + 10; port++) {
    if (await isOurApp(port)) { console.log('my tier. is already running.'); openBrowser(`http://127.0.0.1:${port}`); return; }
    if (await portAvailable(port)) break;
  }
  if (port >= preferred + 10) throw new Error('No free port was found. Close an existing my tier. window and try again.');
  writeFileSync(savedPortFile, String(port));

  const signature = createHash('sha256').update(readFileSync(join(root, 'package-lock.json'))).update(`${process.platform}-${process.arch}`).digest('hex');
  const stamp = join(root, 'node_modules', '.my-tier-installed');
  const installed = existsSync(stamp) && readFileSync(stamp, 'utf8') === signature && existsSync(join(root, 'node_modules', 'tsx', 'dist', 'loader.mjs'));
  if (!installed) {
    const npmPaths = [join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')];
    const npm = npmPaths.find(existsSync);
    if (!npm) throw new Error('npm was not found. Use the included START file to download the complete Node.js runtime.');
    console.log('\nFirst launch: installing app dependencies. This can take a few minutes.\n');
    await run(process.execPath, [npm, 'ci', '--include=dev', '--no-audit', '--no-fund', '--cache', join(runtime, 'npm-cache')]);
    writeFileSync(stamp, signature);
  }
  if (!existsSync(join(root, 'dist', 'index.html'))) throw new Error('App files are missing. Extract the complete ZIP and try again.');
  console.log('\nStarting my tier. Keep this window open while using the app.\n');
  child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts', '--production'], {
    cwd: root, stdio: 'inherit', env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
  });
  child.once('error', error => { console.error(error.message); process.exitCode = 1; });
  child.once('exit', code => { process.exitCode = code ?? 0; });
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error('The app could not start. See the error above.');
    if (await isOurApp(port)) { console.log(`\nReady: ${url}\nClose this window or press Ctrl+C to stop.\n`); openBrowser(url); return; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  child.kill('SIGTERM');
  throw new Error('The app did not start in time. Please try again.');
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { if (child) child.kill('SIGTERM'); else process.exit(0); });
main().catch(error => { console.error(`\n${error.message}\n`); process.exitCode = 1; child?.kill('SIGTERM'); });
