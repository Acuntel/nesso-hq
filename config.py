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
BUNDLED_MUSIC_DIR = os.path.join(ASSETS_DIR, "music")

# ── Typing Indicator ─────────────────────────────────────────────────────
TYPING_INDICATOR_DURATION = 0.6  # seconds to show "..." bubble before received message
TYPING_BUBBLE_COLOR = (28, 28, 30)  # same as OTHER_BUBBLE_COLOR
TYPING_DOT_COLOR = (142, 142, 147)  # gray dots

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

FONT_SIZE = 40
CONTACT_FONT_SIZE = 28
BUBBLE_RADIUS = 22
BUBBLE_PAD_H = 16     # horizontal padding inside bubble
BUBBLE_PAD_V = 12     # vertical padding inside bubble
MESSAGE_GAP = 12       # gap between messages
MAX_BUBBLE_WIDTH = SAFE_WIDTH - 60  # leave margin for alignment

# iMessage top bar
TOP_BAR_HEIGHT = 90
TOP_BAR_COLOR = (28, 28, 30)         # dark gray bar
TOP_BAR_TEXT_COLOR = (255, 255, 255)  # white contact name
TOP_BAR_CHEVRON_COLOR = (0, 122, 255)  # blue back chevron

# ── FFmpeg Railway Defaults ────────────────────────────────────────────────
FFMPEG_THREADS = "1"
FFMPEG_PRESET = "ultrafast"
FFMPEG_TIMEOUT = 120  # seconds

# ── Morph ──────────────────────────────────────────────────────────────────
MORPH_DURATION = 0.4   # seconds for cross-dissolve transitions
MORPH_TRANSITION = "fade"  # default — fade cross-dissolves without going black
MORPH_FADEBLACK_DURATION = 0.4  # keep fadeblack short — long fadeblack = black frame = viewer swipes

# Transition pool — fade and dissolve preferred (no black frames)
# fadeblack/fadewhite kept but short duration prevents the "video ended" effect
MORPH_TRANSITIONS = [
    "fade",
    "fade",
    "dissolve",
    "dissolve",
    "fadeblack",
]

_last_transition_index = -1


def get_morph_transition() -> str:
    """Pick a morph transition. Never repeat consecutively."""
    global _last_transition_index
    available = list(range(len(MORPH_TRANSITIONS)))
    if _last_transition_index >= 0:
        available.remove(_last_transition_index)
    idx = random.choice(available)
    _last_transition_index = idx
    return MORPH_TRANSITIONS[idx]

# Second ElevenLabs voice for "friend" messages
ELEVENLABS_VOICE_ID_2 = os.environ.get("ELEVENLABS_VOICE_ID_2", "21m00Tcm4TlvDq8ikWAM")  # Rachel voice

# ── Reveal (3s total — any longer and viewers swipe) ──────────────────────
REVEAL_TEXT_DURATION = 1.5   # single feature line
REVEAL_DURATION = 1.5        # logo + "it's free"
BLACK_SCREEN_DURATION = 0.0  # KILLED — no separate CTA frame

# ── ElevenLabs TTS Voiceover ─────────────────────────────────────────────
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "pFZP5JQG7iQjIQuC4Bku")
VOICEOVER_ENABLED = True
VOICEOVER_VOLUME = 0.85       # voiceover is primary audio during story
MUSIC_VOLUME_WITH_VO = 0.12   # lower music when voiceover is playing

# ── Music ──────────────────────────────────────────────────────────────────
MUSIC_VOLUME_RATIO = 0.18  # 18% of hook volume (used when no voiceover)
IMESSAGE_SFX_VOLUME = 0.25  # iMessage send/receive SFX volume
IMESSAGE_SFX_FADE_AFTER = 3  # only play sfx on first N messages

# ── Hook Audio ────────────────────────────────────────────────────────────
HOOK_AUDIO_FADEOUT = 1.0  # fade out hook audio over last 1.0s (was 0.3s — too abrupt)

# ── Music Start Offset ────────────────────────────────────────────────────
MUSIC_PRE_MORPH_OFFSET = 1.0  # start music 1.0s before morph point (smooth audio bridge)

# ── Message Delay Bounds ──────────────────────────────────────────────────
MIN_MESSAGE_DELAY = 0.8
MAX_MESSAGE_DELAY = 3.0

# ── Hook / YouTube Settings ───────────────────────────────────────────────
MAX_HOOK_CANDIDATES = 3
YOUTUBE_SEARCH_COUNT = 10

# ── Hook Search Queries ────────────────────────────────────────────────────
HOOK_SEARCH_QUERIES = [
    # Crashes & Near Misses
    "insane car crash caught on camera",
    "dashcam near miss compilation",
    "rally car crash spectators",
    "motorcycle close call highway",
    "truck near miss compilation dashcam",
    # Extreme Heights
    "cliff jumping gone wrong",
    "base jump fail",
    "bungee jump bridge extreme",
    "rock climbing fall caught on camera",
    "boulder falling off cliff",
    "wingsuit flying near miss",
    "glass bridge crack prank",
    # Explosions & Destruction
    "building demolition explosion",
    "fireworks fail compilation",
    "controlled explosion slow motion",
    "gender reveal explosion fail",
    "satisfying building implosion",
    # Extreme Sports
    "ski jump crash compilation",
    "big wave surfing wipeout",
    "snowboard fail mountain",
    "parkour fail rooftop",
    "skateboard mega ramp crash",
    "BMX massive crash compilation",
    "wakeboarding fail compilation",
    # Nature & Animals
    "lightning strike caught on camera",
    "bear charges at camera",
    "dog saves owner incredible moment",
    "animal fight caught on camera wild",
    "ocean wave destroys beach",
    "tornado caught on camera close",
    "volcano eruption close up footage",
    "shark encounter caught on gopro",
    # Sports Highlights
    "last second buzzer beater compilation",
    "crowd reaction incredible goal",
    "most insane sports play ever",
    # Viral / Unbelievable (high-signal only)
    "impossible moments caught on camera",
    "luckiest people alive compilation",
    "one in a million caught on camera",
    "security camera unbelievable footage",
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
    "one notification would have changed everything",
    "your phone won't let you forget a meeting but it'll let you forget your best friend",
    "one reminder. that's all it would have taken.",
    "what if your phone actually cared about your friendships",
    "the difference between staying close and drifting apart is one reminder",
    "friendships don't end with a fight. they end with silence.",
    "this didn't have to happen",
    "your phone tracks your screen time but not your friendships",
    "imagine if something reminded you before it was too late",
    "one notification away from never having this conversation",
    "the people you love are one forgotten text away from becoming strangers",
    "nobody warns you when a friendship is dying",
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
    if any(w in q for w in ["crash", "dashcam", "near miss", "close call", "truck"]):
        return "crash"
    if any(w in q for w in ["cliff", "jump", "base jump", "bungee", "climbing", "fall", "boulder", "wingsuit", "glass bridge"]):
        return "extreme_heights"
    if any(w in q for w in ["explosion", "demolition", "fireworks", "gender reveal", "implosion"]):
        return "explosion"
    if any(w in q for w in ["ski", "surfing", "snowboard", "parkour", "skateboard", "bmx", "wakeboard"]):
        return "extreme_sports"
    if any(w in q for w in ["lightning", "bear", "dog", "animal", "wave", "tornado", "ocean", "volcano", "shark"]):
        return "nature"
    if any(w in q for w in ["sports", "goal", "buzzer", "referee"]):
        return "extreme_sports"
    return "viral"


# ── Caption Templates ─────────────────────────────────────────────────────
TIKTOK_HASHTAGS = [
    "#friendship", "#texting", "#relatable", "#bestfriend",
    "#groupchat", "#nesso",
]

TIKTOK_NICHE_HASHTAGS = [
    "#friendshipgoals", "#growingup", "#adulting", "#realtalk",
    "#latenight", "#deepthoughts", "#missyou",
    "#drifting", "#textconvo", "#2amthoughts",
]

# Category-specific hashtags — mixed into captions based on hook type
CATEGORY_HASHTAGS = {
    "crash": ["#dashcam", "#carcrash", "#nearmiss", "#caughtoncamera", "#scary"],
    "extreme_heights": ["#extreme", "#heights", "#adrenaline", "#nope", "#vertigo"],
    "explosion": ["#explosion", "#demolition", "#slowmo", "#destruction", "#insane"],
    "extreme_sports": ["#extremesports", "#fail", "#wipeout", "#sendit", "#gnarly"],
    "nature": ["#nature", "#wildlife", "#caughtoncamera", "#scary", "#wow"],
    "viral": ["#viral", "#unbelievable", "#impossible", "#lucky", "#oneinamillion"],
}

IG_HASHTAGS = [
    "#friendship", "#bestfriend", "#relatable", "#texting",
    "#groupchat", "#nesso", "#friendshipquotes",
    "#adulting", "#growingup", "#realtalk",
    "#missyou", "#latenight",
]


TIKTOK_CAPTION_HOOKS = [
    "tag someone you haven't texted in months 👀",
    "this is everyone's friend group rn and nobody wants to admit it",
    "if this doesn't make you text your best friend idk what will",
    "the group chat has been QUIET lately 💀",
    "you're either the friend who disappeared or the friend who noticed",
    "pov: you realized you're the friend everyone forgot about",
    "this video + this conversation = why I can't sleep at 2am",
    "you scrolled past 47 people in your contacts today and texted none of them",
    "friendships have a shelf life and nobody talks about it",
    "the last message in your group chat is from 3 months ago and you know it",
]

IG_CAPTION_HOOKS = [
    "this hit different at 2am 💔",
    "tag your friend before it's too late",
    "we all have that one friend we keep meaning to call",
    "screenshot this and send it to the friend you've been neglecting",
    "if you watched this and thought of someone... text them rn",
    "the friend you're thinking of right now? they're thinking the same thing.",
    "stop scrolling and go text them. seriously.",
    "this is the sign you've been waiting for to reach out",
]

IG_PIN_COMMENTS = [
    "type the name of someone you've been meaning to text 👇",
    "how many months? be honest.",
    "if you screenshot this you HAVE to send it to them",
    "tag them before this becomes your story too",
    "the group chat is watching this rn and nobody's saying anything",
    "name one person you've been avoiding reaching out to 👇",
    "be honest... when's the last time you actually called your best friend?",
    "if you thought of someone while watching this, that's your sign",
]


def generate_tiktok_caption(story_theme: str = "", hook_category: str = "") -> str:
    niche = random.sample(TIKTOK_NICHE_HASHTAGS, min(4, len(TIKTOK_NICHE_HASHTAGS)))
    cat_tags = CATEGORY_HASHTAGS.get(hook_category, [])
    cat_sample = random.sample(cat_tags, min(2, len(cat_tags))) if cat_tags else []
    tags = " ".join(TIKTOK_HASHTAGS + niche + cat_sample)
    if story_theme:
        caption = story_theme
    else:
        caption = random.choice(TIKTOK_CAPTION_HOOKS)
    return f"{caption}\n\n{tags}"


def generate_ig_caption(story_theme: str = "", hook_category: str = "") -> str:
    cat_tags = CATEGORY_HASHTAGS.get(hook_category, [])
    cat_sample = random.sample(cat_tags, min(3, len(cat_tags))) if cat_tags else []
    base_tags = random.sample(IG_HASHTAGS, min(12, len(IG_HASHTAGS)))
    tags = " ".join(base_tags + cat_sample)
    if story_theme:
        caption = story_theme
    else:
        caption = random.choice(IG_CAPTION_HOOKS)
    return f"{caption}\n\n{tags}"


def generate_ig_pin_comment() -> str:
    """Generate a pin comment for Instagram — sent as a separate message."""
    return random.choice(IG_PIN_COMMENTS)


# ── Ensure temp dir exists ────────────────────────────────────────────────
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)
