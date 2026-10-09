import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMediaService } from '../src/media';
import { createBrowserApi } from '../src/browser-media';
import { selectedSong, songAlbums, validateSongCatalog, visibleSongs } from '../src/song-catalog';
import { createBoard, parseBoard, toggleSong } from '../src/domain';
import type { Song, SongCatalog } from '../src/types';

const channel = `UC${'a'.repeat(22)}`;
const songs: Song[] = Array.from({ length: 325 }, (_, index) => ({ id: `youtube:video${String(index).padStart(6, '0')}`, title: index === 324 ? '검색으로 찾은 마지막 곡' : `곡 ${index}`,
  artistName: '아이유', artistId: channel, album: index < 200 ? '첫 앨범' : '새 앨범', albumId: index < 200 ? 'album-old' : 'album-new',
  year: index < 200 ? '2017' : '2026', trackNumber: index + 1, popularityRank: 325 - index, locale: 'ko-KR', url: `https://music.youtube.com/watch?v=video${String(index).padStart(6, '0')}` }));
const catalog: SongCatalog = { source: 'youtube-music', artistId: 'kr-iu', channelId: channel, updatedAt: '2026-10-10T00:00:00Z', complete: true, songs };

test('YouTube Music uses verified channel catalogs, retains more than 200 songs, and searches the last song without provider calls', async () => {
  let loads = 0;
  const media = createMediaService(async () => { throw new Error('Name-based lookup must not run'); }, {}, async () => { loads++; return catalog; });
  const [first, second] = await Promise.all([media.getSongs('kr-iu'), media.getSongs('kr-iu')]);
  assert.equal(first.length, 325); assert.deepEqual(first, second); assert.equal(loads, 1);
  assert.deepEqual(await media.getSongs('kr-iu', '마지막'), [songs[324]]); assert.equal(loads, 1);
  assert.throws(() => validateSongCatalog({ ...catalog, artistId: 'kr-gil' }, 'kr-iu'), /올바르지/);
  assert.throws(() => validateSongCatalog({ ...catalog, songs: [{ ...songs[0], artistId: `UC${'b'.repeat(22)}` }] }, 'kr-iu'), /아티스트 연결/);
});

test('Pages fetches the same-origin catalog and reports missing catalogs instead of guessing namesakes', async () => {
  let requests = 0;
  const api = createBrowserApi(async input => { assert.equal(String(input), '/music/kr-iu.json'); requests++; return Response.json(catalog); });
  const data = await api('/api/artists/kr-iu/songs?q=마지막');
  assert.equal(data.source, 'youtube-music'); assert.deepEqual(data.songs, [songs[324]]); assert.equal(requests, 1);
  const unavailable = createBrowserApi(async () => new Response('', { status: 404 }));
  await assert.rejects(unavailable('/api/artists/kr-gil/songs'), { code: 'CATALOG_UNAVAILABLE' });
});

test('popular, latest, and album order have defined results and album filtering retains every track', () => {
  assert.equal(visibleSongs(songs, '', 'popular')[0].id, songs[324].id);
  assert.equal(visibleSongs(songs, '', 'latest')[0].year, '2026');
  const albums = songAlbums(songs);
  const old = albums.find(album => album.id === 'album-old')!;
  assert.equal(visibleSongs(songs, '', 'album', old).length, 200);
  assert.equal(visibleSongs(songs, '', 'album', old)[0].trackNumber, 1);
  assert.equal(visibleSongs(songs, '마지막', 'popular', old).length, 0);
});

test('saved Korean iTunes choices can be removed through matching YouTube rows and survive export/import', () => {
  const song: Song = { ...songs[0], title: '그때 헤어지면 돼', album: '그때 헤어지면 돼' };
  const previous: Song = { ...song, id: 'itunes:123', artistId: 572430917, album: '그때 헤어지면 돼 - Single' };
  assert.equal(selectedSong(song, [previous]), previous);
  assert.equal(selectedSong({ ...song, album: '라이브' }, [previous]), undefined);
  const board = toggleSong(createBoard(), 'kr-roy-kim', song);
  assert.deepEqual(parseBoard(JSON.parse(JSON.stringify(board))), board);
});
