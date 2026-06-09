# Simply Scaled — 60s Sales Reel — v8 STORYBOARD (binding)

Beat keys, VO lines, captions, minimum durations and SFX fractions live in
`../remotion-reveal/src/simply/beats.json` — that manifest IS the spec; this
document explains the intent behind each beat. Timing below is approximate
(the pipeline measures real VO clips and scales everything to exactly 60.0s;
see `last_beats.json` for the timing of the last render).

**Audience:** non-technical local business owners (law, restoration, trades)
deciding whether to call/text Brady for a custom dashboard.
**Spine:** flash-forward bait → pain mirror → two real builds → "now yours" →
a real person → one clear ask.

## Beat sheet (13 beats / 60.0s)

### 1 · HOOK_MIRACLE (~5s) — flash-forward cold open

Frame 1 is mid-action: a messy Telegram text ("hey its john my basement
flooded…") types fast, a scan line sweeps it, and a clean **$14,200 · job won**
lead card materializes. Big caption: "A MESSY TEXT → A $14,200 JOB. IN 4
SECONDS." This is the bait — the full journey replays as the payoff in the
restoration act.
**VO:** Watch this. One messy text... becomes a fourteen-thousand-dollar job.

### 2 · PAIN_DESK (~3s) — the pain mirror, compressed

One desk tableau: AGREEMENT paper, "call back!!" + "invoice??" stickies, a
"Missed Call (7)" phone, a dim spreadsheet. Caption carries the line for
sound-off viewers.
**VO:** This is how most businesses still run.

### 3 · TURN_TO_PROOF (~4.5s) — the turn

Near-black, an app frame ignites; the pain props fly in as tool icons. Both
lines render in-scene, staged: "You don't need more hours." then "You need the
right tools. So I built them."
**VO:** You don't need more hours. You need the right tools. So I built them.

### 4 · LAW_TOUR (~7s) — Practice OS, 5 screens

Dashboard → Matters → Invoices → Calendar → Trust Accounting. Four cursor
clicks (fractions shared with the SFX cues via the manifest), slow push-in so
the populated content fills the 9:16 frame. Named proof in the VO.
**VO:** This one runs a whole law firm in Chicago. Matters, billing, calendar,
even trust accounting.

### 5 · LAW_PDF (~6s) — the contract AI

Drop-zone → Scan Contract click → verdict chips (3 OK / 1 VERIFY / 1 ACTION,
"Earnest money receipt: missing") with the "$0.04 · AWS Bedrock · 28s" footer.
**VO:** Custom A.I. reads a contract, and flags every missing date, name, and
signature.

### 6 · MORPH (~3s) — same engine, recolored ON SCREEN

The pivot stays bright: sidebar relabels law→restoration in place, KPI tiles
recolor indigo→copper while their labels crossfade (Unbilled→Leads in,
Collected→Sold YTD), the chart recolors. Thesis line lands early.
**VO:** Same engine. Rebuilt for a different business.

### 7 · RESTO_TEXT (~3s) — the panicked text

John's messy text types into the Auto-assistant phone.
**VO:** Every job starts with a panicked text.

### 8 · RESTO_LEAD (~4s) — the miracle, fulfilled

Scan line over the text → clean structured NEW LEAD card (Name / Phone /
Water / Thursday) with the copper thread-node born on its edge.
**VO:** The software reads it. Seconds later, it's a clean lead on the board.

### 9 · RESTO_PIPE (~5s) — one record everywhere

John's card travels New call → Got the job; the copper thread connects it to
Contacts and the Dashboard counter (38→39); $14,200 lands green.
**VO:** Win the job, and every number updates itself. Nothing slips.

### 10 · RESTO_MONEY (~4s) — the payoff number

Giant $612,480 odometer + Jobs won / Avg job / New customers chips +
in-scene line "every dollar started as one text."
**VO:** Six hundred twelve thousand dollars. One text at a time.

### 11 · PROOF_TURN (~4.5s) — two worlds → yours

Law card + repair card side by side; the second morphs into the dashed "YOUR
business" card. In-scene: "Two real businesses. One person built both."
**VO:** A law firm. A restoration crew. One builder. Now imagine yours.

### 12 · FOUNDER (~4s) — a real person

Brady beat: `assets/founder.jpg` if present (else the gradient B monogram),
both dashboards ghosted behind, lower-third "Brady · Simply Scaled — I build
these myself. No agency, no runaround."
**VO:** And it's just me. Brady. A real person you can call or text today.

### 13 · CLOSE_CTA (~11s) — one clear ask, held to the last frame

Wordmark + gradient bar land, then lift; the phone number becomes the hero at
~28% into the beat and HOLDS — with "Call or text", the email, the offer line
("Free 15-min teardown of where your money's leaking — no pitch.") and the
urgency line ("I only take a few builds a month."). Everything legible at once,
screenshot-ready, no fade-out.
**VO:** Free fifteen-minute teardown of where your money's leaking. No pitch.
Call or text, eight four seven... two one two... twenty-one, forty-two. I only
take a few builds a month.

## Hard rules (learned v1→v7, verified against rendered frames)

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
