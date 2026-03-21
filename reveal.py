"""
Nesso Content Engine V20 — Nesso Reveal Sequence

New flow (replaces old 3-frame reveal):
1. Feature text line (emotional hook → app connection)
2. App screen walkthrough — 3 random screens from the real app, each with
   a feature callout text overlay at the bottom
3. Logo + "it's free"
4. @nesso.app CTA

Total: ~14-16 seconds of app showcase (way more compelling than old 5s reveal)
"""

import logging
import os
import random
import subprocess
import textwrap

from PIL import Image, ImageDraw, ImageFont

from app_screens import FEATURE_SCREENS
from config import (
    BG_COLOR,
    FFMPEG_PRESET,
    FFMPEG_THREADS,
    FFMPEG_TIMEOUT,
    FPS,
    HEIGHT,
    NESSO_LOGO_PATH,
    TEXT_COLOR,
    WIDTH,
    get_reveal_line,
)
from verify import get_duration

log = logging.getLogger(__name__)


def _get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Get a system font."""
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


def _draw_centered_text(draw, text, y, font, fill=TEXT_COLOR):
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (WIDTH - text_width) / 2
    draw.text((x, y), text, fill=fill, font=font)
    return int(y + text_height + 10)


def _draw_centered_wrapped_text(draw, text, y, font, fill=TEXT_COLOR, max_width=900):
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    if text_width <= max_width:
        return _draw_centered_text(draw, text, y, font, fill)

    avg_char_width = font.getlength("m")
    chars_per_line = max(1, int(max_width / avg_char_width))
    lines = textwrap.wrap(text, width=chars_per_line)
    line_height = font.size + 8
    for line in lines:
        _draw_centered_text(draw, line, y, font, fill)
        y += line_height
    return y


def _add_feature_overlay(img: Image.Image, feature_text: str) -> Image.Image:
    """
    Add a semi-transparent bottom overlay with feature callout text
    on top of an app screenshot. Like a caption bar.
    """
    draw = ImageDraw.Draw(img)

    # Semi-transparent dark gradient at bottom
    overlay_h = 200
    for i in range(overlay_h):
        alpha = int(220 * (i / overlay_h))
        y = HEIGHT - overlay_h + i
        draw.line([(0, y), (WIDTH, y)], fill=(0, 0, 0), width=1)
        # Simulate transparency by drawing increasingly dark lines
        if i > overlay_h * 0.3:
            draw.line([(0, y), (WIDTH, y)], fill=(0, 0, 0), width=1)

    # Feature text
    font = _get_font(32, bold=True)
    text_y = HEIGHT - 130
    _draw_centered_wrapped_text(draw, feature_text, text_y, font, fill=(255, 255, 255), max_width=900)

    return img


def render_reveal_frame_text(line: str) -> Image.Image:
    """Render the opening feature text line."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    font = _get_font(38, bold=True)
    y_start = HEIGHT // 2 - 30
    _draw_centered_wrapped_text(draw, line, y_start, font, max_width=900)
    return img


def render_reveal_frame_logo() -> Image.Image:
    """Render the logo + 'it's free' frame."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    logo_size = 200
    if os.path.exists(NESSO_LOGO_PATH):
        try:
            logo = Image.open(NESSO_LOGO_PATH).convert("RGBA")
            logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
            logo_x = (WIDTH - logo_size) // 2
            logo_y = HEIGHT // 2 - logo_size // 2 - 60
            img.paste(logo, (logo_x, logo_y), logo)
        except Exception:
            logo_x = (WIDTH - logo_size) // 2
            logo_y = HEIGHT // 2 - logo_size // 2 - 60
            draw.ellipse(
                (logo_x, logo_y, logo_x + logo_size, logo_y + logo_size),
                fill=(0, 122, 255),
            )
    else:
        logo_x = (WIDTH - logo_size) // 2
        logo_y = HEIGHT // 2 - logo_size // 2 - 60
        draw.ellipse(
            (logo_x, logo_y, logo_x + logo_size, logo_y + logo_size),
            fill=(0, 122, 255),
        )

    font_main = _get_font(36, bold=True)
    text_y = HEIGHT // 2 + logo_size // 2 - 20
    _draw_centered_text(draw, "it's free", text_y, font_main)

    font_small = _get_font(24)
    _draw_centered_text(draw, "Nesso", text_y + 50, font_small, fill=(142, 142, 147))

    return img


def render_reveal_frame_cta() -> Image.Image:
    """Render the final @nesso.app CTA screen."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    font = _get_font(36, bold=True)
    _draw_centered_text(draw, "@nesso.app", HEIGHT // 2 - 20, font)
    return img


def render_nesso_reveal(output_path: str) -> str:
    """
    Render the complete Nesso reveal sequence:

    Frame 1: Feature text line (2s)
    Frames 2-4: App screenshots with feature overlays (2-2.5s each)
    Frame 5: Logo + "it's free" (2s)
    Frame 6: @nesso.app CTA (1.5s)

    Total: ~13-15 seconds
    """
    temp_dir = os.path.dirname(output_path)
    line = get_reveal_line()

    # Pick 3 random app screens to showcase (different features each time)
    screens = random.sample(FEATURE_SCREENS, min(3, len(FEATURE_SCREENS)))

    # ── Render all frames ────────────────────────────────────────────
    frames = []

    # Frame 1: Opening text
    frame_text = render_reveal_frame_text(line)
    path_text = os.path.join(temp_dir, "reveal_00_text.png")
    frame_text.save(path_text, "PNG")
    frames.append((path_text, 2.0))

    # Frames 2-4: App screenshots with feature overlays
    for i, screen in enumerate(screens):
        app_frame = screen["renderer"]()
        app_frame = _add_feature_overlay(app_frame, screen["feature_text"])
        path_screen = os.path.join(temp_dir, f"reveal_{i+1:02d}_app.png")
        app_frame.save(path_screen, "PNG")
        frames.append((path_screen, screen["duration"]))

    # Frame 5: Logo
    frame_logo = render_reveal_frame_logo()
    path_logo = os.path.join(temp_dir, "reveal_04_logo.png")
    frame_logo.save(path_logo, "PNG")
    frames.append((path_logo, 2.0))

    # Frame 6: CTA
    frame_cta = render_reveal_frame_cta()
    path_cta = os.path.join(temp_dir, "reveal_05_cta.png")
    frame_cta.save(path_cta, "PNG")
    frames.append((path_cta, 1.5))

    # ── Compile to video ─────────────────────────────────────────────
    concat_file = os.path.join(temp_dir, "reveal_concat.txt")
    with open(concat_file, "w") as f:
        for path, dur in frames:
            safe_path = path.replace("'", "'\\''")
            f.write(f"file '{safe_path}'\n")
            f.write(f"duration {dur}\n")
        # Repeat last frame to avoid black
        last_path = frames[-1][0].replace("'", "'\\''")
        f.write(f"file '{last_path}'\n")

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-r", str(FPS),
        "-vf", f"fps={FPS},scale={WIDTH}:{HEIGHT}",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", FFMPEG_PRESET,
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    # Cleanup
    for path, _ in frames:
        try:
            os.remove(path)
        except OSError:
            pass
    try:
        os.remove(concat_file)
    except OSError:
        pass

    if result.returncode != 0:
        raise RuntimeError(f"Reveal render failed: {result.stderr[-500:]}")

    reveal_dur = get_duration(output_path)
    log.info("Reveal rendered: %s (%.1fs) with %d app screens", output_path, reveal_dur, len(screens))
    return output_path
