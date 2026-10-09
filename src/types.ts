export const TIERS = ['S', 'A', 'B', 'C', 'D', 'E', 'F'] as const;
export type Tier = typeof TIERS[number];
export type Gender = 'male' | 'female' | 'mixed' | 'unknown';
export interface Artist {
  id: string;
  name: string;
  englishName: string;
  aliases: string[];
  gender: Gender;
  kind: 'solo' | 'group';
  wikiTitle?: string;
  musicBrainzId?: string;
  itunesId?: number;
  source: 'catalog' | 'musicbrainz';
}
export interface Portrait {
  url: string;
  pageUrl: string;
  title: string;
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
