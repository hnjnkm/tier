export const TIERS = ['S', 'A', 'B', 'C', 'D', 'E', 'F'] as const;
export type Tier = typeof TIERS[number];
export type Gender = 'male' | 'female' | 'mixed' | 'unknown';
export const GENRE_LABELS = {
  ballad: '발라드', hiphop: '힙합', rock: '록 · 메탈', rnb: 'R&B · 소울',
  indie: '인디', dance: '댄스 · 팝', trot: '트로트', folk: '포크 · 어쿠스틱',
  jazz: '재즈', crossover: '클래식 · 크로스오버', gugak: '국악 · 퓨전',
} as const;
export type Genre = keyof typeof GENRE_LABELS;
export interface Artist {
  id: string;
  name: string;
  englishName: string;
  aliases: string[];
  searchAliases?: string[];
  gender: Gender;
  kind: 'solo' | 'group';
  wikiTitle?: string;
  musicBrainzId?: string;
  itunesId?: number;
  genres?: Genre[];
  legacy?: boolean;
  source: 'catalog' | 'musicbrainz';
}
export interface Portrait {
  url: string;
  pageUrl: string;
  title: string;
  provider?: 'bugs' | 'wikimedia';
}
export interface Song {
  id: string;
  title: string;
  artistName: string;
  artistId: number;
  album: string;
  artwork?: string;
  previewUrl?: string;
  url?: string;
  year?: string;
}
export interface Board {
  version: 1;
  title: string;
  customArtists: Artist[];
  tiers: Record<Tier, string[]>;
  favorites: Record<string, Song[]>;
}
