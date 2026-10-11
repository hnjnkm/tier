import type { Artist } from './types';

export const UNKNOWN_FACET = 'unknown';
export const ERA_LABELS = {
  before1950: '1950년대 이전', '1950': '1950년대', '1960': '1960년대',
  '1970': '1970년대', '1980': '1980년대', '1990': '1990년대',
  '2000': '2000년대', '2010': '2010년대', '2020': '2020년대', unknown: '미확인',
} as const;
export type Era = keyof typeof ERA_LABELS;
export const ERA_ORDER: Era[] = ['before1950', '1950', '1960', '1970', '1980', '1990', '2000', '2010', '2020', 'unknown'];
export const validFacetYear = (year: unknown): year is number => Number.isInteger(year) && Number(year) >= 1800 && Number(year) <= new Date().getFullYear();
export function artistEra(artist: Artist): Era {
  const year = artist.debutYear ?? artist.careerStartYear;
  if (!validFacetYear(year)) return UNKNOWN_FACET;
  const decade = year < 1950 ? 'before1950' : String(Math.floor(year / 10) * 10);
  return Object.hasOwn(ERA_LABELS, decade) ? decade as Era : UNKNOWN_FACET;
}
const regions = new Intl.DisplayNames(['ko'], { type: 'region' });
const historical: Record<string, string> = { YU: '유고슬라비아', SU: '소련', AN: '네덜란드령 앤틸리스' };
export const countryLabel = (code: string) => code === UNKNOWN_FACET ? '미확인' : historical[code] ?? regions.of(code) ?? code;
export function countryOptions(artists: Artist[]): string[] {
  const counts = new Map<string, number>();
  for (const artist of artists) {
    for (const code of new Set(artist.countries?.length ? artist.countries : [UNKNOWN_FACET])) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.keys()].sort((a, b) => a === UNKNOWN_FACET ? 1 : b === UNKNOWN_FACET ? -1 : counts.get(b)! - counts.get(a)! || countryLabel(a).localeCompare(countryLabel(b), 'ko'));
}
export function matchesFacets(artist: Artist, countries: string[] = [], eras: Era[] = []) {
  const origins = artist.countries?.length ? artist.countries : [UNKNOWN_FACET];
  return (!countries.length || countries.some(country => origins.includes(country))) && (!eras.length || eras.includes(artistEra(artist)));
}
