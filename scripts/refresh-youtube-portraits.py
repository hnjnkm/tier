"""Collect profile images from discography-verified YouTube Music artists.

Writes candidates only. cache-portraits.ts --youtube downloads and validates
each image before replacing the existing portrait and its source together.
"""
import argparse
import importlib.util
import json
import re
import threading
import time
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

spec = importlib.util.spec_from_file_location('refresh_music', Path(__file__).with_name('refresh-music.py'))
music = importlib.util.module_from_spec(spec)
spec.loader.exec_module(music)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--artists', type=Path, required=True)
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--ids', default='')
    parser.add_argument('--resolve-missing', action='store_true')
    parser.add_argument('--search-images', action='store_true')
    args = parser.parse_args()
    pins_path = music.ROOT / 'src/data/youtube-channels.json'
    pins = json.loads(pins_path.read_text())
    saved = json.loads((music.ROOT / 'src/data/portraits.json').read_text())['portraits']
    artists = [artist for artist in json.loads(args.artists.read_text()) if artist['id'] in saved]
    if args.ids: artists = [a for a in artists if a['id'] in args.ids.split(',')]
    if not args.resolve_missing: artists = [a for a in artists if a['id'] in pins]
    candidates_path = Path('/tmp/tier-youtube-portraits.json')
    candidates = json.loads(candidates_path.read_text()) if candidates_path.exists() else {}
    cache = Path('/tmp/tier-youtube-profiles'); cache.mkdir(exist_ok=True)
    local = threading.local()
    failed = []

    def collect(artist):
        if not hasattr(local, 'builder'):
            local.builder = music.CatalogBuilder(music.PublicMetadataClient(), Path('/tmp/tier-ytmusic-cache'))
        builder = local.builder
        try:
            path = cache / (artist['id'] + '.json')
            channel = pins.get(artist['id'])
            if channel and path.exists() and time.time() - path.stat().st_mtime < 86400:
                profile = json.loads(path.read_text())
            else:
                try:
                    channel, profile = builder.resolve(artist, channel)
                except (TypeError, KeyError):
                    if not channel: raise
                    raw = builder.request('_send_request', 'browse', {'browseId': channel})
                    header = raw.get('header', {}).get('musicImmersiveHeaderRenderer', {})
                    profile = {'name': ''.join(r.get('text', '') for r in header.get('title', {}).get('runs', [])),
                        'channelId': header.get('subscriptionButton', {}).get('subscribeButtonRenderer', {}).get('channelId'),
                        'thumbnails': header.get('thumbnail', {}).get('musicThumbnailRenderer', {}).get('thumbnail', {}).get('thumbnails', [])}
                music.write_json(path, profile)
            thumbnails = [t for t in profile.get('thumbnails', []) if t.get('width', 0) >= 100 and t.get('height', 0) >= 100]
            if not thumbnails or args.search_images or artist['kind'] == 'group':
                linked = {channel, profile.get('channelId')} - {None}
                images = []
                for query in dict.fromkeys([artist['name'], artist['englishName']]):
                    for result in builder.request('search', query, filter='artists', limit=20):
                        if result.get('browseId') in linked:
                            images.extend(t for t in result.get('thumbnails', []) if urlparse(t.get('url', '')).hostname in {'yt3.googleusercontent.com', 'yt3.ggpht.com', 'lh3.googleusercontent.com'}
                                and t.get('width', 0) >= 100 and t.get('height', 0) >= 100)
                    if images: break
                if images:
                    # The provider's square artist avatar keeps group members
                    # in frame. Request its supported CDN size before caching.
                    thumbnails = [{**t, 'url': re.sub(r'=w\d+-h\d+', '=w512-h512', t['url'])} for t in images]
                elif args.search_images: raise ValueError('No verified profile image in artist search')
            url = music.image_url(thumbnails)
            if not url: raise ValueError('No artist profile image supplied by YouTube Music')
            return artist['id'], channel, {'url': url, 'pageUrl': 'https://music.youtube.com/channel/' + channel,
                'title': artist['name'], 'provider': 'youtube-music', 'channelId': channel}, None
        except Exception as error:
            return artist['id'], None, None, type(error).__name__ + ': ' + str(error)[:140]

    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 8))) as executor:
        for index, future in enumerate(as_completed([executor.submit(collect, a) for a in artists])):
            artist_id, channel, portrait, error = future.result()
            if portrait:
                candidates[artist_id] = portrait; pins[artist_id] = channel
            else: failed.append({'artistId': artist_id, 'error': error})
            if (index + 1) % 50 == 0 or index + 1 == len(artists):
                music.write_json(candidates_path, candidates)
                music.write_json(pins_path, pins)
                music.write_json(Path('/tmp/tier-youtube-portrait-report.json'), {'completed': index + 1, 'total': len(artists), 'candidates': len(candidates), 'failed': failed})
                print(f'YouTube Music profiles {index + 1}/{len(artists)}: {len(candidates)} images, {len(failed)} preserved', flush=True)


if __name__ == '__main__': main()
