import type { Song } from '../src/types';

export const plainText = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi, entity => {
  const named: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
  if (named[entity]) return named[entity];
  return String.fromCodePoint(parseInt(entity.slice(entity[2] === 'x' ? 3 : 2, -1), entity[2] === 'x' ? 16 : 10));
}).replace(/\s+/g, ' ').trim();

export function parseBugsSongs(html: string, artistId: number, artistName: string): Song[] {
  const songs = new Map<string, Song>();
  for (const match of html.matchAll(/<tr\b([^>]*\btrackId="\d+"[^>]*)>([\s\S]*?)<\/tr>/g)) {
    const id = Number(match[1].match(/\btrackId="(\d+)"/)?.[1]);
    const credits = (match[1].match(/\bartistId="([\d,]+)"/)?.[1] ?? '').split(',').map(Number);
    if (!id || !credits.includes(artistId)) continue;
    const row = match[2];
    const title = row.match(/<p\s+class="title"[^>]*>[\s\S]*?<a\b[^>]*title="([^"]+)"/)?.[1];
    const album = row.match(/<a\b[^>]*class="album"[^>]*title="([^"]+)"/)?.[1] ?? '';
    const albumId = match[1].match(/\balbumId="(\d+)"/)?.[1];
    const artwork = row.match(/<img\b[^>]*src="(https:\/\/image\.bugsm\.co\.kr\/album\/images\/[^" ]+)"/)?.[1];
    if (!title) continue;
    songs.set(`bugs:${id}`, { id: `bugs:${id}`, title: plainText(title), artistName, artistId, album: plainText(album),
      artwork: artwork ? plainText(artwork).replace(/\/album\/images\/\d+\//, '/album/images/200/') : undefined,
      url: `https://music.bugs.co.kr/track/${id}`, locale: 'ko-KR', ...(albumId ? { albumId: `bugs-album:${albumId}` } : {}) });
  }
  return [...songs.values()];
}

export function parseBugsAlbum(html: string, albumId: string, artistId: number, artistName: string) {
  if (!html.includes(`rel="canonical" href="https://music.bugs.co.kr/album/${albumId}"`)) throw new Error(`Wrong album: ${albumId}`);
  const title = plainText(html.match(/<header\b[^>]*class="[^"]*\bpgTitle\b[^"]*"[^>]*>[\s\S]*?<h1>([\s\S]*?)<\/h1>/)?.[1] ?? '');
  if (!title) throw new Error(`Missing album title: ${albumId}`);
  const date = html.match(/<th\b[^>]*>발매일<\/th>[\s\S]*?<time\b[^>]*>(\d{4}\.\d{2}\.\d{2})<\/time>/)?.[1]?.replaceAll('.', '-');
  const artwork = html.match(/<meta\s+property="og:image"\s+content="(https:\/\/image\.bugsm\.co\.kr\/album\/images\/[^" ]+)"/)?.[1]?.replace(/\/album\/images\/\d+\//, '/album/images/200/');
  const songs = parseBugsSongs(html, artistId, artistName).filter(song => song.albumId === `bugs-album:${albumId}`);
  const rows = [...html.matchAll(/<tr\b[^>]*trackId="(\d+)"[^>]*>/g)].map(match => `bugs:${match[1]}`);
  for (const song of songs) {
    song.album = title;
    song.trackNumber = rows.indexOf(song.id) + 1;
    if (artwork) song.artwork = plainText(artwork);
    if (date) { song.releaseDate = date; song.year = date.slice(0, 4); }
  }
  return songs;
}

export function parseBugsProfile(html: string, id: string) {
  if (!html.includes(`rel="canonical" href="https://music.bugs.co.kr/artist/${id}"`)) throw new Error(`Wrong profile: ${id}`);
  const section = html.match(/<section\b[^>]*class="[^"]*summaryArtist[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? '';
  const table = section.match(/<table\b[^>]*class="info"[^>]*>([\s\S]*?)<\/table>/)?.[1] ?? '';
  const info = Object.fromEntries([...table.matchAll(/<tr[^>]*>[\s\S]*?<th[^>]*>([\s\S]*?)<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/g)].map(match => [plainText(match[1]), plainText(match[2])]));
  const name = plainText(html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/)?.[1] ?? '');
  const image = section.match(/<li\s+class="big">[\s\S]*?<img\b[^>]*src="(https:\/\/image\.bugsm\.co\.kr\/artist\/images\/[^" ]+)"/)?.[1];
  const genreRegions = [...new Set([...table.matchAll(/\/genre\/chart\/([^/]+)\//g)].map(match => match[1]))];
  const songs = parseBugsSongs(html, Number(id), name);
  return { id, name, image: image ? plainText(image).replace(/\/artist\/images\/\d+\//, '/artist/images/500/') : null,
    info, genreRegions, songs, groups: [...new Set([...table.matchAll(/\/artist\/(\d+)/g)].map(match => match[1]))] };
}
