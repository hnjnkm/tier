import { test, expect, type Page } from '@playwright/test';

test.skip(process.env.TIER_CLOUD_E2E !== 'true', 'Requires isolated Firebase Auth/Firestore emulators, never a live project');
test.use({ launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', ...(process.env.TIER_TEST_PROXY_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.TIER_TEST_PROXY_SPKI}`] : [])] } });
const configuration = { enabled: true, apiKey: 'emulator-only-key', authDomain: 'demo-tier-sync.firebaseapp.com', projectId: 'demo-tier-sync', appId: '1:1234567890:web:0123abcdef', emulators: { authPort: 9099, firestorePort: 8080 } };
async function configure(page: Page) {
  await page.route('**/firebase-config.json', route => route.fulfill({ json: configuration }));
}
async function account(page: Page) {
  await page.getByRole('button', { name: '사이트 메뉴 열기' }).click();
  const menu = page.getByRole('dialog', { name: '사이트 메뉴', exact: true });
  await menu.getByRole('button', { name: /Google 로그인|계정과 동기화/ }).click();
  return page.getByRole('dialog', { name: '계정', exact: true });
}
async function login(page: Page, email: string) {
  const dialog = await account(page);
  const popupPromise = page.waitForEvent('popup');
  await dialog.getByRole('button', { name: 'Google로 로그인', exact: true }).click();
  const popup = await Promise.race([popupPromise, dialog.getByRole('alert').waitFor({ timeout: 20000 }).then(async () => { throw new Error(await dialog.getByRole('alert').innerText()); })]);
  await popup.waitForLoadState();
  const existing = popup.locator('.js-reuse-account').filter({ hasText: email });
  if (await existing.count()) await existing.click();
  else {
    await popup.getByRole('button', { name: 'Add new account', exact: true }).click();
    await popup.getByLabel('Email', { exact: false }).fill(email);
    await popup.getByRole('button', { name: /Sign in|Sign In/ }).click();
  }
  await expect(page.locator('.header-account')).toHaveAttribute('aria-label', '계정과 동기화', { timeout: 15000 });
  await expect(page.locator('.sync-banner')).toHaveCount(0, { timeout: 15000 });
}

test('Google popup login imports guest favorites, synchronizes both charts to a second device and isolates a different account', async ({ browser }) => {
  test.setTimeout(60000);
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
  const firstContext = await browser.newContext({ viewport: { width: 1280, height: 960 }, proxy });
  const secondContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, proxy });
  const first = await firstContext.newPage(), second = await secondContext.newPage();
  await configure(first); await configure(second);
  await first.addInitScript(() => {
    if (!localStorage.getItem('my-tier.board.v1')) localStorage.setItem('my-tier.board.v1', JSON.stringify({ version: 1, title: '내 로그인 티어', customArtists: [], tiers: { S: ['kr-iu'], A: [], B: [], C: [], D: [], E: [], F: [] }, favorites: { 'kr-iu': [{ id: 'youtube:cloud000001', artistId: `UC${'a'.repeat(22)}`, artistName: '아이유', title: '밤편지', album: 'Palette', locale: 'ko-KR' }] } }));
  });
  await first.goto('./'); await second.goto('./');
  const guest = await first.evaluate(() => localStorage.getItem('my-tier.board.v1'));
  await login(first, 'browser-alice@example.test');
  await expect(first.getByTestId('favorites-briefing')).toContainText('밤편지');
  await login(second, 'browser-alice@example.test');
  await expect(second.getByRole('heading', { name: '내 로그인 티어', exact: true })).toBeVisible();
  await expect(second.getByTestId('tier-S').locator('[data-artist-id="kr-iu"]')).toBeVisible();
  await first.getByRole('button', { name: 'F 티어에 아티스트 추가', exact: true }).click();
  await first.getByRole('dialog').getByLabel('추가할 아티스트 검색').fill('로이킴');
  await first.getByRole('dialog').getByRole('button', { name: '로이킴 F 티어에 추가', exact: true }).click();
  await first.getByRole('button', { name: '선택 완료', exact: true }).click();
  await expect(second.getByTestId('tier-F').locator('[data-artist-id="kr-roy-kim"]')).toBeVisible();
  await first.locator('.header-navigation').getByRole('link', { name: '해외', exact: true }).click();
  await first.getByRole('button', { name: 'A 티어에 아티스트 추가', exact: true }).click();
  await first.getByRole('dialog').getByRole('button', { name: 'Taylor Swift A 티어에 추가', exact: true }).click();
  await first.getByRole('button', { name: '선택 완료', exact: true }).click();
  await second.locator('.header-navigation').getByRole('link', { name: '해외', exact: true }).click();
  await expect(second.getByTestId('tier-A').locator('[data-artist-id="global-taylor-swift"]')).toBeVisible();
  const secondAccount = await account(second); await secondAccount.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(second.getByTestId('tier-A').locator('[data-artist-id="global-taylor-swift"]')).toHaveCount(0);
  await login(second, 'browser-bob@example.test');
  await expect(second.getByTestId('tier-A').locator('[data-artist-id="global-taylor-swift"]')).toHaveCount(0);
  expect(await first.evaluate(() => localStorage.getItem('my-tier.board.v1'))).toBe(guest);
  expect(await second.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await firstContext.close(); await secondContext.close();
});
