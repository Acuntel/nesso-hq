"""
Nesso Content Engine V20 — Telegram Bot Interface

Commands:
  /make [count]        — Generate 1-10 videos
  /theme <topic>       — Generate video with specific emotional angle
  /status              — Show pipeline health
  /stats               — Show render analytics
"""

import asyncio
import logging
import os
import time
from datetime import datetime

from telegram import Update
from telegram.error import NetworkError, TimedOut
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
)
from telegram.request import HTTPXRequest

from analytics import get_stats
from pipeline import render_batch, render_single_video

log = logging.getLogger(__name__)

# Telegram upload tuning. The default python-telegram-bot timeouts
# (read=5s, write=5s, media_write=20s) are way too tight for video
# uploads from Railway. On a 5-10MB MP4 a network blip blows past 20s
# and the user sees `telegram.error.TimedOut: Timed out`. We push
# these to values that cover a worst-case Railway → Telegram upload
# (~3min) and let our own watchdog handle real hangs.
TG_CONNECT_TIMEOUT = 30.0
TG_READ_TIMEOUT = 120.0
TG_WRITE_TIMEOUT = 300.0
TG_POOL_TIMEOUT = 30.0
TG_MEDIA_WRITE_TIMEOUT = 300.0

# How long any single render is allowed to take before we abort and
# tell the user it timed out. Pipeline normally takes ~90s; we give
# generous headroom for cold Remotion bundles + slow Reddit fetches.
RENDER_BUDGET_SECONDS = 8 * 60

# Track state
_last_render_time: float | None = None
_last_error: str | None = None
_total_renders: int = 0
_total_failures: int = 0
_cookie_alert_sent: bool = False

# Theme → hook query mapping for /theme command
THEME_QUERIES = {
    "loneliness": "most alone you've ever felt compilation",
    "birthday": "forgot friend birthday reaction",
    "groupchat": "group chat dying meme compilation",
    "nostalgia": "childhood best friend memories compilation",
    "college": "college friends drifting apart graduation",
    "ghosting": "friend ghosted me story time",
    "moving": "moving away from friends emotional",
    "phone": "phone call vs texting friendship decline",
    "social": "social media fake friends compilation",
    "growing": "growing apart from friends after 25",
    "replaced": "being replaced by new friends story",
    "distance": "long distance friendship struggle",
}


async def _render_with_watchdog(render_fn, **kwargs) -> dict:
    """
    Run a synchronous render in a worker thread with a hard wall-clock
    budget. If it exceeds RENDER_BUDGET_SECONDS, return a structured
    error instead of letting the bot hang forever.

    The underlying thread is NOT killed (Python can't kill threads),
    but each pipeline stage has its own subprocess timeout, so the
    thread will eventually unwind on its own.
    """
    loop = asyncio.get_running_loop()
    fut = loop.run_in_executor(None, lambda: render_fn(**kwargs))
    try:
        return await asyncio.wait_for(fut, timeout=RENDER_BUDGET_SECONDS)
    except asyncio.TimeoutError:
        log.error(
            "render exceeded %ds budget — returning timeout error",
            RENDER_BUDGET_SECONDS,
        )
        return {
            "output_path": "",
            "tiktok_caption": "",
            "ig_caption": "",
            "ig_pin_comment": "",
            "hook_query": "",
            "hook_description": "",
            "duration": 0,
            "error": (
                f"Render exceeded {RENDER_BUDGET_SECONDS}s budget. "
                "Likely a stuck subprocess (Remotion bundle, ffmpeg, "
                "or yt-dlp). Try /make again — the pipeline is now "
                "free."
            ),
        }


async def _reply_video_with_retry(update, output_path, caption, attempts=3):
    """
    Upload a video to Telegram with explicit large timeouts and retry.

    Telegram's bot API can be flaky on big uploads — connection resets,
    transient `Timed out` from python-telegram-bot, or 502s from the edge.
    We retry up to `attempts` times with backoff, re-opening the file
    each time so the read pointer is at byte 0.
    """
    last_err: Exception | None = None
    for i in range(attempts):
        try:
            with open(output_path, "rb") as video_file:
                await update.message.reply_video(
                    video=video_file,
                    caption=caption,
                    supports_streaming=True,
                    read_timeout=TG_READ_TIMEOUT,
                    write_timeout=TG_WRITE_TIMEOUT,
                    connect_timeout=TG_CONNECT_TIMEOUT,
                    pool_timeout=TG_POOL_TIMEOUT,
                )
            return True
        except (TimedOut, NetworkError) as e:
            last_err = e
            log.warning(
                "reply_video attempt %d/%d failed (%s) — retrying",
                i + 1, attempts, e,
            )
            await asyncio.sleep(2 ** i)
        except Exception as e:
            last_err = e
            log.error("reply_video unrecoverable: %s", e, exc_info=True)
            break
    raise last_err if last_err else RuntimeError("reply_video failed silently")


async def _send_video_result(update, result, video_num=""):
    """Send a completed video with all captions as separate messages."""
    global _total_renders, _last_render_time

    if result["error"]:
        global _total_failures, _last_error
        _total_failures += 1
        _last_error = result["error"]
        await update.message.reply_text(
            f"❌ {video_num}Video failed\n\n"
            f"**Stage:** Pipeline error\n"
            f"**Error:** {result['error'][:500]}\n\n"
            f"Hook query: {result.get('hook_query', 'N/A')}"
        )
        return

    _total_renders += 1
    _last_render_time = time.time()

    output_path = result["output_path"]
    duration = result["duration"]

    # Message 1: The video file
    try:
        await _reply_video_with_retry(
            update,
            output_path,
            caption=f"{video_num}Nesso V24 — {duration:.0f}s",
        )
    except Exception as e:
        await update.message.reply_text(
            f"❌ {video_num}Video rendered but failed to send: {e}"
        )
        return

    # Message 2: TikTok caption — clean copy-paste
    await update.message.reply_text(
        f"⬇️ TIKTOK — copy below ⬇️",
    )
    await update.message.reply_text(
        result["tiktok_caption"],
        parse_mode=None,
    )

    # Message 3: IG caption — clean copy-paste
    await update.message.reply_text(
        f"⬇️ INSTAGRAM CAPTION — copy below ⬇️",
    )
    await update.message.reply_text(
        result["ig_caption"],
        parse_mode=None,
    )

    # Message 4: IG pin comment — separate for easy copy
    if result.get("ig_pin_comment"):
        await update.message.reply_text(
            f"📌 INSTAGRAM PIN COMMENT — copy below 📌",
        )
        await update.message.reply_text(
            result["ig_pin_comment"],
            parse_mode=None,
        )

    # Clean up the video file
    try:
        os.remove(output_path)
        render_dir = os.path.dirname(output_path)
        if os.path.isdir(render_dir) and "render_" in render_dir:
            import shutil
            shutil.rmtree(render_dir, ignore_errors=True)
    except OSError:
        pass


async def cmd_make(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /make     → 1 video
    /make N   → N fully independent videos (distinct scripts, hooks, music)
    """
    count = 1
    if context.args:
        try:
            count = max(1, min(int(context.args[0]), 10))
        except ValueError:
            await update.message.reply_text("Usage: /make or /make <number 1-10>")
            return

    await update.message.reply_text(
        f"🎬 Generating {count} video{'s' if count > 1 else ''}...\n"
        f"~2-3 min per video. You'll get each one as soon as it's ready."
    )

    start_time = time.time()

    if count == 1:
        result = await _render_with_watchdog(render_single_video)
        await _send_video_result(update, result)
        elapsed = time.time() - start_time
        if not result.get("error"):
            await update.message.reply_text(f"✅ Done in {elapsed:.0f}s")
        return

    # Batch — stream each video to Telegram as it finishes, not all at the end.
    used_hooks: list[str] = []
    successful = 0
    for i in range(count):
        r = await _render_with_watchdog(
            render_single_video, exclude_queries=used_hooks
        )
        if r.get("hook_query"):
            used_hooks.append(r["hook_query"])
        video_num = f"[{i+1}/{count}] "
        await _send_video_result(update, r, video_num)
        if not r.get("error"):
            successful += 1

    elapsed = time.time() - start_time
    await update.message.reply_text(
        f"✅ Batch complete in {elapsed:.0f}s — {successful}/{count} successful"
    )


async def cmd_theme(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /theme <topic> — generate video with a specific emotional angle."""
    if not context.args:
        themes_list = "\n".join(f"  /{t}" for t in sorted(THEME_QUERIES.keys()))
        await update.message.reply_text(
            f"🎯 Available themes:\n\n{themes_list}\n\n"
            "Usage: /theme loneliness\n"
            "Or: /theme birthday"
        )
        return

    theme = context.args[0].lower().strip()

    if theme not in THEME_QUERIES:
        # Try partial match
        matches = [t for t in THEME_QUERIES if theme in t]
        if matches:
            theme = matches[0]
        else:
            await update.message.reply_text(
                f"❓ Unknown theme '{theme}'. Try /theme to see options."
            )
            return

    # V22: themes no longer affect hook sourcing (hooks are typographic).
    # Kept for forward-compat — script prompt could accept theme in the future.
    await update.message.reply_text(
        f"🎯 Generating video (theme: {theme})\n"
        "This takes ~90s..."
    )

    start_time = time.time()
    result = await _render_with_watchdog(render_single_video, theme=theme)
    elapsed = time.time() - start_time

    await _send_video_result(update, result)
    await update.message.reply_text(f"✅ Done in {elapsed:.0f}s")


async def cmd_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /stats — show render analytics."""
    stats = get_stats()

    lines = [
        "📈 **Render Analytics**\n",
        f"Total renders: {stats['total']} ({stats['successes']}✅ {stats['failures']}❌)",
        f"Last 24h: {stats.get('last_24h', 0)} renders",
        f"Avg duration: {stats.get('avg_duration', 0)}s",
    ]

    if stats.get("top_categories"):
        lines.append("\n**Top categories:**")
        for cat, cnt in stats["top_categories"]:
            lines.append(f"  {cat}: {cnt} videos")

    if stats.get("top_transitions"):
        lines.append("\n**Top transitions:**")
        for trans, cnt in stats["top_transitions"]:
            lines.append(f"  {trans}: {cnt} uses")

    if stats.get("recent_errors"):
        lines.append("\n**Recent errors:**")
        for ts, err in stats["recent_errors"]:
            lines.append(f"  {ts[:16]}: {err[:100]}")

    await update.message.reply_text("\n".join(lines))


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /status command."""
    status_lines = [
        "📊 **Nesso Content Engine V24 Status**\n",
        f"Total renders: {_total_renders}",
        f"Total failures: {_total_failures}",
    ]

    if _last_render_time:
        ago = time.time() - _last_render_time
        if ago < 60:
            status_lines.append(f"Last render: {ago:.0f}s ago")
        elif ago < 3600:
            status_lines.append(f"Last render: {ago/60:.0f}m ago")
        else:
            status_lines.append(f"Last render: {ago/3600:.1f}h ago")
    else:
        status_lines.append("Last render: never")

    if _last_error:
        status_lines.append(f"\nLast error: {_last_error[:200]}")

    from config import PSYCH_SFX_PATH, NESSO_LOGO_PATH
    from remotion_client import REMOTION_URL
    import requests

    remotion_ok = False
    try:
        r = requests.get(f"{REMOTION_URL}/health", timeout=3)
        remotion_ok = r.ok
    except Exception:
        pass

    status_lines.append(f"\nServices:")
    status_lines.append(f"  Remotion: {'✅' if remotion_ok else '❌ (check entrypoint logs)'}")
    status_lines.append(f"\nAssets:")
    status_lines.append(f"  Logo: {'✅' if os.path.exists(NESSO_LOGO_PATH) else '❌'}")
    status_lines.append(f"  PSYCH sfx: {'✅' if os.path.exists(PSYCH_SFX_PATH) else '⬇️ will download'}")

    await update.message.reply_text("\n".join(status_lines))


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command."""
    await update.message.reply_text(
        "🎬 **Nesso Content Engine V24**\n\n"
        "Commands:\n"
        "/make — Generate 1 video (22s)\n"
        "/make 4 — Generate 4 videos back-to-back\n"
        "/theme — Generate with a specific vibe\n"
        "/stats — Render analytics\n"
        "/status — Pipeline health\n"
        "/makesimply — Build the 60s Simply Scaled sales reel (both dashboards)\n\n"
        "Each video: kinetic hook → iMessage story → real app click-through → logo close\n"
        "Videos stream in as soon as each is ready."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Simply Scaled — 60s sales reel  (/makesimply, /make_simply)
# Renders the SimplyScaledReel composition (both dashboards) via the sibling
# simply-scaled-content-bot pipeline, reusing the same ElevenLabs + Telegram keys.
# ─────────────────────────────────────────────────────────────────────────────

REEL_BUDGET_SECONDS = 20 * 60
_SIMPLY_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "simply-scaled-content-bot"
)
_REEL_BUSY = False


def _reel_pipeline():
    """Import the sibling pipeline module (sys.path set up once)."""
    import sys

    if _SIMPLY_DIR not in sys.path:
        sys.path.insert(0, _SIMPLY_DIR)
    import reel_pipeline

    return reel_pipeline


def _reel_caption() -> str:
    try:
        dur = _reel_pipeline().TARGET_DURATION
    except Exception:  # noqa: BLE001
        dur = 60
    return f"Simply Scaled — {dur:.0f}s sales reel 🎬"


def _build_simply_reel() -> dict:
    """Blocking: build one reel (raises on failure)."""
    return _reel_pipeline().build_reel()


async def _send_reel(update, result: dict):
    if result.get("error"):
        await update.message.reply_text(f"❌ Reel failed: {result['error'][:500]}")
        return
    try:
        await _reply_video_with_retry(
            update, result["output_path"], caption=_reel_caption()
        )
    except Exception as e:
        await update.message.reply_text(f"❌ Reel rendered but failed to send: {e}")
        return
    await update.message.reply_text(
        "📞 (847) 212-2142   ·   bradyschwartz25@gmail.com\n"
        "Simply Scaled — custom dashboards & automation for any business."
    )


def _prerendered_reel() -> str | None:
    """Path to the committed full-quality reel (sent by default), or None."""
    p = os.path.join(_SIMPLY_DIR, "reel_prerendered.mp4")
    return p if os.path.exists(p) else None


async def cmd_make_simply(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /makesimply        → send the ready-made 60s Simply Scaled reel (instant)
    /makesimply fresh  → re-render it from scratch (slow; Railway-lite mode)
    """
    global _REEL_BUSY
    args = [a.lower() for a in (context.args or [])]
    fresh = any(a in ("fresh", "new", "render", "rebuild") for a in args)
    prer = _prerendered_reel()

    # Default path: ship the proven, full-quality, pre-rendered reel. No render,
    # no OOM risk — works anywhere including Railway's 512MB box.
    if prer and not fresh:
        await update.message.reply_text("🎬 Sending your Simply Scaled reel...")
        try:
            await _reply_video_with_retry(update, prer, caption=_reel_caption())
            await update.message.reply_text(
                "📞 (847) 212-2142   ·   bradyschwartz25@gmail.com\n"
                "Simply Scaled — custom dashboards & automation for any business.\n"
                "(Tip: /makesimply fresh re-renders it from scratch.)"
            )
        except Exception as e:  # noqa: BLE001
            await update.message.reply_text(f"❌ Failed to send reel: {e}")
        return

    if _REEL_BUSY:
        await update.message.reply_text(
            "⏳ A reel render is already running — I'll send it when it's done."
        )
        return

    # Fresh render (best-effort; falls back to the pre-rendered file on failure).
    await update.message.reply_text(
        "🎬 Re-rendering your Simply Scaled reel from scratch...\n"
        "ElevenLabs voiceover → render both dashboards → mix + loudnorm audio.\n"
        "This is slow (several minutes). I'll send the saved cut if it can't finish here."
    )
    start = time.time()
    loop = asyncio.get_running_loop()
    _REEL_BUSY = True
    try:
        fut = loop.run_in_executor(None, _build_simply_reel)
        result = None
        try:
            result = await asyncio.wait_for(fut, timeout=REEL_BUDGET_SECONDS)
        except asyncio.TimeoutError:
            # The pipeline's own render watchdog (REEL_RENDER_TIMEOUT) kills the
            # Remotion process group, so the executor thread dies shortly after.
            result = {"error": f"render exceeded {REEL_BUDGET_SECONDS // 60}min"}
        except Exception as e:  # noqa: BLE001
            log.error("makesimply fresh build failed", exc_info=True)
            result = {"error": str(e)}
    finally:
        _REEL_BUSY = False

    if result and not result.get("error"):
        await _send_reel(update, result)
        try:
            import shutil

            wd = result.get("work_dir")
            if wd and "ss_reel_" in wd:
                shutil.rmtree(wd, ignore_errors=True)
        except OSError:
            pass
        await update.message.reply_text(f"✅ Fresh render done in {time.time() - start:.0f}s")
        return

    # Fresh failed — fall back to the committed reel so the user still gets video.
    err = (result or {}).get("error", "unknown")
    if prer:
        await update.message.reply_text(
            f"⚠️ Fresh render couldn't finish here ({err[:120]}). Sending the saved cut instead."
        )
        try:
            await _reply_video_with_retry(update, prer, caption=_reel_caption())
        except Exception as e:  # noqa: BLE001
            await update.message.reply_text(f"❌ Failed to send reel: {e}")
    else:
        await update.message.reply_text(f"❌ Reel failed: {err[:400]}")


def create_bot(token: str) -> Application:
    """Create and configure the Telegram bot."""
    request = HTTPXRequest(
        connect_timeout=TG_CONNECT_TIMEOUT,
        read_timeout=TG_READ_TIMEOUT,
        write_timeout=TG_WRITE_TIMEOUT,
        pool_timeout=TG_POOL_TIMEOUT,
        media_write_timeout=TG_MEDIA_WRITE_TIMEOUT,
    )
    get_updates_request = HTTPXRequest(
        connect_timeout=TG_CONNECT_TIMEOUT,
        read_timeout=TG_READ_TIMEOUT,
        write_timeout=TG_WRITE_TIMEOUT,
        pool_timeout=TG_POOL_TIMEOUT,
    )

    app = (
        Application.builder()
        .token(token)
        .request(request)
        .get_updates_request(get_updates_request)
        .build()
    )

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("make", cmd_make))
    app.add_handler(CommandHandler("theme", cmd_theme))
    app.add_handler(CommandHandler("stats", cmd_stats))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("makesimply", cmd_make_simply))
    app.add_handler(CommandHandler("make_simply", cmd_make_simply))

    return app
