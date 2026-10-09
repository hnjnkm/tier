import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../src/data/artists';
import { artistFromMusicBrainz, chooseITunesArtist, createMediaService, DataError, songsFromITunes } from '../server/media';
import { createApp } from '../server/app';
import type { AddressInfo } from 'node:net';

const IU = CATALOG.find(artist => artist.id === 'kr-iu')!;
const artist = { wrapperType: 'artist', artistType: 'Artist', artistName: 'IU', artistId: 409076846, primaryGenreName: 'K-Pop' };
const track = { wrapperType: 'track', kind: 'song', trackId: 120, trackName: 'Palette', artistId: 409076846, artistName: 'IU', collectionName: 'Palette', artworkUrl100: 'https://is1-ssl.mzstatic.com/a/100x100bb.jpg', releaseDate: '2017-04-21T00:00:00Z' };

test('artist resolution prefers the Korean catalog and rejects ambiguous or unrelated names', () => {
  assert.equal(chooseITunesArtist(IU, [{ ...artist, artistId: 1, primaryGenreName: 'Rock' }, artist]), 409076846);
  assert.throws(() => chooseITunesArtist(IU, [{ ...artist, artistName: 'Someone Else' }]), DataError);
  assert.throws(() => chooseITunesArtist(IU, [artist, { ...artist, artistId: 2 }]), /동명이인/);
});

test('song results exclude other artists, albums, duplicate tracks and insecure URLs', () => {
  const songs = songsFromITunes([track, track, { ...track, trackId: 121, artistId: 1 }, { ...track, kind: 'music-video' }, { ...track, trackId: 122, previewUrl: 'http://unsafe.test/file' }], 409076846);
  assert.equal(songs.length, 2);
  assert.equal(songs[0].artwork, 'https://is1-ssl.mzstatic.com/a/300x300bb.jpg');
  assert.equal(songs[0].year, '2017');
  assert.equal(songs[1].previewUrl, undefined);
});

test('MusicBrainz aliases use the Korean name without inventing group gender', () => {
  const data = { id: '12345678-1234-1234-1234-123456789abc', name: 'Example', type: 'Group', country: 'KR', aliases: [{ name: '예시', locale: 'ko', primary: true }] };
  const result = artistFromMusicBrainz(data);
  assert.equal(result?.name, '예시'); assert.equal(result?.gender, 'unknown');
  assert.equal(artistFromMusicBrainz({ ...data, type: 'Person', gender: 'Female' })?.gender, 'female');
  const korean = artistFromMusicBrainz({ ...data, name: '김필', type: 'Person', gender: 'male', aliases: [{ name: 'Kim Feel' }] });
  assert.equal(korean?.name, '김필'); assert.equal(korean?.englishName, 'Kim Feel'); assert.equal(korean?.gender, 'male');
});

test('provider service deduplicates in-flight requests and limits title search to the same artist', async () => {
  let count = 0;
  const service = createMediaService(async url => {
    count++;
    assert.equal(url.hostname, 'itunes.apple.com');
    assert.equal(url.searchParams.get('country'), 'US');
    return { results: url.searchParams.get('entity') === 'musicArtist' ? [artist] : url.searchParams.get('term') === 'Other' ? [] : [track, { ...track, trackId: 199, artistId: 7 }] };
  });
  const [first, second] = await Promise.all([service.getSongs('kr-iu'), service.getSongs('kr-iu')]);
  assert.deepEqual(first, second); assert.equal(first.length, 1); assert.equal(count, 2);
  assert.equal((await service.getSongs('kr-iu', 'Palette')).length, 1);
  assert.equal((await service.getSongs('kr-iu', 'Other')).length, 0);
});

test('Korean song searches retain provider matches with an English display title', async () => {
  const service = createMediaService(async url => ({ results: url.searchParams.get('entity') === 'musicArtist' ? [artist] : [{ ...track, trackName: 'Through the Night' }] }));
  const songs = await service.getSongs('kr-iu', '밤편지');
  assert.equal(songs[0].title, 'Through the Night');
});

test('Wikipedia redirects resolve to explicit artist page thumbnails', async () => {
  const service = createMediaService(async url => {
    assert.equal(url.hostname, 'en.wikipedia.org');
    return { query: { redirects: [{ from: 'IU (singer)', to: 'IU' }], pages: { '1': { title: 'IU', fullurl: 'https://en.wikipedia.org/wiki/IU', thumbnail: { source: 'https://upload.wikimedia.org/example.jpg' } } } } };
  });
  const portraits = await service.getPortraits(['kr-iu']);
  assert.equal(portraits['kr-iu'].pageUrl, 'https://en.wikipedia.org/wiki/IU');
  assert.equal(portraits['kr-iu'].url, 'https://upload.wikimedia.org/example.jpg');
});

test('fallback portraits require a matching name and a Korean music identity', async () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  for (const [description, expected] of [['South Korean singer', 1], ['South Korean martial artist', 0], ['American singer', 0]] as const) {
    const service = createMediaService(async url => {
      if (url.hostname === 'musicbrainz.org') return { id, name: 'Kim Feel', type: 'Person', relations: [], aliases: [] };
      return { query: { pages: { '1': { title: 'Kim Feel', fullurl: 'https://en.wikipedia.org/wiki/Kim_Feel', terms: { description: [description] }, thumbnail: { source: 'https://thumb.wikimedia.org/portrait.jpg' } } } } };
    });
    const portraits = await service.getPortraits([`mb:${id}`]);
    assert.equal(Object.keys(portraits).length, expected);
    if (expected) assert.equal(portraits[`mb:${id}`].url, 'https://upload.wikimedia.org/portrait.jpg');
  }
});

test('actual API routes return catalog and songs, validate inputs, and report provider failures', async () => {
  const media = createMediaService(async url => {
    if (url.hostname === 'en.wikipedia.org') throw new DataError('사진 연결 실패');
    return { results: url.searchParams.get('entity') === 'musicArtist' ? [artist] : [track] };
  });
  const server = createApp(media).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const health = await fetch(`${base}/api/health`).then(response => response.json());
    assert.equal(health.status, 'ok'); assert.equal(health.catalogCount, CATALOG.length);
    const songs = await fetch(`${base}/api/artists/kr-iu/songs`).then(response => response.json());
    assert.equal(songs.songs[0].title, 'Palette');
    assert.equal((await fetch(`${base}/api/artists/search?q=x`)).status, 400);
    const portraits = await fetch(`${base}/api/portraits?ids=kr-iu`);
    assert.equal(portraits.status, 502); assert.equal((await portraits.json()).error, '사진 연결 실패');
    assert.equal((await fetch(`${base}/api/not-found`)).status, 404);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
