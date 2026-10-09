import { test, expect, type Page } from '@playwright/test';

const artistId = 409076846;
const titles = ['Love wins all', 'Through the Night', 'Palette', 'Good Day'];
const koreanTitles = ['Love wins all', '밤편지', '팔레트', '좋은 날'];
const channelId = `UC${'a'.repeat(22)}`;

async function providers(page: Page) {
  await page.route('**/music/kr-iu.json', route => route.fulfill({ json: { source: 'youtube-music', artistId: 'kr-iu', channelId, updatedAt: '2026-10-10T00:00:00Z', complete: true,
    songs: koreanTitles.map((title, index) => ({ id: `youtube:video00000${index}`, title, artistName: '아이유', artistId: channelId, album: index < 2 ? '새 앨범' : 'Palette', albumId: index < 2 ? 'new-album' : 'old-album', trackNumber: index + 1, year: index < 2 ? '2026' : '2017', popularityRank: index, locale: 'ko-KR', url: `https://music.youtube.com/watch?v=video00000${index}` })) } }));
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
  await page.route('https://itunes.apple.com/lookup?**', route => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('country')).toBe('KR'); expect(url.searchParams.get('lang')).toBe('ko_kr');
    const ids = url.searchParams.get('id')!.split(',').map(Number);
    const results = koreanTitles.map((trackName, index) => ({ wrapperType: 'track', kind: 'song', trackId: index + 1, trackName, artistName: '아이유', artistId, collectionName: '아이유 컬렉션' })).filter(track => ids.includes(track.trackId));
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { results } });
  });
  await page.route('https://musicbrainz.org/ws/2/artist/**', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { artists: [{ id: '12345678-1234-1234-1234-123456789abc', name: '새가수', type: 'Person', gender: 'female', country: 'KR' }] } }));
}

test('existing English Roy Kim selections migrate to official Korean titles without losing choices', async ({ page }) => {
  await providers(page);
  const royArtistId = 572430917;
  const tracks = [
    [1570375886, 'Only Then', '그때 헤어지면 돼'],
    [1773218828, 'If You Ask Me What Love Is', '내게 사랑이 뭐냐고 물어본다면'],
    [639483987, 'Bom Bom Bom', '봄봄봄'],
    [1848023874, 'No Words Can Say', '달리 표현할 수 없어요'],
  ] as const;
  const selected = [tracks[1], tracks[3]];
  await page.route('**/music/kr-roy-kim.json', route => route.fulfill({ json: { source: 'youtube-music', artistId: 'kr-roy-kim', channelId, updatedAt: '2026-10-10T00:00:00Z', complete: true,
    songs: tracks.map(([, , title], index) => ({ id: `youtube:roykim0000${index}`, title, artistName: '로이킴', artistId: channelId, album: title, locale: 'ko-KR', url: `https://music.youtube.com/watch?v=roykim0000${index}` })) } }));
  await page.addInitScript(({ selected, royArtistId }) => {
    if (localStorage.getItem('my-tier.board.v1')) return;
    localStorage.setItem('my-tier.board.v1', JSON.stringify({ version: 1, title: '나의 아티스트 티어', customArtists: [], tiers: { S: ['kr-roy-kim'], A: [], B: [], C: [], D: [], E: [], F: [] }, favorites: { 'kr-roy-kim': selected.map(([id, title]) => ({ id: `itunes:${id}`, title, artistId: royArtistId, artistName: 'Roy Kim', album: `${title} - Single` })) } }));
  }, { selected, royArtistId });
  await page.route('https://itunes.apple.com/search?**', route => {
    const url = new URL(route.request().url());
    const results = url.searchParams.get('entity') === 'musicArtist'
      ? [{ wrapperType: 'artist', artistType: 'Artist', artistName: 'Roy Kim', artistId: royArtistId, primaryGenreName: 'K-Pop' }]
      : tracks.map(([trackId, trackName]) => ({ wrapperType: 'track', kind: 'song', trackId, trackName, artistId: royArtistId, artistName: 'Roy Kim', collectionName: `${trackName} - Single` }));
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { results } });
  });
  await page.route('https://itunes.apple.com/lookup?**', route => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('country')).toBe('KR');
    const ids = url.searchParams.get('id')!.split(',').map(Number);
    const results = tracks.filter(([id]) => ids.includes(id)).map(([trackId, , trackName]) => ({ wrapperType: 'track', kind: 'song', trackId, trackName, artistId: royArtistId, artistName: '로이킴', collectionName: `${trackName} - Single` }));
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { results } });
  });
  await page.goto('./');
  await expect(page.getByTestId('favorites-briefing').locator('.favorite-songs > span')).toHaveText(selected.map(track => track[2]));
  await page.getByRole('button', { name: '로이킴 S티어 대표곡 편집' }).click();
  await expect(page.getByText('YouTube Music · 한국')).toBeVisible();
  await expect(page.getByRole('dialog')).not.toContainText('Roy Kim');
  for (const [, , title] of selected) await expect(page.getByRole('button', { name: `${title} 선택 해제`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '그때 헤어지면 돼 대표곡으로 선택', exact: true })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('my-tier.board.v1')!).favorites['kr-roy-kim']);
  expect(stored.map((song: { id: string }) => song.id)).toEqual(selected.map(track => `itunes:${track[0]}`));
  await page.getByRole('button', { name: '달리 표현할 수 없어요 선택 해제', exact: true }).click();
  await expect(page.getByLabel('선택한 대표곡').locator('.song-slot.filled')).toHaveCount(1);
  await page.getByRole('button', { name: '선택 완료' }).click();
  await page.reload();
  await expect(page.getByTestId('favorites-briefing').locator('.favorite-songs > span')).toHaveText(['내게 사랑이 뭐냐고 물어본다면']);
  await expect(page.getByTestId('tier-S').locator('[data-artist-id="kr-roy-kim"]')).toHaveCount(1);
});

test('Pages subpath loads assets and direct providers, then persists three songs and tiers', async ({ page }) => {
  await providers(page);
  const localApiRequests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) localApiRequests.push(request.url()); });
  await page.goto('./');
  await expect(page.getByRole('link', { name: 'my tier. 홈' })).toHaveAttribute('href', '/tier/');
  expect(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px "Pretendard Variable"') && document.fonts.check('16px "Instrument Serif"'); })).toBe(true);
  const photo = page.getByTestId('artist-pool').locator('[data-artist-id="kr-iu"] img');
  await expect(photo).toHaveAttribute('src', /^\/tier\/portraits\/kr-iu\.[a-f0-9]+\.webp$/);
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await expect(page.getByRole('link', { name: '사진 출처 · 벅스' })).toHaveAttribute('href', /^https:\/\/music\.bugs\.co\.kr\/artist\/\d+$/);
  await expect(page.getByRole('button', { name: 'Unrelated 대표곡으로 선택', exact: true })).toHaveCount(0);
  await page.getByLabel('곡 제목 검색').fill('밤편지');
  await expect(page.getByRole('button', { name: '밤편지 대표곡으로 선택', exact: true })).toBeVisible();
  await page.getByLabel('곡 제목 검색').fill('');
  for (const title of koreanTitles.slice(0, 3)) await page.getByRole('button', { name: `${title} 대표곡으로 선택`, exact: true }).click();
  await page.getByRole('button', { name: '좋은 날 대표곡으로 선택', exact: true }).click();
  await expect(page.locator('.dialog-notice')).toContainText('최대 3개');
  await page.getByRole('button', { name: '아이유 S 티어로 이동' }).click();
  await page.getByRole('button', { name: '선택 완료' }).click();
  await page.reload();
  await expect(page.getByTestId('tier-S').locator('[data-artist-id="kr-iu"]')).toHaveCount(1);
  await expect(page.getByTestId('favorites-briefing').locator('.favorite-songs > span')).toHaveText(koreanTitles.slice(0, 3));
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
  await page.route('**/music/kr-iu.json', route => route.fulfill({ status: 503, json: {} }));
  await page.getByRole('button', { name: '아이유 곡 선택 및 티어 변경' }).click();
  await expect(page.getByText('이 아티스트의 YouTube Music 목록을 갱신 중이에요.')).toBeVisible();
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
