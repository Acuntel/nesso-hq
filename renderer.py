"""
Nesso Content Engine V20 — PIL Text Bubble Rendering + FFmpeg Frame Compilation

Renders iMessage-style text conversations frame by frame using Pillow,
then compiles PNGs to video via FFmpeg. No FFmpeg drawtext (breaks on Railway).
"""

import logging
import os
import subprocess
import textwrap

from PIL import Image, ImageDraw, ImageFont

from config import (
    BG_COLOR,
    BUBBLE_PAD_H,
    BUBBLE_PAD_V,
    BUBBLE_RADIUS,
    CONTACT_FONT_SIZE,
    CONTACT_NAME_COLOR,
    FFMPEG_PRESET,
    FFMPEG_THREADS,
    FFMPEG_TIMEOUT,
    FONT_SIZE,
    FPS,
    HEIGHT,
    MAX_BUBBLE_WIDTH,
    ME_BUBBLE_COLOR,
    MESSAGE_GAP,
    OTHER_BUBBLE_COLOR,
    SAFE_BOTTOM,
    SAFE_LEFT,
    SAFE_TOP,
    SAFE_WIDTH,
    SYSTEM_TEXT_COLOR,
    TEXT_COLOR,
    TOP_BAR_CHEVRON_COLOR,
    TOP_BAR_COLOR,
    TOP_BAR_HEIGHT,
    TOP_BAR_TEXT_COLOR,
    TYPING_BUBBLE_COLOR,
    TYPING_DOT_COLOR,
    TYPING_INDICATOR_DURATION,
    WIDTH,
)

log = logging.getLogger(__name__)


def _get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Get a system font. Try SF Pro, then fall back to DejaVu/Arial."""
    font_paths = [
        # macOS SF Pro
        "/System/Library/Fonts/SFProDisplay-Regular.otf",
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/SFNSText.ttf",
        # macOS Helvetica Neue
        "/System/Library/Fonts/HelveticaNeue.ttc",
        # Linux DejaVu
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        # Fallback
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    if bold:
        bold_paths = [
            "/System/Library/Fonts/SFProDisplay-Bold.otf",
            "/System/Library/Fonts/HelveticaNeue.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ]
        font_paths = bold_paths + font_paths

    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue

    # Ultimate fallback — PIL default
    return ImageFont.load_default()


def _get_italic_font(size: int) -> ImageFont.FreeTypeFont:
    """Get an italic system font for system messages."""
    italic_paths = [
        "/System/Library/Fonts/SFProDisplay-RegularItalic.otf",
        "/System/Library/Fonts/SFProText-RegularItalic.otf",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf",
    ]
    for path in italic_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    # Fall back to regular font if no italic available
    return _get_font(size)


def _wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Word-wrap text to fit within max_width pixels."""
    # Start with rough character estimate
    avg_char_width = font.getlength("m")
    chars_per_line = max(1, int(max_width / avg_char_width))

    lines = textwrap.wrap(text, width=chars_per_line)

    # Verify each line fits, re-wrap if needed
    final_lines = []
    for line in lines:
        while font.getlength(line) > max_width and len(line) > 1:
            # Find last space that fits
            for i in range(len(line) - 1, 0, -1):
                if line[i] == " " and font.getlength(line[:i]) <= max_width:
                    final_lines.append(line[:i])
                    line = line[i + 1:]
                    break
            else:
                # No space found, hard break
                for i in range(len(line) - 1, 0, -1):
                    if font.getlength(line[:i]) <= max_width:
                        final_lines.append(line[:i])
                        line = line[i:]
                        break
                else:
                    break
        final_lines.append(line)

    return final_lines if final_lines else [text]


def _draw_rounded_rect(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    radius: int,
    fill: tuple[int, int, int],
):
    """Draw a rounded rectangle."""
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def _draw_top_bar(
    draw: ImageDraw.ImageDraw,
    contact_name: str,
    bold_font: ImageFont.FreeTypeFont,
    timestamp: str = "",
):
    """Draw an iPhone-style iMessage top bar with contact name and back chevron."""
    # Dark bar background
    draw.rectangle(
        (0, 0, WIDTH, TOP_BAR_HEIGHT),
        fill=TOP_BAR_COLOR,
    )
    # Thin separator line at bottom of bar
    draw.line(
        (0, TOP_BAR_HEIGHT, WIDTH, TOP_BAR_HEIGHT),
        fill=(58, 58, 60),
        width=1,
    )

    # Back chevron on left side
    chevron_font = _get_font(38)
    draw.text(
        (SAFE_LEFT - 10, TOP_BAR_HEIGHT // 2 - 20),
        "\u2039",
        fill=TOP_BAR_CHEVRON_COLOR,
        font=chevron_font,
    )

    # Contact name centered
    name_width = bold_font.getlength(contact_name)
    name_x = (WIDTH - name_width) / 2
    name_y = TOP_BAR_HEIGHT // 2 - CONTACT_FONT_SIZE // 2 - 2
    draw.text(
        (name_x, name_y),
        contact_name,
        fill=TOP_BAR_TEXT_COLOR,
        font=bold_font,
    )

    # Late-night timestamp on right side (consistent across all frames)
    if timestamp:
        time_font = _get_font(18)
        ts_width = time_font.getlength(timestamp)
        draw.text(
            (WIDTH - SAFE_LEFT - ts_width, name_y + 4),
            timestamp,
            fill=(142, 142, 147),
            font=time_font,
        )


def _draw_typing_indicator(
    draw: ImageDraw.ImageDraw,
    y_pos: int,
    contact_font: ImageFont.FreeTypeFont,
    sender_name: str,
) -> int:
    """Draw a typing indicator bubble (three dots) for incoming messages."""
    # Contact name
    draw.text(
        (SAFE_LEFT + 8, y_pos),
        sender_name,
        fill=CONTACT_NAME_COLOR,
        font=contact_font,
    )
    name_height = CONTACT_FONT_SIZE + 4
    bubble_y = y_pos + name_height

    # Small bubble with three dots
    bubble_width = 80
    bubble_height = 44
    bubble_x = SAFE_LEFT

    _draw_rounded_rect(
        draw,
        (bubble_x, bubble_y, bubble_x + bubble_width, bubble_y + bubble_height),
        BUBBLE_RADIUS,
        TYPING_BUBBLE_COLOR,
    )

    # Three dots
    dot_radius = 5
    dot_y = bubble_y + bubble_height // 2
    dot_start_x = bubble_x + 20
    dot_gap = 16
    for j in range(3):
        cx = dot_start_x + j * dot_gap
        draw.ellipse(
            (cx - dot_radius, dot_y - dot_radius, cx + dot_radius, dot_y + dot_radius),
            fill=TYPING_DOT_COLOR,
        )

    return bubble_y + bubble_height + MESSAGE_GAP


def _measure_message_height(
    msg: dict,
    font: ImageFont.FreeTypeFont,
    contact_font: ImageFont.FreeTypeFont,
    system_font: ImageFont.FreeTypeFont,
    show_name: bool = True,
) -> int:
    """Calculate the pixel height a message will occupy (bubble + gap)."""
    sender = msg["sender"]
    is_me = sender == "me"
    is_system = sender == "system"

    if is_system:
        return CONTACT_FONT_SIZE + MESSAGE_GAP * 2

    text_max_width = MAX_BUBBLE_WIDTH - BUBBLE_PAD_H * 2
    lines = _wrap_text(msg["text"], font, text_max_width)
    line_height = FONT_SIZE + 4
    text_height = line_height * len(lines)
    bubble_height = int(text_height + BUBBLE_PAD_V * 2)
    name_height = 0 if (is_me or not show_name) else CONTACT_FONT_SIZE + 4

    return name_height + bubble_height + MESSAGE_GAP


def render_message_bubble(
    draw: ImageDraw.ImageDraw,
    msg: dict,
    y_pos: int,
    font: ImageFont.FreeTypeFont,
    contact_font: ImageFont.FreeTypeFont,
    system_font: ImageFont.FreeTypeFont | None = None,
    show_delivered: bool = False,
    show_name: bool = True,
) -> int:
    """
    Draw a single message bubble and return the new y_pos after it.

    show_name: If False, skip the contact name label above incoming bubbles.
    Used to consolidate consecutive messages from the same sender.
    """
    sender = msg["sender"]
    text = msg["text"]
    is_me = sender == "me"
    is_system = sender == "system"

    if is_system:
        # System messages (read receipts, delivered, typing...) — centered, italic, smaller
        render_font = system_font if system_font else contact_font
        text_width = render_font.getlength(text)
        x = SAFE_LEFT + (SAFE_WIDTH - text_width) / 2
        draw.text((x, y_pos), text, fill=SYSTEM_TEXT_COLOR, font=render_font)
        return int(y_pos + CONTACT_FONT_SIZE + MESSAGE_GAP * 2)

    # Text wrapping
    text_max_width = MAX_BUBBLE_WIDTH - BUBBLE_PAD_H * 2
    lines = _wrap_text(text, font, text_max_width)

    # Calculate bubble dimensions
    line_height = FONT_SIZE + 4
    text_height = line_height * len(lines)
    bubble_width = max(font.getlength(line) for line in lines) + BUBBLE_PAD_H * 2
    bubble_width = min(int(bubble_width), MAX_BUBBLE_WIDTH)
    bubble_height = int(text_height + BUBBLE_PAD_V * 2)

    # Draw contact name for non-"me" messages (only when sender changes)
    name_height = 0
    if not is_me and show_name:
        name = sender
        draw.text(
            (SAFE_LEFT + 8, y_pos),
            name,
            fill=CONTACT_NAME_COLOR,
            font=contact_font,
        )
        name_height = CONTACT_FONT_SIZE + 4

    bubble_y = y_pos + name_height

    if is_me:
        # Right-aligned blue bubble
        bubble_x = SAFE_LEFT + SAFE_WIDTH - bubble_width
        bubble_color = ME_BUBBLE_COLOR
    else:
        # Left-aligned gray bubble
        bubble_x = SAFE_LEFT
        bubble_color = OTHER_BUBBLE_COLOR

    # Draw bubble
    _draw_rounded_rect(
        draw,
        (bubble_x, bubble_y, bubble_x + bubble_width, bubble_y + bubble_height),
        BUBBLE_RADIUS,
        bubble_color,
    )

    # Draw text inside bubble
    text_x = bubble_x + BUBBLE_PAD_H
    text_y = bubble_y + BUBBLE_PAD_V
    for line in lines:
        draw.text((text_x, text_y), line, fill=TEXT_COLOR, font=font)
        text_y += line_height

    # Show "Delivered" status below the bubble if requested
    if show_delivered and is_me:
        status_font = system_font if system_font else contact_font
        status_text = "Delivered"
        status_width = status_font.getlength(status_text)
        status_x = SAFE_LEFT + SAFE_WIDTH - status_width
        status_y = bubble_y + bubble_height + 4
        draw.text((status_x, status_y), status_text, fill=SYSTEM_TEXT_COLOR, font=status_font)
        return int(status_y + CONTACT_FONT_SIZE + MESSAGE_GAP)

    return bubble_y + bubble_height + MESSAGE_GAP


def _get_contact_name(messages: list[dict]) -> str:
    """Extract the contact name from the conversation (first non-me, non-system sender)."""
    for msg in messages:
        if msg["sender"] not in ("me", "system"):
            return msg["sender"]
    return "best friend"


def _compute_show_name_flags(messages: list[dict]) -> list[bool]:
    """
    For each message, return True if the contact name label should be drawn.
    Only show above the FIRST message of a run from the same non-me sender.
    System messages don't affect runs (they're just centered pauses).
    """
    flags: list[bool] = []
    last_real_sender: str | None = None
    for msg in messages:
        sender = msg.get("sender", "")
        if sender == "system":
            flags.append(True)  # unused for system
            continue
        if sender == "me":
            flags.append(False)  # "me" never has a name label
            last_real_sender = "me"
            continue
        # Incoming message — show name only when sender changes
        show = sender != last_real_sender
        flags.append(show)
        last_real_sender = sender
    return flags


def render_text_story_frames(
    messages: list[dict],
    temp_dir: str,
    voiceover_active: bool = False,
    start_from_msg: int = 0,
) -> list[tuple[str, float]]:
    """
    Render the text story as a series of PNG frames.
    Each frame shows all messages up to that point.
    Messages are bottom-aligned like real iMessage.

    start_from_msg: If > 0, only render frames for messages starting at this index,
                    but show earlier messages as already-visible context.
                    Used for Part 2 rendering (shows Part 1 messages as backdrop).

    Returns list of (frame_path, duration_seconds) tuples.
    """
    font = _get_font(FONT_SIZE)
    contact_font = _get_font(CONTACT_FONT_SIZE, bold=True)
    system_font = _get_italic_font(CONTACT_FONT_SIZE - 4)

    contact_name = _get_contact_name(messages)
    show_name_flags = _compute_show_name_flags(messages)

    frames = []

    # Generate timestamp once for consistency across all frames
    import random as _ts_rnd
    _ts_hour = _ts_rnd.choice([11, 12, 1, 2, 3])
    _ts_minute = _ts_rnd.randint(0, 59)
    _ts_ampm = "AM" if _ts_hour <= 3 else "PM"
    if _ts_hour == 12:
        _ts_ampm = "AM"
    frame_timestamp = f"{_ts_hour}:{_ts_minute:02d} {_ts_ampm}"

    # Content area: below top bar, above safe bottom
    content_top = TOP_BAR_HEIGHT + 10
    content_bottom = HEIGHT - SAFE_BOTTOM - 20

    # When rendering Part 2, skip generating frames for Part 1 messages
    # (they'll still appear as visible context in each frame)
    render_start = start_from_msg if start_from_msg > 0 else 0

    frame_count = 0
    for msg_idx in range(render_start, len(messages)):
        current_msg = messages[msg_idx]
        is_incoming = current_msg["sender"] not in ("me", "system")

        # Insert typing indicator frame BEFORE incoming messages
        # Skip when voiceover is active — typing frames would desync audio from visuals
        if is_incoming and msg_idx > 0 and not voiceover_active:
            # Render typing indicator frame — shows all messages up to msg_idx-1 plus typing bubble
            img_typing = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
            draw_typing = ImageDraw.Draw(img_typing)
            _draw_top_bar(draw_typing, contact_name, contact_font, frame_timestamp)

            visible_messages = messages[:msg_idx]
            visible_flags = show_name_flags[:msg_idx]
            max_visible = _count_fitting_messages(visible_messages, font, contact_font, system_font)
            if max_visible < len(visible_messages):
                visible_messages = visible_messages[-max_visible:]
                visible_flags = visible_flags[-max_visible:]

            total_content_height = sum(
                _measure_message_height(m, font, contact_font, system_font, show_name=flag)
                for m, flag in zip(visible_messages, visible_flags)
            )
            # Add space for typing indicator
            typing_height = CONTACT_FONT_SIZE + 4 + 44 + MESSAGE_GAP
            total_with_typing = total_content_height + typing_height

            available_height = content_bottom - content_top
            if total_with_typing < available_height:
                y_pos = content_bottom - total_with_typing
            else:
                y_pos = content_top

            for m, flag in zip(visible_messages, visible_flags):
                y_pos = render_message_bubble(
                    draw_typing, m, y_pos, font, contact_font, system_font,
                    show_name=flag,
                )
                if y_pos > content_bottom - typing_height:
                    break

            # Draw typing indicator at the bottom
            _draw_typing_indicator(draw_typing, y_pos, contact_font, current_msg["sender"])

            typing_path = os.path.join(temp_dir, f"frame_{frame_count:04d}.png")
            img_typing.save(typing_path, "PNG")
            frames.append((typing_path, TYPING_INDICATOR_DURATION))
            frame_count += 1

        # Render the actual message frame (shows all messages up to msg_idx)
        img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
        draw = ImageDraw.Draw(img)
        _draw_top_bar(draw, contact_name, contact_font, frame_timestamp)

        visible_messages = messages[:msg_idx + 1]
        visible_flags = show_name_flags[:msg_idx + 1]
        max_visible = _count_fitting_messages(visible_messages, font, contact_font, system_font)
        if max_visible < len(visible_messages):
            visible_messages = visible_messages[-max_visible:]
            visible_flags = visible_flags[-max_visible:]

        total_content_height = sum(
            _measure_message_height(m, font, contact_font, system_font, show_name=flag)
            for m, flag in zip(visible_messages, visible_flags)
        )

        available_height = content_bottom - content_top
        # ALWAYS bottom-align like real iMessage. No upper-center fallback —
        # it made single messages float oddly in the middle of the screen.
        if total_content_height < available_height:
            y_pos = content_bottom - total_content_height
        else:
            y_pos = content_top

        for m, flag in zip(visible_messages, visible_flags):
            y_pos = render_message_bubble(
                draw, m, y_pos, font, contact_font, system_font,
                show_name=flag,
            )
            if y_pos > content_bottom:
                break

        frame_path = os.path.join(temp_dir, f"frame_{frame_count:04d}.png")
        img.save(frame_path, "PNG")

        duration = messages[msg_idx].get("delay", 1.2)
        frames.append((frame_path, duration))
        frame_count += 1

    # Enforce story duration bounds — adapted for two-part structure.
    # Part 1: 6-12s target. Part 2: 4-8s target. Full story: 12-20s.
    # NEVER scale when voiceover is active — durations must match audio.
    total_dur = sum(d for _, d in frames)
    is_part2 = start_from_msg > 0
    min_story_dur = 4.0 if is_part2 else 6.0
    max_story_dur = 8.0 if is_part2 else 12.0
    if not voiceover_active and total_dur < min_story_dur and total_dur > 0:
        scale = min_story_dur / total_dur
        frames = [(p, d * scale) for p, d in frames]
        log.info("Scaled story delays by %.2fx to reach %.1fs minimum", scale, min_story_dur)
    elif not voiceover_active and total_dur > max_story_dur:
        scale = max_story_dur / total_dur
        frames = [(p, max(0.8, d * scale)) for p, d in frames]
        log.info("Scaled story delays by %.2fx to cap at %.1fs", scale, max_story_dur)
    elif voiceover_active and total_dur > max_story_dur:
        scale = max_story_dur / total_dur
        frames = [(p, max(0.8, d * scale)) for p, d in frames]
        log.info("Voiceover too long — scaled by %.2fx to %.1fs", scale, max_story_dur)
    elif voiceover_active:
        log.info("Voiceover active (story=%.1fs)", total_dur)

    log.info("Rendered %d text story frames (%.1fs total)", len(frames), sum(d for _, d in frames))
    return frames


def _count_fitting_messages(
    messages: list[dict],
    font: ImageFont.FreeTypeFont,
    contact_font: ImageFont.FreeTypeFont,
    system_font: ImageFont.FreeTypeFont | None = None,
) -> int:
    """Count how many messages fit in the safe zone (bottom-up)."""
    available_height = HEIGHT - TOP_BAR_HEIGHT - SAFE_BOTTOM - 40
    total_height = 0

    s_font = system_font if system_font else contact_font

    for i, msg in enumerate(reversed(messages)):
        total_height += _measure_message_height(msg, font, contact_font, s_font)

        if total_height > available_height:
            return max(1, i)  # at least 1 message must be visible

    return len(messages)


def compile_frames_to_video(
    frames: list[tuple[str, float]],
    output_path: str,
) -> str:
    """
    Compile a list of (png_path, duration) frames into an MP4 video at 30fps.
    Uses FFmpeg concat demuxer with per-frame duration.
    """
    # Create a concat file with durations
    concat_dir = os.path.dirname(output_path)
    concat_file = os.path.join(concat_dir, "frames_concat.txt")

    with open(concat_file, "w") as f:
        for frame_path, duration in frames:
            # Escape single quotes in path
            safe_path = frame_path.replace("'", "'\\''")
            f.write(f"file '{safe_path}'\n")
            f.write(f"duration {duration}\n")
        # Repeat last frame to avoid black frame at end
        if frames:
            last_path = frames[-1][0].replace("'", "'\\''")
            f.write(f"file '{last_path}'\n")

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

    # Clean up concat file
    try:
        os.remove(concat_file)
    except OSError:
        pass

    if result.returncode != 0:
        raise RuntimeError(f"Frame compilation failed: {result.stderr[-500:]}")

    log.info("Compiled %d frames to video: %s", len(frames), output_path)
    return output_path
