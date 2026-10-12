import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactPath = path.join(root, '.runtime', 'firebase-emulators');
await fs.mkdir(artifactPath, { recursive: true });
// Demo projects never fall through to real Google resources. Do not read ambient admin credentials.
const environment = { ...process.env, FIREBASE_EMULATORS_PATH: artifactPath, XDG_CONFIG_HOME: path.join(root, '.runtime', 'firebase-cli'), XDG_CACHE_HOME: path.join(root, '.runtime', 'firebase-cache'), GCLOUD_PROJECT: 'demo-tier-sync', FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true' };
delete environment.GOOGLE_APPLICATION_CREDENTIALS;
delete environment.FIREBASE_TOKEN;
const cli = path.join(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const browser = process.argv.includes('--browser');
if (browser) {
  environment.TIER_CLOUD_E2E = 'true';
  if (environment.HTTPS_PROXY && environment.NODE_EXTRA_CA_CERTS) {
    // Trust only this environment's explicit proxy CA in the isolated demo browser.
    const pem = execFileSync('openssl', ['x509', '-in', environment.NODE_EXTRA_CA_CERTS, '-pubkey', '-noout']);
    const der = execFileSync('openssl', ['pkey', '-pubin', '-outform', 'DER'], { input: pem });
    environment.TIER_TEST_PROXY_SPKI = createHash('sha256').update(der).digest('base64');
  }
}
const command = browser ? 'npx playwright test --config playwright.pages.config.ts tests/pages/cloud.spec.ts' : 'node --import tsx --test --test-concurrency=1 tests/cloud/*.test.ts';
const child = spawn(process.execPath, [cli, 'emulators:exec', '--project', 'demo-tier-sync', '--only', 'auth,firestore', '--config', path.join(root, 'firebase.json'), command], { cwd: root, stdio: 'inherit', env: environment });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
