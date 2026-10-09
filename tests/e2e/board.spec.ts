import { test, expect, type Page } from '@playwright/test';

const songs = ['Love wins all', '밤편지', '팔레트', '좋은 날'].map((title, index) => ({ id: `itunes:${index + 1}`, title, artistName: '아이유', artistId: 409076846, album: '아이유 컬렉션', year: '2024', locale: 'ko-KR' }));

async function fixtureApi(page: Page) {
  await page.route('**/api/portraits?**', route => route.fulfill({ json: { portraits: {}, source: 'wikipedia' } }));
  await page.route('**/api/artists/search?**', route => route.fulfill({ json: { artists: [], source: 'musicbrainz' } }));
  await page.route('**/api/songs/localize?**', route => route.fulfill({ json: { songs: [], source: 'apple-music-kr' } }));
  await page.route('**/api/artists/*/songs?**', route => {
    const query = new URL(route.request().url()).searchParams.get('q') || '';
    return route.fulfill({ json: { songs: songs.filter(song => song.title.includes(query)), source: 'itunes' } });
  });
}

async function dragArtist(page: Page, artistId: string, target: string) {
  const card = page.locator(`[data-artist-id="${artistId}"] .artist-main`);
  await card.scrollIntoViewIfNeeded();
  const start = await card.boundingBox();
  await page.mouse.move(start!.x + 25, start!.y + 25);
  await page.mouse.down();
  await page.mouse.move(start!.x + 25, start!.y + 12, { steps: 4 });
  const destination = target === 'pool' ? page.locator('.artist-grid') : page.getByTestId(`tier-${target}`).locator('.tier-content');
  await destination.evaluate(node => node.scrollIntoView({ block: 'center' }));
  const end = await destination.boundingBox();
  await page.mouse.move(end!.x + 25, end!.y + 27, { steps: 12 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => { await fixtureApi(page); await page.goto('/'); });

test('artist expansion adds fifty cards and changing filters resets the visible collection', async ({ page }) => {
  const cards = page.locator('.artist-grid [data-artist-id]');
  await expect(cards).toHaveCount(50);
  await page.getByRole('button', { name: /^더 보기/ }).click();
  await expect(cards).toHaveCount(100);
  await page.getByRole('button', { name: /^더 보기/ }).click();
  await expect(cards).toHaveCount(150);
  await page.getByRole('button', { name: '여자', exact: true }).click();
  await expect(cards).toHaveCount(50);
  await page.getByLabel('가수 이름 검색').fill('에스지워너비');
  await expect(cards).toHaveCount(0);
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.locator('.artist-name')).toHaveText('SG워너비');
  await page.getByLabel('가수 이름 검색').fill('SG WANNABE');
  await expect(cards.locator('.artist-name')).toHaveText('SG워너비');
  await page.getByLabel('가수 이름 검색').fill('');
  await expect(cards).toHaveCount(50);
});

test('artist thumbnails retain their size when moved into a tier on desktop and mobile', async ({ page }) => {
  await page.getByLabel('가수 이름 검색').fill('에스지워너비');
  const avatar = page.locator('[data-artist-id="kr-sgwannabe"] .avatar');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await avatar.boundingBox();
    expect(before!.width).toBe(before!.height);
    await page.getByRole('button', { name: 'SG워너비 곡 선택 및 티어 변경' }).click();
    await page.getByRole('button', { name: 'SG워너비 S 티어로 이동' }).click();
    await page.getByRole('button', { name: '선택 완료' }).click();
    const after = await page.getByTestId('tier-S').locator('[data-artist-id="kr-sgwannabe"] .avatar').boundingBox();
    expect(after!.width).toBe(before!.width);
    expect(after!.height).toBe(before!.height);
    const summary = await page.getByTestId('favorites-briefing').locator('.avatar').boundingBox();
    expect(summary!.width).toBe(before!.width);
    expect(summary!.height).toBe(before!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole('button', { name: 'SG워너비 곡 선택 및 티어 변경' }).click();
    await page.getByRole('button', { name: '보관함', exact: true }).click();
    await page.getByRole('button', { name: '선택 완료' }).click();
  }
});

test('artist search and gender/type filters work across the curated collection', async ({ page }) => {
  await page.getByRole('button', { name: '여자', exact: true }).click();
  await expect(page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' })).toBeVisible();
  await expect(page.getByRole('button', { name: '방탄소년단 곡 선택 및 티어 변경' })).toHaveCount(0);
  await page.getByLabel('가수 이름 검색').fill('악동뮤지션');
  await expect(page.getByRole('button', { name: 'AKMU 곡 선택 및 티어 변경' })).toHaveCount(0);
  await page.getByRole('button', { name: '혼성', exact: true }).click();
  await expect(page.getByRole('button', { name: 'AKMU 곡 선택 및 티어 변경' })).toBeVisible();
  await page.getByLabel('솔로 및 그룹 필터').selectOption('solo');
  await expect(page.getByRole('button', { name: 'AKMU 곡 선택 및 티어 변경' })).toHaveCount(0);
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
  await expect(page.getByTestId('tier-S').locator('[data-artist-id="kr-iu"] .artist-main')).toBeFocused();
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

test('mouse dragging reaches every tier when S already contains an artist', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await page.getByRole('button', { name: '아이유 S 티어로 이동' }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  const placements = [['A', 'kr-kim-bumsoo'], ['B', 'kr-naul'], ['C', 'kr-park-hyoshin'], ['D', 'kr-isu'], ['E', 'kr-bts'], ['F', 'kr-day6']];
  for (const [tier, id] of placements) {
    await dragArtist(page, id, tier);
    await expect(page.getByTestId(`tier-${tier}`).locator(`[data-artist-id="${id}"]`)).toHaveCount(1);
  }
  await expect(page.getByTestId('tier-S').locator('[data-artist-id]')).toHaveCount(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('mouse dragging moves between tiers and into an occupied row, then back to the pool', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [name, tier] of [['아이유', 'S'], ['김범수', 'F']]) {
    await page.getByRole('button', { name: `${name} 곡 선택 및 티어 변경` }).click();
    await page.getByRole('button', { name: `${name} ${tier} 티어로 이동` }).click();
    await page.getByRole('button', { name: '선택 완료' }).click();
  }
  for (const tier of ['A', 'B', 'C', 'D', 'E', 'F', 'S']) {
    await dragArtist(page, 'kr-iu', tier);
    await expect(page.getByTestId(`tier-${tier}`).locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
    await expect(page.locator('.tier-board [data-artist-id="kr-iu"]')).toHaveCount(1);
  }
  await dragArtist(page, 'kr-iu', 'pool');
  await expect(page.getByTestId('artist-pool').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
  await expect(page.locator('.tier-board [data-artist-id="kr-iu"]')).toHaveCount(0);
});

test('dropping outside the board returns an artist to the pool and preserves favorite songs', async ({ page }) => {
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await page.getByRole('button', { name: '아이유 S 티어로 이동' }).click();
  await page.getByRole('button', { name: '밤편지 대표곡으로 선택', exact: true }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await expect(page.getByTestId('favorites-briefing')).toContainText('밤편지');
  const card = page.getByTestId('tier-S').locator('.artist-main');
  await card.evaluate(node => node.scrollIntoView({ block: 'center' }));
  const start = await card.boundingBox();
  await page.mouse.move(start!.x + 25, start!.y + 25);
  await page.mouse.down();
  await page.mouse.move(start!.x + 25, start!.y + 12, { steps: 4 });
  const outside = page.locator('.board-footnote');
  await outside.evaluate(node => node.scrollIntoView({ block: 'center' }));
  const end = await outside.boundingBox();
  await page.mouse.move(end!.x + 30, end!.y + end!.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.tier-board [data-artist-id="kr-iu"]')).toHaveCount(0);
  await expect(page.getByTestId('artist-pool').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
  await expect(page.getByTestId('favorites-briefing')).toContainText('S티어에 최애 아티스트를 추가해 주세요.');
  await page.reload();
  await expect(page.locator('.tier-board [data-artist-id="kr-iu"]')).toHaveCount(0);
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await expect(page.getByRole('button', { name: '밤편지 대표곡에서 제거' })).toBeVisible();
});

test('S-tier briefing follows favorites and placements, stays independent of filters and survives reload', async ({ page }) => {
  const briefing = page.getByTestId('favorites-briefing');
  await expect(briefing).toContainText('S티어에 최애 아티스트를 추가해 주세요.');
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await page.getByRole('button', { name: '아이유 S 티어로 이동' }).click();
  for (const title of ['Love wins all', '밤편지', '팔레트']) await page.getByRole('button', { name: `${title} 대표곡으로 선택`, exact: true }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await expect(briefing.locator('.favorite-songs > span')).toHaveText(['Love wins all', '밤편지', '팔레트']);
  await page.getByRole('button', { name: '방탄소년단 곡 선택 및 티어 변경' }).click();
  await page.getByRole('button', { name: '방탄소년단 S 티어로 이동' }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await expect(briefing.locator('.favorite-entry')).toHaveCount(2);
  await expect(briefing.getByRole('button', { name: '방탄소년단 S티어 대표곡 편집' })).toContainText('곡 선택');
  await page.getByRole('button', { name: 'DAY6 곡 선택 및 티어 변경' }).click();
  await page.getByRole('button', { name: 'DAY6 A 티어로 이동' }).click();
  await page.getByRole('button', { name: '좋은 날 대표곡으로 선택', exact: true }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await expect(briefing).not.toContainText('DAY6');
  await expect(briefing).not.toContainText('좋은 날');
  await page.getByLabel('음악 장르 필터').selectOption('hiphop');
  await page.getByLabel('가수 이름 검색').fill('비와이');
  await expect(briefing.locator('.favorite-entry')).toHaveCount(2);
  await page.reload();
  await expect(briefing.locator('.favorites-heading')).toContainText('2명 · 3곡');
  await briefing.getByRole('button', { name: '아이유 S티어 대표곡 편집' }).click();
  await page.getByRole('button', { name: '밤편지 대표곡에서 제거' }).click();
  await expect(briefing.locator('.favorite-songs > span')).toHaveText(['Love wins all', '팔레트']);
  await page.getByRole('button', { name: '아이유 A 티어로 이동' }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await expect(briefing.locator('.favorite-entry')).toHaveCount(1);
  await expect(briefing).not.toContainText('팔레트');
  await briefing.getByRole('button', { name: '방탄소년단 S티어 대표곡 편집' }).click();
  await page.getByRole('button', { name: '보관함', exact: true }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await expect(briefing).toContainText('S티어에 최애 아티스트를 추가해 주세요.');
});

test('empty favorites invite adding an artist directly to S and support cancelling the picker', async ({ page }) => {
  const briefing = page.getByTestId('favorites-briefing');
  await expect(briefing.locator('.favorite-entry')).toHaveCount(0);
  await page.getByLabel('음악 장르 필터').selectOption('hiphop');
  await page.getByRole('button', { name: '아티스트 추가', exact: true }).click();
  await expect(page.getByLabel('가수 이름 검색')).toBeFocused();
  await expect(page.getByLabel('음악 장르 필터')).toHaveValue('all');
  await expect(page.getByText('최애로 추가할 아티스트를 선택해 주세요.')).toBeVisible();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByLabel('가수 이름 검색').fill('로이킴');
  await page.getByRole('button', { name: '로이킴 곡 선택 및 티어 변경' }).click();
  await expect(page.getByRole('button', { name: '로이킴 S 티어로 이동' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '선택 완료' }).click();
  await briefing.getByRole('button', { name: '아티스트 추가', exact: true }).click();
  await page.getByLabel('가수 이름 검색').fill('아이유');
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await expect(page.getByRole('button', { name: '아이유 S 티어로 이동' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '밤편지 대표곡으로 선택', exact: true }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await expect(briefing).toContainText('아이유'); await expect(briefing).toContainText('밤편지');
  await expect(briefing.getByRole('button', { name: '아티스트 추가', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('tier-S').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
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
  await expect(page.getByRole('heading', { name: '나의 아티스트 티어' })).toBeVisible();
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await page.getByRole('button', { name: '아이유 F 티어로 이동' }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await expect(page.getByTestId('tier-F').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
});

test('artists in the same tier can be reordered by dragging', async ({ page }) => {
  for (const name of ['아이유', '방탄소년단', 'DAY6']) {
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
  const first = await page.getByTestId('tier-S').locator('[data-artist-id="kr-bts"] .artist-main').boundingBox();
  await page.mouse.move(first!.x + 25, first!.y + 27);
  await page.mouse.down();
  await page.mouse.move(first!.x + 35, first!.y + 27, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => page.getByTestId('tier-S').locator('[data-artist-id]').evaluateAll(cards => cards.map(card => card.getAttribute('data-artist-id')))).toEqual(['kr-bts', 'kr-day6', 'kr-iu']);
});

test('keyboard dragging can change tiers and Escape keeps the existing placement', async ({ page }) => {
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await page.getByRole('button', { name: '아이유 S 티어로 이동' }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await page.getByRole('button', { name: '아이유 끌어서 이동' }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.overlay-card')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('tier-A')).toHaveClass(/drop-active/);
  await page.keyboard.press('Space');
  await expect(page.getByTestId('tier-A').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
  await page.getByRole('button', { name: '아이유 끌어서 이동' }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.overlay-card')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('tier-B')).toHaveClass(/drop-active/);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('tier-A').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
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
  await expect(page.locator('.overlay-card')).toBeVisible();
  await page.getByTestId('tier-F').scrollIntoViewIfNeeded();
  const target = await page.getByTestId('tier-F').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: target!.x + 110, y: target!.y + 40 }] });
  await expect(page.getByTestId('tier-F')).toHaveClass(/drop-active/);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByTestId('tier-F').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
  // Both rows fit on screen. Set the viewport before touching so a synthetic
  // mid-gesture page scroll cannot change Chromium's touch coordinates.
  await page.getByTestId('tier-A').evaluate(node => node.closest('.board-section')!.scrollIntoView({ block: 'start' }));
  const placed = await page.getByTestId('tier-F').locator('.artist-main').boundingBox();
  const nextTier = await page.getByTestId('tier-A').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: placed!.x + 25, y: placed!.y + 25 }] });
  await expect(page.locator('.overlay-card')).toBeVisible();
  for (let step = 1; step <= 20; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
      x: placed!.x + 25 + (nextTier!.x + 110 - placed!.x - 25) * step / 20,
      y: placed!.y + 25 + (nextTier!.y + 40 - placed!.y - 25) * step / 20,
    }] });
  }
  await expect(page.getByTestId('tier-A')).toHaveClass(/drop-active/);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByTestId('tier-A').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
  await expect(page.getByTestId('tier-F').locator('[data-artist-id="kr-iu"]')).toHaveCount(0);
  await page.getByTestId('tier-A').evaluate(node => node.closest('.board-section')!.scrollIntoView({ block: 'start' }));
  const inA = await page.getByTestId('tier-A').locator('.artist-main').boundingBox();
  const outside = await page.locator('.board-heading').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: inA!.x + 25, y: inA!.y + 25 }] });
  await expect(page.locator('.overlay-card')).toBeVisible();
  for (let step = 1; step <= 20; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
      x: inA!.x + 25 + (outside!.x + 120 - inA!.x - 25) * step / 20,
      y: inA!.y + 25 + (outside!.y + outside!.height / 2 - inA!.y - 25) * step / 20,
    }] });
  }
  await expect(page.locator('.drop-active')).toHaveCount(0);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByTestId('tier-A').locator('[data-artist-id="kr-iu"]')).toHaveCount(0);
  await expect(page.getByTestId('artist-pool').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
  await context.close();
});
