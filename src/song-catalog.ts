import { normalize } from './domain';
import type { MusicAlbum, Song, SongCatalog } from './types';

export type SongSort = 'popular' | 'latest' | 'album';
const titleOrder = new Intl.Collator('ko', { numeric: true });
const albumKey = (title: string) => normalize(title.replace(/\s*(?:-\s*)?(?:single|ep)\s*$/i, ''));

export function selectedSong(song: Song, favorites: Song[]): Song | undefined {
  return favorites.find(favorite => favorite.id === song.id) ?? favorites.find(favorite =>
    favorite.id.startsWith('itunes:') && song.id.startsWith('youtube:') && normalize(favorite.title) === normalize(song.title)
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
  if (!data || data.source !== 'youtube-music' || data.artistId !== artistId || !/^UC[\w-]{22}$/.test(data.channelId)
    || !Number.isFinite(Date.parse(data.updatedAt)) || typeof data.complete !== 'boolean' || !Array.isArray(data.songs)) {
    throw new Error('YouTube Music 아티스트 목록이 올바르지 않아요.');
  }
  const ids = new Set<string>();
  for (const song of data.songs) {
    if (!/^youtube:[\w-]{11}$/.test(song.id) || song.artistId !== data.channelId || !song.title || !song.artistName || typeof song.album !== 'string'
      || ids.has(song.id) || song.locale !== 'ko-KR' || song.url !== `https://music.youtube.com/watch?v=${song.id.slice(8)}`) {
      throw new Error('YouTube Music 곡의 아티스트 연결이 올바르지 않아요.');
    }
    ids.add(song.id);
  }
  if (data.albums?.some(album => !album.id || !album.title || !Array.isArray(album.songIds) || album.songIds.some(id => !ids.has(id)))) {
    throw new Error('YouTube Music 앨범 목록이 올바르지 않아요.');
  }
  return data;
}
