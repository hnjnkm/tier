import sys
import importlib.util
import tempfile
import unittest
import json
from unittest.mock import Mock
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
        if album_id == 'MPRE_ost':
            return {'title': '드라마 OST', 'artists': [{'id': CHANNEL}], 'trackCount': 1,
                    'tracks': [{'videoId': 'ostsong0001', 'title': 'OST 참여곡', 'artists': [{'id': CHANNEL}]}]}
        return {'title': '전곡 앨범', 'artists': [{'id': FOREIGN if album_id == 'MPRE_foreign' else CHANNEL}], 'year': '2026', 'trackCount': 325,
                'audioPlaylistId': 'album-songs', 'tracks': tracks(200), 'other_versions': [{'browseId': 'MPRE_album'}]}

    def search(self, query, filter, limit):
        return [{'artist': '길', 'browseId': CHANNEL}, {'artist': 'Gil', 'browseId': FOREIGN}]

    def get_artist(self, channel):
        return {'name': '길' if channel == CHANNEL else 'Gil', 'channelId': channel,
                'songs': {'results': tracks(2, channel) if channel == CHANNEL else [{'title': 'Foreign song'}]},
                'albums': {}, 'singles': {}}


class CatalogTests(unittest.TestCase):
    def test_provider_merged_namesakes_are_removed_using_independent_recording_credits(self):
        self.assertTrue(module.different_performer('kr-punch', '비밀친구 헬로카봇 ver.5 (Inst.)', '헬로카봇 시즌5 OST'))
        self.assertFalse(module.different_performer('kr-punch', 'Stay With Me', '도깨비 OST'))
        self.assertFalse(module.different_performer('kr-paul-kim', '비밀친구', '헬로카봇'))

    def test_bilingual_artist_recordings_match_without_conflating_other_versions(self):
        self.assertTrue(module.recording_variants('호불호 Taste (Prod. By GRAY) (feat. 기리보이)') & module.recording_variants('호불호 (Feat. 기리보이) (Prod. By GRAY)'))
        self.assertFalse(module.recording_variants('호불호 Live') & module.recording_variants('호불호'))
        self.assertTrue(module.recording_variants('月之迷 (Nectar)') & module.recording_variants('Nectar'))
        self.assertTrue(module.recording_variants('Vision Wings (English Ver.)') & module.recording_variants('Vision Wings (English Version)'))
        self.assertFalse(module.recording_variants('Vision Wings (English Ver.)') & module.recording_variants('Vision Wings (Korean Ver.)'))
    def test_korean_release_year_is_not_lost_or_guessed_from_view_counts(self):
        self.assertEqual(CatalogBuilder.album_year({'views': '2026년'})['year'], '2026')
        self.assertNotIn('year', CatalogBuilder.album_year({'views': '2026회'}))
        self.assertNotIn('year', CatalogBuilder.album_year({'views': '2.6억회'}))

    def test_korean_search_uses_public_metadata_api_and_preserves_artist_names(self):
        fixture = json.loads((Path(__file__).parent / 'fixtures/ytmusic-artists-ko.json').read_text())
        client = module.PublicMetadataClient()
        response = Mock()
        response.json.return_value = fixture
        client._session = Mock()
        client._session.post.return_value = response
        result = client.search('아이유', filter='artists', limit=10)
        self.assertEqual(result[0]['artist'], '아이유')
        self.assertEqual(result[0]['browseId'], 'UCTUR0sVEkD8T5MlSHqgaI_Q')
        args, kwargs = client._session.post.call_args
        self.assertTrue(args[0].startswith('https://youtubei.googleapis.com/youtubei/v1/search'))
        self.assertEqual(kwargs['json']['context']['client']['hl'], 'ko')
        self.assertEqual(kwargs['json']['context']['client']['gl'], 'KR')
        client._session.get.assert_not_called()

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

    def test_incomplete_foreign_recommendation_does_not_abort_the_artist_catalog(self):
        class WithForeign(Provider):
            def get_album(self, album_id):
                result = super().get_album(album_id)
                if album_id == 'MPRE_foreign': result.pop('audioPlaylistId')
                return result
        with tempfile.TemporaryDirectory() as cache:
            builder = CatalogBuilder(WithForeign(), Path(cache), pause=0)
            result = builder.build({'id': 'kr-gil', 'name': '길'}, CHANNEL, {'channelId': CHANNEL, 'songs': {'browseId': 'VLartist-songs'}, 'albums': {'browseId': CHANNEL, 'params': 'all'}, 'singles': {}})
            self.assertFalse((Path(cache) / 'MPRE_foreign.json').exists())
        self.assertEqual(len(result['songs']), 326)

    def test_participating_ost_albums_include_less_popular_tracks_with_matching_credits(self):
        class WithOst(Provider):
            def get_album(self, album_id):
                if album_id == 'MPRE_ost':
                    return {'title': '드라마 OST', 'artists': [{'id': FOREIGN}], 'trackCount': 2,
                            'tracks': [{'videoId': 'ostsong0001', 'title': 'OST 참여곡', 'artists': [{'id': CHANNEL}]},
                                       {'videoId': 'ostside0001', 'title': '숨은 OST 수록곡', 'artists': [{'id': CHANNEL}]}]}
                return super().get_album(album_id)
        with tempfile.TemporaryDirectory() as cache:
            result = CatalogBuilder(WithOst(), Path(cache), pause=0).build({'id': 'kr-gil', 'name': '길'}, CHANNEL, {'channelId': CHANNEL, 'songs': {'browseId': 'VLartist-songs'}, 'albums': {}, 'singles': {}})
        self.assertIn('숨은 OST 수록곡', [song['title'] for song in result['songs']])

    def test_regional_playlist_must_account_for_every_available_track(self):
        class Regional(Provider):
            def get_album(self, album_id): return {'title': '앨범', 'artists': [{'id': CHANNEL}], 'trackCount': 3, 'audioPlaylistId': 'album-songs', 'tracks': tracks(2)}
            def get_playlist(self, playlist_id, limit=100): return {'trackCount': 2, 'tracks': tracks(2)}
        with tempfile.TemporaryDirectory() as cache:
            album = CatalogBuilder(Regional(), Path(cache), pause=0).album('MPRE_regional', {CHANNEL})
        self.assertEqual(album['unavailableTrackCount'], 1)
        class Truncated(Regional):
            def get_playlist(self, playlist_id, limit=100): return {'trackCount': 3, 'tracks': tracks(2)}
        with tempfile.TemporaryDirectory() as cache:
            with self.assertRaisesRegex(ValueError, 'Incomplete'):
                CatalogBuilder(Truncated(), Path(cache), pause=0).album('MPRE_regional', {CHANNEL})

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

    def test_one_release_requires_the_verified_album_as_well_as_the_song(self):
        class SingleProvider(Provider):
            def get_artist(self, channel):
                return {'channelId': channel, 'songs': {'results': [{'title': '같은 제목', 'album': {'name': '검증 앨범' if channel == CHANNEL else '다른 앨범'}}]}, 'albums': {}, 'singles': {}}
            def search(self, query, filter, limit):
                if filter == 'songs': return []
                return super().search(query, filter, limit)
        artist = {'id': 'kr-single', 'name': '길', 'englishName': 'Gil', 'aliases': [], 'identity': {'referenceSongs': [{'title': '같은 제목', 'album': '검증 앨범'}]}}
        with tempfile.TemporaryDirectory() as cache:
            channel, _ = CatalogBuilder(SingleProvider(), Path(cache), pause=0).resolve(artist)
        self.assertEqual(channel, CHANNEL)

    def test_identity_verification_reads_beyond_the_first_popular_tracks(self):
        class DeepProvider(Provider):
            def get_artist(self, channel):
                return {'channelId': channel, 'songs': {'browseId': 'VLfull' if channel == CHANNEL else None,
                        'results': [{'title': '새 노래'}]}, 'albums': {}, 'singles': {}}
            def get_playlist(self, playlist_id, limit=100):
                self.asserted_limit = limit
                return {'tracks': tracks(2)}
            def search(self, query, filter, limit):
                return super().search(query, filter, limit) if filter == 'artists' else []
        artist = {'id': 'kr-gil', 'name': '길', 'englishName': 'Gil', 'aliases': [], 'identity': {'referenceSongs': [{'title': '노래 0'}, {'title': '노래 1'}]}}
        provider = DeepProvider()
        with tempfile.TemporaryDirectory() as cache:
            channel, _ = CatalogBuilder(provider, Path(cache), pause=0).resolve(artist)
        self.assertEqual(channel, CHANNEL)
        self.assertIsNone(provider.asserted_limit)

    def test_same_title_covers_are_disambiguated_by_the_independent_album_credits(self):
        class Covers(Provider):
            def get_artist(self, channel):
                return {'channelId': channel, 'songs': {'results': [{'title': '노래 0', 'album': {'name': '검증 앨범' if channel == CHANNEL else '커버 앨범'}},
                        {'title': '노래 1', 'album': {'name': '검증 앨범' if channel == CHANNEL else '커버 앨범'}}]}, 'albums': {}, 'singles': {}}
        artist = {'id': 'kr-gil', 'name': '길', 'englishName': 'Gil', 'aliases': [], 'identity': {'referenceSongs': [{'title': '노래 0', 'album': '검증 앨범'}, {'title': '노래 1', 'album': '검증 앨범'}]}}
        with tempfile.TemporaryDirectory() as cache:
            channel, _ = CatalogBuilder(Covers(), Path(cache), pause=0).resolve(artist)
        self.assertEqual(channel, CHANNEL)


if __name__ == '__main__':
    unittest.main()
