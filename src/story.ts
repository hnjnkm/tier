import { imageUrl } from './api';
import { SITE } from './site';
import type { Artist, Portrait, Song } from './types';

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
export const STORY_PAGE_SIZE = 4;

export function fitStoryText(context: CanvasRenderingContext2D, text: string, width: number) {
  const line = text.replace(/\s+/g, ' ').trim();
  if (context.measureText(line).width <= width) return line;
  const characters = Array.from(line);
  while (characters.length && context.measureText(`${characters.join('')}…`).width > width) characters.pop();
  return `${characters.join('')}…`;
}

async function loadPortrait(portrait: Portrait | undefined, signal: AbortSignal): Promise<HTMLImageElement | null> {
  if (!portrait) return null;
  const source = portrait.localPath ? `${import.meta.env.BASE_URL}${portrait.localPath}` : imageUrl(portrait.url);
  return new Promise((resolve, reject) => {
    const photo = new Image();
    if (new URL(source, location.href).origin !== location.origin) photo.crossOrigin = 'anonymous';
    const finish = (image: HTMLImageElement | null) => {
      clearTimeout(timer); signal.removeEventListener('abort', abort);
      photo.onload = null; photo.onerror = null;
      resolve(image);
    };
    const abort = () => { finish(null); photo.src = ''; reject(signal.reason); };
    const timer = window.setTimeout(() => finish(null), 8000);
    photo.onload = () => finish(photo.naturalWidth && photo.naturalHeight ? photo : null);
    photo.onerror = () => finish(null);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    photo.src = source;
  });
}

export async function renderStory({ artists, favorites, portraits, collection, pageIndex, pageCount, signal }: {
  artists: Artist[]; favorites: Record<string, Song[]>; portraits: Record<string, Portrait>;
  collection: 'korean' | 'global'; pageIndex: number; pageCount: number; signal: AbortSignal;
}): Promise<{ blob: Blob; missingPhotos: string[] }> {
  if (!artists.length || artists.length > STORY_PAGE_SIZE) throw new Error('스토리에 넣을 아티스트를 확인해 주세요.');
  await document.fonts.load('400 44px "Pretendard Variable"');
  if (!document.fonts.check('400 44px "Pretendard Variable"')) throw new Error('글꼴을 불러오지 못했어요. 다시 시도해 주세요.');
  const photos = await Promise.all(artists.map(artist => loadPortrait(portraits[artist.id], signal)));
  signal.throwIfAborted();
  const canvas = document.createElement('canvas');
  canvas.width = STORY_WIDTH; canvas.height = STORY_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('이미지를 만들 수 없어요. 다른 브라우저에서 시도해 주세요.');
  context.fillStyle = '#fafafa'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = 'top';
  const text = (value: string, x: number, y: number, size: number, width: number, color = '#1c1c1c') => {
    context.font = `400 ${size}px "Pretendard Variable", sans-serif`;
    context.fillStyle = color;
    context.fillText(fitStoryText(context, value, width), x, y);
  };
  const portrait = (index: number, x: number, y: number, size: number) => {
    const photo = photos[index];
    if (photo) {
      // Fit the existing profile into a square without cutting off faces.
      const scale = Math.min(size / photo.naturalWidth, size / photo.naturalHeight);
      const width = photo.naturalWidth * scale, height = photo.naturalHeight * scale;
      context.fillStyle = '#efefed'; context.fillRect(x, y, size, size);
      context.drawImage(photo, x + (size - width) / 2, y + (size - height) / 2, width, height);
    } else {
      context.fillStyle = '#efefed'; context.fillRect(x, y, size, size);
      context.textAlign = 'center'; text(artists[index].name, x + size / 2, y + size / 2 - 18, 32, size - 24, '#737373');
      context.textAlign = 'left';
    }
  };
  text('S', 88, 238, 60, 64);
  text('나의 최애', 164, 238, 60, 820);
  text(collection === 'global' ? '해외 아티스트' : '국내 아티스트', 88, 326, 30, 904, '#737373');
  context.strokeStyle = '#dcdcdc'; context.lineWidth = 1;
  context.beginPath(); context.moveTo(88, 396); context.lineTo(992, 396); context.stroke();
  if (artists.length === 1) {
    portrait(0, 300, 478, 480);
    context.textAlign = 'center';
    text(artists[0].name, 540, 1014, 52, 904);
    (favorites[artists[0].id] ?? []).slice(0, 3).forEach((song, index) => text(song.title, 540, 1108 + index * 56, 34, 904, '#555555'));
    context.textAlign = 'left';
  } else {
    const rowHeight = 270, start = 456 + (4 - artists.length) * 90;
    artists.forEach((artist, index) => {
      const y = start + index * rowHeight;
      portrait(index, 88, y, 208);
      text(artist.name, 336, y + 6, 42, 656);
      (favorites[artist.id] ?? []).slice(0, 3).forEach((song, songIndex) => text(song.title, 336, y + 76 + songIndex * 44, 30, 656, '#555555'));
    });
  }
  context.beginPath(); context.moveTo(88, 1646); context.lineTo(992, 1646); context.stroke();
  const address = new URL(SITE.url);
  text(`${address.hostname}${address.pathname.replace(/\/$/, '')}`, 88, 1682, 26, 780, '#737373');
  if (pageCount > 1) { context.textAlign = 'right'; text(`${pageIndex + 1} / ${pageCount}`, 992, 1682, 26, 100, '#737373'); }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('이미지 저장에 실패했어요. 다시 시도해 주세요.')), 'image/png'));
  signal.throwIfAborted();
  return { blob, missingPhotos: artists.filter((_, index) => !photos[index]).map(artist => artist.name) };
}
