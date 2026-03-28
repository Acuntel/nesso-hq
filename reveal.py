"""
Nesso Content Engine V20 — Nesso Reveal Sequence

Uses REAL app screenshots for the reveal, not Pillow fakes.
Flow:
1. Feature text line (2s)
2. 2 app screenshots with pan (2.5s each = 5s)
3. Logo + "it's free" + "Download on the App Store" + @nesso.app (2.5s)
Total: ~10s
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
        "feature_text": "never forget the people who matter",
        "duration": 2.5,
    },
    {
        "file": "home_contacts.png",
        "feature_text": "see when friendships are fading",
        "duration": 2.5,
    },
    {
        "file": "reach_out.png",
        "feature_text": "reach out in one tap",
        "duration": 2.5,
    },
    {
        "file": "ai_suggestions.png",
        "feature_text": "AI writes the perfect message",
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


def _create_pan_frames(screenshot_path: str, temp_dir: str, prefix: str, duration: float = 2.5) -> list[str]:
    """Create frames that pan down through a screenshot, simulating scrolling."""
    img = Image.open(screenshot_path).convert("RGB")
    orig_w, orig_h = img.size

    # Scale width to match video width, keep aspect ratio
    scale = WIDTH / orig_w
    new_w = WIDTH
    new_h = int(orig_h * scale)
    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    num_frames = int(duration * FPS)
    frames = []

    if new_h > HEIGHT:
        max_offset = new_h - HEIGHT
        for i in range(num_frames):
            # Ease in-out curve for smooth motion (smoothstep)
            t = i / max(1, num_frames - 1)
            t_smooth = t * t * (3 - 2 * t)
            y_offset = int(t_smooth * max_offset)

            cropped = img.crop((0, y_offset, WIDTH, y_offset + HEIGHT))
            frame_path = os.path.join(temp_dir, f"{prefix}_{i:04d}.png")
            cropped.save(frame_path, "PNG")
            frames.append(frame_path)
    else:
        # Image fits in frame, just center it
        padded = Image.new("RGB", (WIDTH, HEIGHT), (0, 0, 0))
        y_offset = (HEIGHT - new_h) // 2
        padded.paste(img, (0, y_offset))
        frame_path = os.path.join(temp_dir, f"{prefix}_0000.png")
        padded.save(frame_path, "PNG")
        frames = [frame_path] * num_frames

    return frames


def _render_pan_clip(screenshot_path: str, feature_text: str, temp_dir: str,
                     prefix: str, duration: float, output_path: str) -> str:
    """Render a panning screenshot clip with feature text overlay."""
    # Generate pan frames
    pan_frames = _create_pan_frames(screenshot_path, temp_dir, prefix, duration)

    # Add feature overlay to each frame
    font = _get_font(30, bold=True)
    for frame_path in pan_frames:
        frame_img = Image.open(frame_path).convert("RGB")
        frame_img = _add_feature_overlay(frame_img, feature_text)
        frame_img.save(frame_path, "PNG")

    # Compile frames into video clip using ffmpeg
    pattern = os.path.join(temp_dir, f"{prefix}_%04d.png")
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-framerate", str(FPS),
        "-i", pattern,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", FFMPEG_PRESET,
        "-vf", f"scale={WIDTH}:{HEIGHT}",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    # Cleanup pan frame images
    for fp in set(pan_frames):
        try:
            os.remove(fp)
        except OSError:
            pass

    if result.returncode != 0:
        raise RuntimeError(f"Pan clip render failed: {result.stderr[-500:]}")

    return output_path


def render_reveal_frame_text(line: str) -> Image.Image:
    """Render the opening feature text line."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    font = _get_font(42, bold=True)
    y_start = HEIGHT // 2 - 40
    _draw_centered_wrapped_text(draw, line, y_start, font, max_width=900)
    return img


def render_reveal_frame_logo() -> Image.Image:
    """Render the logo + 'it's free' + App Store CTA frame."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    logo_size = 320
    logo_y_center = HEIGHT // 2 - 100

    if os.path.exists(NESSO_LOGO_PATH):
        try:
            logo = Image.open(NESSO_LOGO_PATH).convert("RGBA")
            logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
            logo_x = (WIDTH - logo_size) // 2
            logo_y = logo_y_center - logo_size // 2
            img.paste(logo, (logo_x, logo_y), logo)
        except Exception:
            logo_x = (WIDTH - logo_size) // 2
            logo_y = logo_y_center - logo_size // 2
            draw.ellipse(
                (logo_x, logo_y, logo_x + logo_size, logo_y + logo_size),
                fill=(232, 212, 207),
            )
    else:
        logo_x = (WIDTH - logo_size) // 2
        logo_y = logo_y_center - logo_size // 2
        draw.ellipse(
            (logo_x, logo_y, logo_x + logo_size, logo_y + logo_size),
            fill=(232, 212, 207),
        )

    # "it's free" — large
    text_y = logo_y_center + logo_size // 2 + 20
    font_main = _get_font(42, bold=True)
    _draw_centered_text(draw, "it's free", text_y, font_main)

    # "Nesso" brand name
    font_brand = _get_font(28)
    _draw_centered_text(draw, "Nesso", text_y + 55, font_brand, fill=(142, 142, 147))

    # "Download on the App Store"
    font_store = _get_font(30, bold=True)
    _draw_centered_text(draw, "Download on the App Store", text_y + 105, font_store, fill=(255, 255, 255))

    # @nesso.app handle
    font_handle = _get_font(24)
    _draw_centered_text(draw, "@nesso.app", text_y + 155, font_handle, fill=(142, 142, 147))

    return img


def render_reveal_frame_cta() -> Image.Image:
    """Render the final @nesso.app CTA screen."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    font = _get_font(36, bold=True)
    _draw_centered_text(draw, "@nesso.app", HEIGHT // 2 - 20, font)
    return img


def _static_frame_to_clip(image_path: str, duration: float, output_path: str) -> str:
    """Convert a static PNG frame into a video clip of the given duration."""
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-loop", "1",
        "-i", image_path,
        "-t", str(duration),
        "-r", str(FPS),
        "-vf", f"scale={WIDTH}:{HEIGHT}",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", FFMPEG_PRESET,
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        raise RuntimeError(f"Static frame to clip failed: {result.stderr[-500:]}")
    return output_path


def render_nesso_reveal(output_path: str) -> str:
    """
    Render the Nesso reveal using REAL app screenshots.

    Segment 1: Feature text line (2s)
    Segments 2-3: 2 app screenshots with pan animation (2.5s each = 5s)
    Segment 4: Logo + "it's free" + App Store CTA + @nesso.app (2.5s)

    Total: ~10s
    """
    temp_dir = os.path.dirname(output_path)
    line = get_reveal_line()

    # Pick 2 random real screenshots
    available_screens = [s for s in REAL_SCREENS if os.path.exists(os.path.join(APP_SCREENS_DIR, s["file"]))]

    if not available_screens:
        log.warning("No real app screenshots found, using text-only reveal")
        available_screens = []

    screens = random.sample(available_screens, min(2, len(available_screens)))

    # ── Render all segments ──────────────────────────────────────────
    # Static frames use concat demuxer; pan clips are pre-rendered videos.
    # We normalize everything to video clips, then concat them all.
    segment_clips = []

    # Segment 1: Opening text (2s)
    frame_text = render_reveal_frame_text(line)
    path_text = os.path.join(temp_dir, "reveal_00_text.png")
    frame_text.save(path_text, "PNG")
    clip_text = os.path.join(temp_dir, "reveal_00_text.mp4")
    _static_frame_to_clip(path_text, 2.0, clip_text)
    segment_clips.append(clip_text)

    # Segments 2-3: Real app screenshots with PAN animation (2.5s each)
    for i, screen in enumerate(screens):
        screenshot_path = os.path.join(APP_SCREENS_DIR, screen["file"])
        if os.path.exists(screenshot_path):
            clip_path = os.path.join(temp_dir, f"reveal_{i+1:02d}_pan.mp4")
            _render_pan_clip(
                screenshot_path=screenshot_path,
                feature_text=screen["feature_text"],
                temp_dir=temp_dir,
                prefix=f"pan_{i+1:02d}",
                duration=screen["duration"],
                output_path=clip_path,
            )
            segment_clips.append(clip_path)

    # Segment 4: Logo + CTA (2.5s — slightly longer so viewers can read App Store text)
    frame_logo = render_reveal_frame_logo()
    path_logo = os.path.join(temp_dir, "reveal_04_logo.png")
    frame_logo.save(path_logo, "PNG")
    clip_logo = os.path.join(temp_dir, "reveal_04_logo.mp4")
    _static_frame_to_clip(path_logo, 2.5, clip_logo)
    segment_clips.append(clip_logo)

    # ── Concat all segment clips ─────────────────────────────────────
    concat_file = os.path.join(temp_dir, "reveal_concat.txt")
    with open(concat_file, "w") as f:
        for clip in segment_clips:
            safe_path = clip.replace("'", "'\\''")
            f.write(f"file '{safe_path}'\n")

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-c", "copy",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    # Cleanup all intermediate files
    for clip in segment_clips:
        try:
            os.remove(clip)
        except OSError:
            pass
    for png in [path_text, path_logo]:
        try:
            os.remove(png)
        except OSError:
            pass
    try:
        os.remove(concat_file)
    except OSError:
        pass

    if result.returncode != 0:
        raise RuntimeError(f"Reveal render failed: {result.stderr[-500:]}")

    reveal_dur = get_duration(output_path)
    log.info("Reveal rendered: %s (%.1fs) with %d real app screens (pan effect)", output_path, reveal_dur, len(screens))
    return output_path
