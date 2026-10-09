import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserApi } from '../src/browser-media';

test('static API enables MediaWiki CORS and never calls a local API server', async () => {
  const urls: URL[] = [];
  const api = createBrowserApi(async (input, options) => {
    const url = new URL(String(input));
    urls.push(url);
    assert.equal(url.protocol, 'https:');
    assert.equal(options?.credentials, 'omit');
    return Response.json({ query: { pages: { 1: { title: 'IU (singer)', thumbnail: { source: 'https://upload.wikimedia.org/iu.jpg' } } } } });
  }, {});
  const result = await api('/api/portraits?ids=kr-iu');
  assert.ok(result.portraits?.['kr-iu']);
  assert.equal(urls[0].hostname, 'en.wikipedia.org');
  assert.equal(urls[0].searchParams.get('origin'), '*');
  await assert.rejects(api('/api/artists/search?q=x'), /2~100/);
  await assert.rejects(api('/api/portraits?ids='), /올바르지/);
});

test('static provider errors preserve useful messages without exposing transport errors', async () => {
  const limited = createBrowserApi(async () => new Response('', { status: 429 }), {});
  await assert.rejects(limited('/api/portraits?ids=kr-iu'), { code: 'RATE_LIMITED', status: 429 });
  const failed = createBrowserApi(async () => { throw new Error('transport details'); }, {});
  await assert.rejects(failed('/api/portraits?ids=kr-iu'), /외부 음악 데이터를 연결하지 못했어요/);
});
