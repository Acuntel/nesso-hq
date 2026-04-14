"""
Nesso Content Engine V21 — Animated Reveal Sequence

Primary: Remotion (React → Chromium → MP4) for professional motion graphics.
Fallback: Pillow frame-by-frame animation if Remotion service unavailable.

Flow (~8s total):
1. Feature text fade-in, word by word (1.5s)
2. Nesso app walkthrough — 4 screens, caption overlay, slow zoom (5.0s)
3. Logo + "it's free" + @nesso.app CTA (1.5s)
"""

import logging
import math
import os
import random
import subprocess

import requests as http_requests
from PIL import Image, ImageDraw, ImageFont

from config import (
    ASSETS_DIR,
    FFMPEG_PRESET,
    FFMPEG_THREADS,
    FFMPEG_TIMEOUT,
    FPS,
    HEIGHT,
    NESSO_LOGO_PATH,
    WIDTH,
    get_reveal_line,
)
from verify import get_duration

log = logging.getLogger(__name__)

APP_SCREENS_DIR = os.path.join(ASSETS_DIR, "app_screens")
APP_SCREENSHOTS = ["home.png", "home_contacts.png", "reach_out.png", "ai_suggestions.png"]


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
    """Ease-out cubic — fast start, smooth landing."""
    return 1 - (1 - t) ** 3


def _ease_in_out(t: float) -> float:
    """Smoothstep ease in-out."""
    return t * t * (3 - 2 * t)


def _lerp_color(c1: tuple, c2: tuple, t: float) -> tuple:
    """Linearly interpolate between two RGB colors."""
    t = max(0.0, min(1.0, t))
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def _draw_gradient_bg(draw: ImageDraw.ImageDraw):
    """Draw the subtle dark gradient background."""
    for y in range(HEIGHT):
        t = y / HEIGHT
        r = int(5 + 15 * t)
        g = int(3 + 10 * t)
        b = int(8 + 12 * t)
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))


def _wrap_text_lines(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Wrap text into lines that fit within max_width."""
    import textwrap
    avg_char_width = font.getlength("m")
    chars_per_line = max(1, int(max_width / avg_char_width))
    return textwrap.wrap(text, width=chars_per_line) or [text]


# ── Segment 1: Feature Text Fade-In ─────────────────────────────────────

def _render_text_fadein_frames(line: str, temp_dir: str, duration: float = 1.5) -> list[str]:
    """
    Render the feature text line with a word-by-word fade-in effect.
    Each word appears sequentially with a smooth opacity ramp.
    """
    num_frames = int(duration * FPS)
    font = _get_font(56, bold=True)
    words = line.split()
    frames = []

    # Background color for "invisible" text (matches gradient at center)
    bg_at_center = (12, 10, 16)
    text_color = (255, 255, 255)

    for frame_idx in range(num_frames):
        t = frame_idx / max(1, num_frames - 1)  # 0.0 → 1.0

        img = Image.new("RGB", (WIDTH, HEIGHT), (0, 0, 0))
        draw = ImageDraw.Draw(img)
        _draw_gradient_bg(draw)

        # Calculate how many words should be visible at this point
        # Each word fades in over ~0.15s, staggered
        lines = _wrap_text_lines(line, font, 900)
        line_height = font.size + 10
        total_text_height = line_height * len(lines)
        y_start = HEIGHT // 2 - total_text_height // 2

        # Track word index across wrapped lines
        word_idx_global = 0
        for li, text_line in enumerate(lines):
            line_words = text_line.split()
            # Measure total line width for centering
            full_line_width = font.getlength(text_line)
            x = (WIDTH - full_line_width) / 2
            y = y_start + li * line_height

            for wi, word in enumerate(line_words):
                # Each word starts appearing at a staggered time
                word_start = word_idx_global / max(1, len(words)) * 0.7  # 70% of duration for stagger
                word_t = max(0.0, min(1.0, (t - word_start) / 0.3))  # 0.3 = fade duration per word
                word_t = _ease_out_cubic(word_t)

                # Interpolate color from background to white
                color = _lerp_color(bg_at_center, text_color, word_t)
                draw.text((x, y), word, fill=color, font=font)

                # Advance x position
                word_width = font.getlength(word + " ")
                x += word_width
                word_idx_global += 1

        frame_path = os.path.join(temp_dir, f"reveal_text_{frame_idx:04d}.png")
        img.save(frame_path, "PNG")
        frames.append(frame_path)

    return frames


# ── Segment 2: Nesso App Walkthrough ────────────────────────────────────

# Ordered walkthrough — each screen shows a core feature, with caption
# that ties directly to the friendship-drift emotion in the text story.
WALKTHROUGH_SCREENS = [
    ("home.png", "never forget the people who matter"),
    ("home_contacts.png", "see when friendships are fading"),
    ("reach_out.png", "reach out before it's too late"),
    ("ai_suggestions.png", "AI writes the perfect message"),
]


def _render_single_screen_frames(
    screen_path: str,
    caption: str,
    num_frames: int,
    temp_dir: str,
    frame_prefix: str,
) -> list[str]:
    """Render frames for a single walkthrough screen with subtle zoom + caption."""
    screenshot = Image.open(screen_path).convert("RGB")
    screenshot = screenshot.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)

    zoom_start = 1.02
    zoom_end = 1.08
    overlay_font = _get_font(40, bold=True)

    frames = []
    for frame_idx in range(num_frames):
        t = frame_idx / max(1, num_frames - 1)
        t_smooth = _ease_in_out(t)

        zoom = zoom_start + (zoom_end - zoom_start) * t_smooth
        new_w = int(WIDTH * zoom)
        new_h = int(HEIGHT * zoom)

        zoomed = screenshot.resize((new_w, new_h), Image.Resampling.LANCZOS)
        crop_x = (new_w - WIDTH) // 2
        crop_y = (new_h - HEIGHT) // 2
        cropped = zoomed.crop((crop_x, crop_y, crop_x + WIDTH, crop_y + HEIGHT))

        # Solid dark band at bottom for caption readability
        draw = ImageDraw.Draw(cropped)
        band_h = 240
        band_top = HEIGHT - band_h
        draw.rectangle((0, band_top, WIDTH, HEIGHT), fill=(0, 0, 0))

        # Caption fades in quickly, holds full opacity
        text_opacity = max(0.0, min(1.0, t / 0.3))
        text_opacity = _ease_out_cubic(text_opacity)
        brightness = int(255 * text_opacity)
        color = (brightness, brightness, brightness)

        # Wrap caption if too wide
        lines = _wrap_text_lines(caption, overlay_font, 900)
        line_height = overlay_font.size + 8
        total_h = line_height * len(lines)
        y_start = band_top + (band_h - total_h) // 2
        for li, text_line in enumerate(lines):
            tw = overlay_font.getlength(text_line)
            tx = (WIDTH - tw) / 2
            ty = y_start + li * line_height
            draw.text((tx, ty), text_line, fill=color, font=overlay_font)

        frame_path = os.path.join(temp_dir, f"{frame_prefix}_{frame_idx:04d}.png")
        cropped.save(frame_path, "PNG")
        frames.append(frame_path)

    return frames


def _render_app_walkthrough_frames(temp_dir: str, duration: float = 5.0) -> list[str]:
    """
    Render a full Nesso app walkthrough — 4 screens in sequence, each with
    a caption tying back to the friendship drift emotion.
    """
    available = [
        (f, cap) for f, cap in WALKTHROUGH_SCREENS
        if os.path.exists(os.path.join(APP_SCREENS_DIR, f))
    ]
    if not available:
        return []

    frames_per_screen = int((duration * FPS) / len(available))
    all_frames: list[str] = []

    for i, (screen_file, caption) in enumerate(available):
        screen_path = os.path.join(APP_SCREENS_DIR, screen_file)
        screen_frames = _render_single_screen_frames(
            screen_path, caption, frames_per_screen, temp_dir,
            frame_prefix=f"reveal_walk_{i:02d}",
        )
        all_frames.extend(screen_frames)

    return all_frames


# ── Segment 3: Logo Scale-Up + Cascade CTA ──────────────────────────────

def _render_logo_cascade_frames(temp_dir: str, duration: float = 1.5) -> list[str]:
    """
    Animated logo reveal:
    - Logo scales from 75% to 100% with ease-out
    - "it's free" appears bright immediately alongside logo
    - @nesso.app fades in shortly after
    """
    num_frames = int(duration * FPS)
    frames = []

    # Load logo — scaled up for visibility
    logo_img = None
    logo_target_size = 360
    if os.path.exists(NESSO_LOGO_PATH):
        try:
            logo_img = Image.open(NESSO_LOGO_PATH).convert("RGBA")
        except Exception:
            pass

    font_main = _get_font(72, bold=True)
    font_handle = _get_font(40, bold=True)

    for frame_idx in range(num_frames):
        t = frame_idx / max(1, num_frames - 1)

        img = Image.new("RGB", (WIDTH, HEIGHT), (0, 0, 0))
        draw = ImageDraw.Draw(img)
        _draw_gradient_bg(draw)

        # Push logo higher so there's room below for text
        logo_y_center = HEIGHT // 2 - 160

        # Logo animation: scale 75% → 100% with ease-out
        logo_t = min(1.0, t / 0.4)
        logo_t = _ease_out_cubic(logo_t)
        current_logo_size = int(logo_target_size * (0.75 + 0.25 * logo_t))

        if logo_img:
            logo_resized = logo_img.resize(
                (current_logo_size, current_logo_size),
                Image.Resampling.LANCZOS,
            )
            logo_x = (WIDTH - current_logo_size) // 2
            logo_y = logo_y_center - current_logo_size // 2
            img.paste(logo_resized, (logo_x, logo_y), logo_resized)
        else:
            logo_x = (WIDTH - current_logo_size) // 2
            logo_y = logo_y_center - current_logo_size // 2
            draw.ellipse(
                (logo_x, logo_y, logo_x + current_logo_size, logo_y + current_logo_size),
                fill=(232, 212, 207),
            )

        text_base_y = logo_y_center + logo_target_size // 2 + 50

        # "it's free" — fades in FAST at t=0.15 → 0.4 (pure white for contrast)
        free_t = max(0.0, min(1.0, (t - 0.15) / 0.25))
        free_t = _ease_out_cubic(free_t)
        free_brightness = int(255 * free_t)
        free_color = (free_brightness, free_brightness, free_brightness)
        free_text = "it's free"
        free_width = font_main.getlength(free_text)
        draw.text(
            ((WIDTH - free_width) / 2, text_base_y),
            free_text, fill=free_color, font=font_main,
        )

        # @nesso.app — fades in at t=0.4 → 0.65, warm accent color
        handle_t = max(0.0, min(1.0, (t - 0.4) / 0.25))
        handle_t = _ease_out_cubic(handle_t)
        handle_brightness = int(handle_t * 255)
        # Warm peach tone matching Nesso brand
        handle_color = (
            int(232 * handle_t),
            int(212 * handle_t),
            int(207 * handle_t),
        )
        handle_text = "@nesso.app"
        handle_width = font_handle.getlength(handle_text)
        draw.text(
            ((WIDTH - handle_width) / 2, text_base_y + 110),
            handle_text, fill=handle_color, font=font_handle,
        )

        frame_path = os.path.join(temp_dir, f"reveal_logo_{frame_idx:04d}.png")
        img.save(frame_path, "PNG")
        frames.append(frame_path)

    return frames


# ── Main Entry Point ────────────────────────────────────────────────────

REMOTION_URL = os.environ.get("REMOTION_URL", "")  # e.g. http://remotion-reveal.railway.internal:3100


def _try_remotion_reveal(output_path: str, line: str) -> bool:
    """Try rendering via the Remotion microservice. Returns True on success."""
    if not REMOTION_URL:
        return False

    # Check for app screenshot to pass
    available = [f for f in APP_SCREENSHOTS if os.path.exists(os.path.join(APP_SCREENS_DIR, f))]
    screenshot_url = ""
    if available:
        # Remotion needs a URL or base64 — for Railway internal, use file:// or serve it
        # For now, skip screenshot in Remotion (logo + text is the main value)
        pass

    # Encode logo as data URL if it exists
    logo_url = ""
    if os.path.exists(NESSO_LOGO_PATH):
        import base64
        with open(NESSO_LOGO_PATH, "rb") as f:
            logo_b64 = base64.b64encode(f.read()).decode()
        logo_url = f"data:image/png;base64,{logo_b64}"

    payload = {
        "headline": line,
        "logoUrl": logo_url,
        "screenshotUrl": screenshot_url,
        "subtitleText": "it's free",
        "handleText": "@nesso.app",
        "accentColor": "#E8D4CF",
        "fps": FPS,
        "durationSeconds": 5.0,
    }

    try:
        resp = http_requests.post(
            f"{REMOTION_URL}/render",
            json=payload,
            timeout=60,
            stream=True,
        )
        if resp.status_code != 200:
            log.warning("Remotion returned %d: %s", resp.status_code, resp.text[:200])
            return False

        with open(output_path, "wb") as f:
            for chunk in resp.iter_content(8192):
                f.write(chunk)

        dur = get_duration(output_path)
        if dur < 1.0:
            log.warning("Remotion output too short (%.1fs), falling back to Pillow", dur)
            return False

        log.info("Remotion reveal rendered: %.1fs", dur)
        return True

    except Exception as e:
        log.warning("Remotion reveal failed, falling back to Pillow: %s", e)
        return False


def _pillow_reveal(output_path: str, line: str) -> str:
    """Pillow-based fallback reveal renderer (frame-by-frame animation).

    Structure (~8s total):
      1. Feature text fade-in (1.5s) — "this didn't have to happen"
      2. Nesso app walkthrough — 4 screens with captions (5.0s)
      3. Logo + "it's free" + @nesso.app CTA (1.5s)
    """
    temp_dir = os.path.dirname(output_path)

    all_frames = []

    # Segment 1: Text fade-in
    text_frames = _render_text_fadein_frames(line, temp_dir, duration=1.5)
    all_frames.extend(text_frames)

    # Segment 2: App walkthrough (4 screens × ~1.25s each)
    walkthrough_frames = _render_app_walkthrough_frames(temp_dir, duration=5.0)
    all_frames.extend(walkthrough_frames)

    # Segment 3: Logo + CTA
    logo_frames = _render_logo_cascade_frames(temp_dir, duration=1.5)
    all_frames.extend(logo_frames)

    if not all_frames:
        raise RuntimeError("No reveal frames generated")

    concat_file = os.path.join(temp_dir, "reveal_frames.txt")
    with open(concat_file, "w") as f:
        for fp in all_frames:
            safe = fp.replace("'", "'\\''")
            f.write(f"file '{safe}'\nduration {1/FPS}\n")
        safe = all_frames[-1].replace("'", "'\\''")
        f.write(f"file '{safe}'\n")

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-vf", f"fps={FPS}",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", FFMPEG_PRESET,
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    for fp in all_frames:
        try:
            os.remove(fp)
        except OSError:
            pass
    try:
        os.remove(concat_file)
    except OSError:
        pass

    if result.returncode != 0:
        raise RuntimeError(f"Reveal render failed: {result.stderr[-500:]}")

    return output_path


def render_nesso_reveal(output_path: str) -> str:
    """
    Render the animated Nesso reveal sequence.

    Tries Remotion microservice first (professional motion graphics with
    spring physics, CSS easing, anti-aliased text, ambient glow).
    Falls back to Pillow frame-by-frame animation if Remotion unavailable.
    """
    line = get_reveal_line()

    # Try Remotion first
    if _try_remotion_reveal(output_path, line):
        return output_path

    # Fallback to Pillow
    log.info("Using Pillow fallback for reveal")
    _pillow_reveal(output_path, line)

    reveal_dur = get_duration(output_path)
    log.info("Reveal rendered (Pillow): %s (%.1fs)", output_path, reveal_dur)
    return output_path
