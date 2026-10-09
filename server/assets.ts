import { EnvHttpProxyAgent, fetch } from 'undici';
import { DataError } from './media';

const imageHosts = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org', 'is1-ssl.mzstatic.com', 'is2-ssl.mzstatic.com', 'is3-ssl.mzstatic.com', 'is4-ssl.mzstatic.com', 'is5-ssl.mzstatic.com']);
const audioHosts = new Set(['audio-ssl.itunes.apple.com']);
const agent = new EnvHttpProxyAgent();
interface Asset { bytes: Buffer; type: string }
const cache = new Map<string, Asset>();
const pending = new Map<string, Promise<Asset>>();

export function validateAssetUrl(raw: unknown, kind: 'image' | 'audio'): URL {
  if (typeof raw !== 'string' || raw.length > 2000) throw new DataError('올바르지 않은 미디어 주소예요.', 'INVALID_MEDIA', 400);
  let url: URL;
  try { url = new URL(raw); } catch { throw new DataError('올바르지 않은 미디어 주소예요.', 'INVALID_MEDIA', 400); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !(kind === 'image' ? imageHosts : audioHosts).has(url.hostname)) throw new DataError('지원하지 않는 미디어 주소예요.', 'INVALID_MEDIA', 400);
  return url;
}

export async function getAsset(raw: unknown, kind: 'image' | 'audio'): Promise<Asset> {
  const url = validateAssetUrl(raw, kind);
  const key = url.href;
  if (cache.has(key)) return cache.get(key)!;
  if (pending.has(key)) return pending.get(key)!;
  const promise = (async () => {
    const response = await fetch(url, { dispatcher: agent, redirect: 'error', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'my-tier/0.1 (+https://github.com/hnjnkm/tier)' } });
    const type = (response.headers.get('content-type') ?? '').split(';')[0];
    const supported = kind === 'image' ? /^image\/(jpeg|png|webp|avif|gif)$/.test(type) : /^audio\//.test(type) || type === 'video/mp4' || type === 'application/octet-stream';
    if (!response.ok || !supported || !response.body) throw new DataError('미디어를 불러오지 못했어요.');
    const chunks: Uint8Array[] = [];
    let length = 0;
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 5_000_000) { await reader.cancel(); throw new DataError('미디어 파일이 너무 커요.'); }
      chunks.push(value);
    }
    const asset = { bytes: Buffer.concat(chunks), type };
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, asset);
    return asset;
  })().catch(error => { throw error instanceof DataError ? error : new DataError('미디어를 불러오지 못했어요.'); }).finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
