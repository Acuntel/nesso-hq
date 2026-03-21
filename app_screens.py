"""
Nesso Content Engine V20 — Fake App Screenshot Renderer

Generates realistic Nesso app screens using Pillow that look like
actual iPhone screenshots scrolling through the app. Used in the
reveal sequence to show off features.

All colors, layouts, and styling matched to the real Nesso app.
"""

import logging
import math
import os
import random

from PIL import Image, ImageDraw, ImageFont

from config import (
    ASSETS_DIR,
    HEIGHT,
    NESSO_LOGO_PATH,
    WIDTH,
)

log = logging.getLogger(__name__)

# ── Nesso App Color Palette (matched to real app) ────────────────────────
# Warm pink/rose theme
APP_BG = (235, 218, 212)         # hsl(15 35% 90%) - soft warm pink
APP_BG_DARK = (38, 31, 28)      # hsl(20 18% 12%) - dark mode bg
CARD_BG = (240, 225, 220)       # hsl(15 32% 92%) - card background
CARD_BG_DARK = (43, 36, 32)     # hsl(20 16% 15%) - dark mode card
TEXT_PRIMARY = (82, 67, 58)      # hsl(25 25% 28%) - warm brown
TEXT_PRIMARY_DARK = (228, 215, 208)  # hsl(15 25% 88%) - light mode text
TEXT_SECONDARY = (142, 142, 147) # gray for subtitles
BORDER_COLOR = (212, 196, 189)   # hsl(15 22% 80%)

# Feature colors
BAR_ROSE = (178, 90, 100)       # hsl(350 40% 52%) - connection bar fill
BAR_BLUE = (100, 130, 190)      # hsl(220 40% 55%) - snoozed bar
STREAK_RED = (239, 68, 68)      # red-500 streak fire
STREAK_ORANGE = (249, 115, 22)  # orange-500
STREAK_AMBER = (245, 158, 11)   # amber-500
IMESSAGE_BLUE = (0, 122, 255)   # iOS blue (reach out button)
EMERALD = (80, 190, 120)        # reach out swipe green
GLASS_BORDER = (180, 155, 145, 90)  # glass morphism border (with alpha)

# Status bar
STATUS_BAR_HEIGHT = 54
NOTCH_WIDTH = 200
NOTCH_HEIGHT = 34

# iPhone frame
CORNER_RADIUS = 48
HOME_INDICATOR_WIDTH = 140
HOME_INDICATOR_HEIGHT = 5


def _get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Get a system font matched to Nesso's typography."""
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
            "/System/Library/Fonts/SFProDisplay-Semibold.otf",
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


def _draw_rounded_rect(draw, xy, radius, fill=None, outline=None, width=1):
    """Draw a rounded rectangle."""
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def _draw_connection_bar(draw, x, y, w, h, level, snoozed=False, show_hearts=False):
    """Draw a Nesso connection bar with fill level and optional hearts."""
    bar_color = BAR_BLUE if snoozed else BAR_ROSE
    bg_color = (200, 185, 178)  # muted background

    # Background
    _draw_rounded_rect(draw, (x, y, x + w, y + h), radius=h // 2, fill=bg_color)

    # Fill
    if level > 0:
        fill_w = max(h, int(w * level / 100))
        _draw_rounded_rect(
            draw, (x, y, x + fill_w, y + h),
            radius=h // 2, fill=bar_color,
        )

    # Hearts on the bar (small white hearts)
    if show_hearts and level > 20:
        heart_font = _get_font(max(8, h - 2))
        for hx in [0.25, 0.5, 0.75]:
            if hx * w < fill_w:
                draw.text(
                    (x + int(hx * w), y - 2),
                    "♡", fill=(255, 255, 255, 180), font=heart_font,
                )


def _draw_streak_badge(draw, x, y, count):
    """Draw a flame streak badge."""
    if count < 2:
        return

    if count >= 14:
        bg = (254, 226, 226)  # red-100
        flame_color = STREAK_RED
    elif count >= 7:
        bg = (255, 237, 213)  # orange-100
        flame_color = STREAK_ORANGE
    else:
        bg = (254, 243, 199)  # amber-100
        flame_color = STREAK_AMBER

    badge_w = 42 if count >= 10 else 36
    badge_h = 22
    _draw_rounded_rect(
        draw, (x, y, x + badge_w, y + badge_h),
        radius=badge_h // 2, fill=bg,
    )

    # Flame icon (simplified as text)
    flame_font = _get_font(14, bold=True)
    draw.text((x + 4, y + 2), "🔥", font=flame_font)

    # Count
    if count >= 7:
        count_font = _get_font(11, bold=True)
        draw.text((x + 22, y + 5), str(count), fill=flame_color, font=count_font)


def _draw_person_card(draw, x, y, w, h, name, initials, level, streak=0,
                       relationship="", snoozed=False, dark=False):
    """Draw a single person card like the Nesso home screen."""
    bg = CARD_BG_DARK if dark else CARD_BG
    text_color = TEXT_PRIMARY_DARK if dark else TEXT_PRIMARY

    # Card background with rounded corners
    _draw_rounded_rect(
        draw, (x, y, x + w, y + h),
        radius=24, fill=bg,
        outline=BORDER_COLOR if not dark else (60, 50, 45), width=1,
    )

    # Avatar circle
    avatar_size = 72
    avatar_x = x + (w - avatar_size) // 2
    avatar_y = y + 20

    # Avatar background (gradient-ish with initials)
    avatar_colors = [
        (178, 90, 100), (150, 100, 140), (100, 130, 180),
        (130, 160, 120), (180, 120, 80), (160, 90, 130),
    ]
    avatar_color = avatar_colors[hash(name) % len(avatar_colors)]

    draw.ellipse(
        (avatar_x, avatar_y, avatar_x + avatar_size, avatar_y + avatar_size),
        fill=avatar_color,
    )

    # Ring around avatar
    draw.ellipse(
        (avatar_x - 3, avatar_y - 3, avatar_x + avatar_size + 3, avatar_y + avatar_size + 3),
        outline=(178, 90, 100, 115), width=3,
    )

    # Initials
    init_font = _get_font(28, bold=True)
    bbox = draw.textbbox((0, 0), initials, font=init_font)
    iw = bbox[2] - bbox[0]
    ih = bbox[3] - bbox[1]
    draw.text(
        (avatar_x + (avatar_size - iw) // 2, avatar_y + (avatar_size - ih) // 2 - 2),
        initials, fill=(255, 255, 255), font=init_font,
    )

    # Name
    name_font = _get_font(20, bold=True)
    bbox = draw.textbbox((0, 0), name, font=name_font)
    nw = bbox[2] - bbox[0]
    name_x = x + (w - nw) // 2
    name_y = avatar_y + avatar_size + 12
    draw.text((name_x, name_y), name, fill=text_color, font=name_font)

    # Relationship label
    if relationship:
        rel_font = _get_font(13)
        bbox = draw.textbbox((0, 0), relationship, font=rel_font)
        rw = bbox[2] - bbox[0]
        draw.text(
            (x + (w - rw) // 2, name_y + 26),
            relationship, fill=TEXT_SECONDARY, font=rel_font,
        )

    # Connection bar
    bar_y = name_y + (50 if relationship else 34)
    bar_margin = 20
    _draw_connection_bar(
        draw, x + bar_margin, bar_y,
        w - bar_margin * 2, 6, level,
        snoozed=snoozed, show_hearts=level > 40,
    )

    # Streak badge (bottom-left of card)
    if streak >= 2:
        _draw_streak_badge(draw, x + 8, y + h - 28, streak)


def _draw_status_bar(draw, dark=False):
    """Draw iPhone status bar (time, signal, battery)."""
    text_color = TEXT_PRIMARY_DARK if dark else TEXT_PRIMARY
    font = _get_font(16, bold=True)

    # Time
    draw.text((32, 16), "9:41", fill=text_color, font=font)

    # Signal dots
    for i in range(4):
        dot_x = WIDTH - 120 + i * 14
        draw.ellipse((dot_x, 20, dot_x + 6, 26), fill=text_color)

    # Battery
    batt_x = WIDTH - 50
    _draw_rounded_rect(
        draw, (batt_x, 18, batt_x + 28, 30),
        radius=3, outline=text_color, width=1,
    )
    _draw_rounded_rect(
        draw, (batt_x + 2, 20, batt_x + 22, 28),
        radius=2, fill=text_color,
    )


def _draw_home_indicator(draw, dark=False):
    """Draw iPhone home indicator bar at bottom."""
    color = TEXT_PRIMARY_DARK if dark else TEXT_PRIMARY
    bar_x = (WIDTH - HOME_INDICATOR_WIDTH) // 2
    bar_y = HEIGHT - 20
    _draw_rounded_rect(
        draw, (bar_x, bar_y, bar_x + HOME_INDICATOR_WIDTH, bar_y + HOME_INDICATOR_HEIGHT),
        radius=HOME_INDICATOR_HEIGHT // 2, fill=color,
    )


# ── Pre-built People Data for Fake Screenshots ──────────────────────────
FAKE_PEOPLE = [
    {"name": "Sarah", "initials": "SA", "level": 85, "streak": 16, "rel": "Best Friend"},
    {"name": "Jake", "initials": "JK", "level": 62, "streak": 9, "rel": "Close Friend"},
    {"name": "Mom", "initials": "MO", "level": 92, "streak": 24, "rel": "Mom"},
    {"name": "Alex", "initials": "AL", "level": 35, "streak": 3, "rel": "College Friend"},
    {"name": "Emma", "initials": "EM", "level": 71, "streak": 11, "rel": "Close Friend"},
    {"name": "Marcus", "initials": "MA", "level": 15, "streak": 0, "rel": "High School"},
    {"name": "Olivia", "initials": "OL", "level": 50, "streak": 5, "rel": "Roommate"},
    {"name": "Tyler", "initials": "TY", "level": 78, "streak": 14, "rel": "Best Friend"},
]


def render_home_screen(dark: bool = False) -> Image.Image:
    """
    Render a realistic Nesso home screen with person cards grid.
    Shows: avatar, name, connection bar, streaks — the core value prop.
    """
    bg = APP_BG_DARK if dark else APP_BG
    text_color = TEXT_PRIMARY_DARK if dark else TEXT_PRIMARY
    img = Image.new("RGB", (WIDTH, HEIGHT), bg)
    draw = ImageDraw.Draw(img)

    _draw_status_bar(draw, dark)

    # Header
    title_font = _get_font(36, bold=True)
    draw.text((WIDTH // 2 - 120, 70), "Inner Circle", fill=text_color, font=title_font)

    # + button (top right)
    plus_font = _get_font(32, bold=True)
    draw.text((WIDTH - 70, 72), "+", fill=BAR_ROSE, font=plus_font)

    # Card grid — 2 columns
    card_w = (WIDTH - 60 - 16) // 2  # 60px total margin, 16px gap
    card_h = 210
    gap = 16
    start_x = 30
    start_y = 130

    people = FAKE_PEOPLE[:6]  # Show 6 people (3 rows)
    for i, person in enumerate(people):
        col = i % 2
        row = i // 2
        cx = start_x + col * (card_w + gap)
        cy = start_y + row * (card_h + gap)
        _draw_person_card(
            draw, cx, cy, card_w, card_h,
            person["name"], person["initials"],
            person["level"], person["streak"],
            person["rel"], dark=dark,
        )

    _draw_home_indicator(draw, dark)
    return img


def render_person_detail(dark: bool = False) -> Image.Image:
    """
    Render a person detail screen showing:
    - Large avatar + name
    - Connection bar (large)
    - Streak badge
    - "Reach out" button
    - Recent interactions
    """
    bg = APP_BG_DARK if dark else APP_BG
    text_color = TEXT_PRIMARY_DARK if dark else TEXT_PRIMARY
    img = Image.new("RGB", (WIDTH, HEIGHT), bg)
    draw = ImageDraw.Draw(img)

    _draw_status_bar(draw, dark)

    person = FAKE_PEOPLE[0]  # Sarah — best example

    # Back button
    back_font = _get_font(24)
    draw.text((24, 70), "< Back", fill=BAR_ROSE, font=back_font)

    # Large avatar
    avatar_size = 120
    avatar_x = (WIDTH - avatar_size) // 2
    avatar_y = 120

    draw.ellipse(
        (avatar_x - 4, avatar_y - 4, avatar_x + avatar_size + 4, avatar_y + avatar_size + 4),
        outline=(178, 90, 100, 115), width=4,
    )
    draw.ellipse(
        (avatar_x, avatar_y, avatar_x + avatar_size, avatar_y + avatar_size),
        fill=(178, 90, 100),
    )
    init_font = _get_font(44, bold=True)
    bbox = draw.textbbox((0, 0), person["initials"], font=init_font)
    iw, ih = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        (avatar_x + (avatar_size - iw) // 2, avatar_y + (avatar_size - ih) // 2 - 4),
        person["initials"], fill=(255, 255, 255), font=init_font,
    )

    # Name + relationship
    name_font = _get_font(32, bold=True)
    bbox = draw.textbbox((0, 0), person["name"], font=name_font)
    nw = bbox[2] - bbox[0]
    name_y = avatar_y + avatar_size + 20
    draw.text(((WIDTH - nw) // 2, name_y), person["name"], fill=text_color, font=name_font)

    rel_font = _get_font(18)
    bbox = draw.textbbox((0, 0), person["rel"], font=rel_font)
    rw = bbox[2] - bbox[0]
    draw.text(((WIDTH - rw) // 2, name_y + 40), person["rel"], fill=TEXT_SECONDARY, font=rel_font)

    # Status text
    status_font = _get_font(16, bold=True)
    status = "Recently connected"
    bbox = draw.textbbox((0, 0), status, font=status_font)
    sw = bbox[2] - bbox[0]
    draw.text(((WIDTH - sw) // 2, name_y + 70), status, fill=(80, 180, 100), font=status_font)

    # Large connection bar
    bar_y = name_y + 110
    bar_margin = 60
    _draw_connection_bar(
        draw, bar_margin, bar_y,
        WIDTH - bar_margin * 2, 10, person["level"],
        show_hearts=True,
    )

    # Streak badge (centered below bar)
    streak_y = bar_y + 30
    streak_text = f"🔥 {person['streak']}-interaction streak"
    streak_font = _get_font(18, bold=True)
    bbox = draw.textbbox((0, 0), streak_text, font=streak_font)
    stw = bbox[2] - bbox[0]
    draw.text(((WIDTH - stw) // 2, streak_y), streak_text, fill=STREAK_RED, font=streak_font)

    # Reach out button
    btn_y = streak_y + 60
    btn_margin = 80
    btn_h = 56
    _draw_rounded_rect(
        draw, (btn_margin, btn_y, WIDTH - btn_margin, btn_y + btn_h),
        radius=btn_h // 2, fill=BAR_ROSE,
    )
    btn_font = _get_font(20, bold=True)
    btn_text = "Reach out"
    bbox = draw.textbbox((0, 0), btn_text, font=btn_font)
    bw = bbox[2] - bbox[0]
    draw.text(
        ((WIDTH - bw) // 2, btn_y + 16),
        btn_text, fill=(255, 255, 255), font=btn_font,
    )

    # Recent interactions card
    card_y = btn_y + 90
    card_margin = 30
    card_h = 200
    card_bg = CARD_BG_DARK if dark else CARD_BG
    _draw_rounded_rect(
        draw, (card_margin, card_y, WIDTH - card_margin, card_y + card_h),
        radius=20, fill=card_bg,
        outline=BORDER_COLOR if not dark else (60, 50, 45), width=1,
    )

    card_title_font = _get_font(18, bold=True)
    draw.text((card_margin + 20, card_y + 16), "Recent Interactions", fill=text_color, font=card_title_font)

    # Interaction rows
    interactions = [
        ("Texted", "Today"),
        ("Called", "2 days ago"),
        ("Texted", "5 days ago"),
        ("Texted", "1 week ago"),
    ]
    row_font = _get_font(16)
    row_date_font = _get_font(14)
    for i, (itype, idate) in enumerate(interactions):
        ry = card_y + 50 + i * 36
        icon = "💬" if itype == "Texted" else "📞"
        draw.text((card_margin + 24, ry), f"{icon}  {itype}", fill=text_color, font=row_font)
        bbox = draw.textbbox((0, 0), idate, font=row_date_font)
        dw = bbox[2] - bbox[0]
        draw.text((WIDTH - card_margin - 24 - dw, ry + 2), idate, fill=TEXT_SECONDARY, font=row_date_font)

    _draw_home_indicator(draw, dark)
    return img


def render_reach_out_sheet(dark: bool = False) -> Image.Image:
    """
    Render the reach out bottom sheet showing:
    - AI message suggestions button
    - Message input area
    - Text / Email action buttons
    """
    bg = APP_BG_DARK if dark else APP_BG
    text_color = TEXT_PRIMARY_DARK if dark else TEXT_PRIMARY
    img = Image.new("RGB", (WIDTH, HEIGHT), bg)
    draw = ImageDraw.Draw(img)

    _draw_status_bar(draw, dark)

    # Dimmed background person detail (just top portion)
    dim_overlay = (0, 0, 0)
    draw.rectangle((0, 0, WIDTH, HEIGHT), fill=bg)

    # Bottom sheet
    sheet_y = HEIGHT // 3
    sheet_bg = CARD_BG_DARK if dark else (245, 235, 230)
    _draw_rounded_rect(
        draw, (0, sheet_y, WIDTH, HEIGHT),
        radius=32, fill=sheet_bg,
    )

    # Sheet handle
    handle_w = 40
    draw.rounded_rectangle(
        ((WIDTH - handle_w) // 2, sheet_y + 12, (WIDTH + handle_w) // 2, sheet_y + 17),
        radius=3, fill=TEXT_SECONDARY,
    )

    # Title
    title_font = _get_font(24, bold=True)
    draw.text((40, sheet_y + 40), "Reach out to Sarah", fill=text_color, font=title_font)

    # Call button (circle, top right of sheet)
    call_x = WIDTH - 80
    call_y = sheet_y + 35
    draw.ellipse((call_x, call_y, call_x + 40, call_y + 40), fill=IMESSAGE_BLUE)
    call_font = _get_font(20)
    draw.text((call_x + 10, call_y + 8), "📞", font=call_font)

    # AI suggestions button
    ai_y = sheet_y + 100
    ai_bg = (220, 200, 195) if not dark else (55, 45, 42)
    _draw_rounded_rect(
        draw, (40, ai_y, WIDTH - 40, ai_y + 56),
        radius=16, fill=ai_bg,
    )
    ai_font = _get_font(18, bold=True)
    draw.text((70, ai_y + 16), "✨  Write with AI", fill=text_color, font=ai_font)

    # Message textarea
    ta_y = ai_y + 80
    ta_bg = (255, 250, 248) if not dark else (50, 42, 38)
    _draw_rounded_rect(
        draw, (40, ta_y, WIDTH - 40, ta_y + 120),
        radius=16, fill=ta_bg,
        outline=BORDER_COLOR if not dark else (60, 50, 45), width=1,
    )

    # Fake message text
    msg_font = _get_font(18)
    draw.text(
        (56, ta_y + 16),
        "Hey! It's been a while, was just\nthinking about you. How have\nyou been?",
        fill=text_color, font=msg_font,
    )

    # Action buttons row
    btn_y = ta_y + 150
    btn_h = 56
    btn_gap = 16
    btn_w = (WIDTH - 80 - btn_gap) // 2

    # Text button
    _draw_rounded_rect(
        draw, (40, btn_y, 40 + btn_w, btn_y + btn_h),
        radius=20, fill=BAR_ROSE,
    )
    btn_font = _get_font(18, bold=True)
    bbox = draw.textbbox((0, 0), "💬 Text", font=btn_font)
    bw = bbox[2] - bbox[0]
    draw.text((40 + (btn_w - bw) // 2, btn_y + 16), "💬 Text", fill=(255, 255, 255), font=btn_font)

    # Email button
    email_x = 40 + btn_w + btn_gap
    _draw_rounded_rect(
        draw, (email_x, btn_y, email_x + btn_w, btn_y + btn_h),
        radius=20, fill=BAR_ROSE,
    )
    bbox = draw.textbbox((0, 0), "✉️ Email", font=btn_font)
    bw = bbox[2] - bbox[0]
    draw.text((email_x + (btn_w - bw) // 2, btn_y + 16), "✉️ Email", fill=(255, 255, 255), font=btn_font)

    _draw_home_indicator(draw, dark)
    return img


def render_streak_celebration(dark: bool = False) -> Image.Image:
    """
    Render a streak celebration screen with large streak count,
    fireworks-style dots, and celebration text.
    """
    bg = APP_BG_DARK if dark else APP_BG
    text_color = TEXT_PRIMARY_DARK if dark else TEXT_PRIMARY
    img = Image.new("RGB", (WIDTH, HEIGHT), bg)
    draw = ImageDraw.Draw(img)

    _draw_status_bar(draw, dark)

    # Celebration particles (simplified fireworks)
    particle_colors = [
        (178, 90, 100), (200, 70, 80), (170, 85, 120),
        (220, 80, 80), (180, 100, 110), (210, 90, 95),
    ]
    random.seed(42)  # Deterministic for consistency
    for _ in range(60):
        px = random.randint(100, WIDTH - 100)
        py = random.randint(150, HEIGHT // 2 + 100)
        size = random.randint(3, 8)
        color = random.choice(particle_colors)
        alpha = random.randint(100, 255)
        draw.ellipse((px, py, px + size, py + size), fill=color)

    # Large streak count
    streak_font = _get_font(120, bold=True)
    count_text = "16"
    bbox = draw.textbbox((0, 0), count_text, font=streak_font)
    cw = bbox[2] - bbox[0]
    ch = bbox[3] - bbox[1]
    center_y = HEIGHT // 2 - 80
    draw.text(((WIDTH - cw) // 2, center_y), count_text, fill=STREAK_RED, font=streak_font)

    # Fire emoji
    fire_font = _get_font(60)
    draw.text(((WIDTH - 60) // 2, center_y - 80), "🔥", font=fire_font)

    # "interaction streak!"
    sub_font = _get_font(28, bold=True)
    sub_text = "interaction streak!"
    bbox = draw.textbbox((0, 0), sub_text, font=sub_font)
    sw = bbox[2] - bbox[0]
    draw.text(((WIDTH - sw) // 2, center_y + ch + 20), sub_text, fill=text_color, font=sub_font)

    # Person name
    name_font = _get_font(22)
    name_text = "You and Sarah are on fire"
    bbox = draw.textbbox((0, 0), name_text, font=name_font)
    nw = bbox[2] - bbox[0]
    draw.text(((WIDTH - nw) // 2, center_y + ch + 60), name_text, fill=TEXT_SECONDARY, font=name_font)

    # Keep it going text
    keep_font = _get_font(18)
    keep_text = "Keep reaching out to maintain your streak"
    bbox = draw.textbbox((0, 0), keep_text, font=keep_font)
    kw = bbox[2] - bbox[0]
    draw.text(((WIDTH - kw) // 2, center_y + ch + 100), keep_text, fill=TEXT_SECONDARY, font=keep_font)

    _draw_home_indicator(draw, dark)
    return img


def render_notification_reminder(dark: bool = False) -> Image.Image:
    """
    Render an iPhone lock screen with a Nesso push notification,
    showing the reminder feature.
    """
    # iPhone lock screen (dark)
    img = Image.new("RGB", (WIDTH, HEIGHT), (15, 15, 15))
    draw = ImageDraw.Draw(img)

    # Status bar (white on dark)
    time_font = _get_font(72, bold=True)
    time_text = "9:41"
    bbox = draw.textbbox((0, 0), time_text, font=time_font)
    tw = bbox[2] - bbox[0]
    draw.text(((WIDTH - tw) // 2, 200), time_text, fill=(255, 255, 255), font=time_font)

    date_font = _get_font(22)
    date_text = "Friday, March 21"
    bbox = draw.textbbox((0, 0), date_text, font=date_font)
    dw = bbox[2] - bbox[0]
    draw.text(((WIDTH - dw) // 2, 290), date_text, fill=(200, 200, 200), font=date_font)

    # Notification card
    notif_y = 500
    notif_h = 120
    notif_margin = 24
    notif_bg = (45, 45, 48)
    _draw_rounded_rect(
        draw, (notif_margin, notif_y, WIDTH - notif_margin, notif_y + notif_h),
        radius=20, fill=notif_bg,
    )

    # App icon (small circle)
    icon_x = notif_margin + 16
    icon_y = notif_y + 14
    icon_size = 40

    # Try loading the actual Nesso logo
    if os.path.exists(NESSO_LOGO_PATH):
        try:
            logo = Image.open(NESSO_LOGO_PATH).convert("RGBA")
            logo = logo.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
            img.paste(logo, (icon_x, icon_y), logo)
        except Exception:
            draw.ellipse((icon_x, icon_y, icon_x + icon_size, icon_y + icon_size), fill=BAR_ROSE)
    else:
        draw.ellipse((icon_x, icon_y, icon_x + icon_size, icon_y + icon_size), fill=BAR_ROSE)

    # Notification text
    app_font = _get_font(16, bold=True)
    draw.text((icon_x + icon_size + 12, icon_y), "NESSO", fill=(180, 180, 180), font=app_font)
    draw.text((WIDTH - notif_margin - 60, icon_y), "now", fill=(120, 120, 120), font=_get_font(14))

    title_font = _get_font(18, bold=True)
    draw.text((icon_x + icon_size + 12, icon_y + 24), "Time to reach out!", fill=(255, 255, 255), font=title_font)

    body_font = _get_font(16)
    draw.text(
        (icon_x + icon_size + 12, icon_y + 50),
        "It's been 5 days since you last\nconnected with Sarah. Send a quick text!",
        fill=(200, 200, 200), font=body_font,
    )

    # Second notification (older)
    notif2_y = notif_y + notif_h + 12
    notif2_h = 90
    _draw_rounded_rect(
        draw, (notif_margin, notif2_y, WIDTH - notif_margin, notif2_y + notif2_h),
        radius=20, fill=notif_bg,
    )

    if os.path.exists(NESSO_LOGO_PATH):
        try:
            img.paste(logo, (icon_x, notif2_y + 14), logo)
        except Exception:
            draw.ellipse((icon_x, notif2_y + 14, icon_x + icon_size, notif2_y + 14 + icon_size), fill=BAR_ROSE)
    else:
        draw.ellipse((icon_x, notif2_y + 14, icon_x + icon_size, notif2_y + 14 + icon_size), fill=BAR_ROSE)

    draw.text((icon_x + icon_size + 12, notif2_y + 14), "NESSO", fill=(180, 180, 180), font=app_font)
    draw.text((WIDTH - notif_margin - 60, notif2_y + 14), "2h ago", fill=(120, 120, 120), font=_get_font(14))
    draw.text(
        (icon_x + icon_size + 12, notif2_y + 38),
        "Jake's birthday is in 3 days!\nDon't forget to reach out 🎂",
        fill=(200, 200, 200), font=body_font,
    )

    _draw_home_indicator(draw)
    return img


# ── Feature Descriptions (used by reveal to advertise each screen) ──────
FEATURE_SCREENS = [
    {
        "renderer": render_home_screen,
        "feature_text": "track everyone who matters in one place",
        "duration": 2.5,
    },
    {
        "renderer": render_person_detail,
        "feature_text": "see your connection strength with each person",
        "duration": 2.5,
    },
    {
        "renderer": render_streak_celebration,
        "feature_text": "build streaks by staying in touch",
        "duration": 2.0,
    },
    {
        "renderer": render_notification_reminder,
        "feature_text": "get reminded before friendships go silent",
        "duration": 2.5,
    },
    {
        "renderer": render_reach_out_sheet,
        "feature_text": "reach out in seconds with AI-powered messages",
        "duration": 2.5,
    },
]
