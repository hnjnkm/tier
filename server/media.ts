import { EnvHttpProxyAgent, fetch as proxyFetch } from 'undici';
import { createMediaService as createSharedMediaService, DataError, type JsonFetcher, type SongCatalogFetcher } from '../src/media';
import type { Portrait } from '../src/types';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export { artistFromMusicBrainz, chooseITunesArtist, songsFromITunes, parseSongIds, DataError } from '../src/media';
export type { JsonFetcher, MediaService } from '../src/media';

const agent = new EnvHttpProxyAgent();

export const fetchJson: JsonFetcher = async url => {
  try {
    const response = await proxyFetch(url, {
      dispatcher: agent,
      headers: { 'User-Agent': 'my-tier/0.1 (+https://github.com/hnjnkm/tier)', Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new DataError(`데이터 제공처에서 응답하지 않았어요. 잠시 후 다시 시도해 주세요.`, response.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_UNAVAILABLE', response.status === 429 ? 429 : 502);
    return await response.json();
  } catch (error) {
    if (error instanceof DataError) throw error;
    throw new DataError('외부 음악 데이터를 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
};

export function createMediaService(request: JsonFetcher = fetchJson, portraits?: Record<string, Portrait>, loadCatalog?: SongCatalogFetcher) {
  return createSharedMediaService(request, portraits, loadCatalog ?? (async id => {
    if (!/^kr-[a-z0-9-]+$/.test(id)) throw new DataError('이 아티스트의 YouTube Music 목록을 준비 중이에요.', 'CATALOG_UNAVAILABLE', 503);
    try { return JSON.parse(await readFile(resolve('public/music', `${id}.json`), 'utf8')); }
    catch { throw new DataError('이 아티스트의 YouTube Music 목록을 갱신 중이에요.', 'CATALOG_UNAVAILABLE', 503); }
  }));
}
