import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, LEGACY_ARTISTS } from '../src/data/artists';
import { allArtists, createBoard, findTier, matchesArtist, matchesFilters, moveArtist, normalize, parseBoard, toggleSong } from '../src/domain';
import type { Song } from '../src/types';

const song = (id: number): Song => ({ id: `itunes:${id}`, title: `Song ${id}`, artistId: 409076846, artistName: 'IU', album: 'Palette' });

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
