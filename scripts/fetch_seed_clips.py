"""
Nesso Content Engine V24 — Hook Clip Seed Downloader

Runs at Docker build time. Pre-downloads a small pool of viral chaos clips
into assets/hook_clips/ via yt-dlp's ytsearch so the runtime hook fetcher
has a permanent fallback when Reddit blocks Railway's egress IP.

YouTube is FAR more lenient than Reddit toward datacenter IPs, and the
Railway build infra has a different egress than the runtime container,
so even if both Reddit AND runtime YouTube are blocked, build-time
yt-dlp typically succeeds.

We tolerate partial failure: if 8/15 queries succeed we still get 8 clips
in the bundled pool, which is enough variety for fallback rotation.
"""

from __future__ import annotations

import logging
import os
import subprocess
import sys

logging.basicConfig(
    level=logging.INFO,
    format="[seed-clips] %(message)s",
)
log = logging.getLogger(__name__)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
TARGET_DIR = os.path.join(REPO_ROOT, "assets", "hook_clips")

# Each query is a yt-dlp ytsearch term that should surface viral chaos
# YouTube Shorts. yt-dlp ranks results by relevance + watch count, so
# the top hit is usually a popular short. We keep the queries diverse
# so the bundled pool covers different chaos archetypes.
# Each query asks yt-dlp for the top 5 search results so the duration
# filter (<60s) has multiple candidates to pick from. Without the depth
# of 5, queries whose first hit is a long compilation ALL fail.
SEARCH_QUERIES = [
    "ytsearch5:bike crash shorts",
    "ytsearch5:public freakout shorts",
    "ytsearch5:skydiving close call shorts",
    "ytsearch5:car chase dashcam shorts",
    "ytsearch5:wave wipeout shorts",
    "ytsearch5:parkour fail shorts",
    "ytsearch5:hold my beer shorts",
    "ytsearch5:abrupt chaos shorts",
    "ytsearch5:nature predator strike shorts",
    "ytsearch5:base jumping close call shorts",
    "ytsearch5:explosion close call shorts",
    "ytsearch5:instant regret shorts",
]

# Per-clip download budget — anything stuck longer than this we kill.
PER_CLIP_TIMEOUT_SECONDS = 60


def _download_one(query: str, idx: int) -> tuple[str, bool]:
    """Run yt-dlp for one search query. Returns (query, success)."""
    out_template = os.path.join(
        TARGET_DIR, f"seed_{idx:02d}.%(ext)s"
    )
    # --match-filter "duration<60" skips long compilations and keeps the
    # clip under what `max-filesize` would otherwise cancel mid-download.
    # --max-downloads 1 stops after the first match so we don't download
    # all 5 ytsearch hits.
    cmd = [
        "yt-dlp",
        "--format", "best[height<=720][ext=mp4]/best[height<=720]/best",
        "--match-filter", "duration<60",
        "--socket-timeout", "20",
        "--retries", "2",
        "--fragment-retries", "2",
        "--quiet",
        "--no-warnings",
        "--no-progress",
        "--max-downloads", "1",
        "-o", out_template,
        query,
    ]
    try:
        subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=PER_CLIP_TIMEOUT_SECONDS,
        )
        # yt-dlp returns rc=101 when `--max-downloads 1` is hit AFTER a
        # successful download — that's not actually a failure. Source of
        # truth is whether a real file landed on disk; we check that next.
    except subprocess.TimeoutExpired:
        log.info("timeout %s", query[:40])
        return (query, False)
    except Exception as e:
        log.info("error  %s: %s", query[:40], e)
        return (query, False)

    matches = [
        f for f in os.listdir(TARGET_DIR)
        if f.startswith(f"seed_{idx:02d}.") and not f.endswith(".part")
    ]
    if matches:
        log.info("ok     %s -> %s", query[:40], matches[0])
        return (query, True)
    log.info("fail   %s: no output file", query[:40])
    return (query, False)


def main() -> int:
    os.makedirs(TARGET_DIR, exist_ok=True)
    log.info("seeding %d chaos clips into %s", len(SEARCH_QUERIES), TARGET_DIR)

    # Sequential is safer for build environments — parallel yt-dlp can
    # tip Railway's build memory budget. Each clip ≤ 60s timeout.
    successes = 0
    for i, query in enumerate(SEARCH_QUERIES, start=1):
        _, ok = _download_one(query, i)
        if ok:
            successes += 1

    final = [
        f for f in os.listdir(TARGET_DIR)
        if f.lower().endswith((".mp4", ".webm", ".mov"))
    ]
    log.info(
        "done: %d/%d queries succeeded, %d clips in pool",
        successes, len(SEARCH_QUERIES), len(final),
    )
    # Don't fail the build if a few queries flake — partial pool is fine.
    return 0 if final else 1


if __name__ == "__main__":
    sys.exit(main())
