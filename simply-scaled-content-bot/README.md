# Simply Scaled — 60s Sales-Reel Bot

A second "content bot" that lives inside the Nesso content engine and reuses the
same infra (Remotion server on :3100, ElevenLabs key, ffmpeg, the Telegram bot
process). Instead of Nesso TikToks, it renders **one 60-second vertical sales
reel** that shows off two real dashboards Brady built — **Stolen Mule** (law-firm
Command Deck) and **Restoration One** (restoration $20k dashboard) — and converts
the viewer into a call/text. It's a sizzle reel for Simply Scaled's dev services.

## What it produces

`SimplyScaledReel` (Remotion composition at `../remotion-reveal/src/SimplyScaledReel.tsx`)
— a cinematic, Jarvis/Higgsfield-style recreation of both dashboards with:
count-up KPIs, charts that draw themselves, a glowing brush scrubber, the
**Telegram-text → live lead card** miracle, a drag-to-Won live revenue jump,
a two-worlds proof montage, a founder beat, and a close with the wordmark,
**(847) 212-2142**, **bradyschwartz25@gmail.com**, and a free-teardown CTA.

Output: 1080×1920, 30 fps, **exactly 60.0s**, ElevenLabs voiceover + music bed +
beat-timed SFX, ~20 MB (well under Telegram's 50 MB bot limit).

## Run it locally

```bash
# 1) start the shared Remotion server (once)
cd ../remotion-reveal && npx remotion bundle src/index.ts   # rebuild bundle after editing the .tsx
REMOTION_PORT=3100 npm run server &                          # (only needed for the bot path; CLI render auto-bundles)

# 2) build a reel
cd ../simply-scaled-content-bot
../.venv/bin/python reel_pipeline.py --out /tmp/ss_reel
# → prints VERIFY {...} and FINAL: <path to mp4>
```

The render uses the Remotion **CLI** (multi-core). On a memory-limited host
(Railway 512 MB) set `REEL_CONCURRENCY=1`.

## From Telegram

Wired into the live bot (`../telegram_bot.py`). Telegram command names can't
contain hyphens, so it's registered as **`/makesimply`** (alias `/make_simply`).
It builds the reel and sends it back with the contact line. Needs:

- `ELEVENLABS_API_KEY` ✅ (already set in `../.env`)
- `TELEGRAM_BOT_TOKEN` ⚠️ (empty in `../.env` — paste your @BotFather token to send)
- `ANTHROPIC_API_KEY` is **not** required for this reel (the VO script is fixed copy).

## Swap in your real assets (optional)

- Drop a logo PNG at `assets/logo.png` → replaces the coded "Simply Scaled" wordmark in the close.
- Drop a headshot at `assets/founder.jpg` (or a frame) → replaces the "B" monogram in the founder beat.
  (The ChatGPT logo URL you sent is auth-gated/expired — `File stream access denied` — so it couldn't be fetched.)

## Edit the script / timing

- Voiceover lines + min beat durations: `BEATS` in `reel_pipeline.py`.
- SFX placement: `SFX_CUES` in `reel_pipeline.py`.
- Visuals/scenes/colors: `../remotion-reveal/src/SimplyScaledReel.tsx`
  (rebuild the bundle after editing if you use the server path).
- Timing auto-scales to **exactly 60.0s**: per-beat ElevenLabs clips are measured,
  laid on a natural timeline, then beats + VO are stretched by the same factor.

## Artifacts

- `MASTERPROMPTS.md` — the three full master prompts + the adversarial sales analysis.
- `STORYBOARD.md` — the synthesized winning 16-beat storyboard + final VO script.
- `simply_scaled_reel.mp4` — the latest rendered reel (also copied to `~/Desktop/`).
- `last_beats.json` — the timing of the last render.
