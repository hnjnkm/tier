import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const domestic = ['kr-iu', 'kr-roy-kim', 'kr-naul', 'kr-park-hyoshin', 'kr-kim-bumsoo'];
const longTitle = 'Prime Time (Remix) (With ODEE, CHANGMO, Hash Swan, Dok2) '.repeat(4);

async function seed(page: Page, ids = domestic, collection: 'korean' | 'global' = 'korean') {
  await page.addInitScript(({ ids, collection, longTitle }) => {
    const key = collection === 'global' ? 'my-tier.board.global.v1' : 'my-tier.board.v1';
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, collection, title: '내 음악 취향', customArtists: [],
      tiers: { S: ids, A: [], B: [], C: [], D: [], E: [], F: [] },
      favorites: { [ids[0]]: [{ id: 'youtube:story000001', title: longTitle, artistName: '아이유', artistId: `UC${'a'.repeat(22)}`, album: '선택한 앨범', locale: 'ko-KR' }, { id: 'youtube:story000002', title: '밤편지', artistName: '아이유', artistId: `UC${'a'.repeat(22)}`, album: '선택한 앨범', locale: 'ko-KR' }] } }));
    const original = CanvasRenderingContext2D.prototype.fillText;
    (window as any).storyText = [];
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y) { (window as any).storyText.push({ text, width: this.measureText(text).width, x, y, font: this.font }); original.call(this, text, x, y); };
  }, { ids, collection, longTitle });
}

async function openStory(page: Page) {
  await page.getByRole('button', { name: '스토리로 공유', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '스토리로 공유', exact: true });
  await expect(dialog.locator('.story-preview > img')).toBeVisible();
  await expect(dialog.getByRole('link', { name: '이미지 저장', exact: true })).toHaveAttribute('aria-disabled', 'false');
  return dialog;
}

test('desktop exports real 1080×1920 PNGs with portraits and ellipsis, includes every S artist across pages and preserves the board', async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); });
  await page.goto('./');
  const saved = await page.evaluate(() => localStorage.getItem('my-tier.board.v1'));
  const dialog = await openStory(page);
  await expect(dialog.getByRole('button', { name: '공유', exact: true })).toHaveCount(0);
  await expect(dialog.locator('.story-preview img')).toHaveAttribute('alt', /아이유, 로이킴, 나얼, 박효신/);
  const texts = await page.evaluate(() => (window as any).storyText as { text: string; width: number; font: string }[]);
  expect(texts.map(item => item.text)).toContain('밤편지');
  const clipped = texts.find(item => item.text.startsWith('Prime Time'))!;
  expect(clipped.text).toMatch(/…$/); expect(clipped.width).toBeLessThanOrEqual(656);
  expect(texts.every(item => item.font.includes('Pretendard Variable'))).toBe(true);
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('link', { name: '이미지 저장', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('favorites-korean-1.png');
  const png = await readFile((await download.path())!);
  const metadata = await sharp(png).metadata();
  expect([metadata.format, metadata.width, metadata.height]).toEqual(['png', 1080, 1920]);
  const profile = await sharp(png).extract({ left: 100, top: 468, width: 184, height: 184 }).stats();
  expect(profile.channels.some(channel => channel.stdev > 10)).toBe(true);
  const oldUrl = await dialog.locator('.story-preview img').getAttribute('src');
  await dialog.getByRole('button', { name: '다음 스토리 이미지' }).click();
  await expect(dialog.locator('.story-preview img')).toHaveAttribute('alt', /김범수/);
  await expect(dialog.getByRole('button', { name: '다음 스토리 이미지' })).toBeDisabled();
  expect(await page.evaluate(async url => { try { await fetch(url!); return false; } catch { return true; } }, oldUrl)).toBe(true);
  const secondPromise = page.waitForEvent('download');
  await dialog.getByRole('link', { name: '이미지 저장', exact: true }).click();
  expect((await secondPromise).suggestedFilename()).toBe('favorites-korean-2.png');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '스토리로 공유', exact: true })).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('my-tier.board.v1'))).toBe(saved);
});

test('mobile file sharing sends the prepared PNG within a tap and does not claim Instagram was posted', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await seed(page, ['kr-iu']);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: ({ files }: ShareData) => files?.length === 1 && files[0].type === 'image/png' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ files }: ShareData) => {
      (window as any).sharedStory = { active: navigator.userActivation.isActive, name: files![0].name, type: files![0].type, bytes: [...new Uint8Array(await files![0].arrayBuffer()).slice(0, 24)] };
    } });
  });
  await page.goto('./');
  const dialog = await openStory(page);
  await expect(dialog.locator('.story-touch-help')).toBeVisible();
  await dialog.getByRole('button', { name: '공유', exact: true }).tap();
  await expect(dialog.getByRole('status')).toHaveText('공유 메뉴로 이미지를 전달했습니다.');
  const shared = await page.evaluate(() => (window as any).sharedStory);
  expect(shared.active).toBe(true); expect(shared.name).toBe('favorites-korean-1.png'); expect(shared.type).toBe('image/png');
  const bytes = Buffer.from(shared.bytes);
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1080, 1920]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await context.close();
});

test('share cancellation stays quiet, rejection offers saving, and retries use the same valid file', async ({ page }) => {
  await seed(page, ['kr-iu']);
  await page.addInitScript(() => {
    (window as any).shareAttempt = 0;
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', { value: async () => { const attempt = ++(window as any).shareAttempt; if (attempt < 3) throw new DOMException('Unavailable', attempt === 1 ? 'AbortError' : 'NotAllowedError'); }, configurable: true });
  });
  await page.goto('./');
  const dialog = await openStory(page), share = dialog.getByRole('button', { name: '공유', exact: true });
  await share.click();
  await expect(share).toBeEnabled(); await expect(dialog.locator('.story-feedback')).toHaveCount(0);
  await share.click();
  await expect(dialog.locator('.story-feedback')).toContainText('이미지 저장 후 Instagram');
  await expect(dialog.getByRole('link', { name: '이미지 저장', exact: true })).toHaveAttribute('aria-disabled', 'false');
  await share.click();
  await expect(dialog.locator('.story-feedback')).toHaveText('공유 메뉴로 이미지를 전달했습니다.');
});

test('missing portraits remain exportable and can be recovered before sharing', async ({ page }) => {
  await seed(page, ['kr-iu']);
  await page.route('**/portraits/kr-iu.*', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('./');
  const dialog = await openStory(page);
  await expect(dialog.locator('.story-warning')).toContainText('아이유 사진을 불러오지 못해 이름으로 표시');
  const downloadPromise = page.waitForEvent('download'); await dialog.getByRole('link', { name: '이미지 저장', exact: true }).click();
  const png = await readFile((await (await downloadPromise).path())!);
  expect((await sharp(png).metadata()).width).toBe(1080);
  await page.unroute('**/portraits/kr-iu.*');
  await dialog.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(dialog.locator('.story-warning')).toHaveCount(0);
  await expect(dialog.locator('.story-preview img')).toBeVisible();
});

test('international favorites export under the right collection and an empty S tier prompts adding artists', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('button', { name: '스토리로 공유', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('favorites-briefing').getByText('S티어에 최애 아티스트를 추가해 주세요.')).toBeVisible();
  await seed(page, ['global-taylor-swift'], 'global');
  await page.goto('./?chart=global');
  const dialog = await openStory(page);
  await expect(dialog.locator('.story-preview img')).toHaveAttribute('alt', /Taylor Swift/);
  const texts = await page.evaluate(() => (window as any).storyText.map((item: any) => item.text));
  expect(texts).toContain('해외 아티스트'); expect(texts).toContain('Taylor Swift');
  const downloadPromise = page.waitForEvent('download'); await dialog.getByRole('link', { name: '이미지 저장', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('favorites-global-1.png');
});

test('story dialog fits a narrow phone and small landscape view while retaining image saving', async ({ page }) => {
  await seed(page);
  await page.goto('./');
  const dialog = await openStory(page);
  for (const [width, height] of [[320, 640], [667, 375]]) {
    await page.setViewportSize({ width, height });
    const rect = await dialog.boundingBox();
    expect(rect!.width).toBeLessThanOrEqual(width); expect(rect!.height).toBeLessThanOrEqual(height);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await dialog.getByRole('link', { name: '이미지 저장', exact: true }).scrollIntoViewIfNeeded();
    await expect(dialog.getByRole('link', { name: '이미지 저장', exact: true })).toBeVisible();
  }
});
