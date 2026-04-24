"""
Nesso Content Engine V20 — Telegram Bot Interface

Commands:
  /make [count]        — Generate 1-10 videos
  /theme <topic>       — Generate video with specific emotional angle
  /status              — Show pipeline health
  /stats               — Show render analytics
"""

import logging
import os
import time
from datetime import datetime

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
)

from analytics import get_stats
from pipeline import render_batch, render_single_video

log = logging.getLogger(__name__)

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
        with open(output_path, "rb") as video_file:
            await update.message.reply_video(
                video=video_file,
                caption=f"{video_num}Nesso V22 — {duration:.0f}s",
                supports_streaming=True,
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
        result = render_single_video()
        await _send_video_result(update, result)
        elapsed = time.time() - start_time
        if not result.get("error"):
            await update.message.reply_text(f"✅ Done in {elapsed:.0f}s")
        return

    # Batch — stream each video to Telegram as it finishes, not all at the end.
    used_hooks: list[str] = []
    successful = 0
    for i in range(count):
        r = render_single_video(exclude_queries=used_hooks)
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
    result = render_single_video(theme=theme)
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
        "📊 **Nesso Content Engine V22 Status**\n",
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
        "🎬 **Nesso Content Engine V23**\n\n"
        "Commands:\n"
        "/make — Generate 1 video (22s)\n"
        "/make 4 — Generate 4 videos back-to-back\n"
        "/theme — Generate with a specific vibe\n"
        "/stats — Render analytics\n"
        "/status — Pipeline health\n\n"
        "Each video: kinetic hook → iMessage story → real app click-through → logo close\n"
        "Videos stream in as soon as each is ready."
    )


def create_bot(token: str) -> Application:
    """Create and configure the Telegram bot."""
    app = Application.builder().token(token).build()

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("make", cmd_make))
    app.add_handler(CommandHandler("theme", cmd_theme))
    app.add_handler(CommandHandler("stats", cmd_stats))
    app.add_handler(CommandHandler("status", cmd_status))

    return app
