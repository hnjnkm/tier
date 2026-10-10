import { readFile, writeFile } from 'node:fs/promises';
import { ALL_CATALOG_ARTISTS } from '../src/data/artists';
import extras from '../src/data/music-extra-artists.json';

const identities = JSON.parse(await readFile('src/data/identities.json', 'utf8')).artists;
await writeFile(process.argv[2] ?? '/tmp/tier-music-artists.json', JSON.stringify([...ALL_CATALOG_ARTISTS.map(artist => ({ ...artist, identity: identities[artist.id] })), ...extras], null, 2));
