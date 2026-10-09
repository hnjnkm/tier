import { ALL_CATALOG_ARTISTS, CATALOG } from './data/artists';
import portraitCatalog from './data/portraits.json';
import { normalize } from './domain';
import type { Artist, Genre, Portrait, Song, SongCatalog } from './types';
import { validateSongCatalog } from './song-catalog';

export class DataError extends Error {
  constructor(message: string, public code = 'PROVIDER_UNAVAILABLE', public status = 502) { super(message); }
}
export type JsonFetcher = (url: URL) => Promise<any>;
export type SongCatalogFetcher = (id: string) => Promise<unknown>;

export function parseSongIds(value: unknown): number[] {
  const values = typeof value === 'string' ? value.split(',') : [];
  if (!values.length || values.length > 100 || values.some(id => !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))) {
    throw new DataError('곡 요청이 올바르지 않아요.', 'INVALID_REQUEST', 400);
  }
  return [...new Set(values.map(Number))];
}

const apiUrl = (base: string, params: Record<string, string | number>) => {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url;
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const secure = (value: unknown): string | undefined => typeof value === 'string' && value.startsWith('https://') ? value : undefined;
const wikimediaImage = (value: unknown): string | undefined => {
  const valid = secure(value);
  if (!valid) return undefined;
  const url = new URL(valid);
  // Wikimedia exposes the same thumbnail path on its canonical upload host.
  // Use that supported endpoint when the page API returns the newer thumb host.
  if (url.hostname === 'thumb.wikimedia.org') url.hostname = 'upload.wikimedia.org';
  return url.href;
};

export function artistFromMusicBrainz(item: any): Artist | null {
  if (!item || !uuid.test(item.id) || typeof item.name !== 'string' || !['Person', 'Group', 'Orchestra', 'Choir'].includes(item.type)) return null;
  const aliases: string[] = (item.aliases ?? []).filter((alias: any) => typeof alias.name === 'string').map((alias: any) => alias.name).slice(0, 30);
  const englishName = /[가-힣]/.test(item.name) ? aliases.find(alias => /[a-z]/i.test(alias) && !/[가-힣]/.test(alias)) || item.name : item.name;
  const person = item.type === 'Person';
  const gender = String(item.gender ?? '').toLowerCase();
  const tags = [...(item.tags ?? []), ...(item.genres ?? [])].map((tag: any) => String(tag.name ?? '').toLowerCase());
  const genreTags: [RegExp, Genre][] = [
    [/ballad|발라드/, 'ballad'], [/hip.?hop|\brap\b|힙합/, 'hiphop'], [/rock|metal|록|락|메탈/, 'rock'],
    [/r.?&.?b|rhythm and blues|soul|알앤비|소울/, 'rnb'], [/indie|인디/, 'indie'], [/k.?pop|dance|pop|댄스/, 'dance'],
    [/trot|트로트/, 'trot'], [/folk|acoustic|포크|어쿠스틱/, 'folk'], [/jazz|재즈/, 'jazz'],
    [/classical|crossover|클래식/, 'crossover'], [/gugak|korean traditional|국악/, 'gugak'],
  ];
  const genres = genreTags.filter(([pattern]) => tags.some(tag => pattern.test(tag))).map(([, genre]) => genre);
  return {
    id: `mb:${item.id}`, musicBrainzId: item.id, name: item.name, englishName,
    aliases, genres, kind: person ? 'solo' : 'group',
    gender: person && gender === 'male' ? 'male' : person && gender === 'female' ? 'female' : 'unknown', source: 'musicbrainz',
  };
}

export function songsFromITunes(results: any[], artistId: number): Song[] {
  const songs = new Map<string, Song>();
  for (const item of results) {
    if (item.wrapperType !== 'track' || item.kind !== 'song' || item.artistId !== artistId || !Number.isSafeInteger(item.trackId) || item.trackId <= 0 || !item.trackName || !item.artistName) continue;
    const song: Song = {
      id: `itunes:${item.trackId}`, title: item.trackName, artistId, artistName: item.artistName,
      album: item.collectionName ?? '', artwork: secure(item.artworkUrl100)?.replace(/100x100bb/, '300x300bb'),
      previewUrl: secure(item.previewUrl), url: secure(item.trackViewUrl), year: /^\d{4}/.test(item.releaseDate ?? '') ? item.releaseDate.slice(0, 4) : undefined,
    };
    songs.set(song.id, song);
  }
  return [...songs.values()];
}

export function chooseITunesArtist(artist: Artist, results: any[]): number {
  const names = new Set([artist.name, artist.englishName, ...artist.aliases].map(normalize));
  const candidates = results.filter(item => item.wrapperType === 'artist' && item.artistType === 'Artist' && Number.isSafeInteger(item.artistId) && item.artistId > 0 && names.has(normalize(item.artistName ?? '')));
  const ranked = candidates.map(item => ({ item, score: (/k-pop|korean|한국/i.test(item.primaryGenreName ?? '') ? 5 : 0) + (normalize(item.artistName) === normalize(artist.englishName) ? 2 : 0) })).sort((a, b) => b.score - a.score);
  if (!ranked.length) throw new DataError('이 가수의 음원을 찾지 못했어요. iTunes 카탈로그에 등록되지 않았을 수 있어요.', 'ARTIST_NOT_FOUND', 404);
  if (ranked.length > 1 && ranked[0].score === ranked[1].score && ranked[0].item.artistId !== ranked[1].item.artistId) {
    throw new DataError('동명이인 가수가 여러 명이라 곡을 정확히 연결하지 못했어요.', 'AMBIGUOUS_ARTIST', 422);
  }
  return ranked[0].item.artistId;
}

export function createMediaService(request: JsonFetcher, presetPortraits: Record<string, Portrait> = portraitCatalog.portraits as Record<string, Portrait>, loadCatalog?: SongCatalogFetcher) {
  const cache = new Map<string, { value: any; expires: number }>();
  const pending = new Map<string, Promise<any>>();
  const artists = new Map(ALL_CATALOG_ARTISTS.map(artist => [artist.id, artist]));
  const officialPortraits = presetPortraits;
  let musicBrainzQueue = Promise.resolve();
  let lastMusicBrainz = 0;
  let queuedRequests = 0;

  async function cached<T>(key: string, load: () => Promise<T>, ttl = 3600000): Promise<T> {
    const existing = cache.get(key);
    if (existing && existing.expires > Date.now()) return existing.value;
    if (pending.has(key)) return pending.get(key)!;
    const promise = load().then(value => {
      if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
      cache.set(key, { value, expires: Date.now() + ttl });
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }

  async function musicBrainz(url: URL) {
    if (queuedRequests >= 25) throw new DataError('검색 요청이 많아요. 잠시 후 다시 시도해 주세요.', 'RATE_LIMITED', 429);
    queuedRequests++;
    const previous = musicBrainzQueue;
    let release!: () => void;
    musicBrainzQueue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      const wait = Math.max(0, 1100 - (Date.now() - lastMusicBrainz));
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      lastMusicBrainz = Date.now();
      return await request(url);
    } finally { queuedRequests--; release(); }
  }

  async function resolveArtist(id: string): Promise<Artist> {
    if (artists.has(id)) return artists.get(id)!;
    if (!id.startsWith('mb:') || !uuid.test(id.slice(3))) throw new DataError('가수를 찾지 못했어요.', 'ARTIST_NOT_FOUND', 404);
    return cached(`artist:${id}`, async () => {
      const item = await musicBrainz(apiUrl(`https://musicbrainz.org/ws/2/artist/${id.slice(3)}`, { fmt: 'json', inc: 'aliases+url-rels' }));
      const artist = artistFromMusicBrainz(item);
      if (!artist) throw new DataError('가수 정보를 찾지 못했어요.', 'ARTIST_NOT_FOUND', 404);
      artists.set(artist.id, artist);
      return artist;
    });
  }

  async function searchArtists(query: string): Promise<Artist[]> {
    return cached(`artists:${normalize(query)}`, async () => {
      const escaped = query.replace(/[+\-!(){}\[\]^"~*?:\\/]/g, '\\$&');
      const expression = `country:KR AND (artist:"${escaped}" OR alias:"${escaped}"${/\s/.test(query) ? '' : ` OR artist:${escaped}* OR alias:${escaped}*`})`;
      const data = await musicBrainz(apiUrl('https://musicbrainz.org/ws/2/artist/', { query: expression, fmt: 'json', limit: 30 }));
      const names = new Set(ALL_CATALOG_ARTISTS.flatMap(artist => [artist.name, artist.englishName, ...artist.aliases, ...(artist.searchAliases ?? [])].map(normalize)));
      return (data.artists ?? []).map(artistFromMusicBrainz).filter((artist: Artist | null): artist is Artist => !!artist && ![artist.name, artist.englishName].some(name => names.has(normalize(name)))).map((artist: Artist) => { artists.set(artist.id, artist); return artist; });
    });
  }

  async function getPortraits(ids: string[]): Promise<Record<string, Portrait>> {
    for (const id of ids) {
      const portrait = officialPortraits[id];
      if (portrait) cache.set(`portrait:${id}`, { value: portrait, expires: Date.now() + 86400000 });
    }
    const known = ids.map(id => artists.get(id)).filter((artist): artist is Artist => !!artist?.wikiTitle && !officialPortraits[artist.id]);
    const missing = known.filter(artist => !cache.get(`portrait:${artist.id}`) || cache.get(`portrait:${artist.id}`)!.expires <= Date.now());
    if (missing.length) {
      const titles = missing.map(artist => artist.wikiTitle!).join('|');
      const data = await cached(`wiki:${titles}`, () => request(apiUrl('https://en.wikipedia.org/w/api.php', { action: 'query', titles, prop: 'pageimages|info', inprop: 'url', pithumbsize: 360, piprop: 'thumbnail', pilimit: 50, format: 'json', redirects: 1 })), 86400000);
      const pages = Object.values(data.query?.pages ?? {}) as any[];
      const redirects = [...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])];
      for (const artist of missing) {
        let title = artist.wikiTitle!;
        for (let step = 0; step < 8; step++) {
          const redirect = redirects.find(item => item.from === title);
          if (!redirect) break;
          title = redirect.to;
        }
        const page = pages.find(item => item.title === title);
        const image = wikimediaImage(page?.thumbnail?.source);
        const portrait = image ? { url: image, pageUrl: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`, title: page.title } : null;
        cache.set(`portrait:${artist.id}`, { value: portrait, expires: Date.now() + 86400000 });
      }
    }
    // Prefer explicit Wikipedia/Wikidata relations. A fallback page must match the
    // artist's name and explicitly describe a South Korean musician or music group.
    const imported = ids.filter(id => id.startsWith('mb:'));
    for (const id of imported) {
      if (!uuid.test(id.slice(3))) continue;
      await cached(`portrait:${id}`, async () => {
        const data = await musicBrainz(apiUrl(`https://musicbrainz.org/ws/2/artist/${id.slice(3)}`, { fmt: 'json', inc: 'url-rels' }));
        const relation = (data.relations ?? []).find((item: any) => item.type === 'wikipedia' && /^https?:\/\/(en|ko)\.wikipedia\.org\/wiki\//.test(item.url?.resource ?? ''));
        let article: URL;
        let title: string;
        if (relation) {
          article = new URL(relation.url.resource); article.protocol = 'https:';
          title = decodeURIComponent(article.pathname.slice(6));
        } else {
          const wikidata = (data.relations ?? []).find((item: any) => item.type === 'wikidata' && /^https?:\/\/www\.wikidata\.org\/wiki\/Q\d+$/.test(item.url?.resource ?? ''));
          if (!wikidata) {
            const artist = await resolveArtist(id);
            const titles = [...new Set([artist.englishName, `${artist.englishName} (singer)`, artist.name])].join('|');
            const wiki = await request(apiUrl('https://en.wikipedia.org/w/api.php', { action: 'query', titles, prop: 'pageimages|pageterms|info', wbptterms: 'description', inprop: 'url', pithumbsize: 360, pilimit: 50, format: 'json', redirects: 1 }));
            const names = new Set([artist.name, artist.englishName, ...artist.aliases].map(normalize));
            const pages = (Object.values(wiki.query?.pages ?? {}) as any[]).filter(page => {
              const name = normalize((page.title ?? '').replace(/\s*\((singer|musician|rapper|band|group)\)\s*$/i, ''));
              const description = (page.terms?.description ?? []).join(' ');
              return names.has(name) && /South Korean\b.*\b(singer|musician|rapper|band|group)\b/i.test(description) && wikimediaImage(page.thumbnail?.source);
            });
            if (pages.length !== 1) return null;
            const page = pages[0];
            return { url: wikimediaImage(page.thumbnail.source)!, pageUrl: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`, title: page.title };
          }
          const entityId = wikidata.url.resource.split('/').pop();
          const entities = await request(apiUrl('https://www.wikidata.org/w/api.php', { action: 'wbgetentities', ids: entityId, props: 'sitelinks', format: 'json' }));
          const sites = entities.entities?.[entityId]?.sitelinks;
          const site = sites?.enwiki ? 'en' : sites?.kowiki ? 'ko' : null;
          if (!site) return null;
          title = sites[`${site}wiki`].title;
          article = new URL(`https://${site}.wikipedia.org/wiki/${encodeURIComponent(title)}`);
        }
        const wiki = await request(apiUrl(`${article.origin}/w/api.php`, { action: 'query', titles: title, prop: 'pageimages|info', inprop: 'url', pithumbsize: 360, format: 'json', redirects: 1 }));
        const page: any = Object.values(wiki.query?.pages ?? {})[0];
        const image = wikimediaImage(page?.thumbnail?.source);
        return image ? { url: image, pageUrl: page.fullurl || article.href, title: page.title } : null;
      }, 86400000);
    }
    return Object.fromEntries(ids.flatMap(id => cache.get(`portrait:${id}`)?.value ? [[id, cache.get(`portrait:${id}`)!.value]] : []));
  }

  async function localizeSongs(ids: number[]): Promise<Song[]> {
    const requested = [...new Set(ids)].filter(id => Number.isSafeInteger(id) && id > 0);
    const localized = new Map<string, Song>();
    for (let offset = 0; offset < requested.length; offset += 100) {
      const batch = requested.slice(offset, offset + 100).sort((a, b) => a - b);
      const songs = await cached(`songs-kr:${batch.join(',')}`, async () => {
        const data = await request(apiUrl('https://itunes.apple.com/lookup', { id: batch.join(','), country: 'KR', lang: 'ko_kr', limit: 200 }));
        const allowed = new Set(batch);
        return (data.results ?? []).flatMap((item: any) => {
          if (!allowed.has(item.trackId) || !Number.isSafeInteger(item.artistId) || item.artistId <= 0) return [];
          return songsFromITunes([item], item.artistId).map(song => ({ ...song, locale: 'ko-KR' as const }));
        });
      });
      for (const song of songs) localized.set(song.id, song);
    }
    return requested.flatMap(id => localized.get(`itunes:${id}`) ? [localized.get(`itunes:${id}`)!] : []);
  }

  async function getSongs(id: string, query = ''): Promise<Song[]> {
    if (loadCatalog) {
      const catalog = await getSongCatalog(id);
      return catalog.songs.filter(song => normalize(song.title).includes(normalize(query)));
    }
    const artist = await resolveArtist(id);
    const itunesId: number = artist.itunesId ?? await cached(`itunes-id:${id}`, async () => {
      // Search cannot list Korean-store songs. Discover stable IDs, then look them
      // up in KR to obtain official regional titles, artist names and albums.
      const data = await request(apiUrl('https://itunes.apple.com/search', { term: artist.englishName, country: 'US', entity: 'musicArtist', limit: 50 }));
      try { return chooseITunesArtist(artist, data.results ?? []); }
      catch (error) {
        if (!(error instanceof DataError) || error.code !== 'ARTIST_NOT_FOUND' || normalize(artist.name) === normalize(artist.englishName)) throw error;
        const korean = await request(apiUrl('https://itunes.apple.com/search', { term: artist.name, country: 'US', entity: 'musicArtist', limit: 50 }));
        return chooseITunesArtist(artist, korean.results ?? []);
      }
    }, 86400000);
    return cached(`songs:${id}:${normalize(query)}`, async () => {
      if (!query) {
        const data = await request(apiUrl('https://itunes.apple.com/search', { term: artist.englishName, entity: 'song', country: 'US', limit: 200 }));
        const candidates = songsFromITunes(data.results ?? [], itunesId);
        return (await localizeSongs(candidates.map(song => Number(song.id.slice(7))))).filter(song => song.artistId === itunesId).map(song => ({ ...song, artistName: artist.name }));
      }
      const base = await getSongs(id);
      const local = base.filter(song => normalize(song.title).includes(normalize(query)));
      // Search also understands original titles and aliases; keep the match after
      // replacing its metadata with the Korean storefront's official spelling.
      const data = await request(apiUrl('https://itunes.apple.com/search', { term: query, attribute: 'songTerm', entity: 'song', country: 'US', limit: 200 }));
      const candidates = songsFromITunes(data.results ?? [], itunesId);
      const localized = (await localizeSongs(candidates.map(song => Number(song.id.slice(7))))).filter(song => song.artistId === itunesId).map(song => ({ ...song, artistName: artist.name }));
      return [...new Map([...local, ...localized].map(song => [song.id, song])).values()];
    });
  }

  async function getSongCatalog(id: string): Promise<SongCatalog> {
    await resolveArtist(id);
    if (!loadCatalog) throw new DataError('YouTube Music 목록을 준비 중이에요.', 'CATALOG_UNAVAILABLE', 503);
    return cached(`youtube-catalog:${id}`, async () => {
      try { return validateSongCatalog(await loadCatalog(id), id); }
      catch (error) {
        if (error instanceof DataError) throw error;
        throw new DataError('이 아티스트의 YouTube Music 목록을 갱신 중이에요.', 'CATALOG_UNAVAILABLE', 503);
      }
    }, 300000);
  }

  return { searchArtists, getPortraits, getSongs, getSongCatalog, localizeSongs };
}
export type MediaService = ReturnType<typeof createMediaService>;
