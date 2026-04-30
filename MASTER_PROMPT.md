# NESSO CONTENT ENGINE — MASTER PROMPT V24

The brain of the system. Every change to the pipeline must make a V23 video one
step closer to something that looks like a $10K agency shipped it. These are
the _laws_.

---

## THE GOAL

A 22–28 second short (TikTok / Reels / Shorts) that:

1. Stops scroll in the first 1.5s with **raw chaos footage** — no overlay, no
   voiceover, no logo, no caption. Just the clip and its native audio. The
   thumb stops because the _visual_ is unhinged, not because of text.
2. Emotionally binds the viewer through a 4-message iMessage story (one
   gut-punch line in ALL CAPS) where bubbles **fill most of the screen** and
   VO reads the whole message before the next one appears.
3. Demonstrates Nesso through a **real click-through** of the app — home grid
   → Sarah's drained bar → Reach out → ✨ Write with AI → AI types a message
   → Send.
4. Closes on the logo + payoff + handle + **comment-bait CTA** ("what's their
   name? 👇"). The CTA is pinned to the safe-zone center, never overlapped by
   captions or VO timing.

If ≥ 7 of 10 viewers can't tell whether a human or a bot made it, we're there.

---

## WHY V24 EXISTS

V23 shipped. The user called it amateur for six reasons:

1. **Voiceover ran past the bubbles' on-screen time** — especially the close
   CTA. ElevenLabs trailing tails got chopped because the slot only padded
   `+0.4s`. Last word of "nesso. free on the app store." was clipped half the
   time.
2. **Hook had voiceover and overlay text on top of the clip.** Three signals
   competing in the first 2 seconds = scroll-past. Should be ONLY the clip
   and its native audio.
3. **Hook clip was thematically random.** Currently chaos subs already in
   `hooks.py`, but the engine didn't bias toward the most kinetic options
   (bike crashes, chases, skydives, freakouts).
4. **Bubbles were a tiny blip at the bottom of the screen.** fontSize=40,
   maxWidth=75%, container `bottom: 460` — visually amateur and unreadable
   on small phones. They should fill most of the screen.
5. **Script language was too soft.** Lowercase, "ngl/fr" peppering. Not
   public enough to make people upset / share / argue. The gut-punch needs
   to feel like it was screenshotted out of a real fight.
6. **CTA blocked by caption ribbon and timing.** Caption track was at
   positionY=0.79 = y≈1517, the LogoClose payoff text sat near center. They
   never collided in practice but the CTA's 2.5s budget was too tight for
   the close VO ("nesso. free on the app store." needs ≥3.0s).

V24 fixes all six, end-to-end.

---

## HARD RULES — DO NOT BREAK

### Hook (hooks.py + HookText.tsx + voiceover.py)

- **No hook voiceover.** `generate_hook_voiceover()` returns `""` always. The
  raw clip carries the moment.
- **No overlay text in the first 1.0s.** The kinetic typography starts at
  frame 30 (1.0s @ 30fps), not frame 0. First second = pure clip + native
  audio. (Word stagger window starts at 35% of duration instead of 8%.)
- **Chaos pool is split.** Tier-1 chaos subs (PublicFreakout, IdiotsInCars,
  HoldMyRedbull, sendittards, AbruptChaos, instant_regret, SweatyPalms) get
  60% of the rolls; nature/extreme sports get 30%; long-tail get 10%.
- **Native audio passes through.** Don't strip it — it's the soundtrack of
  the chaos. Crashes have tire screech. Freakouts have screaming. That IS
  the audio cue. Music ducks during hook so native audio dominates.
- **No min-score gate over 1500.** Lower the bar so peak-chaos clips that
  were posted recently still surface.

### Script (scripts.py + config.py)

- **4 real messages + 1 "Read H:MM AM" system line = exactly 5 entries.** Not 6. Not 7. Count them.
- **Max 65 chars per message** (was 70). Tighter cap forces brashness.
- **Delays are VO-paced.** `min_for_text = 1.7 + len(text)/18`. Short bubbles
  get 1.8–2.8s. Long bubbles get up to 3.6s. The emphasis bubble gets 3.2–3.8s.
- Exactly one `emphasis: true` — the gut-punch. **Emphasis text is ALL CAPS.**
- **Brashness rules** (the new V24 archetypes are public-language fights):
  - "the AUDIT" — "I COUNTED. 4 MONTHS. ZERO TEXTS FROM YOU."
  - "the CALLOUT" — "be honest. when did you last text me first."
  - "the RECEIPTS DUMP" — "scroll up. every text since october starts with me."
  - "the PUBLIC SHAME" — "your own birthday post got more from me than you've sent in a year."
  - "the CONFESSION" — "I'm the friend everyone slowly phases out. you're proof."
- Lowercase texting style for non-emphasis lines. Caps allowed on key words
  for emphasis (NEVER, ALWAYS, ZERO). At least one specific number/month per script.
- NO emojis (they wreck TTS). End every spoken message with `.`, `?`, or `!` —
  ElevenLabs needs the punctuation to know where to stop.

### Voiceover (voiceover.py)

- **Hook VO is dead.** `generate_hook_voiceover` returns `""` immediately.
- **Never trim TTS mid-word.** If the TTS clip is longer than the message
  delay, extend the slot to `tts_duration + 0.7s` of breathing room (was 0.4s).
- **Close VO** (`generate_close_voiceover`) is NEW. Reads the close payoff
  ("nesso. free on the app store.") and returns its measured duration so
  pipeline can flex the LogoClose composition to fit.
- Story VO total duration directly sets `story_dur`, clamped to
  `[STORY_DURATION_MIN=9s, STORY_DURATION_MAX=15s]` (was 14s — gives slack).

### Bubbles (IMessageStory.tsx)

- **fontSize: 60** (was 40) — bubbles take most of the screen.
- **maxWidth: 86%** (was 75%) — bubbles stretch wider.
- **padding: 24px 32px** (was 16x22) — chunkier visual weight.
- **borderRadius: 32** (was 26) — modern iMessage style.
- **Bubble area `bottom: 240`** (was 460) — bubbles fill almost down to the
  TikTok UI line. We move captions OUT of the story segment entirely.
- **Emphasis bubble pop is bigger** — 1.0 → 1.18 (was 1.12).

### Captions (CaptionTrack.tsx)

- **Story segment: NO burned-in captions.** The bubbles ARE the captions. We
  pass `captions={undefined}` to IMessageStory so CaptionTrack returns null
  and never overlaps a bubble.
- **Demo segment: captions stay at positionY={0.78}, fontSize={46}.** No change.
- **Close (LogoClose) segment: NO captions.** The CTA text is the message.

### Close / CTA (LogoClose.tsx + reveal flow)

- **Duration is dynamic.** `close_dur = max(3.0s, close_vo_dur + 0.7s)` so the
  VO finishes before the cut. Cap at 5.0s so we don't overrun.
- **Comment-bait CTA line** sits BELOW the handle: "what's their name? 👇".
  Sized at 36px, opacity ramp 0→1 from 60% → 80% of duration so it lands
  AFTER the handle is read.
- **No caption ribbon on LogoClose.** Already none, but the comment-bait line
  takes that visual real estate intentionally.

### Loop trigger (NEW V24)

- Final 0.4s of the close = subtle re-fade of the hook's first frame at 18%
  opacity, so the loop point feels intentional. Boosts AVD on TikTok.

### Transitions (the agency grammar)

Hard cuts between segments (concat demuxer, no xfade). Each segment does its
own cut punctuation:

| Cut          | Visual                                        | SFX                                 |
| ------------ | --------------------------------------------- | ----------------------------------- |
| Hook → Story | Hook end flash + story opening whip-flash     | PSYCH sfx + sub_drop                |
| Story → Demo | Story closing flash + demo opening whip-flash | riser_short + sub_drop              |
| Demo → Close | Demo send flash + close opening flash + punch | send_swoosh + logo_ding + cash_ding |

### SFX grammar

(unchanged from V23 — sub_drop / heartbeat / bubble_pop / typing_tick /
notification_ding / glitch_stab + impact_hit / riser_short / ui_tap /
whoosh_short / typewriter_tick / send_swoosh / logo_ding + cash_ding)

### Master bus

- Limiter at `limit=0.92`, `level_out=0.88`.
- **Music ducks 2x harder during hook** (volume 0.06) so native chaos audio
  dominates. Returns to 0.22 baseline during story.
- Sidechaincompress on music keyed off VO sum (threshold=0.05, ratio=6).

---

## TELEGRAM UX

- `/make` → 1 full V24 video, fully independent script.
- `/make N` → N full videos (1 ≤ N ≤ 10). Each streams to Telegram AS IT
  FINISHES.
- `/theme <topic>` → 1 full video flagged with the theme (forward-compat).
- `/stats`, `/status` unchanged. Banner reads "Nesso Content Engine V24".

---

## DEPLOYMENT

- GitHub: `Acuntel/nesso-hq`, `main` branch.
- Railway: watches `main`, auto-deploys on push.
- SFX library is built at Docker build time via `scripts/build_sfx.py`.
- `remotion-reveal/` has its own build step.

---

## SUCCESS METRICS

Every video should move at least one:

1. **Completion rate ≥ 70%** (22–28s watched to the end)
2. **Share rate ≥ 3%**
3. **Comment rate ≥ 4%** (was 2% — the comment-bait CTA should lift this)
4. **Profile visit rate ≥ 1%**

If it doesn't move one after 24h, revert the change.

---

## NEXT EXPERIMENTS (not yet shipped)

- Beat-sync the emphasis bubble to a specific 120BPM music track.
- Swap bundled lo-fi tracks for 4 distinct moods (sad, tense, nostalgic,
  resolute) and pick by script archetype.
- Dynamic hook line based on scraped clip type (crash → "the friendship that
  crashed harder than this guy").
- "Part 2" hook replies — second 15s video paying off message 3 of a previous
  story, posted 6 hours later. Tests narrative loop retention.
