"""
Nesso Content Engine V22 — Video Concat + Audio Mix

4 segments: hook → story → demo → close (no morph, hard cuts between).
3 audio layers:
  1. Voiceover (story VO during story, demo VO during demo)
  2. Background music (15%/20% with/without VO, fade in/out)
  3. PSYCH sfx at hook → story cut
"""

from __future__ import annotations

import logging
import os
import subprocess

from config import (
    FFMPEG_PRESET,
    FFMPEG_THREADS,
    FFMPEG_TIMEOUT,
    FPS,
    HEIGHT,
    MUSIC_FADE_IN,
    MUSIC_FADE_OUT,
    MUSIC_VOLUME_NO_VO,
    MUSIC_VOLUME_WITH_VO,
    PSYCH_SFX_VOLUME,
    VOICEOVER_VOLUME,
    WIDTH,
)
from verify import get_duration

log = logging.getLogger(__name__)


def morph_and_concat(
    hook_video: str,
    story_video: str,
    demo_video: str,
    close_video: str,
    hook_dur: float,
    story_dur: float,
    demo_dur: float,
    close_dur: float,
    story_vo_path: str,
    demo_vo_path: str,
    music_path: str,
    psych_sfx_path: str,
    output_path: str,
    hook_vo_path: str = "",
    sfx_placements: list[dict] | None = None,
) -> str:
    temp_dir = os.path.dirname(output_path)

    # ── 1. Normalize (same codec/res/sar/fps) ─────────────────────────────
    segments = {
        "hook": hook_video,
        "story": story_video,
        "demo": demo_video,
        "close": close_video,
    }
    norm_paths = {}
    for name, path in segments.items():
        norm = os.path.join(temp_dir, f"norm_{name}.mp4")
        _normalize(path, norm)
        norm_paths[name] = norm

    # ── 2. Concat (no transitions — hard cuts; PSYCH sfx signals the beat) ─
    full_video = os.path.join(temp_dir, "full_v.mp4")
    _safe_concat(
        [norm_paths["hook"], norm_paths["story"], norm_paths["demo"], norm_paths["close"]],
        full_video,
    )

    for p in norm_paths.values():
        try:
            os.remove(p)
        except OSError:
            pass

    total_dur = get_duration(full_video)
    log.info("concat: %.1fs total", total_dur)

    # ── 3. Audio mix ──────────────────────────────────────────────────────
    audio_track = os.path.join(temp_dir, "full_audio.m4a")
    _build_audio(
        story_vo_path=story_vo_path,
        demo_vo_path=demo_vo_path,
        hook_vo_path=hook_vo_path,
        music_path=music_path,
        psych_sfx_path=psych_sfx_path,
        sfx_placements=sfx_placements or [],
        hook_dur=hook_dur,
        story_dur=story_dur,
        demo_dur=demo_dur,
        close_dur=close_dur,
        total_dur=total_dur,
        output_path=audio_track,
    )

    # ── 4. Mux ────────────────────────────────────────────────────────────
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-i", full_video,
        "-i", audio_track,
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        output_path,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    for f in [full_video, audio_track]:
        try:
            os.remove(f)
        except OSError:
            pass

    if proc.returncode != 0:
        raise RuntimeError(f"mux failed: {proc.stderr[-500:]}")

    log.info("assembled: %s (%.1fs)", output_path, get_duration(output_path))
    return output_path


def _normalize(input_path: str, output_path: str) -> str:
    """Re-encode to 1080x1920 / 30fps / yuv420p / H264 / no audio."""
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-i", input_path,
        "-vf",
        f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease,"
        f"pad={WIDTH}:{HEIGHT}:-1:-1:color=black,"
        f"fps={FPS},setsar=1:1",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", FFMPEG_PRESET,
        "-an",
        output_path,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if proc.returncode != 0:
        raise RuntimeError(f"normalize failed: {proc.stderr[-500:]}")
    return output_path


def _safe_concat(paths: list[str], output_path: str) -> str:
    temp_dir = os.path.dirname(output_path)
    concat_file = os.path.join(temp_dir, "concat.txt")
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
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    try:
        os.remove(concat_file)
    except OSError:
        pass
    if proc.returncode != 0:
        raise RuntimeError(f"concat failed: {proc.stderr[-500:]}")
    return output_path


def _build_audio(
    story_vo_path: str,
    demo_vo_path: str,
    music_path: str,
    psych_sfx_path: str,
    hook_dur: float,
    story_dur: float,
    demo_dur: float,
    close_dur: float,
    total_dur: float,
    output_path: str,
    hook_vo_path: str = "",
    sfx_placements: list[dict] | None = None,
) -> str:
    """
    Build the final audio track with up to 4 layers mixed together.

    Timeline (seconds):
      [0 .. hook_dur]:                silent (hook is typographic — just music fade-in at end)
      [hook_dur .. hook_dur+story_dur]: story VO + music
      [hook_dur+story_dur .. +demo_dur]: demo VO + music
      [close]:                        music fading out

    PSYCH sfx hits at hook_dur - 0.15s (slightly before the cut) to bridge segments.
    """
    story_start = hook_dur
    demo_start = hook_dur + story_dur

    has_story_vo = bool(story_vo_path) and os.path.exists(story_vo_path)
    has_demo_vo = bool(demo_vo_path) and os.path.exists(demo_vo_path)
    has_music = bool(music_path) and os.path.exists(music_path)
    has_psych = bool(psych_sfx_path) and os.path.exists(psych_sfx_path)

    music_vol = MUSIC_VOLUME_WITH_VO if (has_story_vo or has_demo_vo) else MUSIC_VOLUME_NO_VO

    inputs: list[str] = []
    filter_parts: list[str] = []
    mix_labels: list[str] = []
    idx = 0

    # Silent base layer so amix always has at least one input
    inputs.extend(["-f", "lavfi", "-t", f"{total_dur}", "-i", "anullsrc=r=44100:cl=stereo"])
    filter_parts.append(f"[{idx}:a]acopy[base_a]")
    mix_labels.append("[base_a]")
    idx += 1

    # Story VO
    if has_story_vo:
        inputs.extend(["-i", story_vo_path])
        delay_ms = int(story_start * 1000)
        filter_parts.append(
            f"[{idx}:a]volume={VOICEOVER_VOLUME},"
            f"afade=t=in:st=0:d=0.2,"
            f"adelay={delay_ms}|{delay_ms}[story_vo]"
        )
        mix_labels.append("[story_vo]")
        idx += 1

    # Demo VO
    if has_demo_vo:
        inputs.extend(["-i", demo_vo_path])
        delay_ms = int(demo_start * 1000)
        filter_parts.append(
            f"[{idx}:a]volume={VOICEOVER_VOLUME},"
            f"afade=t=in:st=0:d=0.15,"
            f"adelay={delay_ms}|{delay_ms}[demo_vo]"
        )
        mix_labels.append("[demo_vo]")
        idx += 1

    # Music — starts at hook_dur-0.8 (fade in over hook end), fades out during close
    if has_music:
        music_start = max(0, hook_dur - 0.8)
        music_dur = total_dur - music_start - 0.2
        fade_out_start = music_dur - MUSIC_FADE_OUT
        inputs.extend(["-i", music_path])
        delay_ms = int(music_start * 1000)
        filter_parts.append(
            f"[{idx}:a]volume={music_vol},"
            f"atrim=0:{music_dur:.2f},"
            f"afade=t=in:st=0:d={MUSIC_FADE_IN},"
            f"afade=t=out:st={fade_out_start:.2f}:d={MUSIC_FADE_OUT},"
            f"adelay={delay_ms}|{delay_ms}[music_a]"
        )
        mix_labels.append("[music_a]")
        idx += 1

    # PSYCH sfx — hits at hook_dur-0.15 (bridges into the story cut)
    if has_psych:
        inputs.extend(["-i", psych_sfx_path])
        psych_at = max(0, hook_dur - 0.15)
        delay_ms = int(psych_at * 1000)
        filter_parts.append(
            f"[{idx}:a]volume={PSYCH_SFX_VOLUME},"
            f"atrim=0:0.6,"
            f"adelay={delay_ms}|{delay_ms}[psych_a]"
        )
        mix_labels.append("[psych_a]")
        idx += 1

    # Hook voiceover (read the hook_line over the 2.5s segment)
    has_hook_vo = bool(hook_vo_path) and os.path.exists(hook_vo_path)
    if has_hook_vo:
        inputs.extend(["-i", hook_vo_path])
        filter_parts.append(
            f"[{idx}:a]volume={VOICEOVER_VOLUME},afade=t=in:st=0:d=0.15[hook_vo]"
        )
        mix_labels.append("[hook_vo]")
        idx += 1

    # SFX bus — each placement: {"path": str, "at": float_seconds, "volume": float}
    # Timed to frame-accurate moments in compositions (bubble pops, taps, whoosh, ticks).
    sfx_placements = sfx_placements or []
    sfx_idx = 0
    for pl in sfx_placements:
        path = pl.get("path")
        if not path or not os.path.exists(path):
            continue
        at = max(0.0, float(pl.get("at", 0.0)))
        if at >= total_dur:
            continue
        vol = float(pl.get("volume", 0.4))
        delay_ms = int(at * 1000)
        label = f"sfx_{sfx_idx}"
        inputs.extend(["-i", path])
        filter_parts.append(
            f"[{idx}:a]volume={vol},adelay={delay_ms}|{delay_ms}[{label}]"
        )
        mix_labels.append(f"[{label}]")
        idx += 1
        sfx_idx += 1

    if sfx_idx:
        log.info("sfx: placed %d hits", sfx_idx)

    mix_inputs = "".join(mix_labels)
    # Master bus: mix → limiter (prevents clipping when SFX + VO + music stack)
    # → slight -1.5dB pad so Telegram/TikTok don't clip their own normalization
    filter_parts.append(
        f"{mix_inputs}amix=inputs={len(mix_labels)}:duration=longest:normalize=0,"
        f"alimiter=level_in=1:level_out=0.88:limit=0.92:attack=5:release=50"
        f"[aout]"
    )
    filter_complex = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[aout]",
        "-c:a", "aac", "-b:a", "128k",
        "-t", f"{total_dur}",
        output_path,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if proc.returncode != 0:
        log.warning("audio mix failed, using silence: %s", proc.stderr[-400:])
        # Emergency silent track
        subprocess.run(
            [
                "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
                "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                "-t", f"{total_dur}",
                "-c:a", "aac", "-b:a", "128k",
                output_path,
            ],
            capture_output=True, text=True, timeout=FFMPEG_TIMEOUT,
        )
    return output_path
