"""
Nesso Content Engine V20 — Entry Point

Starts the Telegram bot. Requires TELEGRAM_BOT_TOKEN env var.
"""

import logging
import os
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("nesso-v20")


def main():
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        log.error("TELEGRAM_BOT_TOKEN not set. Get one from @BotFather on Telegram.")
        sys.exit(1)

    # Ensure dirs exist
    from config import TEMP_DIR, ASSETS_DIR
    os.makedirs(TEMP_DIR, exist_ok=True)
    os.makedirs(ASSETS_DIR, exist_ok=True)

    log.info("Starting Nesso Content Engine V20...")

    from telegram_bot import create_bot
    app = create_bot(token)

    log.info("Bot running. Send /make to generate a video.")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
