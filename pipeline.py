"""
Nesso Content Engine V20 — Full Render Pipeline Orchestrator

Calls: hooks → scripts → renderer → morph → reveal → music → verify
in sequence. Manages temp files and memory budget.
"""

import logging
import os
import shutil
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
)
from hooks import get_full_hook
from morph import morph_and_concat
from music import download_background_music, download_psych_sfx
from renderer import compile_frames_to_video, render_text_story_frames
from reveal import render_nesso_reveal
from scripts import generate_text_story
from verify import check_pipeline_health, get_duration, verify_clip

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

    Returns dict with:
        - output_path: str (path to final .mp4)
        - tiktok_caption: str
        - ig_caption: str
        - hook_query: str
        - hook_description: str
        - duration: float
        - error: str | None
    """
    # Create unique temp dir for this render
    render_id = uuid.uuid4().hex[:8]
    render_dir = os.path.join(TEMP_DIR, f"render_{render_id}")
    os.makedirs(render_dir, exist_ok=True)

    result = {
        "output_path": "",
        "tiktok_caption": "",
        "ig_caption": "",
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

        # ── STEP 3: Generate text story script ────────────────────────
        hook_category = get_hook_category(hook_query)
        messages = generate_text_story(hook_desc, hook_category)
        log.info("[%s] Script: %d messages", render_id, len(messages))

        # ── STEP 4: Render text story frames ──────────────────────────
        story_frames = render_text_story_frames(messages, render_dir)
        log.info("[%s] Rendered %d frames", render_id, len(story_frames))

        # ── STEP 5: Compile frames to video ───────────────────────────
        story_video = os.path.join(render_dir, "story.mp4")
        compile_frames_to_video(story_frames, story_video)

        if not verify_clip(story_video):
            raise RuntimeError("Story video compilation failed verification")

        # Clean up frame PNGs immediately
        for frame_path, _ in story_frames:
            try:
                os.remove(frame_path)
            except OSError:
                pass

        # ── STEP 6: Render Nesso reveal ───────────────────────────────
        reveal_video = os.path.join(render_dir, "reveal.mp4")
        render_nesso_reveal(reveal_video)

        # ── STEP 7: Download background music ─────────────────────────
        music_path = os.path.join(render_dir, "music.mp3")
        download_background_music(music_path, exclude_queries=exclude_queries)
        if not os.path.exists(music_path):
            music_path = ""
            log.warning("[%s] No background music — proceeding without", render_id)

        # ── STEP 8: Morph + concat + audio ────────────────────────────
        concat_video = os.path.join(render_dir, "concat.mp4")
        morph_and_concat(
            hook_path=hook_path,
            hook_audio_path=hook_audio,
            story_path=story_video,
            reveal_path=reveal_video,
            psych_sfx_path=psych_path,
            music_path=music_path,
            output_path=concat_video,
        )

        # Clean intermediates
        for f in [hook_path, hook_audio, story_video, reveal_video, music_path]:
            if f:
                try:
                    os.remove(f)
                except OSError:
                    pass

        # ── STEP 9: Final encode ──────────────────────────────────────
        output_path = os.path.join(render_dir, f"nesso_{render_id}.mp4")
        import subprocess
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

        # ── STEP 10: Verify final output ──────────────────────────────
        health = check_pipeline_health(hook_path, story_video, output_path)
        # hook_path and story_video are deleted, but output_path is what matters
        if not verify_clip(output_path):
            raise RuntimeError("Final video failed verification")

        result["output_path"] = output_path
        result["duration"] = get_duration(output_path)

        # Generate captions
        result["tiktok_caption"] = generate_tiktok_caption()
        result["ig_caption"] = generate_ig_caption()

        log.info(
            "[%s] Video complete: %s (%.1fs)",
            render_id, output_path, result["duration"],
        )

    except Exception as e:
        result["error"] = str(e)
        log.error("[%s] Pipeline failed: %s", render_id, e, exc_info=True)

        # Clean up on failure
        cleanup_temp_files(render_dir)

    return result


def render_batch(count: int = 1) -> list[dict]:
    """
    Render a batch of videos. Each with a different hook category.
    """
    results = []
    used_queries = []

    for i in range(count):
        log.info("=== Rendering video %d/%d ===", i + 1, count)
        result = render_single_video(exclude_queries=used_queries)
        if result["hook_query"]:
            used_queries.append(result["hook_query"])
        results.append(result)

        # Brief pause between renders to let Railway breathe
        if i < count - 1:
            time.sleep(2)

    successful = sum(1 for r in results if r["error"] is None)
    log.info("Batch complete: %d/%d successful", successful, count)
    return results
