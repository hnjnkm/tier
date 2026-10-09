import sys
import importlib.util
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
spec = importlib.util.spec_from_file_location('refresh_music', Path(__file__).resolve().parents[1] / 'scripts/refresh-music.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
CatalogBuilder = module.CatalogBuilder

CHANNEL = 'UC' + 'a' * 22
FOREIGN = 'UC' + 'b' * 22


def tracks(count=325, channel=CHANNEL):
    return [{'videoId': f'video{i:06}', 'title': f'노래 {i}', 'artists': [{'id': channel}], 'album': {'name': '전곡 앨범', 'id': 'MPRE_album'}} for i in range(count)]


class Provider:
    def __init__(self):
        self.calls = []

    def get_playlist(self, playlist_id, limit=100):
        self.calls.append(('playlist', playlist_id, limit))
        result = tracks()
        if playlist_id == 'artist-songs':
            result = list(reversed(result)) + [{'videoId': 'ostsong0001', 'title': 'OST 참여곡', 'artists': [{'id': CHANNEL}], 'album': {'name': '드라마 OST', 'id': 'MPRE_ost'}}, *tracks(1, FOREIGN)]
        return {'tracks': result}

    def get_artist_albums(self, channel, params, limit=100):
        self.calls.append(('albums', channel, limit))
        return [{'browseId': 'MPRE_album'}, {'browseId': 'MPRE_foreign'}]

    def get_album(self, album_id):
        return {'title': '전곡 앨범', 'artists': [{'id': FOREIGN if album_id == 'MPRE_foreign' else CHANNEL}], 'year': '2026', 'trackCount': 325,
                'audioPlaylistId': 'album-songs', 'tracks': tracks(200), 'other_versions': [{'browseId': 'MPRE_album'}]}

    def search(self, query, filter, limit):
        return [{'artist': '길', 'browseId': CHANNEL}, {'artist': 'Gil', 'browseId': FOREIGN}]

    def get_artist(self, channel):
        return {'name': '길' if channel == CHANNEL else 'Gil', 'channelId': channel,
                'songs': {'results': tracks(2, channel) if channel == CHANNEL else [{'title': 'Foreign song'}]},
                'albums': {}, 'singles': {}}


class CatalogTests(unittest.TestCase):
    def test_full_playlist_continuations_and_album_tracks_are_preserved(self):
        provider = Provider()
        with tempfile.TemporaryDirectory() as cache:
            builder = CatalogBuilder(provider, Path(cache), pause=0)
            result = builder.build({'id': 'kr-gil', 'name': '길'}, CHANNEL, {'channelId': CHANNEL, 'songs': {'browseId': 'VLartist-songs'},
                    'albums': {'browseId': CHANNEL, 'params': 'all'}, 'singles': {}})
        self.assertEqual(len(result['songs']), 326)
        self.assertIn(('playlist', 'artist-songs', None), provider.calls)
        self.assertIn(('playlist', 'album-songs', None), provider.calls)
        self.assertIn(('albums', CHANNEL, None), provider.calls)
        self.assertTrue(result['complete'])
        self.assertTrue(all(song['artistId'] == CHANNEL for song in result['songs']))
        self.assertIn('노래 324', [song['title'] for song in result['songs']])
        self.assertIn('드라마 OST', [album['title'] for album in result['albums']])
        self.assertNotIn('MPRE_foreign', [album['id'] for album in result['albums']])

    def test_namesakes_require_discography_matches_not_name_or_first_result(self):
        provider = Provider()
        with tempfile.TemporaryDirectory() as cache:
            builder = CatalogBuilder(provider, Path(cache), pause=0)
            channel, _ = builder.resolve({'id': 'kr-gil', 'name': '길', 'englishName': 'Gil', 'aliases': [],
                                         'identity': {'referenceSongs': [{'title': '노래 0'}, {'title': '노래 1'}]}})
        self.assertEqual(channel, CHANNEL)
        with tempfile.TemporaryDirectory() as cache:
            builder = CatalogBuilder(provider, Path(cache), pause=0)
            with self.assertRaisesRegex(ValueError, 'verified'):
                builder.resolve({'id': 'kr-gil', 'name': '길', 'englishName': 'Gil', 'aliases': [], 'identity': {'referenceSongs': []}})


if __name__ == '__main__':
    unittest.main()
