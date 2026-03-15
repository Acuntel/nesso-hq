"""
Nesso Content Engine V20 — Morph Transition (Wants and Needs Style)

The PSYCH sound effect plays at the exact frame where the hook ends
and the text story begins. Uses FFmpeg xfade for seamless visual morph.
"""

import logging
import os
import subprocess

from config import (
    FFMPEG_PRESET,
    FFMPEG_THREADS,
    FFMPEG_TIMEOUT,
    FPS,
    MORPH_DURATION,
    MORPH_TRANSITION,
    MUSIC_VOLUME_RATIO,
)
from verify import get_duration

log = logging.getLogger(__name__)


def morph_and_concat(
    hook_path: str,
    hook_audio_path: str,
    story_path: str,
    reveal_path: str,
    psych_sfx_path: str,
    music_path: str,
    output_path: str,
) -> str:
    """
    Full video assembly with morph transition:
    Hook (with audio) → MORPH (psych sfx) → Story (with music) → Reveal → Black screen

    Audio layers:
    1. Hook original audio (full volume) during hook
    2. PSYCH sfx at morph point (overlaps 0.2s on each side)
    3. Lo-fi music during text story (15-20% volume)
    4. Silence/fade during reveal
    """
    hook_dur = get_duration(hook_path)
    story_dur = get_duration(story_path)
    reveal_dur = get_duration(reveal_path)

    if hook_dur <= 0 or story_dur <= 0:
        raise RuntimeError(f"Invalid durations: hook={hook_dur}, story={story_dur}")

    temp_dir = os.path.dirname(output_path)

    # ── STEP 1: Morph hook → story using xfade ─────────────────────────
    morph_offset = max(0, hook_dur - MORPH_DURATION / 2)
    morphed_video = os.path.join(temp_dir, "morphed_v.mp4")

    xfade_cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-i", hook_path,
        "-i", story_path,
        "-filter_complex",
        (
            f"[0:v]setpts=PTS-STARTPTS[v0];"
            f"[1:v]setpts=PTS-STARTPTS[v1];"
            f"[v0][v1]xfade=transition={MORPH_TRANSITION}:"
            f"duration={MORPH_DURATION}:offset={morph_offset}[vout]"
        ),
        "-map", "[vout]",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", FFMPEG_PRESET,
        morphed_video,
    ]

    result = subprocess.run(xfade_cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        log.warning("xfade failed, falling back to simple concat: %s", result.stderr[-300:])
        morphed_video = _simple_concat_video(hook_path, story_path, morphed_video)

    # ── STEP 2: Concat morphed + reveal ────────────────────────────────
    full_video = os.path.join(temp_dir, "full_v.mp4")
    _concat_with_reveal(morphed_video, reveal_path, full_video)

    # Clean intermediate
    try:
        os.remove(morphed_video)
    except OSError:
        pass

    # ── STEP 3: Build audio track ──────────────────────────────────────
    full_audio = os.path.join(temp_dir, "full_audio.m4a")
    _build_audio_track(
        hook_audio_path=hook_audio_path,
        psych_sfx_path=psych_sfx_path,
        music_path=music_path,
        hook_dur=hook_dur,
        story_dur=story_dur,
        reveal_dur=reveal_dur,
        morph_dur=MORPH_DURATION,
        output_path=full_audio,
    )

    # ── STEP 4: Mux video + audio ─────────────────────────────────────
    video_dur = get_duration(full_video)
    mux_cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-i", full_video,
        "-i", full_audio,
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        "-preset", FFMPEG_PRESET,
        output_path,
    ]

    result = subprocess.run(mux_cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    # Clean intermediates
    for f in [full_video, full_audio]:
        try:
            os.remove(f)
        except OSError:
            pass

    if result.returncode != 0:
        raise RuntimeError(f"Mux failed: {result.stderr[-500:]}")

    log.info("Morph + concat complete: %s (%.1fs)", output_path, get_duration(output_path))
    return output_path


def _simple_concat_video(path_a: str, path_b: str, output_path: str) -> str:
    """Simple video concatenation fallback (no xfade)."""
    temp_dir = os.path.dirname(output_path)
    concat_file = os.path.join(temp_dir, "morph_concat.txt")

    with open(concat_file, "w") as f:
        f.write(f"file '{path_a}'\n")
        f.write(f"file '{path_b}'\n")

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", FFMPEG_PRESET,
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    try:
        os.remove(concat_file)
    except OSError:
        pass

    if result.returncode != 0:
        raise RuntimeError(f"Simple concat failed: {result.stderr[-500:]}")

    return output_path


def _concat_with_reveal(video_path: str, reveal_path: str, output_path: str) -> str:
    """Concatenate the morphed video with the reveal sequence."""
    temp_dir = os.path.dirname(output_path)
    concat_file = os.path.join(temp_dir, "reveal_concat.txt")

    with open(concat_file, "w") as f:
        f.write(f"file '{video_path}'\n")
        f.write(f"file '{reveal_path}'\n")

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", FFMPEG_PRESET,
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    try:
        os.remove(concat_file)
    except OSError:
        pass

    if result.returncode != 0:
        raise RuntimeError(f"Reveal concat failed: {result.stderr[-500:]}")

    return output_path


def _build_audio_track(
    hook_audio_path: str,
    psych_sfx_path: str,
    music_path: str,
    hook_dur: float,
    story_dur: float,
    reveal_dur: float,
    morph_dur: float,
    output_path: str,
) -> str:
    """
    Build the complete audio track:
    - Hook audio at full volume (0 → hook_dur)
    - PSYCH sfx at morph point
    - Background music during story at low volume
    - Fade out during reveal
    """
    total_dur = hook_dur + story_dur + reveal_dur - morph_dur
    music_start = hook_dur - morph_dur / 2
    music_end = music_start + story_dur

    # Build filter_complex for audio mixing
    inputs = []
    filter_parts = []
    stream_idx = 0

    # Hook audio
    has_hook_audio = hook_audio_path and os.path.exists(hook_audio_path)
    if has_hook_audio:
        inputs.extend(["-i", hook_audio_path])
        filter_parts.append(
            f"[{stream_idx}:a]atrim=0:{hook_dur},asetpts=PTS-STARTPTS,"
            f"afade=t=out:st={hook_dur - 0.3}:d=0.3[hook_a]"
        )
        stream_idx += 1
    else:
        # Generate silence for hook duration
        filter_parts.append(
            f"anullsrc=r=44100:cl=stereo[hook_null];"
            f"[hook_null]atrim=0:{hook_dur}[hook_a]"
        )

    # PSYCH sfx
    has_psych = psych_sfx_path and os.path.exists(psych_sfx_path)
    if has_psych:
        inputs.extend(["-i", psych_sfx_path])
        psych_delay_ms = int((hook_dur - 0.2) * 1000)
        filter_parts.append(
            f"[{stream_idx}:a]volume=1.5,adelay={psych_delay_ms}|{psych_delay_ms}[psych_a]"
        )
        stream_idx += 1

    # Background music
    has_music = music_path and os.path.exists(music_path)
    if has_music:
        inputs.extend(["-i", music_path])
        music_delay_ms = int(music_start * 1000)
        fade_start = story_dur - 2
        filter_parts.append(
            f"[{stream_idx}:a]volume={MUSIC_VOLUME_RATIO},"
            f"atrim=0:{story_dur + reveal_dur},"
            f"afade=t=in:st=0:d=1,afade=t=out:st={fade_start}:d=2,"
            f"adelay={music_delay_ms}|{music_delay_ms}[music_a]"
        )
        stream_idx += 1

    # Mix all audio streams
    mix_inputs = "[hook_a]"
    mix_count = 1
    if has_psych:
        mix_inputs += "[psych_a]"
        mix_count += 1
    if has_music:
        mix_inputs += "[music_a]"
        mix_count += 1

    filter_parts.append(
        f"{mix_inputs}amix=inputs={mix_count}:duration=longest:normalize=0[aout]"
    )

    filter_complex = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[aout]",
        "-c:a", "aac", "-b:a", "128k",
        "-t", str(total_dur),
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        log.warning("Audio mix failed, generating silent track: %s", result.stderr[-300:])
        # Fallback: silent audio
        cmd_silent = [
            "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
            "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo",
            "-t", str(total_dur),
            "-c:a", "aac", "-b:a", "128k",
            output_path,
        ]
        subprocess.run(cmd_silent, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    return output_path
