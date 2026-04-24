# NESSO CONTENT ENGINE — MASTER PROMPT V23

The brain of the system. Every change to the pipeline must make a V22 video one
step closer to something that looks like a $10K agency shipped it. These are
the _laws_.

---

## THE GOAL

A 22–26 second short (TikTok / Reels / Shorts) that:

1. Stops scroll in the first 1.5s with a thematically relevant typographic hook
2. Emotionally binds the viewer through a 4-message iMessage story (one
   gut-punch line) with VO that reads _the whole message before the next one
   appears_
3. Demonstrates Nesso through a **real click-through** of the app — home grid
   → Sarah's drained bar → Reach out → ✨ Write with AI → AI types a message
   → Send
4. Closes on the logo + "it's free" + "nesso.ai" + "on the App Store" with a
   punchy scale cut

If ≥ 7 of 10 viewers can't tell whether a human or a bot made it, we're there.

---

## WHY V23 EXISTS

V22 shipped. The user called it amateur for four reasons:

1. **Captions covered the text bubbles.** Lower-third overlay sat on top of the
   last 2–3 messages, so viewers couldn't read either the bubbles OR the VO
   caption cleanly.
2. **Voiceover outran the bubbles.** Claude generated 6 messages with 0.8–2.5s
   delays. TTS for a 100-char line takes 3–4s, so `voiceover.py` was
   _trimming TTS mid-word_ to fit the fixed slot. Half the messages were never
   heard in full.
3. **Transitions were PowerPoint-flat.** Hard cuts with no visual punctuation.
   The PSYCH audio hit did all the work alone.
4. **SFX library was synth-thin.** Every hit was a sine wave from
   `build_sfx.py`. No sub-bass weight, no tension layer, no glitch stabs.

V23 fixes all four, end-to-end.

---

## HARD RULES — DO NOT BREAK

### Script (scripts.py + config.py)

- **4 real messages + 1 "Read H:MM AM" system line = exactly 5 entries.** Not 6. Not 7. Count them.
- **Max 70 chars per message.** Claude is prompted for it; `_validate_script`
  truncates if the model ignores the prompt.
- **Delays are VO-paced.** `min_for_text = 1.6 + len(text)/20`. Short bubbles
  get 1.6–2.6s. Long bubbles get up to 3.4s. The emphasis bubble gets 3.0–3.4s.
- Exactly one `emphasis: true` — the gut-punch. Place as message 3 or 4.
- Lowercase, texting style. No emojis (they wreck TTS). Include at least one
  specific number or month in one message.

### Voiceover (voiceover.py)

- **Never trim TTS mid-word.** If the TTS clip is longer than the message
  delay, extend the slot to `tts_duration + 0.4s` of breathing room.
- Return `actual_delays` so `pipeline.py` can re-time the composition to
  match. The IMessageStory render uses THESE delays, not the original ones.
- Story VO total duration directly sets `story_dur`, clamped to
  `[STORY_DURATION_MIN=9s, STORY_DURATION_MAX=14s]`.

### Captions (CaptionTrack.tsx)

- Story segment: `positionY={0.79}`, `fontSize={38}`. That keeps the caption
  ribbon in the clean band between the bubble area (ends y≈1460) and the
  TikTok UI safe zone (y≈1740).
- Demo segment: default `positionY={0.78}`, default `fontSize={46}`.
- iMessage bubble container uses `bottom: 460` — bubbles stop at y≈1460 so
  captions NEVER overlap them.

### Transitions (the agency grammar)

Hard cuts between segments (concat demuxer, no xfade). Each segment does its
own cut punctuation:

| Cut          | Visual                                        | SFX                                 |
| ------------ | --------------------------------------------- | ----------------------------------- |
| Hook → Story | Hook end flash + story opening whip-flash     | PSYCH sfx + sub_drop                |
| Story → Demo | Story closing flash + demo opening whip-flash | riser_short + sub_drop              |
| Demo → Close | Demo send flash + close opening flash + punch | send_swoosh + logo_ding + cash_ding |

All flashes are 3–7 frames (~100–230ms at 30fps). No long fades. No fadeblack.

### SFX grammar

- **sub_drop**: 50→25Hz sub sweep + kick. Fires on EVERY segment cut (hook→story
  and story→demo). Volume 0.85 — this is the hit.
- **heartbeat**: 2-thump clip (~1.2s), looped under the whole story at volume
  0.14. Felt, not heard.
- **bubble_pop**: every message bubble (volume 0.22, never dominates VO).
- **typing_tick**: one soft tick before each incoming bubble (volume 0.14).
- **notification_ding**: first incoming bubble only (volume 0.32).
- **glitch_stab + impact_hit**: BOTH layered on the emphasis bubble — sharp
  high + sub body. Screenshot moment.
- **riser_short**: last 0.55s of story.
- **ui_tap**: every finger tap in the demo (Sarah's card, Reach out,
  Write with AI, Send Text).
- **whoosh_short**: iOS push transition (home→person slide) + sheet slide-up.
- **typewriter_tick × 6–14**: during AI reveal (5.55–6.60s of demo). Tempo
  scales with AI message length.
- **send_swoosh + bubble_pop**: message send, then landed-bubble pop.
- **logo_ding + cash_ding**: logo appear + "it's free" beat.

### Master bus

- All SFX sum through an `alimiter` at `limit=0.92` to stop clipping.
- Music ducks via `sidechaincompress` keyed off the voiceover sum
  (threshold=0.05, ratio=6). Music "breathes up" between VO beats.
- Music base volume = 0.22 (with VO, ducks to ~0.10) or 0.20 (no VO).

---

## TELEGRAM UX

- `/make` → 1 full video, fully independent script.
- `/make N` → N full videos (1 ≤ N ≤ 10). Each streams to Telegram AS IT
  FINISHES, not all at the end.
- `/theme <topic>` → 1 full video flagged with the theme (forward-compat).
- `/stats`, `/status` unchanged.

No more "variants" mode. The user wanted "one video = one command" — that's
now the shape.

---

## DEPLOYMENT

- GitHub: `Acuntel/nesso-hq`, `main` branch.
- Railway: watches `main`, auto-deploys on push.
- SFX library is built at Docker build time via `scripts/build_sfx.py`.
  Whenever you add a new SFX (like we did for sub_drop, heartbeat, glitch_stab
  in V23), the Dockerfile rebuilds on deploy.
- `remotion-reveal/` has its own build step (bundled once per deploy, then
  reused per-render).

---

## SUCCESS METRICS

Every video should move at least one:

1. **Completion rate ≥ 70%** (22–26s watched to the end)
2. **Share rate ≥ 3%**
3. **Comment rate ≥ 2%**
4. **Profile visit rate ≥ 1%**

If it doesn't move one after 24h, revert the change.

---

## NEXT EXPERIMENTS (not yet shipped)

- Beat-sync the emphasis bubble to a specific 120BPM music track (currently
  beats are approximate).
- Swap bundled lo-fi tracks for 4 distinct moods (sad, tense, nostalgic,
  resolute) and pick by script archetype.
- A/B test: LogoClose with vs. without the `on the App Store` line.
- "Part 2" hook replies — a second 15s video that pays off message 3 of a
  previous story, posted 6 hours later. Tests narrative loop retention.
