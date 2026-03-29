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


def generate_ambient_music(output_path: str, duration: float = 60.0) -> str:
    """
    Generate ambient lo-fi background music using FFmpeg tone generators.
    Creates a pad sound with reverb that works well under voiceover.
    Uses two-pass approach: generate one chord cycle, then stream_loop to fill duration.
    """
    # Check for bundled music tracks first
    bundled = _try_bundled_music(output_path, duration)
    if bundled:
        return bundled

    progression = random.choice(CHORD_PROGRESSIONS)
    temp_dir = os.path.dirname(output_path)
    segment_path = os.path.join(temp_dir, "music_segment.mp3")

    # Each chord lasts 4 seconds for a natural progression
    chord_dur = 4.0

    # Generate one chord cycle as a segment
    filter_parts = []
    chord_labels = []

    for i, (f1, f2, f3) in enumerate(progression):
        label = f"chord{i}"
        filter_parts.append(
            f"sine=frequency={f1}:duration={chord_dur}[s{i}a];"
            f"sine=frequency={f2}:duration={chord_dur}[s{i}b];"
            f"sine=frequency={f3}:duration={chord_dur}[s{i}c];"
            f"sine=frequency={f1*1.002}:duration={chord_dur}[s{i}d];"
            f"[s{i}a][s{i}b][s{i}c][s{i}d]amix=inputs=4:normalize=0,"
            f"afade=t=in:d=0.5,afade=t=out:st={chord_dur-0.5}:d=0.5,"
            f"volume=0.15[{label}]"
        )
        chord_labels.append(f"[{label}]")

    concat_part = f"{''.join(chord_labels)}concat=n={len(progression)}:v=0:a=1[raw]"
    filter_parts.append(concat_part)

    # Add warmth to the segment (no looping here)
    filter_parts.append(
        "[raw]aecho=0.6:0.5:80|160:0.25|0.15,"
        "lowpass=f=500,volume=0.8[out]"
    )

    filter_complex = ";".join(filter_parts)

    # Step 1: Generate one cycle segment
    cmd1 = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-c:a", "libmp3lame", "-b:a", "128k",
        segment_path,
    ]

    result = subprocess.run(cmd1, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        log.warning("Music segment gen failed: %s", result.stderr[-200:])
        try:
            os.remove(segment_path)
        except OSError:
            pass
        return _generate_simple_ambient(output_path, duration)

    # Step 2: Loop segment to fill duration using -stream_loop (NOT aloop)
    cmd2 = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-stream_loop", "-1",
        "-i", segment_path,
        "-t", str(duration),
        "-af", f"afade=t=in:d=2,afade=t=out:st={duration-3}:d=3",
        "-c:a", "libmp3lame", "-b:a", "128k",
        output_path,
    ]

    result = subprocess.run(cmd2, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    # Cleanup segment
    try:
        os.remove(segment_path)
    except OSError:
        pass

    if result.returncode != 0:
        log.warning("Music loop failed: %s", result.stderr[-200:])
        return _generate_simple_ambient(output_path, duration)

    if verify_audio(output_path):
        log.info("Ambient music generated: %s (%.0fs)", output_path, duration)
        return output_path

    return _generate_simple_ambient(output_path, duration)


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
