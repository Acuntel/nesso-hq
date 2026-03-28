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
MORPH_DURATION = 0.3   # seconds
MORPH_TRANSITION = "fadeblack"  # default, but get_morph_transition() rotates

# Transition pool — only the most compatible ones that work everywhere
MORPH_TRANSITIONS = [
    "fade",
    "fadeblack",
    "fadewhite",
    "dissolve",
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

# ── Pexels API (fallback when YouTube is blocked) ─────────────────────────
PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "")

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
    # Food & Cooking Fails
    "cooking fail fire kitchen",
    "gordon ramsay disgusting food",
    "satisfying food cutting compilation",
    "cake decorating fail vs expectation",
    "street food satisfying compilation",
    # Gaming & Internet Culture
    "most insane gaming moment ever",
    "streamer freakout compilation",
    "speedrun impossible trick shot",
    "VR fail compilation hilarious",
    # Sports Highlights
    "most insane sports play ever",
    "crowd reaction incredible goal",
    "last second buzzer beater compilation",
    "referee worst call ever",
    # Satisfying & Oddly Satisfying
    "most satisfying video compilation",
    "hydraulic press crushing things",
    "perfect fit satisfying compilation",
    "domino chain reaction incredible",
    # Viral / AI / Unbelievable
    "most insane video on the internet",
    "AI generated video unbelievable",
    "impossible moments caught on camera",
    "luckiest people alive compilation",
    "one in a million caught on camera",
    "security camera unbelievable footage",
    "drone footage incredible discovery",
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
    "what if your phone reminded you to be a better friend",
    "Nesso knew I was about to lose my best friend before I did",
    "the app that won't let you become a stranger to the people you love",
    "one notification. that's all it would have taken.",
    "Nesso is basically a friendship insurance policy and it's free",
    "your phone tracks your screen time but not your friendships — Nesso does",
    "I almost let my best friendship die. Nesso didn't let me.",
    "the difference between staying close and drifting apart is one reminder",
    "Nesso pings you before the awkward 'hey stranger' text becomes necessary",
    "friendships don't end with a fight. they end with silence. Nesso breaks the silence.",
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
    if any(w in q for w in ["cooking", "food", "gordon", "cake", "kitchen", "street food"]):
        return "viral"
    if any(w in q for w in ["gaming", "streamer", "speedrun", "vr fail"]):
        return "viral"
    if any(w in q for w in ["sports", "goal", "buzzer", "referee"]):
        return "extreme_sports"
    if any(w in q for w in ["satisfying", "hydraulic", "domino", "perfect fit"]):
        return "viral"
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
    "when's the last time you actually called your best friend? 👀",
    "name the friend you haven't talked to in months 👇",
    "be honest... how long since you hung out with your closest friend?",
    "tag them before this becomes your story too 💔",
    "the group chat is watching this rn and nobody's saying anything 💀",
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
