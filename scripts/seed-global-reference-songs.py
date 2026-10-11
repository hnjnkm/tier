"""Supplement uniquely identified overseas Bugs profiles with recording references.

The photo still comes from the canonical Bugs artist record. Public Apple
Music's US Search catalog supplies independent recording references only; the published
song catalog is always independently verified, complete YouTube Music data.
Ambiguous Bugs records or recording artist IDs are excluded, never guessed.
"""
import argparse
import concurrent.futures
import html
import importlib.util
import json
import re
import threading
import time
from pathlib import Path

import requests

spec = importlib.util.spec_from_file_location('discover', Path(__file__).with_name('discover-global-artists.py'))
discover = importlib.util.module_from_spec(spec)
spec.loader.exec_module(discover)
CACHE = discover.CACHE
LOCK = threading.Lock()
LAST = 0.0
LOCAL = threading.local()


def candidates():
    identities = json.loads((discover.ROOT / 'src/data/identities.json').read_text())['artists']
    known = {a['bugsId'] for a in identities.values() if a.get('bugsId')}
    used_names = {discover.norm(r['artist']['name']) for p in CACHE.glob('profile-*.json') for r in [json.loads(p.read_text())]}
    result = []
    for query in dict.fromkeys(discover.PRIORITY.split('|')):
        key = re.sub('[^a-zA-Z0-9-]', '_', 'search/artist' + json.dumps({'q': query}, sort_keys=True))
        path = CACHE / (key + '.html')
        if not path.exists() or discover.norm(query) in used_names:
            continue
        matches = {}
        for row in re.findall(r'<figure\b[^>]*class="[^"]*\bartistInfo\b[^"]*"[^>]*>(.*?)</figure>', path.read_text(), re.S):
            key = re.search(r'https://music.bugs.co.kr/artist/(\d+)', row)
            display = re.search(r'class="artistTitle"\s+title="([^"]+)"', row)
            photo = re.search(r'<img\b[^>]*src="(https://image\.bugsm\.co\.kr/artist/images/[^" ]+)"', row)
            kind = re.search(r'class="artistType">(.*?)</span>', row, re.S)
            if not key or not display or not photo or not kind:
                continue
            name = html.unescape(display[1]).replace("\\'", "'")
            aliases = []
            alternative = re.search(r'\s*\(([^()]*[가-힣][^()]*)\)\s*$', name)
            if alternative:
                aliases.append(alternative[1]); name = name[:alternative.start()].strip()
            if discover.norm(name) != discover.norm(query):
                continue
            matches[key[1]] = {'key': key[1], 'name': name, 'display': html.unescape(display[1]), 'aliases': aliases, 'photo': html.unescape(photo[1]), 'kind': discover.plain(kind[1]), 'row': row}
        if len(matches) != 1:
            continue
        item = next(iter(matches.values()))
        if item['key'] in known or (CACHE / ('profile-' + item['key'] + '.json')).exists():
            continue
        if '/genre/chart/kpop/' in item['row'] or not re.search(r'/genre/chart/(?:pop/|etc/(?:njpop|nwpop)/)', item['row']):
            continue
        if not re.search('솔로|그룹|듀오|밴드', item['kind']):
            continue
        detail = CACHE / ('artist_' + item['key'] + '__.html')
        if detail.exists() and re.search(r'<th[^>]*>국적</th>\s*<td[^>]*>\s*(?:대한민국|한국)', detail.read_text()):
            continue
        result.append(item)
    return result


def reference(item):
    global LAST
    cache = CACHE / ('apple-us-references-' + item['key'] + '.json')
    if cache.exists():
        data = json.loads(cache.read_text())
    else:
        # Apple's public Search API recommends approximately 20 calls/minute.
        with LOCK:
            time.sleep(max(0, 3.1 - (time.monotonic() - LAST)))
            LAST = time.monotonic()
        if not hasattr(LOCAL, 'session'):
            LOCAL.session = requests.Session()
        response = LOCAL.session.get('https://itunes.apple.com/search', params={'term': item['name'], 'entity': 'song', 'country': 'US', 'limit': 50}, timeout=30)
        response.raise_for_status()
        data = response.json()
        cache.write_text(json.dumps(data, ensure_ascii=False) + '\n')
    recordings = {}
    for song in data.get('results', []):
        if song.get('wrapperType') != 'track' or song.get('kind') != 'song' or discover.norm(song.get('artistName', '')) != discover.norm(item['name']):
            continue
        if re.search(r'karaoke|tribute (?:to|band)|made famous|music box|lullaby|piano covers', song.get('collectionName', ''), re.I):
            continue
        if song.get('artistId') and song.get('trackName') and song.get('collectionName'):
            recordings.setdefault(song['artistId'], {})[discover.norm(song['trackName'])] = {'title': song['trackName'], 'album': song['collectionName']}
    verified = [(key, list(songs.values())) for key, songs in recordings.items() if len(songs) >= 2]
    if len(verified) != 1:
        raise ValueError('No unique recording identity with two original references')
    provider_id, refs = verified[0]
    name, kind = item['name'], item['kind']
    slug = re.sub('[^a-z0-9]+', '-', discover.unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()).strip('-')
    artist_id = 'global-' + (slug or 'bugs-' + item['key'])
    genres = ['hiphop'] if '/pop/hiphop/' in item['row'] else ['rock'] if re.search('/pop/(?:rock|metal)/', item['row']) else ['rnb'] if '/pop/rnb/' in item['row'] else ['jazz'] if '/pop/jazz/' in item['row'] else ['folk'] if '/etc/nwpop/' in item['row'] else ['dance']
    artist = {'id': artist_id, 'name': name, 'englishName': name, 'aliases': item['aliases'], 'gender': 'mixed' if '혼성' in kind else 'female' if '여성' in kind else 'male' if '남성' in kind else 'unknown', 'kind': 'solo' if '솔로' in kind else 'group', 'genres': genres, 'source': 'catalog', 'proofSongs': [s['title'] for s in refs[:2]]}
    identity = {'bugsId': item['key'], 'referenceSongs': refs[:30], 'proofSongs': artist['proofSongs'], 'referenceProvider': 'apple-music', 'referenceArtistId': provider_id, 'referenceTerritory': 'US'}
    portrait = {'url': re.sub(r'/artist/images/\d+/', '/artist/images/500/', item['photo']), 'pageUrl': 'https://music.bugs.co.kr/artist/' + item['key'], 'title': item['display'], 'provider': 'bugs'}
    result = {'artist': artist, 'identity': identity, 'portrait': portrait, 'classification': 'Unique Bugs overseas profile and independent Apple Music recording identity', 'priority': True}
    (CACHE / ('profile-' + item['key'] + '.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    return name


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit', type=int, default=500)
    args = parser.parse_args()
    items = candidates()[:args.limit]
    print(f'{len(items)} unique overseas profile identities need independent recording references', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = {executor.submit(reference, item): item for item in items}
        for index, future in enumerate(concurrent.futures.as_completed(futures)):
            try:
                name = future.result()
                print(f'[{index+1}/{len(items)}] Verified reference recordings: {name}', flush=True)
            except Exception as error:
                print(f'[{index+1}/{len(items)}] Excluded {futures[future]["name"]}: {error}', flush=True)
