"""
Local V23 render harness — bypasses Telegram, writes an MP4 straight to
~/Desktop. Requires the Remotion server on localhost:3100 (run
`npm run server` inside remotion-reveal/). Loads .env before anything else
so ANTHROPIC_API_KEY / ELEVENLABS_API_KEY are picked up.
"""

from __future__ import annotations

import logging
import os
import shutil
import sys
import time


def _load_dotenv() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(here, ".env")
    if not os.path.exists(env_path):
        return
    loaded = []
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if not v:
                continue
            # Don't overwrite a value the parent process already exported
            # (e.g. when running under `railway run`, which injects Railway's
            # env vars). .env is a local fallback for keys NOT in the env.
            if os.environ.get(k):
                continue
            os.environ[k] = v
            loaded.append(k)
    if loaded:
        print(f"[env] loaded {len(loaded)} keys: {', '.join(loaded[:6])}...")


_load_dotenv()


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    log = logging.getLogger("render_local")

    # Import AFTER .env load so config picks up the keys
    from pipeline import render_single_video

    start = time.time()
    log.info("starting V23 render...")
    result = render_single_video()
    elapsed = time.time() - start

    if result.get("error"):
        log.error("render FAILED in %.1fs: %s", elapsed, result["error"])
        return 1

    src = result["output_path"]
    dst = os.path.expanduser(
        f"~/Desktop/nesso_V23_{time.strftime('%H%M%S')}.mp4"
    )
    shutil.copy2(src, dst)

    log.info(
        "render complete in %.1fs — duration=%.2fs size=%.1fMB",
        elapsed,
        result["duration"],
        os.path.getsize(dst) / (1024 * 1024),
    )
    log.info("MP4: %s", dst)
    log.info("TikTok caption: %s", result["tiktok_caption"])
    log.info("IG caption: %s", result["ig_caption"])
    log.info("IG pin comment: %s", result["ig_pin_comment"])
    log.info("hook line: %s", result.get("hook_description", ""))

    # Best-effort clean up the original (we've copied it out)
    try:
        os.remove(src)
        render_dir = os.path.dirname(src)
        if "render_" in render_dir and os.path.isdir(render_dir):
            shutil.rmtree(render_dir, ignore_errors=True)
    except OSError:
        pass

    print(dst)
    return 0


if __name__ == "__main__":
    sys.exit(main())
