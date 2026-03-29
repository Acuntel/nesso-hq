"""
Nesso Content Engine V21 — Text Story Script Generation (Claude API + Fallbacks)
"""

import json
import logging
import os
import random

import anthropic

from config import FALLBACKS_DIR

log = logging.getLogger(__name__)

# ── Outlandish Opener Templates ─────────────────────────────────────────
# These are the PATTERNS for message 1. Claude fills them in.
OUTLANDISH_OPENERS = [
    "Start with a specific stat or number that sounds real — like 'I just counted how many times we said we should hang out this year. it's 11. we hung out zero times' or 'apparently you lose 70% of your friend group between 22-27 and nobody warns you'",
    "Start with a raw confession or admission — like 'I just realized I'm the friend everyone slowly phases out and I've known for months' or 'ngl I almost didn't text you back today and I don't even know why'",
    "Start with chaotic confrontational energy — like 'be honest. when's the last time you texted me first' or 'ok new fear just dropped' or 'WAIT I just figured something out and it's bad'",
    "Start with a specific, painful observation — like 'I just scrolled past 30 conversations in my texts before I found someone I actually talk to' or 'the last photo I have with my best friend from high school is from 2022'",
]


SCRIPT_SYSTEM_PROMPT = """You write viral fake text message conversations for TikTok/Instagram Reels.

You are writing for an 18-25 year old audience. The texts must feel REAL — like screenshots someone took of their actual phone at 1am and posted without context.

TONE: Late night, brutally honest, between two friends realizing something uncomfortable. Not sad — CONFRONTATIONAL. The best scripts feel like an argument with the truth. Mix in dark humor. These aren't therapy sessions — they're 2am spirals that make viewers laugh nervously then sit in silence.

FORMAT: Return ONLY a JSON array. No other text. No markdown.

[
  {"sender": "me", "text": "message text here", "delay": 1.5},
  {"sender": "best friend", "text": "response here", "delay": 1.2}
]

"sender" options: "me", "best friend", "college roommate", "the group chat", or a first name.
"delay" is seconds before showing the NEXT message (controls pacing/tension).

DELAY RULES (critical for watchability):
- Normal message: 1.0 - 1.5s
- Emotional weight / longer text: 1.5 - 2.0s
- Gut-punch moment: 2.0 - 2.5s
- "..." or typing indicator: 1.5 - 2.0s (silence builds tension)
- "Read" receipts / "Delivered": 2.0 - 2.5s (the pause IS the emotion)
- MINIMUM: 0.8s. MAXIMUM: 3.0s. Never go outside this range.

STRUCTURE (7-9 messages, STRICT — more than 9 and viewers leave):
1. Message 1: THE SCROLL-STOPPER. The most unhinged, specific, chaotic opener possible. A stat, a confession, an observation so precise the viewer can't scroll past. This is NOT a reaction to anything. It's a cold open that hits like a slap. Think "I just counted..." / "ok new fear" / "pov: you just realized..." energy.
2. Message 2-3: The pivot — connect to friendship in a way nobody expects. The other person pushes back or questions it.
3. Messages 4-6: Build tension through SPECIFICS. Not "I miss hanging out" — name a person, a date, a place, a group chat, a photo, a memory. Specificity is virality.
4. Messages 7-8: The knife. One message that makes the viewer's stomach drop. It should be quotable on its own.
5. Final message: "Read [time]", "Delivered", "typing..." or a single-word response. NEVER a resolution. NEVER "let's hang out." The wound stays open.

CRITICAL RULES:
- All lowercase texting style. Use "ngl", "fr", "lol", "lmao", "bruh", "tbh", "wym", "idk" naturally.
- NEVER proper grammar. These are real texts not essays.
- At least one "..." response (lets the silence speak).
- At least ONE specific detail that makes it feel real — a name, a number, a date, a place.
- The knife message must be QUOTABLE — if someone screenshotted just that one message, it should hit on its own.
- Each message is 1-2 short sentences MAX. No paragraphs.
- The viewer should finish this wanting to text their friend IMMEDIATELY.
- Vary the emotional approach across these archetypes:
  (a) THE AUDIT — one friend presents evidence of drift (stats, screenshots, dates)
  (b) THE COMPARISON — "we used to ___ now we ___" escalating contrast
  (c) THE CONFESSION — one friend admits they noticed the drift and said nothing
  (d) THE CALLOUT — one friend directly confronts the other about disappearing
  (e) THE GROUP CHAT AUTOPSY — examining a dead group chat together
  Pick one per script. Do NOT always default to (a).

EXAMPLES OF 10/10 SCRIPTS:

EXAMPLE 1 — THE AUDIT:
[
  {"sender": "me", "text": "I have 847 contacts and I could call maybe 3 of them at 2am", "delay": 2.0},
  {"sender": "best friend", "text": "that's not true lol", "delay": 1.2},
  {"sender": "me", "text": "ok name 5 people you've actually TALKED to this month. not texted. talked.", "delay": 2.0},
  {"sender": "best friend", "text": "...", "delay": 2.0},
  {"sender": "me", "text": "exactly", "delay": 1.2},
  {"sender": "me", "text": "the last time I called someone who wasn't my mom was february", "delay": 2.5},
  {"sender": "best friend", "text": "ok that's actually insane when you say it out loud", "delay": 1.8},
  {"sender": "me", "text": "we went from 3 hour facetime calls to not even knowing each other's ringtone", "delay": 2.5},
  {"sender": "system", "text": "Read 1:23 AM", "delay": 2.5}
]

EXAMPLE 2 — THE CONFESSION:
[
  {"sender": "me", "text": "ok new fear just dropped", "delay": 1.2},
  {"sender": "best friend", "text": "what now", "delay": 1.0},
  {"sender": "me", "text": "I've known your birthday was coming up for 2 weeks and I still almost forgot", "delay": 2.5},
  {"sender": "best friend", "text": "bro we literally have a tradition", "delay": 1.5},
  {"sender": "me", "text": "HAD a tradition", "delay": 2.0},
  {"sender": "me", "text": "the worst part is I only remembered because instagram reminded me. not my brain. an app.", "delay": 2.5},
  {"sender": "best friend", "text": "...", "delay": 2.0},
  {"sender": "system", "text": "typing...", "delay": 1.5},
  {"sender": "system", "text": "Read 11:58 PM", "delay": 2.5}
]

EXAMPLE 3 — THE CALLOUT:
[
  {"sender": "me", "text": "be honest. when's the last time you texted me first", "delay": 2.0},
  {"sender": "best friend", "text": "what are you talking about I text you all the time", "delay": 1.5},
  {"sender": "me", "text": "scroll up", "delay": 1.5},
  {"sender": "best friend", "text": "...", "delay": 2.0},
  {"sender": "best friend", "text": "ok that's actually crazy", "delay": 1.5},
  {"sender": "me", "text": "every single conversation for the last 4 months starts with me", "delay": 2.5},
  {"sender": "me", "text": "I stopped texting first for a week to see what would happen and you literally didn't notice", "delay": 2.5},
  {"sender": "system", "text": "Delivered", "delay": 2.5}
]

Study the ENERGY of these examples. Message 1 stops the scroll. The conversation spirals. It ends unresolved. Every script should make the viewer feel personally attacked."""


def generate_text_story(
    hook_description: str,
    hook_category: str,
) -> list[dict]:
    """
    Call Claude API to generate the fake text conversation.
    Falls back to pre-written scripts if API fails.
    """
    # Pick an opener style
    opener_style = random.choice(OUTLANDISH_OPENERS)

    user_message = (
        f"Hook video context: {hook_description} (category: {hook_category})\n\n"
        f"OPENER STYLE FOR MESSAGE 1:\n{opener_style}\n\n"
        "Generate a fake text conversation. "
        "The text story plays AFTER the hook video — it's a separate scene. "
        "The first message should be so specific or chaotic that the viewer can't scroll past it.\n\n"
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
            max_tokens=800,
            system=SCRIPT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        raw = response.content[0].text.strip()
        # Strip markdown fences if present
        raw = raw.replace("```json", "").replace("```", "").strip()

        messages = json.loads(raw)
        messages = _validate_messages(messages)

        # Check for specificity — retry once if too generic
        if not _has_specificity(messages):
            log.info("Script lacks specificity, retrying once...")
            try:
                response2 = client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=800,
                    system=SCRIPT_SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": user_message + "\n\nIMPORTANT: Include at least one SPECIFIC number, date, or name. Make it painfully specific."}],
                )
                raw2 = response2.content[0].text.strip()
                raw2 = raw2.replace("```json", "").replace("```", "").strip()
                retry_messages = json.loads(raw2)
                retry_messages = _validate_messages(retry_messages)
                if _has_specificity(retry_messages):
                    messages = retry_messages
                    log.info("Retry produced specific script: %d messages", len(messages))
            except Exception as e2:
                log.warning("Specificity retry failed: %s — using original", e2)

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
        # Enforce minimum 0.8s delay — anything faster is unreadable
        msg["delay"] = max(0.8, msg["delay"])
        msg["delay"] = min(3.0, msg["delay"])

    if len(messages) > 9:
        messages = messages[:9]
    if len(messages) < 7:
        raise ValueError(f"Script too short — only {len(messages)} messages, need at least 7")

    return messages


def _has_specificity(messages: list[dict]) -> bool:
    """Check that at least one message contains a specific detail (name, number, date)."""
    import re
    for msg in messages:
        if msg.get("sender") == "system":
            continue
        text = msg.get("text", "")
        # Check for numbers, proper names (capitalized words), dates, months
        if re.search(r'\d+', text):
            return True
        if re.search(r'\b(january|february|march|april|may|june|july|august|september|october|november|december)\b', text, re.IGNORECASE):
            return True
        if re.search(r'\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b', text, re.IGNORECASE):
            return True
    return False


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
            {"sender": "me", "text": "I have 847 contacts and I could only call 3 of them at 2am", "delay": 1.5},
            {"sender": "best friend", "text": "that's not true lol", "delay": 1.0},
            {"sender": "me", "text": "ok name 5 people you've actually talked to this month. not texted. TALKED.", "delay": 2.0},
            {"sender": "best friend", "text": "...", "delay": 1.5},
            {"sender": "me", "text": "exactly", "delay": 1.0},
            {"sender": "best friend", "text": "idk what happened tbh", "delay": 1.5},
            {"sender": "me", "text": "nothing happened. that's the whole problem.", "delay": 2.0},
            {"sender": "me", "text": "we just stopped trying and called it growing up", "delay": 2.0},
            {"sender": "system", "text": "Read 11:47 PM", "delay": 2.5},
        ]
