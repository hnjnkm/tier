"""Pin international Bugs profiles using original names and two known songs.

No top-result guessing: only a unique discography match is written. YouTube
Music resolves its own channel against the verified reference songs later.
"""
import concurrent.futures
import html
import json
import re
import threading
import time
import unicodedata
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path('/tmp/tier-global-profiles')
CACHE.mkdir(exist_ok=True)
pace_lock = threading.Lock()
last_request = 0.0
local = threading.local()


def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value).lower() if c.isalnum())


def page(url, params=None):
    global last_request
    with pace_lock:
        time.sleep(max(0, .2 - (time.monotonic() - last_request)))
        last_request = time.monotonic()
    if not hasattr(local, 'session'):
        local.session = requests.Session()
    response = local.session.get(url, params=params, timeout=30)
    response.raise_for_status()
    return response.text


def songs_from(source, artist_id):
    result = []
    for attributes, row in re.findall(r'<tr\b([^>]*\btrackId="\d+"[^>]*)>(.*?)</tr>', source, re.S):
        credits = re.search(r'\bartistId="([\d,]+)"', attributes)
        if not credits or artist_id not in credits[1].split(','):
            continue
        title = re.search(r'<p\s+class="title"[^>]*>.*?<a\b[^>]*title="([^"]+)"', row, re.S)
        album = re.search(r'<a\b[^>]*class="album"[^>]*title="([^"]+)"', row)
        if title:
            result.append({'title': html.unescape(title[1]), 'album': html.unescape(album[1]) if album else ''})
    return result


def seed(artist):
    cache = CACHE / (artist['id'] + '.json')
    if cache.exists():
        result = json.loads(cache.read_text())
        # Preserve reviewed bilingual identities when profiles are seeded again.
        previous = json.loads((ROOT / 'src/data/identities.json').read_text())['artists'].get(artist['id'], {})
        aliases = {song['title']: song['titleAliases'] for song in previous.get('referenceSongs', []) if song.get('titleAliases')}
        for song in result['referenceSongs']:
            if song['title'] in aliases:
                song['titleAliases'] = aliases[song['title']]
        return artist['id'], result
    candidates = {}
    for query in [artist['name'], *artist.get('providerQueries', [])]:
        source = page('https://music.bugs.co.kr/search/artist', {'q': query})
        for row in re.findall(r'<figure\b[^>]*class="[^"]*\bartistInfo\b[^"]*"[^>]*>(.*?)</figure>', source, re.S):
            key = re.search(r'https://music.bugs.co.kr/artist/(\d+)', row)
            name = re.search(r'class="artistTitle"\s+title="([^"]+)"', row)
            if not key or not name:
                continue
            display = html.unescape(name[1])
            names = [artist['name'], *artist['aliases'], *artist.get('providerQueries', [])]
            base = re.sub(r'\s*\([^()]*\)\s*$', '', display).strip()
            if not any(norm(n) in {norm(display), norm(base)} for n in names):
                continue
            candidates[key[1]] = display
        if candidates:
            break
    verified = []
    observations = []
    for key, name in list(candidates.items())[:6]:
        source = page('https://music.bugs.co.kr/artist/' + key)
        if f'rel="canonical" href="https://music.bugs.co.kr/artist/{key}"' not in source:
            continue
        refs = songs_from(source, key)
        for index in range(1, 4):
            if all(any(norm(proof) in norm(song['title']) for song in refs) for proof in artist['proofSongs']):
                break
            listing = page(f'https://music.bugs.co.kr/artist/{key}/tracks', {'sort': 'P', 'page': index, 'roleCode': 0})
            refs.extend(songs_from(listing, key))
        matched = [proof for proof in artist['proofSongs'] if any(norm(proof) in norm(song['title']) for song in refs)]
        observations.append({'id': key, 'name': name, 'matched': matched, 'topSongs': refs[:12]})
        section = re.search(r'<section\b[^>]*class="[^"]*summaryArtist[^>]*>(.*?)</section>', source, re.S)
        photo = re.search(r'<li\s+class="big">.*?<img\b[^>]*src="(https://image\.bugsm\.co\.kr/artist/images/[^" ]+)"', section[1], re.S) if section else None
        if len(set(matched)) < 2 or not photo:
            continue
        image = re.sub(r'/artist/images/\d+/', '/artist/images/500/', html.unescape(photo[1]))
        verified.append({'bugsId': key, 'referenceSongs': list({s['title']: s for s in refs}.values())[:30],
                         'proofSongs': matched, 'portrait': {'url': image, 'pageUrl': f'https://music.bugs.co.kr/artist/{key}', 'title': name, 'provider': 'bugs'}})
    if len(verified) != 1:
        raise ValueError(json.dumps({'candidates': observations, 'verified': len(verified)}, ensure_ascii=False))
    result = verified[0]
    cache.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    return artist['id'], result


if __name__ == '__main__':
    artists = json.loads((ROOT / 'src/data/global-artists.json').read_text())
    identities_path = ROOT / 'src/data/identities.json'
    identities = json.loads(identities_path.read_text())
    portraits = json.loads((ROOT / 'src/data/portraits.json').read_text())['portraits']
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(seed, artist): artist for artist in artists}
        for future in concurrent.futures.as_completed(futures):
            artist = futures[future]
            try:
                key, result = future.result()
                identities['artists'][key] = {k: v for k, v in result.items() if k != 'portrait'}
                portraits[key] = result['portrait']
                print('Verified:', artist['name'], result['bugsId'], flush=True)
            except Exception as error:
                failures.append({'artist': artist['name'], 'id': artist['id'], 'error': str(error)})
                print('Unresolved:', artist['name'], flush=True)
    identities_path.write_text(json.dumps(identities, ensure_ascii=False, indent=2) + '\n')
    Path('/tmp/tier-profile-portrait-candidates.json').write_text(json.dumps(portraits, ensure_ascii=False, indent=2) + '\n')
    Path('/tmp/tier-global-profile-report.json').write_text(json.dumps(failures, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(artists)-len(failures)}/{len(artists)} unique profiles verified; unresolved details in /tmp/tier-global-profile-report.json')
