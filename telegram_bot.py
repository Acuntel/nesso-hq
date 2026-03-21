"""
Nesso Content Engine V20 — Telegram Bot Interface

Commands:
  /make      — Generate 1 video
  /make N    — Generate batch of N videos (max 10)
  /status    — Show pipeline health
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

from pipeline import render_batch, render_single_video

log = logging.getLogger(__name__)

# Track state
_last_render_time: float | None = None
_last_error: str | None = None
_total_renders: int = 0
_total_failures: int = 0


async def cmd_make(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /make [count] command."""
    global _last_render_time, _last_error, _total_renders, _total_failures

    # Parse count from args
    count = 1
    if context.args:
        try:
            count = int(context.args[0])
            count = max(1, min(count, 10))  # Clamp to 1-10
        except ValueError:
            await update.message.reply_text("Usage: /make or /make <number 1-10>")
            return

    await update.message.reply_text(
        f"🎬 Generating {count} video{'s' if count > 1 else ''}...\n"
        "This takes 1-3 minutes per video."
    )

    start_time = time.time()

    if count == 1:
        results = [render_single_video()]
    else:
        results = render_batch(count)

    elapsed = time.time() - start_time

    for i, result in enumerate(results):
        video_num = f"[{i+1}/{count}] " if count > 1 else ""

        if result["error"]:
            _total_failures += 1
            _last_error = result["error"]
            await update.message.reply_text(
                f"❌ {video_num}Video failed\n\n"
                f"**Stage:** Pipeline error\n"
                f"**Error:** {result['error'][:500]}\n\n"
                f"Hook query: {result.get('hook_query', 'N/A')}"
            )
            continue

        _total_renders += 1
        _last_render_time = time.time()

        output_path = result["output_path"]
        duration = result["duration"]

        # Message 1: The video file
        try:
            with open(output_path, "rb") as video_file:
                await update.message.reply_video(
                    video=video_file,
                    caption=f"{video_num}Nesso Content V20 — {duration:.0f}s",
                    supports_streaming=True,
                )
        except Exception as e:
            await update.message.reply_text(
                f"❌ {video_num}Video rendered but failed to send: {e}"
            )
            continue

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
            # Also remove the render temp dir
            render_dir = os.path.dirname(output_path)
            if os.path.isdir(render_dir) and "render_" in render_dir:
                import shutil
                shutil.rmtree(render_dir, ignore_errors=True)
        except OSError:
            pass

    await update.message.reply_text(
        f"✅ Batch complete in {elapsed:.0f}s — "
        f"{sum(1 for r in results if not r['error'])}/{count} successful"
    )


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /status command."""
    status_lines = [
        "📊 **Nesso Content Engine V20 Status**\n",
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

    # Check assets
    from config import PSYCH_SFX_PATH, NESSO_LOGO_PATH
    status_lines.append(f"\nAssets:")
    status_lines.append(f"  Logo: {'✅' if os.path.exists(NESSO_LOGO_PATH) else '❌'}")
    status_lines.append(f"  PSYCH sfx: {'✅' if os.path.exists(PSYCH_SFX_PATH) else '⬇️ will download'}")

    await update.message.reply_text("\n".join(status_lines))


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command."""
    await update.message.reply_text(
        "🎬 **Nesso Content Engine V20**\n\n"
        "Commands:\n"
        "/make — Generate 1 video\n"
        "/make 5 — Generate 5 videos\n"
        "/status — Pipeline health\n\n"
        "Each video: YouTube hook → PSYCH morph → fake text story → Nesso reveal"
    )


def create_bot(token: str) -> Application:
    """Create and configure the Telegram bot."""
    app = Application.builder().token(token).build()

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("make", cmd_make))
    app.add_handler(CommandHandler("status", cmd_status))

    return app
