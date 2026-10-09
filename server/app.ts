import express from 'express';
import { CATALOG } from '../src/data/artists';
import { DataError, createMediaService, parseSongIds, type MediaService } from './media';
import { getAsset } from './assets';

export function createApp(media: MediaService = createMediaService()) {
  const app = express();
  app.disable('x-powered-by');
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', catalogCount: CATALOG.length }));
  app.get('/api/catalog', (_req, res) => res.json({ artists: CATALOG }));
  for (const kind of ['image', 'audio'] as const) app.get(`/api/${kind}`, async (req, res, next) => {
    try {
      const asset = await getAsset(req.query.url, kind);
      res.set('Cache-Control', 'public, max-age=86400').set('X-Content-Type-Options', 'nosniff').type(asset.type).send(asset.bytes);
    } catch (error) { next(error); }
  });
  app.get('/api/artists/search', async (req, res, next) => {
    try {
      const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (query.length < 2 || query.length > 100) return res.status(400).json({ error: '검색어는 2~100자로 입력해 주세요.' });
      res.json({ artists: await media.searchArtists(query), source: 'musicbrainz' });
    } catch (error) { next(error); }
  });
  app.get('/api/portraits', async (req, res, next) => {
    try {
      const ids = typeof req.query.ids === 'string' ? [...new Set(req.query.ids.split(','))] : [];
      if (!ids.length || ids.length > 40 || ids.some(id => id.length > 100)) return res.status(400).json({ error: '사진 요청이 올바르지 않아요.' });
      res.json({ portraits: await media.getPortraits(ids), source: 'wikipedia' });
    } catch (error) { next(error); }
  });
  app.get('/api/artists/:id/songs', async (req, res, next) => {
    try {
      const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (query.length > 100) return res.status(400).json({ error: '검색어는 100자 이하로 입력해 주세요.' });
      const catalog = await media.getSongCatalog(req.params.id);
      res.json({ ...catalog, songs: query ? await media.getSongs(req.params.id, query) : catalog.songs });
    } catch (error) { next(error); }
  });
  app.get('/api/songs/localize', async (req, res, next) => {
    try { res.json({ songs: await media.localizeSongs(parseSongIds(req.query.ids)), source: 'apple-music-kr' }); }
    catch (error) { next(error); }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: '요청한 경로를 찾지 못했어요.' }));
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof DataError) return res.status(error.status).json({ error: error.message, code: error.code });
    console.error('Unexpected API error:', error.message);
    res.status(500).json({ error: '데이터를 불러오지 못했어요. 다시 시도해 주세요.', code: 'INTERNAL_ERROR' });
  });
  return app;
}
