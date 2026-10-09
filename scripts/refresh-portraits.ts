import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { EnvHttpProxyAgent, fetch } from 'undici';
import { ALL_CATALOG_ARTISTS } from '../src/data/artists';
import type { Portrait } from '../src/types';
import { verifiedBugsId } from './bugs-portraits';
import { parseBugsProfile } from './bugs-catalog';

const target = resolve('src/data/portraits.json');
const namesTarget = resolve('src/data/provider-names.json');
const saved = JSON.parse(await readFile(target, 'utf8')) as { portraits: Record<string, Portrait> };
const portraits = { ...saved.portraits };
const refreshAll = process.argv.includes('--all');
const artists = ALL_CATALOG_ARTISTS.filter(artist => refreshAll || !portraits[artist.id]);
const dispatcher = new EnvHttpProxyAgent();
let next = 0, done = 0, added = 0, failed = 0, unmatched = 0;
let requestQueue = Promise.resolve();
let lastRequest = 0;
let saveQueue = Promise.resolve();

async function pace() {
  const previous = requestQueue;
  let release!: () => void;
  requestQueue = new Promise<void>(resolve => { release = resolve; });
  await previous;
  const pause = Math.max(0, 350 - (Date.now() - lastRequest));
  if (pause) await new Promise(resolve => setTimeout(resolve, pause));
  lastRequest = Date.now(); release();
}
function checkpoint() {
  const payload = JSON.stringify({ updatedAt: new Date().toISOString(), provider: 'Bugs public artist profiles', portraits }, null, 2) + '\n';
  const names = Object.fromEntries(Object.entries(portraits).filter(([, portrait]) => portrait.provider === 'bugs' && portrait.title).sort(([left], [right]) => left.localeCompare(right)).map(([id, portrait]) => [id, portrait.title]));
  const namesPayload = JSON.stringify(names, null, 2) + '\n';
  saveQueue = saveQueue.then(async () => {
    await writeFile(target + '.tmp', payload); await rename(target + '.tmp', target);
    await writeFile(namesTarget + '.tmp', namesPayload); await rename(namesTarget + '.tmp', namesTarget);
  });
}
async function worker() {
  while (next < artists.length) {
    const artist = artists[next++];
    try {
      const id = verifiedBugsId(artist.id);
      if (!id) { unmatched++; done++; continue; }
      await pace();
      const url = new URL(`https://music.bugs.co.kr/artist/${id}`);
      const response = await fetch(url, { dispatcher, signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'my-tier/0.1 (+https://github.com/hnjnkm/tier)' } });
      if (!response.ok) throw new Error(`Provider status ${response.status}`);
      const profile = parseBugsProfile(await response.text(), id);
      const portrait: Portrait | null = profile.image ? { url: profile.image, pageUrl: url.href, title: profile.name, provider: 'bugs' } : null;
      if (portrait) {
        const image = await fetch(portrait.url, { method: 'HEAD', dispatcher, signal: AbortSignal.timeout(10000) });
        if (!image.ok || !image.headers.get('content-type')?.startsWith('image/')) throw new Error(`Image unavailable for ${artist.name}`);
        portraits[artist.id] = portrait; added++;
      } else unmatched++;
    } catch { failed++; }
    done++;
    if (done % 50 === 0) { checkpoint(); console.log(`Profiles ${done}/${artists.length}: ${added} connected, ${unmatched} unmatched, ${failed} unavailable`); }
  }
}
console.log(`Refreshing ${artists.length} public artist profiles; preserving ${Object.keys(saved.portraits).length} cached profiles`);
try {
  await Promise.all(Array.from({ length: 4 }, worker));
  if (artists.length > 10 && added === 0 && failed > artists.length / 2) throw new Error('Music provider could not be reached; existing portraits were preserved');
  checkpoint(); await saveQueue;
  console.log(`Saved ${Object.keys(portraits).length} official artist portraits (${unmatched} ambiguous/missing, ${failed} unavailable)`);
} finally { await dispatcher.close(); }
