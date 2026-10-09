import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../src/data/artists';
import { artistFromMusicBrainz, chooseITunesArtist, createMediaService, DataError, songsFromITunes } from '../server/media';
import { createApp } from '../server/app';
import type { AddressInfo } from 'node:net';

const IU = CATALOG.find(artist => artist.id === 'kr-iu')!;
const artist = { wrapperType: 'artist', artistType: 'Artist', artistName: 'IU', artistId: 409076846, primaryGenreName: 'K-Pop' };
const track = { wrapperType: 'track', kind: 'song', trackId: 120, trackName: 'Palette', artistId: 409076846, artistName: 'IU', collectionName: 'Palette', artworkUrl100: 'https://is1-ssl.mzstatic.com/a/100x100bb.jpg', releaseDate: '2017-04-21T00:00:00Z' };
const koreanTrack = { ...track, trackName: '팔레트', artistName: '아이유', collectionName: '팔레트' };

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

test('MusicBrainz keeps the provider name and Korean aliases without inventing group gender', () => {
  const data = { id: '12345678-1234-1234-1234-123456789abc', name: 'Example', type: 'Group', country: 'KR', aliases: [{ name: '예시', locale: 'ko', primary: true }] };
  const result = artistFromMusicBrainz(data);
  assert.equal(result?.name, 'Example'); assert.deepEqual(result?.aliases, ['예시']); assert.equal(result?.gender, 'unknown');
  assert.equal(artistFromMusicBrainz({ ...data, type: 'Person', gender: 'Female' })?.gender, 'female');
  const korean = artistFromMusicBrainz({ ...data, name: '김필', type: 'Person', gender: 'male', aliases: [{ name: 'Kim Feel' }] });
  assert.equal(korean?.name, '김필'); assert.equal(korean?.englishName, 'Kim Feel'); assert.equal(korean?.gender, 'male');
});

test('provider service deduplicates in-flight requests and limits title search to the same artist', async () => {
  let count = 0;
  const service = createMediaService(async url => {
    count++;
    assert.equal(url.hostname, 'itunes.apple.com');
    if (url.pathname === '/lookup') {
      assert.equal(url.searchParams.get('country'), 'KR');
      assert.equal(url.searchParams.get('lang'), 'ko_kr');
      assert.equal(url.searchParams.get('id'), '120');
      return { results: [koreanTrack] };
    }
    assert.equal(url.searchParams.get('country'), 'US');
    return { results: url.searchParams.get('entity') === 'musicArtist' ? [artist] : url.searchParams.get('term') === 'Other' ? [] : [track, { ...track, trackId: 199, artistId: 7 }] };
  });
  const [first, second] = await Promise.all([service.getSongs('kr-iu'), service.getSongs('kr-iu')]);
  assert.deepEqual(first, second); assert.equal(first.length, 1); assert.equal(count, 3);
  assert.equal(first[0].title, '팔레트'); assert.equal(first[0].artistName, '아이유'); assert.equal(first[0].album, '팔레트');
  assert.equal(first[0].locale, 'ko-KR');
  assert.equal((await service.getSongs('kr-iu', 'Palette')).length, 1);
  assert.equal((await service.getSongs('kr-iu', 'Other')).length, 0);
});

test('Korean title searches replace English aliases with official Korean regional metadata', async () => {
  const service = createMediaService(async url => ({ results: url.pathname === '/lookup' ? [{ ...koreanTrack, trackName: '밤편지' }] : url.searchParams.get('entity') === 'musicArtist' ? [artist] : [{ ...track, trackName: 'Through the Night' }] }));
  const songs = await service.getSongs('kr-iu', '밤편지');
  assert.equal(songs[0].title, '밤편지'); assert.equal(songs[0].artistName, '아이유'); assert.equal(songs[0].id, 'itunes:120');
  assert.equal(songs.length, 1);
});

test('regional lookup batches exact IDs and preserves official English titles and request order', async () => {
  const batches: number[][] = [];
  const service = createMediaService(async url => {
    assert.equal(url.pathname, '/lookup'); assert.equal(url.searchParams.get('country'), 'KR');
    const ids = url.searchParams.get('id')!.split(',').map(Number);
    batches.push(ids);
    return { results: [...ids.reverse().map(trackId => ({ ...koreanTrack, trackId, trackName: 'Love wins all' })), { ...koreanTrack, trackId: 9999 }] };
  });
  const ids = Array.from({ length: 201 }, (_, index) => 201 - index);
  const songs = await service.localizeSongs([...ids, ids[0]]);
  assert.deepEqual(batches.map(batch => batch.length), [100, 100, 1]);
  assert.deepEqual(songs.map(song => song.id), ids.map(id => `itunes:${id}`));
  assert.ok(songs.every(song => song.title === 'Love wins all' && song.locale === 'ko-KR'));
});

test('song discovery never substitutes unavailable Korean releases or another artist', async () => {
  const service = createMediaService(async url => ({ results: url.pathname === '/lookup' ? [{ ...koreanTrack, artistId: 7 }] : url.searchParams.get('entity') === 'musicArtist' ? [artist] : [track] }));
  assert.deepEqual(await service.getSongs('kr-iu'), []);
  const unavailable = createMediaService(async url => ({ results: url.pathname === '/lookup' ? [] : url.searchParams.get('entity') === 'musicArtist' ? [artist] : [track] }));
  assert.deepEqual(await unavailable.getSongs('kr-iu'), []);
});

test('song credits use the same official Korean music-site artist spelling as the catalog', async () => {
  const sg = { ...artist, artistId: 777, artistName: 'SG Wannabe' };
  const service = createMediaService(async url => ({ results: url.searchParams.get('entity') === 'musicArtist' ? [sg] : [{ ...track, artistId: 777, artistName: 'SG Wannabe', trackName: url.pathname === '/lookup' ? '살다가' : 'As I Live' }] }));
  const songs = await service.getSongs('kr-sgwannabe');
  assert.equal(songs[0].title, '살다가'); assert.equal(songs[0].artistName, 'SG워너비');
});

test('Wikipedia redirects resolve to explicit artist page thumbnails', async () => {
  const service = createMediaService(async url => {
    assert.equal(url.hostname, 'en.wikipedia.org');
    return { query: { redirects: [{ from: 'IU (singer)', to: 'IU' }], pages: { '1': { title: 'IU', fullurl: 'https://en.wikipedia.org/wiki/IU', thumbnail: { source: 'https://upload.wikimedia.org/example.jpg' } } } } };
  }, {});
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
    return { results: url.pathname === '/lookup' ? [koreanTrack] : url.searchParams.get('entity') === 'musicArtist' ? [artist] : [track] };
  }, {});
  const server = createApp(media).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const health = await fetch(`${base}/api/health`).then(response => response.json());
    assert.equal(health.status, 'ok'); assert.equal(health.catalogCount, CATALOG.length);
    const songs = await fetch(`${base}/api/artists/kr-iu/songs`).then(response => response.json());
    assert.equal(songs.songs[0].title, '팔레트'); assert.equal(songs.source, 'apple-music-kr');
    const localized = await fetch(`${base}/api/songs/localize?ids=120`).then(response => response.json());
    assert.equal(localized.songs[0].artistName, '아이유');
    for (const ids of ['', '-1', '0', 'abc', '9007199254740992', Array(101).fill('120').join(',')]) {
      assert.equal((await fetch(`${base}/api/songs/localize?ids=${ids}`)).status, 400);
    }
    assert.equal((await fetch(`${base}/api/artists/search?q=x`)).status, 400);
    const portraits = await fetch(`${base}/api/portraits?ids=kr-iu`);
    assert.equal(portraits.status, 502); assert.equal((await portraits.json()).error, '사진 연결 실패');
    assert.equal((await fetch(`${base}/api/not-found`)).status, 404);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
