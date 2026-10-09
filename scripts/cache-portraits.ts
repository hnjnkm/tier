import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { EnvHttpProxyAgent, fetch } from 'undici';
import sharp from 'sharp';
import type { Portrait } from '../src/types';

const target = 'src/data/portraits.json';
const catalog = JSON.parse(await readFile(target, 'utf8')) as { portraits: Record<string, Portrait & { localPath?: string }> };
const entries = Object.entries(catalog.portraits).filter(([id]) => id !== 'kr-gil' || !catalog.portraits[id].url.includes('/3213.jpg'));
await mkdir('public/portraits', { recursive: true });
const dispatcher = new EnvHttpProxyAgent();
let next = 0, done = 0;
const failures: { id: string; error: string }[] = [];
const metadata: Record<string, unknown> = {};
async function worker() {
  while (next < entries.length) {
    const [id, portrait] = entries[next++];
    try {
      if (portrait.localPath) {
        const existing = await readFile(`public/${portrait.localPath}`).catch(() => null);
        if (existing && (await sharp(existing).metadata()).width === 256) { done++; continue; }
      }
      let lastError: Error | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const source = new URL(portrait.url);
          if (source.hostname === 'upload.wikimedia.org') source.search = '';
          const response = await fetch(source, { dispatcher, signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'my-tier/0.1 (+https://github.com/hnjnkm/tier)' } });
          if (!response.ok) throw new Error(`Photo HTTP ${response.status}`);
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.length > 5_000_000) throw new Error('Photo exceeds size limit');
          const original = await sharp(bytes).metadata();
          if (!original.width || !original.height || original.width < 100 || original.height < 100) throw new Error('Photo resolution is too small');
          const stats = await sharp(bytes).stats();
          if (stats.entropy < 1) throw new Error('Blank provider image');
          const photo = sharp(bytes).rotate();
          if (portrait.crop) photo.extract(portrait.crop);
          const image = await photo.resize(256, 256, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 82 }).toBuffer();
          const hash = createHash('sha256').update(image).digest('hex');
          const localPath = `portraits/${id}.${hash.slice(0, 12)}.webp`;
          await writeFile(`public/${localPath}`, image);
          portrait.localPath = localPath;
          metadata[id] = { hash, originalWidth: original.width, originalHeight: original.height, entropy: stats.entropy };
          lastError = undefined; break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 700));
        }
      }
      if (lastError) throw lastError;
    } catch (error) { failures.push({ id, error: error instanceof Error ? error.message : String(error) }); }
    done++;
    if (done % 100 === 0) console.log(`Photos ${done}/${entries.length}, ${failures.length} failed`);
  }
}
try {
  await Promise.all(Array.from({ length: 8 }, worker));
  await writeFile(target, JSON.stringify(catalog, null, 2) + '\n');
  await writeFile('/tmp/tier-portrait-cache-report.json', JSON.stringify({ failures, metadata }, null, 2));
  console.log(`Cached ${Object.values(catalog.portraits).filter(portrait => portrait.localPath).length} portraits; ${failures.length} failed`);
} finally { await dispatcher.close(); }
