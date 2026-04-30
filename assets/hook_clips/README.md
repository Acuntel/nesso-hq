# Bundled hook clips — chaos fallback pool

When Reddit is unreachable, rate-limited, or blocking Railway's egress IP, the
pipeline falls back to a random clip from this folder. Drop chaos MP4s here
and they bake into the Docker image at build time.

## What to put here

5–20 short (≥3.5s, prefer 4–8s) chaos clips, ideally:

- bike crashes / wipeouts
- public freakouts
- sky / base / parkour falls
- fast-paced chases
- abrupt explosions / impacts
- nature predator hits

Avoid: anything graphically violent, NSFW, or copyright-flagged music. Keep the
visual peak in the **first 2 seconds** of the file — hooks.py center-crops to
1080×1920 and trims to 2.5s for the hook.

## Format

- Container: `.mp4` / `.mov` / `.webm`
- Min duration: 3.5s
- Native audio matters — leave it in. Crash impacts, screams, tire screech,
  splash sounds are the soundtrack of the hook.

## How to seed

Right-click → "Save Video As" from `v.redd.it` posts, or:

```bash
yt-dlp -f "bv*+ba/b" -o "%(title).30s.%(ext)s" \
    "https://www.reddit.com/r/PublicFreakout/comments/<id>"
```

then drop the resulting `.mp4` into this directory.

## Refresh cadence

The Docker image rebuilds on every git push. To swap clips:

1. Replace files in this folder
2. `git add assets/hook_clips/` → commit → push
3. Railway rebuilds with the new pool

If this folder is empty AND Reddit is blocked, `/make` returns
`no hook clip available` — that's the loud-fail signal to refresh the pool.
