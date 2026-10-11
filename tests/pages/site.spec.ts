import { test, expect } from '@playwright/test';

for (const width of [320, 1440]) {
  test(`direct domestic/international navigation stays visible at ${width}px and restores independent boards through history`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 750 : 960 });
    await page.addInitScript(() => {
      const rows = { A: [], B: [], C: [], D: [], E: [], F: [] };
      if (!localStorage.getItem('my-tier.board.v1')) localStorage.setItem('my-tier.board.v1', JSON.stringify({ version: 1, title: '내 국내 티어', customArtists: [], tiers: { S: ['kr-iu'], ...rows }, favorites: {} }));
      if (!localStorage.getItem('my-tier.board.global.v1')) localStorage.setItem('my-tier.board.global.v1', JSON.stringify({ version: 1, collection: 'global', title: '내 해외 티어', customArtists: [], tiers: { S: ['global-taylor-swift'], ...rows }, favorites: {} }));
    });
    await page.goto('./');
    const saved = await page.evaluate(() => [localStorage.getItem('my-tier.board.v1'), localStorage.getItem('my-tier.board.global.v1')]);
    const nav = page.locator('.header-navigation');
    await expect(nav.getByRole('link', { name: '국내', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: '해외', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: '국내', exact: true })).toHaveAttribute('aria-current', 'page');
    const target = await nav.getByRole('link', { name: '해외', exact: true }).boundingBox();
    expect(target!.height).toBeGreaterThanOrEqual(44); expect(target!.width).toBeGreaterThanOrEqual(44);
    await nav.getByRole('link', { name: '해외', exact: true }).click();
    await expect(page).toHaveURL(/\?chart=global$/);
    await expect(nav.getByRole('link', { name: '해외', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('tier-S').locator('[data-artist-id="global-taylor-swift"]')).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://hnjnkm.github.io/tier/?chart=global');
    await page.goBack();
    await expect(page.getByTestId('tier-S').locator('[data-artist-id="kr-iu"]')).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('heading', { name: '내 해외 티어', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => [localStorage.getItem('my-tier.board.v1'), localStorage.getItem('my-tier.board.global.v1')])).toEqual(saved);
  });
}

test('hamburger and footer link to published policies, refresh works and returning preserves the saved chart', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?chart=global');
  await page.getByRole('button', { name: 'F 티어에 아티스트 추가', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Taylor Swift F 티어에 추가', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '선택 완료', exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem('my-tier.board.global.v1'));
  await page.getByRole('button', { name: '사이트 메뉴 열기' }).click();
  const menu = page.getByRole('dialog', { name: '사이트 메뉴', exact: true });
  for (const label of ['국내 아티스트', '해외 아티스트', '사이트 소개', '이용 안내', '개인정보처리방침', '이용약관', '문의']) await expect(menu.getByRole('link', { name: label, exact: true })).toBeVisible();
  await menu.getByRole('link', { name: '개인정보처리방침', exact: true }).click();
  await expect(page).toHaveURL(/\/tier\/privacy\/$/);
  await expect(page.getByRole('heading', { name: '개인정보처리방침', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('main')).toContainText('localStorage');
  await page.getByRole('navigation', { name: '티어표 선택', exact: true }).getByRole('link', { name: '해외', exact: true }).click();
  await expect(page.getByTestId('tier-F').locator('[data-artist-id="global-taylor-swift"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('my-tier.board.global.v1'))).toBe(saved);
  await page.locator('.site-footer').getByRole('link', { name: '문의', exact: true }).click();
  await expect(page.getByRole('heading', { name: '문의', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: /GitHub에서 문의하기/ })).toHaveAttribute('href', 'https://github.com/hnjnkm/tier/issues/new');
});

test('all public information pages work without JavaScript, with self-hosted fonts and no advertising network requests', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 750 } });
  const page = await context.newPage();
  const hosts = new Set<string>(); page.on('request', request => hosts.add(new URL(request.url()).hostname));
  for (const [id, title] of [['about', '사이트 소개'], ['guide', '이용 안내'], ['privacy', '개인정보처리방침'], ['terms', '이용약관'], ['contact', '문의']]) {
    const response = await page.goto(`http://127.0.0.1:5180/tier/${id}/`);
    expect(response!.status()).toBe(200);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://hnjnkm.github.io/tier/${id}/`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('13px "Pretendard Variable"'); })).toBe(true);
    await page.locator('.info-menu summary').click();
    await expect(page.getByRole('navigation', { name: '사이트 메뉴 링크' }).getByRole('link', { name: '국내', exact: true })).toBeVisible();
  }
  expect([...hosts]).toEqual(['127.0.0.1']);
  await context.close();
});

test('sitemap and robots are public static documents and list both charts plus every information page', async ({ request }) => {
  const response = await request.get('sitemap.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();
  for (const path of ['', '?chart=global', 'about/', 'guide/', 'privacy/', 'terms/', 'contact/']) expect(xml).toContain(`<loc>https://hnjnkm.github.io/tier/${path}</loc>`);
  const robots = await request.get('robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain('Sitemap: https://hnjnkm.github.io/tier/sitemap.xml');
  expect((await request.get('privacy/index.html')).status()).toBe(200);
});
