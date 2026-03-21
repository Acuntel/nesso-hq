"""
Nesso Content Engine V20 — Background Music Sourcing
Downloads royalty-free music from YouTube Audio Library via yt-dlp.
"""

import glob
import logging
import os
import random

import yt_dlp

from verify import verify_audio

log = logging.getLogger(__name__)

MUSIC_SEARCH_QUERIES = [
    "emotional lo-fi beat royalty free",
    "sad piano ambient background music",
    "friendship nostalgic beat free",
    "lo-fi chill emotional beat",
    "melancholy piano background music free",
    "late night vibes lo-fi instrumental",
    "soft emotional beat no copyright",
    "nostalgic acoustic guitar background",
]


def _resolve_downloaded_file(output_path: str) -> None:
    """Find the actual file yt-dlp created and rename it to output_path.
    yt-dlp postprocessors change extensions unpredictably, so we glob
    for any audio file matching the base name."""
    if os.path.exists(output_path):
        return

    base_no_ext = os.path.splitext(output_path)[0]
    candidates = glob.glob(base_no_ext + ".*")
    audio_exts = {".mp3", ".m4a", ".webm", ".opus", ".ogg", ".wav", ".aac"}
    candidates = [c for c in candidates if os.path.splitext(c)[1].lower() in audio_exts]
    if candidates:
        os.rename(candidates[0], output_path)


def download_background_music(
    output_path: str,
    max_duration: float = 60.0,
    exclude_queries: list[str] | None = None,
) -> str:
    """
    Download a royalty-free background music track.
    Each video gets different music — rotate through queries.
    """
    available = [q for q in MUSIC_SEARCH_QUERIES if q not in (exclude_queries or [])]
    if not available:
        available = MUSIC_SEARCH_QUERIES

    query = random.choice(available)
    log.info("Searching for background music: '%s'", query)

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "default_search": "ytsearch5",
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            results = ydl.extract_info(f"ytsearch5:{query}", download=False)

        entries = results.get("entries", [])
        if not entries:
            log.warning("No music results for: %s", query)
            return ""

        # Filter for reasonable duration (30s-5min)
        candidates = []
        for entry in entries:
            dur = entry.get("duration", 0)
            if dur and 30 <= dur <= 300:
                candidates.append(entry)

        if not candidates:
            candidates = entries[:3]  # take whatever we got

        chosen = random.choice(candidates)
        url = chosen.get("url") or f"https://youtube.com/watch?v={chosen['id']}"

        # Download audio only — use %(ext)s so yt-dlp controls the extension
        base_no_ext = os.path.splitext(output_path)[0]
        dl_opts = {
            "format": "bestaudio[ext=m4a]/bestaudio",
            "outtmpl": base_no_ext + ".%(ext)s",
            "quiet": True,
            "no_warnings": True,
            "postprocessors": [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }],
        }

        with yt_dlp.YoutubeDL(dl_opts) as ydl:
            ydl.download([url])

        _resolve_downloaded_file(output_path)

        if verify_audio(output_path):
            log.info("Music downloaded: %s", output_path)
            return output_path
        else:
            log.warning("Music file invalid: %s", output_path)
            return ""

    except Exception as e:
        log.warning("Music download failed: %s", e)
        return ""


def download_psych_sfx(output_path: str) -> str:
    """
    Download a dramatic 'psych' / 'sike' sound effect from YouTube.
    This is the brand transition sound used in every video.
    """
    queries = [
        "psych sound effect dramatic",
        "sike sound effect bass boosted",
        "dramatic reveal sound effect short",
    ]

    for query in queries:
        try:
            ydl_opts = {
                "quiet": True,
                "no_warnings": True,
                "extract_flat": True,
                "default_search": "ytsearch3",
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                results = ydl.extract_info(f"ytsearch3:{query}", download=False)

            entries = results.get("entries", [])
            # Pick shortest one (sfx should be short)
            entries = [e for e in entries if e.get("duration", 999) <= 10]
            if not entries:
                continue

            chosen = entries[0]
            url = chosen.get("url") or f"https://youtube.com/watch?v={chosen['id']}"

            # Download audio — use %(ext)s so yt-dlp controls the extension
            base_no_ext = os.path.splitext(output_path)[0]
            dl_opts = {
                "format": "bestaudio[ext=m4a]/bestaudio",
                "outtmpl": base_no_ext + ".%(ext)s",
                "quiet": True,
                "no_warnings": True,
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }],
            }

            with yt_dlp.YoutubeDL(dl_opts) as ydl:
                ydl.download([url])

            _resolve_downloaded_file(output_path)

            if verify_audio(output_path):
                log.info("Psych SFX downloaded: %s", output_path)
                return output_path

        except Exception as e:
            log.warning("Psych SFX download failed for '%s': %s", query, e)
            continue

    log.error("Could not download psych SFX from any source")
    return ""
