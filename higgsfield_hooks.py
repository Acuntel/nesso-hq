"""
Nesso Content Engine V25 — Higgsfield AI hook-clip generator.

Generates the hook background from scratch instead of scraping Reddit.
Higgsfield's DoP engine is IMAGE-to-video, so producing a clip is two async
jobs in sequence:

    text2image (Soul)  →  still image URL
    image2video (DoP)  →  short video URL

Each job is submitted, then polled until `completed`. The final MP4 is
downloaded and handed to `hooks._trim_and_center_crop` so it comes out in the
exact same 9:16 / target-duration shape as a Reddit clip — the rest of the
pipeline can't tell the difference.

This path is SLOW (minutes) and costs credits per /make. It runs FIRST when
HIGGSFIELD_ENABLED, but ANY failure (no key, HTTP error, NSFW reject, timeout,
bad endpoint) returns None so `fetch_background_clip` falls through to Reddit
then the bundled pool. It must never raise into the pipeline.

NOTE: endpoint paths, model IDs and request/response field names live in
config.py and are best-effort against the public docs. If a fresh key 4xxs or
the response shape differs, the raw body is logged — adjust config + the small
number of field lookups here to match your dashboard's API reference.
"""

from __future__ import annotations

import logging
import os
import random
import time
from typing import Optional

import requests

import config
from verify import get_duration

log = logging.getLogger(__name__)

# Per-HTTP-call timeout (submit/poll/download). Distinct from the overall
# HIGGSFIELD_GEN_DEADLINE_SEC wall-clock budget enforced across both jobs.
_HTTP_TIMEOUT = 30


def _auth_headers() -> dict:
    # platform.higgsfield.ai uses an API-key PAIR: "Authorization: Key id:secret"
    return {
        "Authorization": f"Key {config.HIGGSFIELD_API_KEY}",
        "Content-Type": "application/json",
    }


def _submit(endpoint: str, payload: dict) -> Optional[dict]:
    """POST a generation request. Returns the parsed JSON or None on failure."""
    url = config.HIGGSFIELD_BASE_URL.rstrip("/") + endpoint
    try:
        r = requests.post(
            url, json=payload, headers=_auth_headers(), timeout=_HTTP_TIMEOUT
        )
    except requests.RequestException as e:
        log.warning("higgsfield submit %s network error: %s", endpoint, e)
        return None
    if r.status_code >= 300:
        # Log the body so a wrong endpoint/model/auth is debuggable from Railway.
        log.warning(
            "higgsfield submit %s -> HTTP %d: %s",
            endpoint, r.status_code, r.text[:400],
        )
        return None
    try:
        return r.json()
    except ValueError:
        log.warning("higgsfield submit %s: non-JSON body: %s", endpoint, r.text[:200])
        return None


def _poll(status_url: str, deadline: float) -> Optional[dict]:
    """
    Poll a status_url until completed/failed or the wall-clock deadline.
    Returns the final completed JSON, or None on failure/timeout/NSFW.
    """
    while time.time() < deadline:
        try:
            r = requests.get(
                status_url, headers=_auth_headers(), timeout=_HTTP_TIMEOUT
            )
        except requests.RequestException as e:
            log.warning("higgsfield poll network error: %s", e)
            time.sleep(config.HIGGSFIELD_POLL_INTERVAL_SEC)
            continue
        if r.status_code >= 300:
            log.warning("higgsfield poll HTTP %d: %s", r.status_code, r.text[:300])
            return None
        try:
            data = r.json()
        except ValueError:
            time.sleep(config.HIGGSFIELD_POLL_INTERVAL_SEC)
            continue

        status = (data.get("status") or "").lower()
        if status == "completed":
            return data
        if status in ("failed", "nsfw", "canceled", "cancelled"):
            log.warning("higgsfield job ended status=%s: %s", status, str(data)[:300])
            return None
        # queued / in_progress → keep waiting
        time.sleep(config.HIGGSFIELD_POLL_INTERVAL_SEC)

    log.warning("higgsfield poll exceeded wall-clock deadline")
    return None


def _run_job(endpoint: str, payload: dict, deadline: float) -> Optional[dict]:
    """Submit + poll one generation job. Returns the completed JSON or None."""
    submitted = _submit(endpoint, payload)
    if not submitted:
        return None
    status_url = submitted.get("status_url")
    if not status_url:
        # Some responses inline the result (withPolling); accept if already done.
        if (submitted.get("status") or "").lower() == "completed":
            return submitted
        req_id = submitted.get("request_id") or submitted.get("id")
        if not req_id:
            log.warning("higgsfield submit gave no status_url/request_id: %s",
                        str(submitted)[:300])
            return None
        status_url = (
            config.HIGGSFIELD_BASE_URL.rstrip("/") + f"/requests/{req_id}/status"
        )
    return _poll(status_url, deadline)


def _extract_url(data: dict, *keys: str) -> Optional[str]:
    """Pull a media URL out of a completed response, tolerant of shape."""
    for key in keys:
        node = data.get(key)
        if isinstance(node, dict) and node.get("url"):
            return node["url"]
        if isinstance(node, str) and node.startswith("http"):
            return node
        if isinstance(node, list) and node and isinstance(node[0], dict):
            if node[0].get("url"):
                return node[0]["url"]
    return None


def _download(url: str, dest: str, deadline: float) -> bool:
    timeout = max(5, min(_HTTP_TIMEOUT, int(deadline - time.time())))
    try:
        with requests.get(url, stream=True, timeout=timeout) as r:
            if r.status_code >= 300:
                log.warning("higgsfield download HTTP %d", r.status_code)
                return False
            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=1 << 16):
                    if chunk:
                        f.write(chunk)
    except requests.RequestException as e:
        log.warning("higgsfield download error: %s", e)
        return False
    return os.path.getsize(dest) > 10_000 if os.path.exists(dest) else False


def generate_hook_clip(
    temp_dir: str,
    target_seconds: float,
) -> Optional[tuple[str, float, str]]:
    """
    Generate a hook background via Higgsfield (text2image -> image2video).

    Returns (clip_path, duration, description) like fetch_background_clip, or
    None on any failure so the caller falls through to Reddit/bundled. Never
    raises into the pipeline.
    """
    if not config.HIGGSFIELD_ENABLED:
        return None

    deadline = time.time() + config.HIGGSFIELD_GEN_DEADLINE_SEC
    prompt = random.choice(config.HIGGSFIELD_HOOK_PROMPTS)
    log.info("higgsfield hook gen start (deadline %ds): %s",
             config.HIGGSFIELD_GEN_DEADLINE_SEC, prompt[:80])

    # --- Step 1: text -> still image ---------------------------------------
    img_payload = {
        "input": {
            "model": config.HIGGSFIELD_IMAGE_MODEL,
            "prompt": prompt,
            "aspect_ratio": config.HIGGSFIELD_ASPECT_RATIO,
        },
        "withPolling": True,
    }
    img_done = _run_job(config.HIGGSFIELD_IMAGE_ENDPOINT, img_payload, deadline)
    if not img_done:
        log.warning("higgsfield text2image failed — falling back")
        return None
    image_url = _extract_url(img_done, "image", "images", "output", "result")
    if not image_url:
        log.warning("higgsfield text2image: no image url in %s", str(img_done)[:300])
        return None

    if time.time() >= deadline:
        log.warning("higgsfield out of budget after image step")
        return None

    # --- Step 2: still image -> video --------------------------------------
    vid_payload = {
        "input": {
            "model": config.HIGGSFIELD_VIDEO_MODEL,
            "prompt": prompt,
            "input_images": [{"type": "image_url", "image_url": image_url}],
        },
        "withPolling": True,
    }
    vid_done = _run_job(config.HIGGSFIELD_VIDEO_ENDPOINT, vid_payload, deadline)
    if not vid_done:
        log.warning("higgsfield image2video failed — falling back")
        return None
    video_url = _extract_url(vid_done, "video", "videos", "output", "result")
    if not video_url:
        log.warning("higgsfield image2video: no video url in %s", str(vid_done)[:300])
        return None

    # --- Download + shape to match a Reddit clip ---------------------------
    raw = os.path.join(temp_dir, "higgsfield_raw.mp4")
    if not _download(video_url, raw, deadline):
        return None

    src_dur = get_duration(raw)
    if src_dur < target_seconds:
        log.warning("higgsfield clip too short (%.1fs < %.1fs)", src_dur, target_seconds)
        _cleanup(raw)
        return None

    # Import here to avoid a circular import at module load (hooks imports us).
    from hooks import _trim_and_center_crop

    out = os.path.join(temp_dir, "hook_bg.mp4")
    try:
        _trim_and_center_crop(raw, out, src_dur, target_seconds=target_seconds)
    except Exception as e:
        log.warning("higgsfield trim/crop failed: %s", e)
        _cleanup(raw)
        return None
    _cleanup(raw)

    duration = get_duration(out)
    desc = f"higgsfield: {prompt[:60]}"
    log.info("higgsfield hook clip: %.1fs — %s", duration, desc)
    return out, duration, desc


def _cleanup(path: str) -> None:
    try:
        os.remove(path)
    except OSError:
        pass
