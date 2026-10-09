import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, LEGACY_ARTISTS } from '../src/data/artists';
import { allArtists, createBoard, findTier, localizeFavorites, matchesArtist, matchesFilters, moveArtist, normalize, parseBoard, toggleSong } from '../src/domain';
import type { Song } from '../src/types';

const song = (id: number): Song => ({ id: `itunes:${id}`, title: `Song ${id}`, artistId: 409076846, artistName: 'IU', album: 'Palette' });

test('saved song localization updates metadata without changing tiers, choices, order or previews', () => {
  const original = { ...moveArtist(createBoard(), 'kr-iu', 'S'), favorites: { 'kr-iu': [{ ...song(2), previewUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a' }, song(1)], 'kr-bts': [song(3)] } };
  const updated = localizeFavorites(original, [{ ...song(1), title: '팔레트', artistName: '아이유', album: '팔레트', locale: 'ko-KR' }, { ...song(2), title: '밤편지', artistName: '아이유', locale: 'ko-KR' }, { ...song(3), artistId: 7, locale: 'ko-KR' }]);
  assert.equal(updated.tiers, original.tiers); assert.equal(updated.title, original.title);
  assert.deepEqual(updated.favorites['kr-iu'].map(song => song.id), ['itunes:2', 'itunes:1']);
  assert.deepEqual(updated.favorites['kr-iu'].map(song => song.title), ['밤편지', '팔레트']);
  assert.equal(updated.favorites['kr-iu'][0].previewUrl, original.favorites['kr-iu'][0].previewUrl);
  assert.equal(updated.favorites['kr-bts'][0], original.favorites['kr-bts'][0]);
  assert.equal(localizeFavorites(updated, updated.favorites['kr-iu']), updated);
  assert.deepEqual(parseBoard(JSON.parse(JSON.stringify(updated))), updated);
  assert.deepEqual(original.favorites['kr-iu'].map(song => song.title), ['Song 2', 'Song 1']);
});

test('moving between tiers or back to the pool preserves exactly one placement', () => {
  let board = moveArtist(createBoard(), 'kr-iu', 'S');
  board = moveArtist(board, 'kr-iu', 'F');
  assert.equal(findTier(board, 'kr-iu'), 'F');
  assert.equal(board.tiers.S.length, 0);
  assert.equal(board.tiers.F.length, 1);
  board = moveArtist(board, 'kr-iu', 'pool');
  assert.equal(findTier(board, 'kr-iu'), undefined);
});

test('moving an artist preserves songs and can insert before a particular artist', () => {
  let board = moveArtist(createBoard(), 'kr-bts', 'A');
  board = toggleSong(board, 'kr-iu', song(1));
  board = moveArtist(board, 'kr-iu', 'A', 'kr-bts');
  assert.deepEqual(board.tiers.A, ['kr-iu', 'kr-bts']);
  assert.equal(board.favorites['kr-iu'][0].title, 'Song 1');
});

test('the fourth song cannot be equipped, removal frees a slot, and duplicates toggle off', () => {
  let board = createBoard();
  for (let id = 1; id <= 4; id++) board = toggleSong(board, 'kr-iu', song(id));
  assert.equal(board.favorites['kr-iu'].length, 3);
  assert.ok(!board.favorites['kr-iu'].some(item => item.id === 'itunes:4'));
  board = toggleSong(board, 'kr-iu', song(2));
  board = toggleSong(board, 'kr-iu', song(4));
  assert.deepEqual(board.favorites['kr-iu'].map(item => item.id), ['itunes:1', 'itunes:3', 'itunes:4']);
});

test('Korean, English and aliases all work with normalized search', () => {
  assert.ok(matchesArtist(CATALOG.find(artist => artist.id === 'kr-bigbang')!, 'G dragon'));
  assert.ok(matchesArtist(CATALOG.find(artist => artist.id === 'kr-blackpink')!, 'rose'));
  assert.ok(matchesArtist(CATALOG.find(artist => artist.id === 'kr-akmu')!, '악동뮤지션'));
  assert.ok(matchesArtist(CATALOG.find(artist => artist.id === 'kr-iu')!, '이지은'));
});

test('official stage names keep their spelling while Korean searches and saved placements still work', () => {
  const cases = [
    ['kr-sgwannabe', 'SG워너비', '에스지워너비'],
    ['kr-blackpink', 'BLACKPINK', '블랙핑크'],
    ['kr-day6', 'DAY6', '데이식스'],
    ['kr-aespa', 'aespa', '에스파'],
    ['kr-akmu', 'AKMU', '악동뮤지션'],
    ['kr-ph1', 'pH-1', '피에이치원'],
    ['kr-fx', 'f(x)', '에프엑스'],
    ['kr-yb', 'YB', '윤도현밴드'],
  ];
  for (const [id, name, query] of cases) {
    const artist = CATALOG.find(item => item.id === id)!;
    assert.equal(artist.name, name);
    assert.ok(matchesArtist(artist, query), query);
  }
  const saved = moveArtist(createBoard(), 'kr-sgwannabe', 'S');
  const restored = parseBoard(JSON.parse(JSON.stringify(saved)))!;
  assert.equal(findTier(restored, 'kr-sgwannabe'), 'S');
  assert.equal(allArtists(restored).find(artist => artist.id === 'kr-sgwannabe')?.name, 'SG워너비');
});

test('persisted data round-trips and corrupt or duplicated board data is rejected', () => {
  let board = moveArtist(createBoard(), 'kr-iu', 'S');
  board = toggleSong(board, 'kr-iu', song(1));
  assert.deepEqual(parseBoard(JSON.parse(JSON.stringify(board))), board);
  assert.equal(parseBoard({ ...board, tiers: { ...board.tiers, A: ['kr-iu'] } }), null);
  assert.equal(parseBoard({ ...board, favorites: { 'kr-iu': [song(1), song(1)] } }), null);
  assert.equal(parseBoard({ ...board, favorites: { 'kr-iu': [song(1), song(2), song(3), song(4)] } }), null);
  assert.equal(parseBoard({ ...board, favorites: { 'kr-iu': [{ ...song(1), artwork: 'javascript:alert(1)' }] } }), null);
  assert.equal(parseBoard({ ...board, customArtists: [{ id: 'mb:invalid' }] }), null);
});

test('catalog identities are unique and gender filters include mixed groups explicitly', () => {
  assert.equal(new Set(CATALOG.map(artist => artist.id)).size, CATALOG.length);
  assert.ok(CATALOG.length >= 850);
  assert.equal(new Set(CATALOG.map(artist => normalize(artist.name))).size, CATALOG.length);
  assert.equal(CATALOG.find(artist => artist.id === 'kr-akmu')?.gender, 'mixed');
  assert.equal(CATALOG.find(artist => artist.id === 'kr-blackpink')?.gender, 'female');
  assert.equal(CATALOG.find(artist => artist.id === 'kr-bts')?.gender, 'male');
});

test('discovery contains the four vocalists, bands and genres without splitting idol members', () => {
  for (const name of ['김범수', '나얼', '박효신', '이수', '김연우', '임재범', '허각', '노브레인', '비와이', '나윤선']) assert.ok(CATALOG.some(artist => artist.name === name), name);
  for (const id of ['kr-jung-kook', 'kr-jennie', 'kr-taeyeon', 'kr-nct127', 'kr-nctdream']) assert.ok(!CATALOG.some(artist => artist.id === id), id);
  for (const artist of CATALOG) assert.ok(artist.genres?.length, artist.name);
  const naul = CATALOG.find(artist => artist.id === 'kr-naul')!;
  assert.ok(matchesFilters(naul, { query: '나얼', gender: 'male', kind: 'solo', genre: 'ballad' }));
  assert.ok(matchesFilters(naul, { query: '', gender: 'all', kind: 'all', genre: 'rnb' }));
  assert.ok(!matchesFilters(naul, { query: '', gender: 'all', kind: 'all', genre: 'hiphop' }));
});

test('existing boards retain selected idol soloists and their songs after discovery consolidates groups', () => {
  const saved = { ...createBoard(), tiers: { ...createBoard().tiers, S: ['kr-jung-kook'], A: ['kr-rose'] }, favorites: { 'kr-jung-kook': [song(1)], 'kr-rose': [song(2)] } };
  const restored = parseBoard(saved);
  assert.deepEqual(restored, saved);
  assert.equal(findTier(restored!, 'kr-jung-kook'), 'S');
  assert.ok(allArtists(restored!).some(artist => artist.id === 'kr-jung-kook'));
  assert.ok(!allArtists(createBoard()).some(artist => artist.id === 'kr-jung-kook'));
  assert.ok(LEGACY_ARTISTS.some(artist => artist.id === 'kr-rose'));
});
