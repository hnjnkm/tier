/** Restore release date precision from previously verified public album pages. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { parseBugsAlbum } from './bugs-catalog';
import { parseMelonAlbum } from './melon-catalog';
import type { SongCatalog } from '../src/types';

let updated = 0;
for (const file of (await readdir('public/music')).filter(file => /^kr-.*\.json$/.test(file))) {
  const path = `public/music/${file}`;
  const catalog = JSON.parse(await readFile(path, 'utf8')) as SongCatalog;
  if (catalog.source === 'youtube-music') continue;
  const songs = new Map(catalog.songs.map(song => [song.id, song]));
  let changed = false;
  for (const album of catalog.albums ?? []) {
    if (album.year) continue;
    const id = album.id.split(':')[1];
    const part = catalog.source === 'bugs' ? `album/${id}` : `album/detail.htm?albumId=${id}`;
    const cache = `/tmp/tier-${catalog.source === 'bugs' ? 'bugs-music' : 'melon'}-cache/${encodeURIComponent(part)}.html`;
    const html = await readFile(cache, 'utf8').catch(() => '');
    if (!html) continue;
    const tracks = catalog.source === 'bugs' ? parseBugsAlbum(html, id, catalog.bugsArtistId, catalog.songs[0].artistName)
      : parseMelonAlbum(html, id, catalog.melonArtistId, catalog.songs[0].artistName);
    const year = tracks.find(track => track.year)?.year;
    if (!year) continue;
    album.year = year; updated++; changed = true;
    for (const track of tracks) {
      const song = songs.get(track.id);
      if (song?.albumId === album.id) Object.assign(song, { year: track.year, ...(track.releaseDate ? { releaseDate: track.releaseDate } : {}) });
    }
  }
  if (changed) await writeFile(path, JSON.stringify(catalog) + '\n');
}
console.log(`Restored ${updated} domestic album years from verified release fields`);
