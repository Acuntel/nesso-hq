"""
Nesso Content Engine V21 — Morph Transition + Audio Mix

Simple concat approach: hook → black frame → story → black frame → reveal
Reliable on all FFmpeg versions. No xfade dependency.

Timeline (video):
  [0, hook_dur] hook
  [hook_dur, hook_dur+0.3] black frame
  [hook_dur+0.3, hook_dur+0.3+story_dur] story
  [hook_dur+0.3+story_dur, hook_dur+0.6+story_dur] black frame
  [hook_dur+0.6+story_dur, hook_dur+0.6+story_dur+reveal_dur] reveal
"""

import logging
import os
import subprocess

from config import (
    FFMPEG_PRESET,
    FFMPEG_THREADS,
    FFMPEG_TIMEOUT,
    FPS,
    HEIGHT,
    HOOK_AUDIO_FADEOUT,
    IMESSAGE_RECV_SFX,
    IMESSAGE_SEND_SFX,
    IMESSAGE_SFX_FADE_AFTER,
    IMESSAGE_SFX_VOLUME,
    MUSIC_PRE_MORPH_OFFSET,
    MUSIC_VOLUME_RATIO,
    MUSIC_VOLUME_WITH_VO,
    VOICEOVER_VOLUME,
    WIDTH,
)
from verify import get_duration

log = logging.getLogger(__name__)

# Duration of the black transition frame between segments (must match _safe_concat usage)
BLACK_FRAME_DUR = 0.3


def morph_and_concat(
    hook_path: str,
    hook_audio_path: str,
    story_path: str,
    reveal_path: str,
    psych_sfx_path: str,
    music_path: str,
    output_path: str,
    voiceover_path: str = "",
    message_timings: list[dict] | None = None,
) -> str:
    """
    Full video assembly:
    Hook → black frame → Story → black frame → Reveal

    Audio layers (5-layer mix):
    1. Hook original audio (full volume, fade out last 1.0s)
    2. PSYCH sfx at morph point
    3. Voiceover during text story (85% volume)
    4. Lo-fi music (12% with VO, 18% without, starts 1.0s before morph)
    5. iMessage send/receive SFX (first 3 messages only)
    """
    hook_dur = get_duration(hook_path)
    story_dur = get_duration(story_path)
    reveal_dur = get_duration(reveal_path)

    if hook_dur <= 0 or story_dur <= 0:
        raise RuntimeError(f"Invalid durations: hook={hook_dur}, story={story_dur}")

    log.info(
        "Assembly: hook=%.1fs, story=%.1fs, reveal=%.1fs",
        hook_dur, story_dur, reveal_dur,
    )

    temp_dir = os.path.dirname(output_path)

    # ── STEP 1: Normalize all inputs ──────────────────────────────────
    norm_hook = os.path.join(temp_dir, "norm_hook.mp4")
    norm_story = os.path.join(temp_dir, "norm_story.mp4")
    _normalize_video(hook_path, norm_hook)
    _normalize_video(story_path, norm_story)

    # Create a short black frame for transitions (0.3s — short enough to not lose viewers)
    black_frame = os.path.join(temp_dir, "black_transition.mp4")
    black_cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "lavfi", "-i",
        f"color=c=black:s={WIDTH}x{HEIGHT}:r={FPS}:d=0.3",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-preset", FFMPEG_PRESET,
        black_frame,
    ]
    subprocess.run(black_cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    # Concat: hook → black → story
    morphed_video = os.path.join(temp_dir, "morphed_v.mp4")
    _safe_concat([norm_hook, black_frame, norm_story], morphed_video)
    log.info("Morph: hook → black → story")

    for f in [norm_hook, norm_story]:
        try:
            os.remove(f)
        except OSError:
            pass

    # ── STEP 2: Concat morphed + reveal ────────────────────────────────
    full_video = os.path.join(temp_dir, "full_v.mp4")
    norm_reveal = os.path.join(temp_dir, "norm_reveal.mp4")
    _normalize_video(reveal_path, norm_reveal)
    _safe_concat([morphed_video, black_frame, norm_reveal], full_video)
    for f in [norm_reveal, black_frame]:
        try:
            os.remove(f)
        except OSError:
            pass

    actual_video_dur = get_duration(full_video)
    log.info("Full video (before audio): %.1fs", actual_video_dur)

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
        voiceover_path=voiceover_path,
        hook_dur=hook_dur,
        story_dur=story_dur,
        reveal_dur=reveal_dur,
        output_path=full_audio,
        actual_video_dur=actual_video_dur,
        message_timings=message_timings,
    )

    # ── STEP 4: Mux video + audio ─────────────────────────────────────
    mux_cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-i", full_video,
        "-i", full_audio,
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "128k",
        "-t", str(actual_video_dur),
        output_path,
    ]

    result = subprocess.run(mux_cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    for f in [full_video, full_audio]:
        try:
            os.remove(f)
        except OSError:
            pass

    if result.returncode != 0:
        raise RuntimeError(f"Mux failed: {result.stderr[-500:]}")

    log.info("Morph + concat complete: %s (%.1fs)", output_path, get_duration(output_path))
    return output_path


def _normalize_video(input_path: str, output_path: str) -> str:
    """Re-encode to exactly 1080x1920, 30fps, yuv420p, libx264."""
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-i", input_path,
        "-vf", (
            f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease,"
            f"pad={WIDTH}:{HEIGHT}:-1:-1:color=black,"
            f"fps={FPS},setsar=1:1"
        ),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", FFMPEG_PRESET,
        "-an",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        raise RuntimeError(f"Normalize failed: {result.stderr[-500:]}")
    return output_path


def _safe_concat(paths: list[str], output_path: str) -> str:
    """Concatenate normalized videos using -c copy."""
    temp_dir = os.path.dirname(output_path)
    concat_file = os.path.join(temp_dir, "safe_concat.txt")

    with open(concat_file, "w") as f:
        for p in paths:
            safe = p.replace("'", "'\\''")
            f.write(f"file '{safe}'\n")

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-c", "copy",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    try:
        os.remove(concat_file)
    except OSError:
        pass

    if result.returncode != 0:
        raise RuntimeError(f"Safe concat failed: {result.stderr[-500:]}")

    return output_path


def _build_audio_track(
    hook_audio_path: str,
    psych_sfx_path: str,
    music_path: str,
    voiceover_path: str,
    hook_dur: float,
    story_dur: float,
    reveal_dur: float,
    output_path: str,
    actual_video_dur: float = 0,
    message_timings: list[dict] | None = None,
) -> str:
    """
    Build the complete 5-layer audio track:
    1. Hook audio (full volume, fade out last 1.0s)
    2. PSYCH sfx at morph point
    3. Voiceover during story (85% volume)
    4. Background music (12% with VO, 18% without, starts 1.0s before morph)
    5. iMessage send/receive SFX (first 3 messages)
    """
    # V21 concat timeline: hook + black(0.3) + story + black(0.3) + reveal
    calculated_dur = hook_dur + BLACK_FRAME_DUR + story_dur + BLACK_FRAME_DUR + reveal_dur
    total_dur = actual_video_dur if actual_video_dur > 0 else calculated_dur
    if actual_video_dur > 0 and abs(actual_video_dur - calculated_dur) > 0.5:
        log.info(
            "Audio track using actual video dur %.1fs (calculated was %.1fs)",
            actual_video_dur, calculated_dur,
        )

    # Story visuals start after hook + black frame gap
    story_start = hook_dur + BLACK_FRAME_DUR
    # Music bridges the transition — starts before story visuals appear
    music_start = max(0, story_start - MUSIC_PRE_MORPH_OFFSET)

    has_voiceover = voiceover_path and os.path.exists(voiceover_path)
    effective_music_vol = MUSIC_VOLUME_WITH_VO if has_voiceover else MUSIC_VOLUME_RATIO

    inputs = []
    filter_parts = []
    stream_idx = 0

    # Layer 1: Hook audio
    has_hook_audio = hook_audio_path and os.path.exists(hook_audio_path)
    if has_hook_audio:
        inputs.extend(["-i", hook_audio_path])
        filter_parts.append(
            f"[{stream_idx}:a]atrim=0:{hook_dur},asetpts=PTS-STARTPTS,"
            f"afade=t=out:st={hook_dur - HOOK_AUDIO_FADEOUT}:d={HOOK_AUDIO_FADEOUT}[hook_a]"
        )
        stream_idx += 1
    else:
        filter_parts.append(
            f"anullsrc=r=44100:cl=stereo[hook_null];"
            f"[hook_null]atrim=0:{hook_dur}[hook_a]"
        )

    # Layer 2: PSYCH sfx
    has_psych = psych_sfx_path and os.path.exists(psych_sfx_path)
    if has_psych:
        inputs.extend(["-i", psych_sfx_path])
        psych_delay_ms = int((hook_dur - 0.2) * 1000)
        filter_parts.append(
            f"[{stream_idx}:a]volume=1.5,adelay={psych_delay_ms}|{psych_delay_ms}[psych_a]"
        )
        stream_idx += 1

    # Layer 3: Voiceover — starts when story visuals begin (after black frame)
    if has_voiceover:
        inputs.extend(["-i", voiceover_path])
        vo_delay_ms = int(story_start * 1000)
        filter_parts.append(
            f"[{stream_idx}:a]volume={VOICEOVER_VOLUME},"
            f"afade=t=in:st=0:d=0.3,"
            f"adelay={vo_delay_ms}|{vo_delay_ms}[vo_a]"
        )
        stream_idx += 1

    # Layer 4: Background music
    has_music = music_path and os.path.exists(music_path)
    if has_music:
        inputs.extend(["-i", music_path])
        music_delay_ms = int(music_start * 1000)
        fade_start = story_dur - 2
        filter_parts.append(
            f"[{stream_idx}:a]volume={effective_music_vol},"
            f"atrim=0:{story_dur + reveal_dur},"
            f"afade=t=in:st=0:d=1,afade=t=out:st={fade_start}:d=2,"
            f"adelay={music_delay_ms}|{music_delay_ms}[music_a]"
        )
        stream_idx += 1

    # Layer 5: iMessage send/receive SFX (first N messages only)
    has_send_sfx = os.path.exists(IMESSAGE_SEND_SFX)
    has_recv_sfx = os.path.exists(IMESSAGE_RECV_SFX)
    imsg_labels = []

    if message_timings and (has_send_sfx or has_recv_sfx):
        sfx_count = 0
        for mt in message_timings:
            if sfx_count >= IMESSAGE_SFX_FADE_AFTER:
                break
            if mt.get("sender") == "system":
                continue

            is_me = mt.get("sender") == "me"
            sfx_path = IMESSAGE_SEND_SFX if is_me else IMESSAGE_RECV_SFX
            if not os.path.exists(sfx_path):
                continue

            msg_time_ms = int((story_start + mt.get("cumulative_time", 0)) * 1000)
            label = f"imsg_{sfx_count}"

            inputs.extend(["-i", sfx_path])
            filter_parts.append(
                f"[{stream_idx}:a]volume={IMESSAGE_SFX_VOLUME},"
                f"adelay={msg_time_ms}|{msg_time_ms}[{label}]"
            )
            imsg_labels.append(f"[{label}]")
            stream_idx += 1
            sfx_count += 1

    # Mix all layers
    mix_inputs = "[hook_a]"
    mix_count = 1
    if has_psych:
        mix_inputs += "[psych_a]"
        mix_count += 1
    if has_voiceover:
        mix_inputs += "[vo_a]"
        mix_count += 1
    if has_music:
        mix_inputs += "[music_a]"
        mix_count += 1
    for label in imsg_labels:
        mix_inputs += label
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
        cmd_silent = [
            "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            "-t", str(total_dur),
            "-c:a", "aac", "-b:a", "128k",
            output_path,
        ]
        subprocess.run(cmd_silent, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    return output_path
