import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTIONS } from '../src/collections';
import { GLOBAL_ARTISTS } from '../src/data/global-artists';
import { allArtists, createBoard, matchesFilters, moveArtist, parseBoard, toggleSong } from '../src/domain';
import { createBrowserApi } from '../src/browser-media';
import type { Song } from '../src/types';

const song: Song = { id: 'youtube:video000001', title: 'Love Story', artistName: 'Taylor Swift', artistId: `UC${'a'.repeat(22)}`, album: 'Fearless', locale: 'ko-KR', url: 'https://music.youtube.com/watch?v=video000001' };

test('legacy Korean boards preserve placements, favorites, title and storage key', () => {
  const saved = toggleSong(moveArtist(createBoard(), 'kr-iu', 'F'), 'kr-iu', { ...song, artistName: '아이유' });
  assert.deepEqual(parseBoard(JSON.parse(JSON.stringify(saved))), saved);
  assert.equal(COLLECTIONS.korean.storageKey, 'my-tier.board.v1');
  assert.notEqual(COLLECTIONS.global.storageKey, COLLECTIONS.korean.storageKey);
  assert.ok(!Object.hasOwn(saved, 'collection'));
});

test('international boards retain their collection on export and reject cross-chart placements', () => {
  const saved = toggleSong(moveArtist(createBoard('global'), 'global-taylor-swift', 'S'), 'global-taylor-swift', song);
  assert.deepEqual(parseBoard(JSON.parse(JSON.stringify(saved))), saved);
  assert.equal(saved.collection, 'global');
  assert.equal(parseBoard({ ...saved, collection: undefined }), null);
  assert.equal(parseBoard({ ...saved, collection: 'not-a-chart' }), null);
  assert.equal(parseBoard({ ...saved, tiers: { ...saved.tiers, F: ['kr-iu'] } }), null);
  assert.equal(parseBoard({ ...createBoard(), favorites: saved.favorites }), null);
  assert.equal(moveArtist(saved, 'kr-iu', 'S'), saved);
  assert.equal(moveArtist(createBoard(), 'global-taylor-swift', 'S').tiers.S.length, 0);
});

test('each discovery catalog contains only its own artists with original names and Korean aliases', () => {
  const global = allArtists(createBoard('global'));
  assert.ok(global.length >= 100);
  assert.equal(new Set(global.map(artist => artist.id)).size, global.length);
  assert.ok(global.every(artist => artist.id.startsWith('global-') && artist.genres?.length));
  assert.ok(allArtists(createBoard()).every(artist => !artist.id.startsWith('global-')));
  const taylor = global.find(artist => artist.id === 'global-taylor-swift')!;
  assert.equal(taylor.name, 'Taylor Swift');
  assert.ok(matchesFilters(taylor, { query: '테일러', gender: 'female', kind: 'solo', genre: 'dance' }));
  assert.ok(!matchesFilters(taylor, { query: '', gender: 'male', kind: 'group', genre: 'rock' }));
  assert.equal(global.find(artist => artist.id === 'global-coldplay')?.kind, 'group');
  assert.equal(global.find(artist => artist.id === 'global-yoasobi')?.gender, 'mixed');
});

test('static foreign search scopes provider requests and caches separately from Korean search', async () => {
  const queries: string[] = [];
  const api = createBrowserApi(async input => {
    queries.push(new URL(String(input)).searchParams.get('query')!);
    return Response.json({ artists: [] });
  });
  await api('/api/artists/search?q=Example&collection=global');
  await api('/api/artists/search?q=Example');
  await api('/api/artists/search?q=Example&collection=global');
  assert.equal(queries.length, 2);
  assert.match(queries[0], /^NOT country:KR AND /);
  assert.match(queries[1], /^country:KR AND /);
  await assert.rejects(api('/api/artists/search?q=Example&collection=invalid'), { status: 400 });
});

test('static foreign songs load the artist catalog from the Pages subpath and keep provider names', async () => {
  const paths: string[] = [];
  const api = createBrowserApi(async input => {
    paths.push(String(input));
    return Response.json({ source: 'youtube-music', artistId: 'global-taylor-swift', channelId: song.artistId, updatedAt: '2026-10-11T00:00:00Z', complete: true, songs: [song] });
  });
  const result = await api('/api/artists/global-taylor-swift/songs?q=Love');
  assert.deepEqual(paths, ['/music/global-taylor-swift.json']);
  assert.ok('artistId' in result && result.songs);
  assert.equal(result.songs[0].artistName, 'Taylor Swift');
  assert.equal(result.songs[0].title, 'Love Story');
  assert.ok(GLOBAL_ARTISTS.some(artist => artist.id === result.artistId));
});
