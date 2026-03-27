"""
Nesso Content Engine V20 — Hook Video Sourcing (Pexels API)

Downloads attention-grabbing video clips from Pexels (free stock video API).
Replaces YouTube/yt-dlp which gets blocked on datacenter IPs.
"""

import logging
import os
import random
import subprocess

import requests

from config import (
    FFMPEG_PRESET,
    FFMPEG_THREADS,
    FFMPEG_TIMEOUT,
    HEIGHT,
    MAX_HOOK_CANDIDATES,
    PEXELS_API_KEY,
    WIDTH,
)
from verify import verify_clip

log = logging.getLogger(__name__)

# ── Pexels search queries mapped to hook categories ──────────────────────
# These return visually striking stock footage that grabs attention.
PEXELS_HOOK_QUERIES = [
    # Crashes & Action
    "car crash",
    "car accident",
    "motorcycle racing",
    "racing speed",
    # Extreme Heights
    "cliff jumping",
    "skydiving",
    "bungee jumping",
    "rock climbing mountain",
    "paragliding",
    "base jumping",
    # Explosions & Fire
    "explosion",
    "fireworks",
    "fire burning",
    "demolition",
    # Extreme Sports
    "surfing big wave",
    "snowboarding",
    "skateboarding tricks",
    "parkour",
    "bmx",
    "wakeboarding",
    "skiing downhill",
    # Nature & Dramatic
    "lightning storm",
    "ocean waves crashing",
    "tornado",
    "volcano",
    "avalanche",
    "tsunami wave",
    "waterfall",
    # Satisfying & Viral
    "slow motion",
    "drone aerial city",
    "underwater ocean",
    "time lapse clouds",
    "neon lights city",
    "fast cars driving",
    "roller coaster",
]


def search_pexels(query: str) -> list[dict]:
    """
    Search Pexels for video clips.
    Returns list of dicts with 'id', 'url', 'download_url', 'title', 'duration', 'width', 'height'.
    """
    if not PEXELS_API_KEY:
        log.error("PEXELS_API_KEY not set — cannot search for hooks")
        return []

    try:
        resp = requests.get(
            "https://api.pexels.com/videos/search",
            params={
                "query": query,
                "per_page": 15,
                "orientation": "portrait",  # prefer vertical
                "size": "medium",
            },
            headers={"Authorization": PEXELS_API_KEY},
            timeout=15,
        )

        if resp.status_code != 200:
            log.warning("Pexels API returned %d: %s", resp.status_code, resp.text[:200])
            # Try without orientation filter as fallback
            resp = requests.get(
                "https://api.pexels.com/videos/search",
                params={"query": query, "per_page": 15, "size": "medium"},
                headers={"Authorization": PEXELS_API_KEY},
                timeout=15,
            )
            if resp.status_code != 200:
                return []

        data = resp.json()
        candidates = []

        for video in data.get("videos", []):
            duration = video.get("duration", 0)
            if duration < 3 or duration > 120:
                continue

            # Find the best video file (prefer HD, avoid 4K to save bandwidth)
            best_file = None
            for vf in video.get("video_files", []):
                quality = vf.get("quality", "")
                w = vf.get("width", 0)
                h = vf.get("height", 0)

                if quality == "hd" or (w >= 720 and h >= 720):
                    if best_file is None or h > best_file.get("height", 0):
                        # Prefer taller (more vertical) files
                        if h <= 1920:  # skip 4K
                            best_file = vf

            if not best_file:
                # Take whatever we can get
                files = video.get("video_files", [])
                if files:
                    best_file = files[0]

            if best_file:
                candidates.append({
                    "id": video.get("id"),
                    "url": video.get("url", ""),
                    "download_url": best_file.get("link", ""),
                    "title": video.get("url", "pexels video"),
                    "duration": duration,
                    "width": best_file.get("width", 0),
                    "height": best_file.get("height", 0),
                })

        log.info("Pexels '%s': %d candidates", query, len(candidates))
        return candidates

    except Exception as e:
        log.warning("Pexels search failed: %s", e)
        return []


def download_pexels_clip(
    download_url: str,
    output_path: str,
    max_duration: float = 15.0,
) -> str:
    """
    Download a video clip from Pexels direct URL.
    Trims to max_duration if needed.
    """
    # Download the raw file
    raw_path = output_path + ".raw.mp4"
    try:
        resp = requests.get(download_url, stream=True, timeout=60)
        resp.raise_for_status()
        with open(raw_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
    except Exception as e:
        raise RuntimeError(f"Pexels download failed: {e}")

    if not os.path.exists(raw_path) or os.path.getsize(raw_path) < 10000:
        raise RuntimeError("Pexels download produced empty file")

    # Trim to max_duration
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-i", raw_path,
        "-t", str(max_duration),
        "-c", "copy",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    try:
        os.remove(raw_path)
    except OSError:
        pass

    if result.returncode != 0:
        raise RuntimeError(f"Clip trim failed: {result.stderr[-300:]}")

    return output_path


def crop_to_vertical(input_path: str, output_path: str) -> str:
    """
    Crop a video to 9:16 vertical.
    If already vertical, just scale to 1080x1920.
    """
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-i", input_path,
        "-vf", (
            f"crop=ih*9/16:ih,scale={WIDTH}:{HEIGHT}:"
            "force_original_aspect_ratio=decrease,"
            f"pad={WIDTH}:{HEIGHT}:-1:-1:color=black"
        ),
        "-preset", FFMPEG_PRESET,
        "-an",  # Strip audio temporarily — we'll add it back in morph
        "-t", "15",  # Safety cap
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        raise RuntimeError(f"Crop failed: {result.stderr[-500:]}")

    if not verify_clip(output_path):
        raise RuntimeError(f"Cropped clip verification failed: {output_path}")

    return output_path


def extract_hook_audio(input_path: str, output_path: str) -> str:
    """Extract audio from the hook clip (before cropping strips it)."""
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-i", input_path,
        "-vn", "-acodec", "aac", "-b:a", "128k",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        log.warning("Audio extraction failed (video may have no audio): %s", result.stderr[-200:])
        return ""
    return output_path


def get_full_hook(
    query: str,
    temp_dir: str,
) -> tuple[str, str, float, str]:
    """
    Full hook pipeline: search Pexels → download → crop → extract audio.
    Returns (vertical_clip_path, audio_path, duration, description).
    """
    # Map the incoming query to a Pexels-friendly search
    pexels_query = _map_to_pexels_query(query)
    candidates = search_pexels(pexels_query)

    # If no results, try a broader search
    if not candidates:
        log.warning("No Pexels results for '%s', trying broader search", pexels_query)
        broad_queries = ["extreme sports action", "dramatic slow motion", "intense nature"]
        for bq in broad_queries:
            candidates = search_pexels(bq)
            if candidates:
                break

    if not candidates:
        raise RuntimeError(f"No hook videos found for query: {query}")

    # Pick a random candidate from top results (variety per render)
    top = candidates[:MAX_HOOK_CANDIDATES]
    chosen = random.choice(top)

    description = f"Pexels video: {pexels_query}"
    log.info("Hook chosen: id=%s, dur=%ds — %s", chosen["id"], chosen["duration"], description)

    # Download the clip
    raw_clip = os.path.join(temp_dir, "hook_raw.mp4")
    download_pexels_clip(chosen["download_url"], raw_clip, max_duration=15)

    # Extract audio before cropping (crop strips audio)
    hook_audio = os.path.join(temp_dir, "hook_audio.m4a")
    extract_hook_audio(raw_clip, hook_audio)
    if not os.path.exists(hook_audio):
        hook_audio = ""

    # Crop to vertical
    hook_vertical = os.path.join(temp_dir, "hook_v.mp4")
    crop_to_vertical(raw_clip, hook_vertical)

    # Clean raw clip
    try:
        os.remove(raw_clip)
    except OSError:
        pass

    from verify import get_duration
    duration = get_duration(hook_vertical)

    return hook_vertical, hook_audio, duration, description


def _map_to_pexels_query(youtube_query: str) -> str:
    """
    Map an existing YouTube-style hook query to a Pexels-friendly search.
    Also works if the query is already Pexels-friendly.
    """
    q = youtube_query.lower()

    # Direct keyword mapping
    mappings = [
        (["car crash", "dashcam", "near miss", "close call"], "car crash accident"),
        (["motorcycle", "truck"], "motorcycle speed racing"),
        (["cliff", "jumping gone wrong"], "cliff jumping ocean"),
        (["base jump"], "skydiving extreme"),
        (["bungee"], "bungee jumping"),
        (["rock climbing", "boulder", "climbing fall"], "rock climbing mountain"),
        (["wingsuit", "glass bridge"], "extreme heights vertigo"),
        (["demolition", "building"], "demolition building"),
        (["fireworks"], "fireworks night sky"),
        (["explosion", "gender reveal"], "explosion fire"),
        (["ski", "snowboard"], "snowboarding skiing mountain"),
        (["surfing", "big wave", "wipeout"], "surfing big wave ocean"),
        (["parkour"], "parkour urban"),
        (["skateboard", "mega ramp"], "skateboarding tricks"),
        (["bmx"], "bmx jump extreme"),
        (["wakeboard"], "wakeboarding water"),
        (["lightning"], "lightning storm dramatic"),
        (["bear", "animal", "dog saves"], "wild animals nature"),
        (["ocean wave", "tsunami"], "ocean waves crashing power"),
        (["tornado"], "tornado storm dramatic"),
        (["volcano"], "volcano eruption lava"),
        (["shark"], "underwater ocean shark"),
        (["cooking", "food", "gordon", "cake", "kitchen"], "cooking fire kitchen"),
        (["gaming", "streamer", "speedrun", "vr"], "gaming esports"),
        (["sports", "goal", "buzzer"], "sports goal celebration"),
        (["satisfying", "hydraulic", "perfect fit"], "satisfying slow motion"),
        (["domino"], "domino chain reaction"),
        (["drone", "aerial"], "drone aerial view"),
        (["insane", "impossible", "lucky", "one in a million"], "impossible amazing moment"),
        (["security camera"], "surveillance camera footage"),
        (["rally car"], "rally car racing dirt"),
        (["roller coaster"], "roller coaster ride"),
    ]

    for keywords, pexels_query in mappings:
        if any(kw in q for kw in keywords):
            return pexels_query

    # If no mapping found, just use the original query (Pexels handles most terms)
    # Strip YouTube-specific phrases
    cleaned = q.replace("caught on camera", "").replace("compilation", "")
    cleaned = cleaned.replace("gone wrong", "").replace("fail", "")
    cleaned = cleaned.replace("incredible", "").replace("insane", "extreme")
    return cleaned.strip() or "extreme action"
