"""
Nesso Content Engine V20 — Nesso Reveal Sequence

Uses REAL app screenshots for the reveal, not Pillow fakes.
Flow:
1. Feature text line (2s)
2. Real app screenshots with feature overlays (2s each)
3. Logo + "it's free" (2s)
4. @nesso.app CTA (1.5s)
"""

import logging
import os
import random
import subprocess

from PIL import Image, ImageDraw, ImageFont

from config import (
    ASSETS_DIR,
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

# ── Real app screenshot paths ────────────────────────────────────────────
APP_SCREENS_DIR = os.path.join(ASSETS_DIR, "app_screens")

REAL_SCREENS = [
    {
        "file": "home.png",
        "feature_text": "track everyone who matters in one place",
        "duration": 2.5,
    },
    {
        "file": "home_contacts.png",
        "feature_text": "see your inner circle at a glance",
        "duration": 2.0,
    },
    {
        "file": "reach_out.png",
        "feature_text": "reach out in seconds — text, call, or email",
        "duration": 2.5,
    },
    {
        "file": "ai_suggestions.png",
        "feature_text": "AI writes the perfect message for you",
        "duration": 2.5,
    },
]


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
    import textwrap
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


def _load_real_screenshot(filename: str) -> Image.Image | None:
    """Load a real app screenshot and scale to video dimensions."""
    path = os.path.join(APP_SCREENS_DIR, filename)
    if not os.path.exists(path):
        log.warning("App screenshot not found: %s", path)
        return None

    try:
        img = Image.open(path).convert("RGB")
        img = img.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
        return img
    except Exception as e:
        log.warning("Failed to load screenshot %s: %s", filename, e)
        return None


def _add_feature_overlay(img: Image.Image, feature_text: str) -> Image.Image:
    """Add a gradient overlay at the bottom with feature text."""
    draw = ImageDraw.Draw(img)

    # Dark gradient at bottom for text readability
    overlay_h = 180
    for i in range(overlay_h):
        alpha = int(240 * (i / overlay_h) ** 1.5)
        y = HEIGHT - overlay_h + i
        draw.line([(0, y), (WIDTH, y)], fill=(0, 0, 0), width=1)

    # Feature text
    font = _get_font(30, bold=True)
    text_y = HEIGHT - 100
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
                fill=(232, 212, 207),
            )
    else:
        logo_x = (WIDTH - logo_size) // 2
        logo_y = HEIGHT // 2 - logo_size // 2 - 60
        draw.ellipse(
            (logo_x, logo_y, logo_x + logo_size, logo_y + logo_size),
            fill=(232, 212, 207),
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
    Render the Nesso reveal using REAL app screenshots.

    Frame 1: Feature text line (2s)
    Frames 2-3: Real app screenshots with feature overlays (2-2.5s each)
    Frame 4: Logo + "it's free" (2s)
    Frame 5: @nesso.app CTA (1.5s)

    Total: ~10-11 seconds
    """
    temp_dir = os.path.dirname(output_path)
    line = get_reveal_line()

    # Pick 2 random real screenshots
    available_screens = [s for s in REAL_SCREENS if os.path.exists(os.path.join(APP_SCREENS_DIR, s["file"]))]

    if not available_screens:
        log.warning("No real app screenshots found, using text-only reveal")
        available_screens = []

    screens = random.sample(available_screens, min(2, len(available_screens)))

    # ── Render all frames ────────────────────────────────────────────
    frames = []

    # Frame 1: Opening text
    frame_text = render_reveal_frame_text(line)
    path_text = os.path.join(temp_dir, "reveal_00_text.png")
    frame_text.save(path_text, "PNG")
    frames.append((path_text, 2.0))

    # Frames 2-3: Real app screenshots with feature overlays
    for i, screen in enumerate(screens):
        app_img = _load_real_screenshot(screen["file"])
        if app_img:
            app_img = _add_feature_overlay(app_img, screen["feature_text"])
            path_screen = os.path.join(temp_dir, f"reveal_{i+1:02d}_app.png")
            app_img.save(path_screen, "PNG")
            frames.append((path_screen, screen["duration"]))

    # Frame 4: Logo
    frame_logo = render_reveal_frame_logo()
    path_logo = os.path.join(temp_dir, "reveal_04_logo.png")
    frame_logo.save(path_logo, "PNG")
    frames.append((path_logo, 2.0))

    # Frame 5: CTA
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
    log.info("Reveal rendered: %s (%.1fs) with %d real app screens", output_path, reveal_dur, len(screens))
    return output_path
