import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import families from '../src/data/music-families.json';
import { mergeMusicFamily, validateSongCatalog } from '../src/song-catalog';
import type { SongCatalog } from '../src/types';

await mkdir('public/music/group-bases', { recursive: true });
for (const [id, children] of Object.entries(families)) {
  const target = `public/music/${id}.json`;
  const baseTarget = `public/music/group-bases/${id}.json`;
  const current = await readFile(target, 'utf8').then(JSON.parse).catch(() => null);
  if (current && !current.members) await writeFile(baseTarget, JSON.stringify(current) + '\n');
  const base = await readFile(baseTarget, 'utf8').then(JSON.parse).catch(() => null);
  const catalogs: SongCatalog[] = [];
  for (const child of children) {
    const value = child === id ? base : await readFile(`public/music/${child}.json`, 'utf8').then(JSON.parse);
    if (!value) continue;
    const catalog = validateSongCatalog(value, child);
    if (catalog.source !== 'youtube-music') {
      if (child === id) continue;
      throw new Error(`Group unit is not ready: ${child}`);
    }
    catalogs.push(catalog);
  }
  const merged = mergeMusicFamily(id, catalogs);
  await writeFile(`${target}.tmp`, JSON.stringify(merged) + '\n');
  await rename(`${target}.tmp`, target);
  console.log(`${id}: ${catalogs.length} verified catalogs, ${merged.songs.length} songs / ${merged.albums?.length} albums`);
}
