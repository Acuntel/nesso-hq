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
        # Use DASH merge format — "best" progressive streams are rarely available now.
        # Prefer 720p or lower to keep file small and Railway-friendly.
        "format": "bestvideo[height<=720]+bestaudio/bestvideo+bestaudio/best[height<=720]/best",
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

# Map hook categories to high-action subreddits only.
# These subs curate genuinely viral high-engagement action content —
# no news clips, no talking heads, no slow content.
REDDIT_SUBREDDIT_MAP = {
    "crash": ["IdiotsInCars", "AbruptChaos", "nextfuckinglevel", "nonononoyes"],
    "extreme_heights": ["SweatyPalms", "holdmyredbull", "nextfuckinglevel"],
    "explosion": ["AbruptChaos", "CatastrophicFailure", "nextfuckinglevel"],
    "extreme_sports": ["holdmyredbull", "nextfuckinglevel", "SkateboardingGifs", "SweatyPalms"],
    "nature": ["natureismetal", "NatureIsFuckingLit", "nextfuckinglevel", "SweatyPalms"],
    "viral": ["nextfuckinglevel", "AbruptChaos", "holdmyredbull", "maybemaybemaybe"],
}

# Fallback list — best all-round action subs
REDDIT_SUBREDDITS_FALLBACK = [
    "nextfuckinglevel",
    "AbruptChaos",
    "holdmyredbull",
    "SweatyPalms",
    "IdiotsInCars",
]

# Reject titles containing these — they signal boring/non-action content
# (news reporting, interviews, political speech, slow compilations, etc.)
REJECT_TITLE_KEYWORDS = [
    "journalist", "reporter", "anchor", "correspondent",
    "news", "press conference", "press briefing",
    "interview", "interviewed", "interviewing",
    "speech", "speaks", "speaking", "statement",
    "politician", "president", "senator", "congress", "parliament",
    "debate", "debates",
    "explains", "explained", "discussion", "discusses",
    "tutorial", "how to", "guide", "review",
    "gameplay", "minecraft", "roblox", "fortnite",
    "podcast", "talk show",
    "cute", "wholesome", "heartwarming",  # still viral but wrong energy for our drift story
    "dance", "dances", "dancing",  # not action
    "tiktok dance",
    "asmr", "satisfying compilation",
    # Boring not-actually-action stuff that leaks through
    "shows the", "demonstrates", "tribute", "meet the",
    "training", "testing", "test of", "strength test",
    "preparing", "gets ready", "behind the scenes", "explainer",
    "documentary", "history of",
]

# Action keywords — boost score if title contains these
ACTION_TITLE_KEYWORDS = [
    "crash", "crashed", "crashes", "crashing",
    "flip", "flipped", "flipping", "flips",
    "jump", "jumped", "jumping", "launched", "launches",
    "explodes", "explode", "exploded", "explosion", "blast", "blew up",
    "slam", "slammed", "wipeout", "wiped out",
    "fall", "falls", "falling", "fell", "dropped",
    "wreck", "wrecks", "wrecked",
    "send", "sent it", "sending it", "gnar",
    "insane", "crazy", "wild", "brutal", "savage",
    "close call", "near miss", "almost died", "barely",
    "stunt", "trick", "backflip", "frontflip",
    "racing", "race", "speeding", "speed",
    "skateboard", "skateboarding", "bmx",
    "bike", "motorcycle", "motocross", "mtb",
    "surf", "surfing", "wave",
    "ski", "skiing", "snowboard", "snowboarding",
    "parkour", "cliff",
]


def _title_is_rejected(title: str) -> bool:
    """Return True if title contains any reject keyword."""
    t = title.lower()
    return any(kw in t for kw in REJECT_TITLE_KEYWORDS)


def _action_boost(title: str) -> int:
    """Count action keywords in title for quality ranking."""
    t = title.lower()
    return sum(1 for kw in ACTION_TITLE_KEYWORDS if kw in t)

REDDIT_HEADERS = {
    "User-Agent": "NessoContentBot/1.0 (by /u/nesso_app)",
    "Accept": "application/json",
}

# ── Reddit OAuth (bypasses 403 on cloud IPs) ──────────────────────────────
_reddit_token: str = ""
_reddit_token_expires: float = 0


def _get_reddit_auth_headers() -> dict:
    """
    Get Reddit API headers with OAuth token. Reddit blocks unauthenticated
    requests from cloud IPs (Railway, AWS, etc.) with 403. OAuth via
    application-only flow fixes this.

    Requires REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET env vars.
    Falls back to unauthenticated headers if not set.
    """
    import time as _time
    global _reddit_token, _reddit_token_expires

    client_id = os.environ.get("REDDIT_CLIENT_ID", "")
    client_secret = os.environ.get("REDDIT_CLIENT_SECRET", "")

    if not client_id or not client_secret:
        # No OAuth creds — fall back to unauthenticated (will 403 on Railway)
        return REDDIT_HEADERS

    # Reuse token if still valid (5 min buffer)
    if _reddit_token and _time.time() < _reddit_token_expires - 300:
        return {
            "Authorization": f"Bearer {_reddit_token}",
            "User-Agent": REDDIT_HEADERS["User-Agent"],
        }

    try:
        auth = requests.auth.HTTPBasicAuth(client_id, client_secret)
        resp = requests.post(
            "https://www.reddit.com/api/v1/access_token",
            auth=auth,
            data={"grant_type": "client_credentials"},
            headers={"User-Agent": REDDIT_HEADERS["User-Agent"]},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            _reddit_token = data["access_token"]
            _reddit_token_expires = _time.time() + data.get("expires_in", 3600)
            log.info("Reddit OAuth token acquired (expires in %ds)", data.get("expires_in", 3600))
            return {
                "Authorization": f"Bearer {_reddit_token}",
                "User-Agent": REDDIT_HEADERS["User-Agent"],
            }
        else:
            log.warning("Reddit OAuth failed (%d): %s", resp.status_code, resp.text[:200])
    except Exception as e:
        log.warning("Reddit OAuth request failed: %s", e)

    return REDDIT_HEADERS


def _extract_best_segment(input_path: str, output_path: str, total_duration: float, title: str = "") -> str:
    """
    Extract the best segment from a video with SMART duration.

    The clip length adapts to the content:
    - Explosions, crashes, wipeouts: 3-5s (the action is instant)
    - Stunts, races, jumps: 5-7s (need setup + payoff)
    - General viral: 5-8s (default)

    Short clips keep attention. We're not a compilation channel.
    """
    title_lower = title.lower() if title else ""

    # Smart duration based on content type
    if any(w in title_lower for w in ["explosion", "explode", "blast", "demolition", "implosion"]):
        max_clip = random.uniform(3.0, 5.0)  # explosions are instant
    elif any(w in title_lower for w in ["crash", "wipeout", "wreck", "slam", "fall", "fell"]):
        max_clip = random.uniform(4.0, 6.0)  # crashes need a tiny setup
    elif any(w in title_lower for w in ["jump", "flip", "stunt", "trick", "backflip"]):
        max_clip = random.uniform(5.0, 7.0)  # stunts need approach + payoff
    else:
        max_clip = random.uniform(5.0, 8.0)  # general content

    if total_duration <= max_clip + 2:
        # Short video — use most of it
        start = 0
        clip_dur = min(max_clip, total_duration)
    elif total_duration <= 30:
        # Medium — action is usually early
        start = max(0, total_duration * 0.1)
        available = total_duration - start
        clip_dur = min(max_clip, available)
    else:
        # Long video — skip buildup, target 15-30% in
        start = total_duration * random.uniform(0.15, 0.30)
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

    # Pick subreddits relevant to the hook category.
    # Preserve list order — the FIRST sub in each category is the most on-topic
    # (e.g. "crash" → IdiotsInCars first). Randomize only the remainder so we
    # don't get the same clip twice in a batch.
    category_subs = REDDIT_SUBREDDIT_MAP.get(hook_category, REDDIT_SUBREDDITS_FALLBACK)
    if category_subs:
        primary = category_subs[0]
        rest = list(category_subs[1:])
        random.shuffle(rest)
        subs_to_try = [primary] + rest[:2]
    else:
        subs_to_try = list(REDDIT_SUBREDDITS_FALLBACK[:3])
    # Add one wildcard fallback sub for variety
    wildcard = random.choice(REDDIT_SUBREDDITS_FALLBACK)
    if wildcard not in subs_to_try:
        subs_to_try.append(wildcard)

    for subreddit in subs_to_try:
        try:
            # Use "top" endpoint with day/week filter only — month has too much
            # stale/low-action content. Fresh action clips go viral in days.
            time_filter = random.choice(["day", "week", "week"])
            # Use OAuth endpoint if we have a token (cloud IPs get 403 on www.reddit.com)
            auth_headers = _get_reddit_auth_headers()
            if "Authorization" in auth_headers:
                reddit_base = "https://oauth.reddit.com"
            else:
                reddit_base = "https://www.reddit.com"
            resp = requests.get(
                f"{reddit_base}/r/{subreddit}/top.json",
                params={"limit": 50, "t": time_filter},
                headers=auth_headers,
                timeout=15,
            )
            if resp.status_code != 200:
                log.warning("Reddit r/%s returned %d", subreddit, resp.status_code)
                continue

            data = resp.json()
            posts = data.get("data", {}).get("children", [])

            # Filter for high-action video posts with strong engagement
            video_posts = []
            rejected_titles = 0
            for post in posts:
                pd = post.get("data", {})
                if not pd.get("is_video"):
                    continue
                score = pd.get("score", 0)
                # Raised score floor — only genuinely viral action clips
                if score < 2000:
                    continue
                media = pd.get("media", {})
                reddit_video = media.get("reddit_video", {}) if media else {}
                duration = reddit_video.get("duration", 0)
                if duration < 5 or duration > 90:
                    continue
                permalink = pd.get("permalink", "")
                if not permalink:
                    continue
                title = pd.get("title", "Reddit video")
                # Reject news/interview/talking-head/non-action content
                if _title_is_rejected(title):
                    rejected_titles += 1
                    continue

                video_posts.append({
                    "url": f"https://www.reddit.com{permalink}",
                    "title": title,
                    "duration": duration,
                    "score": score,
                    "upvote_ratio": pd.get("upvote_ratio", 0.5),
                    "num_comments": pd.get("num_comments", 0),
                    "action_boost": _action_boost(title),
                })

            if rejected_titles:
                log.info("r/%s: rejected %d non-action titles", subreddit, rejected_titles)

            if not video_posts:
                continue

            # Rank by engagement quality
            for vp in video_posts:
                vp["quality_score"] = (
                    vp["score"] * vp["upvote_ratio"] + vp["num_comments"] * 10
                )

            # Partition: posts with action keywords in the title vs. without.
            # Pick from the action-keyword bucket whenever possible — ensures
            # we don't grab a high-score but boring clip like "Arvid Lindblad
            # shows the machines used to test motorsport strength".
            action_posts = [vp for vp in video_posts if vp["action_boost"] >= 1]
            if action_posts:
                action_posts.sort(key=lambda x: x["quality_score"], reverse=True)
                chosen = random.choice(action_posts[:3])
                log.info(
                    "r/%s: %d action-keyword posts (picked from top 3)",
                    subreddit, len(action_posts),
                )
            else:
                # No action-keyword titles — bail this sub and try next one
                log.info("r/%s: no action-keyword titles, skipping", subreddit)
                continue

            log.info(
                "Reddit hook from r/%s (top/%s): %s (score=%d, ratio=%.2f, dur=%ds)",
                subreddit, time_filter, chosen["title"][:60],
                chosen["score"], chosen["upvote_ratio"], chosen["duration"],
            )

            # Download with yt-dlp (merges audio+video DASH streams)
            raw_path = os.path.join(temp_dir, "hook_reddit_raw.mp4")
            ydl_opts = {
                "format": "bestvideo+bestaudio/bestvideo/best",
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
            _extract_best_segment(raw_path, trimmed, chosen["duration"], title=chosen["title"])
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


# ── Pexels Last-Resort Fallback ─────────────────────────────────────────

PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "")

PEXELS_QUERY_MAP = {
    "crash": "car crash accident",
    "extreme_heights": "cliff jumping extreme",
    "explosion": "explosion fire",
    "extreme_sports": "extreme sports action",
    "nature": "wild animals nature",
    "viral": "extreme action",
}


def _try_pexels_hook(query: str, temp_dir: str) -> tuple[str, str, float, str] | None:
    """Last-resort fallback: stock video from Pexels. Not viral but prevents total failure."""
    if not PEXELS_API_KEY:
        log.warning("PEXELS_API_KEY not set — cannot use Pexels fallback")
        return None

    from config import get_hook_category
    hook_category = get_hook_category(query)
    pexels_query = PEXELS_QUERY_MAP.get(hook_category, "extreme action")

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
            if dur < 6 or dur > 60:
                continue
            best_file = None
            for vf in video.get("video_files", []):
                h = vf.get("height", 0)
                if 360 <= h <= 1920:
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

        chosen = random.choice(candidates[:5])

        raw_path = os.path.join(temp_dir, "hook_pexels_raw.mp4")
        r = requests.get(chosen["download_url"], stream=True, timeout=60)
        r.raise_for_status()
        with open(raw_path, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)

        trimmed = os.path.join(temp_dir, "hook_raw.mp4")
        _extract_best_segment(raw_path, trimmed, chosen["duration"])
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
        log.info("Pexels hook (last resort): %.1fs — %s", duration, desc)
        return hook_vertical, hook_audio, duration, desc

    except Exception as e:
        log.warning("Pexels fallback failed: %s", e)
        return None


# ── Shared Utilities ─────────────────────────────────────────────────────


def crop_to_vertical(input_path: str, output_path: str) -> str:
    """Crop a video to 9:16 vertical. Preserves input duration (smart segment already trimmed it)."""
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


def _run_source_chain(query: str, temp_dir: str):
    """Run Reddit → YouTube → Pexels chain once. Returns result tuple or None."""
    result = _try_reddit_hook(query, temp_dir)
    if not result:
        log.warning("Reddit failed for '%s', trying YouTube", query)
        if not _cookies_expired:
            result = _try_youtube_hook(query, temp_dir)
            if not result:
                if _cookies_expired:
                    log.warning("YouTube cookies expired")
                else:
                    log.warning("YouTube failed for '%s'", query)
    if not result:
        log.warning("Reddit + YouTube both failed, trying Pexels last resort")
        result = _try_pexels_hook(query, temp_dir)
    return result


def get_full_hook(
    query: str,
    temp_dir: str,
    max_attempts: int = 3,
) -> tuple[str, str, float, str]:
    """
    Full hook pipeline: Reddit (primary) → YouTube (fallback) → Pexels.
    Retries with different queries if the chosen hook is too short.
    Returns (vertical_clip_path, audio_path, duration, description).
    """
    from config import get_random_hook_query, get_hook_category
    attempted_queries = [query]

    for attempt in range(max_attempts):
        current_query = attempted_queries[-1]
        log.info("Hook attempt %d/%d for query: %s",
                 attempt + 1, max_attempts, current_query)

        result = _run_source_chain(current_query, temp_dir)
        if result:
            clip_path, audio_path, duration, desc = result
            if duration >= 5.0:
                return clip_path, audio_path, duration, desc
            # Too short — clean up and try again with a new query in the same category
            log.warning(
                "Hook too short (%.1fs < 5s), retrying: %s",
                duration, desc,
            )
            for p in (clip_path, audio_path):
                if p and os.path.exists(p):
                    try:
                        os.remove(p)
                    except OSError:
                        pass

        # Pick a NEW query in the SAME category so the script bridge still fits
        same_cat = get_hook_category(query)
        # Filter HOOK_SEARCH_QUERIES to same category, excluding already tried
        from config import HOOK_SEARCH_QUERIES
        candidates = [
            q for q in HOOK_SEARCH_QUERIES
            if get_hook_category(q) == same_cat and q not in attempted_queries
        ]
        if not candidates:
            # Fall back to any untried query
            candidates = [q for q in HOOK_SEARCH_QUERIES if q not in attempted_queries]
        if not candidates:
            break
        attempted_queries.append(random.choice(candidates))

    raise RuntimeError(
        f"No usable hook found after {max_attempts} attempts (tried: {attempted_queries})"
    )
