import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/pages',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5180/tier/', headless: true, launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] } },
  webServer: { command: 'node scripts/serve-pages.mjs', url: 'http://127.0.0.1:5180/tier/', reuseExistingServer: false, timeout: 10000 },
  reporter: 'list',
});
