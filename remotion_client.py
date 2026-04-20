"""
Nesso Content Engine V22 — Remotion HTTP Client

Calls the Remotion Express server (running on localhost:3100 inside the same
container) to render individual video segments. Returns the path to the
rendered MP4.

Each segment is rendered via:
    POST /render/<composition_id>
    body: {"props": {...}, "durationSeconds": 2.5, "fps": 30}
    response: video/mp4 bytes
"""

from __future__ import annotations

import logging
import os
import time

import requests

log = logging.getLogger(__name__)

REMOTION_URL = os.environ.get("REMOTION_SERVER_URL", "http://localhost:3100")
RENDER_TIMEOUT = 180  # seconds — bundling on cold start can be slow
HEALTH_TIMEOUT = 5
ASSET_TIMEOUT = 60


class RemotionError(RuntimeError):
    """Raised when a Remotion render fails."""


def upload_asset(local_path: str, remote_name: str | None = None) -> str:
    """
    Upload a local file to the Remotion server's asset cache.
    Returns the HTTP URL that OffthreadVideo can fetch from.
    """
    if not os.path.exists(local_path):
        raise RemotionError(f"upload_asset: {local_path} does not exist")

    name = remote_name or os.path.basename(local_path)
    url = f"{REMOTION_URL}/assets/{name}"

    with open(local_path, "rb") as f:
        r = requests.put(url, data=f, timeout=ASSET_TIMEOUT)
    if not r.ok:
        raise RemotionError(f"asset upload failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    return data["url"]


def delete_asset(remote_name: str) -> None:
    """Remove an uploaded asset from the Remotion server (best-effort)."""
    try:
        requests.delete(f"{REMOTION_URL}/assets/{remote_name}", timeout=10)
    except requests.RequestException:
        pass


def wait_until_ready(max_seconds: int = 120) -> bool:
    """Poll /health until the server is up. Returns True when ready."""
    deadline = time.time() + max_seconds
    while time.time() < deadline:
        try:
            r = requests.get(f"{REMOTION_URL}/health", timeout=HEALTH_TIMEOUT)
            if r.ok:
                return True
        except requests.RequestException:
            pass
        time.sleep(1)
    return False


def render_composition(
    composition_id: str,
    output_path: str,
    props: dict | None = None,
    duration_seconds: float | None = None,
    fps: int = 30,
) -> str:
    """
    Render a Remotion composition to ``output_path``.

    Raises RemotionError on failure.
    Returns output_path on success.
    """
    payload: dict = {"props": props or {}, "fps": fps}
    if duration_seconds is not None:
        payload["durationSeconds"] = duration_seconds

    url = f"{REMOTION_URL}/render/{composition_id}"
    t0 = time.time()

    try:
        r = requests.post(url, json=payload, timeout=RENDER_TIMEOUT, stream=True)
    except requests.RequestException as e:
        raise RemotionError(f"{composition_id}: request failed — {e}") from e

    if not r.ok:
        try:
            err = r.json()
        except Exception:
            err = {"error": r.text[:500]}
        raise RemotionError(f"{composition_id}: {err}")

    with open(output_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=1 << 16):
            if chunk:
                f.write(chunk)

    size = os.path.getsize(output_path)
    if size < 1024:
        raise RemotionError(
            f"{composition_id}: rendered file too small ({size} bytes) — likely a silent failure"
        )

    elapsed = time.time() - t0
    log.info(
        "Remotion %s → %s (%.1fKB, %.1fs)",
        composition_id,
        os.path.basename(output_path),
        size / 1024,
        elapsed,
    )
    return output_path
