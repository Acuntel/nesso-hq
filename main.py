"""
Nesso Content Engine V23 — Entry Point

Starts the Telegram bot + a lightweight HTTP health check server
so Railway doesn't kill the container for not binding a port.
The Remotion Express server is launched in parallel by entrypoint.sh
and is verified before this process starts.
"""

import logging
import os
import sys
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("nesso-v23")


class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"Nesso Content Engine V23 OK")

    def log_message(self, format, *args):
        pass


def start_health_server():
    port = int(os.environ.get("PORT", 8080))
    server = HTTPServer(("0.0.0.0", port), HealthHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    log.info("Health check server listening on port %d", port)


def verify_remotion_ready():
    """Best-effort ping to the Remotion server. Log but don't exit on failure."""
    try:
        from remotion_client import wait_until_ready, REMOTION_URL
        if wait_until_ready(max_seconds=30):
            log.info("Remotion server healthy at %s", REMOTION_URL)
        else:
            log.warning(
                "Remotion server not responding at %s — renders will fail until it's up",
                REMOTION_URL,
            )
    except Exception as e:
        log.warning("Remotion health check skipped: %s", e)


def main():
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        log.error("TELEGRAM_BOT_TOKEN not set. Get one from @BotFather.")
        sys.exit(1)

    from config import TEMP_DIR, ASSETS_DIR
    os.makedirs(TEMP_DIR, exist_ok=True)
    os.makedirs(ASSETS_DIR, exist_ok=True)

    start_health_server()
    verify_remotion_ready()

    log.info("Starting Nesso Content Engine V23...")

    from telegram_bot import create_bot
    app = create_bot(token)

    log.info("Bot running. Send /make to generate a video.")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
