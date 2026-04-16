"""
Nesso Content Engine V21 — Full Render Pipeline Orchestrator

New flow:
  hook → text_story_part1 → nesso_demo → text_story_part2 → cta

The Nesso demo is woven INTO the story — Part 1 builds tension,
the demo shows the app intervening, Part 2 shows the resolution.
"""

import logging
import os
import shutil
import subprocess
import time
import uuid

from config import (
    ASSETS_DIR,
    PSYCH_SFX_PATH,
    TEMP_DIR,
    WIDTH,
    HEIGHT,
    FFMPEG_PRESET,
    FFMPEG_THREADS,
    FFMPEG_TIMEOUT,
    get_hook_category,
    get_random_hook_query,
    generate_tiktok_caption,
    generate_ig_caption,
    generate_ig_pin_comment,
)
from analytics import log_render
from hooks import get_full_hook
from morph import morph_and_concat
from music import download_background_music, download_psych_sfx
from renderer import compile_frames_to_video, render_text_story_frames
from reveal import render_nesso_demo, render_cta
from scripts import generate_text_story
from verify import get_duration, verify_clip
from voiceover import generate_voiceover

log = logging.getLogger(__name__)


def cleanup_temp_files(directory: str, keep_files: list[str] | None = None):
    """Aggressively clean temp files after each render step."""
    keep = set(keep_files or [])
    for f in os.listdir(directory):
        path = os.path.join(directory, f)
        if path not in keep and f.endswith((".mp4", ".mp3", ".m4a", ".wav", ".png", ".txt")):
            try:
                os.remove(path)
            except OSError:
                pass


def ensure_psych_sfx() -> str:
    """Ensure the PSYCH sfx exists. Download if not."""
    if os.path.exists(PSYCH_SFX_PATH):
        return PSYCH_SFX_PATH

    log.info("PSYCH sfx not found, downloading...")
    result = download_psych_sfx(PSYCH_SFX_PATH)
    if result:
        return result

    log.warning("Could not download PSYCH sfx — videos will have no morph sound")
    return ""


def render_single_video(
    query: str | None = None,
    exclude_queries: list[str] | None = None,
) -> dict:
    """
    Full pipeline: generate one video from scratch.

    Flow: hook → story_part1 → nesso_demo → story_part2 → cta
    """
    render_id = uuid.uuid4().hex[:8]
    render_dir = os.path.join(TEMP_DIR, f"render_{render_id}")
    os.makedirs(render_dir, exist_ok=True)

    result = {
        "output_path": "",
        "tiktok_caption": "",
        "ig_caption": "",
        "ig_pin_comment": "",
        "hook_query": "",
        "hook_description": "",
        "duration": 0,
        "error": None,
    }

    try:
        # ── STEP 1: Ensure PSYCH sfx ──────────────────────────────────
        psych_path = ensure_psych_sfx()

        # ── STEP 2: Find and download hook ────────────────────────────
        hook_query = query or get_random_hook_query(exclude=exclude_queries)
        result["hook_query"] = hook_query
        log.info("[%s] Hook query: %s", render_id, hook_query)

        hook_path, hook_audio, hook_dur, hook_desc = get_full_hook(hook_query, render_dir)
        result["hook_description"] = hook_desc
        log.info("[%s] Hook: %.1fs — %s", render_id, hook_dur, hook_desc)

        # ── STEP 3: Generate two-part text story script ───────────────
        hook_category = get_hook_category(hook_query)
        part1_msgs, part2_msgs = generate_text_story(hook_desc, hook_category)
        log.info("[%s] Script: Part 1 = %d msgs, Part 2 = %d msgs",
                 render_id, len(part1_msgs), len(part2_msgs))

        # ── STEP 4: Generate voiceover for Part 1 only ────────────────
        # Part 2 uses text delays (snappy resolution, no VO needed)
        vo_path, vo_durations = generate_voiceover(part1_msgs, render_dir)
        if vo_path and vo_durations and len(vo_durations) == len(part1_msgs):
            for i, dur in enumerate(vo_durations):
                part1_msgs[i]["delay"] = dur
            log.info("[%s] Part 1 VO: %.1fs total", render_id, sum(vo_durations))
        elif vo_path and vo_durations:
            log.warning("[%s] VO length mismatch: %d vs %d — discarding",
                        render_id, len(vo_durations), len(part1_msgs))
            vo_path = ""
        else:
            vo_path = ""
            log.info("[%s] No voiceover — using text delays", render_id)

        # ── STEP 5: Render text story Part 1 frames ──────────────────
        voiceover_active = bool(vo_path and vo_durations)
        story1_frames = render_text_story_frames(part1_msgs, render_dir, voiceover_active=voiceover_active)
        log.info("[%s] Part 1: %d frames", render_id, len(story1_frames))

        story1_video = os.path.join(render_dir, "story1.mp4")
        compile_frames_to_video(story1_frames, story1_video)

        if not verify_clip(story1_video):
            raise RuntimeError("Story Part 1 video compilation failed")

        for frame_path, _ in story1_frames:
            try:
                os.remove(frame_path)
            except OSError:
                pass

        # ── STEP 6: Render Nesso app demo ─────────────────────────────
        demo_video = os.path.join(render_dir, "demo.mp4")
        demo_video, demo_vo_path = render_nesso_demo(demo_video, render_dir)

        if not verify_clip(demo_video):
            raise RuntimeError("Nesso demo video failed verification")

        # ── STEP 7: Render text story Part 2 frames ──────────────────
        story2_frames = render_text_story_frames(
            part1_msgs + part2_msgs, render_dir,
            voiceover_active=False,  # Part 2 uses text delays only
            start_from_msg=len(part1_msgs),  # render only Part 2 messages but show Part 1 context
        )
        log.info("[%s] Part 2: %d frames", render_id, len(story2_frames))

        story2_video = os.path.join(render_dir, "story2.mp4")
        compile_frames_to_video(story2_frames, story2_video)

        if not verify_clip(story2_video):
            raise RuntimeError("Story Part 2 video compilation failed")

        for frame_path, _ in story2_frames:
            try:
                os.remove(frame_path)
            except OSError:
                pass

        # ── STEP 8: Render CTA ────────────────────────────────────────
        cta_video = os.path.join(render_dir, "cta.mp4")
        render_cta(cta_video, render_dir)

        if not verify_clip(cta_video):
            raise RuntimeError("CTA video failed verification")

        # ── STEP 9: Download background music ─────────────────────────
        music_path = os.path.join(render_dir, "music.mp3")
        download_background_music(music_path, exclude_queries=exclude_queries)
        if not os.path.exists(music_path):
            music_path = ""
            log.warning("[%s] No background music", render_id)

        # ── STEP 10: Build message timings for iMessage SFX ──────────
        msg_timings = []
        cumulative = 0.0
        for msg in part1_msgs:
            msg_timings.append({
                "sender": msg.get("sender", ""),
                "cumulative_time": cumulative,
            })
            cumulative += msg.get("delay", 1.2)

        # ── STEP 11: Assemble all 5 segments + audio mix ─────────────
        concat_video = os.path.join(render_dir, "concat.mp4")
        morph_and_concat(
            hook_path=hook_path,
            hook_audio_path=hook_audio,
            story1_path=story1_video,
            demo_path=demo_video,
            story2_path=story2_video,
            cta_path=cta_video,
            psych_sfx_path=psych_path,
            music_path=music_path,
            output_path=concat_video,
            story1_vo_path=vo_path,
            demo_vo_path=demo_vo_path,
            message_timings=msg_timings,
        )

        # Clean intermediates
        for f in [hook_path, hook_audio, story1_video, demo_video,
                  story2_video, cta_video, music_path, vo_path, demo_vo_path]:
            if f:
                try:
                    os.remove(f)
                except OSError:
                    pass

        # ── STEP 12: Final encode ─────────────────────────────────────
        output_path = os.path.join(render_dir, f"nesso_{render_id}.mp4")
        cmd = [
            "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
            "-i", concat_video,
            "-c:v", "libx264", "-c:a", "aac",
            "-b:a", "128k",
            "-vf", (
                f"scale={WIDTH}:{HEIGHT}:"
                "force_original_aspect_ratio=decrease,"
                f"pad={WIDTH}:{HEIGHT}:-1:-1:color=black"
            ),
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-preset", FFMPEG_PRESET,
            output_path,
        ]

        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
        if proc.returncode != 0:
            raise RuntimeError(f"Final encode failed: {proc.stderr[-500:]}")

        try:
            os.remove(concat_video)
        except OSError:
            pass

        # ── STEP 13: Verify final output ──────────────────────────────
        if not verify_clip(output_path):
            raise RuntimeError("Final video failed verification")

        result["output_path"] = output_path
        result["duration"] = get_duration(output_path)

        result["tiktok_caption"] = generate_tiktok_caption("", hook_category)
        result["ig_caption"] = generate_ig_caption("", hook_category)
        result["ig_pin_comment"] = generate_ig_pin_comment()

        log.info(
            "[%s] Video complete: %s (%.1fs)",
            render_id, output_path, result["duration"],
        )

    except Exception as e:
        result["error"] = str(e)
        log.error("[%s] Pipeline failed: %s", render_id, e, exc_info=True)
        cleanup_temp_files(render_dir)

    # Log to analytics
    _locals = locals()
    log_render(
        hook_query=result.get("hook_query", ""),
        hook_category=_locals.get("hook_category", ""),
        hook_description=result.get("hook_description", ""),
        script_length=len(_locals.get("part1_msgs", [])) + len(_locals.get("part2_msgs", [])),
        duration=result.get("duration", 0),
        success=result["error"] is None,
        error=result.get("error", ""),
    )

    return result


def render_batch(count: int = 1) -> list[dict]:
    """Render a batch of videos. Each with a different hook category."""
    results = []
    used_queries = []

    for i in range(count):
        log.info("=== Rendering video %d/%d ===", i + 1, count)
        result = render_single_video(exclude_queries=used_queries)
        if result["hook_query"]:
            used_queries.append(result["hook_query"])
        results.append(result)

        if i < count - 1:
            time.sleep(2)

    successful = sum(1 for r in results if r["error"] is None)
    log.info("Batch complete: %d/%d successful", successful, count)
    return results
