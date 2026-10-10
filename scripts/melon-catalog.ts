import type { Song } from '../src/types';
import { plainText } from './bugs-catalog';

export function parseMelonSongs(html: string, artistId: number, artistName: string, album?: { id: string; title: string }) {
  const songs: Song[] = [];
  let trackNumber = 0;
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    const row = match[1];
    const id = row.match(/goSongDetail\('(\d+)'\)/)?.[1];
    if (!id) continue;
    trackNumber++;
    const credits = [...row.matchAll(/goArtistDetail\('(\d+)'\)/g)].map(match => Number(match[1]));
    if (!credits.includes(artistId)) continue;
    const title = row.match(/<input\b[^>]*title="([^"]+) 곡 선택"/)?.[1]
      ?? row.match(/goSongDetail\('\d+'\);"\s+title="([^"]+) 곡정보/)?.[1];
    const release = row.match(/goAlbumDetail\('(\d+)'\);"\s+title="([^"]+) - 페이지 이동"/);
    if (!title || (!album && !release)) continue;
    songs.push({ id: `melon:${id}`, title: plainText(title), artistId, artistName,
      album: album?.title ?? plainText(release![2]), albumId: `melon-album:${album?.id ?? release![1]}`,
      url: `https://www.melon.com/song/detail.htm?songId=${id}`, locale: 'ko-KR', ...(album ? { trackNumber } : {}) });
  }
  return songs;
}

export function melonLastOffset(html: string) {
  // Pagination is an escaped HTML string, never executable code.
  return Math.max(1, ...[...html.matchAll(/sendPage\(\\?'(\d+)\\?'\)/g)].map(match => Number(match[1])));
}

export function parseMelonAlbum(html: string, albumId: string, artistId: number, artistName: string) {
  if (!html.includes(`/album/detail.htm?albumId=${albumId}"`)) throw new Error('Wrong Melon album');
  const title = plainText(html.match(/<div class="song_name">[\s\S]*?<strong class="none">[^<]*<\/strong>([\s\S]*?)<\/div>/)?.[1] ?? '');
  if (!title) throw new Error('Missing Melon album title');
  const artwork = html.match(/property="og:image"\s+content="(https:\/\/cdnimg\.melon\.co\.kr\/[^" ]+)"/)?.[1];
  const date = html.match(/<dt>발매일<\/dt>\s*<dd>(\d{4}\.\d{2}\.\d{2})<\/dd>/)?.[1]?.replaceAll('.', '-');
  const songs = parseMelonSongs(html, artistId, artistName, { id: albumId, title });
  for (const song of songs) {
    if (artwork) song.artwork = plainText(artwork);
    if (date) { song.releaseDate = date; song.year = date.slice(0, 4); }
  }
  return songs;
}
