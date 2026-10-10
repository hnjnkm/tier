/** Verified domestic catalogs supplement artists that Music cannot identify.
 * Never substitutes another same-name artist or overwrites a working YTM file.
 */
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { EnvHttpProxyAgent, fetch } from 'undici';
import { ALL_CATALOG_ARTISTS } from '../src/data/artists';
import { normalize } from '../src/domain';
import type { MusicAlbum, Song, SongCatalog } from '../src/types';
import { parseBugsAlbum, parseBugsProfile, parseBugsSongs } from './bugs-catalog';

const identities = JSON.parse(await readFile('src/data/identities.json', 'utf8')).artists;
const registryPath = 'src/data/music-supplements.json';
const registry: Record<string, number> = JSON.parse(await readFile(registryPath, 'utf8'));
const ids = new Set((process.argv.find(arg => arg.startsWith('--ids='))?.slice(6) ?? '').split(',').filter(Boolean));
const refresh = process.argv.includes('--refresh');
const staleOnly = process.argv.includes('--stale-only');
const dispatcher = new EnvHttpProxyAgent();
const cacheDir = '/tmp/tier-bugs-music-cache';
await mkdir(cacheDir, { recursive: true });
await mkdir('public/music', { recursive: true });
let nextRequest = 0;
const refreshed = new Set<string>();
const pendingPages = new Map<string, Promise<string>>();

async function page(path: string) {
  if (pendingPages.has(path)) return pendingPages.get(path)!;
  const promise = loadPage(path).finally(() => pendingPages.delete(path));
  pendingPages.set(path, promise); return promise;
}

async function loadPage(path: string) {
  const cache = `${cacheDir}/${encodeURIComponent(path)}.html`;
  const saved = await readFile(cache, 'utf8').catch(() => '');
  if (saved && (!refresh || refreshed.has(path))) return saved;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const scheduled = Math.max(Date.now(), nextRequest);
      nextRequest = scheduled + 150;
      await new Promise(resolve => setTimeout(resolve, Math.max(0, scheduled - Date.now())));
      const response = await fetch(`https://music.bugs.co.kr/${path}`, { dispatcher, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Bugs HTTP ${response.status}`);
      const html = await response.text();
      if (!html.includes('rel="canonical"')) throw new Error('Not a catalog page');
      await writeFile(cache, html); refreshed.add(path); return html;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  throw new Error('No catalog response');
}

async function atomic(path: string, value: unknown) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, path.endsWith('music-supplements.json') ? 2 : 0) + '\n');
  await rename(temporary, path);
}

const failures: { id: string; error: string }[] = [];
let nextArtist = 0;
let saveQueue = Promise.resolve();
try {
  async function worker() {
   while (nextArtist < ALL_CATALOG_ARTISTS.length) {
    const artist = ALL_CATALOG_ARTISTS[nextArtist++];
    if (ids.size && !ids.has(artist.id)) continue;
    const target = `public/music/${artist.id}.json`;
    const previous = await readFile(target, 'utf8').then(JSON.parse).catch(() => null);
    if (previous?.source === 'youtube-music' || previous?.source === 'melon' || (previous && !refresh)) continue;
    if (staleOnly && previous && Date.now() - Date.parse(previous.updatedAt) < 24 * 3600_000) continue;
    try {
      const identity = identities[artist.id];
      if (!identity?.bugsId || !identity.referenceSongs?.length) throw new Error('No verified domestic identity');
      const bugsId = Number(identity.bugsId);
      const profile = parseBugsProfile(await page(`artist/${bugsId}`), String(bugsId));
      const names = new Set([identity.name, artist.name, artist.englishName, ...artist.aliases].map(normalize));
      // Korean-market performers include Korean Americans and groups without
      // a nationality field. The provider's K-pop catalog region establishes
      // that market membership; exact registry IDs and recordings still apply.
      if ((!/대한민국/.test(profile.info['국적'] ?? '') && !profile.genreRegions.includes('kpop')) || !names.has(normalize(profile.name))) throw new Error('Profile identity changed');
      const songs = new Map<string, Song>();
      const signatures = new Set<string>();
      let lastPage = 1;
      for (let index = 1; index <= lastPage; index++) {
        const html = await page(`artist/${bugsId}/tracks?sort=P&page=${index}&roleCode=0`);
        if (!html.includes(`rel="canonical" href="https://music.bugs.co.kr/artist/${bugsId}"`)) throw new Error('Wrong track catalog');
        const rows = parseBugsSongs(html, bugsId, artist.name);
        const signature = rows.map(song => song.id).join(',');
        if (!rows.length || signatures.has(signature)) throw new Error('Missing or repeated track page');
        signatures.add(signature);
        lastPage = Math.max(index, ...[...html.matchAll(/retrieveTrackPage\((\d+)\)/g)].map(match => Number(match[1])));
        for (const song of rows) { song.popularityRank = songs.size; songs.set(song.id, song); }
      }
      const matches = identity.referenceSongs.filter((reference: { title: string; album: string }) =>
        [...songs.values()].some(song => normalize(song.title) === normalize(reference.title) && normalize(song.album) === normalize(reference.album)));
      if (matches.length < Math.min(2, identity.referenceSongs.length)) throw new Error('Domestic discography changed');
      const albums: MusicAlbum[] = [];
      for (const albumId of new Set([...songs.values()].map(song => song.albumId).filter(Boolean))) {
        const tracks = parseBugsAlbum(await page(`album/${albumId!.slice(11)}`), albumId!.slice(11), bugsId, artist.name);
        if (!tracks.length) throw new Error(`Album has no matching credits: ${albumId}`);
        const ids: string[] = [];
        for (const track of tracks) {
          const existing = songs.get(track.id);
          if (existing) Object.assign(existing, track, { popularityRank: existing.popularityRank });
          else songs.set(track.id, track);
          ids.push(track.id);
        }
        albums.push({ id: albumId!, title: tracks[0].album, year: tracks[0].year, artwork: tracks[0].artwork, songIds: ids });
      }
      const catalog: SongCatalog = { source: 'bugs', artistId: artist.id, bugsArtistId: bugsId, reason: 'youtube-catalog-unavailable',
        updatedAt: new Date().toISOString(), complete: true, songs: [...songs.values()], albums };
      saveQueue = saveQueue.then(async () => {
        // The primary collector may have identified this performer while the
        // domestic pages were loading. Preserve that preferred catalog.
        const latest = await readFile(target, 'utf8').then(JSON.parse).catch(() => null);
        if (latest?.source === 'youtube-music') return;
        registry[artist.id] = bugsId;
        await atomic(registryPath, registry);
        await atomic(target, catalog);
      });
      await saveQueue;
      console.log(`${artist.name}: verified domestic supplement, ${songs.size} songs / ${albums.length} albums`);
    } catch (error) {
      failures.push({ id: artist.id, error: String(error) });
      console.error(`${artist.name}: previous catalog preserved (${error})`);
    }
   }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  await writeFile('/tmp/tier-supplement-refresh-report.json', JSON.stringify({ failures }, null, 2));
} finally { await dispatcher.close(); }
if ((await Promise.all(failures.map(async failure => !(await readFile(`public/music/${failure.id}.json`).catch(() => null))))).some(Boolean)) process.exitCode = 1;
