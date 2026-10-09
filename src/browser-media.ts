import { createMediaService, DataError } from './media';

export function createBrowserApi(fetcher: typeof fetch = fetch) {
  const media = createMediaService(async original => {
    const url = new URL(original);
    // MediaWiki requires this parameter to enable anonymous cross-origin requests.
    if (['en.wikipedia.org', 'ko.wikipedia.org', 'www.wikidata.org'].includes(url.hostname)) url.searchParams.set('origin', '*');
    try {
      const response = await fetcher(url, { credentials: 'omit', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new DataError('데이터 제공처에서 응답하지 않았어요. 잠시 후 다시 시도해 주세요.', response.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_UNAVAILABLE', response.status === 429 ? 429 : 502);
      return await response.json();
    } catch (error) {
      if (error instanceof DataError) throw error;
      throw new DataError('외부 음악 데이터를 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  });

  return async (path: string) => {
    const url = new URL(path, 'https://my-tier.invalid');
    if (url.pathname === '/api/portraits') {
      const ids = [...new Set((url.searchParams.get('ids') || '').split(','))];
      if (!ids[0] || ids.length > 40 || ids.some(id => id.length > 100)) throw new DataError('사진 요청이 올바르지 않아요.', 'INVALID_REQUEST', 400);
      return { portraits: await media.getPortraits(ids), source: 'wikipedia' };
    }
    if (url.pathname === '/api/artists/search') {
      const query = (url.searchParams.get('q') || '').trim();
      if (query.length < 2 || query.length > 100) throw new DataError('검색어는 2~100자로 입력해 주세요.', 'INVALID_REQUEST', 400);
      return { artists: await media.searchArtists(query), source: 'musicbrainz' };
    }
    const songs = url.pathname.match(/^\/api\/artists\/([^/]+)\/songs$/);
    if (songs) {
      const query = (url.searchParams.get('q') || '').trim();
      if (query.length > 100) throw new DataError('검색어는 100자 이하로 입력해 주세요.', 'INVALID_REQUEST', 400);
      return { songs: await media.getSongs(decodeURIComponent(songs[1]), query), source: 'itunes' };
    }
    throw new DataError('요청한 경로를 찾지 못했어요.', 'NOT_FOUND', 404);
  };
}

export const browserApi = createBrowserApi();
