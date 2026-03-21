"""
Nesso Content Engine V20 — Text Story Script Generation (Claude API + Fallbacks)
"""

import json
import logging
import os
import random

import anthropic

from config import FALLBACKS_DIR

log = logging.getLogger(__name__)

SCRIPT_SYSTEM_PROMPT = """You write viral fake text message conversations for TikTok/Instagram Reels.

You are writing for a 20-25 year old audience. The texts must feel REAL — like screenshots from someone's actual phone.

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
1. Message 1: React to the hook video (you'll be told what it showed)
2. Message 2: OUTLANDISH pivot — something so unexpected the viewer is confused and can't scroll
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

WHAT MAKES THE FIRST LINE OUTLANDISH (pick one approach per video):
- A meme reference: "bro I'm literally the friend everyone replaces first 💀"
- A shocking stat: "apparently the average person loses 4 close friends every 5 years"
- An uncomfortable truth bomb: "I think we're all in dying friendships and just pretending"
- A direct callout: "when's the last time you actually called someone instead of texting"
- A confession: "I have 847 contacts and I could only call 3 of them at 2am"
- Self-deprecating humor: "my phone autocorrects 'let's hang' to 'let's reschedule' at this point"
"""


def generate_text_story(
    hook_description: str,
    hook_category: str,
) -> list[dict]:
    """
    Call Claude API to generate the fake text conversation.
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

    user_message = (
        f"The hook video shows: {hook_description}\n"
        f"Hook category: {hook_category}\n"
        f"Bridge approach: {bridge_hint}\n\n"
        "Generate a fake text conversation that:\n"
        "1. Opens with a SHORT reaction to the hook video (1 message, generic is fine — 'bro that was INSANE' etc.)\n"
        "2. Message 2: The OUTLANDISH pivot — use the bridge approach above to connect the hook to friendship\n"
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
            {"sender": "me", "text": "bro that was insane 💀", "delay": 1.5},
            {"sender": "me", "text": "speaking of insane... when's the last time you talked to your best friend", "delay": 2.0},
            {"sender": "best friend", "text": "wdym we're talking rn", "delay": 1.5},
            {"sender": "me", "text": "no like actually talked. not just memes", "delay": 2.0},
            {"sender": "best friend", "text": "...", "delay": 2.5},
            {"sender": "me", "text": "exactly", "delay": 1.5},
            {"sender": "best friend", "text": "idk what happened tbh", "delay": 2.0},
            {"sender": "me", "text": "me neither", "delay": 1.5},
            {"sender": "system", "text": "Read 11:47 PM", "delay": 3.0},
        ]
