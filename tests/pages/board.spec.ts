import { test, expect, type Page } from '@playwright/test';

const artistId = 409076846;
const titles = ['Love wins all', 'Through the Night', 'Palette', 'Good Day'];

async function providers(page: Page) {
  await page.route('https://en.wikipedia.org/w/api.php?**', route => {
    expect(new URL(route.request().url()).searchParams.get('origin')).toBe('*');
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { query: { pages: { 1: { title: 'IU (singer)', fullurl: 'https://en.wikipedia.org/wiki/IU', thumbnail: { source: 'https://upload.wikimedia.org/iu.jpg' } } } } } });
  });
  await page.route('https://upload.wikimedia.org/iu.jpg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="pink"/></svg>' }));
  await page.route('https://image.bugsm.co.kr/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="pink"/></svg>' }));
  await page.route('https://itunes.apple.com/search?**', route => {
    const url = new URL(route.request().url());
    const results = url.searchParams.get('entity') === 'musicArtist'
      ? [{ wrapperType: 'artist', artistType: 'Artist', artistName: 'IU', artistId, primaryGenreName: 'K-Pop' }]
      : [...titles.map((title, index) => ({ wrapperType: 'track', kind: 'song', trackId: index + 1, trackName: title, artistName: 'IU', artistId })).filter(track => url.searchParams.get('term') !== '밤편지' || track.trackName === 'Through the Night'), { wrapperType: 'track', kind: 'song', trackId: 999, trackName: 'Unrelated', artistName: 'Other', artistId: 1 }];
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { results } });
  });
  await page.route('https://musicbrainz.org/ws/2/artist/**', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { artists: [{ id: '12345678-1234-1234-1234-123456789abc', name: '새가수', type: 'Person', gender: 'female', country: 'KR' }] } }));
}

test('Pages subpath loads assets and direct providers, then persists three songs and tiers', async ({ page }) => {
  await providers(page);
  const localApiRequests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) localApiRequests.push(request.url()); });
  await page.goto('./');
  await expect(page.getByRole('link', { name: 'my tier. 홈' })).toHaveAttribute('href', '/tier/');
  expect(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px "Pretendard Variable"'); })).toBe(true);
  const photo = page.getByTestId('artist-pool').locator('[data-artist-id="kr-iu"] img');
  await expect(photo).toHaveAttribute('src', /^https:\/\/image\.bugsm\.co\.kr\/artist\/images\/500\//);
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await expect(page.getByRole('link', { name: '사진 출처 · 벅스' })).toHaveAttribute('href', /^https:\/\/music\.bugs\.co\.kr\/artist\/\d+$/);
  await expect(page.getByRole('button', { name: 'Unrelated 대표곡으로 선택', exact: true })).toHaveCount(0);
  await page.getByLabel('곡 제목 검색').fill('밤편지');
  await expect(page.getByRole('button', { name: 'Through the Night 대표곡으로 선택', exact: true })).toBeVisible();
  await page.getByLabel('곡 제목 검색').fill('');
  for (const title of titles.slice(0, 3)) await page.getByRole('button', { name: `${title} 대표곡으로 선택`, exact: true }).click();
  await page.getByRole('button', { name: 'Good Day 대표곡으로 선택', exact: true }).click();
  await expect(page.locator('.dialog-notice')).toContainText('최대 3개');
  await page.getByRole('button', { name: '아이유 S 티어로 이동' }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await page.reload();
  await expect(page.getByTestId('tier-S').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await expect(page.getByLabel('선택한 대표곡').locator('.song-slot.filled')).toHaveCount(3);
  expect(localApiRequests).toEqual([]);
});

test('genre filters apply only to discovery, and idol member searches resolve to the group', async ({ page }) => {
  await providers(page);
  await page.goto('./');
  await page.getByLabel('가수 이름 검색').fill('정국');
  await expect(page.getByRole('button', { name: '방탄소년단 곡 선택 및 티어 변경' })).toBeVisible();
  await expect(page.locator('[data-artist-id="kr-jung-kook"]')).toHaveCount(0);
  await page.getByRole('button', { name: '방탄소년단 곡 선택 및 티어 변경' }).click();
  await page.getByRole('button', { name: '방탄소년단 S 티어로 이동' }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await page.getByLabel('가수 이름 검색').fill('김나박이');
  await page.getByLabel('음악 장르 필터').selectOption('ballad');
  for (const name of ['김범수', '나얼', '박효신', '이수']) await expect(page.getByRole('button', { name: `${name} 곡 선택 및 티어 변경` })).toBeVisible();
  await page.getByLabel('음악 장르 필터').selectOption('hiphop');
  await expect(page.getByTestId('artist-pool').locator('.artist-card')).toHaveCount(0);
  await expect(page.getByTestId('tier-S').locator('[data-artist-id="kr-bts"]')).toHaveCount(1);
  await page.getByRole('button', { name: '검색 및 필터 초기화' }).click();
  await page.getByLabel('가수 이름 검색').fill('비와이');
  await page.getByLabel('음악 장르 필터').selectOption('hiphop');
  await expect(page.getByRole('button', { name: '비와이 곡 선택 및 티어 변경' })).toBeVisible();
});

test('Pages searches additional artists and reports provider failures with retry', async ({ page }) => {
  await providers(page);
  await page.goto('./');
  await page.getByLabel('가수 이름 검색').fill('새가수');
  await expect(page.getByRole('button', { name: '새가수 곡 선택 및 티어 변경' })).toBeVisible();
  await page.getByLabel('가수 이름 검색').fill('아이유');
  await page.route('https://itunes.apple.com/search?**', route => route.fulfill({ status: 429, headers: { 'access-control-allow-origin': '*' }, json: {} }));
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await expect(page.getByText('데이터 제공처에서 응답하지 않았어요. 잠시 후 다시 시도해 주세요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeVisible();
});

test('mobile genre controls fit the viewport and existing soloist selections survive a reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const saved = { version: 1, title: '기존 취향 보드', customArtists: [], tiers: { S: ['kr-jung-kook'], A: [], B: [], C: [], D: [], E: [], F: [] }, favorites: { 'kr-jung-kook': [{ id: 'itunes:1', title: '기존 대표곡', artistId: 1, artistName: 'Jung Kook', album: 'Saved album' }] } };
  await page.addInitScript(data => localStorage.setItem('my-tier.board.v1', JSON.stringify(data)), saved);
  await providers(page);
  await page.goto('./');
  await page.getByLabel('음악 장르 필터').selectOption('crossover');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByTestId('tier-S').locator('[data-artist-id="kr-jung-kook"]')).toHaveCount(1);
  await page.getByRole('button', { name: '정국 곡 선택 및 티어 변경' }).click();
  await expect(page.getByLabel('선택한 대표곡').locator('.song-slot.filled')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '기존 대표곡 대표곡에서 제거' })).toBeVisible();
});
