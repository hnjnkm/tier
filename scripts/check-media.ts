import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { CATALOG } from '../src/data/artists';
import { validateSongCatalog } from '../src/song-catalog';
import type { Portrait } from '../src/types';
import families from '../src/data/music-families.json';

const portraits: Record<string, Portrait> = JSON.parse(await readFile('src/data/portraits.json', 'utf8')).portraits;
const missingPhotos: string[] = [], invalidPhotos: string[] = [], missingMusic: string[] = [], invalidMusic: string[] = [];
let trackCount = 0, youtubeCatalogs = 0, domesticSupplements = 0;
for (const artist of CATALOG) {
  const photo = portraits[artist.id];
  if (!photo?.localPath) missingPhotos.push(artist.id);
  else {
    try {
      if (!/^portraits\/kr-[a-z0-9-]+\.[a-f0-9]{12}\.webp$/.test(photo.localPath)) throw new Error('Invalid path');
      const data = sharp(await readFile(`public/${photo.localPath}`));
      const info = await data.metadata();
      if (info.width !== 256 || info.height !== 256 || (await data.stats()).entropy < 1) throw new Error('Invalid photo');
    } catch { invalidPhotos.push(artist.id); }
  }
  let value;
  try { value = JSON.parse(await readFile(`public/music/${artist.id}.json`, 'utf8')); }
  catch { missingMusic.push(artist.id); continue; }
  try {
    const music = validateSongCatalog(value, artist.id);
    if (!music.complete || !music.songs.length) throw new Error('Incomplete catalog');
    if (music.source === 'youtube-music' && 'members' in music) {
      const expected = (families as Record<string, string[]>)[artist.id].filter(id => id !== artist.id);
      if (expected.some(id => !music.members.some(member => member.artistId === id))) throw new Error('Missing group unit');
      for (const member of music.members) {
        const path = member.artistId === artist.id ? `group-bases/${artist.id}` : member.artistId;
        const unit = validateSongCatalog(JSON.parse(await readFile(`public/music/${path}.json`, 'utf8')), member.artistId);
        if (unit.source !== 'youtube-music' || unit.channelId !== member.channelId || !unit.complete || !unit.songs.length) throw new Error('Invalid group unit');
      }
    }
    trackCount += music.songs.length;
    if (music.source === 'youtube-music') youtubeCatalogs++; else domesticSupplements++;
  } catch { invalidMusic.push(artist.id); }
}
const report = { artistCount: CATALOG.length, bundledPhotos: CATALOG.length - missingPhotos.length - invalidPhotos.length,
  musicCatalogs: CATALOG.length - missingMusic.length - invalidMusic.length, youtubeCatalogs, domesticSupplements, trackCount, missingPhotos, invalidPhotos, missingMusic, invalidMusic };
await writeFile('/tmp/tier-media-readiness.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Verified ${report.bundledPhotos}/${CATALOG.length} square portraits and ${report.musicCatalogs}/${CATALOG.length} catalogs (${youtubeCatalogs} YouTube Music, ${domesticSupplements} domestic supplements; ${trackCount} tracks)`);
if (missingPhotos.length || invalidPhotos.length || missingMusic.length || invalidMusic.length || youtubeCatalogs <= domesticSupplements) {
  console.error(`Media is not ready for deployment. Missing photos: ${missingPhotos.length}, invalid photos: ${invalidPhotos.length}, missing catalogs: ${missingMusic.length}, invalid catalogs: ${invalidMusic.length}. Details: /tmp/tier-media-readiness.json`);
  process.exitCode = 1;
}
