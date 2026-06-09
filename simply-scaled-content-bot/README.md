# Simply Scaled — 60s Sales-Reel Bot (v8)

A second "content bot" that lives inside the Nesso content engine and reuses the
same infra (ElevenLabs key, ffmpeg, the Telegram bot process). Instead of Nesso
TikToks, it renders **one 60.0-second vertical sales reel** that shows off two
real dashboards Brady built — **Stolen Mule** (law-firm Command Deck) and
**Restoration One** (restoration $20k dashboard) — and converts the viewer into
a call/text. It's a sizzle reel for Simply Scaled's dev services.

## What it produces

`SimplyScaledReel` (Remotion composition, `../remotion-reveal/src/SimplyScaledReel.tsx`
plus scene modules in `../remotion-reveal/src/simply/`) — 13 beats:

1. **Flash-forward hook** — a messy customer text snaps into a clean $14,200
   lead in the first four seconds (the bait; the full journey replays later)
2. Compressed pain beat (sticky notes / missed calls) → the turn ("So I built them")
3. **Law act** — 5-screen Practice OS tour with push-in camera + the contract-AI scan
4. **Bright in-place morph** — the same app recolors indigo→copper on screen
5. **Restoration act** — text → clean lead → connected pipeline → $612k payoff
6. Proof turn → **founder beat** (a real person) → CTA hold with phone, email,
   offer and urgency, screenshot-still to the last frame

Output: 1080×1920, 30 fps, **exactly 60.0s**, loudness-normalized to
**-14 LUFS / -1.5 dBTP** (social-feed standard), ElevenLabs VO + music bed +
beat-timed SFX, well under Telegram's 50 MB bot limit.

## One manifest drives everything

`../remotion-reveal/src/simply/beats.json` is the single source of truth for
beat keys, minimum durations, VO lines, captions, and SFX cue fractions. The
TSX imports it; `reel_pipeline.py` reads it. Edit the reel there — the two
sides cannot drift.

## Run it locally

```bash
# 1) rebuild the bundle after editing any .tsx (the pipeline prefers build/)
cd ../remotion-reveal && npx remotion bundle src/index.ts

# 2) build a reel
cd ../simply-scaled-content-bot
../.venv/bin/python reel_pipeline.py --out /tmp/ss_reel
# → prints VERIFY {...} and FINAL: <path to mp4>

# 3) happy with it? make it the artifact /makesimply sends:
../.venv/bin/python reel_pipeline.py --out /tmp/ss_reel --promote
```

The render uses the Remotion **CLI** (multi-core; process-group-killed if it
exceeds `REEL_RENDER_TIMEOUT`, default 900s). On a memory-limited host
(Railway 512 MB) set `REEL_CONCURRENCY=1` (auto-detected via `RAILWAY_*`).

### Caching (what re-runs when you edit)

- **VO**: cached in `cache/` keyed by `sha1(voice + line text)` — change one
  word, re-buy exactly one ElevenLabs clip. Failures raise (1 retry); a reel
  can no longer ship with a silently missing line.
- **Music**: `assets/music_bed.mp3` is the committed, approved bed — every
  render uses the same track. `REEL_NEW_MUSIC=1` composes a fresh one.
- **Verify**: duration must be 60.0±0.5s and integrated loudness within ±3 LU
  of -14 LUFS, or the build fails loudly.

## From Telegram

Wired into the live bot (`../telegram_bot.py`) as **`/makesimply`**
(alias `/make_simply`):

- `/makesimply` → instantly sends the committed `reel_prerendered.mp4`
  (no render, no OOM risk — works on Railway's 512MB box)
- `/makesimply fresh` → re-renders from scratch (busy-locked; falls back to
  the saved cut on failure)

Needs `ELEVENLABS_API_KEY` and `TELEGRAM_BOT_TOKEN` in `../.env`.
`ANTHROPIC_API_KEY` is **not** required (the VO script is fixed copy).

## Swap in your real assets (optional)

- `assets/logo.png` → replaces the coded "Simply Scaled" wordmark in the close.
- `assets/founder.jpg` → replaces the gradient "B" monogram in the founder
  beat. (Strongly recommended — "a real person you can call" lands much harder
  with a face.) The pipeline stages these into `remotion-reveal/public/`.

## Artifacts

- `reel_prerendered.mp4` — the committed reel `/makesimply` sends (update via `--promote`).
- `simply_scaled_reel.mp4` — untracked convenience copy of the latest promoted render.
- `last_beats.json` — timing of the last successful render (written by `build_reel`).
- `STORYBOARD.md` — the binding 13-beat storyboard + VO script.
- `MASTERPROMPTS.md` — historical: the v1-v7 master prompts + adversarial sales analysis.
