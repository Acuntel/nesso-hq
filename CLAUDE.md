# CLAUDE.md -- Nesso Content Engine V20

## What This Is
Autonomous short-form video pipeline that generates viral TikTok/Reels/Shorts content to promote Nesso. Triggered via Telegram bot, deployed on Railway. V20 = 20+ iterations of refinement.

## Tech Stack
- Python 3.11, FFmpeg, yt-dlp, Pillow
- Claude API (script generation), ElevenLabs (TTS voiceover)
- Telegram bot (trigger + delivery), Railway (hosting)

## The 9-Stage Pipeline

```
/make → hooks.py → scripts.py → voiceover.py → renderer.py → reveal.py → music.py → morph.py → pipeline.py (final encode) → Telegram delivery
```

### Stage 1: Hook Sourcing (`hooks.py`)
- Searches YouTube via yt-dlp (10 results per query)
- Extracts heatmap peak moment (requires 50K+ views) or falls back to first 6-15% of video
- Downloads ONLY the segment (Railway OOM prevention), crops to 9:16 vertical
- Extracts audio separately before crop (crop strips audio)
- Max 15s hook, 720p max height

### Stage 2: Script Generation (`scripts.py`)
- Calls Claude API (claude-sonnet-4-20250514) with hook description + category
- Returns fake iMessage conversation JSON (6-15 messages)
- Category bridge maps hook type to emotional pivot (crash → "friendships crash too")
- Falls back to `fallbacks/scripts.json` → then hardcoded fallback
- Message format: `{sender, text, delay}` where delay = seconds before next message

### Stage 3: Voiceover (`voiceover.py`)
- ElevenLabs TTS per message (eleven_turbo_v2_5, mp3_44100_128)
- System messages → 1.5s silence
- Per-message durations fed back to renderer for frame sync
- Drift correction: scales durations if accumulated measurement error > 0.01s
- Fallback: silence generation via FFmpeg anullsrc → wave module

### Stage 4: Frame Rendering (`renderer.py`)
- Pillow renders iMessage-style bubbles as PNG frames (1080x1920)
- Blue (#007AFF) right-aligned = "me", dark gray (#1C1C1E) left-aligned = others
- Safe zones: top 150px, bottom 250px, right 200px (TikTok UI)
- One frame per message, showing all messages up to that point (scroll effect for overflow)
- If no voiceover: scales delays so story is minimum 15s

### Stage 5: Frame Compilation (`renderer.py`)
- FFmpeg concat demuxer compiles PNGs to story.mp4 at 30fps
- Repeats last frame to avoid black frame at end

### Stage 6: Nesso Reveal (`reveal.py`)
- 3 frames: feature line (2s) → logo + "it's free" (2s) → @nesso.app CTA (1s)
- Rotates through reveal lines, never repeats consecutively
- Logo from `assets/nesso_logo.png`, fallback = blue circle

### Stage 7: Background Music (`music.py`)
- Downloads lo-fi/emotional music from YouTube via yt-dlp
- Filters for 30-300s duration, verifies audio stream exists
- Falls back gracefully (video continues without music)

### Stage 8: Morph + Audio Mix (`morph.py`)
- **Video**: FFmpeg xfade (rotates transitions) from hook → story, then concat with reveal
- **Audio layers** (all precisely timed with adelay):
  1. Hook audio: full volume, fade out last 0.3s
  2. PSYCH sfx: 1.5x volume at morph point (hook_dur - 0.2s)
  3. Voiceover: 85% volume during story section
  4. Music: 12% with VO / 18% without, fade in 1s, fade out last 2s
- amix with normalize=0 (preserve peak amplitude)
- Mux: `-c:v copy` (reuse video), NO `-shortest` flag

### Stage 9: Final Encode (`pipeline.py`)
- Re-encode to 1080x1920 with padding, libx264 + aac
- movflags +faststart for streaming
- Verify with ffprobe (size > 10KB, has video stream, duration > 0.5s)

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
hook_audio:  [0 ──────── hook_dur] volume=1.0, fade_out last 0.3s
psych_sfx:   [hook_dur-0.2s ──] volume=1.5
voiceover:   [hook_dur-morph/2 ──────── story_end] volume=0.85, fade_in 0.3s
music:       [hook_dur-morph/2 ──────── story_end] volume=0.12(w/VO)|0.18(no VO), fade_in 1s, fade_out last 2s
```

## Config Quick Reference (`config.py`)
- Video: 1080x1920, 30fps, libx264, aac 128k, max 50MB
- Bubbles: font 32px, contact 24px, radius 18px, gap 8px
- Morph: rotates transitions (fadeblack, dissolve, wipeleft, circleopen, etc.)
- Reveal: 2s text + 2s logo + 1s CTA = 5s total
- Hook: min 50K views for heatmap, max 3 candidates, max 720p

## Environment Variables
```
TELEGRAM_BOT_TOKEN     (required)
ANTHROPIC_API_KEY      (required — Claude for scripts)
ELEVENLABS_API_KEY     (optional — TTS voiceover)
ELEVENLABS_VOICE_ID    (optional — default: pFZP5JQG7iQjIQuC4Bku)
```

## File Structure
```
config.py          — All constants, queries, captions, reveal lines
pipeline.py        — Orchestrator: calls all stages in sequence
hooks.py           — YouTube search + heatmap + download + crop
scripts.py         — Claude API → iMessage conversation JSON
voiceover.py       — ElevenLabs TTS → per-message audio + durations
renderer.py        — Pillow frame rendering + FFmpeg compilation
reveal.py          — Nesso brand reveal frames + video
music.py           — YouTube music download + psych sfx
morph.py           — xfade transition + 4-layer audio mix + final mux
verify.py          — ffprobe duration/codec/health checks
telegram_bot.py    — /make, /status commands, video delivery
main.py            — Entry point (starts Telegram bot)
assets/            — nesso_logo.png, psych_sfx.mp3
fallbacks/         — scripts.json (pre-written conversation fallbacks)
tmp/               — Per-render temp directories (auto-cleaned)
Dockerfile         — python:3.11-slim + ffmpeg + fonts-dejavu-core
```

## Known Failure Modes
| Symptom | Cause | Fix |
|---------|-------|-----|
| Railway OOM kill | `aloop` or parallel FFmpeg | Use `-stream_loop -1`, sequential processing, threads=1 |
| Silent API failure | Railway sandbox swallows errors | Always validate response, retry with backoff, use fallbacks |
| Missing fonts on Railway | macOS fonts not available | Dockerfile installs fonts-dejavu-core, renderer falls back |
| xfade not supported | Old FFmpeg version | Falls back to simple concat (no transition) |
| Heatmap unavailable | Video < 50K views | Falls back to first 6-15% of video |
| Audio drift | Measurement error accumulation | Drift correction in voiceover.py scales all durations |
| yt-dlp hangs | Bad video/network | socket_timeout=30, retries=3, download_ranges only |
| Concat path issues | Quotes in filenames | Escape single quotes, use -safe 0 |

## Before You Make Changes
1. If touching FFmpeg commands, test locally first with a real video file.
2. If adding dependencies, check Railway's build environment (Dockerfile).
3. If changing the pipeline flow, walk me through input → output before running.
4. Never deploy to Railway without local testing.
5. If Telegram bot stops responding, check Railway logs — usually OOM or unhandled exception.
6. NEVER use `aloop`. NEVER skip `-threads 1` on Railway. NEVER omit `-t` duration limits.
