import { test, expect, type Page } from '@playwright/test';

const songs = ['Love wins all', '밤편지', '팔레트', '좋은 날'].map((title, index) => ({ id: `itunes:${index + 1}`, title, artistName: 'IU', artistId: 409076846, album: 'IU Collection', year: '2024' }));

async function fixtureApi(page: Page) {
  await page.route('**/api/portraits?**', route => route.fulfill({ json: { portraits: {}, source: 'wikipedia' } }));
  await page.route('**/api/artists/search?**', route => route.fulfill({ json: { artists: [], source: 'musicbrainz' } }));
  await page.route('**/api/artists/*/songs?**', route => {
    const query = new URL(route.request().url()).searchParams.get('q') || '';
    return route.fulfill({ json: { songs: songs.filter(song => song.title.includes(query)), source: 'itunes' } });
  });
}

test.beforeEach(async ({ page }) => { await fixtureApi(page); await page.goto('/'); });

test('artist search and gender/type filters work across the curated collection', async ({ page }) => {
  await page.getByRole('button', { name: '여자', exact: true }).click();
  await expect(page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' })).toBeVisible();
  await expect(page.getByRole('button', { name: '방탄소년단 곡 선택 및 티어 변경' })).toHaveCount(0);
  await page.getByLabel('가수 이름 검색').fill('악동뮤지션');
  await expect(page.getByRole('button', { name: '악뮤 곡 선택 및 티어 변경' })).toHaveCount(0);
  await page.getByRole('button', { name: '혼성', exact: true }).click();
  await expect(page.getByRole('button', { name: '악뮤 곡 선택 및 티어 변경' })).toBeVisible();
  await page.getByLabel('솔로 및 그룹 필터').selectOption('solo');
  await expect(page.getByRole('button', { name: '악뮤 곡 선택 및 티어 변경' })).toHaveCount(0);
});

test('three song slots, tier changes and browser reload preserve choices', async ({ page }) => {
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await page.getByRole('button', { name: '아이유 S 티어로 이동' }).click();
  for (const title of ['Love wins all', '밤편지', '팔레트']) await page.getByRole('button', { name: `${title} 대표곡으로 선택`, exact: true }).click();
  await page.getByRole('button', { name: '좋은 날 대표곡으로 선택', exact: true }).click();
  await expect(page.locator('.dialog-notice')).toContainText('최대 3개');
  await expect(page.getByLabel('선택한 대표곡').locator('.song-slot.filled')).toHaveCount(3);
  await page.getByRole('button', { name: '밤편지 대표곡에서 제거' }).click();
  await page.getByRole('button', { name: '좋은 날 대표곡으로 선택', exact: true }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await expect(page.getByTestId('tier-S').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId('tier-S').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await expect(page.getByLabel('선택한 대표곡').locator('.song-slot.filled')).toHaveCount(3);
  await expect(page.getByRole('button', { name: '좋은 날 대표곡에서 제거' })).toBeVisible();
  await page.getByRole('button', { name: '보관함', exact: true }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await expect(page.getByTestId('tier-S').locator('[data-artist-id="kr-iu"]')).toHaveCount(0);
  await expect(page.getByTestId('artist-pool').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
});

test('mouse dragging moves a thumbnail from the pool to a tier and back', async ({ page }) => {
  await page.getByLabel('가수 이름 검색').fill('아이유');
  const card = page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' });
  await card.scrollIntoViewIfNeeded();
  const start = await card.boundingBox();
  expect(start).toBeTruthy();
  await page.mouse.move(start!.x + 25, start!.y + 25);
  await page.mouse.down();
  await page.mouse.move(start!.x + 25, start!.y + 8, { steps: 5 });
  await page.getByTestId('tier-S').scrollIntoViewIfNeeded();
  const tier = await page.getByTestId('tier-S').boundingBox();
  await page.mouse.move(tier!.x + 200, tier!.y + 40, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByTestId('tier-S').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const placed = await page.getByTestId('tier-S').locator('.artist-main').boundingBox();
  await page.mouse.move(placed!.x + 20, placed!.y + 20);
  await page.mouse.down(); await page.mouse.move(placed!.x + 20, placed!.y + 30, { steps: 4 });
  await page.getByTestId('artist-pool').scrollIntoViewIfNeeded();
  const pool = await page.getByTestId('artist-pool').boundingBox();
  await page.mouse.move(pool!.x + 350, pool!.y + 150, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByTestId('tier-S').locator('[data-artist-id="kr-iu"]')).toHaveCount(0);
  await expect(page.getByTestId('artist-pool').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
});

test('song searches and error retries expose useful results, and dialog supports Escape', async ({ page }) => {
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await page.getByLabel('곡 제목 검색').fill('밤편지');
  await expect(page.locator('.song-result')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '밤편지 대표곡으로 선택', exact: true })).toBeVisible();
  await page.getByLabel('곡 제목 검색').fill('없는노래');
  await expect(page.getByText('이 가수의 곡 중 검색 결과가 없어요.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.route('**/api/artists/kr-iu/songs?**', route => route.fulfill({ status: 502, json: { error: '연결 실패 테스트' } }));
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await expect(page.getByText('연결 실패 테스트')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeVisible();
});

test('board export contains placements and import restores a validated file', async ({ page }) => {
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await page.getByRole('button', { name: '아이유 A 티어로 이동' }).click();
  await page.getByRole('button', { name: '밤편지 대표곡으로 선택', exact: true }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await page.locator('.download-menu summary').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '저장 파일 내보내기' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('my-tier.json');
  const file = await download.path(); expect(file).toBeTruthy();
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(page.getByTestId('tier-A').locator('[data-artist-id="kr-iu"]')).toHaveCount(0);
  await page.locator('input[type="file"]').setInputFiles(file!);
  await expect(page.getByTestId('tier-A').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await expect(page.getByRole('button', { name: '밤편지 대표곡에서 제거' })).toBeVisible();
});

test('mobile layout stays within the viewport and modal tier selection works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: '좋아하는 가수, 나만의 티어로.' })).toBeVisible();
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await page.getByRole('button', { name: '아이유 F 티어로 이동' }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await expect(page.getByTestId('tier-F').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
});

test('artists in the same tier can be reordered by dragging', async ({ page }) => {
  for (const name of ['아이유', '방탄소년단', '데이식스']) {
    await page.getByRole('button', { name: `${name} 곡 선택 및 티어 변경` }).click();
    await page.getByRole('button', { name: `${name} S 티어로 이동` }).click();
    await page.getByRole('button', { name: '선택 완료' }).click();
  }
  await page.getByTestId('tier-S').scrollIntoViewIfNeeded();
  const from = await page.getByTestId('tier-S').locator('[data-artist-id="kr-iu"] .artist-main').boundingBox();
  const to = await page.getByTestId('tier-S').locator('[data-artist-id="kr-day6"] .artist-main').boundingBox();
  await page.mouse.move(from!.x + 27, from!.y + 27);
  await page.mouse.down();
  await page.mouse.move(to!.x + 27, to!.y + 27, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => page.getByTestId('tier-S').locator('[data-artist-id]').evaluateAll(cards => cards.map(card => card.getAttribute('data-artist-id')))).toEqual(['kr-bts', 'kr-day6', 'kr-iu']);
});

test('touchscreen long-press moves a thumbnail into a tier', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await fixtureApi(page); await page.goto('/');
  await page.getByLabel('가수 이름 검색').fill('아이유');
  const card = page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' });
  await card.scrollIntoViewIfNeeded();
  const start = await card.boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start!.x + 25, y: start!.y + 25 }] });
  await page.waitForTimeout(280);
  await page.getByTestId('tier-F').scrollIntoViewIfNeeded();
  const target = await page.getByTestId('tier-F').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: target!.x + 110, y: target!.y + 40 }] });
  await page.waitForTimeout(100);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByTestId('tier-F').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
  await context.close();
});
