"""Rebuild existing verified channels with full participating OST albums.

Leaves the main collector's channel/status registry alone, so this can run
alongside initial collection of different, missing artists.
"""
import argparse
import importlib.util
import json
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

spec = importlib.util.spec_from_file_location('refresh_music', Path(__file__).with_name('refresh-music.py'))
music = importlib.util.module_from_spec(spec)
spec.loader.exec_module(music)

parser = argparse.ArgumentParser()
parser.add_argument('--artists', required=True, type=Path)
parser.add_argument('--workers', type=int, default=4)
args = parser.parse_args()
targets = []
for artist in json.loads(args.artists.read_text()):
    path = music.ROOT / 'public/music' / (artist['id'] + '.json')
    if not path.exists(): continue
    previous = json.loads(path.read_text())
    if previous.get('source') == 'youtube-music' and music.CHANNEL.fullmatch(previous.get('channelId', '')):
        targets.append((artist, previous['channelId']))

local = threading.local()
def collect(target):
    artist, channel = target
    try:
        if not hasattr(local, 'builder'):
            local.builder = music.CatalogBuilder(music.PublicMetadataClient(), Path('/tmp/tier-ytmusic-cache'))
        builder = local.builder
        channel, profile = builder.resolve(artist, channel)
        catalog = builder.build(artist, channel, profile)
        music.write_json(music.ROOT / 'public/music' / (artist['id'] + '.json'), catalog)
        return artist['id'], len(catalog['songs']), None
    except Exception as error:
        return artist['id'], None, f'{type(error).__name__}: {str(error)[:160]}'

failures = []
with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 4))) as executor:
    for index, future in enumerate(as_completed([executor.submit(collect, target) for target in targets])):
        artist_id, count, error = future.result()
        if error: failures.append({'id': artist_id, 'error': error})
        print(f'[{index + 1}/{len(targets)}] {artist_id}: {count if count else "previous catalog preserved"}', flush=True)
        music.write_json(Path('/tmp/tier-music-enrichment-report.json'), {'completed': index + 1, 'total': len(targets), 'failures': failures})
