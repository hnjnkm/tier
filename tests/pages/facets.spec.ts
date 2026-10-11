import { test, expect, type Page } from '@playwright/test';

async function providers(page: Page) {
  await page.route('https://musicbrainz.org/**', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { artists: [] } }));
}

test('international tags stay collapsed, combine countries and decades, clear individually and reset fifty-item expansion', async ({ page }) => {
  await providers(page);
  await page.goto('./?chart=global');
  const pool = page.getByTestId('artist-pool');
  const tags = pool.locator('.discovery-tags');
  const toggle = tags.getByRole('button', { name: '상세 필터', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(tags.locator('.facet-panel')).toBeHidden();
  await expect(pool.getByRole('combobox')).toHaveCount(2);
  await toggle.click();
  await expect(tags.locator('fieldset').nth(1).locator('.facet-tag').first()).toHaveText('1950년대 이전');
  await tags.getByRole('button', { name: '미국', exact: true }).click();
  await pool.getByRole('button', { name: /^더 보기/ }).click();
  await expect(pool.locator('[data-artist-id]')).toHaveCount(100);
  await tags.getByRole('button', { name: '영국', exact: true }).click();
  await expect(pool.locator('[data-artist-id]')).toHaveCount(50);
  await tags.getByRole('button', { name: '1990년대', exact: true }).click();
  await expect(pool.locator('[data-artist-id="global-britney-spears"]')).toBeVisible();
  await expect(pool.locator('[data-artist-id="global-coldplay"]')).toBeVisible();
  await expect(pool.locator('[data-artist-id="global-taylor-swift"]')).toHaveCount(0);
  await expect(pool.locator('[data-artist-id="global-ac-dc"]')).toHaveCount(0);
  await pool.getByLabel('음악 장르 필터').selectOption('dance');
  await pool.getByRole('button', { name: '여자', exact: true }).click();
  await expect(pool.locator('[data-artist-id="global-britney-spears"]')).toBeVisible();
  await expect(pool.locator('[data-artist-id="global-coldplay"]')).toHaveCount(0);
  await toggle.click();
  await expect(tags.locator('.facet-panel')).toBeHidden();
  await tags.getByRole('button', { name: '1990년대 데뷔 연대 필터 해제', exact: true }).click();
  await expect(pool.locator('[data-artist-id="global-taylor-swift"]')).toBeVisible();
  await tags.getByRole('button', { name: '태그 초기화', exact: true }).click();
  await expect(tags.locator('.selected-facet')).toHaveCount(0);
  await expect(pool.getByLabel('음악 장르 필터')).toHaveValue('dance');
  await expect(pool.getByRole('button', { name: '여자', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

for (const width of [390, 320]) {
  test(`mobile ${width}px tier picker shares tags, keeps results usable and saves to the selected tier`, async ({ page }) => {
    await providers(page);
    await page.setViewportSize({ width, height: width === 320 ? 750 : 844 });
    await page.goto('./?chart=global');
    await page.getByRole('button', { name: 'F 티어에 아티스트 추가', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'F 티어에 추가' });
    await picker.getByRole('button', { name: '상세 필터', exact: true }).click();
    await picker.getByRole('button', { name: '다른 국가', exact: true }).click();
    await expect(picker.getByRole('button', { name: '자메이카', exact: true })).toBeVisible();
    await picker.getByRole('button', { name: '주요 국가만', exact: true }).click();
    await picker.getByRole('button', { name: '오스트레일리아', exact: true }).click();
    await picker.getByRole('button', { name: '1970년대', exact: true }).click();
    await picker.getByLabel('음악 장르 필터').selectOption('rock');
    await picker.getByLabel('솔로 및 그룹 필터').selectOption('group');
    await picker.getByRole('button', { name: '남자', exact: true }).click();
    const list = await picker.locator('.picker-results').boundingBox();
    expect(list!.height).toBeGreaterThan(80);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await picker.getByRole('button', { name: 'AC/DC F 티어에 추가', exact: true }).click();
    await expect(picker.getByRole('button', { name: 'AC/DC F 티어에 이미 있음', exact: true })).toBeDisabled();
    await picker.getByRole('button', { name: '상세 필터', exact: true }).click();
    await expect(picker.getByRole('button', { name: '1970년대 데뷔 연대 필터 해제', exact: true })).toBeVisible();
    await picker.getByRole('button', { name: '선택 완료', exact: true }).click();
    await page.reload();
    await expect(page.getByTestId('tier-F').locator('[data-artist-id="global-ac-dc"]')).toBeVisible();
    await expect(page.getByTestId('tier-S').locator('[data-artist-id="global-ac-dc"]')).toHaveCount(0);
  });
}

test('tag filtering preserves saved boards and songs, reports empty combinations correctly and stays out of Korean discovery', async ({ page }) => {
  await providers(page);
  await page.addInitScript(() => {
    const empty = { A: [], B: [], C: [], D: [], E: [], F: [] };
    if (!localStorage.getItem('my-tier.board.global.v1')) localStorage.setItem('my-tier.board.global.v1', JSON.stringify({ version: 1, collection: 'global', title: '내 해외 티어', customArtists: [], tiers: { S: ['global-taylor-swift'], ...empty }, favorites: { 'global-taylor-swift': [{ id: 'youtube:video000001', title: 'Love Story', artistId: `UC${'a'.repeat(22)}`, artistName: 'Taylor Swift', album: 'Fearless', locale: 'ko-KR' }] } }));
    if (!localStorage.getItem('my-tier.board.v1')) localStorage.setItem('my-tier.board.v1', JSON.stringify({ version: 1, title: '내 국내 티어', customArtists: [], tiers: { S: ['kr-iu'], ...empty }, favorites: {} }));
  });
  await page.goto('./?chart=global');
  const saved = await page.evaluate(() => [localStorage.getItem('my-tier.board.global.v1'), localStorage.getItem('my-tier.board.v1')]);
  const tags = page.getByTestId('artist-pool').locator('.discovery-tags');
  const toggle = tags.getByRole('button', { name: '상세 필터', exact: true });
  await toggle.focus(); await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await tags.getByRole('button', { name: '일본', exact: true }).click();
  await page.getByLabel('가수 이름 검색').fill('Taylor Swift');
  await expect(page.getByRole('heading', { name: '조건에 맞는 가수가 없어요' })).toBeVisible();
  await expect(page.getByTestId('favorites-briefing')).toContainText('Love Story');
  await page.getByRole('button', { name: '검색 및 필터 초기화', exact: true }).click();
  await expect(tags.locator('.selected-facet')).toHaveCount(0);
  expect(await page.evaluate(() => [localStorage.getItem('my-tier.board.global.v1'), localStorage.getItem('my-tier.board.v1')])).toEqual(saved);
  await page.getByRole('button', { name: '티어표 메뉴 열기' }).click();
  await page.getByRole('dialog', { name: '티어표', exact: true }).getByRole('link', { name: '국내 아티스트' }).click();
  await expect(page.getByRole('button', { name: '상세 필터', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('tier-S').locator('[data-artist-id="kr-iu"]')).toBeVisible();
  await page.getByRole('button', { name: 'A 티어에 아티스트 추가', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: '상세 필터', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'A 티어에 아티스트 추가', exact: true })).toBeFocused();
});
