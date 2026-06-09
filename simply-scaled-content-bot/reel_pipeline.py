"""
Simply Scaled — 60s sales-reel pipeline (v8).

Reuses the SAME infra as the Nesso content engine (ffmpeg, ElevenLabs key,
the Telegram bot process) and renders the `SimplyScaledReel` composition via
the Remotion CLI.

Beat structure, VO lines, captions and SFX cue fractions all live in ONE
manifest shared with the composition:
    ../remotion-reveal/src/simply/beats.json

Flow:
  1. ElevenLabs TTS per beat — cached persistently by sha1(voice+text), so
     editing one line re-buys exactly one clip
  2. Measure each clip → natural timeline → scale beats + atempo VO by one
     factor → EXACTLY targetDuration (60.0s), in sync
  3. Music bed: committed asset (assets/music_bed.mp3); regenerated via
     ElevenLabs Music only when missing or REEL_NEW_MUSIC=1
  4. Render SimplyScaledReel via the Remotion CLI (process-group killed on
     timeout so a hung Chrome can't orphan)
  5. Mix VO (sidechain-ducked music) + beat-fraction SFX → two-pass loudnorm
     to -14 LUFS / -1.5 dBTP → mux with -c:v copy (no video re-encode)
  6. ffprobe + loudness verify (a mute or off-target reel FAILS, it never
     ships silently)

Public:
  build_reel(out_dir=None, keep=False, lite=None) -> dict   (raises on failure)
  prerendered_path() -> str | None
  CLI:  python reel_pipeline.py [--out PATH] [--keep] [--promote]
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import uuid

# ── Make the parent repo importable ──────────────────────────────────────────
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(ROOT, ".env"))
    load_dotenv(os.path.join(HERE, ".env"))  # optional local override
except Exception:
    pass

log = logging.getLogger("simply_reel")

# ── Shared manifest: ONE source of truth for beats, VO, captions, SFX ────────
MANIFEST_PATH = os.path.join(ROOT, "remotion-reveal", "src", "simply", "beats.json")
with open(MANIFEST_PATH) as _f:
    MANIFEST = json.load(_f)

TARGET_DURATION = float(MANIFEST["targetDuration"])
FPS = 30
SFX_GAIN = 0.45  # global SFX level (Brady: too loud) — scales every cue
LOUDNESS_I = -14.0  # integrated LUFS target (social-feed standard)
LOUDNESS_TP = -1.5  # true-peak ceiling dBTP

BRAND = "Simply Scaled"
PHONE = "(847) 212-2142"
EMAIL = "bradyschwartz25@gmail.com"
OFFER = "Free 15-min teardown of where your money's leaking — no pitch."

ELEVEN_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVEN_VOICE = os.environ.get("ELEVENLABS_VOICE_ID", "pFZP5JQG7iQjIQuC4Bku")

SFX_DIR = os.path.join(ROOT, "assets", "sfx")
CACHE_DIR = os.path.join(HERE, "cache")
LOGO_LOCAL = os.path.join(HERE, "assets", "logo.png")
FOUNDER_LOCAL = os.path.join(HERE, "assets", "founder.jpg")
MUSIC_BED = os.path.join(HERE, "assets", "music_bed.mp3")
PRERENDERED = os.path.join(HERE, "reel_prerendered.mp4")
LAST_BEATS = os.path.join(HERE, "last_beats.json")

REMO_DIR = os.path.join(ROOT, "remotion-reveal")
RENDER_TIMEOUT = int(os.environ.get("REEL_RENDER_TIMEOUT", "900"))  # seconds

# Railway (or any RAILWAY_* env) → render lite + single-thread to fit 512MB.
IS_RAILWAY = any(k.startswith("RAILWAY_") for k in os.environ)

# (key, vo_line, min_visual_duration_s) straight from the manifest
BEATS: list[tuple[str, str, float]] = [
    (b["key"], b["vo"], float(b["minDur"])) for b in MANIFEST["beats"]
]


def prerendered_path() -> str | None:
    """The committed, full-quality reel that /makesimply sends by default."""
    return PRERENDERED if os.path.exists(PRERENDERED) else None


def _sfx_cues() -> list[tuple[str, str, float, float]]:
    """(file, beat_key, frac_of_beat, volume) — straight from the manifest.
    If a `tour` block exists AND a LAW_TOUR beat is present, generate its
    click pairs from the same fractions the composition animates with."""
    cues: list[tuple[str, str, float, float]] = []
    keys = {b["key"] for b in MANIFEST["beats"]}
    for b in MANIFEST["beats"]:
        for f, frac, vol in b.get("sfx", []):
            cues.append((f, b["key"], float(frac), float(vol)))
    if "LAW_TOUR" in keys and MANIFEST.get("tour"):
        opens = ["ss_open.mp3", "ss_load.mp3", "ss_chime.mp3", "ss_pop.mp3"]
        for i, frac in enumerate(MANIFEST["tour"]["fracs"]):
            cues.append(("ss_click.mp3", "LAW_TOUR", float(frac), 0.46))
            cues.append((opens[i % len(opens)], "LAW_TOUR", float(frac) + 0.012, 0.3))
    return cues


SFX_CUES = _sfx_cues()


def _run(cmd: list[str], timeout: int = 300, **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, **kw)


def _run_checked(cmd: list[str], what: str, timeout: int = 300) -> subprocess.CompletedProcess:
    r = _run(cmd, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError(f"{what} failed: {r.stderr[-800:]}")
    return r


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
#  Voiceover — persistent cache keyed by content, loud failures
# ─────────────────────────────────────────────────────────────────────────────

def _vo_cache_path(key: str, text: str) -> str:
    h = hashlib.sha1(f"{ELEVEN_VOICE}|{text}".encode()).hexdigest()[:10]
    return os.path.join(CACHE_DIR, f"vo_{key}_{h}.mp3")


def _tts(text: str, out_path: str) -> None:
    """One ElevenLabs clip → mp3 (atomic write, 1 retry, raises on failure)."""
    if os.path.exists(out_path) and os.path.getsize(out_path) > 512:
        return  # content-hash cache hit
    if not ELEVEN_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY missing — cannot voice the reel")
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

    last_err: Exception | None = None
    for attempt in (1, 2):
        try:
            tmp = out_path + ".part"
            audio = client.text_to_speech.convert(**kwargs)
            with open(tmp, "wb") as f:
                for chunk in audio:
                    if chunk:
                        f.write(chunk)
            if os.path.getsize(tmp) <= 512:
                raise RuntimeError("TTS returned an empty clip")
            os.replace(tmp, out_path)
            return
        except Exception as e:  # noqa: BLE001
            last_err = e
            log.warning("TTS attempt %d failed for %r: %s", attempt, text[:40], e)
    raise RuntimeError(f"TTS failed for {text[:60]!r}: {last_err}")


def generate_voiceover(work: str) -> tuple[list[dict], float, str | None]:
    """
    Returns (beats, total_dur, vo_track_path).
    `beats` = list of {key, start, dur} in seconds, scaled to targetDuration.
    `vo_track_path` = one targetDuration-long wav with each line at its beat.
    """
    LEAD = 0.18  # VO starts slightly after the beat begins
    PAD = 0.22  # trailing breath after a line
    os.makedirs(CACHE_DIR, exist_ok=True)
    clips: list[tuple[str, str | None, float]] = []  # (key, path, vo_dur)
    for key, line, _min in BEATS:
        if line.strip():
            p = _vo_cache_path(key, line)
            _tts(line, p)
            clips.append((key, p, _ffprobe_dur(p)))
        else:
            clips.append((key, None, 0.0))

    # natural slot per beat = max(min_visual, lead + vo + pad)
    natural: list[dict] = []
    t = 0.0
    for (key, line, _min), (_k2, path, vd) in zip(BEATS, clips):
        slot = max(_min, (LEAD + vd + PAD) if vd > 0 else _min)
        natural.append({"key": key, "start": t, "dur": slot, "vo": path, "vo_dur": vd})
        t += slot
    L = t
    scale = TARGET_DURATION / L if L > 0 else 1.0
    log.info("natural VO timeline=%.2fs  scale=%.3f (atempo=%.3f)", L, scale, 1 / scale)

    beats = [
        {"key": b["key"], "start": round(b["start"] * scale, 4),
         "dur": round(b["dur"] * scale, 4)}
        for b in natural
    ]

    # Build the VO track at natural length, then atempo to targetDuration.
    vo_track = None
    have_vo = [b for b in natural if b["vo"]]
    if have_vo:
        inputs: list[str] = []
        filters: list[str] = []
        amix_labels: list[str] = []
        base = os.path.join(work, "vo_base.wav")
        _run_checked(
            ["ffmpeg", "-y", "-f", "lavfi", "-t", f"{L:.3f}",
             "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", base],
            "VO silent base",
        )
        inputs += ["-i", base]
        amix_labels.append("[0:a]")
        idx = 1
        for b in natural:
            if not b["vo"]:
                continue
            delay_ms = int((b["start"] + LEAD) * 1000)
            inputs += ["-i", b["vo"]]
            filters.append(f"[{idx}:a]aresample=44100,adelay={delay_ms}|{delay_ms}[v{idx}]")
            amix_labels.append(f"[v{idx}]")
            idx += 1
        natural_vo = os.path.join(work, "vo_natural.wav")
        fc = ";".join(filters) + (";" if filters else "")
        fc += "".join(amix_labels) + (
            f"amix=inputs={len(amix_labels)}:normalize=0:dropout_transition=0[vo]"
        )
        _run_checked(
            ["ffmpeg", "-y", *inputs, "-filter_complex", fc, "-map", "[vo]", natural_vo],
            "VO assembly",
        )
        atempo = max(0.5, min(2.0, 1.0 / scale))
        vo_track = os.path.join(work, "vo_fit.wav")
        _run_checked(
            ["ffmpeg", "-y", "-i", natural_vo, "-filter:a", f"atempo={atempo:.4f}",
             "-t", f"{TARGET_DURATION}", vo_track],
            "VO atempo",
        )

    return beats, TARGET_DURATION, vo_track


# ─────────────────────────────────────────────────────────────────────────────
#  Music bed — committed asset; ElevenLabs Music only regenerates it on demand
# ─────────────────────────────────────────────────────────────────────────────

# NOTE: no brand names in the prompt — ElevenLabs Music 400s on them (ToS).
MUSIC_PROMPT = (
    "Clean, modern, optimistic tech product-demo background music. Light driving "
    "electronic with a soft four-on-the-floor pulse, warm synth bass, gentle "
    "arpeggio and airy pads. Confident and forward-moving but never busy, "
    "designed to sit under a voiceover. Builds subtly to a satisfying lift near "
    "the end. Around 110 BPM. Instrumental, no vocals."
)


def _generate_music_bed() -> None:
    """Compose a fresh bed via ElevenLabs Music and save it as the asset."""
    from elevenlabs.client import ElevenLabs

    client = ElevenLabs(api_key=ELEVEN_KEY)
    ms = max(10000, min(300000, int(round(TARGET_DURATION + 5)) * 1000))
    audio = client.music.compose(prompt=MUSIC_PROMPT, music_length_ms=ms)
    os.makedirs(os.path.dirname(MUSIC_BED), exist_ok=True)
    tmp = MUSIC_BED + ".part"
    with open(tmp, "wb") as f:
        for chunk in audio:
            if chunk:
                f.write(chunk)
    if os.path.getsize(tmp) <= 2048 or _ffprobe_dur(tmp) < 5:
        raise RuntimeError("ElevenLabs music returned an unusable clip")
    os.replace(tmp, MUSIC_BED)
    log.info("new music bed saved → %s", MUSIC_BED)


def build_music(work: str, dur: float) -> str | None:
    """Fit the committed bed to `dur`. The bed is deterministic across renders;
    set REEL_NEW_MUSIC=1 to compose a new one."""
    want_new = os.environ.get("REEL_NEW_MUSIC") == "1"
    if (want_new or not os.path.exists(MUSIC_BED)) and ELEVEN_KEY:
        try:
            _generate_music_bed()
        except Exception as e:  # noqa: BLE001
            log.warning("ElevenLabs music failed (%s)", e)
    if os.path.exists(MUSIC_BED):
        fitted = os.path.join(work, "music_fit.mp3")
        _run_checked(
            ["ffmpeg", "-y", "-i", MUSIC_BED, "-af",
             f"apad,atrim=0:{dur:.3f},afade=t=out:st={max(0, dur - 2.5):.2f}:d=2.5",
             fitted],
            "music fit",
        )
        return fitted
    # Fallback: ffmpeg-synth pad (always available).
    wav = os.path.join(work, "music.wav")
    fc = (
        "sine=frequency=55:sample_rate=44100[b];"
        "sine=frequency=110:sample_rate=44100[c];"
        "sine=frequency=164.81:sample_rate=44100[d];"
        "[b][c][d]amix=inputs=3:normalize=0,"
        "tremolo=f=4:d=0.25,lowpass=f=420,aecho=0.8:0.7:60:0.3,volume=0.5[m]"
    )
    r = _run(["ffmpeg", "-y", "-f", "lavfi", "-t", f"{dur:.3f}",
              "-i", "anullsrc=r=44100:cl=stereo",
              "-filter_complex", fc, "-map", "[m]", "-t", f"{dur:.3f}", wav])
    return wav if r.returncode == 0 and os.path.exists(wav) else None


# ─────────────────────────────────────────────────────────────────────────────
#  Render the composition (Remotion CLI, killed as a process group on timeout)
# ─────────────────────────────────────────────────────────────────────────────

def _stage_public_asset(local: str, name: str) -> str:
    """Copy a brand asset into remotion-reveal/public so <Img>+staticFile can
    load it during the CLI render. Returns the bare name for the prop."""
    dst = os.path.join(REMO_DIR, "public", name)
    shutil.copyfile(local, dst)
    return name


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
    if os.path.exists(LOGO_LOCAL):
        props["logoUrl"] = _stage_public_asset(LOGO_LOCAL, "ss_logo.png")
    if os.path.exists(FOUNDER_LOCAL):
        props["founderPhotoUrl"] = _stage_public_asset(FOUNDER_LOCAL, "ss_founder.jpg")

    bundle = os.path.join(REMO_DIR, "build")
    serve = (
        bundle
        if os.path.exists(os.path.join(bundle, "index.html"))
        else os.path.join(REMO_DIR, "src", "index.ts")
    )
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
    # Own process group: if the watchdog fires we kill Chrome/node too, instead
    # of orphaning them on a memory-limited box.
    proc = subprocess.Popen(
        cmd, cwd=REMO_DIR, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, start_new_session=True,
    )
    try:
        stdout, stderr = proc.communicate(timeout=RENDER_TIMEOUT)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
        proc.wait()
        raise RuntimeError(f"remotion render exceeded {RENDER_TIMEOUT}s and was killed")
    if proc.returncode != 0 or not os.path.exists(out):
        raise RuntimeError(f"remotion render failed: {(stderr or stdout)[-1200:]}")
    return out


# ─────────────────────────────────────────────────────────────────────────────
#  Audio mix → two-pass loudnorm → mux (video stream copied untouched)
# ─────────────────────────────────────────────────────────────────────────────

def _measure_loudness(path: str) -> dict:
    r = _run(
        ["ffmpeg", "-i", path, "-af",
         f"loudnorm=I={LOUDNESS_I}:TP={LOUDNESS_TP}:LRA=11:print_format=json",
         "-f", "null", "-"],
        timeout=300,
    )
    import re

    blocks = re.findall(r"\{[^{}]*\}", r.stderr)
    if not blocks:
        raise RuntimeError(f"loudnorm measure produced no JSON: {r.stderr[-400:]}")
    return json.loads(blocks[-1])


def _build_mix(work: str, vo: str | None, music: str | None, beats: list[dict]) -> str | None:
    """All audio layers → one wav at natural mix levels (loudnorm comes after)."""
    bmap = {b["key"]: b for b in beats}
    inputs: list[str] = []
    fc: list[str] = []
    mix_labels: list[str] = []
    idx = 0

    vo_idx = mus_idx = None
    if vo:
        inputs += ["-i", vo]
        vo_idx = idx
        idx += 1
    if music:
        inputs += ["-i", music]
        mus_idx = idx
        idx += 1
    fade_out = max(0.0, TARGET_DURATION - 2.5)
    if vo_idx is not None and mus_idx is not None:
        # Music plays full in the gaps and DUCKS under the voiceover (sidechain).
        fc.append(f"[{vo_idx}:a]volume=0.95,asplit=2[vo][vosc]")
        fc.append(
            f"[{mus_idx}:a]volume=0.2,afade=t=in:st=0:d=1.5,"
            f"afade=t=out:st={fade_out:.1f}:d=2.5[musraw]"
        )
        fc.append(
            "[musraw][vosc]sidechaincompress=threshold=0.05:ratio=9:attack=12:release=320[mus]"
        )
        mix_labels += ["[vo]", "[mus]"]
    elif vo_idx is not None:
        fc.append(f"[{vo_idx}:a]volume=0.95[vo]")
        mix_labels.append("[vo]")
    elif mus_idx is not None:
        fc.append(f"[{mus_idx}:a]volume=0.4,afade=t=in:st=0:d=1.5[mus]")
        mix_labels.append("[mus]")

    for fname, key, frac, vol in SFX_CUES:
        path = os.path.join(SFX_DIR, fname)
        if key not in bmap:
            log.warning("SFX cue %s targets unknown beat %r — skipped", fname, key)
            continue
        if not os.path.exists(path):
            log.warning("SFX file missing: %s — skipped", path)
            continue
        # `frac` is a fraction (0..1) of the beat — stays locked to the
        # composition's fraction-based animation timing even when beats scale.
        at = bmap[key]["start"] + frac * bmap[key]["dur"]
        delay_ms = int(at * 1000)
        inputs += ["-i", path]
        fc.append(
            f"[{idx}:a]aresample=44100,volume={round(vol * SFX_GAIN, 3)},"
            f"adelay={delay_ms}|{delay_ms}[s{idx}]"
        )
        mix_labels.append(f"[s{idx}]")
        idx += 1

    if not mix_labels:
        return None

    fc.append(
        "".join(mix_labels)
        + f"amix=inputs={len(mix_labels)}:normalize=0:dropout_transition=0,"
        "alimiter=limit=0.95,aresample=44100[aout]"
    )
    mix = os.path.join(work, "mix.wav")
    _run_checked(
        ["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(fc),
         "-map", "[aout]", "-t", f"{TARGET_DURATION}", mix],
        "audio mix",
    )
    return mix


def mux_audio(
    work: str, video: str, vo: str | None, music: str | None,
    beats: list[dict], out_path: str
) -> str:
    mix = _build_mix(work, vo, music, beats)
    if mix is None:
        _run_checked(["ffmpeg", "-y", "-i", video, "-c", "copy", out_path], "mux (copy)")
        return out_path

    # Two-pass linear loudnorm: feed-loud without squashing the SFX transients.
    m = _measure_loudness(mix)
    normed = os.path.join(work, "mix_norm.wav")
    _run_checked(
        ["ffmpeg", "-y", "-i", mix, "-af",
         (
             f"loudnorm=I={LOUDNESS_I}:TP={LOUDNESS_TP}:LRA=11:"
             f"measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
             f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:"
             f"offset={m['target_offset']}:linear=true"
         ),
         "-ar", "44100", normed],
        "loudnorm",
    )

    # Video stream is untouched since the Remotion render → copy, don't re-encode.
    _run_checked(
        ["ffmpeg", "-y", "-i", video, "-i", normed,
         "-map", "0:v", "-map", "1:a",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
         "-movflags", "+faststart", "-t", f"{TARGET_DURATION}", out_path],
        "mux",
        timeout=600,
    )
    return out_path


# ─────────────────────────────────────────────────────────────────────────────
#  Verify — duration, streams, AND loudness; a broken reel fails loudly
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
    loud = None
    if has_a:
        try:
            loud = float(_measure_loudness(path)["input_i"])
        except Exception as e:  # noqa: BLE001
            log.warning("loudness verify failed: %s", e)
    ok = (
        has_v and has_a and size > 50_000
        and abs(dur - TARGET_DURATION) < 0.5
        and loud is not None and (LOUDNESS_I - 3.0) < loud < (LOUDNESS_I + 3.0)
    )
    return {
        "ok": ok,
        "duration": dur,
        "target": TARGET_DURATION,
        "size_mb": round(size / 1e6, 2),
        "has_video": has_v,
        "has_audio": has_a,
        "loudness_lufs": loud,
        "streams": streams,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Orchestrator
# ─────────────────────────────────────────────────────────────────────────────

def build_reel(out_dir: str | None = None, keep: bool = False, lite: bool | None = None) -> dict:
    """Build one reel. Raises on any failure (TTS, render, mux, verify) so a
    broken artifact never ships; cleans its temp dir on the way out."""
    made_tmp = out_dir is None
    work = out_dir or tempfile.mkdtemp(prefix="ss_reel_")
    os.makedirs(work, exist_ok=True)
    rid = uuid.uuid4().hex[:8]
    final = os.path.join(work, f"simply_scaled_reel_{rid}.mp4")

    try:
        log.info("[1/5] voiceover…")
        beats, dur, vo = generate_voiceover(work)
        with open(os.path.join(work, "beats.json"), "w") as f:
            json.dump(beats, f, indent=2)

        log.info("[2/5] music bed…")
        music = build_music(work, dur)

        log.info("[3/5] render SimplyScaledReel via Remotion…")
        video = render_video(work, beats, dur, lite=lite)

        log.info("[4/5] mix audio + loudnorm + mux…")
        mux_audio(work, video, vo, music, beats, final)

        log.info("[5/5] verify…")
        v = verify(final)
        if not v["ok"]:
            raise RuntimeError(f"verification failed: {json.dumps(v)[:400]}")

        with open(LAST_BEATS, "w") as f:
            json.dump(beats, f, indent=2)
        return {"output_path": final, "beats": beats, "duration": dur,
                "verify": v, "work_dir": work, "error": None}
    except BaseException:
        if made_tmp and not keep:
            shutil.rmtree(work, ignore_errors=True)
        raise


def promote(final_path: str) -> None:
    """Make a verified render the shipping artifact (+ a Desktop copy)."""
    shutil.copyfile(final_path, PRERENDERED)
    shutil.copyfile(final_path, os.path.join(HERE, "simply_scaled_reel.mp4"))
    desktop = os.path.expanduser("~/Desktop/simply_scaled_reel.mp4")
    try:
        shutil.copyfile(final_path, desktop)
    except OSError:
        pass
    log.info("promoted → %s", PRERENDERED)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=None, help="output dir (kept)")
    ap.add_argument("--keep", action="store_true")
    ap.add_argument("--promote", action="store_true",
                    help="copy the verified render over reel_prerendered.mp4")
    a = ap.parse_args()
    res = build_reel(out_dir=a.out, keep=True)
    print(json.dumps({k: v for k, v in res.items() if k != "verify"}, indent=2, default=str))
    print("VERIFY:", json.dumps(res["verify"], indent=2))
    print("FINAL:", res["output_path"])
    if a.promote:
        promote(res["output_path"])
        print("PROMOTED:", PRERENDERED)
