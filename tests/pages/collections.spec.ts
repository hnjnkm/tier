import { test, expect, type Page } from '@playwright/test';

async function switchChart(page: Page, label: '국내 아티스트' | '해외 아티스트') {
  await page.getByRole('button', { name: '사이트 메뉴 열기' }).click();
  const menu = page.getByRole('dialog', { name: '사이트 메뉴', exact: true });
  await expect(menu).toBeVisible();
  await menu.getByRole('link', { name: label }).click();
  await expect(menu).not.toBeVisible();
}

async function providers(page: Page) {
  await page.route('https://musicbrainz.org/**', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { artists: [] } }));
  const channelId = `UC${'a'.repeat(22)}`;
  await page.route('**/music/global-taylor-swift.json', route => route.fulfill({ json: { source: 'youtube-music', artistId: 'global-taylor-swift', channelId, updatedAt: '2026-10-11T00:00:00Z', complete: true,
    songs: ['Love Story', 'Cruel Summer', 'Anti-Hero', 'Blank Space'].map((title, index) => ({ id: `youtube:taylor0000${index}`, title, artistName: 'Taylor Swift', artistId: channelId, album: 'Collection', year: '2023', locale: 'ko-KR', url: `https://music.youtube.com/watch?v=taylor0000${index}` })) } }));
}

test('menu switches independent boards without changing existing Korean saves or favorite choices', async ({ page }) => {
  await providers(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('my-tier.board.v1')) localStorage.setItem('my-tier.board.v1', JSON.stringify({ version: 1, title: '내 국내 티어', customArtists: [], tiers: { S: ['kr-iu'], A: [], B: [], C: [], D: [], E: [], F: [] }, favorites: {} }));
  });
  await page.goto('./');
  const original = await page.evaluate(() => localStorage.getItem('my-tier.board.v1'));
  await expect(page.getByRole('heading', { name: '내 국내 티어', exact: true })).toBeVisible();
  await switchChart(page, '해외 아티스트');
  await expect(page).toHaveURL(/\?chart=global$/);
  await expect(page.getByTestId('tier-S').locator('[data-artist-id]')).toHaveCount(0);
  await expect(page.locator('.artist-grid [data-artist-id]')).toHaveCount(50);
  await page.locator('[data-artist-id="global-taylor-swift"] .artist-main').click();
  const songs = page.getByRole('dialog');
  await songs.getByRole('button', { name: 'Taylor Swift S 티어로 이동' }).click();
  for (const name of ['Love Story', 'Cruel Summer', 'Anti-Hero']) await songs.getByRole('button', { name: `${name} 대표곡으로 선택`, exact: true }).click();
  await songs.getByRole('button', { name: '선택 완료' }).click();
  await expect(page.getByTestId('favorites-briefing')).toContainText('Cruel Summer');
  await page.reload();
  await expect(page.getByTestId('tier-S').locator('[data-artist-id="global-taylor-swift"]')).toBeVisible();
  await expect(page.getByTestId('favorites-briefing')).toContainText('Anti-Hero');
  await switchChart(page, '국내 아티스트');
  await expect(page.getByTestId('tier-S').locator('[data-artist-id="kr-iu"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('my-tier.board.v1'))).toBe(original);
  await page.goBack();
  await expect(page.getByTestId('favorites-briefing')).toContainText('Love Story');
  await page.goForward();
  await expect(page.getByRole('heading', { name: '내 국내 티어', exact: true })).toBeVisible();
});

test('mobile foreign picker keeps all filters, original names, Korean aliases and fifty-item expansion', async ({ page }) => {
  await providers(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?chart=global');
  await expect(page.locator('.artist-grid [data-artist-id]')).toHaveCount(50);
  await page.getByRole('button', { name: /^더 보기/ }).click();
  await expect(page.locator('.artist-grid [data-artist-id]')).toHaveCount(100);
  await page.getByRole('button', { name: 'F 티어에 아티스트 추가', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'F 티어에 추가' });
  await picker.getByLabel('음악 장르 필터').selectOption('rock');
  await picker.getByLabel('솔로 및 그룹 필터').selectOption('group');
  await picker.getByRole('button', { name: '남자', exact: true }).click();
  await picker.getByLabel('추가할 아티스트 검색').fill('콜드플레이');
  await picker.getByRole('button', { name: 'Coldplay F 티어에 추가', exact: true }).click();
  await expect(picker.getByRole('button', { name: 'Coldplay F 티어에 이미 있음', exact: true })).toBeDisabled();
  await picker.getByRole('button', { name: '선택 완료' }).click();
  await page.reload();
  await expect(page.getByTestId('tier-F').locator('[data-artist-id="global-coldplay"]')).toBeVisible();
  await switchChart(page, '국내 아티스트');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('.artist-grid [data-artist-id^="global-"]')).toHaveCount(0);
});

test('menu closes with Escape and returns focus; importing a different chart preserves the current board', async ({ page }) => {
  await providers(page);
  await page.setViewportSize({ width: 320, height: 750 });
  await page.goto('./?chart=global');
  const button = page.getByRole('button', { name: '사이트 메뉴 열기' });
  await button.click();
  const menu = page.getByRole('dialog', { name: '사이트 메뉴', exact: true });
  await expect(menu.getByRole('link', { name: '해외 아티스트' })).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Escape');
  await expect(button).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const korean = { version: 1, title: 'Korean', customArtists: [], tiers: { S: ['kr-iu'], A: [], B: [], C: [], D: [], E: [], F: [] }, favorites: {} };
  await page.locator('input[type="file"]').setInputFiles({ name: 'my-tier.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(korean)) });
  await expect(page.getByRole('status').filter({ hasText: '국내 아티스트 티어표를 메뉴에서 선택한 뒤 불러와 주세요.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '해외 아티스트 티어', exact: true })).toBeVisible();
  await expect(page.getByTestId('tier-S').locator('[data-artist-id]')).toHaveCount(0);
});
