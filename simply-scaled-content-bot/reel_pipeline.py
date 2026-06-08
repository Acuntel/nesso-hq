"""
Simply Scaled — 60s sales-reel pipeline.

Reuses the SAME infra as the Nesso content engine (Remotion server on :3100,
ElevenLabs key, ffmpeg) but renders the `SimplyScaledReel` composition instead.

Flow:
  1. ElevenLabs TTS for each of the 16 beats (a confident product-launch read)
  2. Measure each clip → build a natural VO timeline (each beat = a slot)
  3. Scale ALL beats + atempo the VO by the same factor → EXACTLY 60.0s, in sync
  4. Render SimplyScaledReel via the Remotion server (remotion_client)
  5. Mix audio: VO + subtle music bed + beat-timed SFX (from ../assets/sfx)
  6. Mux + final encode + ffprobe verify

Public:
  build_reel(out_dir=None) -> dict  (used by the `make-simply` Telegram command)
  CLI:  python reel_pipeline.py [--keep] [--out PATH]
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import tempfile
import uuid

# ── Make the parent repo importable (remotion_client, etc.) ──────────────────
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(ROOT, ".env"))
    load_dotenv(os.path.join(HERE, ".env"))  # optional local override
except Exception:
    pass

import remotion_client  # noqa: E402

log = logging.getLogger("simply_reel")

TARGET_DURATION = 75.0
FPS = 30

BRAND = "Simply Scaled"
PHONE = "(847) 212-2142"
EMAIL = "bradyschwartz25@gmail.com"
OFFER = "Free 15-min teardown of where your money's leaking — no pitch."

ELEVEN_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVEN_VOICE = os.environ.get("ELEVENLABS_VOICE_ID", "pFZP5JQG7iQjIQuC4Bku")

SFX_DIR = os.path.join(ROOT, "assets", "sfx")
LOGO_LOCAL = os.path.join(HERE, "assets", "logo.png")
FOUNDER_LOCAL = os.path.join(HERE, "assets", "founder.jpg")
PRERENDERED = os.path.join(HERE, "reel_prerendered.mp4")

# Railway (or any RAILWAY_* env) → render lite + single-thread to fit 512MB.
IS_RAILWAY = any(k.startswith("RAILWAY_") for k in os.environ)


def prerendered_path() -> str | None:
    """The committed, full-quality reel that /makesimply sends by default."""
    return PRERENDERED if os.path.exists(PRERENDERED) else None

# ── The 10 beats (v3): VO line + minimum on-screen duration (s) ──────────────
# Generic names only (no client/product names), differentiated law vs restoration,
# slower hook + close, no email. Keys MUST match SimplyScaledReel.tsx. Scales to ~63s.
BEATS = [
    ("HOOK", "If you run a business, five simple things quietly eat up your whole day… every single day.", 7.0),
    ("BRIDGE", "Now imagine one system that just… does it all for you.", 4.0),
    ("LAW_FULL", "For a law firm, it keeps every client, every document, and every case in one organized place, so nothing ever gets lost.", 6.5),
    ("LAW_AI", "I even built them custom A.I. that reads a forty-page contract and pulls every date, party, and deadline in seconds.", 6.5),
    ("LAW_TRACK", "And it keeps you honest. You tell it what matters, and it nudges you: you said you'd follow up on this, want me to handle it? Nothing slips through the cracks.", 6.5),
    ("LAW_MONEY", "It even shows the money: exactly what you've earned, and what your clients still owe.", 4.5),
    ("PIVOT", "Same builder, a completely different kind of business.", 3.5),
    ("RESTO_MONEY", "For a fire-and-water repair company, it's a live scoreboard. Six hundred twelve thousand dollars in jobs sold this year.", 6.5),
    ("RESTO_PIPE", "Every customer is tracked from the first call to the paid job, so nobody slips through the cracks.", 6.0),
    ("AI_TEXT", "And a customer texts in plain English. The software reads the mess, pulls out the details, and files the job all by itself.", 8.0),
    ("PROOF_TURN", "Two real businesses, one person built both. Now imagine this, built for yours.", 6.5),
    ("CLOSE_CTA", "This is Simply Scaled. Call or text eight four seven, two one two, two one four two for a free fifteen minute call. Tell me your business, and I'll tell you exactly what to automate first.", 10.0),
]

# ── SFX cues: (file, beat_key, offset_in_beat_s, volume) ─────────────────────
SFX_CUES = [
    # HOOK — one crisp tap per pain row (staggered, slow)
    ("pop2.mp3", "HOOK", 0.5, 0.5),
    ("pop2.mp3", "HOOK", 1.05, 0.5),
    ("pop2.mp3", "HOOK", 1.6, 0.5),
    ("pop2.mp3", "HOOK", 2.15, 0.5),
    ("pop2.mp3", "HOOK", 2.7, 0.55),
    # BRIDGE — Jarvis: scan checks each row (blips), core forms (power_up), locks
    ("power_up.mp3", "BRIDGE", 0.2, 0.5),
    ("blip.mp3", "BRIDGE", 0.7, 0.4),
    ("blip.mp3", "BRIDGE", 1.05, 0.4),
    ("blip.mp3", "BRIDGE", 1.4, 0.4),
    ("blip.mp3", "BRIDGE", 1.75, 0.4),
    ("blip.mp3", "BRIDGE", 2.1, 0.4),
    ("shimmer.mp3", "BRIDGE", 2.3, 0.5),
    ("impact_hit.mp3", "BRIDGE", 2.6, 0.55),
    # LAW vault — calm; swish in, soft click + flip
    ("swish.mp3", "LAW_FULL", 0.0, 0.5),
    ("ui_tap.mp3", "LAW_FULL", 2.6, 0.45),
    ("pop2.mp3", "LAW_FULL", 3.0, 0.4),
    # LAW custom AI — shimmer in, a blip per extracted term, ding when filed
    ("shimmer.mp3", "LAW_AI", 0.0, 0.55),
    ("blip.mp3", "LAW_AI", 2.6, 0.45),
    ("blip.mp3", "LAW_AI", 3.25, 0.45),
    ("blip.mp3", "LAW_AI", 3.9, 0.45),
    ("blip.mp3", "LAW_AI", 4.55, 0.45),
    ("logo_ding.mp3", "LAW_AI", 5.0, 0.55),
    # LAW proactive assistant — shimmer in, blip per reminder, click + ding
    ("shimmer.mp3", "LAW_TRACK", 0.0, 0.5),
    ("blip.mp3", "LAW_TRACK", 0.6, 0.4),
    ("blip.mp3", "LAW_TRACK", 1.1, 0.4),
    ("blip.mp3", "LAW_TRACK", 1.6, 0.4),
    ("ui_tap.mp3", "LAW_TRACK", 4.3, 0.5),
    ("logo_ding.mp3", "LAW_TRACK", 4.7, 0.55),
    # LAW money — thoom in, line-draw riser, single dignified cash ding
    ("thoom.mp3", "LAW_MONEY", 0.0, 0.5),
    ("riser_short.mp3", "LAW_MONEY", 0.3, 0.4),
    ("cash_ding.mp3", "LAW_MONEY", 3.0, 0.45),
    # PIVOT — seam wipe to the opposite world
    ("whoosh_short.mp3", "PIVOT", 0.2, 0.6),
    ("impact_hit.mp3", "PIVOT", 1.75, 0.6),
    # RESTO money — power-up in, big prominent cash on the number
    ("power_up.mp3", "RESTO_MONEY", 0.0, 0.5),
    ("riser_short.mp3", "RESTO_MONEY", 0.1, 0.45),
    ("cash_ding.mp3", "RESTO_MONEY", 3.6, 0.75),
    ("cash_ding.mp3", "RESTO_MONEY", 4.7, 0.45),
    # RESTO pipe — swish per column cross + dollar stamp
    ("swish.mp3", "RESTO_PIPE", 0.0, 0.45),
    ("swish.mp3", "RESTO_PIPE", 2.7, 0.45),
    ("swish.mp3", "RESTO_PIPE", 3.6, 0.45),
    ("swish.mp3", "RESTO_PIPE", 4.5, 0.45),
    ("cash_ding.mp3", "RESTO_PIPE", 4.75, 0.7),
    # AI beat — richest design: thoom in, typing, shimmer scan, token blips, ding
    ("thoom.mp3", "AI_TEXT", 0.0, 0.45),
    ("typing_tick.mp3", "AI_TEXT", 0.9, 0.35),
    ("notification_ding.mp3", "AI_TEXT", 2.3, 0.5),
    ("shimmer.mp3", "AI_TEXT", 3.0, 0.55),
    ("blip.mp3", "AI_TEXT", 4.0, 0.4),
    ("blip.mp3", "AI_TEXT", 4.5, 0.4),
    ("blip.mp3", "AI_TEXT", 5.0, 0.4),
    ("logo_ding.mp3", "AI_TEXT", 6.4, 0.6),
    # PROOF → yours
    ("power_up.mp3", "PROOF_TURN", 0.0, 0.45),
    ("logo_ding.mp3", "PROOF_TURN", 2.6, 0.45),
    ("shimmer.mp3", "PROOF_TURN", 3.8, 0.45),
    # CLOSE — thoom settle, held wordmark + final ding
    ("thoom.mp3", "CLOSE_CTA", 0.0, 0.45),
    ("logo_ding.mp3", "CLOSE_CTA", 0.5, 0.55),
    ("logo_ding.mp3", "CLOSE_CTA", 8.8, 0.45),
]


def _run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def _ffprobe_dur(path: str) -> float:
    r = _run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=nw=1:nk=1", path,
        ]
    )
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


# ─────────────────────────────────────────────────────────────────────────────
#  Voiceover
# ─────────────────────────────────────────────────────────────────────────────

def _tts(text: str, out_path: str) -> bool:
    """One ElevenLabs clip → mp3. Returns True on success."""
    if os.path.exists(out_path) and os.path.getsize(out_path) > 512:
        return True  # cache: reuse an already-generated clip in this dir
    if not ELEVEN_KEY:
        log.warning("No ELEVENLABS_API_KEY — skipping VO")
        return False
    try:
        from elevenlabs.client import ElevenLabs

        client = ElevenLabs(api_key=ELEVEN_KEY)
        kwargs = dict(
            voice_id=ELEVEN_VOICE,
            text=text,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )
        try:
            from elevenlabs import VoiceSettings

            kwargs["voice_settings"] = VoiceSettings(
                stability=0.42, similarity_boost=0.8, style=0.35, use_speaker_boost=True
            )
        except Exception:
            pass
        audio = client.text_to_speech.convert(**kwargs)
        with open(out_path, "wb") as f:
            for chunk in audio:
                if chunk:
                    f.write(chunk)
        return os.path.getsize(out_path) > 512
    except Exception as e:  # noqa: BLE001
        log.error("TTS failed for %r: %s", text[:40], e)
        return False


def generate_voiceover(work: str) -> tuple[list[dict], float, str | None]:
    """
    Returns (beats, total_dur, vo_track_path).
    `beats` = list of {key, start, dur} in seconds, scaled to total 60.0s.
    `vo_track_path` = a single 60.0s mp3 with each line at its beat (or None).
    """
    LEAD = 0.18   # VO starts slightly after the beat begins
    PAD = 0.22    # trailing breath after a line
    clips: list[tuple[str, str | None, float]] = []  # (key, path, vo_dur)
    for key, line, _min in BEATS:
        p = os.path.join(work, f"vo_{key}.mp3")
        ok = _tts(line, p) if line.strip() else False
        clips.append((key, p if ok else None, _ffprobe_dur(p) if ok else 0.0))

    # natural slot per beat = max(min_visual, lead + vo + pad)
    natural: list[dict] = []
    t = 0.0
    for (key, line, _min), (k2, path, vd) in zip(BEATS, clips):
        slot = max(_min, (LEAD + vd + PAD) if vd > 0 else _min)
        natural.append({"key": key, "start": t, "dur": slot, "vo": path, "vo_dur": vd})
        t += slot
    L = t
    scale = TARGET_DURATION / L if L > 0 else 1.0
    log.info("natural VO timeline=%.2fs  scale=%.3f (atempo=%.3f)", L, scale, 1 / scale)

    beats = [{"key": b["key"], "start": round(b["start"] * scale, 4),
              "dur": round(b["dur"] * scale, 4)} for b in natural]

    # Build the VO track at natural length, then atempo to 60.0s.
    vo_track = None
    have_vo = [b for b in natural if b["vo"]]
    if have_vo and ELEVEN_KEY:
        # Lay each clip on a silent base via adelay+amix
        inputs: list[str] = []
        filters: list[str] = []
        amix_labels: list[str] = []
        # silent base of length L
        base = os.path.join(work, "vo_base.wav")
        _run(["ffmpeg", "-y", "-f", "lavfi", "-t", f"{L:.3f}",
              "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", base])
        inputs += ["-i", base]
        amix_labels.append("[0:a]")
        idx = 1
        for b in natural:
            if not b["vo"]:
                continue
            delay_ms = int((b["start"] + LEAD) * 1000)
            inputs += ["-i", b["vo"]]
            filters.append(
                f"[{idx}:a]aresample=44100,adelay={delay_ms}|{delay_ms}[v{idx}]"
            )
            amix_labels.append(f"[v{idx}]")
            idx += 1
        natural_vo = os.path.join(work, "vo_natural.wav")
        fc = ";".join(filters) + (";" if filters else "")
        fc += "".join(amix_labels) + f"amix=inputs={len(amix_labels)}:normalize=0:dropout_transition=0[vo]"
        _run(["ffmpeg", "-y", *inputs, "-filter_complex", fc, "-map", "[vo]", natural_vo])
        # atempo to exactly 60.0s
        atempo = 1.0 / scale
        atempo = max(0.5, min(2.0, atempo))
        vo_track = os.path.join(work, "vo_60.wav")
        _run(["ffmpeg", "-y", "-i", natural_vo, "-filter:a",
              f"atempo={atempo:.4f}", "-t", f"{TARGET_DURATION}", vo_track])

    return beats, TARGET_DURATION, vo_track


# ─────────────────────────────────────────────────────────────────────────────
#  Music bed (subtle, dark, driving — synthesized so it's always available)
# ─────────────────────────────────────────────────────────────────────────────

def build_music(work: str, dur: float) -> str | None:
    out = os.path.join(work, "music.wav")
    # Low pad (root + fifth + octave) with slow tremolo + lowpass + reverb tail.
    fc = (
        "sine=frequency=55:sample_rate=44100[b];"
        "sine=frequency=110:sample_rate=44100[c];"
        "sine=frequency=164.81:sample_rate=44100[d];"
        "[b][c][d]amix=inputs=3:normalize=0,"
        "tremolo=f=4:d=0.25,lowpass=f=420,aecho=0.8:0.7:60:0.3,"
        "volume=0.5[m]"
    )
    r = _run(["ffmpeg", "-y", "-f", "lavfi", "-t", f"{dur:.3f}",
              "-i", "anullsrc=r=44100:cl=stereo",
              "-filter_complex", fc, "-map", "[m]", "-t", f"{dur:.3f}", out])
    return out if r.returncode == 0 and os.path.exists(out) else None


# ─────────────────────────────────────────────────────────────────────────────
#  Render the composition
# ─────────────────────────────────────────────────────────────────────────────

def render_video(work: str, beats: list[dict], dur: float, lite: bool | None = None) -> str:
    out = os.path.join(work, "reel_silent.mp4")
    props = {
        "beats": beats,
        "brand": BRAND,
        "phone": PHONE,
        "email": EMAIL,
        "offer": OFFER,
        "logoUrl": "",
        "founderPhotoUrl": "",
        "lite": bool(IS_RAILWAY if lite is None else lite),
    }
    # Upload optional brand assets to the Remotion server so <Img> can fetch them
    if os.path.exists(LOGO_LOCAL):
        try:
            props["logoUrl"] = remotion_client.upload_asset(LOGO_LOCAL, "ss_logo.png")
        except Exception as e:  # noqa: BLE001
            log.warning("logo upload failed: %s", e)
    if os.path.exists(FOUNDER_LOCAL):
        try:
            props["founderPhotoUrl"] = remotion_client.upload_asset(
                FOUNDER_LOCAL, "ss_founder.jpg"
            )
        except Exception as e:  # noqa: BLE001
            log.warning("founder upload failed: %s", e)

    # Render via the Remotion CLI (multi-core on a dev box; no 180s HTTP cap).
    # Set REEL_CONCURRENCY=1 on memory-limited hosts (e.g. Railway 512MB).
    remo_dir = os.path.join(ROOT, "remotion-reveal")
    bundle = os.path.join(remo_dir, "build")
    serve = bundle if os.path.exists(os.path.join(bundle, "index.html")) else os.path.join(remo_dir, "src", "index.ts")
    n_frames = max(1, round(dur * FPS))
    conc = os.environ.get("REEL_CONCURRENCY")
    if not conc:
        conc = "1" if IS_RAILWAY else str(max(1, (os.cpu_count() or 4) - 3))
    props_path = os.path.join(work, "props.json")
    with open(props_path, "w") as f:
        json.dump(props, f)
    cmd = [
        "npx", "remotion", "render", serve, "SimplyScaledReel", out,
        f"--props={props_path}", f"--concurrency={conc}",
        f"--frames=0-{n_frames - 1}", "--timeout=120000", "--log=error",
    ]
    log.info("render: %s", " ".join(cmd))
    r = subprocess.run(cmd, cwd=remo_dir, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(out):
        raise RuntimeError(f"remotion render failed: {r.stderr[-1200:] or r.stdout[-800:]}")
    return out


# ─────────────────────────────────────────────────────────────────────────────
#  Audio mix + mux
# ─────────────────────────────────────────────────────────────────────────────

def mux_audio(
    work: str, video: str, vo: str | None, music: str | None,
    beats: list[dict], out_path: str
) -> str:
    bmap = {b["key"]: b for b in beats}
    inputs = ["-i", video]
    fc: list[str] = []
    mix_labels: list[str] = []
    idx = 1

    if vo:
        inputs += ["-i", vo]
        fc.append(f"[{idx}:a]volume=0.95[vo]")
        mix_labels.append("[vo]")
        idx += 1
    if music:
        inputs += ["-i", music]
        fc.append(f"[{idx}:a]volume=0.10,afade=t=in:st=0:d=1.2,afade=t=out:st={TARGET_DURATION - 2:.1f}:d=2[mus]")
        mix_labels.append("[mus]")
        idx += 1

    for fname, key, off, vol in SFX_CUES:
        path = os.path.join(SFX_DIR, fname)
        if key not in bmap or not os.path.exists(path):
            continue
        at = bmap[key]["start"] + off
        delay_ms = int(at * 1000)
        inputs += ["-i", path]
        fc.append(
            f"[{idx}:a]aresample=44100,volume={vol},adelay={delay_ms}|{delay_ms}[s{idx}]"
        )
        mix_labels.append(f"[s{idx}]")
        idx += 1

    if not mix_labels:
        # no audio at all — just copy video
        _run(["ffmpeg", "-y", "-i", video, "-c", "copy", out_path])
        return out_path

    fc.append(
        "".join(mix_labels)
        + f"amix=inputs={len(mix_labels)}:normalize=0:dropout_transition=0,"
        "alimiter=limit=0.95,aresample=44100[aout]"
    )
    cmd = [
        "ffmpeg", "-y", *inputs,
        "-filter_complex", ";".join(fc),
        "-map", "0:v", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", "-t", f"{TARGET_DURATION}", out_path,
    ]
    r = _run(cmd)
    if r.returncode != 0:
        raise RuntimeError(f"mux failed: {r.stderr[-800:]}")
    return out_path


# ─────────────────────────────────────────────────────────────────────────────
#  Verify
# ─────────────────────────────────────────────────────────────────────────────

def verify(path: str) -> dict:
    r = _run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration,size:stream=codec_type,codec_name,width,height",
        "-of", "json", path,
    ])
    info = json.loads(r.stdout or "{}")
    fmt = info.get("format", {})
    streams = info.get("streams", [])
    has_v = any(s.get("codec_type") == "video" for s in streams)
    has_a = any(s.get("codec_type") == "audio" for s in streams)
    dur = float(fmt.get("duration", 0) or 0)
    size = int(fmt.get("size", 0) or 0)
    return {
        "ok": has_v and has_a and dur > 1 and size > 50_000,
        "duration": dur,
        "size_mb": round(size / 1e6, 2),
        "has_video": has_v,
        "has_audio": has_a,
        "streams": streams,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Orchestrator
# ─────────────────────────────────────────────────────────────────────────────

def build_reel(out_dir: str | None = None, keep: bool = False, lite: bool | None = None) -> dict:
    work = out_dir or tempfile.mkdtemp(prefix="ss_reel_")
    os.makedirs(work, exist_ok=True)
    rid = uuid.uuid4().hex[:8]
    final = os.path.join(work, f"simply_scaled_reel_{rid}.mp4")

    log.info("[1/5] voiceover…")
    beats, dur, vo = generate_voiceover(work)
    with open(os.path.join(work, "beats.json"), "w") as f:
        json.dump(beats, f, indent=2)

    log.info("[2/5] music bed…")
    music = build_music(work, dur)

    log.info("[3/5] render SimplyScaledReel via Remotion…")
    video = render_video(work, beats, dur, lite=lite)

    log.info("[4/5] mix audio + mux…")
    mux_audio(work, video, vo, music, beats, final)

    log.info("[5/5] verify…")
    v = verify(final)
    return {"output_path": final, "beats": beats, "duration": dur, "verify": v,
            "work_dir": work, "error": None if v["ok"] else "verification failed"}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=None, help="output dir (kept)")
    ap.add_argument("--keep", action="store_true")
    a = ap.parse_args()
    res = build_reel(out_dir=a.out, keep=True)
    print(json.dumps({k: v for k, v in res.items() if k != "verify"}, indent=2, default=str))
    print("VERIFY:", json.dumps(res["verify"], indent=2))
    print("FINAL:", res["output_path"])
