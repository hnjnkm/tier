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
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ytmusicapi import YTMusic

ROOT = Path(__file__).resolve().parents[1]
CHANNEL = re.compile(r"^UC[\w-]{22}$")
VIDEO = re.compile(r"^[\w-]{11}$")


def normalized(value: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", value).lower() if c.isalnum())


def recording_title(value: str) -> str:
    return normalized(re.sub(r"\s*\((?:feat\.?|featuring|with|duet).*", "", value, flags=re.I))


def image_url(thumbnails: list[dict] | None) -> str | None:
    valid = [t for t in thumbnails or [] if str(t.get("url", "")).startswith("https://")]
    return max(valid, key=lambda t: t.get("width", 0)).get("url") if valid else None


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
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

    def album(self, album_id: str) -> dict:
        path = self.cache_path / (album_id + ".json")
        if path.exists() and time.time() - path.stat().st_mtime < 7 * 86400:
            return json.loads(path.read_text())
        result = self.request("get_album", album_id)
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
                raise ValueError("Incomplete album: " + album_id)
        write_json(path, result)
        return result

    def resolve(self, artist: dict, pinned: str | None = None) -> tuple[str, dict]:
        if pinned:
            if not CHANNEL.fullmatch(pinned):
                raise ValueError("Invalid verified channel ID")
            return pinned, self.request("get_artist", pinned)
        references = {recording_title(s["title"]) for s in artist.get("identity", {}).get("referenceSongs", [])}
        if len(references) < 2:
            raise ValueError("Artist requires a verified YouTube Music channel ID")
        names = {normalized(n) for n in [artist["name"], artist["englishName"], *artist["aliases"]]}
        queries = list(dict.fromkeys([artist["name"], artist["englishName"]]))
        candidates: dict[str, dict] = {}
        for query in queries:
            for result in self.request("search", query, filter="artists", limit=20):
                channel = result.get("browseId", "")
                name = re.sub(r"\s*\([^()]*\)\s*$", "", result.get("artist", result.get("title", "")))
                if CHANNEL.fullmatch(channel) and normalized(name) in names:
                    candidates[channel] = result
        verified = []
        for channel in candidates:
            profile = self.request("get_artist", channel)
            titles = {recording_title(s.get("title", "")) for s in profile.get("songs", {}).get("results", [])}
            if len(titles & references) < 2:
                for release in (profile.get("albums", {}).get("results", []) + profile.get("singles", {}).get("results", []))[:3]:
                    album = self.album(release["browseId"])
                    # Album credits must refer to the candidate, not a namesake.
                    if not any(a.get("id") in {channel, profile.get("channelId")} for a in album.get("artists", [])):
                        continue
                    titles.update(recording_title(s.get("title", "")) for s in album.get("tracks", []))
            if len(titles & references) >= 2:
                verified.append((channel, profile))
        if len(verified) != 1:
            raise ValueError("No unique channel matched the verified discography")
        return verified[0]

    def build(self, artist: dict, channel: str, profile: dict) -> dict:
        credited_channels = {channel, profile.get("channelId")}
        popular = profile.get("songs", {}).get("results", [])
        playlist_id = profile.get("songs", {}).get("browseId")
        if playlist_id:
            popular = self.request("get_playlist", playlist_id.removeprefix("VL"), limit=None).get("tracks", [])
        ranking = {track["videoId"]: index for index, track in enumerate(popular) if track.get("videoId")}
        releases: dict[str, dict] = {}
        for kind in ("albums", "singles"):
            section = profile.get(kind, {})
            items = section.get("results", [])
            if section.get("browseId") and section.get("params"):
                items = self.request("get_artist_albums", section["browseId"], section["params"], limit=None)
            for item in items:
                if item.get("browseId", "").startswith("MPRE"):
                    releases[item["browseId"]] = item
        songs: dict[str, dict] = {}
        albums = []
        pending = list(releases)
        visited = set()
        # Include other official album versions (deluxe/remasters), not just the
        # initial artist shelf. Never treat related recommendations as releases.
        while pending:
            album_id = pending.pop(0)
            if album_id in visited:
                continue
            visited.add(album_id)
            album = self.album(album_id)
            album_credits = {a.get("id") for a in album.get("artists", [])}
            if not album_credits & credited_channels:
                continue
            order = len(albums)
            album_songs = []
            for track_index, track in enumerate(album.get("tracks", [])):
                video = track.get("videoId", "")
                credits = {a.get("id") for a in track.get("artists", [])}
                if not VIDEO.fullmatch(video) or not track.get("title") or (credits and not credits & credited_channels):
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
                albums.append(entry)
            for version in album.get("other_versions", []):
                version_id = version.get("browseId", "")
                if version_id.startswith("MPRE") and version_id not in visited:
                    pending.append(version_id)
        # Collaborations/OST tracks can occur in the artist's all-songs playlist
        # without being listed as a release on the artist's album shelf.
        for track in popular:
            video = track.get("videoId", "")
            credits = {a.get("id") for a in track.get("artists", [])}
            if not VIDEO.fullmatch(video) or not track.get("title") or not credits & credited_channels:
                continue
            song_id = "youtube:" + video
            if song_id in songs:
                continue
            album = track.get("album") or {}
            title = album.get("name", "") if isinstance(album, dict) else str(album)
            song = {"id": song_id, "title": track["title"], "artistName": artist["name"], "artistId": channel,
                    "album": title, "url": "https://music.youtube.com/watch?v=" + video, "locale": "ko-KR", "popularityRank": ranking[video]}
            artwork = image_url(track.get("thumbnails"))
            if artwork:
                song["artwork"] = artwork
            songs[song_id] = song
            if title:
                album_id = album.get("id") if isinstance(album, dict) else None
                album_id = album_id or "playlist:" + normalized(title)
                entry = next((a for a in albums if a["id"] == album_id), None)
                if not entry:
                    entry = {"id": album_id, "title": title, "songIds": []}
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
    args = parser.parse_args()
    artists = json.loads(args.artists.read_text())
    if args.ids:
        ids = set(args.ids.split(","))
        artists = [a for a in artists if a["id"] in ids]
    target = ROOT / "public/music"
    target.mkdir(parents=True, exist_ok=True)
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
    builder = CatalogBuilder(YTMusic(language="ko", location="KR"), args.cache)
    failed = []
    for index, artist in enumerate(artists):
        status[artist["id"]] = {"attemptedAt": datetime.now(timezone.utc).isoformat(), "ok": False}
        try:
            channel, profile = builder.resolve(artist, pins.get(artist["id"]))
            catalog = builder.build(artist, channel, profile)
            write_json(target / (artist["id"] + ".json"), catalog)
            pins[artist["id"]] = channel
            write_json(pins_path, pins)
            status[artist["id"]]["ok"] = True
            print(f"[{index + 1}/{len(artists)}] {artist['name']}: {len(catalog['songs'])} songs / {len(catalog['albums'])} albums", flush=True)
        except Exception as error:
            failed.append({"id": artist["id"], "error": str(error)})
            print(f"[{index + 1}/{len(artists)}] {artist['name']}: existing catalog preserved ({type(error).__name__})", flush=True)
        write_json(status_path, status)
    write_json(Path("/tmp/tier-ytmusic-refresh-report.json"), {"failed": failed, "attempted": len(artists)})
    if len(failed) == len(artists):
        raise SystemExit("YouTube Music refresh failed; no catalog was replaced")


if __name__ == "__main__":
    main()
