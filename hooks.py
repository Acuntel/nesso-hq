"""
Nesso Content Engine V21 — Hook Video Sourcing

Primary: Reddit (category-aware subreddit selection, top posts, quality ranking).
Fallback: YouTube via yt-dlp with cookie authentication.
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
    WIDTH,
    YOUTUBE_SEARCH_COUNT,
)
from verify import verify_clip

log = logging.getLogger(__name__)

# ── Cookie Management ────────────────────────────────────────────────────

_cookies_path: str | None = None
_cookies_expired: bool = False


def are_cookies_expired() -> bool:
    """Check if YouTube cookies have been flagged as expired."""
    return _cookies_expired


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
        "format": "best[height<=720]/best",
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
            err_str = str(e)
            log.warning("YouTube hook failed for %s: %s", url, err_str[:200])
            if "Sign in to confirm" in err_str or "bot" in err_str.lower():
                global _cookies_expired
                _cookies_expired = True
                log.error("YouTube cookies expired — all YouTube downloads will fail")
                return None
            continue

    return None


# ── Reddit Hook Source ───────────────────────────────────────────────────

# Map hook categories to the most relevant subreddits for that content
# ORDER MATTERS — first subs are tried first, put highest-adrenaline first
REDDIT_SUBREDDIT_MAP = {
    "crash": ["CrazyFuckingVideos", "AbruptChaos", "IdiotsInCars", "nonononoyes"],
    "extreme_heights": ["CrazyFuckingVideos", "SweatyPalms", "nextfuckinglevel", "holdmyredbull"],
    "explosion": ["CrazyFuckingVideos", "AbruptChaos", "nextfuckinglevel", "shockwave"],
    "extreme_sports": ["CrazyFuckingVideos", "nextfuckinglevel", "holdmyredbull", "AbruptChaos"],
    "nature": ["CrazyFuckingVideos", "natureismetal", "NatureIsFuckingLit", "SweatyPalms"],
    "viral": ["CrazyFuckingVideos", "AbruptChaos", "nextfuckinglevel", "Unexpected"],
}

# Fallback list — high-adrenaline only, no "mildly interesting" subs
REDDIT_SUBREDDITS_FALLBACK = [
    "CrazyFuckingVideos",
    "AbruptChaos",
    "nextfuckinglevel",
    "Unexpected",
]

REDDIT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}


def _extract_best_segment(input_path: str, output_path: str, total_duration: float) -> str:
    """
    Extract the best 8-15s segment from a video.

    Heuristic: Reddit viral videos usually have the payoff in the first 40%.
    For short videos (< 20s), take the whole thing (trimmed to 15s).
    For longer videos, start at 10-25% of the way in to skip buildup.
    """
    max_clip = 10.0

    if total_duration <= 20:
        # Short video — beginning likely has the action
        start = 0
    elif total_duration <= 40:
        # Medium — skip the first few seconds of buildup
        start = max(0, total_duration * 0.1)
    else:
        # Longer video — the peak is likely 15-35% in
        start = total_duration * random.uniform(0.15, 0.30)

    # Don't overshoot the end
    available = total_duration - start
    clip_dur = min(max_clip, available)

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-ss", str(round(start, 1)),
        "-i", input_path,
        "-t", str(round(clip_dur, 1)),
        "-c", "copy",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        # Fallback: just take first 15s
        cmd_fallback = [
            "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
            "-i", input_path, "-t", str(max_clip), "-c", "copy", output_path,
        ]
        subprocess.run(cmd_fallback, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    return output_path


def _try_reddit_hook(query: str, temp_dir: str) -> tuple[str, str, float, str] | None:
    """
    Get a viral hook clip from Reddit. Uses top posts (proven viral, not just trending).
    Maps query category to relevant subreddits for higher-quality clip selection.
    """
    from config import get_hook_category
    hook_category = get_hook_category(query)

    # Pick subreddits relevant to the hook category
    category_subs = REDDIT_SUBREDDIT_MAP.get(hook_category, REDDIT_SUBREDDITS_FALLBACK)
    # Try 3 subs: 2 from category + 1 wildcard for variety
    subs_to_try = random.sample(category_subs, min(2, len(category_subs)))
    wildcard = random.choice(REDDIT_SUBREDDITS_FALLBACK)
    if wildcard not in subs_to_try:
        subs_to_try.append(wildcard)

    for subreddit in subs_to_try:
        try:
            # Use "top" endpoint with time filter — proven viral, not just trending
            time_filter = random.choice(["day", "week"])
            resp = requests.get(
                f"https://www.reddit.com/r/{subreddit}/top.json",
                params={"limit": 50, "t": time_filter},
                headers=REDDIT_HEADERS,
                timeout=15,
            )
            if resp.status_code != 200:
                log.warning("Reddit r/%s returned %d", subreddit, resp.status_code)
                continue

            data = resp.json()
            posts = data.get("data", {}).get("children", [])

            # Filter for video posts with high engagement
            video_posts = []
            for post in posts:
                pd = post.get("data", {})
                if not pd.get("is_video"):
                    continue
                score = pd.get("score", 0)
                if score < 2000:
                    continue
                media = pd.get("media", {})
                reddit_video = media.get("reddit_video", {}) if media else {}
                duration = reddit_video.get("duration", 0)
                # Sweet spot: 8-60s — long enough to have a peak moment,
                # short enough that the first 15s likely contains it
                if duration < 8 or duration > 60:
                    continue
                permalink = pd.get("permalink", "")
                if not permalink:
                    continue
                video_posts.append({
                    "url": f"https://www.reddit.com{permalink}",
                    "title": pd.get("title", "Reddit video"),
                    "duration": duration,
                    "score": score,
                    "upvote_ratio": pd.get("upvote_ratio", 0.5),
                    "num_comments": pd.get("num_comments", 0),
                })

            if not video_posts:
                continue

            # Rank by engagement quality: high score + high upvote ratio + comments
            # This finds clips people genuinely loved, not just rage-bait
            for vp in video_posts:
                vp["quality_score"] = (
                    vp["score"] * vp["upvote_ratio"]
                    + vp["num_comments"] * 10
                )
            video_posts.sort(key=lambda x: x["quality_score"], reverse=True)
            chosen = random.choice(video_posts[:3])

            log.info(
                "Reddit hook from r/%s (top/%s): %s (score=%d, ratio=%.2f, dur=%ds)",
                subreddit, time_filter, chosen["title"][:60],
                chosen["score"], chosen["upvote_ratio"], chosen["duration"],
            )

            # Download with yt-dlp (merges audio+video DASH streams)
            raw_path = os.path.join(temp_dir, "hook_reddit_raw.mp4")
            ydl_opts = {
                "format": "best",  # Reddit DASH doesn't support height filters
                "merge_output_format": "mp4",
                "quiet": True,
                "no_warnings": True,
                "outtmpl": raw_path,
                "socket_timeout": 30,
                "retries": 3,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([chosen["url"]])

            if not os.path.exists(raw_path) or os.path.getsize(raw_path) < 10000:
                log.warning("Reddit yt-dlp download too small, skipping")
                continue

            # Smart segment extraction: pick the best 8-15s window
            trimmed = os.path.join(temp_dir, "hook_raw.mp4")
            _extract_best_segment(raw_path, trimmed, chosen["duration"])
            try:
                os.remove(raw_path)
            except OSError:
                pass

            # Extract audio
            hook_audio = os.path.join(temp_dir, "hook_audio.m4a")
            extract_hook_audio(trimmed, hook_audio)
            if not os.path.exists(hook_audio):
                hook_audio = ""

            # Crop to vertical
            hook_vertical = os.path.join(temp_dir, "hook_v.mp4")
            crop_to_vertical(trimmed, hook_vertical)
            try:
                os.remove(trimmed)
            except OSError:
                pass

            from verify import get_duration
            duration = get_duration(hook_vertical)

            desc = f"Reddit r/{subreddit}: {chosen['title'][:80]}"
            log.info("Reddit hook: %.1fs — %s", duration, desc)
            return hook_vertical, hook_audio, duration, desc

        except Exception as e:
            log.warning("Reddit r/%s failed: %s", subreddit, str(e)[:200])
            continue

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
        "-t", "10",
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
    Full hook pipeline: Reddit (primary) → YouTube (fallback).
    Returns (vertical_clip_path, audio_path, duration, description).
    """
    # Try Reddit first — public API, no bot detection, best viral content
    result = _try_reddit_hook(query, temp_dir)
    if not result:
        log.warning("Reddit failed for '%s', trying YouTube", query)

        # Try YouTube with cookies
        if not _cookies_expired:
            result = _try_youtube_hook(query, temp_dir)
            if not result:
                if _cookies_expired:
                    log.warning("YouTube cookies expired")
                else:
                    log.warning("YouTube failed for '%s'", query)

    if not result:
        raise RuntimeError(f"No hook found for query: {query} (Reddit and YouTube both failed)")

    clip_path, audio_path, duration, desc = result

    # Enforce minimum 5s hook duration
    if duration < 5.0:
        log.warning("Hook too short (%.1fs < 5s), rejecting: %s", duration, desc)
        raise RuntimeError(f"Hook too short: {duration:.1f}s for '{desc}' (minimum 5s)")

    return clip_path, audio_path, duration, desc
