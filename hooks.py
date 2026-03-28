"""
Nesso Content Engine V20 — Hook Video Sourcing

Primary: YouTube via yt-dlp with cookie authentication (bypasses bot detection).
Fallback: Pexels API (free stock video, always works from datacenter IPs).
"""

import base64
import logging
import os
import random
import subprocess
import tempfile

import requests
import yt_dlp

from config import (
    FFMPEG_PRESET,
    FFMPEG_THREADS,
    FFMPEG_TIMEOUT,
    HEIGHT,
    HOOK_SEARCH_QUERIES,
    MAX_HOOK_CANDIDATES,
    PEXELS_API_KEY,
    WIDTH,
    YOUTUBE_SEARCH_COUNT,
)
from verify import verify_clip

log = logging.getLogger(__name__)

# ── Cookie Management ────────────────────────────────────────────────────

_cookies_path: str | None = None


def _get_cookies_path() -> str:
    """
    Get path to YouTube cookies file.
    Decodes from YT_COOKIES_B64 env var (gzipped + base64) on first call.
    """
    global _cookies_path
    if _cookies_path and os.path.exists(_cookies_path):
        return _cookies_path

    b64_cookies = os.environ.get("YT_COOKIES_B64", "")
    if not b64_cookies:
        return ""

    try:
        import gzip
        compressed = base64.b64decode(b64_cookies)
        cookies_data = gzip.decompress(compressed)
        cookies_file = os.path.join(tempfile.gettempdir(), "yt_cookies.txt")
        with open(cookies_file, "wb") as f:
            f.write(cookies_data)
        _cookies_path = cookies_file
        log.info("YouTube cookies loaded (%d bytes)", len(cookies_data))
        return cookies_file
    except Exception as e:
        log.warning("Failed to decode YouTube cookies: %s", e)
        return ""


def _yt_base_opts() -> dict:
    """Base yt-dlp options with cookies if available."""
    opts = {
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 30,
        "retries": 3,
    }
    cookies = _get_cookies_path()
    if cookies:
        opts["cookiefile"] = cookies
    return opts


# ── YouTube Search & Download ────────────────────────────────────────────


def search_youtube(query: str) -> list[dict]:
    """Search YouTube and return candidates."""
    ydl_opts = {
        **_yt_base_opts(),
        "extract_flat": True,
        "default_search": f"ytsearch{YOUTUBE_SEARCH_COUNT}",
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            results = ydl.extract_info(
                f"ytsearch{YOUTUBE_SEARCH_COUNT}:{query}", download=False
            )

        candidates = []
        for entry in results.get("entries", []):
            vid_id = entry.get("id")
            if not vid_id:
                continue
            views = entry.get("view_count") or 0
            candidates.append({
                "id": vid_id,
                "url": entry.get("url") or f"https://youtube.com/watch?v={vid_id}",
                "title": entry.get("title", ""),
                "view_count": views,
            })

        candidates.sort(key=lambda x: x["view_count"], reverse=True)
        log.info("YouTube '%s': %d candidates", query, len(candidates))
        return candidates
    except Exception as e:
        log.warning("YouTube search failed: %s", e)
        return []


def get_most_replayed_moment(video_url: str) -> tuple[float, float]:
    """Extract the most replayed segment using heatmap data."""
    ydl_opts = {**_yt_base_opts(), "extract_flat": False}

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=False)
        duration = info.get("duration", 0)
        heatmap = info.get("heatmap", None)

        if not heatmap or not duration:
            end = max(5, min(duration * 0.15, 10))
            log.info("No heatmap for %s, using first %.1fs", video_url, end)
            return (0, end)

        if isinstance(heatmap[0], dict):
            peak = max(heatmap, key=lambda x: x.get("value", 0))
            peak_start = peak["start_time"]
            peak_end = peak["end_time"]
        else:
            peak = max(heatmap, key=lambda x: x[1])
            peak_position = peak[0]
            peak_start = peak_position * duration
            peak_end = peak_start + min(duration * 0.05, 6)

        expanded_start = max(0, peak_start - 3)
        expanded_end = min(duration, peak_end + 3)

        clip_dur = expanded_end - expanded_start
        if clip_dur < 5:
            deficit = 5 - clip_dur
            expanded_start = max(0, expanded_start - deficit / 2)
            expanded_end = min(duration, expanded_end + deficit / 2)

        return (expanded_start, expanded_end)


def download_youtube_hook(
    url: str, start_time: float, end_time: float, output_path: str
) -> str:
    """Download a segment from YouTube using cookies."""
    ydl_opts = {
        **_yt_base_opts(),
        "format": "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
        "outtmpl": output_path,
        "download_ranges": yt_dlp.utils.download_range_func(
            None, [(start_time, end_time)]
        ),
        "force_keyframes_at_cuts": True,
        "merge_output_format": "mp4",
        "fragment_retries": 3,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    if not verify_clip(output_path):
        raise RuntimeError(f"YouTube hook clip verification failed: {output_path}")

    log.info("YouTube hook downloaded: %s (%.1f-%.1fs)", output_path, start_time, end_time)
    return output_path


def _try_youtube_hook(query: str, temp_dir: str) -> tuple[str, str, float, str] | None:
    """
    Try to get a hook from YouTube. Returns (clip_path, audio_path, duration, desc)
    or None if YouTube fails.
    """
    candidates = search_youtube(query)
    if not candidates:
        return None

    for candidate in candidates[:MAX_HOOK_CANDIDATES]:
        url = candidate["url"]
        try:
            start, end = get_most_replayed_moment(url)
            if start is None:
                continue

            desc = candidate.get("title", "YouTube video")
            raw_clip = os.path.join(temp_dir, "hook_raw.mp4")
            download_youtube_hook(url, start, end, raw_clip)

            # Extract audio before cropping
            hook_audio = os.path.join(temp_dir, "hook_audio.m4a")
            extract_hook_audio(raw_clip, hook_audio)
            if not os.path.exists(hook_audio):
                hook_audio = ""

            # Crop to vertical
            hook_vertical = os.path.join(temp_dir, "hook_v.mp4")
            crop_to_vertical(raw_clip, hook_vertical)

            try:
                os.remove(raw_clip)
            except OSError:
                pass

            from verify import get_duration
            duration = get_duration(hook_vertical)

            log.info("YouTube hook: %.1fs — %s", duration, desc)
            return hook_vertical, hook_audio, duration, desc

        except Exception as e:
            log.warning("YouTube hook failed for %s: %s", url, str(e)[:200])
            continue

    return None


# ── Pexels Fallback ──────────────────────────────────────────────────────

PEXELS_QUERY_MAP = [
    (["car crash", "dashcam", "near miss", "close call"], "car crash accident"),
    (["motorcycle", "truck"], "motorcycle speed racing"),
    (["cliff", "jumping"], "cliff jumping ocean"),
    (["base jump", "bungee"], "skydiving extreme"),
    (["climbing", "boulder", "wingsuit"], "rock climbing mountain"),
    (["demolition", "building", "implosion"], "demolition building"),
    (["fireworks"], "fireworks night sky"),
    (["explosion", "gender reveal"], "explosion fire"),
    (["ski", "snowboard"], "snowboarding skiing mountain"),
    (["surfing", "big wave", "wipeout"], "surfing big wave ocean"),
    (["parkour"], "parkour urban"),
    (["skateboard"], "skateboarding tricks"),
    (["bmx"], "bmx jump extreme"),
    (["lightning"], "lightning storm dramatic"),
    (["bear", "animal", "dog"], "wild animals nature"),
    (["ocean wave", "tsunami"], "ocean waves crashing"),
    (["tornado"], "tornado storm"),
    (["volcano"], "volcano eruption lava"),
    (["shark"], "underwater ocean"),
    (["satisfying", "hydraulic"], "satisfying slow motion"),
    (["drone", "aerial"], "drone aerial view"),
    (["sports", "goal", "buzzer"], "sports goal celebration"),
]


def _map_to_pexels_query(query: str) -> str:
    q = query.lower()
    for keywords, pexels_q in PEXELS_QUERY_MAP:
        if any(kw in q for kw in keywords):
            return pexels_q
    cleaned = q.replace("caught on camera", "").replace("compilation", "").strip()
    return cleaned or "extreme action"


def _try_pexels_hook(query: str, temp_dir: str) -> tuple[str, str, float, str] | None:
    """Fallback: get a hook from Pexels."""
    if not PEXELS_API_KEY:
        log.warning("PEXELS_API_KEY not set — cannot use Pexels fallback")
        return None

    pexels_query = _map_to_pexels_query(query)

    try:
        resp = requests.get(
            "https://api.pexels.com/videos/search",
            params={"query": pexels_query, "per_page": 15, "size": "medium"},
            headers={"Authorization": PEXELS_API_KEY},
            timeout=15,
        )
        if resp.status_code != 200:
            return None

        data = resp.json()
        candidates = []
        for video in data.get("videos", []):
            dur = video.get("duration", 0)
            if dur < 6 or dur > 120:
                continue
            best_file = None
            for vf in video.get("video_files", []):
                h = vf.get("height", 0)
                if 720 <= h <= 1920:
                    if best_file is None or h > best_file.get("height", 0):
                        best_file = vf
            if not best_file and video.get("video_files"):
                best_file = video["video_files"][0]
            if best_file:
                candidates.append({
                    "download_url": best_file["link"],
                    "duration": dur,
                    "title": pexels_query,
                })

        if not candidates:
            return None

        chosen = random.choice(candidates[:3])

        # Download
        raw_path = os.path.join(temp_dir, "hook_pexels_raw.mp4")
        r = requests.get(chosen["download_url"], stream=True, timeout=60)
        r.raise_for_status()
        with open(raw_path, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)

        # Trim
        trimmed = os.path.join(temp_dir, "hook_raw.mp4")
        subprocess.run(
            ["ffmpeg", "-y", "-threads", FFMPEG_THREADS, "-i", raw_path, "-t", "15", "-c", "copy", trimmed],
            capture_output=True, text=True, timeout=FFMPEG_TIMEOUT,
        )
        try:
            os.remove(raw_path)
        except OSError:
            pass

        hook_audio = os.path.join(temp_dir, "hook_audio.m4a")
        extract_hook_audio(trimmed, hook_audio)
        if not os.path.exists(hook_audio):
            hook_audio = ""

        hook_vertical = os.path.join(temp_dir, "hook_v.mp4")
        crop_to_vertical(trimmed, hook_vertical)
        try:
            os.remove(trimmed)
        except OSError:
            pass

        from verify import get_duration
        duration = get_duration(hook_vertical)
        desc = f"Pexels: {chosen['title']}"
        log.info("Pexels hook: %.1fs — %s", duration, desc)
        return hook_vertical, hook_audio, duration, desc

    except Exception as e:
        log.warning("Pexels fallback failed: %s", e)
        return None


# ── Shared Utilities ─────────────────────────────────────────────────────


def crop_to_vertical(input_path: str, output_path: str) -> str:
    """Crop a video to 9:16 vertical."""
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-i", input_path,
        "-vf", (
            f"crop=ih*9/16:ih,scale={WIDTH}:{HEIGHT}:"
            "force_original_aspect_ratio=decrease,"
            f"pad={WIDTH}:{HEIGHT}:-1:-1:color=black"
        ),
        "-preset", FFMPEG_PRESET,
        "-an",
        "-t", "15",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        raise RuntimeError(f"Crop failed: {result.stderr[-500:]}")
    if not verify_clip(output_path):
        raise RuntimeError(f"Cropped clip verification failed: {output_path}")
    return output_path


def extract_hook_audio(input_path: str, output_path: str) -> str:
    """Extract audio from the hook clip."""
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-i", input_path,
        "-vn", "-acodec", "aac", "-b:a", "128k",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        log.warning("Audio extraction failed (video may have no audio)")
        return ""
    return output_path


# ── Main Entry Point ─────────────────────────────────────────────────────


def get_full_hook(
    query: str,
    temp_dir: str,
) -> tuple[str, str, float, str]:
    """
    Full hook pipeline: YouTube (primary) → Pexels (fallback).
    Returns (vertical_clip_path, audio_path, duration, description).
    """
    # Try YouTube first
    result = _try_youtube_hook(query, temp_dir)
    if result:
        return result

    log.warning("YouTube failed for '%s', trying Pexels fallback", query)

    # Fallback to Pexels
    result = _try_pexels_hook(query, temp_dir)
    if result:
        return result

    raise RuntimeError(f"No hook found for query: {query} (both YouTube and Pexels failed)")
