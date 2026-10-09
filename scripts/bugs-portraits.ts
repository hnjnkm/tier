import type { Artist, Gender, Genre, Portrait } from '../src/types';
import identities from '../src/data/identities.json';

export interface BugsArtist {
  id: string; name: string; image: string; kind?: Artist['kind']; gender?: Gender; genres: Genre[];
}
const decode = (value: string) => value.replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi, entity => {
  const named: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
  if (named[entity]) return named[entity];
  return String.fromCodePoint(parseInt(entity.slice(entity[2] === 'x' ? 3 : 2, -1), entity[2] === 'x' ? 16 : 10));
});
const text = (html: string) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const genreNames: [RegExp, Genre][] = [
  [/발라드/, 'ballad'], [/힙합|랩/, 'hiphop'], [/록|메탈/, 'rock'], [/알앤비|소울/, 'rnb'],
  [/인디/, 'indie'], [/댄스|팝/, 'dance'], [/성인가요|트로트/, 'trot'], [/포크|어쿠스틱/, 'folk'],
  [/재즈/, 'jazz'], [/클래식|크로스오버/, 'crossover'], [/국악/, 'gugak'],
];

export function parseBugsArtists(html: string): BugsArtist[] {
  return [...html.matchAll(/<figure\b[^>]*class="[^"]*\bartistInfo\b[^"]*"[^>]*>([\s\S]*?)<\/figure>/g)].flatMap(match => {
    const row = match[1];
    const id = row.match(/https:\/\/music\.bugs\.co\.kr\/artist\/(\d+)/)?.[1];
    const name = row.match(/class="artistTitle"\s+title="([^"]+)"/)?.[1];
    const image = row.match(/<img\b[^>]*src="([^"]+)"/)?.[1];
    if (!id || !name || !image || !/^https:\/\/image\.bugsm\.co\.kr\/artist\/images\/\d+\//.test(image)) return [];
    const type = text(row.match(/class="artistType">([\s\S]*?)<\/span>/)?.[1] ?? '');
    const genre = text(row.match(/class="artistGenre">([\s\S]*?)<\/span>/)?.[1] ?? '');
    return [{ id, name: decode(name), image: decode(image), kind: /솔로/.test(type) ? 'solo' as const : /그룹|듀오/.test(type) ? 'group' as const : undefined,
      gender: /혼성/.test(type) ? 'mixed' as const : /여성/.test(type) ? 'female' as const : /남성/.test(type) ? 'male' as const : undefined,
      genres: genreNames.filter(([pattern]) => pattern.test(genre)).map(([, genre]) => genre) }];
  });
}

// Public profile pages verified against the artists and their discographies.
// Pins distinguish prominent artists from same-name records, including 김나박이.
const pinned: Record<string, string> = Object.fromEntries(Object.entries(identities.artists).map(([id, identity]) => [id, identity.bugsId]));
export const verifiedBugsId = (id: string) => pinned[id];

export function chooseBugsPortrait(artist: Artist, candidates: BugsArtist[]): Portrait | null {
  // A name, gender or genre score cannot establish a person's identity.
  // Registry IDs are reviewed independently of the current search results.
  if (!pinned[artist.id]) return null;
  const candidate = candidates.find(candidate => candidate.id === pinned[artist.id]
    && (!candidate.gender || artist.gender === 'unknown' || candidate.gender === artist.gender));
  if (!candidate) return null;
  return { url: candidate.image.replace(/\/artist\/images\/\d+\//, '/artist/images/500/'), pageUrl: `https://music.bugs.co.kr/artist/${candidate.id}`, title: candidate.name, provider: 'bugs' };
}
