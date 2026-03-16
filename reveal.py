"""
Nesso Content Engine V20 — Nesso Reveal Frame Generation

Conversion-optimized 3-frame reveal (~5 seconds):
1. Single feature line tied to the text conversation emotion
2. Nesso logo + "it's free"
3. @nesso.app CTA
"""

import logging
import os
import subprocess
import textwrap

from PIL import Image, ImageDraw, ImageFont

from config import (
    BG_COLOR,
    BLACK_SCREEN_DURATION,
    FFMPEG_PRESET,
    FFMPEG_THREADS,
    FFMPEG_TIMEOUT,
    FPS,
    HEIGHT,
    NESSO_LOGO_PATH,
    REVEAL_DURATION,
    REVEAL_TEXT_DURATION,
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


def _draw_centered_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int] = TEXT_COLOR,
) -> int:
    """Draw text centered horizontally. Returns y position after text."""
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (WIDTH - text_width) / 2
    draw.text((x, y), text, fill=fill, font=font)
    return int(y + text_height + 10)


def _draw_centered_wrapped_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int] = TEXT_COLOR,
    max_width: int = 900,
) -> int:
    """Draw text centered, wrapping if it exceeds max_width."""
    # Check if text fits in one line
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]

    if text_width <= max_width:
        return _draw_centered_text(draw, text, y, font, fill)

    # Wrap text
    avg_char_width = font.getlength("m")
    chars_per_line = max(1, int(max_width / avg_char_width))
    lines = textwrap.wrap(text, width=chars_per_line)

    line_height = font.size + 8
    for line in lines:
        _draw_centered_text(draw, line, y, font, fill)
        y += line_height

    return y


def render_reveal_frame_text(line: str) -> Image.Image:
    """Render the single feature line centered on screen."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    font = _get_font(38, bold=True)

    # Center vertically
    y_start = HEIGHT // 2 - 30

    _draw_centered_wrapped_text(draw, line, y_start, font, max_width=900)

    return img


def render_reveal_frame_logo() -> Image.Image:
    """Render the logo + 'it's free' frame."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Load and resize logo
    logo_size = 200
    if os.path.exists(NESSO_LOGO_PATH):
        try:
            logo = Image.open(NESSO_LOGO_PATH).convert("RGBA")
            logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)

            # Center logo
            logo_x = (WIDTH - logo_size) // 2
            logo_y = HEIGHT // 2 - logo_size // 2 - 60

            # Paste with alpha
            img.paste(logo, (logo_x, logo_y), logo)
        except Exception as e:
            log.warning("Could not load logo: %s", e)
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

    # "it's free" — casual, high-converting CTA
    font_main = _get_font(36, bold=True)
    text_y = HEIGHT // 2 + logo_size // 2 - 20
    _draw_centered_text(draw, "it's free", text_y, font_main)

    # Small "Nesso" below for searchability
    font_small = _get_font(24)
    _draw_centered_text(draw, "Nesso", text_y + 50, font_small, fill=(142, 142, 147))

    return img


def render_reveal_frame_black() -> Image.Image:
    """Render the final CTA screen with @nesso.app handle."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    font = _get_font(36, bold=True)
    _draw_centered_text(draw, "@nesso.app", HEIGHT // 2 - 20, font)

    return img


def render_nesso_reveal(output_path: str) -> str:
    """
    Render the complete Nesso reveal sequence as a video.
    3 frames: feature line → logo + "it's free" → @nesso.app
    Total duration: ~5 seconds.
    """
    temp_dir = os.path.dirname(output_path)
    line = get_reveal_line()

    # Render frames
    frame_text = render_reveal_frame_text(line)
    frame_logo = render_reveal_frame_logo()
    frame_black = render_reveal_frame_black()

    # Save as PNGs
    path_text = os.path.join(temp_dir, "reveal_text.png")
    path_logo = os.path.join(temp_dir, "reveal_logo.png")
    path_black = os.path.join(temp_dir, "reveal_black.png")

    frame_text.save(path_text, "PNG")
    frame_logo.save(path_logo, "PNG")
    frame_black.save(path_black, "PNG")

    # Create concat file
    concat_file = os.path.join(temp_dir, "reveal_concat.txt")
    with open(concat_file, "w") as f:
        f.write(f"file '{path_text}'\n")
        f.write(f"duration {REVEAL_TEXT_DURATION}\n")
        f.write(f"file '{path_logo}'\n")
        f.write(f"duration {REVEAL_DURATION}\n")
        f.write(f"file '{path_black}'\n")
        f.write(f"duration {BLACK_SCREEN_DURATION}\n")
        f.write(f"file '{path_black}'\n")  # Repeat last to avoid black frame

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-r", str(FPS),  # Force matching framerate for reliable concat
        "-vf", f"fps={FPS},scale={WIDTH}:{HEIGHT}",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", FFMPEG_PRESET,
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    # Cleanup
    for f in [path_text, path_logo, path_black, concat_file]:
        try:
            os.remove(f)
        except OSError:
            pass

    if result.returncode != 0:
        raise RuntimeError(f"Reveal render failed: {result.stderr[-500:]}")

    # Verify reveal duration
    reveal_dur = get_duration(output_path)
    expected_dur = REVEAL_TEXT_DURATION + REVEAL_DURATION + BLACK_SCREEN_DURATION
    if reveal_dur < expected_dur * 0.8:
        log.warning(
            "Reveal duration %.1fs is shorter than expected %.1fs",
            reveal_dur, expected_dur,
        )

    log.info("Reveal rendered: %s (%.1fs)", output_path, reveal_dur)
    return output_path
