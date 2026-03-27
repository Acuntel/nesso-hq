"""
Nesso Content Engine V20 — Entry Point

Starts the Telegram bot + a lightweight HTTP health check server
so Railway doesn't kill the container for not binding a port.
"""

import logging
import os
import sys
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

# Load .env file if present (for local dev — Railway uses env vars directly)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("nesso-v20")


class HealthHandler(BaseHTTPRequestHandler):
    """Minimal HTTP handler for Railway health checks."""

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"Nesso Content Engine V20 OK")

    def log_message(self, format, *args):
        pass  # Suppress request logs


def start_health_server():
    """Start a background HTTP server on $PORT (Railway) or 8080."""
    port = int(os.environ.get("PORT", 8080))
    server = HTTPServer(("0.0.0.0", port), HealthHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    log.info("Health check server listening on port %d", port)


def main():
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        log.error("TELEGRAM_BOT_TOKEN not set. Get one from @BotFather on Telegram.")
        sys.exit(1)

    # Ensure dirs exist
    from config import TEMP_DIR, ASSETS_DIR
    os.makedirs(TEMP_DIR, exist_ok=True)
    os.makedirs(ASSETS_DIR, exist_ok=True)

    # Start health check server so Railway doesn't kill the container
    start_health_server()

    log.info("Starting Nesso Content Engine V20...")

    from telegram_bot import create_bot
    app = create_bot(token)

    log.info("Bot running. Send /make to generate a video.")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
