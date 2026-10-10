"""Restore missing album years from exact YouTube Music release IDs.

Do not infer dates from upload dates, copyright notices, titles or view counts.
Existing catalogs and recording identities remain intact if metadata is absent.
"""
import argparse
import importlib.util
import json
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

spec = importlib.util.spec_from_file_location('refresh_music', Path(__file__).with_name('refresh-music.py'))
music = importlib.util.module_from_spec(spec)
spec.loader.exec_module(music)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=Path('/tmp/tier-ytmusic-cache'))
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    paths = [*sorted((music.ROOT / 'public/music').glob('kr-*.json')), *sorted((music.ROOT / 'public/music/group-bases').glob('*.json'))]
    catalogs = {path: json.loads(path.read_text()) for path in paths}
    needed = {album['id'] for data in catalogs.values() if data['source'] == 'youtube-music' for album in data.get('albums', []) if not album.get('year') and album['id'].startswith('MPRE')}
    local = threading.local()
    years = {}
    failed = []

    def collect(album_id):
        if not hasattr(local, 'builder'):
            local.builder = music.CatalogBuilder(music.PublicMetadataClient(), args.cache)
        try:
            album = local.builder.album(album_id)
            return album_id, str(album.get('year', '')), None
        except Exception as error:
            return album_id, '', type(error).__name__ + ': ' + str(error)[:120]

    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 8))) as executor:
        for index, future in enumerate(as_completed([executor.submit(collect, id) for id in sorted(needed)])):
            album_id, year, error = future.result()
            if re.fullmatch(r'\d{4}', year): years[album_id] = year
            if error: failed.append({'albumId': album_id, 'error': error})
            if (index + 1) % 100 == 0: print(f'Years {index + 1}/{len(needed)}: {len(years)} verified', flush=True)
    changed_albums = 0
    for path, data in catalogs.items():
        changed = False
        songs = {song['id']: song for song in data['songs']}
        for album in data.get('albums', []):
            for song_id in album['songIds']:
                if not songs[song_id].get('albumId'):
                    songs[song_id]['albumId'] = album['id']; changed = True
            year = album.get('year') or years.get(album['id'])
            if not year: continue
            if not album.get('year'):
                album['year'] = year; changed_albums += 1; changed = True
            for song_id in album['songIds']:
                song = songs[song_id]
                if not song.get('albumId'):
                    song['albumId'] = album['id']; changed = True
                if song.get('albumId') == album['id'] and not song.get('year'):
                    song['year'] = year; changed = True
        if changed: music.write_json(path, data)
    report = {'releasesChecked': len(needed), 'verifiedYears': len(years), 'albumsUpdated': changed_albums, 'failed': failed}
    music.write_json(Path('/tmp/tier-album-year-report.json'), report)
    print(f'Restored {changed_albums} album years; {len(failed)} unavailable releases preserved', flush=True)


if __name__ == '__main__': main()
