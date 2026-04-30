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
# this, fall through to the bundled-clips fallback in fetch_background_clip.
FETCH_BG_BUDGET_SECONDS = 120  # V24.1: was 90 — Railway egress is slower

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

# V24.1: www.reddit.com first — old.reddit.com has been blocking datacenter
# IPs more aggressively lately. www. is the canonical redirect target and
# tends to pass our browser UA through.
REDDIT_ENDPOINTS = [
    "https://www.reddit.com",
    "https://old.reddit.com",
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
    """Hit the public JSON endpoint via curl (Reddit blocks requests' TLS).

    V24.1: stronger browser-mimicking headers (Sec-Fetch-*, DNT, Upgrade-
    Insecure-Requests) so Reddit's anti-bot filter is less likely to flag
    us as datacenter automation. Also logs WHY each endpoint fails so the
    Railway logs can tell us if it's network, JSON parse, or HTML block.
    """
    last_err = None
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
                    "--compressed",
                    "-A", REDDIT_UA,
                    "-H", "Accept: application/json,text/javascript,*/*;q=0.9",
                    "-H", "Accept-Language: en-US,en;q=0.9",
                    "-H", "Accept-Encoding: gzip, deflate, br",
                    "-H", "Sec-Fetch-Dest: empty",
                    "-H", "Sec-Fetch-Mode: cors",
                    "-H", "Sec-Fetch-Site: same-origin",
                    "-H", "DNT: 1",
                    "-H", "Upgrade-Insecure-Requests: 1",
                    "-H", "Cache-Control: no-cache",
                    url,
                ],
                capture_output=True, text=True, timeout=20,
            )
            if r.returncode != 0:
                last_err = f"curl rc={r.returncode}"
                continue
            if not r.stdout:
                last_err = "empty body"
                continue
            stripped = r.stdout.lstrip()
            if stripped.startswith("<"):
                last_err = "HTML block page"
                continue
            data = json.loads(r.stdout)
            children = data.get("data", {}).get("children", [])
            if children:
                return children
            last_err = "0 children in JSON"
        except json.JSONDecodeError as e:
            last_err = f"JSONDecode: {e}"
            continue
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"
            log.debug("reddit %s r/%s: %s", base, subreddit, e)
    log.info("r/%s: all endpoints failed (%s)", subreddit, last_err)
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


# Bundled chaos-clip fallback: drop MP4s into assets/hook_clips/ and they
# get baked into the Docker image. fetch_background_clip uses one of them
# whenever Reddit is unreachable / blocked / empty. The user can refresh
# this pool periodically with hand-picked viral clips.
BUNDLED_HOOK_CLIPS_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "assets", "hook_clips"
)


def _bundled_clip_fallback(
    temp_dir: str, target_seconds: float
) -> Optional[tuple[str, float, str]]:
    """Pick a random bundled chaos clip and trim/crop it like a fresh fetch."""
    if not os.path.isdir(BUNDLED_HOOK_CLIPS_DIR):
        return None
    candidates = [
        os.path.join(BUNDLED_HOOK_CLIPS_DIR, f)
        for f in os.listdir(BUNDLED_HOOK_CLIPS_DIR)
        if f.lower().endswith((".mp4", ".mov", ".webm"))
        and not f.startswith(".")
    ]
    if not candidates:
        return None
    src = random.choice(candidates)
    src_dur = get_duration(src)
    if src_dur < target_seconds:
        log.warning("bundled clip %s too short (%.1fs)", src, src_dur)
        return None
    out = os.path.join(temp_dir, "hook_bg.mp4")
    try:
        _trim_and_center_crop(src, out, src_dur, target_seconds=target_seconds)
    except Exception as e:
        log.warning("bundled clip trim/crop failed for %s: %s", src, e)
        return None
    name = os.path.basename(src)
    log.info("bundled hook clip: %.1fs — %s", target_seconds, name)
    return out, target_seconds, f"bundled: {name}"


# V24.1: module-level diagnostic from the most recent fetch_background_clip
# call. pipeline.py reads this when raising the "no hook clip available"
# error so the Telegram reply tells the user *why* each sub failed without
# needing Railway log access.
LAST_FETCH_DIAGNOSIS: str = ""


def fetch_background_clip(
    temp_dir: str,
    target_seconds: float = HOOK_CLIP_TARGET_SEC,
) -> Optional[tuple[str, float, str]]:
    """
    Try to get a viral Reddit clip for the hook background.

    V24.1 strategy:
      1. Sample 8 subs from the tiered chaos pool (was 5).
      2. For each sub try [week, day, month] in turn.
      3. Skip a sub fast if curl/JSON fails — diagnose in logs.
      4. If Reddit yields nothing in budget, fall back to assets/hook_clips/.
      5. Only return None when even the bundled pool is empty.

    Returns (clip_path, duration, description) or None.
    """
    global LAST_FETCH_DIAGNOSIS
    LAST_FETCH_DIAGNOSIS = ""
    subs = _pick_subreddit_batch(8)
    deadline = time.time() + FETCH_BG_BUDGET_SECONDS
    diag: list[str] = []  # one tag per sub, surfaced in pipeline error msg

    for sub in subs:
        if time.time() > deadline:
            log.warning(
                "hook fetch exceeded %ds budget — falling back to bundled clips",
                FETCH_BG_BUDGET_SECONDS,
            )
            diag.append(f"r/{sub}=budget")
            break

        chosen = None
        time_filter_used = None
        for tf in ("week", "day", "month"):
            posts = _fetch_top_posts(sub, time_filter=tf)
            if not posts:
                continue
            chosen = _find_viable_post(posts)
            if chosen:
                time_filter_used = tf
                break

        if not chosen:
            diag.append(f"r/{sub}=empty")
            continue

        log.info(
            "hook candidate: r/%s (top/%s) %s (score=%d, dur=%ds)",
            sub, time_filter_used, chosen["title"][:60],
            chosen["score"], int(chosen["duration"]),
        )

        raw = os.path.join(temp_dir, "hook_raw.mp4")
        if not _download_via_ytdlp(chosen["url"], raw):
            log.warning("r/%s ytdlp failed, trying next sub", sub)
            diag.append(f"r/{sub}=ytdlp")
            continue

        try:
            trimmed = os.path.join(temp_dir, "hook_bg.mp4")
            _trim_and_center_crop(
                raw, trimmed, chosen["duration"], target_seconds=target_seconds
            )
        except Exception as e:
            log.warning("r/%s trim/crop failed: %s", sub, e)
            try:
                os.remove(raw)
            except OSError:
                pass
            diag.append(f"r/{sub}=trim")
            continue

        try:
            os.remove(raw)
        except OSError:
            pass

        duration = get_duration(trimmed)
        desc = f"r/{sub}: {chosen['title'][:80]}"
        log.info("hook clip: %.1fs — %s", duration, desc)
        return trimmed, duration, desc

    diag_str = ",".join(diag) or "no-attempts"
    LAST_FETCH_DIAGNOSIS = diag_str

    # Reddit pool exhausted — try the bundled fallback.
    log.warning(
        "Reddit chaos pool yielded nothing (diag: %s). Trying bundled clips.",
        diag_str,
    )
    fallback = _bundled_clip_fallback(temp_dir, target_seconds)
    if fallback:
        return fallback

    # Even the bundled pool was empty. The pipeline raises and tells the user.
    LAST_FETCH_DIAGNOSIS = (
        f"reddit:{diag_str}; bundled:empty "
        f"(add MP4s to assets/hook_clips/ to seed)"
    )
    log.error(
        "no hook clip from Reddit OR bundled pool. diag=%s", LAST_FETCH_DIAGNOSIS,
    )
    return None
