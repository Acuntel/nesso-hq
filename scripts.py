"""
Nesso Content Engine V20 — Text Story Script Generation (Claude API + Trending Memes + Fallbacks)
"""

import json
import logging
import os
import random
import time

import anthropic
import requests

from config import FALLBACKS_DIR, TEMP_DIR

log = logging.getLogger(__name__)

# ── Trending Meme Cache ──────────────────────────────────────────────────
TRENDS_CACHE_PATH = os.path.join(TEMP_DIR, "trends_cache.json")
TRENDS_CACHE_TTL = 86400  # 24 hours


def fetch_trending_memes() -> list[str]:
    """
    Fetch current trending meme formats/phrases from TikTok and Instagram.
    Uses YouTube trending search as a proxy (reliable, no auth needed).
    Caches results for 24h to avoid hammering APIs every render.
    Falls back to curated list if fetch fails.
    """
    # Check cache first
    if os.path.exists(TRENDS_CACHE_PATH):
        try:
            with open(TRENDS_CACHE_PATH) as f:
                cache = json.load(f)
            if time.time() - cache.get("timestamp", 0) < TRENDS_CACHE_TTL:
                log.debug("Using cached trending memes (%d items)", len(cache["trends"]))
                return cache["trends"]
        except (json.JSONDecodeError, KeyError):
            pass

    # Use curated meme formats — no external API needed
    # (YouTube search/API calls fail from datacenter IPs)
    trends = _get_curated_meme_formats()

    # Cache results
    try:
        with open(TRENDS_CACHE_PATH, "w") as f:
            json.dump({"timestamp": time.time(), "trends": trends}, f)
    except OSError:
        pass

    log.info("Fetched %d trending meme references", len(trends))
    return trends


def _get_curated_meme_formats() -> list[str]:
    """
    Curated meme format templates that stay semi-evergreen.
    Updated manually when needed — these are PATTERNS not specific memes.
    """
    return [
        "the 'no way that just happened' reaction into emotional pivot",
        "the 'me explaining to my therapist' format",
        "the 'tell me you're ___ without telling me' format",
        "the 'pov: you just realized...' format",
        "the 'this or that' impossible choice meme",
        "the 'I need to tell someone this' fake confession format",
        "the 'things that just hit different at 2am' format",
        "the 'name one person who...' callout format",
        "the 'be honest...' confrontational opener",
        "the 'I'm sorry but...' hot take format",
        "the 'nobody talks about how...' awareness format",
        "the 'the feminine/masculine urge to...' format",
        "the 'normalize...' statement format",
        "the 'you're not ready for this conversation' warning format",
        "the 'unpopular opinion:' hot take opener",
        "the 'it's giving...' energy description format",
        "the 'caught in 4k' expose format",
        "the 'core memory unlocked' nostalgia format",
        "the 'delulu is the solulu' delusional format",
        "the 'girl math / boy math' logic format",
    ]


# ── Outlandish Opener Templates ─────────────────────────────────────────
# These are the PATTERNS for message 1. Claude fills them in.
OUTLANDISH_OPENERS = [
    "Start with a completely unhinged observation that makes zero sense at first — like 'I just calculated how many hours I've spent rewatching someone's story without ever DMing them' or 'my phone just reminded me I have a contact saved as \"DO NOT LOSE THIS PERSON\" and I haven't texted them in 8 months'",
    "Start with a fake stat that sounds real — like 'apparently you lose 70% of your friend group between 22-27 and nobody warns you' or 'I saw a study that said the average friendship lasts 7 years and we're on year 6'",
    "Start with a meme-format confession — like 'pov: you're the friend everyone slowly phases out and you just realized it' or 'be honest... when's the last time someone called you first'",
    "Start with a chaotic screenshot energy — like 'I just scrolled to the bottom of my texts and found a conversation from 2019 that ended mid-sentence and neither of us ever finished it' or 'my recents are literally just doordash and my mom'",
    "Start with a dramatic setup — like 'ok I need to tell someone this before I spiral' or 'don't judge me but I just cried about something really stupid' or 'I think I just had the most depressing realization of my life'",
    "Start with absurd self-awareness — like 'I am literally the NPC friend. I just respond and never initiate.' or 'my friendship style is 'deep emotional connection followed by 6 months of silence''",
    "Start with a trending callout — like 'this is your sign to text that friend back' or 'no because why did that video just unlock a core memory I was suppressing'",
    "Start with chaotic energy — like 'WAIT WAIT WAIT I just figured something out and it's BAD' or 'ok new fear just dropped' or 'I need everyone to stop what they're doing'",
]


SCRIPT_SYSTEM_PROMPT = """You write viral fake text message conversations for TikTok/Instagram Reels.

You are writing for an 18-25 year old audience. The texts must feel REAL — like screenshots from someone's actual phone at 1am.

TONE: Not sad. Not preachy. Not motivational. The tone is: "late night honest texts between two friends who are realizing something uncomfortable about their friendship."

FORMAT: Return ONLY a JSON array. No other text. No markdown. No explanation.

[
  {"sender": "me", "text": "message text here", "delay": 0.8},
  {"sender": "best friend", "text": "response here", "delay": 0.5}
]

"sender" options: "me", "best friend", "college roommate", "the group chat", or a first name
"delay" is seconds to wait before showing this message (controls pacing).
DELAYS MUST BE SLOW ENOUGH TO READ. Guidelines:
- Regular messages: 1.2 - 2.0 seconds
- Messages with emotional weight or longer text: 2.0 - 2.5 seconds
- Gut-punch / knife moments: 2.5 - 3.5 seconds
- "..." or typing indicators: 2.0 - 3.0 seconds (let the silence build)
- "Read" receipts or "delivered": 2.5 - 3.5 seconds (the pause IS the emotion)
- NEVER go below 1.0 seconds on any message

STRUCTURE:
1. Message 1: THE SCROLL-STOPPER. This is NOT a reaction to the video. This is the most unhinged, attention-grabbing, meme-format opener you can write. Something so specific or chaotic that the viewer HAS to keep reading. Use current TikTok/Instagram meme language and formats. This line alone should make someone pause scrolling.
2. Message 2: The OUTLANDISH pivot — connect it to friendship in a way nobody expects
3. Messages 3-5: Build emotional tension through friendship guilt or drift
4. Messages 6-8: The knife — the specific, painful, relatable moment
5. Messages 9-12: Unresolved ending — someone leaves on read, or types and deletes, or sends "..."
6. No resolution. No "let's hang out." No fix. Just the wound.

RULES:
- All lowercase texting style. "ngl", "fr", "lol", "lmao", "bruh", "tbh", "wym", "idk"
- NEVER proper grammar. These are real texts.
- At least one "read 11:47 PM" or "delivered" or "typing..." indicator
- At least one message that's just "..." or a single word response
- The emotional gut-punch must be SPECIFIC — not "I miss hanging out" but "I just realized the last photo I have with Jake is from sophomore year"
- Reference a SPECIFIC detail that makes it feel real (a name, a place, a date, a memory)
- 8-15 messages. STRICT limit. More than 15 and viewers drop off.
- Each message is 1-2 short sentences. NO paragraphs.
- The conversation must make the viewer want to text their friend IMMEDIATELY
- Use current slang and meme language naturally — don't force it

=== EXAMPLES OF PERFECT 10/10 SCRIPTS ===

EXAMPLE 1 (scroll-stopper opener → specific gut-punch → unresolved):
[
  {"sender": "me", "text": "I have 847 contacts and I could only call 3 of them at 2am", "delay": 2.5},
  {"sender": "best friend", "text": "that's not true lol", "delay": 1.5},
  {"sender": "me", "text": "ok name 5 people you've actually TALKED to this month. not texted. talked.", "delay": 2.5},
  {"sender": "best friend", "text": "...", "delay": 2.5},
  {"sender": "me", "text": "exactly", "delay": 1.5},
  {"sender": "me", "text": "I just realized the last time I called someone who wasn't my mom was in february", "delay": 3.0},
  {"sender": "best friend", "text": "ok that's actually insane when you say it like that", "delay": 2.0},
  {"sender": "me", "text": "we went from 3 hour FaceTime calls to not even knowing each other's ringtone", "delay": 3.0},
  {"sender": "system", "text": "Read 1:23 AM", "delay": 3.0}
]

EXAMPLE 2 (chaotic energy → specific memory → painful silence):
[
  {"sender": "me", "text": "ok new fear just dropped", "delay": 1.5},
  {"sender": "best friend", "text": "what now", "delay": 1.2},
  {"sender": "me", "text": "I just looked at my camera roll and the last pic I have with my best friend from high school is from 2021", "delay": 3.0},
  {"sender": "best friend", "text": "who marcus?", "delay": 1.5},
  {"sender": "me", "text": "yeah. we literally said 'friends forever' at graduation", "delay": 2.5},
  {"sender": "me", "text": "forever lasted about 2 years", "delay": 2.0},
  {"sender": "best friend", "text": "did something happen or", "delay": 1.5},
  {"sender": "me", "text": "that's the worst part. nothing happened. we just stopped.", "delay": 3.0},
  {"sender": "best friend", "text": "...", "delay": 2.5},
  {"sender": "me", "text": "and neither of us has said a word about it", "delay": 2.5},
  {"sender": "system", "text": "Delivered", "delay": 3.0}
]

EXAMPLE 3 (meme format opener → uncomfortable truth → left on read):
[
  {"sender": "me", "text": "pov: you're the friend everyone slowly replaces and you just realized it", "delay": 2.5},
  {"sender": "best friend", "text": "why would you send me this at midnight", "delay": 1.5},
  {"sender": "me", "text": "because I just saw emma's story and she's with people I've never even met", "delay": 2.5},
  {"sender": "me", "text": "we used to be inseparable. now I don't even know her friends' names", "delay": 2.5},
  {"sender": "best friend", "text": "tbh that happens to everyone after college", "delay": 2.0},
  {"sender": "me", "text": "does that make it hurt less?", "delay": 2.0},
  {"sender": "best friend", "text": "no", "delay": 1.5},
  {"sender": "me", "text": "the wild part is she probably doesn't even know she replaced me. it just happened.", "delay": 3.0},
  {"sender": "system", "text": "typing...", "delay": 3.0},
  {"sender": "system", "text": "Read 12:47 AM", "delay": 3.0}
]

Study these examples. The pattern is: MESSAGE 1 STOPS THE SCROLL. Then the conversation spirals into something painfully relatable. It ends unresolved.
"""


def generate_text_story(
    hook_description: str,
    hook_category: str,
) -> list[dict]:
    """
    Call Claude API to generate the fake text conversation.
    Injects trending meme context for scroll-stopping openers.
    Falls back to pre-written scripts if API fails.
    """
    # Map hook categories to bridge approaches so the pivot feels natural
    category_bridges = {
        "crash": "Use the crash/impact as a metaphor — friendships crash too, just slower",
        "extreme_heights": "Use the height/falling as a metaphor — the fall from close friends to strangers",
        "explosion": "Use the destruction as a metaphor — how fast a friendship can blow up or fall apart",
        "extreme_sports": "Use the risk/adrenaline angle — we take risks for thrills but won't risk a text to an old friend",
        "nature": "Use the force-of-nature angle — friendship drift is as unstoppable as a wave or storm",
        "viral": "Use the 'unbelievable' angle — it's unbelievable how fast we lose touch with people",
    }
    bridge_hint = category_bridges.get(hook_category, "React with shock, then pivot to friendship")

    # Fetch trending memes for context
    trending = fetch_trending_memes()
    trending_context = ""
    if trending:
        sample = random.sample(trending, min(5, len(trending)))
        trending_context = (
            "\n\nCURRENT TRENDING MEME REFERENCES (use these for inspiration on tone/format, "
            "don't copy directly — adapt the energy):\n"
            + "\n".join(f"- {t}" for t in sample)
        )

    # Pick an opener style
    opener_style = random.choice(OUTLANDISH_OPENERS)

    user_message = (
        f"The hook video shows: {hook_description}\n"
        f"Hook category: {hook_category}\n"
        f"Bridge approach: {bridge_hint}\n\n"
        f"OPENER STYLE FOR MESSAGE 1:\n{opener_style}\n"
        f"{trending_context}\n\n"
        "Generate a fake text conversation that:\n"
        "1. Opens with a SCROLL-STOPPING first message using the opener style above. "
        "NOT a reaction to the video. The viewer hasn't seen the hook yet when they read this — "
        "the text story plays AFTER the hook. The first message should be so unhinged or specific "
        "that the viewer can't scroll past it.\n"
        "2. Message 2: The OUTLANDISH pivot — use the bridge approach to connect to friendship\n"
        "3. Builds emotional tension through a specific, relatable friendship drift scenario\n"
        "4. Ends unresolved — someone leaves on read or the conversation trails off\n\n"
        "Return ONLY the JSON array. Nothing else."
    )

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        log.warning("ANTHROPIC_API_KEY not set — using fallback script")
        return get_fallback_script()

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            system=SCRIPT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        raw = response.content[0].text.strip()
        # Strip markdown fences if present
        raw = raw.replace("```json", "").replace("```", "").strip()

        messages = json.loads(raw)
        messages = _validate_messages(messages)
        log.info("Generated script via Claude API: %d messages", len(messages))
        return messages

    except Exception as e:
        log.warning("Claude API failed, using fallback: %s", e)
        return get_fallback_script()


def _validate_messages(messages: list[dict]) -> list[dict]:
    """Validate and clean up generated message list."""
    for msg in messages:
        if "sender" not in msg:
            raise ValueError("Missing sender in message")
        if "text" not in msg:
            raise ValueError("Missing text in message")
        if "delay" not in msg:
            msg["delay"] = 1.2
        # Enforce minimum 1.0s delay — anything faster is unreadable
        msg["delay"] = max(1.0, msg["delay"])

    if len(messages) > 15:
        messages = messages[:15]
    if len(messages) < 6:
        raise ValueError(f"Script too short — only {len(messages)} messages, need at least 6")

    return messages


def get_fallback_script() -> list[dict]:
    """Load a random fallback script from the JSON file."""
    scripts_path = os.path.join(FALLBACKS_DIR, "scripts.json")
    try:
        with open(scripts_path) as f:
            all_scripts = json.load(f)
        script = random.choice(all_scripts)
        return _validate_messages(script)
    except Exception as e:
        log.error("Failed to load fallback scripts: %s", e)
        # Ultimate fallback — hardcoded minimal script
        return [
            {"sender": "me", "text": "I have 847 contacts and I could only call 3 of them at 2am", "delay": 2.0},
            {"sender": "best friend", "text": "that's not true lol", "delay": 1.5},
            {"sender": "me", "text": "ok name 5 people you've actually talked to this month. not texted. TALKED.", "delay": 2.5},
            {"sender": "best friend", "text": "...", "delay": 2.5},
            {"sender": "me", "text": "exactly", "delay": 1.5},
            {"sender": "best friend", "text": "idk what happened tbh", "delay": 2.0},
            {"sender": "me", "text": "nothing happened. that's the whole problem.", "delay": 2.5},
            {"sender": "system", "text": "Read 11:47 PM", "delay": 3.0},
        ]
