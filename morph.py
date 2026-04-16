"""
Nesso Content Engine V21 — Video Assembly + Audio Mix

New 5-segment flow (NO black frames):
  [hook] → [story_part1] → [nesso_demo] → [story_part2] → [cta]

Audio layers:
  1. Hook original audio (full volume, fade out last 1.0s)
  2. PSYCH sfx at hook→story transition
  3. Story Part 1 voiceover (85% volume)
  4. Demo voiceover (85% volume)
  5. Story Part 2: no VO (text delays only — snappy resolution)
  6. Background music (12% with VO, 18% without, spans story+demo)
  7. iMessage send/receive SFX (first 3 messages of Part 1 only)
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


def morph_and_concat(
    hook_path: str,
    hook_audio_path: str,
    story1_path: str,
    demo_path: str,
    story2_path: str,
    cta_path: str,
    psych_sfx_path: str,
    music_path: str,
    output_path: str,
    story1_vo_path: str = "",
    demo_vo_path: str = "",
    message_timings: list[dict] | None = None,
) -> str:
    """
    Full 5-segment video assembly with multi-layer audio mix.
    NO black frames — direct cuts between segments.
    """
    hook_dur = get_duration(hook_path)
    story1_dur = get_duration(story1_path)
    demo_dur = get_duration(demo_path)
    story2_dur = get_duration(story2_path)
    cta_dur = get_duration(cta_path)

    if hook_dur <= 0 or story1_dur <= 0:
        raise RuntimeError(f"Invalid durations: hook={hook_dur}, story1={story1_dur}")

    log.info(
        "Assembly: hook=%.1fs, story1=%.1fs, demo=%.1fs, story2=%.1fs, cta=%.1fs",
        hook_dur, story1_dur, demo_dur, story2_dur, cta_dur,
    )

    temp_dir = os.path.dirname(output_path)

    # ── STEP 1: Normalize all video inputs ────────────────────────────────
    segments = {
        "hook": hook_path,
        "story1": story1_path,
        "demo": demo_path,
        "story2": story2_path,
        "cta": cta_path,
    }
    norm_paths = {}
    for name, path in segments.items():
        norm = os.path.join(temp_dir, f"norm_{name}.mp4")
        _normalize_video(path, norm)
        norm_paths[name] = norm

    # ── STEP 2: Concat all 5 segments (no black frames) ──────────────────
    full_video = os.path.join(temp_dir, "full_v.mp4")
    _safe_concat(
        [norm_paths["hook"], norm_paths["story1"], norm_paths["demo"],
         norm_paths["story2"], norm_paths["cta"]],
        full_video,
    )

    for p in norm_paths.values():
        try:
            os.remove(p)
        except OSError:
            pass

    actual_video_dur = get_duration(full_video)
    log.info("Full video (before audio): %.1fs", actual_video_dur)

    # ── STEP 3: Build audio track ─────────────────────────────────────────
    full_audio = os.path.join(temp_dir, "full_audio.m4a")
    _build_audio_track(
        hook_audio_path=hook_audio_path,
        psych_sfx_path=psych_sfx_path,
        music_path=music_path,
        story1_vo_path=story1_vo_path,
        demo_vo_path=demo_vo_path,
        hook_dur=hook_dur,
        story1_dur=story1_dur,
        demo_dur=demo_dur,
        story2_dur=story2_dur,
        cta_dur=cta_dur,
        output_path=full_audio,
        actual_video_dur=actual_video_dur,
        message_timings=message_timings,
    )

    # ── STEP 4: Mux video + audio ────────────────────────────────────────
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

    log.info("Assembly complete: %s (%.1fs)", output_path, get_duration(output_path))
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
    story1_vo_path: str,
    demo_vo_path: str,
    hook_dur: float,
    story1_dur: float,
    demo_dur: float,
    story2_dur: float,
    cta_dur: float,
    output_path: str,
    actual_video_dur: float = 0,
    message_timings: list[dict] | None = None,
) -> str:
    """
    Build multi-layer audio track for the 5-segment video.

    Timeline:
      [0, hook_dur]: hook audio
      [hook_dur, hook_dur+story1_dur]: story1 VO + music + iMsg SFX
      [hook_dur+story1_dur, hook_dur+story1_dur+demo_dur]: demo VO + music
      [hook_dur+story1_dur+demo_dur, ...+story2_dur]: music only (text delays)
      [..., +cta_dur]: silence/music fade
    """
    total_dur = actual_video_dur if actual_video_dur > 0 else (
        hook_dur + story1_dur + demo_dur + story2_dur + cta_dur
    )

    story1_start = hook_dur
    demo_start = hook_dur + story1_dur
    story2_start = demo_start + demo_dur
    music_start = max(0, story1_start - MUSIC_PRE_MORPH_OFFSET)

    has_story1_vo = story1_vo_path and os.path.exists(story1_vo_path)
    has_demo_vo = demo_vo_path and os.path.exists(demo_vo_path)
    effective_music_vol = MUSIC_VOLUME_WITH_VO if (has_story1_vo or has_demo_vo) else MUSIC_VOLUME_RATIO

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

    # Layer 2: PSYCH sfx at transition
    has_psych = psych_sfx_path and os.path.exists(psych_sfx_path)
    if has_psych:
        inputs.extend(["-i", psych_sfx_path])
        psych_delay_ms = int((hook_dur - 0.2) * 1000)
        filter_parts.append(
            f"[{stream_idx}:a]volume=1.5,adelay={psych_delay_ms}|{psych_delay_ms}[psych_a]"
        )
        stream_idx += 1

    # Layer 3: Story Part 1 voiceover
    if has_story1_vo:
        inputs.extend(["-i", story1_vo_path])
        vo1_delay_ms = int(story1_start * 1000)
        filter_parts.append(
            f"[{stream_idx}:a]volume={VOICEOVER_VOLUME},"
            f"afade=t=in:st=0:d=0.3,"
            f"adelay={vo1_delay_ms}|{vo1_delay_ms}[vo1_a]"
        )
        stream_idx += 1

    # Layer 4: Demo voiceover
    if has_demo_vo:
        inputs.extend(["-i", demo_vo_path])
        demo_delay_ms = int(demo_start * 1000)
        filter_parts.append(
            f"[{stream_idx}:a]volume={VOICEOVER_VOLUME},"
            f"adelay={demo_delay_ms}|{demo_delay_ms}[demo_vo_a]"
        )
        stream_idx += 1

    # Layer 5: Background music (spans story1 + demo + story2)
    has_music = music_path and os.path.exists(music_path)
    if has_music:
        inputs.extend(["-i", music_path])
        music_delay_ms = int(music_start * 1000)
        music_dur = story1_dur + demo_dur + story2_dur + cta_dur
        fade_start = max(0, music_dur - 2)
        filter_parts.append(
            f"[{stream_idx}:a]volume={effective_music_vol},"
            f"atrim=0:{music_dur},"
            f"afade=t=in:st=0:d=1,afade=t=out:st={fade_start}:d=2,"
            f"adelay={music_delay_ms}|{music_delay_ms}[music_a]"
        )
        stream_idx += 1

    # Layer 6: iMessage SFX (first N messages of Part 1 only)
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

            msg_time_ms = int((story1_start + mt.get("cumulative_time", 0)) * 1000)
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
    if has_story1_vo:
        mix_inputs += "[vo1_a]"
        mix_count += 1
    if has_demo_vo:
        mix_inputs += "[demo_vo_a]"
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
