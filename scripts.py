"""
Nesso Content Engine V21 — Two-Part Text Story Script Generation

Part 1: Tension build (4-5 messages) — hook the viewer emotionally
Part 2: Resolution (2-3 messages) — friend receives Nesso-generated message

The Nesso app demo plays BETWEEN Part 1 and Part 2.
"""

import json
import logging
import os
import random

import anthropic

from config import FALLBACKS_DIR, SCRIPT_PART1_MAX, SCRIPT_PART2_MAX

log = logging.getLogger(__name__)

# ── Outlandish Opener Templates ─────────────────────────────────────────
OUTLANDISH_OPENERS = [
    "Start with a specific stat or number — like 'I just counted how many times we said we should hang out this year. it's 11. we hung out zero times'",
    "Start with a raw confession — like 'I just realized I'm the friend everyone slowly phases out and I've known for months'",
    "Start with chaotic confrontational energy — like 'be honest. when's the last time you texted me first'",
    "Start with a specific, painful observation — like 'I just scrolled past 30 conversations in my texts before I found someone I actually talk to'",
]


SCRIPT_SYSTEM_PROMPT = """You write viral fake text message conversations for TikTok/Instagram Reels.

You are writing for an 18-25 year old audience. The texts must feel REAL — like screenshots someone took of their actual phone at 1am.

IMPORTANT: You must generate a TWO-PART script. The video structure is:
  Part 1 (tension) → Nesso app demo → Part 2 (resolution)

The Nesso app demo shows: friendship bar draining → tap "Reach out" → AI writes a message → tap to send.
Part 2 shows the friend RECEIVING that Nesso-generated text and reacting.

FORMAT: Return ONLY a JSON object with two arrays. No other text. No markdown.

{
  "part1": [
    {"sender": "me", "text": "message", "delay": 1.5},
    ...
  ],
  "part2": [
    {"sender": "best friend", "text": "wait did you just use an app to text me", "delay": 1.5},
    ...
  ]
}

"sender" options: "me", "best friend", "college roommate", "the group chat", or a first name.
"delay" is seconds before showing the NEXT message (controls pacing/tension).

DELAY RULES:
- Normal message: 1.0 - 1.5s
- Emotional weight: 1.5 - 2.0s
- Gut-punch moment: 2.0 - 2.5s
- "..." or typing: 1.5 - 2.0s
- MINIMUM: 0.8s. MAXIMUM: 3.0s.

PART 1 STRUCTURE (4-5 messages, STRICT):
1. Message 1: THE SCROLL-STOPPER. Most unhinged, specific opener possible.
2. Message 2: Other person responds — confused or defensive.
3. Message 3: Escalation with a SPECIFIC detail (name, number, date).
4. Message 4: The gut-punch line. Quotable on its own.
5. Message 5 (optional): "..." or a one-word silence. Let it hang.
The conversation must feel UNRESOLVED. The viewer should feel the weight.

PART 2 STRUCTURE (2-3 messages, STRICT):
This happens AFTER the Nesso app demo. The friend just received an AI-generated check-in message from the app. Part 2 shows their reaction.
1. Message 1: Friend reacts to receiving the text — surprised, touched, or calling it out ("wait did you just use an app to text me" / "ngl I needed this" / "bro where did that come from")
2. Message 2: "me" responds honestly — "yeah this app reminded me before I forgot again" / "it literally told me our friendship was fading" / "ngl it wrote the message for me but the feeling is real"
3. Message 3 (optional): "Read [time]" or a brief emotional close.

The BRIDGE between Part 1 and Part 2 must feel natural. Part 1 ends with tension about drifting apart. The Nesso demo shows the app intervening. Part 2 shows the result — connection restored.

CRITICAL RULES:
- All lowercase texting style. Use "ngl", "fr", "lol", "lmao", "bruh", "tbh" naturally.
- NEVER proper grammar. These are real texts not essays.
- At least ONE specific detail in Part 1 (a name, a number, a date).
- Each message is 1-2 short sentences MAX.
- Part 2 must reference the app naturally — not like an ad script, like a real reaction.
- The viewer should finish wanting to download Nesso IMMEDIATELY.

ARCHETYPES (pick one per script):
(a) THE AUDIT — evidence of drift, then Nesso catches it
(b) THE COMPARISON — "we used to ___ now we ___", then Nesso bridges the gap
(c) THE CONFESSION — admits noticing drift, Nesso gives them a way to act
(d) THE CALLOUT — confronts about disappearing, Nesso provides the olive branch
(e) THE GROUP CHAT AUTOPSY — dead group chat, Nesso revives it"""


def generate_text_story(
    hook_description: str,
    hook_category: str,
) -> tuple[list[dict], list[dict]]:
    """
    Generate a two-part text conversation.

    Returns:
        (part1_messages, part2_messages)
        - part1: 4-5 messages (tension build, plays before Nesso demo)
        - part2: 2-3 messages (resolution, plays after Nesso demo)
    """
    opener_style = random.choice(OUTLANDISH_OPENERS)

    user_message = (
        f"Hook video context: {hook_description} (category: {hook_category})\n\n"
        f"OPENER STYLE FOR MESSAGE 1:\n{opener_style}\n\n"
        "Generate a two-part fake text conversation. "
        "Part 1 plays BEFORE the Nesso app demo. Part 2 plays AFTER.\n\n"
        "Return ONLY the JSON object with part1 and part2 arrays. Nothing else."
    )

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        log.warning("ANTHROPIC_API_KEY not set — using fallback script")
        return get_fallback_script()

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            system=SCRIPT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        raw = response.content[0].text.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()

        data = json.loads(raw)

        # Handle both old format (flat array) and new format (part1/part2)
        if isinstance(data, list):
            # Old format — split it
            part1 = data[:SCRIPT_PART1_MAX]
            part2 = []
        else:
            part1 = data.get("part1", [])
            part2 = data.get("part2", [])

        part1 = _validate_messages(part1, max_msgs=SCRIPT_PART1_MAX, min_msgs=3)
        if part2:
            part2 = _validate_messages(part2, max_msgs=SCRIPT_PART2_MAX, min_msgs=2)
        else:
            part2 = _generate_default_part2()

        # Specificity check on part 1
        if not _has_specificity(part1):
            log.info("Script lacks specificity, retrying once...")
            try:
                response2 = client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=800,
                    system=SCRIPT_SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": user_message + "\n\nIMPORTANT: Include at least one SPECIFIC number, date, or name in Part 1."}],
                )
                raw2 = response2.content[0].text.strip()
                raw2 = raw2.replace("```json", "").replace("```", "").strip()
                data2 = json.loads(raw2)
                if isinstance(data2, dict):
                    retry_p1 = _validate_messages(data2.get("part1", []), max_msgs=SCRIPT_PART1_MAX, min_msgs=3)
                    retry_p2 = _validate_messages(data2.get("part2", []), max_msgs=SCRIPT_PART2_MAX, min_msgs=2)
                    if _has_specificity(retry_p1):
                        part1, part2 = retry_p1, retry_p2
            except Exception as e2:
                log.warning("Specificity retry failed: %s", e2)

        log.info("Script: Part 1 = %d msgs, Part 2 = %d msgs", len(part1), len(part2))
        return part1, part2

    except Exception as e:
        log.warning("Claude API failed, using fallback: %s", e)
        return get_fallback_script()


def _validate_messages(messages: list[dict], max_msgs: int = 9, min_msgs: int = 2) -> list[dict]:
    """Validate and clean up generated message list."""
    for msg in messages:
        if "sender" not in msg:
            raise ValueError("Missing sender in message")
        if "text" not in msg:
            raise ValueError("Missing text in message")
        if "delay" not in msg:
            msg["delay"] = 1.2
        msg["delay"] = max(0.8, min(3.0, msg["delay"]))

        # Normalize system indicators
        text_l = msg["text"].strip().lower()
        if (text_l == "..."
                or text_l == "typing..."
                or text_l == "typing"
                or text_l.startswith("read ")
                or text_l == "delivered"):
            msg["sender"] = "system"

    if len(messages) > max_msgs:
        messages = messages[:max_msgs]
    if len(messages) < min_msgs:
        raise ValueError(f"Script too short — only {len(messages)} messages, need at least {min_msgs}")

    return messages


def _has_specificity(messages: list[dict]) -> bool:
    """Check that at least one message contains a specific detail."""
    import re
    for msg in messages:
        if msg.get("sender") == "system":
            continue
        text = msg.get("text", "")
        if re.search(r'\d+', text):
            return True
        if re.search(r'\b(january|february|march|april|may|june|july|august|september|october|november|december)\b', text, re.IGNORECASE):
            return True
        if re.search(r'\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b', text, re.IGNORECASE):
            return True
    return False


def _generate_default_part2() -> list[dict]:
    """Generate a default Part 2 when Claude doesn't return one."""
    return random.choice([
        [
            {"sender": "best friend", "text": "wait did you just use an app to text me", "delay": 1.5},
            {"sender": "me", "text": "yeah it literally told me our friendship was fading", "delay": 2.0},
            {"sender": "system", "text": "Read 1:47 AM", "delay": 2.0},
        ],
        [
            {"sender": "best friend", "text": "ngl I actually needed this tonight", "delay": 1.5},
            {"sender": "me", "text": "an app had to remind me to text you and that's kinda the whole problem", "delay": 2.5},
            {"sender": "system", "text": "Read 2:03 AM", "delay": 2.0},
        ],
        [
            {"sender": "best friend", "text": "bro where did that come from", "delay": 1.2},
            {"sender": "me", "text": "this app showed me a timer running out on our friendship and I panicked", "delay": 2.0},
            {"sender": "best friend", "text": "ok that's actually insane but also thank you", "delay": 2.0},
        ],
    ])


def get_fallback_script() -> tuple[list[dict], list[dict]]:
    """Load a random fallback script from the JSON file, split into two parts."""
    scripts_path = os.path.join(FALLBACKS_DIR, "scripts.json")
    try:
        with open(scripts_path) as f:
            all_scripts = json.load(f)
        script = random.choice(all_scripts)

        # Check if it's already two-part format
        if isinstance(script, dict) and "part1" in script:
            p1 = _validate_messages(script["part1"], max_msgs=SCRIPT_PART1_MAX, min_msgs=3)
            p2 = _validate_messages(script["part2"], max_msgs=SCRIPT_PART2_MAX, min_msgs=2)
            return p1, p2

        # Old format — split and add Part 2
        msgs = _validate_messages(script, max_msgs=SCRIPT_PART1_MAX, min_msgs=3)
        return msgs, _generate_default_part2()
    except Exception as e:
        log.error("Failed to load fallback scripts: %s", e)
        return random.choice(HARDCODED_FALLBACKS)


HARDCODED_FALLBACKS = [
    (
        # Part 1 — tension
        [
            {"sender": "me", "text": "I have 847 contacts and I could only call 3 of them at 2am", "delay": 1.5},
            {"sender": "best friend", "text": "that's not true lol", "delay": 1.0},
            {"sender": "me", "text": "ok name 5 people you've actually talked to this month. not texted. TALKED.", "delay": 2.0},
            {"sender": "system", "text": "...", "delay": 1.5},
            {"sender": "me", "text": "we just stopped trying and called it growing up", "delay": 2.0},
        ],
        # Part 2 — resolution after Nesso demo
        [
            {"sender": "best friend", "text": "wait what made you text me rn", "delay": 1.2},
            {"sender": "me", "text": "this app told me our friendship was dying and honestly it was right", "delay": 2.0},
            {"sender": "system", "text": "Read 11:47 PM", "delay": 2.0},
        ],
    ),
    (
        [
            {"sender": "me", "text": "be honest. when's the last time you texted me first", "delay": 2.0},
            {"sender": "best friend", "text": "what are you talking about I text you all the time", "delay": 1.5},
            {"sender": "me", "text": "scroll up. every conversation for the last 4 months starts with me", "delay": 2.5},
            {"sender": "system", "text": "...", "delay": 2.0},
        ],
        [
            {"sender": "best friend", "text": "ngl I didn't expect that text tonight", "delay": 1.5},
            {"sender": "me", "text": "yeah an app had to tell me to reach out and that's the saddest part", "delay": 2.0},
            {"sender": "system", "text": "Delivered", "delay": 2.0},
        ],
    ),
    (
        [
            {"sender": "me", "text": "ok new fear just dropped", "delay": 1.2},
            {"sender": "best friend", "text": "what now", "delay": 1.0},
            {"sender": "me", "text": "I've known your birthday was coming up for 2 weeks and I still almost forgot", "delay": 2.5},
            {"sender": "best friend", "text": "bro we literally have a tradition", "delay": 1.5},
            {"sender": "me", "text": "HAD a tradition", "delay": 2.0},
        ],
        [
            {"sender": "best friend", "text": "wait was that an AI message or was that you", "delay": 1.5},
            {"sender": "me", "text": "the app wrote it but the feeling is 100% real", "delay": 2.0},
            {"sender": "system", "text": "Read 11:58 PM", "delay": 2.0},
        ],
    ),
]
