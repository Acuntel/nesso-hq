# Nesso Content Bot

The **live Nesso content engine** still runs from the repo ROOT (this folder's
parent): `pipeline.py`, `telegram_bot.py`, `remotion-reveal/`, `assets/`, etc.
It is intentionally NOT relocated here — moving it would break the Railway
Dockerfile/entrypoint relative paths and the running deploy.

This folder marks the logical "Nesso bot" half of the two-bot structure.
Its sibling, `../simply-scaled-content-bot/`, is the new Simply Scaled sales-reel
bot (the `make-simply` Telegram command + the `SimplyScaledReel` Remotion reel).

Both bots share the same Remotion server (`remotion-reveal/`), the same
ElevenLabs key, and the same Telegram bot process.
