/** Reviewed Korean catalogs supplement performers not uniquely indexed in YTM.
 * Reads public metadata only; never replaces a working primary catalog.
 */
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { EnvHttpProxyAgent, fetch } from 'undici';
import { ALL_CATALOG_ARTISTS } from '../src/data/artists';
import pins from '../src/data/melon-artists.json';
import { normalize } from '../src/domain';
import { parseMelonAlbum, parseMelonSongs, melonLastOffset } from './melon-catalog';
import type { MusicAlbum, Song, SongCatalog } from '../src/types';

const refresh = process.argv.includes('--refresh');
const staleOnly = process.argv.includes('--stale-only');
const requested = new Set((process.argv.find(arg => arg.startsWith('--ids='))?.slice(6) ?? '').split(',').filter(Boolean));
const dispatcher = new EnvHttpProxyAgent();
const cacheDir = '/tmp/tier-melon-cache';
await mkdir(cacheDir, { recursive: true });
await mkdir('public/music', { recursive: true });
let nextRequest = 0;
const pending = new Map<string, Promise<string>>();
const refreshed = new Set<string>();
async function page(path: string) {
  if (pending.has(path)) return pending.get(path)!;
  const request = loadPage(path).finally(() => pending.delete(path));
  pending.set(path, request); return request;
}
async function loadPage(path: string) {
  const file = `${cacheDir}/${encodeURIComponent(path)}.html`;
  const saved = await readFile(file, 'utf8').catch(() => '');
  if (saved && (!refresh || refreshed.has(path))) return saved;
  for (let attempt = 0; attempt < 3; attempt++) {
    const when = Math.max(Date.now(), nextRequest); nextRequest = when + 500;
    await new Promise(resolve => setTimeout(resolve, Math.max(0, when - Date.now())));
    const response = await fetch(`https://www.melon.com/${path}`, { dispatcher, signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
        await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
        continue;
      }
      throw new Error(`Melon HTTP ${response.status}`);
    }
    const html = await response.text();
    if (html.includes('melon.link.') || html.includes('songTypeOne')) {
      await writeFile(`${file}.${process.pid}.tmp`, html); await rename(`${file}.${process.pid}.tmp`, file);
      refreshed.add(path); return html;
    }
    if (attempt === 2) throw new Error('Not a Melon catalog page');
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  throw new Error('No Melon response');
}
const failures: { id: string; error: string }[] = [];
const targets = ALL_CATALOG_ARTISTS.filter(artist => (pins as Record<string, number>)[artist.id] && (!requested.size || requested.has(artist.id)));
let nextArtist = 0;
async function worker() {
  while (nextArtist < targets.length) {
    const artist = targets[nextArtist++];
    const path = `public/music/${artist.id}.json`;
    const previous = await readFile(path, 'utf8').then(JSON.parse).catch(() => null);
    if (previous?.source === 'youtube-music' || (previous && !refresh)) continue;
    if (staleOnly && previous && Date.now() - Date.parse(previous.updatedAt) < 24 * 3600_000) continue;
    try {
      console.log(`${artist.name}: reading complete reviewed catalog`);
      const id = (pins as Record<string, number>)[artist.id];
      const songs = new Map<string, Song>();
      const signatures = new Set<string>();
      let last = 1;
      for (let offset = 1; offset <= last; offset += 50) {
        const html = await page(`artist/songPaging.htm?artistId=${id}&listType=A&orderBy=ISSUE_DATE&startIndex=${offset}&pageSize=50`);
        const tracks = parseMelonSongs(html, id, artist.name);
        const signature = tracks.map(song => song.id).join(',');
        if (!tracks.length || signatures.has(signature)) throw new Error('Missing or repeated artist continuation');
        signatures.add(signature); last = Math.max(last, melonLastOffset(html));
        for (const song of tracks) songs.set(song.id, song);
      }
      // The popular shelf can be smaller than the complete release catalog.
      // Its pager still advertises the complete catalog's size. An empty
      // popular page ends ranking collection, never complete-song collection.
      const ranked = new Set<string>();
      for (let offset = 1; offset <= last; offset += 50) {
        const html = await page(`artist/songPaging.htm?artistId=${id}&listType=A&orderBy=POPULAR_SONG_LIST&startIndex=${offset}&pageSize=50`);
        const tracks = parseMelonSongs(html, id, artist.name);
        if (!tracks.length) break;
        if (tracks.some(song => ranked.has(song.id))) throw new Error('Repeated popular continuation');
        for (const song of tracks) { if (songs.has(song.id)) songs.get(song.id)!.popularityRank = ranked.size; ranked.add(song.id); }
      }
      const albums: MusicAlbum[] = [];
      for (const albumId of new Set([...songs.values()].map(song => song.albumId!))) {
        const tracks = parseMelonAlbum(await page(`album/detail.htm?albumId=${albumId.slice(12)}`), albumId.slice(12), id, artist.name);
        if (!tracks.length) throw new Error(`Album has no matching credits: ${albumId}`);
        for (const song of tracks) {
          const existing = songs.get(song.id);
          songs.set(song.id, { ...existing, ...song, popularityRank: existing?.popularityRank });
        }
        albums.push({ id: albumId, title: tracks[0].album, year: tracks[0].year, artwork: tracks[0].artwork, songIds: tracks.map(song => song.id) });
      }
      if (!songs.size) throw new Error('Empty catalog');
      if ([...songs.values()].some(song => normalize(song.artistName) !== normalize(artist.name))) throw new Error('Wrong performer');
      const catalog: SongCatalog = { source: 'melon', artistId: artist.id, melonArtistId: id, reason: 'youtube-catalog-unavailable',
        updatedAt: new Date().toISOString(), complete: true, songs: [...songs.values()], albums };
      if ((await readFile(path, 'utf8').then(JSON.parse).catch(() => null))?.source === 'youtube-music') continue;
      await writeFile(`${path}.${process.pid}.tmp`, JSON.stringify(catalog) + '\n');
      await rename(`${path}.${process.pid}.tmp`, path);
      console.log(`${artist.name}: verified Melon supplement, ${songs.size} songs / ${albums.length} albums`);
    } catch (error) {
      failures.push({ id: artist.id, error: String(error) });
      console.error(`${artist.name}: previous catalog preserved (${error})`);
    }
  }
}
try { await Promise.all(Array.from({ length: 5 }, worker)); }
finally { await dispatcher.close(); }
await writeFile('/tmp/tier-melon-refresh-report.json', JSON.stringify({ failures }, null, 2));
for (const failure of failures) if (!(await readFile(`public/music/${failure.id}.json`).catch(() => null))) process.exitCode = 1;
