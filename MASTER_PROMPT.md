# NESSO CONTENT ENGINE — MASTER PROMPT V22

## THE BRUTAL TRUTH ABOUT THE LAST RENDER

Run `b8beb606` on 2026-04-20 01:28–01:29 UTC **did not crash**. It shipped a 39.3-second MP4 to Telegram. The user considers it a failure because the output is **amateur**, and amateur videos don't get users.

Here is exactly what went wrong and why it matters:

### 1. Hook is a stock clip of animals (disconnected from the story)

- Reddit `r/natureismetal`, `r/NatureIsFuckingLit`, `r/SweatyPalms` all returned **0 results** on every endpoint
- YouTube returned 10 candidates, **all 3 downloads failed** with `Requested format is not available` — **yt-dlp is out of date**, YouTube's format codes changed
- Pipeline fell through to Pexels "wild animals nature" → a generic stock clip of animals with no audio
- Result: the viewer sees animals, then a text conversation about friendship drift. **Zero thematic bridge.** Brain disconnects in under 1 second → swipe.

### 2. "Demo" is not a demo — it's a slideshow

- `reveal.py::_render_demo_frames` loads 4 PNG screenshots (`home.png`, `reach_out.png`, `ai_suggestions.png`, `ai_suggestions.png`) and applies a **zoom 1.0 → 1.04 Ken Burns effect** over each
- Captions are a black band at the bottom with white text: "this is nesso" / "time's up. time to reach out" / "AI writes the message for you" / "just tap and send"
- **There is no clicking, no navigation, no keyboard, no modal sliding up, no animation of the app responding.** The viewer is looking at static pictures of an app, not the app.
- This is the #1 reason videos aren't converting: the app looks dead.

### 3. The video is 39.3 seconds — 60% over target

- `hook (6.9s) + story1 (14.4s) + demo (8.6s) + story2 (7.5s) + cta (2.0s) = 39.3s`
- TikTok viral sweet spot for this format is **18–25 seconds**. Every second past 25 tanks completion rate. Every bleed-out on retention cripples algorithmic pickup.
- VO drift correction hit `scale=0.9051` — the voiceover measurement was 9% off. The renderer then scaled frames by 0.78× to compress a 15.4s VO into 12s of video. **That's dangerous — audio and video are fighting.**

### 4. Transitions are PowerPoint

- `morph.py` uses ffmpeg `concat` with no fade or dissolve — hard cuts between hook → story → demo → story → cta
- `config.py::MORPH_TRANSITIONS` has `["fade", "fade", "dissolve", "dissolve", "fadeblack"]` but they aren't invoked in the current concat path
- PSYCH sfx fires at `hook_dur - 0.2s` for a record-scratch, but there's nothing visual to match
- No kinetic typography. No sliding text. No scale punches on quotable lines. No word-by-word reveal. Just text bubbles appearing one at a time.

### 5. Text story breaks at a bad spot

- Pipeline splits the story in half and inserts the demo in the middle: `story1 (5 msgs) → demo (4 screens) → story2 (3 msgs)`
- The viewer was emotionally engaged in the conversation. The demo yanks them out of the moment into a slideshow, then back to texts. The emotional state never recovers.

### What this video is _supposed_ to be

A viral short that:

1. Stops scroll in the first 2 seconds with a thematically connected hook
2. Emotionally engages in the next 6–10 seconds with kinetic text
3. Demonstrates the Nesso app through a **genuine click-through** — taps, screen transitions, keyboard, modal, AI generating text — using the **real app UI rendered from React**, not PNG zooms
4. Lands the value prop with a 2–3 second close
5. Looks like it came from a $10,000 agency, not CapCut

Total runtime: **22 seconds max**. Any longer and we bleed.

---

## THE NEW ARCHITECTURE (V22)

### Segment timing — total 22s

| Segment    | Duration | What it is                                                                                           |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------- |
| Hook       | 2.5s     | Kinetic-text cold open. One viral line. Big scale pop. No stock footage.                             |
| Text Story | 9s       | 5–6 iMessage bubbles with per-bubble scale-in, typing tell, quotable gut-punch line that scales 1.2x |
| App Demo   | 8s       | Genuine click-through of Nesso rendered from real React. Taps, swipes, modals, keyboard, AI typing.  |
| Close      | 2.5s     | Logo lockup with `@nesso.app` and one-line payoff. Watermark-style, not screen-fill.                 |

### Hook (2.5s) — KINETIC TEXT, NOT STOCK FOOTAGE

**Kill the Pexels/Reddit/YouTube hook library entirely for the next iteration.** Stock clips are the #1 "content farm" tell. Instead:

- **Cold open is a typographic hook.** One line appears word-by-word over a subtle gradient background matching the Nesso color palette (warm rose / dark).
- Example lines (pick one per video based on script archetype):
  - "you haven't texted her in 4 months"
  - "the friend you keep meaning to call"
  - "scroll through your contacts. how many have you talked to this week."
  - "your phone tracks everything but not this"
- Typography: SF Pro Display / Geist Sans, 96–120pt, `tracking-tight`, each word slides up 20px with 80ms stagger, glow trail on the final word
- Background: `linear-gradient(180deg, #0A0710 0%, #14101C 50%, #1A1226 100%)` with subtle ambient blob particles (matching the app's `ambient-blob` class)
- PSYCH sfx hits at 2.3s. Hard cut to text story at 2.5s.

### Text Story (9s) — KINETIC iMESSAGE

- 5–6 messages total. Hard cap 6. One `"Read 1:47 AM"` system message at the end.
- Each bubble slides up 40px + scales from 0.85 → 1.0 with a spring easing. Duration 180ms per bubble.
- Typing indicator (3 dots, wave animation) shows for 0.4s before every incoming message — **skip for "me" messages**
- The **quotable gut-punch message** (usually message 3 or 4) gets a special treatment: scale 1.0 → 1.15 → 1.0 pulse, plus a subtle bloom/glow behind the bubble
- iMessage chrome: status bar (real 9:41, signal, battery), top bar with contact name + profile dot + back chevron, black dark-mode background
- Bubble tails: add the real iMessage tail shape (small triangle at bottom-left for incoming, bottom-right for outgoing)
- Font: 48pt SF Pro / system emoji fallback, bubbles at `rounded-[22px]` with consecutive-sender bubbles tighter (6px gap) and cross-sender looser (16px gap)
- VO plays over the bubbles at 85% volume. Music underneath at 12%.

### App Demo (8s) — THE REAL APP

This is the part the user is fighting for. Do it right.

**Render the actual Nesso UI in Remotion using the real React components.** No PNG zooms. No Pillow drawings. The Home screen, Person detail, Reach Out sheet, and AI Suggestions modal must be **rendered from the real source** so it looks exactly like the app because _it is the app_.

**The 8-second click-through:**

| Beat               | Duration | What happens                                                                                                                                                                         | VO                                                                  |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 1. Home screen     | 1.5s     | Inner Circle grid renders. 6 person cards fade up with 80ms stagger. One card (Sarah) has a bar draining from 60% → 10% in real time (spring easing). Hearts float up from the bar.  | "this is nesso. it tracks the friendships you actually care about." |
| 2. Tap animation   | 0.4s     | Fake finger taps Sarah's card. Card presses (scale 0.97). Haptic ring ripples.                                                                                                       | —                                                                   |
| 3. Slide to Person | 0.6s     | Home screen slides left -100%, Person detail slides in from right with same curve as iOS.                                                                                            | —                                                                   |
| 4. Person detail   | 1.2s     | Large avatar, name "Sarah", "💔 4 months since you talked" subtitle. "Reach out" button pulses.                                                                                      | "time's up. reach out before the connection dies."                  |
| 5. Tap reach out   | 0.3s     | Finger taps "Reach out". Button scales down, color deepens.                                                                                                                          | —                                                                   |
| 6. Sheet slides up | 0.5s     | Bottom sheet slides up 60% of screen height with backdrop blur fade.                                                                                                                 | —                                                                   |
| 7. AI suggestions  | 2.0s     | "✨ Write with AI" button press. Modal opens. AI message types out character-by-character at ~40 chars/sec: "hey, been thinking about you — free this weekend to actually catch up?" | "AI writes the message for you. all you do is send."                |
| 8. Send            | 1.5s     | Finger taps "💬 Text". Message slides into an iMessage blue bubble. Brief celebration flash.                                                                                         | "one tap. connection saved."                                        |

**Critical technical details:**

- The iPhone frame is visible — rounded corners, notch, status bar, home indicator. Everything happens INSIDE the frame. The user is looking at an iPhone.
- Use the actual Nesso CSS: `hsl(350 40% 52%)` for bar rose, `hsl(15 35% 90%)` for bg, glass-card blur, ambient-blob particles, serif "Inner Circle" header
- The fake finger is a subtle `circle + dot` that renders on taps — 60px diameter, 40% opacity, appears on tap frame and fades over 0.3s
- Screen transitions are `iOS UIKit push` — incoming slides in from right with slight drop shadow, outgoing slides left -30% (iOS does partial, not full)
- Keyboard: if any typing is shown, the iOS keyboard slides up from bottom with 0.3s ease-out, using the real iOS keyboard layout
- Modal backdrop: dim to 40% opacity black with 8px backdrop blur
- The bar drain animation must use a spring, not linear. Spring config: `{ damping: 20, stiffness: 120 }`

### Close (2.5s) — LOGO LOCKUP

- Not a separate "ad segment." Keep the last frame of the app demo visible underneath as a dimmed background (60% opacity)
- Nesso logo scales up from 0.6 → 1.0 with spring, centered
- Below logo: `"it's free"` in 72pt bold, word-slide-up
- Under that: `"@nesso.app"` in 40pt, in the warm rose accent color
- Total close is 2.5s. **No "Download on App Store." No gradient screen.** One beat. Out.

---

## TRANSITION GRAMMAR ($10K AGENCY POLISH)

Each transition between segments uses a specific technique. No repeated transitions back-to-back.

| Between      | Transition               | How                                                                                                                                                                              |
| ------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hook → Story | Glass shatter / slice up | Hook text splits horizontally, top half flies up -100%, bottom half flies down +100%, story fades in underneath                                                                  |
| Story → Demo | iPhone zoom-in           | Last text bubble stays anchored. iPhone frame materializes around the conversation. Camera pushes in toward the iPhone. Home screen is visible through the iPhone at final zoom. |
| Demo → Close | Dim + bloom              | Last demo frame dims to 60%, Nesso logo blooms in from center with scale spring + white glow fade                                                                                |

All transitions are **0.3–0.5s** max. No longer. No slower. No fadeblack.

---

## TEXT ANIMATION GRAMMAR

Every text element uses one of these techniques. Rotate per video to avoid monotony.

1. **Word-slide-up** — each word translates Y 20→0 with 80ms stagger, `cubic-bezier(0.16, 1, 0.3, 1)`
2. **Character typewriter** — 40 chars/sec, cursor blinks during, hides after
3. **Scale-pop** — full line appears at scale 0.85, springs to 1.0 then settles 0.98→1.0
4. **Split-flip** — line splits horizontally, top half slides down from above, bottom half slides up from below, they meet in the middle
5. **Ghost-pulse** — line appears, ghost copy at 30% opacity scales up to 1.1 and fades (indicates emphasis)
6. **Line-by-line cascade** — multi-line text appears line by line with 120ms stagger, each line slides in from the left with fade

The quotable gut-punch line ALWAYS uses scale-pop + ghost-pulse combined. That's the "screenshot and send" moment.

---

## AUDIO MIX

Simplify to 3 layers. No more.

1. **Voiceover** — 100% volume. ElevenLabs `eleven_multilingual_v2` (expressive) for every line, NOT turbo. Two voices: "me" slightly lower pitch, "friend" slightly higher.
2. **Music** — 15% volume under VO, 22% volume when VO is silent. Bundled lo-fi track from `assets/music/`. Fade in 0.8s, fade out last 1.5s.
3. **PSYCH sfx** — loud (1.5× gain) at hook → story transition only. 0.3s duration.

Kill: iMessage send/receive SFX (adds noise, nobody notices), hook audio (there's no hook audio in V22 — the hook is typographic), 5-layer mix (unnecessary complexity).

---

## TECHNICAL IMPLEMENTATION

- **Remotion server runs alongside Python** — Dockerfile installs Node.js 20 + runs the Remotion Express server on port 3100 as a background process before launching `python main.py`
- Python pipeline POSTs to `http://localhost:3100/render/<composition>` with JSON props
- Remotion returns the rendered MP4 as a stream, Python writes to disk, ffmpeg concats segments
- Compositions in `remotion-reveal/src/`:
  - `HookText.tsx` — 2.5s kinetic text hook
  - `IMessageStory.tsx` — 9s text story with bubble spring-ins (replaces Pillow renderer.py for story rendering)
  - `AppDemo.tsx` — 8s Nesso app click-through (the big one)
  - `LogoClose.tsx` — 2.5s close (replaces current CTA)
- `config.py::DEMO_NARRATION` updates to match the new 8-beat demo
- `reveal.py` is replaced with `demo_remote.py` — just calls the Remotion server
- `renderer.py` is stripped down — only needed for legacy Pillow if Remotion server is down
- `pipeline.py` new flow: `hook_remote → story_remote → demo_remote → close_remote → morph_and_concat`
- Railway: Remotion bundling happens once on startup (~20s), then subsequent renders are ~2–4s each

---

## SUCCESS METRICS

Every video gets measured against these four. If it doesn't move at least one, the change reverts.

1. **Completion rate ≥ 70%** — 22s watched to the end
2. **Share rate ≥ 3%** — viewer sends to a friend
3. **Comment rate ≥ 2%** — viewer names the friend they're thinking of
4. **Profile visit rate ≥ 1%** — viewer wants to see more

Shoot every video at this bar. If 9 out of 10 people can't tell whether a human or a bot made it, we're there.
