"""Cache the Korean YouTube Music catalog using verified artist identities.

Public metadata only: no account, cookies, media downloads, or playback tokens.
The browser reads these same-origin files because YouTube Music has no public
cross-origin catalog API. Failed refreshes preserve the previous catalog.
"""
from __future__ import annotations

import argparse
import json
import re
import time
import unicodedata
import threading
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ytmusicapi import YTMusic
from ytmusicapi.ytmusic import initialize_headers
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ROOT = Path(__file__).resolve().parents[1]
CHANNEL = re.compile(r"^UC[\w-]{22}$")
VIDEO = re.compile(r"^[\w-]{11}$")
EXCLUSIONS = json.loads((ROOT / "src/data/music-exclusions.json").read_text())
FAMILIES = json.loads((ROOT / "src/data/music-families.json").read_text())


class UnavailableRelease(ValueError):
    """A release explicitly unavailable in the provider's current region."""


class ArtistResolutionError(ValueError):
    def __init__(self, verified):
        super().__init__('No unique channel matched the verified discography')
        self.verified = verified


class PublicMetadataClient(YTMusic):
    """Anonymous Music metadata through Google's first-party API host.

    No browser page or authenticated visitor cookie is required. This endpoint
    returns the same WEB_REMIX responses consumed by ytmusicapi's parsers.
    """
    _pace_lock = threading.Lock()
    _last_request = 0.0

    def __init__(self):
        super().__init__(language="ko", location="KR")
        self.base_headers = initialize_headers()
        self._session.mount("https://", HTTPAdapter(max_retries=Retry(
            total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504], allowed_methods={"POST"},
        )))

    def search(self, *args, **kwargs):
        kwargs.setdefault("ignore_spelling", True)
        return super().search(*args, **kwargs)

    def _send_request(self, endpoint: str, body: dict, additionalParams: str = "") -> dict:
        with self._pace_lock:
            time.sleep(max(0, 0.1 - (time.monotonic() - self._last_request)))
            PublicMetadataClient._last_request = time.monotonic()
        body.update(self.context)
        response = self._session.post(
            "https://youtubei.googleapis.com/youtubei/v1/" + endpoint + self.params + additionalParams,
            json=body, headers=self.headers, proxies=self.proxies, cookies=self.cookies,
            timeout=30,
        )
        response.raise_for_status()
        result = response.json()
        if endpoint == "browse" and "contents" not in result and result.get("microformat", {}).get("microformatDataRenderer", {}).get("noindex"):
            raise UnavailableRelease(str(body.get("browseId")))
        if endpoint == "browse":
            secondary = result.get("contents", {}).get("twoColumnBrowseResultsRenderer", {}).get("secondaryContents", {}).get("sectionListRenderer", {})
            sections = secondary.get("contents", [])
            if sections and any(key in sections[0] for key in ("musicShelfRenderer", "musicPlaylistShelfRenderer")):
                # Album tracks remain intact; the library otherwise tries to
                # parse an empty recommendation message as an album carousel.
                secondary["contents"] = [sections[0], *[s for s in sections[1:] if "musicCarouselShelfRenderer" in s]]
        visitor = result.get("responseContext", {}).get("visitorData")
        if visitor:
            self.base_headers["X-Goog-Visitor-Id"] = visitor
        if endpoint == "search":
            # ytmusicapi 1.12.3 compares filtered shelf labels with English
            # words even when hl=ko. Normalize only UI category labels; artist,
            # song and album titles retain the provider's Korean metadata.
            labels = {"아티스트": "Artists", "노래": "Songs", "앨범": "Albums", "동영상": "Videos"}
            def categories(node):
                if isinstance(node, dict):
                    shelf = node.get("musicShelfRenderer")
                    if shelf:
                        for run in shelf.get("title", {}).get("runs", []):
                            run["text"] = labels.get(run.get("text"), run.get("text"))
                    for value in node.values():
                        categories(value)
                elif isinstance(node, list):
                    for value in node:
                        categories(value)
            categories(result)
        return result


def normalized(value: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", value).lower() if c.isalnum())


def recording_title(value: str) -> str:
    return normalized(re.sub(r"\s*\((?:feat\.?|featuring|with|duet).*", "", value, flags=re.I))


def recording_variants(value: str) -> set[str]:
    value = re.sub(r"\s*\((?:feat\.?|featuring|with|duet).*", "", value, flags=re.I).strip()
    value = re.sub(r"\s*\(prod\.?\s*(?:by\s*)?[^()]*\)", "", value, flags=re.I).strip()
    value = re.sub(r"\bver\.?(?=\W|$)", "version", value, flags=re.I)
    variants = {normalized(value)}
    translation = re.fullmatch(r"(.*?)\s*\(([^()]*)\)", value)
    if translation:
        main, other = translation.groups()
        # Korean/English title translations, never remix/live/instrumental labels.
        script = lambda text: 'ko' if re.search(r"[가-힣]", text) else 'han' if re.search(r"[\u3400-\u9fff]", text) else 'latin'
        if not re.search(r"remix|live|inst|version|bonus|acoustic", other, re.I) and script(main) != script(other):
            variants.update([normalized(main), normalized(other)])
    # WEB_REMIX sometimes renders a Korean title followed by its Latin title
    # without parentheses (e.g. "호불호 Taste"). Version labels are not aliases.
    bilingual = re.fullmatch(r"([가-힣\u3400-\u9fff\d\s!?.,'’]+)\s+([A-Za-z][A-Za-z\d\s!?.,'’]+)", value)
    if bilingual and not re.search(r"remix|live|inst|version|bonus|acoustic", bilingual.group(2), re.I):
        variants.update(normalized(part) for part in bilingual.groups())
    return variants - {""}


def image_url(thumbnails: list[dict] | None) -> str | None:
    valid = [t for t in thumbnails or [] if str(t.get("url", "")).startswith("https://")]
    return max(valid, key=lambda t: t.get("width", 0)).get("url") if valid else None


def different_performer(artist_id: str, title: str, album: str) -> bool:
    # A provider can merge two Korean namesakes into the same topic channel.
    # Exclude only recordings independently credited to the other performer.
    for proof in EXCLUSIONS.get(artist_id, []):
        if normalized(title).startswith(normalized(proof["titlePrefix"])) or normalized(proof["albumIncludes"]) in normalized(album):
            return True
    return False


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f".{os.getpid()}.{threading.get_ident()}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
    temporary.replace(path)


class CatalogBuilder:
    def __init__(self, client: Any, cache_path: Path, pause: float = 0.3):
        self.client = client
        self.cache_path = cache_path
        self.pause = pause
        self.last_request = 0.0

    def request(self, method: str, *args: Any, **kwargs: Any) -> Any:
        time.sleep(max(0, self.pause - (time.monotonic() - self.last_request)))
        self.last_request = time.monotonic()
        return getattr(self.client, method)(*args, **kwargs)

    def album(self, album_id: str, credited_channels: set | None = None) -> dict:
        path = self.cache_path / (album_id + ".json")
        if path.exists() and time.time() - path.stat().st_mtime < 7 * 86400:
            result = json.loads(path.read_text())
            return self.album_year(result)
        result = self.request("get_album", album_id)
        if credited_channels and not {a.get("id") for a in result.get("artists") or []} & credited_channels:
            # Provider "other versions" can contain another performer's album.
            # Its unavailable tracks must not invalidate this artist's catalog.
            # Do not cache an unchecked, possibly truncated foreign release.
            return self.album_year(result)
        # A provider response truncated before the last available track must not
        # become a successful cache entry. Use the complete audio playlist.
        expected = result.get("trackCount")
        if isinstance(expected, int) and len(result.get("tracks", [])) < expected:
            playlist_id = result.get("audioPlaylistId")
            if not playlist_id:
                raise ValueError("Incomplete album without a continuation playlist: " + album_id)
            playlist = self.request("get_playlist", playlist_id, limit=None)
            result["tracks"] = playlist.get("tracks", [])
            if len(result["tracks"]) < expected:
                if playlist.get("trackCount") == len(result["tracks"]) and result["tracks"]:
                    # The complete regional playlist explicitly declares fewer
                    # available recordings than the original album header.
                    result["unavailableTrackCount"] = expected - len(result["tracks"])
                else:
                    raise ValueError("Incomplete album: " + album_id)
        write_json(path, result)
        return self.album_year(result)

    @staticmethod
    def album_year(album: dict) -> dict:
        # The library treats Korean "2026년" as a views label. Only this exact
        # provider format establishes a release year; never infer it from views.
        localized_year = re.fullmatch(r"(\d{4})년", str(album.get("views", "")))
        if not album.get("year") and localized_year:
            album["year"] = localized_year.group(1)
        return album

    def resolve(self, artist: dict, pinned: str | None = None) -> tuple[str, dict]:
        if pinned:
            if not CHANNEL.fullmatch(pinned):
                raise ValueError("Invalid verified channel ID")
            return pinned, self.request("get_artist", pinned)
        reference_songs = list({recording_title(s["title"]): s for s in artist.get("identity", {}).get("referenceSongs", [])}.values())
        references = [recording_variants(s["title"]) for s in reference_songs]
        if not references:
            raise ValueError("Artist requires a verified YouTube Music channel ID")
        required = min(2, len(references))
        names = {normalized(n) for n in [artist["name"], artist["englishName"], *artist["aliases"]]}
        queries = list(dict.fromkeys([artist["name"], artist["englishName"]]))
        candidates: dict[str, dict] = {}
        for query in queries:
            for result in self.request("search", query, filter="artists", limit=20):
                channel = result.get("browseId", "")
                name = result.get("artist", result.get("title", ""))
                plain_name = re.sub(r"\s*\([^()]*\)\s*$", "", name)
                if CHANNEL.fullmatch(channel) and {normalized(name), normalized(plain_name)} & names:
                    candidates[channel] = result
        if not candidates:
            # Artist search can omit an indexed performer. A song credit is
            # eligible only when the reviewed title AND album match; the usual
            # independent discography verification still runs below.
            for reference in reference_songs[:4]:
                for song in self.request("search", artist["name"] + " " + reference["title"], filter="songs", limit=20):
                    if not recording_variants(song.get("title", "")) & recording_variants(reference["title"]) or normalized((song.get("album") or {}).get("name", "")) != normalized(reference.get("album", "")):
                        continue
                    for credit in song.get("artists", []):
                        channel = credit.get("id") or ""
                        name = re.sub(r"\s*\([^()]*\)\s*$", "", credit.get("name", ""))
                        if CHANNEL.fullmatch(channel) and normalized(name) in names:
                            candidates[channel] = credit
        verified = []
        release_verified = []
        for channel in candidates:
            try:
                profile = self.request("get_artist", channel)
            except (KeyError, UnavailableRelease):
                continue
            proof_songs = list(profile.get("songs", {}).get("results", []))
            titles = set().union(*(recording_variants(s.get("title", "")) for s in proof_songs))
            matches = lambda: sum(bool(title & titles) for title in references)
            album_proof = any(recording_variants(song.get("title", "")) & references[0]
                              and normalized((song.get("album") or {}).get("name", "")) == normalized(reference_songs[0].get("album", ""))
                              for song in profile.get("songs", {}).get("results", [])) if required == 1 else True
            if (matches() < required or not album_proof) and profile.get("songs", {}).get("browseId"):
                playlist = self.request("get_playlist", profile['songs']['browseId'].removeprefix('VL'), limit=None)
                for song in playlist.get('tracks', []):
                    if {a.get('id') for a in song.get('artists') or []} & {channel, profile.get('channelId')}:
                        proof_songs.append(song)
                        titles.update(recording_variants(song.get('title', '')))
                        if required == 1 and recording_variants(song.get('title', '')) & references[0] and normalized((song.get('album') or {}).get('name', '')) == normalized(reference_songs[0].get('album', '')):
                            album_proof = True
            if matches() < required or not album_proof:
                for release in (profile.get("albums", {}).get("results", []) + profile.get("singles", {}).get("results", []))[:3]:
                    try:
                        album = self.album(release["browseId"], {channel, profile.get("channelId")} - {None})
                    except UnavailableRelease:
                        continue
                    # Album credits must refer to the candidate, not a namesake.
                    if not any(a.get("id") in {channel, profile.get("channelId")} for a in album.get("artists") or []):
                        continue
                    for song in album.get("tracks", []):
                        credits = {a.get("id") for a in song.get("artists") or []}
                        if credits and not credits & {channel, profile.get("channelId")}:
                            continue
                        proof_songs.append({**song, 'album': {'name': album.get('title', '')}})
                        titles.update(recording_variants(song.get("title", "")))
                    if required == 1 and normalized(album.get("title", "")) == normalized(reference_songs[0].get("album", "")):
                        album_proof |= any(recording_variants(s.get("title", "")) & references[0] for s in album.get("tracks", []))
            if matches() < required or not album_proof:
                for reference in reference_songs[:3]:
                    for song in self.request("search", artist["name"] + " " + reference["title"], filter="songs", limit=10):
                        credits = {a.get("id") for a in song.get("artists", [])}
                        variants = recording_variants(song.get("title", ""))
                        if credits & {channel, profile.get("channelId")} and variants & recording_variants(reference["title"]):
                            proof_songs.append(song)
                            titles.update(variants)
                            if required == 1 and normalized((song.get("album") or {}).get("name", "")) == normalized(reference.get("album", "")):
                                album_proof = True
                    if matches() >= required and album_proof:
                        break
            if matches() >= required and album_proof:
                verified.append((channel, profile))
                pairs = sum(any(recording_variants(song.get('title', '')) & recording_variants(reference['title'])
                                and reference.get('album') and normalized((song.get('album') or {}).get('name', '')) == normalized(reference['album'])
                                for song in proof_songs) for reference in reference_songs)
                if pairs >= required:
                    release_verified.append((channel, profile))
        if len(verified) > 1 and len(release_verified) == 1:
            return release_verified[0]
        if len(verified) != 1:
            raise ArtistResolutionError(verified)
        return verified[0]

    def build(self, artist: dict, channel: str, profile: dict) -> dict:
        credited_channels = {channel, profile.get("channelId")} - {None}
        popular = profile.get("songs", {}).get("results", [])
        playlist_id = profile.get("songs", {}).get("browseId")
        if playlist_id:
            popular = self.request("get_playlist", playlist_id.removeprefix("VL"), limit=None).get("tracks", [])
        ranking = {track["videoId"]: index for index, track in enumerate(popular) if track.get("videoId")}
        releases: dict[str, dict] = {}
        for kind in ("albums", "singles"):
            section = profile.get(kind, {})
            items = section.get("results", [])
            if section.get("browseId"):
                items = self.request("get_artist_albums", section["browseId"], section.get("params"), limit=None)
            for item in items:
                if item.get("browseId", "").startswith("MPRE"):
                    releases[item["browseId"]] = item
        songs: dict[str, dict] = {}
        albums = []
        release_metadata = {}
        participating = {track.get("album", {}).get("id") for track in popular if isinstance(track.get("album"), dict)
                         and {a.get("id") for a in track.get("artists", [])} & credited_channels}
        for album_id in participating:
            if album_id and album_id.startswith("MPRE"):
                releases.setdefault(album_id, {"browseId": album_id})
        pending = list(releases)
        visited = set()
        # Include other official album versions (deluxe/remasters), not just the
        # initial artist shelf. Never treat related recommendations as releases.
        while pending:
            album_id = pending.pop(0)
            if album_id in visited:
                continue
            visited.add(album_id)
            try:
                album = self.album(album_id, None if album_id in participating else credited_channels)
            except UnavailableRelease:
                continue
            album_credits = {a.get("id") for a in album.get("artists") or []}
            if not album_credits & credited_channels and album_id not in participating:
                continue
            release_metadata[album_id] = album
            order = len(albums)
            album_songs = []
            for track_index, track in enumerate(album.get("tracks", [])):
                video = track.get("videoId") or ""
                credits = {a.get("id") for a in track.get("artists") or []}
                if not VIDEO.fullmatch(video) or not track.get("title") or (credits and not credits & credited_channels):
                    continue
                if different_performer(artist["id"], track["title"], album["title"]):
                    continue
                song = {"id": "youtube:" + video, "title": track["title"], "artistName": artist["name"], "artistId": channel,
                        "album": album["title"], "albumId": album_id, "trackNumber": track_index + 1,
                        "url": "https://music.youtube.com/watch?v=" + video, "locale": "ko-KR", "releaseOrder": order}
                year = str(album.get("year", ""))
                if re.fullmatch(r"\d{4}", year):
                    song["year"] = year
                artwork = image_url(track.get("thumbnails")) or image_url(album.get("thumbnails"))
                if artwork:
                    song["artwork"] = artwork
                if video in ranking:
                    song["popularityRank"] = ranking[video]
                songs.setdefault(song["id"], song)
                album_songs.append(song["id"])
            if album_songs:
                entry = {"id": album_id, "title": album["title"], "songIds": album_songs}
                if re.fullmatch(r"\d{4}", str(album.get("year", ""))):
                    entry["year"] = str(album["year"])
                artwork = image_url(album.get("thumbnails"))
                if artwork:
                    entry["artwork"] = artwork
                if album.get("unavailableTrackCount"):
                    entry["unavailableTrackCount"] = album["unavailableTrackCount"]
                albums.append(entry)
            for version in album.get("other_versions", []):
                version_id = version.get("browseId", "")
                if version_id.startswith("MPRE") and version_id not in visited:
                    pending.append(version_id)
        # Collaborations/OST tracks can occur in the artist's all-songs playlist
        # without being listed as a release on the artist's album shelf.
        for track in popular:
            video = track.get("videoId") or ""
            credits = {a.get("id") for a in track.get("artists", [])}
            if not VIDEO.fullmatch(video) or not track.get("title") or not credits & credited_channels:
                continue
            song_id = "youtube:" + video
            if song_id in songs:
                continue
            album = track.get("album") or {}
            title = album.get("name", "") if isinstance(album, dict) else str(album)
            if different_performer(artist["id"], track["title"], title):
                continue
            song = {"id": song_id, "title": track["title"], "artistName": artist["name"], "artistId": channel,
                    "album": title, "url": "https://music.youtube.com/watch?v=" + video, "locale": "ko-KR", "popularityRank": ranking[video]}
            artwork = image_url(track.get("thumbnails"))
            if artwork:
                song["artwork"] = artwork
            songs[song_id] = song
            if title:
                album_id = album.get("id") if isinstance(album, dict) else None
                album_id = album_id or "playlist:" + normalized(title)
                song["albumId"] = album_id
                metadata = release_metadata.get(album_id, {})
                if re.fullmatch(r"\d{4}", str(metadata.get("year", ""))):
                    song["year"] = str(metadata["year"])
                entry = next((a for a in albums if a["id"] == album_id), None)
                if not entry:
                    entry = {"id": album_id, "title": title, "songIds": []}
                    if song.get("year"):
                        entry["year"] = song["year"]
                    artwork = image_url(metadata.get("thumbnails"))
                    if artwork:
                        entry["artwork"] = artwork
                    albums.append(entry)
                entry["songIds"].append(song_id)
        if not songs:
            raise ValueError("No verified songs returned; existing data preserved")
        return {"source": "youtube-music", "artistId": artist["id"], "channelId": channel,
                "updatedAt": datetime.now(timezone.utc).isoformat(), "complete": True,
                "songs": list(songs.values()), "albums": albums}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artists", required=True, type=Path)
    parser.add_argument("--ids", default="")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--cache", type=Path, default=Path("/tmp/tier-ytmusic-cache"))
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--missing-only", action="store_true")
    args = parser.parse_args()
    artists = json.loads(args.artists.read_text())
    if args.ids:
        ids = set(args.ids.split(","))
        artists = [a for a in artists if a["id"] in ids]
    target = ROOT / "public/music"
    target.mkdir(parents=True, exist_ok=True)
    if args.missing_only:
        artists = [artist for artist in artists if not (target / (artist["id"] + ".json")).exists()]
    # The least recently refreshed artists go first, so bounded scheduled runs
    # cover the entire catalog instead of refreshing the same first page.
    status_path = ROOT / "src/data/music-refresh-status.json"
    status = json.loads(status_path.read_text()) if status_path.exists() else {}
    def refreshed_at(artist: dict) -> str:
        path = target / (artist["id"] + ".json")
        updated = json.loads(path.read_text()).get("updatedAt", "") if path.exists() else ""
        return max(updated, status.get(artist["id"], {}).get("attemptedAt", ""))
    artists.sort(key=refreshed_at)
    if args.limit:
        artists = artists[:args.limit]
    pins_path = ROOT / "src/data/youtube-channels.json"
    pins = json.loads(pins_path.read_text()) if pins_path.exists() else {}
    failed = []
    local = threading.local()
    def collect(artist):
        if not hasattr(local, "builder"):
            local.builder = CatalogBuilder(PublicMetadataClient(), args.cache)
        builder = local.builder
        try:
            channel, profile = builder.resolve(artist, pins.get(artist["id"]))
            catalog = builder.build(artist, channel, profile)
            write_json(target / (artist["id"] + ".json"), catalog)
            if artist["id"] in FAMILIES:
                write_json(target / "group-bases" / (artist["id"] + ".json"), catalog)
            return artist, channel, catalog, None
        except Exception as error:
            return artist, None, None, error
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 8))) as executor:
        futures = [executor.submit(collect, artist) for artist in artists]
        for index, future in enumerate(as_completed(futures)):
            artist, channel, catalog, error = future.result()
            status[artist["id"]] = {"attemptedAt": datetime.now(timezone.utc).isoformat(), "ok": error is None}
            if error is None:
                pins[artist["id"]] = channel
                write_json(pins_path, pins)
                print(f"[{index + 1}/{len(artists)}] {artist['name']}: {len(catalog['songs'])} songs / {len(catalog['albums'])} albums", flush=True)
            else:
                failed.append({"id": artist["id"], "error": str(error)})
                print(f"[{index + 1}/{len(artists)}] {artist['name']}: existing catalog preserved ({type(error).__name__}: {str(error)[:160]})", flush=True)
            write_json(status_path, status)
            write_json(Path("/tmp/tier-ytmusic-refresh-report.json"), {"failed": failed, "attempted": len(artists), "completed": index + 1})
    write_json(Path("/tmp/tier-ytmusic-refresh-report.json"), {"failed": failed, "attempted": len(artists)})
    if artists and len(failed) == len(artists) and not any((target / (a["id"] + ".json")).exists() for a in artists):
        raise SystemExit("YouTube Music refresh failed; no catalog was replaced")


if __name__ == "__main__":
    main()
