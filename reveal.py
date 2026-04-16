"""
Nesso Content Engine V21 — Nesso App Demo + CTA

The demo is an actual app walkthrough woven INTO the text story:
  Screen 1: Inner Circle — show the bars (1.2s) VO: "this is nesso"
  Screen 2: Bar drains, tap Reach Out (1.5s) VO: "time's up. time to reach out"
  Screen 3: AI suggestions appear (1.5s) VO: "AI writes the message for you"
  Screen 4: Tap to send to text (1.0s) VO: "just tap and send"

CTA is a separate 2s segment: logo + "it's free" + @nesso.app
"""

import logging
import os
import subprocess

from PIL import Image, ImageDraw, ImageFont

from config import (
    ASSETS_DIR,
    CTA_DURATION,
    DEMO_DURATION,
    DEMO_NARRATION,
    ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID,
    FFMPEG_PRESET,
    FFMPEG_THREADS,
    FFMPEG_TIMEOUT,
    FPS,
    HEIGHT,
    NESSO_LOGO_PATH,
    WIDTH,
)
from verify import get_duration

log = logging.getLogger(__name__)

APP_SCREENS_DIR = os.path.join(ASSETS_DIR, "app_screens")

# Screen flow for the demo — each screen gets one narration line
DEMO_SCREENS = [
    "home.png",           # Inner Circle with bars
    "reach_out.png",      # "Reach out to Mom" with bar drained
    "ai_suggestions.png", # AI message suggestions modal
    "ai_suggestions.png", # Same screen — "tap to send" moment
]


def _get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    font_paths = [
        "/System/Library/Fonts/SFProDisplay-Regular.otf",
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    if bold:
        bold_paths = [
            "/System/Library/Fonts/SFProDisplay-Bold.otf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ]
        font_paths = bold_paths + font_paths
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _ease_out_cubic(t: float) -> float:
    return 1 - (1 - t) ** 3


def _draw_gradient_bg(draw: ImageDraw.ImageDraw):
    for y in range(HEIGHT):
        t = y / HEIGHT
        r = int(5 + 15 * t)
        g = int(3 + 10 * t)
        b = int(8 + 12 * t)
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))


def _load_screen(filename: str) -> Image.Image | None:
    path = os.path.join(APP_SCREENS_DIR, filename)
    if not os.path.exists(path):
        return None
    img = Image.open(path).convert("RGB")
    return img.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


# ── Demo Voiceover ─────────────────────────────────────────────────────────

def _generate_demo_voiceover(temp_dir: str) -> tuple[str, list[float]]:
    """
    Generate ElevenLabs TTS for the demo narration lines.
    Returns (concat_audio_path, per_line_durations).
    Falls back to silence if TTS unavailable.
    """
    if not ELEVENLABS_API_KEY:
        log.info("No ElevenLabs key — demo will be silent")
        return "", [d for _, d in DEMO_NARRATION]

    try:
        from elevenlabs import ElevenLabs
        client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
    except ImportError:
        return "", [d for _, d in DEMO_NARRATION]

    clip_paths = []
    durations = []

    for i, (text, min_dur) in enumerate(DEMO_NARRATION):
        clip_path = os.path.join(temp_dir, f"demo_vo_{i:02d}.mp3")
        try:
            audio_gen = client.text_to_speech.convert(
                voice_id=ELEVENLABS_VOICE_ID,
                text=text,
                model_id="eleven_turbo_v2_5",
                output_format="mp3_44100_128",
            )
            with open(clip_path, "wb") as f:
                for chunk in audio_gen:
                    f.write(chunk)

            clip_dur = get_duration(clip_path)
            actual_dur = max(clip_dur + 0.3, min_dur)
            clip_paths.append(clip_path)
            durations.append(actual_dur)
            log.debug("Demo VO %d: %.1fs for '%s'", i, actual_dur, text)
        except Exception as e:
            log.warning("Demo TTS failed for '%s': %s", text, e)
            clip_paths.append("")
            durations.append(min_dur)

    # Concat all clips with silence padding to match target durations
    concat_path = os.path.join(temp_dir, "demo_voiceover.mp3")
    concat_file = os.path.join(temp_dir, "demo_vo_concat.txt")

    # Build padded clips — each clip is padded with silence to its target duration
    padded_paths = []
    for i, (clip, dur) in enumerate(zip(clip_paths, durations)):
        if not clip:
            # Generate silence for this slot
            silence_path = os.path.join(temp_dir, f"demo_silence_{i:02d}.mp3")
            cmd = [
                "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
                "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
                "-t", str(dur), "-c:a", "libmp3lame", "-b:a", "64k",
                silence_path,
            ]
            subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
            padded_paths.append(silence_path)
            continue

        # Pad the clip with silence to fill the target duration
        clip_dur = get_duration(clip)
        if clip_dur < dur:
            padded_path = os.path.join(temp_dir, f"demo_padded_{i:02d}.mp3")
            pad_cmd = [
                "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
                "-i", clip,
                "-af", f"apad=whole_dur={dur}",
                "-c:a", "libmp3lame", "-b:a", "128k",
                padded_path,
            ]
            result = subprocess.run(pad_cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
            if result.returncode == 0:
                padded_paths.append(padded_path)
            else:
                padded_paths.append(clip)
        else:
            padded_paths.append(clip)

    with open(concat_file, "w") as f:
        for p in padded_paths:
            safe = p.replace("'", "'\\''")
            f.write(f"file '{safe}'\n")

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "concat", "-safe", "0", "-i", concat_file,
        "-c:a", "libmp3lame", "-b:a", "128k",
        concat_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    # Cleanup
    for p in padded_paths + clip_paths:
        if p and p != concat_path:
            try:
                os.remove(p)
            except OSError:
                pass
    try:
        os.remove(concat_file)
    except OSError:
        pass

    if result.returncode != 0:
        log.warning("Demo VO concat failed: %s", result.stderr[-200:])
        return "", durations

    log.info("Demo voiceover: %.1fs", get_duration(concat_path))
    return concat_path, durations


# ── Demo Frame Rendering ───────────────────────────────────────────────────

def _render_demo_frames(temp_dir: str, durations: list[float]) -> list[tuple[str, float]]:
    """
    Render the Nesso app demo as PNG frames with per-screen durations.
    Each screen gets a subtle zoom + caption overlay.
    Returns list of (frame_path, duration) tuples.
    """
    frames = []
    frame_idx = 0

    for screen_idx, (screen_file, (narration_text, _)) in enumerate(zip(DEMO_SCREENS, DEMO_NARRATION)):
        screen_img = _load_screen(screen_file)
        if screen_img is None:
            # Skip missing screens — render a branded placeholder
            screen_img = Image.new("RGB", (WIDTH, HEIGHT), (20, 15, 25))
            draw = ImageDraw.Draw(screen_img)
            _draw_gradient_bg(draw)

        dur = durations[screen_idx] if screen_idx < len(durations) else 1.5
        num_frames = max(1, int(dur * FPS))

        # Pre-scale for zoom effect
        zoom_start, zoom_end = 1.0, 1.04
        max_w = int(WIDTH * zoom_end)
        max_h = int(HEIGHT * zoom_end)
        max_scaled = screen_img.resize((max_w, max_h), Image.Resampling.LANCZOS)

        for fi in range(num_frames):
            t = fi / max(1, num_frames - 1)

            # Zoom crop
            zoom = zoom_start + (zoom_end - zoom_start) * t
            crop_w = int(WIDTH * (zoom_end / zoom))
            crop_h = int(HEIGHT * (zoom_end / zoom))
            crop_x = (max_w - crop_w) // 2
            crop_y = (max_h - crop_h) // 2
            cropped = max_scaled.crop((crop_x, crop_y, crop_x + crop_w, crop_y + crop_h))
            frame = cropped.resize((WIDTH, HEIGHT), Image.Resampling.BILINEAR)

            # Caption band at bottom
            draw = ImageDraw.Draw(frame)
            band_h = 180
            band_top = HEIGHT - band_h
            draw.rectangle((0, band_top, WIDTH, HEIGHT), fill=(0, 0, 0))

            font = _get_font(38, bold=True)
            # Fade in text
            text_t = min(1.0, t * 3)  # fade in over first 1/3 of duration
            brightness = int(255 * _ease_out_cubic(text_t))
            color = (brightness, brightness, brightness)
            tw = font.getlength(narration_text)
            tx = (WIDTH - tw) / 2
            ty = band_top + (band_h - 38) // 2
            draw.text((tx, ty), narration_text, fill=color, font=font)

            fp = os.path.join(temp_dir, f"demo_{frame_idx:04d}.png")
            frame.save(fp, "PNG")
            frames.append(fp)
            frame_idx += 1

    # Return as (path, duration) per screen — for concat demuxer
    result = []
    offset = 0
    for screen_idx in range(len(DEMO_SCREENS)):
        dur = durations[screen_idx] if screen_idx < len(durations) else 1.5
        num_frames = max(1, int(dur * FPS))
        # Point to all frames for this screen — but use concat with per-frame duration
        for fi in range(num_frames):
            result.append((frames[offset + fi], 1.0 / FPS))
        offset += num_frames

    return result


def render_nesso_demo(output_path: str, temp_dir: str) -> tuple[str, str]:
    """
    Render the Nesso app demo segment.

    Returns:
        (video_path, voiceover_path)
        - video_path: the demo video (no audio baked in)
        - voiceover_path: the demo VO audio (mixed in by morph.py)
    """
    # Generate demo voiceover
    vo_path, durations = _generate_demo_voiceover(temp_dir)

    # Render frames
    frame_data = _render_demo_frames(temp_dir, durations)

    if not frame_data:
        raise RuntimeError("No demo frames generated — app screenshots missing?")

    # Compile frames to video
    concat_file = os.path.join(temp_dir, "demo_concat.txt")
    with open(concat_file, "w") as f:
        for fp, dur in frame_data:
            safe = fp.replace("'", "'\\''")
            f.write(f"file '{safe}'\nduration {dur}\n")
        # Repeat last frame
        safe = frame_data[-1][0].replace("'", "'\\''")
        f.write(f"file '{safe}'\n")

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "concat", "-safe", "0", "-i", concat_file,
        "-vf", f"fps={FPS}",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-preset", FFMPEG_PRESET,
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    # Cleanup frames
    for fp, _ in frame_data:
        try:
            os.remove(fp)
        except OSError:
            pass
    try:
        os.remove(concat_file)
    except OSError:
        pass

    if result.returncode != 0:
        raise RuntimeError(f"Demo video compile failed: {result.stderr[-500:]}")

    demo_dur = get_duration(output_path)
    log.info("Nesso demo rendered: %s (%.1fs)", output_path, demo_dur)
    return output_path, vo_path


# ── CTA Segment ────────────────────────────────────────────────────────────

def render_cta(output_path: str, temp_dir: str) -> str:
    """Render a 2-second CTA: logo + "it's free" + @nesso.app."""
    num_frames = int(CTA_DURATION * FPS)
    frames = []

    logo_img = None
    if os.path.exists(NESSO_LOGO_PATH):
        try:
            logo_img = Image.open(NESSO_LOGO_PATH).convert("RGBA")
        except Exception:
            pass

    font_main = _get_font(72, bold=True)
    font_handle = _get_font(40, bold=True)

    for fi in range(num_frames):
        t = fi / max(1, num_frames - 1)

        img = Image.new("RGB", (WIDTH, HEIGHT), (0, 0, 0))
        draw = ImageDraw.Draw(img)
        _draw_gradient_bg(draw)

        logo_y_center = HEIGHT // 2 - 160
        logo_size = 300

        # Logo — instant appear, no slow animation
        if logo_img:
            resized = logo_img.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
            lx = (WIDTH - logo_size) // 2
            ly = logo_y_center - logo_size // 2
            img.paste(resized, (lx, ly), resized)

        text_y = logo_y_center + logo_size // 2 + 40

        # "it's free" — fade in fast
        free_t = min(1.0, t / 0.3)
        free_b = int(255 * _ease_out_cubic(free_t))
        free_text = "it's free"
        fw = font_main.getlength(free_text)
        draw.text(((WIDTH - fw) / 2, text_y), free_text, fill=(free_b, free_b, free_b), font=font_main)

        # @nesso.app
        handle_t = max(0.0, min(1.0, (t - 0.2) / 0.3))
        hb = _ease_out_cubic(handle_t)
        handle_color = (int(232 * hb), int(212 * hb), int(207 * hb))
        handle_text = "@nesso.app"
        hw = font_handle.getlength(handle_text)
        draw.text(((WIDTH - hw) / 2, text_y + 100), handle_text, fill=handle_color, font=font_handle)

        fp = os.path.join(temp_dir, f"cta_{fi:04d}.png")
        img.save(fp, "PNG")
        frames.append(fp)

    # Compile
    concat_file = os.path.join(temp_dir, "cta_concat.txt")
    with open(concat_file, "w") as f:
        for fp in frames:
            safe = fp.replace("'", "'\\''")
            f.write(f"file '{safe}'\nduration {1/FPS}\n")
        safe = frames[-1].replace("'", "'\\''")
        f.write(f"file '{safe}'\n")

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "concat", "-safe", "0", "-i", concat_file,
        "-vf", f"fps={FPS}",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-preset", FFMPEG_PRESET,
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    for fp in frames:
        try:
            os.remove(fp)
        except OSError:
            pass
    try:
        os.remove(concat_file)
    except OSError:
        pass

    if result.returncode != 0:
        raise RuntimeError(f"CTA compile failed: {result.stderr[-500:]}")

    log.info("CTA rendered: %s (%.1fs)", output_path, get_duration(output_path))
    return output_path
