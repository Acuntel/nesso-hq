"""
Nesso Content Engine V21 — Clip Verification & Pipeline Health
"""

import json
import logging
import os
import subprocess

log = logging.getLogger(__name__)


def has_audio_stream(filepath: str) -> bool:
    """Return True iff the file has at least one audio stream."""
    if not filepath or not os.path.exists(filepath):
        return False
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_streams", "-select_streams", "a", filepath],
            capture_output=True, text=True, timeout=10,
        )
        data = json.loads(result.stdout or "{}")
        return bool(data.get("streams"))
    except Exception as e:
        log.warning("has_audio_stream: ffprobe failed for %s: %s", filepath, e)
        return False


def verify_clip(filepath: str) -> bool:
    """
    Check that a video file exists, has size, has video frames, and duration > 0.5s.
    Returns True only if clip is usable.
    """
    if not os.path.exists(filepath):
        log.warning("verify_clip: file does not exist: %s", filepath)
        return False

    size = os.path.getsize(filepath)
    if size < 10000:  # < 10KB = corrupt
        log.warning("verify_clip: file too small (%d bytes): %s", size, filepath)
        return False

    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_streams", "-show_format", filepath],
            capture_output=True, text=True, timeout=15,
        )
        data = json.loads(result.stdout)

        has_video = any(
            s.get("codec_type") == "video"
            for s in data.get("streams", [])
        )
        duration = float(data.get("format", {}).get("duration", 0))

        if not has_video:
            log.warning("verify_clip: no video stream in %s", filepath)
        if duration <= 0.5:
            log.warning("verify_clip: duration too short (%.2fs) in %s", duration, filepath)

        return has_video and duration > 0.5
    except Exception as e:
        log.warning("verify_clip: ffprobe failed for %s: %s", filepath, e)
        return False


def get_duration(filepath: str) -> float:
    """Get duration of a media file in seconds."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_format", filepath],
            capture_output=True, text=True, timeout=15,
        )
        data = json.loads(result.stdout)
        return float(data.get("format", {}).get("duration", 0))
    except Exception:
        return 0.0


def get_resolution(filepath: str) -> tuple[int, int] | None:
    """Get (width, height) of a video file."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_streams", filepath],
            capture_output=True, text=True, timeout=15,
        )
        data = json.loads(result.stdout)
        for s in data.get("streams", []):
            if s.get("codec_type") == "video":
                return (int(s["width"]), int(s["height"]))
    except Exception:
        pass
    return None


def check_pipeline_health(
    hook_clip: str,
    story_video: str,
    output_video: str,
) -> dict:
    """
    Detect if the visual pipeline is completely dead EARLY
    instead of delivering a black-frame video.
    """
    checks = {
        "hook_exists": (
            os.path.exists(hook_clip)
            and os.path.getsize(hook_clip) > 10000
        ),
        "story_exists": (
            os.path.exists(story_video)
            and os.path.getsize(story_video) > 10000
        ),
        "output_exists": (
            os.path.exists(output_video)
            and os.path.getsize(output_video) > 50000
        ),
    }

    failed = [k for k, v in checks.items() if not v]

    if len(failed) >= 2:
        return {
            "status": "PIPELINE_DEAD",
            "failed_checks": failed,
            "message": (
                "The rendering pipeline is broken — this is NOT a creative "
                "problem. Do not retry hook/morph/script. Fix the pipeline."
            ),
        }

    return {"status": "OK"}


def verify_audio(filepath: str) -> bool:
    """Check that an audio file exists and has an audio stream."""
    if not os.path.exists(filepath):
        log.warning("verify_audio: file does not exist: %s", filepath)
        return False
    if os.path.getsize(filepath) < 1000:
        log.warning("verify_audio: file too small: %s", filepath)
        return False
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_streams", filepath],
            capture_output=True, text=True, timeout=15,
        )
        data = json.loads(result.stdout)
        has_audio = any(
            s.get("codec_type") == "audio"
            for s in data.get("streams", [])
        )
        if not has_audio:
            log.warning("verify_audio: no audio stream in %s", filepath)
        return has_audio
    except Exception as e:
        log.warning("verify_audio: ffprobe failed for %s: %s", filepath, e)
        return False
