import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseBugsPortrait, parseBugsArtists } from '../scripts/bugs-portraits';
import { CATALOG } from '../src/data/artists';
import { createMediaService } from '../src/media';

const row = (id: number, name: string, type = '솔로 (남성)', genre = '발라드') => `<figure class="artistInfo"><a href="https://music.bugs.co.kr/artist/${id}"><img src="https://image.bugsm.co.kr/artist/images/130/68/${id}.jpg?version=20261009" /></a><figcaption><a class="artistTitle" title="${name}">${name}</a><span class="artistType">${type}</span><span class="artistGenre"><a>${genre}</a></span></figcaption></figure>`;

test('music service portraits use verified artist identities and actual artist photos', () => {
  const artist = CATALOG.find(artist => artist.id === 'kr-kim-bumsoo')!;
  const candidates = parseBugsArtists(row(6886, '김범수') + row(999, '김범수', '솔로 (여성)'));
  const portrait = chooseBugsPortrait(artist, candidates);
  assert.equal(portrait?.pageUrl, 'https://music.bugs.co.kr/artist/6886');
  assert.equal(portrait?.provider, 'bugs');
  assert.match(portrait!.url, /\/artist\/images\/500\//);
  assert.equal(parseBugsArtists(row(6886, '김범수').replace('image.bugsm.co.kr', 'image.bugsm.co.kr.evil.test')).length, 0);
});

test('ambiguous same-name singers are rejected, and parent-group members do not supply group portraits', () => {
  const singer = CATALOG.find(artist => artist.name === '김연우')!;
  assert.equal(chooseBugsPortrait(singer, parseBugsArtists(row(1, '김연우') + row(2, '김연우'))), null);
  const bts = CATALOG.find(artist => artist.id === 'kr-bts')!;
  assert.equal(chooseBugsPortrait(bts, parseBugsArtists(row(1, '정국'))), null);
});

test('preloaded official photos work offline without a Wikipedia lookup', async () => {
  const portrait = { url: 'https://image.bugsm.co.kr/artist/images/500/68/6886.jpg', pageUrl: 'https://music.bugs.co.kr/artist/6886', title: '김범수', provider: 'bugs' as const };
  const media = createMediaService(async () => { throw new Error('External request should not be needed'); }, { 'kr-kim-bumsoo': portrait });
  assert.deepEqual(await media.getPortraits(['kr-kim-bumsoo']), { 'kr-kim-bumsoo': portrait });
});

test('Gil and other name collisions stay pinned to their Korean profiles even when foreign candidates score higher', () => {
  const gil = CATALOG.find(artist => artist.id === 'kr-gil')!;
  const candidates = parseBugsArtists(row(3213, 'Gil(길)') + row(8008535, '길(Of Magic Mansion)'));
  assert.equal(chooseBugsPortrait(gil, candidates)?.pageUrl, 'https://music.bugs.co.kr/artist/8008535');
  assert.equal(chooseBugsPortrait(gil, parseBugsArtists(row(3213, 'Gil(길)'))), null);
  assert.equal(gil.name, '길');
});
