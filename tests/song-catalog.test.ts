import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMediaService } from '../src/media';
import { createBrowserApi } from '../src/browser-media';
import { mergeMusicFamily, selectedSong, songAlbums, validateSongCatalog, visibleSongs } from '../src/song-catalog';
import { createBoard, parseBoard, toggleSong } from '../src/domain';
import type { Song, SongCatalog } from '../src/types';
import { parseBugsAlbum } from '../scripts/bugs-catalog';
import { parseMelonAlbum, parseMelonSongs, melonLastOffset } from '../scripts/melon-catalog';

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

test('domestic supplements require the reviewed artist ID and reject foreign credits or a mislabeled source', () => {
  const song: Song = { id: 'bugs:80371845', title: '비가', album: 'Smoothy', artistName: '혜미', artistId: 80023572, url: 'https://music.bugs.co.kr/track/80371845', locale: 'ko-KR' };
  const supplement: SongCatalog = { source: 'bugs', artistId: 'kr-kimhyemijazzsinger', bugsArtistId: 80023572, reason: 'youtube-catalog-unavailable', updatedAt: catalog.updatedAt, complete: true, songs: [song] };
  assert.deepEqual(validateSongCatalog(supplement, supplement.artistId), supplement);
  assert.throws(() => validateSongCatalog({ ...supplement, bugsArtistId: 3213 }, supplement.artistId), /검증된/);
  assert.throws(() => validateSongCatalog({ ...supplement, songs: [{ ...song, artistId: 3213 }] }, supplement.artistId), /아티스트 연결/);
  assert.throws(() => validateSongCatalog({ ...supplement, source: 'youtube-music' }, supplement.artistId), /검증된/);
});

test('domestic album dates come from the release field and credits stay inside the requested album', () => {
  const row = (track: number, artist: number, album: number) => `<tr trackId="${track}" artistId="${artist}" albumId="${album}"><p class="title"><a title="비가"></a></p><a class="album" title="Smoothy"></a></tr>`;
  const html = `<link rel="canonical" href="https://music.bugs.co.kr/album/8030622"><header class="sectionPadding pgTitle"><h1>Smoothy</h1></header><table><th scope="row">발매일</th><td><time datetime="">2007.10.16</time></td></table>${row(1, 80023572, 8030622)}${row(2, 3213, 8030622)}${row(3, 80023572, 999)}`;
  const result = parseBugsAlbum(html, '8030622', 80023572, '혜미');
  assert.equal(result.length, 1); assert.equal(result[0].releaseDate, '2007-10-16'); assert.equal(result[0].year, '2007'); assert.equal(result[0].trackNumber, 1);
  assert.throws(() => parseBugsAlbum(html, '999', 80023572, '혜미'), /Wrong album/);
  assert.equal(result[0].album, 'Smoothy');
});

test('Melon supplements require the independently reviewed ID and keep album credits and release dates', () => {
  const row = (artist: number, song: number) => `<tr><input title="존재의&nbsp;이유 곡 선택"><a href="javascript:melon.link.goSongDetail('${song}');"></a><a href="javascript:melon.link.goArtistDetail('${artist}');"></a><a href="javascript:melon.link.goAlbumDetail('11605354');" title="김종환 히트곡 낭송집 - 페이지 이동"></a></tr>`;
  const html = `<meta property="og:url" content="http://www.melon.com/album/detail.htm?albumId=11605354"><div class="song_name"><strong class="none">앨범명</strong>김종환 히트곡 낭송집</div><dt>발매일</dt><dd>2024.10.02</dd>${row(999, 1)}${row(1107, 38058482)}`;
  const tracks = parseMelonAlbum(html, '11605354', 1107, '김종환');
  assert.equal(tracks.length, 1); assert.equal(tracks[0].title, '존재의 이유');
  assert.equal(tracks[0].trackNumber, 2); assert.equal(tracks[0].releaseDate, '2024-10-02');
  const supplement: SongCatalog = { source: 'melon', artistId: 'kr-kimjonghwan', melonArtistId: 1107, reason: 'youtube-catalog-unavailable', updatedAt: catalog.updatedAt, complete: true, songs: tracks };
  assert.equal(validateSongCatalog(supplement, supplement.artistId), supplement);
  assert.throws(() => validateSongCatalog({ ...supplement, melonArtistId: 1760602 }, supplement.artistId), /검증된/);
  assert.throws(() => validateSongCatalog({ ...supplement, songs: [{ ...tracks[0], artistId: 1760602 }] }, supplement.artistId), /아티스트 연결/);
  assert.throws(() => parseMelonAlbum(html, '999', 1107, '김종환'), /Wrong/);
  assert.equal(parseMelonSongs(html, 1107, '김종환').length, 1);
  assert.equal(melonLastOffset("sendPage(\\'501\\')"), 501);
});

test('group collections retain unit credits, combine album tracks, and reject unrelated singers', () => {
  const secondChannel = `UC${'b'.repeat(22)}`;
  const first: SongCatalog = { ...catalog, artistId: 'kr-nct127', songs: [{ ...songs[0], albumId: 'shared-release', artistName: 'NCT 127', popularityRank: 0 }] };
  const second: SongCatalog = { ...catalog, artistId: 'kr-nctdream', channelId: secondChannel, songs: [{ ...songs[1], artistId: secondChannel, albumId: 'shared-release', artistName: 'NCT DREAM', popularityRank: 0 }] };
  const merged = mergeMusicFamily('kr-nct', [first, second]);
  assert.equal(merged.songs.length, 2); assert.deepEqual(merged.songs.map(song => song.artistId), [channel, secondChannel]);
  assert.equal(merged.albums![0].songIds.length, 2);
  assert.throws(() => mergeMusicFamily('kr-nct', [catalog]), /Unexpected/);
  assert.throws(() => validateSongCatalog({ ...merged, songs: [{ ...merged.songs[0], artistId: `UC${'c'.repeat(22)}` }] }, 'kr-nct'), /아티스트 연결/);
});
