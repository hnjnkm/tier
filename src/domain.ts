import { ALL_CATALOG_ARTISTS, CATALOG, LEGACY_ARTISTS } from './data/artists';
import { GENRE_LABELS, TIERS, type Artist, type Board, type Gender, type Genre, type Song, type Tier } from './types';

export const STORAGE_KEY = 'my-tier.board.v1';
export const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export const matchesArtist = (artist: Artist, query: string) => [artist.name, artist.englishName, ...artist.aliases, ...(artist.searchAliases ?? [])].some(name => normalize(name).includes(normalize(query)));
export const createBoard = (): Board => ({ version: 1, title: '나의 아티스트 티어', customArtists: [], tiers: { S: [], A: [], B: [], C: [], D: [], E: [], F: [] }, favorites: {} });
export const allArtists = (board: Board) => {
  const used = new Set([...TIERS.flatMap(tier => board.tiers[tier]), ...Object.keys(board.favorites).filter(id => board.favorites[id].length)]);
  return [...CATALOG, ...LEGACY_ARTISTS.filter(artist => used.has(artist.id)), ...board.customArtists];
};
export function matchesFilters(artist: Artist, filters: { query: string; gender: Gender | 'all'; kind: Artist['kind'] | 'all'; genre: Genre | 'all' }) {
  return matchesArtist(artist, filters.query) && (filters.gender === 'all' || artist.gender === filters.gender)
    && (filters.kind === 'all' || artist.kind === filters.kind) && (filters.genre === 'all' || artist.genres?.includes(filters.genre));
}
export const findTier = (board: Board, id: string): Tier | undefined => TIERS.find(tier => board.tiers[tier].includes(id));

export function moveArtist(board: Board, id: string, target: Tier | 'pool', beforeId?: string): Board {
  if (!allArtists(board).some(artist => artist.id === id)) return board;
  const tiers = Object.fromEntries(TIERS.map(tier => [tier, board.tiers[tier].filter(existing => existing !== id)])) as Board['tiers'];
  if (target !== 'pool') {
    const index = beforeId ? tiers[target].indexOf(beforeId) : -1;
    tiers[target].splice(index < 0 ? tiers[target].length : index, 0, id);
  }
  return { ...board, tiers };
}

export function toggleSong(board: Board, artistId: string, song: Song): Board {
  if (!allArtists(board).some(artist => artist.id === artistId)) return board;
  const current = board.favorites[artistId] ?? [];
  const exists = current.some(item => item.id === song.id);
  if (!exists && current.length >= 3) return board;
  return { ...board, favorites: { ...board.favorites, [artistId]: exists ? current.filter(item => item.id !== song.id) : [...current, song] } };
}

// Regional metadata changes must never change a saved song's identity or selection order.
export function localizeFavorites(board: Board, songs: Song[]): Board {
  const localized = new Map(songs.filter(song => song.locale === 'ko-KR').map(song => [song.id, song]));
  const artistNames = new Map(allArtists(board).map(artist => [artist.id, artist.name]));
  let changed = false;
  const favorites = Object.fromEntries(Object.entries(board.favorites).map(([id, selected]) => [id, selected.map(song => {
    const replacement = localized.get(song.id);
    if (!replacement || replacement.artistId !== song.artistId) return song;
    const updated = { ...song, ...replacement, artistName: artistNames.get(id) ?? replacement.artistName };
    for (const field of ['artwork', 'previewUrl', 'url', 'year'] as const) {
      const value = replacement[field] ?? song[field];
      if (value === undefined) delete updated[field];
      else updated[field] = value;
    }
    if (JSON.stringify(updated) === JSON.stringify(song)) return song;
    changed = true;
    return updated;
  })]));
  return changed ? { ...board, favorites } : board;
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, limit = 250): value is string => typeof value === 'string' && value.length > 0 && value.length <= limit;
const safeUrl = (value: unknown) => value === undefined || (typeof value === 'string' && /^https:\/\//.test(value) && value.length <= 2000);
function validArtist(value: unknown): value is Artist {
  return object(value) && text(value.id, 100) && /^mb:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.id) && text(value.name) && text(value.englishName)
    && Array.isArray(value.aliases) && value.aliases.length <= 30 && value.aliases.every(alias => text(alias))
    && (value.searchAliases === undefined || (Array.isArray(value.searchAliases) && value.searchAliases.length <= 100 && value.searchAliases.every(alias => text(alias))))
    && (value.genres === undefined || (Array.isArray(value.genres) && value.genres.length <= Object.keys(GENRE_LABELS).length && value.genres.every(genre => typeof genre === 'string' && Object.hasOwn(GENRE_LABELS, genre))))
    && ['male', 'female', 'mixed', 'unknown'].includes(String(value.gender)) && ['solo', 'group'].includes(String(value.kind))
    && value.source === 'musicbrainz' && (value.wikiTitle === undefined || text(value.wikiTitle))
    && (value.musicBrainzId === undefined || value.musicBrainzId === value.id.slice(3));
}
function validSong(value: unknown): value is Song {
  return object(value) && text(value.id, 100) && text(value.title) && text(value.artistName) && typeof value.album === 'string'
    && value.album.length <= 500 && ((Number.isSafeInteger(value.artistId) && Number(value.artistId) > 0) || (typeof value.artistId === 'string' && /^UC[\w-]{22}$/.test(value.artistId)))
    && safeUrl(value.artwork) && safeUrl(value.previewUrl) && safeUrl(value.url) && (value.year === undefined || /^\d{4}$/.test(String(value.year)))
    && (value.locale === undefined || value.locale === 'ko-KR')
    && (value.albumId === undefined || text(value.albumId, 100))
    && ['trackNumber', 'releaseOrder', 'popularityRank'].every(key => value[key] === undefined || (Number.isSafeInteger(value[key]) && Number(value[key]) >= 0))
    && (value.releaseDate === undefined || (typeof value.releaseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.releaseDate)));
}

// Imported/local data is untrusted; reject partial or malformed boards rather than silently losing songs.
export function parseBoard(value: unknown): Board | null {
  if (!object(value) || value.version !== 1 || !text(value.title, 80) || !Array.isArray(value.customArtists) || value.customArtists.length > 300 || !value.customArtists.every(validArtist)) return null;
  if (new Set(value.customArtists.map(artist => artist.id)).size !== value.customArtists.length || !object(value.tiers) || !object(value.favorites)) return null;
  const ids = new Set([...ALL_CATALOG_ARTISTS, ...value.customArtists].map(artist => artist.id));
  const seen = new Set<string>();
  for (const tier of TIERS) {
    const row = value.tiers[tier];
    if (!Array.isArray(row) || !row.every(id => typeof id === 'string' && ids.has(id) && !seen.has(id) && !!seen.add(id))) return null;
  }
  for (const [id, songs] of Object.entries(value.favorites)) {
    if (!ids.has(id) || !Array.isArray(songs) || songs.length > 3 || !songs.every(validSong) || new Set(songs.map(song => song.id)).size !== songs.length) return null;
  }
  const validatedTiers = value.tiers;
  return { version: 1, title: value.title, customArtists: value.customArtists, tiers: Object.fromEntries(TIERS.map(tier => [tier, validatedTiers[tier]])) as Board['tiers'], favorites: value.favorites as Board['favorites'] };
}
