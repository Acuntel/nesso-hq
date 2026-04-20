"""
Nesso Content Engine V20 — Background Music & SFX Generation

Generates ambient lo-fi music and sound effects using FFmpeg.
No YouTube/yt-dlp dependency — everything is created locally.
"""

import logging
import os
import random
import subprocess

from config import (
    FFMPEG_THREADS,
    FFMPEG_TIMEOUT,
    PSYCH_SFX_PATH,
)
from verify import verify_audio

log = logging.getLogger(__name__)

# ── Ambient chord progressions (frequencies in Hz) ──────────────────────
# Each progression is a list of 3-note chords that loop nicely.
CHORD_PROGRESSIONS = [
    # Am - F - C - G (emotional pop progression)
    [(220, 277, 330), (175, 220, 262), (262, 330, 392), (196, 247, 294)],
    # Dm - Bb - F - C (melancholic)
    [(147, 175, 220), (117, 147, 175), (175, 220, 262), (131, 165, 196)],
    # Em - C - G - D (nostalgic)
    [(165, 196, 247), (131, 165, 196), (196, 247, 294), (147, 175, 220)],
    # Am - Em - F - G (lo-fi classic)
    [(110, 131, 165), (165, 196, 247), (175, 220, 262), (196, 247, 294)],
    # Cm - Ab - Eb - Bb (cinematic)
    [(131, 156, 196), (104, 131, 156), (156, 196, 233), (117, 147, 175)],
]

# ── Bundled Music Tracks ──────────────────────────────────────────────────
BUNDLED_MUSIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "music")


def _try_bundled_music(output_path: str, duration: float) -> str:
    """
    Try to use a bundled royalty-free lo-fi track from assets/music/.
    Returns output_path if successful, empty string if no tracks available.
    """
    if not os.path.isdir(BUNDLED_MUSIC_DIR):
        return ""

    tracks = [
        f for f in os.listdir(BUNDLED_MUSIC_DIR)
        if f.endswith((".mp3", ".m4a", ".wav", ".ogg"))
    ]
    if not tracks:
        return ""

    chosen = random.choice(tracks)
    track_path = os.path.join(BUNDLED_MUSIC_DIR, chosen)

    # Trim/loop to requested duration and add fades
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-stream_loop", "-1",
        "-i", track_path,
        "-t", str(duration),
        "-af", f"afade=t=in:d=1,afade=t=out:st={max(0, duration-3)}:d=3",
        "-c:a", "libmp3lame", "-b:a", "128k",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode == 0 and verify_audio(output_path):
        log.info("Using bundled music track: %s", chosen)
        return output_path

    log.warning("Bundled track failed, falling back to synthesis")
    return ""


# ── Nesso signature progression ──────────────────────────────────────────
# One progression every video. Consistency = brand recognition.
# Am → F → C → G — timeless, emotional, resolves optimistically on the last chord.
# 80 BPM, 4 beats/bar, 1 bar/chord → 3.0s/chord, 12.0s/cycle. Loop to target.
SIG_BPM = 80
SIG_BEAT_S = 60.0 / SIG_BPM   # 0.75s
SIG_BAR_S = SIG_BEAT_S * 4    # 3.0s
SIG_CYCLE_S = SIG_BAR_S * 4   # 12.0s

# Signature chord progression. Each entry is (bass_hz, pad_triad_hz_tuple).
SIG_PROGRESSION = [
    (110.00, (220.00, 261.63, 329.63)),  # Am  (A2 / A3 C4 E4)
    ( 87.31, (174.61, 220.00, 261.63)),  # F   (F2 / F3 A3 C4)
    (130.81, (261.63, 329.63, 392.00)),  # C   (C3 / C4 E4 G4)
    ( 98.00, (196.00, 246.94, 293.66)),  # G   (G2 / G3 B3 D4)
]


def generate_ambient_music(output_path: str, duration: float = 60.0) -> str:
    """
    Nesso signature lo-fi bed. One progression (Am-F-C-G), 80 BPM, layered:
      - Sub-bass (one note per chord, soft envelope)
      - Pad (triad, slightly detuned for warmth, tremolo for movement)
      - Soft hi-hat tick on every beat (high-passed noise, very low volume)
    All layers mixed through a reverb tail and a tape-warp lowpass.
    """
    # If user drops real tracks into assets/music/, prefer those
    bundled = _try_bundled_music(output_path, duration)
    if bundled:
        return bundled

    temp_dir = os.path.dirname(output_path)
    segment_path = os.path.join(temp_dir, "music_cycle.mp3")

    if not _generate_signature_cycle(segment_path):
        return _generate_simple_ambient(output_path, duration)

    # Loop the 12s cycle to fill duration, with outer fade in/out
    cmd_loop = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-stream_loop", "-1",
        "-i", segment_path,
        "-t", f"{duration}",
        "-af", f"afade=t=in:d=2,afade=t=out:st={max(0, duration-3):.2f}:d=3",
        "-c:a", "libmp3lame", "-b:a", "128k",
        output_path,
    ]
    result = subprocess.run(cmd_loop, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    try:
        os.remove(segment_path)
    except OSError:
        pass

    if result.returncode != 0 or not verify_audio(output_path):
        log.warning("music loop failed, using simple fallback")
        return _generate_simple_ambient(output_path, duration)

    log.info("Signature lo-fi bed generated: %s (%.0fs)", output_path, duration)
    return output_path


def _generate_signature_cycle(output_path: str) -> bool:
    """Generate ONE 12-second cycle of the signature progression."""
    filter_parts: list[str] = []
    chord_labels: list[str] = []

    # Build each chord's local mix (bass + detuned triad)
    for i, (bass, triad) in enumerate(SIG_PROGRESSION):
        cd = SIG_BAR_S  # chord duration
        f1, f2, f3 = triad

        # Bass: soft envelope at beat 1 of the bar
        filter_parts.append(
            # Bass pluck: sine with fast attack, slow decay across the bar
            f"aevalsrc='sin(2*PI*{bass}*t)*exp(-t*1.2)':d={cd}[b{i}];"
            # Pad voices (detuned slightly for warmth)
            f"sine=frequency={f1}:duration={cd}[p{i}a];"
            f"sine=frequency={f1*1.003}:duration={cd}[p{i}a2];"
            f"sine=frequency={f2}:duration={cd}[p{i}b];"
            f"sine=frequency={f3}:duration={cd}[p{i}c];"
            # Mix pad voices, apply lowpass for warmth + chord fade in/out
            f"[p{i}a][p{i}a2][p{i}b][p{i}c]amix=inputs=4:normalize=0,"
            f"lowpass=f=1100,"
            f"afade=t=in:d=0.25,afade=t=out:st={cd-0.35:.2f}:d=0.35,"
            f"volume=0.18[pad{i}];"
            # Mix bass with pad
            f"[pad{i}][b{i}]amix=inputs=2:normalize=0[chord{i}]"
        )
        chord_labels.append(f"[chord{i}]")

    # Concat 4 chords → 12s cycle
    filter_parts.append(
        f"{''.join(chord_labels)}concat=n={len(SIG_PROGRESSION)}:v=0:a=1[chords]"
    )

    # Hi-hat ticks — high-passed noise burst on each beat (16 beats total)
    # We overlay a sparse rhythmic tick across the cycle.
    hat_parts = []
    for beat in range(int(SIG_CYCLE_S / SIG_BEAT_S)):
        at = beat * SIG_BEAT_S
        # Shorter blip at odd beats for groove
        is_downbeat = (beat % 4) == 0
        dur = 0.05 if is_downbeat else 0.03
        vol = 0.12 if is_downbeat else 0.06
        hat_parts.append(
            f"aevalsrc='random(0)*exp(-t*70)':d={dur}[h{beat}]"
        )
        filter_parts.append(
            f"aevalsrc='random(0)*exp(-t*70)':d={dur},"
            f"highpass=f=4500,volume={vol},"
            f"adelay={int(at*1000)}|{int(at*1000)}[hat{beat}]"
        )

    hat_labels = "".join(f"[hat{b}]" for b in range(int(SIG_CYCLE_S / SIG_BEAT_S)))
    filter_parts.append(
        f"{hat_labels}amix=inputs={int(SIG_CYCLE_S / SIG_BEAT_S)}:normalize=0[hats]"
    )

    # Final bus: chords + hats → reverb → tape-warp lowpass
    filter_parts.append(
        "[chords][hats]amix=inputs=2:normalize=0,"
        "aecho=0.7:0.4:120|220:0.3|0.18,"
        "lowpass=f=2400,"
        "volume=0.75[out]"
    )

    filter_complex = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-t", f"{SIG_CYCLE_S}",
        "-c:a", "libmp3lame", "-b:a", "160k",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        log.warning("signature cycle failed: %s", result.stderr[-400:])
        return False
    return verify_audio(output_path)


def _generate_simple_ambient(output_path: str, duration: float) -> str:
    """
    Ultra-simple ambient fallback: just a warm sine pad with echo.
    Cannot fail (uses only basic FFmpeg features).
    """
    freq = random.choice([174, 196, 220, 262])  # Musical frequencies

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "lavfi", "-i", f"sine=frequency={freq}:duration={duration}",
        "-f", "lavfi", "-i", f"sine=frequency={freq * 1.5}:duration={duration}",
        "-filter_complex",
        (
            f"[0][1]amix=inputs=2:normalize=0,"
            f"lowpass=f=400,"
            f"aecho=0.6:0.4:100:0.3,"
            f"afade=t=in:d=2,afade=t=out:st={duration-3}:d=3,"
            f"volume=0.2[out]"
        ),
        "-map", "[out]",
        "-t", str(duration),
        "-c:a", "libmp3lame", "-b:a", "128k",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        log.warning("Simple ambient also failed: %s", result.stderr[-200:])
        return ""

    log.info("Simple ambient music generated: %s", output_path)
    return output_path


def download_background_music(
    output_path: str,
    max_duration: float = 60.0,
    exclude_queries: list[str] | None = None,
) -> str:
    """
    Generate background music for the video.
    Uses FFmpeg synthesis — no external downloads needed.
    """
    return generate_ambient_music(output_path, duration=max_duration)


def download_psych_sfx(output_path: str) -> str:
    """
    Get the PSYCH sound effect.
    It's bundled in assets/ — if missing, generate with FFmpeg.
    """
    # Check if bundled SFX exists
    if os.path.exists(PSYCH_SFX_PATH) and verify_audio(PSYCH_SFX_PATH):
        # Copy to output path if different
        if os.path.abspath(output_path) != os.path.abspath(PSYCH_SFX_PATH):
            import shutil
            shutil.copy2(PSYCH_SFX_PATH, output_path)
        return output_path

    # Generate a bass-drop whoosh effect
    log.info("Generating PSYCH SFX with FFmpeg...")
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "lavfi", "-i", "sine=frequency=55:duration=1.5",
        "-af", (
            "volume=4,afade=t=in:d=0.02,afade=t=out:st=0.3:d=1.2,"
            "aecho=0.8:0.6:30:0.4,lowpass=f=180,volume=2"
        ),
        "-c:a", "libmp3lame", "-b:a", "192k",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        log.warning("PSYCH SFX generation failed: %s", result.stderr[-200:])
        return ""

    if verify_audio(output_path):
        log.info("PSYCH SFX generated: %s", output_path)
        return output_path

    return ""
