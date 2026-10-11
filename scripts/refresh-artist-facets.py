"""Build international country and debut-era facets from pinned artist profiles.

Never infer debut from a person's birth date or the oldest available remaster.
Bugs' explicitly credited artist profile supplies debut dates; a linked,
name-checked Wikidata biography can supplement citizenship/origin and the
separately labelled career-start date. Unavailable facts stay unknown.
"""
import concurrent.futures
import datetime
import html
import hashlib
import json
import re
import threading
import time
import unicodedata
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

import requests

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.runtime/artist-facets'
CACHE.mkdir(parents=True, exist_ok=True)
PROFILE_CACHE = ROOT / '.runtime/global-expansion'
LOCAL = threading.local()
LOCK = threading.Lock()
LAST = 0.0
CURRENT_YEAR = datetime.datetime.now(datetime.timezone.utc).year
COUNTRIES = {
    '미국': 'US', '영국': 'GB', '일본': 'JP', '캐나다': 'CA', '스웨덴': 'SE',
    '독일': 'DE', '오스트레일리아': 'AU', '호주': 'AU', '브라질': 'BR',
    '노르웨이': 'NO', '프랑스': 'FR', '스페인': 'ES', '덴마크': 'DK',
    '핀란드': 'FI', '아일랜드': 'IE', '이탈리아': 'IT', '네덜란드': 'NL',
    '콜롬비아': 'CO', '필리핀': 'PH', '아이슬란드': 'IS', '쿠바': 'CU',
    '뉴질랜드': 'NZ', '나이지리아': 'NG', '푸에르토리코': 'PR',
    '아르헨티나': 'AR', '벨기에': 'BE', '베트남': 'VN', '인도네시아': 'ID',
    '타이': 'TH', '태국': 'TH', '대만': 'TW', '베냉': 'BJ', '자마이카': 'JM',
    '스위스': 'CH', '그리스': 'GR', '네덜란드령 앤틸리스 제도': 'AN',
    '러시아': 'RU', '홍콩': 'HK', '이집트': 'EG', '아이티': 'HT', '가나': 'GH',
    '대한민국': 'KR', '한국': 'KR', '중국': 'CN', '바베이도스': 'BB',
    '바베이도즈': 'BB', '인도': 'IN', '남아프리카공화국': 'ZA', '오스트리아': 'AT',
}


def plain(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]*>', ' ', value))).strip()


def norm(value):
    value = re.sub(r'^the\s+', '', value, flags=re.I).replace('&', ' and ')
    return ''.join(c for c in unicodedata.normalize('NFKD', value).lower() if c.isalnum())


def request(url, params=None):
    global LAST
    with LOCK:
        time.sleep(max(0, .7 - (time.monotonic() - LAST)))
        LAST = time.monotonic()
    if not hasattr(LOCAL, 'session'):
        LOCAL.session = requests.Session()
        LOCAL.session.headers['User-Agent'] = 'my-tier-metadata/0.1 (+https://github.com/hnjnkm/tier)'
    response = LOCAL.session.get(url, params=params, timeout=30)
    response.raise_for_status()
    return response


def profile(artist, identities):
    key = identities[artist['id']]['bugsId']
    cached = PROFILE_CACHE / ('artist_' + key + '__.html')
    if cached.exists():
        source = cached.read_text()
    else:
        cached = CACHE / ('bugs-' + key + '.html')
        if cached.exists():
            source = cached.read_text()
        else:
            source = request('https://music.bugs.co.kr/artist/' + key).text
            if '현재 서비스에 접속하실 수 없습니다' in source:
                raise ValueError('Provider unavailable; no service-error page accepted')
            cached.write_text(source)
    if f'rel="canonical" href="https://music.bugs.co.kr/artist/{key}"' not in source:
        raise ValueError('Canonical profile differs from verified identity')
    section = re.search(r'<section\b[^>]*class="[^\"]*summaryArtist[^>]*>(.*?)</section>', source, re.S)
    table = re.search(r'<table\b[^>]*class="info"[^>]*>(.*?)</table>', section[1], re.S) if section else None
    info = {plain(k): plain(v) for k, v in re.findall(r'<tr[^>]*>.*?<th[^>]*>(.*?)</th>.*?<td[^>]*>(.*?)</td>.*?</tr>', table[1], re.S)} if table else {}
    page_url = 'https://music.bugs.co.kr/artist/' + key
    result = {'countries': [], 'sources': {'profile': page_url}}
    if info.get('국적') in COUNTRIES:
        result['countries'] = [COUNTRIES[info['국적']]]
        result['sources']['country'] = page_url
    year = re.fullmatch(r'(\d{4})(?:년)?', info.get('데뷔', ''))
    if year and 1800 <= int(year[1]) <= CURRENT_YEAR:
        result['debutYear'] = int(year[1]); result['sources']['debut'] = page_url
    links = re.findall(r'href="([^\"]*wikipedia\.org/wiki/[^\"]+)"', section[1] if section else '')
    if links:
        url = urlparse(html.unescape(links[0]))
        if url.hostname in {'en.wikipedia.org', 'ko.wikipedia.org'}:
            result['biography'] = {'language': url.hostname.split('.')[0], 'title': unquote(url.path.split('/wiki/', 1)[1]).replace('_', ' ')}
    return result


def chunks(items, size=50):
    values = list(dict.fromkeys(items))
    return [values[n:n+size] for n in range(0, len(values), size)]


def wikibase(ids):
    result = {}
    for batch in chunks(ids):
        digest = hashlib.sha256('|'.join(batch).encode()).hexdigest()[:24]
        path = CACHE / ('entities-v2-' + digest + '.json')
        if path.exists(): data = json.loads(path.read_text())
        else:
            data = request('https://www.wikidata.org/w/api.php', {'action': 'wbgetentities', 'ids': '|'.join(batch), 'props': 'claims|labels|aliases|sitelinks', 'languages': 'en|ko', 'format': 'json'}).json()
            if 'error' in data or 'entities' not in data:
                raise ValueError('Wikidata did not return the requested metadata')
            path.write_text(json.dumps(data, ensure_ascii=False) + '\n')
        result.update(data.get('entities', {}))
    return result


def values(entity, prop):
    claims = [c for c in entity.get('claims', {}).get(prop, []) if c.get('rank') != 'deprecated' and c['mainsnak'].get('datavalue')]
    preferred = [c for c in claims if c.get('rank') == 'preferred']
    return [c['mainsnak']['datavalue']['value'] for c in preferred or claims]


def item_ids(entity, prop):
    return [v['id'] for v in values(entity, prop) if isinstance(v, dict) and 'id' in v]


if __name__ == '__main__':
    artists = json.loads((ROOT / 'src/data/global-artists.json').read_text())
    identities = json.loads((ROOT / 'src/data/identities.json').read_text())['artists']
    pins = json.loads((ROOT / 'src/data/artist-facet-pins.json').read_text())
    result, failures = {}, []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        tasks = {pool.submit(profile, a, identities): a for a in artists}
        for n, future in enumerate(concurrent.futures.as_completed(tasks), 1):
            artist = tasks[future]
            try: result[artist['id']] = future.result()
            except Exception as error:
                failures.append({'id': artist['id'], 'error': str(error)})
                result[artist['id']] = {'countries': [], 'sources': {}}
            if n % 200 == 0: print(f'Profiles {n}/{len(artists)}', flush=True)
    if failures:
        (CACHE / 'profile-failures.json').write_text(json.dumps(failures, ensure_ascii=False, indent=2) + '\n')
        raise RuntimeError(f'{len(failures)} profiles could not be verified; existing metadata was not replaced')
    # Reviewed biography URLs supplement profiles without a linked biography.
    # Explicit musical-debut pins prevent an acting/cover career from changing
    # the decade of a recording artist's debut (e.g. Olivia Rodrigo and Ado).
    for key, pin in pins.items():
        if key not in result: raise ValueError('Biography pin is not a catalog artist: ' + key)
        result[key]['biography'] = {'language': 'en', 'title': pin['title']}
    links = {}
    for language in ['en', 'ko']:
        titles = [m['biography']['title'] for m in result.values() if m.get('biography', {}).get('language') == language]
        for batch in chunks(titles):
            data = request(f'https://{language}.wikipedia.org/w/api.php', {'action': 'query', 'format': 'json', 'prop': 'pageprops', 'titles': '|'.join(batch), 'redirects': 1}).json()
            if 'error' in data or 'query' not in data:
                raise ValueError('Wikipedia did not return the requested biographies')
            pages = {p['title']: p.get('pageprops', {}).get('wikibase_item') for p in data.get('query', {}).get('pages', {}).values()}
            redirects = {r['from']: r['to'] for r in [*data.get('query', {}).get('normalized', []), *data.get('query', {}).get('redirects', [])]}
            for title in batch:
                actual = title
                for _ in range(5): actual = redirects.get(actual, actual)
                if pages.get(actual): links[(language, title)] = pages[actual]
    entities = wikibase(links.values())
    matched = {}
    for artist in artists:
        meta = result[artist['id']]; bio = meta.get('biography')
        if not bio: continue
        qid = links.get((bio['language'], bio['title'])); entity = entities.get(qid, {})
        names = [x['value'] for x in entity.get('labels', {}).values()] + [x['value'] for group in entity.get('aliases', {}).values() for x in group]
        names += [x['title'].split(' (')[0] for site, x in entity.get('sitelinks', {}).items() if site in ['enwiki', 'kowiki']]
        candidates = [artist['name'], artist['englishName'], *artist['aliases'], bio['title'].split(' (')[0]]
        if not {norm(x) for x in names} & {norm(x) for x in candidates} or 'Q4167410' in item_ids(entity, 'P31'): continue
        # A person must be an actual human; group inception is kept separate
        # from a soloist's birth date. P569 is deliberately never consumed.
        if artist['kind'] == 'solo' and 'Q5' not in item_ids(entity, 'P31'): continue
        matched[artist['id']] = (qid, entity)
    places = wikibase(q for _, e in matched.values() for prop in ['P740', 'P159'] for q in item_ids(e, prop))
    countries = wikibase(q for _, e in matched.values() for prop in ['P27', 'P495', 'P17'] for q in item_ids(e, prop))
    extra = [q for e in places.values() for q in item_ids(e, 'P17')]
    countries.update(wikibase(extra))
    countries.update(wikibase(q for e in list(countries.values()) for q in item_ids(e, 'P17') if q not in countries))
    corrected = []
    for artist in artists:
        key = artist['id']; meta = result[key]
        if key not in matched: continue
        qid, entity = matched[key]; link = 'https://www.wikidata.org/wiki/' + qid
        country_ids = item_ids(entity, 'P27') if artist['kind'] == 'solo' else item_ids(entity, 'P495') or item_ids(entity, 'P17')
        if not country_ids and artist['kind'] == 'group':
            country_ids = [q for p in item_ids(entity, 'P740') for q in item_ids(places.get(p, {}), 'P17')]
        codes = []
        for q in country_ids:
            c = countries.get(q, {}); code = values(c, 'P297')
            if not code:
                code = [v for parent in item_ids(c, 'P17') for v in values(countries.get(parent, {}), 'P297')]
            codes += [v for v in code if isinstance(v, str) and re.fullmatch('[A-Z]{2}', v)]
        if codes:
            unique = list(dict.fromkeys(codes))
            if meta['countries'] != unique: corrected.append({'id': key, 'old': meta['countries'], 'new': unique})
            meta['countries'] = unique; meta['sources']['country'] = link
        starts = values(entity, 'P2031') or (values(entity, 'P571') if artist['kind'] == 'group' else [])
        years = [int(v['time'][1:5]) for v in starts if isinstance(v, dict) and v.get('precision', 0) >= 9 and re.match(r'^\+\d{4}-', v.get('time', '')) and 1800 <= int(v['time'][1:5]) <= CURRENT_YEAR]
        if years:
            meta['careerStartYear'] = min(years); meta['sources']['careerStart'] = link
        if key in pins and 'debutYear' in pins[key]:
            meta['debutYear'] = pins[key]['debutYear']
            meta['sources']['debut'] = 'https://en.wikipedia.org/wiki/' + quote(pins[key]['title'].replace(' ', '_'))
    # Preserve useful, name-checked source URLs; never ship transient query data.
    for meta in result.values(): meta.pop('biography', None)
    result = {artist['id']: result[artist['id']] for artist in artists}
    target = ROOT / 'src/data/global-facets.json'
    pending = target.with_suffix('.json.tmp')
    pending.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    pending.replace(target)
    report = {'count': len(result), 'countries': sum(bool(m['countries']) for m in result.values()), 'debutYears': sum('debutYear' in m for m in result.values()), 'eraCoverage': sum('debutYear' in m or 'careerStartYear' in m for m in result.values()), 'crossChecked': len(matched), 'correctedCountries': corrected, 'failures': failures}
    (CACHE / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['correctedCountries','failures']}, ensure_ascii=False), flush=True)
