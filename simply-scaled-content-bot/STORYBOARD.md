# Simply Scaled — 60s Sales Reel — v9 "THE SYSTEM SPEAKS" (binding)

Beat keys, VO lines, captions, minimum durations, SFX fractions AND camera
headings/moves live in `../remotion-reveal/src/simply/beats.json` — that
manifest IS the spec. Composition: `../remotion-reveal/src/jarvis/` (camera
z-tunnel, HUD, kit, scenes A/B/C). `last_beats.json` has real render timing.

**Concept:** the narrator IS the software. An AI Brady built pitches its own
maker in first person, through one continuous camera flythrough — zero cuts —
inside a persistent living HUD (mission clock, status ticker, voice waveform,
progress rail). The uncanny confidence of a machine vouching for a human IS
the capability proof: the ad is itself a working product demo.

**Spine (15 beats):** flash-forward hook (messy text → $14,200, frame 1) →
"I'm not a person. I'm the software." → auto-drag pipeline proof → $612,480
odometer → 3 A.M. nightwatch → "And I have siblings" constellation → law-firm
OS dive → contract-AI scan → outbound call+email duo → 14 SYSTEMS · 12 MONTHS ·
1 BUILDER → the maker → "HE BUILT ME. HE CAN BUILD ONE FOR YOU." → radar
leak-scan of YOUR business → offer card → CTA hold to the literal last frame.

## Hard rules (learned v1→v8, verified against rendered frames)

- **60.0s exactly** — `targetDuration` in the manifest; verify() fails the
  build outside ±0.5s. The CTA must start by ~49s.
- **-14 LUFS / -1.5 dBTP** — two-pass linear loudnorm in the mux; verify()
  fails outside ±3 LU. (v7 shipped at -23.6 LUFS — inaudible in a feed.)
- **Every beat readable sound-off** — caption from the manifest or in-scene
  text; captions get a dark scrim and stay above the bottom ~280px platform-UI
  zone.
- **No emoji as product iconography** — the shared `Icon` stroke set only.
- **The pivot stays bright** — never let the morph drop to near-black again.
- **The watermark owns the top-right corner** — the app chrome's Live badge
  sits next to the title, not under the wordmark.
