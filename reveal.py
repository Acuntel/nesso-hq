"""
Nesso Content Engine V20 — Nesso Reveal Frame Generation

Renders the final reveal sequence:
1. One-liner about Nesso (text bubble or overlay)
2. Agent Mode mention
3. Nesso logo + "Free on the App Store"
4. Black screen + "Link in bio"
"""

import logging
import os
import subprocess

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
    TEXT_COLOR,
    WIDTH,
    get_reveal_lines,
)

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


def render_reveal_frame_text(line1: str, line2: str) -> Image.Image:
    """Render the text reveal frame (one-liner + agent mode mention)."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    font_main = _get_font(36, bold=True)
    font_sub = _get_font(28)

    # Center vertically
    y_start = HEIGHT // 2 - 60

    _draw_centered_text(draw, line1, y_start, font_main)
    _draw_centered_text(draw, line2, y_start + 60, font_sub, fill=(180, 180, 180))

    return img


def render_reveal_frame_logo() -> Image.Image:
    """Render the logo + 'Free on the App Store' frame."""
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
            logo_y = HEIGHT // 2 - logo_size // 2 - 40

            # Paste with alpha
            img.paste(logo, (logo_x, logo_y), logo)
        except Exception as e:
            log.warning("Could not load logo: %s", e)
            # Draw placeholder circle
            logo_x = (WIDTH - logo_size) // 2
            logo_y = HEIGHT // 2 - logo_size // 2 - 40
            draw.ellipse(
                (logo_x, logo_y, logo_x + logo_size, logo_y + logo_size),
                fill=(0, 122, 255),
            )
    else:
        # Placeholder
        logo_x = (WIDTH - logo_size) // 2
        logo_y = HEIGHT // 2 - logo_size // 2 - 40
        draw.ellipse(
            (logo_x, logo_y, logo_x + logo_size, logo_y + logo_size),
            fill=(0, 122, 255),
        )

    # "Free on the App Store" text below logo
    font = _get_font(30)
    text_y = HEIGHT // 2 + logo_size // 2
    _draw_centered_text(draw, "Free on the App Store", text_y, font)

    return img


def render_reveal_frame_black() -> Image.Image:
    """Render the final black screen with 'Link in bio'."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    font = _get_font(34, bold=True)
    _draw_centered_text(draw, "Link in bio", HEIGHT // 2 - 20, font)

    return img


def render_nesso_reveal(output_path: str) -> str:
    """
    Render the complete Nesso reveal sequence as a video.
    3 frames: text reveal → logo → black screen.
    Total duration: ~4 seconds.
    """
    temp_dir = os.path.dirname(output_path)
    line1, line2 = get_reveal_lines()

    # Render frames
    frame_text = render_reveal_frame_text(line1, line2)
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
        f.write(f"duration 1.5\n")  # Text reveal
        f.write(f"file '{path_logo}'\n")
        f.write(f"duration {REVEAL_DURATION}\n")  # Logo
        f.write(f"file '{path_black}'\n")
        f.write(f"duration {BLACK_SCREEN_DURATION}\n")  # Link in bio
        f.write(f"file '{path_black}'\n")  # Repeat last to avoid black frame

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

    # Cleanup
    for f in [path_text, path_logo, path_black, concat_file]:
        try:
            os.remove(f)
        except OSError:
            pass

    if result.returncode != 0:
        raise RuntimeError(f"Reveal render failed: {result.stderr[-500:]}")

    log.info("Reveal rendered: %s", output_path)
    return output_path
