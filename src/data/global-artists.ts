import data from './global-artists.json';
import facets from './global-facets.json';
import type { Artist } from '../types';

// Identity proof songs are used by the refresh tools, not the discovery UI.
const metadata: Record<string, { countries: string[]; debutYear?: number; careerStartYear?: number }> = facets;
export const GLOBAL_ARTISTS = data.map(({ proofSongs: _proof, ...artist }) => {
  const info = metadata[artist.id];
  return { ...artist, ...(info ? { countries: info.countries, debutYear: info.debutYear, careerStartYear: info.careerStartYear } : {}) };
}) as Artist[];
