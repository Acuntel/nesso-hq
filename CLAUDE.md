# CLAUDE.md -- Nesso Content Engine V24

## What This Is

Autonomous short-form video pipeline that generates viral TikTok/Reels/Shorts content to promote Nesso. Triggered via Telegram bot, deployed on Railway.

## Tech Stack

- Python 3.11, FFmpeg, yt-dlp, Pillow
- Claude API (script generation), ElevenLabs (TTS voiceover)
- Telegram bot (trigger + delivery), Railway (hosting)

## The 11-Stage Pipeline

```
/make → hooks.py → scripts.py → voiceover.py → renderer.py → reveal.py → music.py → morph.py → pipeline.py (final encode) → Telegram delivery
```

### Stage 1: Hook Sourcing (`hooks.py`)

- Primary: Reddit (top endpoint, category-aware subreddit mapping, quality score ranking)
- Fallback: YouTube (cookies + heatmap peak extraction)
- No Pexels — stock video is anti-viral, better to fail and retry
- Smart segment extraction: skips buildup, targets peak moments based on duration heuristics
- No text overlay — raw hook video, no processing that signals content farm
- Min 5s / Max 15s hook, 720p max height, Reddit score >= 2000

### Stage 2: Script Generation (`scripts.py`)

- Claude API (claude-sonnet-4-20250514) with hook description + category
- Returns fake iMessage conversation JSON (7-9 messages, STRICT cap)
- 5 script archetypes: AUDIT, COMPARISON, CONFESSION, CALLOUT, GROUP CHAT AUTOPSY
- Specificity check: retries once if script lacks names/numbers/dates
- max_tokens=800, delay range 0.8-3.0s
- Falls back to `fallbacks/scripts.json` → then hardcoded fallback

### Stage 3: Voiceover (`voiceover.py`)

- ElevenLabs TTS per message with dual voices (me vs friend)
- Expressive model (eleven_multilingual_v2) for knife messages (index 5+)
- Fast model (eleven_turbo_v2_5) for casual early messages
- Smart system message timing: Read=2.0s, typing=1.0s, Delivered=1.5s
- Variable post-speech buffer: 0.2s (short), 0.3s (normal), 0.4s (gut-punch)
- Drift correction: scales durations if accumulated measurement error > 0.01s

### Stage 4: Frame Rendering (`renderer.py`)

- Pillow renders iMessage-style bubbles as PNG frames (1080x1920)
- Blue (#007AFF) right-aligned = "me", dark gray (#1C1C1E) left-aligned = others
- Safe zones: top 150px, bottom 250px, right 200px (TikTok UI)
- iMessage top bar with contact name + late-night timestamp (2am vibe)
- Typing indicator (three dots) before incoming messages (when no voiceover)
- "Delivered" status rendering on final "me" message
- Bottom-aligned messages with scroll overflow

### Stage 5: Frame Compilation (`renderer.py`)

- FFmpeg concat demuxer compiles PNGs to story.mp4 at 30fps
- Repeats last frame to avoid black frame at end

### Stage 6: Nesso Reveal (`reveal.py`)

- 3 SECONDS TOTAL: feature text (1.5s) → logo + "it's free" + @nesso.app (1.5s)
- Subtle dark gradient background (not pure black)
- Punchier reveal lines — no brand name in text, logo handles recognition
- No app screenshots, no panning, no separate CTA frame

### Stage 7: Background Music (`music.py`)

- Primary: bundled royalty-free lo-fi tracks from `assets/music/`
- Fallback: FFmpeg synthesis (chord progressions + reverb, uses `-stream_loop`, NOT `aloop`)
- Two-pass approach: generate one chord cycle, then stream_loop to fill duration

### Stage 8: Message Timings (`pipeline.py`)

- Builds cumulative time offsets for each message for iMessage SFX sync

### Stage 9: Morph + Audio Mix (`morph.py`)

- **Video**: FFmpeg xfade (rotates transitions) from hook → story, then concat with reveal
- **Morph duration**: 0.5s default, 0.8s for fadeblack
- **Audio layers** (all precisely timed with adelay):
  1. Hook audio: full volume, fade out last 1.0s
  2. PSYCH sfx: 1.5x volume at morph point (hook_dur - 0.2s)
  3. Voiceover: 85% volume during story section
  4. Music: 12% with VO / 18% without, starts 1.0s before morph, fade in 1s, fade out last 2s
  5. iMessage send/receive SFX: 25% volume, first 3 messages only
- amix with normalize=0 (preserve peak amplitude)
- Mux: `-c:v copy` (reuse video), NO `-shortest` flag

### Stage 10: Final Encode (`pipeline.py`)

- Re-encode to 1080x1920 with padding, libx264 + aac
- movflags +faststart for streaming
- Captions from curated hooks (not script messages — they don't work standalone)

### Stage 11: Verify + Deliver (`pipeline.py` + `telegram_bot.py`)

- ffprobe verification (size > 10KB, has video stream, duration > 0.5s)
- Telegram delivery with TikTok caption, IG caption, IG pin comment

## FFmpeg Rules (CRITICAL)

- **NEVER use `aloop`** — causes Railway OOM kills. Use `-stream_loop -1` instead.
- Always `-threads 1` on Railway (512MB memory limit)
- Always `-preset ultrafast` on Railway
- Always `-y` to overwrite, `-t` to cap duration
- Always `-safe 0` with concat demuxer
- Escape single quotes in concat file paths: `path.replace("'", "'\\''")`
- Clean up temp files after EVERY stage — Railway disk isn't infinite

## Audio Mix Formula

```
hook_audio:  [0 ──────── hook_dur] volume=1.0, fade_out last 1.0s
psych_sfx:   [hook_dur-0.2s ──] volume=1.5
voiceover:   [hook_dur-1.0s ──────── story_end] volume=0.85, fade_in 0.3s
music:       [hook_dur-1.0s ──────── story_end] volume=0.12(w/VO)|0.18(no VO), fade_in 1s, fade_out last 2s
imsg_sfx:    [per-message timing] volume=0.25, first 3 messages only
```

## Config Quick Reference (`config.py`)

- Video: 1080x1920, 30fps, libx264, aac 128k, max 50MB
- Bubbles: font 40px, contact 28px, radius 22px, gap 12px
- Morph: 0.5s default, 0.8s fadeblack (rotates: fade, fadeblack, fadewhite, dissolve)
- Reveal: 1.5s text + 1.5s logo = 3s total
- Hook: min 5s duration, min 2000 Reddit score, max 3 candidates, max 720p
- Message delays: 0.8s min, 3.0s max
- Typing indicator: 0.6s (visual only, skipped when voiceover active)

## Environment Variables

```
TELEGRAM_BOT_TOKEN     (required)
ANTHROPIC_API_KEY      (required — Claude for scripts)
ELEVENLABS_API_KEY     (optional — TTS voiceover)
ELEVENLABS_VOICE_ID    (optional — default: pFZP5JQG7iQjIQuC4Bku)
ELEVENLABS_VOICE_ID_2  (optional — friend voice, default: Rachel)
YT_COOKIES_B64         (optional — YouTube cookie auth)
PEXELS_API_KEY         (optional — last-resort hook fallback)
```

## File Structure

```
config.py          — All constants, queries, captions, reveal lines
pipeline.py        — Orchestrator: calls all stages in sequence
hooks.py           — Reddit/YouTube hook sourcing (category-aware, smart segment extraction)
scripts.py         — Claude API → iMessage conversation JSON (5 archetypes)
voiceover.py       — ElevenLabs TTS → per-message audio + durations
renderer.py        — Pillow frame rendering + typing indicators + FFmpeg compilation
reveal.py          — 3-second Nesso reveal (text + logo)
music.py           — Bundled lo-fi tracks OR FFmpeg synthesis
morph.py           — xfade transition + 5-layer audio mix + iMessage SFX
verify.py          — ffprobe duration/codec/health checks
telegram_bot.py    — /make, /status commands, video delivery
main.py            — Entry point (starts Telegram bot)
app_screens.py     — Fake app screenshot renderer (unused in current reveal)
assets/            — nesso_logo.png, psych_sfx.mp3, imessage_sounds/, music/
fallbacks/         — scripts.json (pre-written conversation fallbacks)
tmp/               — Per-render temp directories (auto-cleaned)
Dockerfile         — python:3.11-slim + ffmpeg + fonts-dejavu-core
```

## Known Failure Modes

| Symptom                  | Cause                           | Fix                                                               |
| ------------------------ | ------------------------------- | ----------------------------------------------------------------- |
| Railway OOM kill         | `aloop` or parallel FFmpeg      | Use `-stream_loop -1`, sequential processing, threads=1           |
| Silent API failure       | Railway sandbox swallows errors | Always validate response, retry with backoff, use fallbacks       |
| Missing fonts on Railway | macOS fonts not available       | Dockerfile installs fonts-dejavu-core, renderer falls back        |
| xfade not supported      | Old FFmpeg version              | Falls back to simple concat (no transition)                       |
| Heatmap unavailable      | Video < 50K views               | Falls back to first 6-15% of video                                |
| Audio drift              | Measurement error accumulation  | Drift correction in voiceover.py scales all durations             |
| yt-dlp hangs             | Bad video/network               | socket_timeout=30, retries=3, download_ranges only                |
| Concat path issues       | Quotes in filenames             | Escape single quotes, use -safe 0                                 |
| Hook too short           | Clip under 5s                   | Rejected with RuntimeError, pipeline retries with different query |
| Script too generic       | No specifics in text            | Retries once with specificity instruction                         |

## Before You Make Changes

1. If touching FFmpeg commands, test locally first with a real video file.
2. If adding dependencies, check Railway's build environment (Dockerfile).
3. If changing the pipeline flow, walk me through input → output before running.
4. Never deploy to Railway without local testing.
5. If Telegram bot stops responding, check Railway logs — usually OOM or unhandled exception.
6. NEVER use `aloop`. NEVER skip `-threads 1` on Railway. NEVER omit `-t` duration limits.
7. Typing indicator frames are SKIPPED when voiceover is active to prevent audio desync.
8. Bundled music tracks go in `assets/music/` — add royalty-free lo-fi MP3s there.
