"""
Nesso Content Engine V24 — Reddit Hook Scraper (background clip only)

V24 changes the hook contract: no overlay text or VO in the first 1.0s, the
RAW chaos clip carries the moment. So this module is now the single most
important step in the engine — pick the wildest possible 3.5s.

Tier-1 (60% weight): full chaos — bike crashes, public freakouts, hold-my-beer
moments, fast-paced chases, instant regret. Pure stop-the-thumb visual.
Tier-2 (30%): nature predators, extreme sports, skydiving, wipeouts.
Tier-3 (10%): close-call / wtf moments — long-tail variety.

Source: www.reddit.com /r/<sub>/top.json with a browser User-Agent.
No OAuth, no API key. Public JSON endpoint.

Returns: (clip_path, duration, description) or None on failure. The pipeline
falls back to gradient-only hook if this returns None.
"""

from __future__ import annotations

import concurrent.futures
import json
import logging
import os
import random
import subprocess
import time
from typing import Optional

import yt_dlp

from config import FFMPEG_THREADS, FFMPEG_TIMEOUT
from verify import get_duration

log = logging.getLogger(__name__)

# Hard upper bound on a single yt-dlp download. yt-dlp's socket_timeout
# only covers per-socket reads; a stuck DASH manifest or fragment loop
# can still exceed it. We wrap the call in a thread + timeout so a
# wedged download cannot stall the pipeline.
YT_DLP_DEADLINE_SECONDS = 60

# Total wall-clock budget for the whole hook-sourcing stage. Five
# subreddits × (curl + ytdlp + ffmpeg trim) can pile up. If we exceed
# this, fall back to gradient-only hook so the rest of the pipeline
# can finish.
FETCH_BG_BUDGET_SECONDS = 90

# V24: tiered chaos pool. Hook fetcher samples mostly from tier 1, with
# occasional dips into tier 2/3 for variety. Tier-1 is pure thumb-stopper
# fuel — bike crashes, public freakouts, instant regret moments. Tier-2 is
# nature predators + extreme sports. Tier-3 is the long tail of "wtf" clips.
SUBREDDITS_TIER1 = [
    "PublicFreakout",     # public meltdowns, screaming, fights
    "IdiotsInCars",       # crashes, dashcam carnage
    "HoldMyRedbull",      # bike jumps, skydives, parkour fails
    "holdmybeer",         # backyard chaos
    "AbruptChaos",        # something normal → instant chaos
    "instant_regret",     # second of regret right before disaster
    "sendittards",        # ski/skate/bike send-it wipeouts
    "Whatcouldgowrong",   # the predictable disaster
    "SweatyPalms",        # vertigo / heights / close calls
]
SUBREDDITS_TIER2 = [
    "nevertellmetheodds",
    "extremesports",
    "natureismetal",
    "NatureIsFuckingLit",
    "NatureIsBrutal",
    "hardcorenature",
    "ThingsThatBlowUp",
    "roadcam",
    "winstupidprizes",
]
SUBREDDITS_TIER3 = [
    "nextfuckinglevel",
    "Unexpected",
    "maybemaybemaybe",
    "BeAmazed",
]

# Backwards-compat alias for any external import. Don't use directly — call
# `_pick_subreddit_batch()` instead so tier weighting applies.
SUBREDDIT_POOL = SUBREDDITS_TIER1 + SUBREDDITS_TIER2 + SUBREDDITS_TIER3


def _pick_subreddit_batch(n: int = 5) -> list[str]:
    """Pick `n` subs weighted toward tier 1 (60%), tier 2 (30%), tier 3 (10%)."""
    weights = [
        (SUBREDDITS_TIER1, 0.60),
        (SUBREDDITS_TIER2, 0.30),
        (SUBREDDITS_TIER3, 0.10),
    ]
    chosen: list[str] = []
    while len(chosen) < n:
        r = random.random()
        acc = 0.0
        pool = SUBREDDITS_TIER1
        for p, w in weights:
            acc += w
            if r <= acc:
                pool = p
                break
        candidate = random.choice(pool)
        if candidate not in chosen:
            chosen.append(candidate)
    return chosen

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
MIN_SCORE = 1500          # V24: was 2000 — let fresh chaos through faster
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
    Wrapped in a thread + hard deadline so a stuck DASH manifest or
    fragment retry loop cannot hang the render.
    """
    opts = {
        "format": "bestvideo+bestaudio/bestvideo/best",
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "outtmpl": output_path,
        "socket_timeout": 15,
        "retries": 1,
        "fragment_retries": 1,
    }

    def _run() -> None:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([reddit_url])

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            fut = ex.submit(_run)
            fut.result(timeout=YT_DLP_DEADLINE_SECONDS)
        return os.path.exists(output_path) and os.path.getsize(output_path) > 10_000
    except concurrent.futures.TimeoutError:
        log.warning(
            "yt-dlp exceeded %ds deadline for %s — abandoning",
            YT_DLP_DEADLINE_SECONDS, reddit_url,
        )
        return False
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

    # V24: keep the chaos clip's NATIVE AUDIO. Tire screech, screaming, crash
    # impacts ARE the soundtrack of the hook. morph.py mixes it under the
    # ducked music bed so the first 2.5s sound real, not produced.
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-ss", f"{start:.2f}",
        "-i", input_path,
        "-t", f"{clip_dur:.2f}",
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
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
    subs = _pick_subreddit_batch(5)
    deadline = time.time() + FETCH_BG_BUDGET_SECONDS

    for sub in subs:
        if time.time() > deadline:
            log.warning(
                "hook fetch exceeded %ds budget — falling back to gradient-only",
                FETCH_BG_BUDGET_SECONDS,
            )
            return None
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
