"""
Nesso Content Engine V20 — YouTube Hook Sourcing & Heatmap Extraction
"""

import logging
import os
import subprocess

import yt_dlp

from config import (
    FFMPEG_PRESET,
    FFMPEG_THREADS,
    FFMPEG_TIMEOUT,
    HEIGHT,
    MAX_DOWNLOAD_HEIGHT,
    MAX_HOOK_CANDIDATES,
    MIN_VIEWS_FOR_HEATMAP,
    WIDTH,
    YOUTUBE_SEARCH_COUNT,
)
from verify import verify_clip

log = logging.getLogger(__name__)


def get_most_replayed_moment(video_url: str) -> tuple[float, float]:
    """
    Extract the most replayed segment from a YouTube video using heatmap data.
    Returns (start_seconds, end_seconds) of the peak moment.
    Videos need 50K+ views to have heatmap data.
    """
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=False)
        duration = info.get("duration", 0)
        heatmap = info.get("heatmap", None)

        if not heatmap or not duration:
            # FALLBACK: No heatmap — use first 15% of video
            end = min(duration * 0.15, 8)
            log.info("No heatmap for %s, using first %.1fs", video_url, end)
            return (0, end)

        # Find the peak intensity segment
        if isinstance(heatmap[0], dict):
            # New format: {'start_time': float, 'end_time': float, 'value': float}
            peak = max(heatmap, key=lambda x: x.get("value", 0))
            peak_start = peak["start_time"]
            peak_end = peak["end_time"]
        else:
            # Legacy format: [[position, intensity], ...]
            peak = max(heatmap, key=lambda x: x[1])
            peak_position = peak[0]
            peak_start = peak_position * duration
            peak_end = peak_start + min(duration * 0.05, 6)

        # Expand window to capture full action — 2s before, 1s after
        expanded_start = max(0, peak_start - 2)
        expanded_end = min(duration, peak_end + 1)

        log.info(
            "Heatmap peak for %s: %.1f-%.1fs (expanded: %.1f-%.1fs)",
            video_url, peak_start, peak_end, expanded_start, expanded_end,
        )
        return (expanded_start, expanded_end)


def search_youtube(query: str) -> list[dict]:
    """
    Search YouTube and return candidates filtered by view count.
    Returns list of dicts with 'id', 'url', 'title', 'view_count'.
    """
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "default_search": f"ytsearch{YOUTUBE_SEARCH_COUNT}",
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        results = ydl.extract_info(
            f"ytsearch{YOUTUBE_SEARCH_COUNT}:{query}", download=False
        )

    candidates = []
    for entry in results.get("entries", []):
        views = entry.get("view_count", 0)
        if views and views >= MIN_VIEWS_FOR_HEATMAP:
            candidates.append({
                "id": entry.get("id"),
                "url": entry.get("url") or f"https://youtube.com/watch?v={entry['id']}",
                "title": entry.get("title", ""),
                "view_count": views,
            })

    candidates.sort(key=lambda x: x["view_count"], reverse=True)
    log.info("Query '%s': %d candidates with %d+ views", query, len(candidates), MIN_VIEWS_FOR_HEATMAP)
    return candidates


def search_and_find_hook(query: str) -> tuple[str | None, float | None, float | None, str]:
    """
    Search YouTube for extreme content and return the most replayed moment.
    Returns (url, start_time, end_time, description).
    """
    candidates = search_youtube(query)

    if not candidates:
        log.warning("No candidates found for query: %s", query)
        return None, None, None, ""

    # Try top candidates for heatmap availability
    for candidate in candidates[:MAX_HOOK_CANDIDATES]:
        url = candidate["url"]
        try:
            start, end = get_most_replayed_moment(url)
            if start is not None:
                desc = candidate.get("title", "extreme video")
                log.info("Hook found: %s (%.1f-%.1fs) — %s", url, start, end, desc)
                return url, start, end, desc
        except Exception as e:
            log.warning("Failed heatmap for %s: %s", url, e)
            continue

    # If no heatmap found, use highest-viewed and take first 6s
    fallback = candidates[0]
    log.info("No heatmap available, using first 6s of %s", fallback["url"])
    return fallback["url"], 0, 6, fallback.get("title", "extreme video")


def download_hook_clip(
    url: str,
    start_time: float,
    end_time: float,
    output_path: str,
) -> str:
    """
    Download ONLY the needed segment from YouTube.
    Uses download_ranges to avoid downloading entire videos (Railway OOM fix).
    """
    ydl_opts = {
        "format": f"bestvideo[height<={MAX_DOWNLOAD_HEIGHT}][ext=mp4]+bestaudio[ext=m4a]/"
                  f"best[height<={MAX_DOWNLOAD_HEIGHT}]",
        "outtmpl": output_path,
        "download_ranges": yt_dlp.utils.download_range_func(
            None, [(start_time, end_time)]
        ),
        "force_keyframes_at_cuts": True,
        "quiet": True,
        "no_warnings": True,
        "merge_output_format": "mp4",
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    if not verify_clip(output_path):
        raise RuntimeError(f"Hook clip verification failed: {output_path}")

    log.info("Hook clip downloaded: %s (%.1f-%.1fs)", output_path, start_time, end_time)
    return output_path


def crop_to_vertical(input_path: str, output_path: str) -> str:
    """
    Crop a horizontal video to 9:16 vertical.
    If already vertical, just scale to 1080x1920.
    """
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-i", input_path,
        "-vf", (
            f"crop=ih*9/16:ih,scale={WIDTH}:{HEIGHT}:"
            "force_original_aspect_ratio=decrease,"
            f"pad={WIDTH}:{HEIGHT}:-1:-1:color=black"
        ),
        "-preset", FFMPEG_PRESET,
        "-an",  # Strip audio temporarily — we'll add it back in morph
        "-t", "15",  # Safety cap — hooks should never be >15s
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        raise RuntimeError(f"Crop failed: {result.stderr[-500:]}")

    if not verify_clip(output_path):
        raise RuntimeError(f"Cropped clip verification failed: {output_path}")

    return output_path


def extract_hook_audio(input_path: str, output_path: str) -> str:
    """Extract audio from the original hook clip (before cropping strips it)."""
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-i", input_path,
        "-vn", "-acodec", "aac", "-b:a", "128k",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        log.warning("Audio extraction failed (video may have no audio): %s", result.stderr[-200:])
        return ""
    return output_path


def get_full_hook(
    query: str,
    temp_dir: str,
) -> tuple[str, str, float, str]:
    """
    Full hook pipeline: search → heatmap → download → crop → extract audio.
    Returns (vertical_clip_path, audio_path, duration, description).
    """
    url, start, end, description = search_and_find_hook(query)
    if url is None:
        raise RuntimeError(f"No hook found for query: {query}")

    raw_clip = os.path.join(temp_dir, "hook_raw.mp4")
    download_hook_clip(url, start, end, raw_clip)

    # Extract audio before cropping (crop strips audio)
    hook_audio = os.path.join(temp_dir, "hook_audio.m4a")
    extract_hook_audio(raw_clip, hook_audio)
    if not os.path.exists(hook_audio):
        hook_audio = ""

    # Crop to vertical
    hook_vertical = os.path.join(temp_dir, "hook_v.mp4")
    crop_to_vertical(raw_clip, hook_vertical)

    # Clean raw clip
    try:
        os.remove(raw_clip)
    except OSError:
        pass

    from verify import get_duration
    duration = get_duration(hook_vertical)

    return hook_vertical, hook_audio, duration, description
