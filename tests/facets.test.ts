import { test } from 'node:test';
import assert from 'node:assert/strict';
import { artistEra, countryLabel, countryOptions, matchesFacets, validFacetYear } from '../src/artist-facets';
import { GLOBAL_ARTISTS } from '../src/data/global-artists';
import facets from '../src/data/global-facets.json';
import identities from '../src/data/identities.json';
import { createBoard, matchesFilters, moveArtist, parseBoard, toggleSong } from '../src/domain';
import { artistFromMusicBrainz } from '../src/media';
import type { Artist, Song } from '../src/types';

const artist: Artist = { id: 'fixture', name: 'Fixture', englishName: 'Fixture', aliases: [], gender: 'female', kind: 'solo', source: 'catalog', genres: ['dance'] };
const filters = { query: '', gender: 'all', kind: 'all', genre: 'all' } as const;

test('countries and eras use OR within each category and AND between categories and existing filters', () => {
  const fixture = { ...artist, countries: ['GB', 'US'], debutYear: 1999, careerStartYear: 1988 };
  assert.ok(matchesFacets(fixture, ['US', 'JP'], ['1980', '1990']));
  assert.ok(!matchesFacets(fixture, ['JP'], ['1990']));
  assert.ok(!matchesFacets(fixture, ['US'], ['2000']));
  assert.ok(matchesFilters(fixture, { ...filters, genre: 'dance', gender: 'female', kind: 'solo', countries: ['US'], eras: ['1990'] }));
  assert.ok(!matchesFilters(fixture, { ...filters, genre: 'rock', countries: ['US'], eras: ['1990'] }));
  assert.ok(!matchesFilters(fixture, { ...filters, query: 'another artist', countries: ['US'], eras: ['1990'] }));
});

test('debut era prefers credited debut, uses a separate career-start fallback and keeps unknown artists discoverable', () => {
  assert.equal(artistEra({ ...artist, debutYear: 1999, careerStartYear: 1988 }), '1990');
  assert.equal(artistEra({ ...artist, careerStartYear: 2000 }), '2000');
  for (const [year, era] of [[1949, 'before1950'], [1950, '1950'], [1999, '1990'], [2000, '2000'], [2020, '2020']] as const) assert.equal(artistEra({ ...artist, debutYear: year }), era);
  assert.equal(artistEra(artist), 'unknown');
  assert.ok(matchesFacets(artist));
  assert.ok(matchesFacets({ ...artist, countries: [] }, ['unknown'], ['unknown']));
  assert.ok(!matchesFacets(artist, ['US']));
  assert.ok(!matchesFacets(artist, [], ['1990']));
});

test('country options include multiple citizenships, preserve unknown and use readable Korean labels', () => {
  assert.deepEqual(countryOptions([{ ...artist, countries: ['US', 'US'] }, { ...artist, countries: ['JP', 'US'] }, artist]), ['US', 'JP', 'unknown']);
  assert.equal(countryLabel('US'), '미국');
  assert.equal(countryLabel('GB'), '영국');
  assert.equal(countryLabel('YU'), '유고슬라비아');
  assert.equal(countryLabel('unknown'), '미확인');
});

test('MusicBrainz person birth dates never become debut dates, while group formation can supply a career start', () => {
  const data = { id: '12345678-1234-1234-1234-123456789abc', name: 'Example', country: 'US', 'life-span': { begin: '1989-12-13' } };
  const person = artistFromMusicBrainz({ ...data, type: 'Person' })!;
  assert.equal(artistEra(person), 'unknown');
  assert.equal(person.careerStartYear, undefined);
  assert.deepEqual(person.countries, ['US']);
  assert.equal(artistEra(artistFromMusicBrainz({ ...data, type: 'Group', 'life-span': { begin: '1998' } })!), '1990');
  assert.equal(artistFromMusicBrainz({ ...data, country: 'invalid', type: 'Group', 'life-span': { begin: '0000' } })?.countries, undefined);
});

test('new optional facets round-trip custom artists without changing legacy saves or accepting malformed data', () => {
  const custom = artistFromMusicBrainz({ id: '12345678-1234-1234-1234-123456789abc', name: 'Example', type: 'Group', country: 'CA', 'life-span': { begin: '1998' } })!;
  const board = moveArtist({ ...createBoard('global'), customArtists: [custom] }, custom.id, 'F');
  assert.deepEqual(parseBoard(JSON.parse(JSON.stringify(board))), board);
  const legacy = { ...board, customArtists: [{ ...custom, countries: undefined, careerStartYear: undefined }] };
  assert.ok(parseBoard(JSON.parse(JSON.stringify(legacy))));
  for (const invalid of [{ countries: ['unknown'] }, { countries: 'US' }, { debutYear: '1998' }, { debutYear: 2050 }, { careerStartYear: 0 }]) assert.equal(parseBoard({ ...board, customArtists: [{ ...custom, ...invalid }] }), null);
});

test('international facets map only to verified identities and keep music debuts distinct from acting careers', () => {
  assert.deepEqual(Object.keys(facets).sort(), GLOBAL_ARTISTS.map(artist => artist.id).sort());
  const pins = identities.artists as Record<string, { bugsId: string }>;
  for (const [id, meta] of Object.entries(facets)) {
    assert.equal(meta.sources.profile, `https://music.bugs.co.kr/artist/${pins[id].bugsId}`);
    assert.ok(meta.countries.every(code => /^[A-Z]{2}$/.test(code)), id);
    for (const key of ['debutYear', 'careerStartYear'] as const) if (key in meta) assert.ok(validFacetYear(meta[key as keyof typeof meta]), `${id} ${key}`);
  }
  const byId = (id: string) => GLOBAL_ARTISTS.find(artist => artist.id === id)!;
  assert.deepEqual(byId('global-bob-dylan').countries, ['US']);
  assert.equal(artistEra(byId('global-taylor-swift')), '2000');
  assert.equal(artistEra(byId('global-britney-spears')), '1990');
  assert.equal(artistEra(byId('global-olivia-rodrigo')), '2020');
  assert.equal(artistEra(byId('global-billie-eilish')), '2010');
  assert.equal(artistEra(byId('global-ado')), '2020');
  assert.equal(artistEra(byId('global-kenshi-yonezu')), '2010');
  assert.deepEqual(byId('global-keshi').countries, ['US']);
  assert.equal(byId('global-sleep-token').kind, 'group');
  assert.deepEqual(byId('global-sleep-token').countries, ['GB']);
  assert.ok(matchesFacets(byId('global-ac-dc'), ['AU'], ['1970']));
});

test('discovery filtering never mutates existing placements, favorites, title or exported JSON', () => {
  const song: Song = { id: 'youtube:video000001', title: 'Love Story', artistId: `UC${'a'.repeat(22)}`, artistName: 'Taylor Swift', album: 'Fearless', locale: 'ko-KR' };
  const board = toggleSong(moveArtist(createBoard('global'), 'global-taylor-swift', 'S'), 'global-taylor-swift', song);
  const before = JSON.stringify(board);
  const result = GLOBAL_ARTISTS.filter(artist => matchesFilters(artist, { ...filters, countries: ['AU'], eras: ['1970'] }));
  assert.ok(result.some(artist => artist.id === 'global-ac-dc'));
  assert.equal(JSON.stringify(board), before);
  assert.deepEqual(parseBoard(JSON.parse(before)), board);
});
