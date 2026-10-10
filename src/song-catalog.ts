import { normalize } from './domain';
import type { MusicAlbum, Song, SongCatalog } from './types';
import supplements from './data/music-supplements.json';
import melonArtists from './data/melon-artists.json';
import families from './data/music-families.json';

export type SongSort = 'popular' | 'latest' | 'album';
const titleOrder = new Intl.Collator('ko', { numeric: true });
const albumKey = (title: string) => normalize(title.replace(/\s*(?:-\s*)?(?:single|ep)\s*$/i, ''));

export function selectedSong(song: Song, favorites: Song[]): Song | undefined {
  return favorites.find(favorite => favorite.id === song.id) ?? favorites.find(favorite =>
    favorite.id.startsWith('itunes:') && /^(youtube|bugs|melon):/.test(song.id) && normalize(favorite.title) === normalize(song.title)
    && albumKey(favorite.album) === albumKey(song.album));
}

export function songAlbums(songs: Song[], albums?: MusicAlbum[]): MusicAlbum[] {
  if (albums) return [...albums].sort((a, b) => titleOrder.compare(a.title, b.title));
  const grouped = new Map<string, MusicAlbum>();
  for (const song of songs) {
    const id = song.albumId ?? song.album;
    if (!id) continue;
    const album = grouped.get(id) ?? { id, title: song.album, year: song.year, artwork: song.artwork, songIds: [] };
    album.songIds.push(song.id); grouped.set(id, album);
  }
  return [...grouped.values()].sort((a, b) => titleOrder.compare(a.title, b.title));
}

export function visibleSongs(songs: Song[], query: string, sort: SongSort, album?: MusicAlbum): Song[] {
  const ids = album ? new Set(album.songIds) : undefined;
  const result = songs.filter(song => (!ids || ids.has(song.id)) && normalize(song.title).includes(normalize(query)));
  const fallback = (a: Song, b: Song) => titleOrder.compare(a.title, b.title) || a.id.localeCompare(b.id);
  return result.sort((a, b) => {
    if (sort === 'latest') return (b.releaseDate ?? b.year ?? '').localeCompare(a.releaseDate ?? a.year ?? '')
      || (a.releaseOrder ?? Number.MAX_SAFE_INTEGER) - (b.releaseOrder ?? Number.MAX_SAFE_INTEGER) || fallback(a, b);
    if (sort === 'album') return titleOrder.compare(a.album, b.album)
      || (a.trackNumber ?? Number.MAX_SAFE_INTEGER) - (b.trackNumber ?? Number.MAX_SAFE_INTEGER) || fallback(a, b);
    return (a.popularityRank ?? Number.MAX_SAFE_INTEGER) - (b.popularityRank ?? Number.MAX_SAFE_INTEGER) || fallback(a, b);
  });
}

export function validateSongCatalog(value: unknown, artistId: string): SongCatalog {
  const data = value as SongCatalog;
  if (!data || !['youtube-music', 'bugs', 'melon'].includes(data.source) || data.artistId !== artistId
    || !Number.isFinite(Date.parse(data.updatedAt)) || typeof data.complete !== 'boolean' || !Array.isArray(data.songs)) {
    throw new Error('아티스트 곡 목록이 올바르지 않아요.');
  }
  const members = data.source === 'youtube-music' && 'members' in data ? data.members : undefined;
  const channels = new Set(members?.map(member => member.channelId));
  if (members) {
    const allowed = (families as Record<string, string[]>)[artistId];
    if (!allowed || data.source !== 'youtube-music' || !('ranking' in data) || data.ranking !== 'unit-rotation' || !members.length
      || members.some(member => !allowed.includes(member.artistId) || !/^UC[\w-]{22}$/.test(member.channelId))
      || new Set(members.map(member => member.artistId)).size !== members.length) throw new Error('검증된 그룹 구성원이 아니에요.');
  }
  if (data.source === 'youtube-music' ? !members && !/^UC[\w-]{22}$/.test(data.channelId ?? '')
    : data.reason !== 'youtube-catalog-unavailable' || (data.source === 'bugs'
      ? !Number.isSafeInteger(data.bugsArtistId) || (supplements as Record<string, number>)[artistId] !== data.bugsArtistId
      : !Number.isSafeInteger(data.melonArtistId) || (melonArtists as Record<string, number>)[artistId] !== data.melonArtistId)) throw new Error('검증된 아티스트 목록이 아니에요.');
  const ids = new Set<string>();
  for (const song of data.songs) {
    const linked = data.source === 'youtube-music'
      ? /^youtube:[\w-]{11}$/.test(song.id) && (members ? channels.has(String(song.artistId)) : song.artistId === data.channelId) && song.url === `https://music.youtube.com/watch?v=${song.id.slice(8)}`
      : data.source === 'bugs'
        ? /^bugs:[1-9]\d*$/.test(song.id) && song.artistId === data.bugsArtistId && song.url === `https://music.bugs.co.kr/track/${song.id.slice(5)}`
        : /^melon:[1-9]\d*$/.test(song.id) && song.artistId === data.melonArtistId && song.url === `https://www.melon.com/song/detail.htm?songId=${song.id.slice(6)}`;
    if (!linked || !song.title || !song.artistName || typeof song.album !== 'string' || ids.has(song.id) || song.locale !== 'ko-KR') {
      throw new Error('곡의 아티스트 연결이 올바르지 않아요.');
    }
    ids.add(song.id);
  }
  if (data.albums?.some(album => !album.id || !album.title || !Array.isArray(album.songIds) || album.songIds.some(id => !ids.has(id)))) {
    throw new Error('앨범 목록이 올바르지 않아요.');
  }
  return data;
}

export function mergeMusicFamily(artistId: string, inputs: SongCatalog[]): SongCatalog {
  const allowed = (families as Record<string, string[]>)[artistId];
  if (!allowed) throw new Error('Unknown group family');
  const sources = inputs.map(input => validateSongCatalog(input, input.artistId))
    .filter((input): input is SongCatalog & { source: 'youtube-music'; channelId: string } => input.source === 'youtube-music' && !!input.channelId);
  if (sources.some(input => !allowed.includes(input.artistId)) || !sources.length) throw new Error('Unexpected group performer');
  const members = sources.map(input => ({ artistId: input.artistId, channelId: input.channelId! }));
  const ordered = sources.flatMap((input, memberIndex) => input.songs.map(song => ({ song, memberIndex })))
    .sort((a, b) => (a.song.popularityRank ?? Number.MAX_SAFE_INTEGER) - (b.song.popularityRank ?? Number.MAX_SAFE_INTEGER) || a.memberIndex - b.memberIndex || titleOrder.compare(a.song.title, b.song.title));
  const songs = new Map<string, Song>();
  for (const { song } of ordered) if (!songs.has(song.id)) songs.set(song.id, { ...song, popularityRank: songs.size });
  const albums = new Map<string, MusicAlbum>();
  for (const input of sources) for (const album of songAlbums(input.songs, input.albums)) {
    const previous = albums.get(album.id);
    albums.set(album.id, { ...album, songIds: [...new Set([...(previous?.songIds ?? []), ...album.songIds])].filter(id => songs.has(id)) });
  }
  return validateSongCatalog({ source: 'youtube-music', artistId, members, ranking: 'unit-rotation',
    complete: sources.every(source => source.complete), updatedAt: sources.map(source => source.updatedAt).sort().at(-1), songs: [...songs.values()], albums: [...albums.values()] }, artistId);
}
