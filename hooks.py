"""
Nesso Content Engine V22 — Reddit Hook Scraper (background clip only)

Unlike V21, this module does NOT drive the hook's emotional content — the
kinetic text in HookText.tsx does that. Instead, this fetches a visceral
viral clip that sits UNDER the text as a dimmed, desaturated background —
giving the first 2.5 seconds both:
  - a scroll-stopping visual (the clip)
  - an emotionally connected bridge to the story (the typography)

Source: www.reddit.com /r/<sub>/top.json with a browser User-Agent.
No OAuth, no API key. Public JSON endpoint.

Returns: (clip_path, duration, description) or None on failure. The pipeline
falls back to gradient-only hook if this returns None.
"""

from __future__ import annotations

import json
import logging
import os
import random
import subprocess
from typing import Optional

import yt_dlp

from config import FFMPEG_THREADS, FFMPEG_TIMEOUT
from verify import get_duration

log = logging.getLogger(__name__)

# Action-first pool: lions hunting, explosions, skiing wipeouts, motorcycles,
# stunts, crashes, extreme nature. High kinetic energy — the stuff that
# genuinely stops a thumb mid-swipe. All clips get dim + desat so the scroll-
# stopping chaos never overpowers the kinetic typography.
SUBREDDIT_POOL = [
    # extreme sports / stunts / skiing / motorcycles / jumps
    "sendittards",
    "HoldMyRedbull",
    "holdmybeer",
    "nevertellmetheodds",
    "extremesports",
    # crashes / high-speed / dashcam / motorcycle
    "IdiotsInCars",
    "roadcam",
    "Whatcouldgowrong",
    "winstupidprizes",
    # nature action — lions, sharks, predator moments
    "natureismetal",
    "NatureIsFuckingLit",
    "NatureIsBrutal",
    "hardcorenature",
    # explosions / abrupt chaos / public chaos
    "AbruptChaos",
    "PublicFreakout",
    "ThingsThatBlowUp",
    # heights / close calls / visceral stop-scroll
    "SweatyPalms",
    "nextfuckinglevel",
    "Unexpected",
    "instant_regret",
]

# Reddit fingerprints and blocks Python's `requests` TLS handshake as "bot".
# curl with a real browser User-Agent passes through. We shell out to curl
# instead of using requests — less pretty, works reliably.
REDDIT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

REDDIT_ENDPOINTS = [
    "https://old.reddit.com",
    "https://www.reddit.com",
]

# Titles we DON'T want — talking heads, interviews, news, porn-adjacent, gore
REJECT_TITLE_KEYWORDS = [
    "interview", "podcast", "statement", "press conference",
    "nsfw", "nude", "porn",
    "murder", "suicide", "dead body", "execution", "beheading",
    "dies", "killed himself", "killed herself",
]

# Target clip duration for the hook BACKGROUND (2.5s segment)
# We grab a slightly longer window then trim to the hook duration.
HOOK_CLIP_TARGET_SEC = 3.5
MIN_SCORE = 2000
MAX_POSTS_PER_SUB = 50
CANDIDATES_TO_TRY = 3


def _title_rejected(title: str) -> bool:
    t = title.lower()
    return any(kw in t for kw in REJECT_TITLE_KEYWORDS)


def _fetch_top_posts(subreddit: str, time_filter: str = "week") -> list[dict]:
    """Hit the public JSON endpoint via curl (Reddit blocks requests' TLS)."""
    for base in REDDIT_ENDPOINTS:
        url = (
            f"{base}/r/{subreddit}/top.json"
            f"?limit={MAX_POSTS_PER_SUB}&t={time_filter}&raw_json=1"
        )
        try:
            r = subprocess.run(
                [
                    "curl", "-sL",
                    "--max-time", "15",
                    "-A", REDDIT_UA,
                    "-H", "Accept: application/json,*/*",
                    "-H", "Accept-Language: en-US,en;q=0.9",
                    url,
                ],
                capture_output=True, text=True, timeout=20,
            )
            if r.returncode != 0 or not r.stdout:
                continue
            # Tiny HTML payload = anti-bot block page
            if r.stdout.lstrip().startswith("<"):
                continue
            data = json.loads(r.stdout)
            return data.get("data", {}).get("children", [])
        except json.JSONDecodeError:
            continue
        except Exception as e:
            log.debug("reddit %s r/%s: %s", base, subreddit, e)
    return []


def _score_post(pd: dict) -> float:
    """Simple quality score: upvotes × ratio + comment engagement."""
    return (
        pd.get("score", 0) * pd.get("upvote_ratio", 0.5)
        + pd.get("num_comments", 0) * 8
    )


def _find_viable_post(posts: list[dict]) -> Optional[dict]:
    """Pick one viable video post from a subreddit's top page."""
    viable = []
    for post in posts:
        pd = post.get("data", {})
        if not pd.get("is_video"):
            continue
        if pd.get("over_18"):
            continue
        if pd.get("score", 0) < MIN_SCORE:
            continue
        rv = (pd.get("media") or {}).get("reddit_video") or {}
        duration = rv.get("duration", 0)
        if duration < 5 or duration > 120:
            continue
        title = pd.get("title", "")
        if _title_rejected(title):
            continue
        permalink = pd.get("permalink", "")
        if not permalink:
            continue
        viable.append(
            {
                "url": f"https://www.reddit.com{permalink}",
                "title": title,
                "duration": duration,
                "score": pd.get("score", 0),
                "quality": _score_post(pd),
            }
        )

    if not viable:
        return None
    viable.sort(key=lambda v: v["quality"], reverse=True)
    return random.choice(viable[:CANDIDATES_TO_TRY])


def _download_via_ytdlp(reddit_url: str, output_path: str) -> bool:
    """
    Download a v.redd.it post via yt-dlp.
    yt-dlp handles Reddit's DASH audio+video merge automatically.
    """
    opts = {
        "format": "bestvideo+bestaudio/bestvideo/best",
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "outtmpl": output_path,
        "socket_timeout": 30,
        "retries": 2,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([reddit_url])
        return os.path.exists(output_path) and os.path.getsize(output_path) > 10_000
    except Exception as e:
        log.debug("yt-dlp download failed: %s", str(e)[:200])
        return False


def _trim_and_center_crop(
    input_path: str,
    output_path: str,
    source_duration: float,
    target_seconds: float = HOOK_CLIP_TARGET_SEC,
) -> str:
    """
    Trim to ~target_seconds starting near the action peak, center-crop to 9:16.
    Most Reddit clips have the payoff near the middle or a couple seconds in.
    """
    if source_duration <= target_seconds + 1:
        start = 0.0
        clip_dur = min(target_seconds, source_duration)
    elif source_duration <= 25:
        start = max(0, source_duration * 0.15)
        clip_dur = target_seconds
    else:
        start = source_duration * random.uniform(0.18, 0.35)
        clip_dur = target_seconds

    vf = (
        "scale=1080:1920:force_original_aspect_ratio=increase,"
        "crop=1080:1920,setsar=1"
    )

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-ss", f"{start:.2f}",
        "-i", input_path,
        "-t", f"{clip_dur:.2f}",
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-an",
        output_path,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if r.returncode != 0:
        raise RuntimeError(f"hook trim failed: {r.stderr[-400:]}")
    return output_path


def fetch_background_clip(
    temp_dir: str,
    target_seconds: float = HOOK_CLIP_TARGET_SEC,
) -> Optional[tuple[str, float, str]]:
    """
    Try to get a viral Reddit clip for the hook background.
    Returns (clip_path, duration, description) or None.
    """
    subs = random.sample(SUBREDDIT_POOL, min(5, len(SUBREDDIT_POOL)))

    for sub in subs:
        time_filter = random.choice(["day", "week", "week"])
        posts = _fetch_top_posts(sub, time_filter=time_filter)
        if not posts:
            log.info("r/%s returned 0 posts (top/%s)", sub, time_filter)
            continue

        chosen = _find_viable_post(posts)
        if not chosen:
            log.info("r/%s: no viable video posts", sub)
            continue

        log.info(
            "hook candidate: r/%s (top/%s) %s (score=%d, dur=%ds)",
            sub, time_filter, chosen["title"][:60], chosen["score"], int(chosen["duration"]),
        )

        raw = os.path.join(temp_dir, "hook_raw.mp4")
        if not _download_via_ytdlp(chosen["url"], raw):
            log.warning("r/%s download failed, trying next sub", sub)
            continue

        try:
            trimmed = os.path.join(temp_dir, "hook_bg.mp4")
            _trim_and_center_crop(raw, trimmed, chosen["duration"], target_seconds=target_seconds)
        except Exception as e:
            log.warning("r/%s trim/crop failed: %s", sub, e)
            try:
                os.remove(raw)
            except OSError:
                pass
            continue

        try:
            os.remove(raw)
        except OSError:
            pass

        duration = get_duration(trimmed)
        desc = f"r/{sub}: {chosen['title'][:80]}"
        log.info("hook clip: %.1fs — %s", duration, desc)
        return trimmed, duration, desc

    log.info("no Reddit clip available — hook will be gradient-only")
    return None
