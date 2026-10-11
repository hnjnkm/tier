import data from './global-artists.json';
import type { Artist } from '../types';

// Identity proof songs are used by the refresh tools, not the discovery UI.
export const GLOBAL_ARTISTS = data.map(({ proofSongs: _proof, ...artist }) => artist) as Artist[];
