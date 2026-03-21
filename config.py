"""
Nesso Content Engine V20 — Configuration & Constants
"""

import os
import random

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
TEMP_DIR = os.path.join(BASE_DIR, "tmp")
FALLBACKS_DIR = os.path.join(BASE_DIR, "fallbacks")

PSYCH_SFX_PATH = os.path.join(ASSETS_DIR, "psych_sfx.mp3")
NESSO_LOGO_PATH = os.path.join(ASSETS_DIR, "nesso_logo.png")
IMESSAGE_SEND_SFX = os.path.join(ASSETS_DIR, "imessage_sounds", "send.mp3")
IMESSAGE_RECV_SFX = os.path.join(ASSETS_DIR, "imessage_sounds", "receive.mp3")

# ── Video Specs ────────────────────────────────────────────────────────────
WIDTH = 1080
HEIGHT = 1920
FPS = 30
VIDEO_CODEC = "libx264"
AUDIO_CODEC = "aac"
AUDIO_BITRATE = "128k"
MAX_FILE_SIZE_MB = 50

# ── TikTok Safe Zones (pixels) ────────────────────────────────────────────
SAFE_TOP = 150       # status bar / back button
SAFE_BOTTOM = 250    # caption area / share buttons
SAFE_LEFT = 60
SAFE_RIGHT = 200     # like/comment/share buttons
SAFE_WIDTH = WIDTH - SAFE_LEFT - SAFE_RIGHT   # 820
SAFE_HEIGHT = HEIGHT - SAFE_TOP - SAFE_BOTTOM  # 1520

# ── iMessage Bubble Styling ───────────────────────────────────────────────
BG_COLOR = (0, 0, 0)                         # Full black background
ME_BUBBLE_COLOR = (0, 122, 255)               # #007AFF — iMessage blue
OTHER_BUBBLE_COLOR = (28, 28, 30)             # #1C1C1E — dark gray
SYSTEM_TEXT_COLOR = (142, 142, 147)            # #8E8E93 — gray
TEXT_COLOR = (255, 255, 255)                   # White text
CONTACT_NAME_COLOR = (142, 142, 147)           # Gray for sender name

FONT_SIZE = 32
CONTACT_FONT_SIZE = 24
BUBBLE_RADIUS = 18
BUBBLE_PAD_H = 12     # horizontal padding inside bubble
BUBBLE_PAD_V = 8      # vertical padding inside bubble
MESSAGE_GAP = 8        # gap between messages
MAX_BUBBLE_WIDTH = SAFE_WIDTH - 80  # leave margin for alignment

# ── FFmpeg Railway Defaults ────────────────────────────────────────────────
FFMPEG_THREADS = "1"
FFMPEG_PRESET = "ultrafast"
FFMPEG_TIMEOUT = 120  # seconds

# ── Morph ──────────────────────────────────────────────────────────────────
MORPH_DURATION = 0.3   # seconds
MORPH_TRANSITION = "fadeblack"

# ── Reveal ─────────────────────────────────────────────────────────────────
REVEAL_TEXT_DURATION = 2.0   # single feature line
REVEAL_DURATION = 2.0        # logo + "it's free"
BLACK_SCREEN_DURATION = 1.0  # @nesso.app CTA

# ── ElevenLabs TTS Voiceover ─────────────────────────────────────────────
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "pFZP5JQG7iQjIQuC4Bku")
VOICEOVER_ENABLED = True
VOICEOVER_VOLUME = 0.85       # voiceover is primary audio during story
MUSIC_VOLUME_WITH_VO = 0.12   # lower music when voiceover is playing

# ── Music ──────────────────────────────────────────────────────────────────
MUSIC_VOLUME_RATIO = 0.18  # 18% of hook volume (used when no voiceover)
IMESSAGE_SFX_VOLUME_RATIO = 0.10  # 10% of hook volume
IMESSAGE_SFX_FADE_AFTER = 3  # only play sfx on first N messages

# ── Heatmap / Hook ─────────────────────────────────────────────────────────
MIN_VIEWS_FOR_HEATMAP = 50000
YOUTUBE_SEARCH_COUNT = 10
MAX_HOOK_CANDIDATES = 3
MAX_DOWNLOAD_HEIGHT = 720

# ── Hook Search Queries ────────────────────────────────────────────────────
HOOK_SEARCH_QUERIES = [
    # Crashes & Near Misses
    "insane car crash caught on camera",
    "dashcam near miss compilation",
    "rally car crash spectators",
    "motorcycle close call highway",
    # Extreme Heights
    "cliff jumping gone wrong",
    "base jump fail",
    "bungee jump bridge extreme",
    "rock climbing fall caught on camera",
    "boulder falling off cliff",
    # Explosions & Destruction
    "building demolition explosion",
    "fireworks fail compilation",
    "controlled explosion slow motion",
    # Extreme Sports
    "ski jump crash compilation",
    "big wave surfing wipeout",
    "snowboard fail mountain",
    "parkour fail rooftop",
    "skateboard mega ramp crash",
    # Nature & Animals
    "lightning strike caught on camera",
    "bear charges at camera",
    "dog saves owner incredible moment",
    "animal fight caught on camera wild",
    "ocean wave destroys beach",
    "tornado caught on camera close",
    # Viral / AI / Unbelievable
    "most insane video on the internet",
    "AI generated video unbelievable",
    "impossible moments caught on camera",
    "luckiest people alive compilation",
    "one in a million caught on camera",
]


def get_random_hook_query(exclude: list[str] | None = None) -> str:
    """Pick a random hook query, excluding any already used in this batch."""
    available = [q for q in HOOK_SEARCH_QUERIES if q not in (exclude or [])]
    if not available:
        available = HOOK_SEARCH_QUERIES
    return random.choice(available)


# ── Nesso Reveal — Single Feature Lines (conversion-optimized) ───────────
# Each line ties directly to the friendship drift emotion in the text convo.
# Single feature > feature list. Feels like a personal recommendation.
NESSO_REVEAL_LINES = [
    "there's an app that reminds you before this happens",
    "Nesso caught me before I became the friend who disappeared",
    "one reminder could have saved this conversation",
    "imagine getting a reminder before you forget your best friend exists — that's Nesso",
    "this is why I downloaded Nesso — it texts you before it's too late",
    "Nesso literally nudges you before your friendships go silent",
]

_last_reveal_index = -1


def get_reveal_line() -> str:
    """Pick a single reveal line. Never repeat consecutively."""
    global _last_reveal_index
    available = list(range(len(NESSO_REVEAL_LINES)))
    if _last_reveal_index >= 0:
        available.remove(_last_reveal_index)
    idx = random.choice(available)
    _last_reveal_index = idx
    return NESSO_REVEAL_LINES[idx]


# ── Hook Category Mapping ─────────────────────────────────────────────────
def get_hook_category(query: str) -> str:
    """Infer hook category from search query for script bridge line."""
    q = query.lower()
    if any(w in q for w in ["crash", "dashcam", "near miss", "close call"]):
        return "crash"
    if any(w in q for w in ["cliff", "jump", "base jump", "bungee", "climbing", "fall", "boulder"]):
        return "extreme_heights"
    if any(w in q for w in ["explosion", "demolition", "fireworks"]):
        return "explosion"
    if any(w in q for w in ["ski", "surfing", "snowboard", "parkour", "skateboard"]):
        return "extreme_sports"
    if any(w in q for w in ["lightning", "bear", "dog", "animal", "wave", "tornado", "ocean"]):
        return "nature"
    return "viral"


# ── Caption Templates ─────────────────────────────────────────────────────
TIKTOK_HASHTAGS = [
    "#friendship", "#texting", "#relatable", "#bestfriend",
    "#groupchat", "#nesso", "#fyp",
]

TIKTOK_NICHE_HASHTAGS = [
    "#friendshipgoals", "#growingup", "#adulting", "#realtalk",
    "#latenight", "#deepthoughts", "#phonecall", "#missyou",
    "#bff", "#squad", "#drifting", "#textconvo",
]

IG_HASHTAGS = [
    "#friendship", "#bestfriend", "#relatable", "#texting",
    "#groupchat", "#nesso", "#viral", "#reels", "#trending",
    "#friendshipquotes", "#adulting", "#growingup", "#realtalk",
    "#missyou", "#latenight",
]


TIKTOK_CAPTION_HOOKS = [
    "tag someone you haven't texted in months 👀",
    "this is everyone's friend group rn and nobody wants to admit it",
    "if this doesn't make you text your best friend idk what will",
    "the group chat has been QUIET lately 💀",
    "you're either the friend who disappeared or the friend who noticed",
    "pov: you realized you're the friend everyone forgot about",
]

IG_CAPTION_HOOKS = [
    "this hit different at 2am 💔",
    "tag your friend before it's too late",
    "we all have that one friend we keep meaning to call",
    "screenshot this and send it to the friend you've been neglecting",
    "if you watched this and thought of someone... text them rn",
]

IG_PIN_COMMENTS = [
    "when's the last time you actually called your best friend? 👀",
    "name the friend you haven't talked to in months 👇",
    "be honest... how long since you hung out with your closest friend?",
]


def generate_tiktok_caption(story_theme: str = "") -> str:
    niche = random.sample(TIKTOK_NICHE_HASHTAGS, min(4, len(TIKTOK_NICHE_HASHTAGS)))
    tags = " ".join(TIKTOK_HASHTAGS + niche)
    if story_theme:
        caption = story_theme
    else:
        caption = random.choice(TIKTOK_CAPTION_HOOKS)
    return f"{caption}\n\n{tags}"


def generate_ig_caption(story_theme: str = "") -> str:
    tags = " ".join(random.sample(IG_HASHTAGS, min(15, len(IG_HASHTAGS))))
    if story_theme:
        caption = story_theme
    else:
        caption = random.choice(IG_CAPTION_HOOKS)
    pin_comment = random.choice(IG_PIN_COMMENTS)
    return f"📱 IG CAPTION:\n{caption}\n\n{tags}\n\n📌 PIN THIS COMMENT:\n{pin_comment}"


# ── Ensure temp dir exists ────────────────────────────────────────────────
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)
