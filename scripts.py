"""
Nesso Content Engine V22 — Script Generation

Produces one unified script dict:

    {
      "hook_line": str,
      "hook_subline": str,
      "palette": "rose" | "indigo",
      "contact_name": str,       # header name shown in iMessage chrome
      "person_name": str,        # who the app demo shows (often same as contact_name)
      "months_since": int,       # "X months since you talked"
      "messages": [              # 4-6 messages, one with emphasis=True
        {"sender": "me" | "other" | "system", "text": str, "delay": float, "emphasis": bool}
      ],
      "ai_message": str,         # what the app's AI types during the demo
    }
"""

from __future__ import annotations

import json
import logging
import os
import random
import re

import anthropic

from config import (
    FALLBACKS_DIR,
    MESSAGES_MAX,
    MESSAGES_MIN,
    MAX_MESSAGE_DELAY,
    MIN_MESSAGE_DELAY,
    get_random_ai_message,
    get_random_hook,
)

log = logging.getLogger(__name__)


SYSTEM_PROMPT = """You write viral fake text conversations for TikTok/Reels about friendship drift.

You must return ONLY a JSON object with this exact shape. No prose. No markdown fences.

{
  "contact_name": "best friend",
  "person_name": "Sarah",
  "months_since": 4,
  "messages": [
    {"sender": "me",    "text": "<message>", "delay": 1.2, "emphasis": false},
    {"sender": "other", "text": "<message>", "delay": 1.4, "emphasis": false},
    {"sender": "me",    "text": "<the gut-punch>", "delay": 1.8, "emphasis": true},
    {"sender": "me",    "text": "<quiet close>", "delay": 2.0, "emphasis": false},
    {"sender": "system", "text": "Read 1:47 AM", "delay": 0.8, "emphasis": false}
  ]
}

RULES:
- 4 to 6 messages total. HARD CAP 6. Count them.
- Exactly one message with emphasis=true. It's the quotable gut-punch line — the thing a viewer would screenshot.
- Last message MUST be a system read receipt like "Read 1:47 AM" or "Read 2:14 AM" (pick a believable late-night time).
- "sender" is only "me", "other", or "system".
- person_name = a single first name like "Sarah", "Maya", "Emma", "Jake", "Alex". Match what you put as contact_name's subject.
- contact_name = how the conversation is labelled in iMessage. Usually a phrase like "best friend", "sarah", "the group chat", or a first name. Keep under 18 chars.
- months_since = integer 2-12 (months of silence). Usually 3-6 for emotional truth.
- delay = seconds before the NEXT message. Range 0.8-2.5. The emphasis message gets 1.8-2.5.
- Messages are lowercase, texting style. No proper grammar. Use "ngl", "fr", "lol", "tbh" naturally but sparingly.
- AT LEAST ONE message MUST contain a SPECIFIC detail: a number ("4 months"), a name, a date, a count.
- No emojis in messages (they wreck TTS voiceover). Skip them.
- Each message 1-2 short sentences max. If the gut-punch line is longer, that's fine — but never more than ~100 chars.

ARCHETYPES (pick one):
(a) THE AUDIT — "I counted. we haven't actually talked in 4 months."
(b) THE CALLOUT — "be honest. when's the last time you texted me first."
(c) THE NOSTALGIA — "remember when we used to call every sunday? we haven't since january."
(d) THE CONFESSION — "I realized I'm the friend everyone slowly phases out."
(e) THE AUTOPSY — "the last real message in our chat is from october."

The conversation should feel UNRESOLVED. Emotional, not dramatic. Quiet, not yelling."""


def generate_script(hook_context: str = "") -> dict:
    """
    Generate a V22 script dict. Falls back to hardcoded on any failure.

    hook_context is passed to the model as flavor but is OPTIONAL. Hooks are
    now typographic (see config.HOOK_LINES) so the conversation doesn't need
    to thematically match a random video clip anymore — it just needs to be good.
    """
    hook_line, hook_subline, palette = get_random_hook()
    ai_message = get_random_ai_message()

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        log.warning("ANTHROPIC_API_KEY not set — using fallback script")
        return _attach_global(_fallback_script(), hook_line, hook_subline, palette, ai_message)

    user = (
        f"Hook line that will appear BEFORE this conversation: \"{hook_line}\"\n"
        + (f"Subline: \"{hook_subline}\"\n" if hook_subline else "")
        + "Write the conversation that pays off this hook. "
        "Return ONLY the JSON object described in the system prompt."
    )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=900,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user}],
        )
        raw = resp.content[0].text.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        data = json.loads(raw)
        script = _validate_script(data)
    except Exception as e:
        log.warning("Claude script generation failed, using fallback: %s", e)
        script = _fallback_script()

    if not _has_specificity(script["messages"]):
        log.info("Script lacks specificity — retrying once")
        try:
            client = anthropic.Anthropic(api_key=api_key)
            resp = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=900,
                system=SYSTEM_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": user
                        + "\n\nIMPORTANT: include a SPECIFIC number, date, or count in at least one message (e.g. '4 months', 'october', 'our last call was june 14').",
                    }
                ],
            )
            raw = resp.content[0].text.strip().replace("```json", "").replace("```", "").strip()
            retry = _validate_script(json.loads(raw))
            if _has_specificity(retry["messages"]):
                script = retry
        except Exception as e2:
            log.warning("Specificity retry failed: %s", e2)

    return _attach_global(script, hook_line, hook_subline, palette, ai_message)


def _attach_global(
    script: dict, hook_line: str, hook_subline: str, palette: str, ai_message: str
) -> dict:
    script["hook_line"] = hook_line
    script["hook_subline"] = hook_subline
    script["palette"] = palette
    script["ai_message"] = ai_message
    return script


def _validate_script(data: dict) -> dict:
    """Normalize and validate the Claude response. Raises on bad data."""
    if not isinstance(data, dict):
        raise ValueError("script root must be object")

    contact_name = str(data.get("contact_name", "best friend"))[:18] or "best friend"
    person_name = str(data.get("person_name", "Sarah")).split()[0][:14] or "Sarah"
    months_since = int(data.get("months_since", 4))
    months_since = max(2, min(12, months_since))

    msgs = data.get("messages", [])
    if not isinstance(msgs, list) or len(msgs) < MESSAGES_MIN:
        raise ValueError(f"need at least {MESSAGES_MIN} messages, got {len(msgs)}")
    msgs = msgs[:MESSAGES_MAX]

    cleaned = []
    has_emphasis = False
    for m in msgs:
        if not isinstance(m, dict):
            continue
        sender = m.get("sender", "me")
        if sender not in ("me", "other", "system"):
            sender = "me"
        text = str(m.get("text", "")).strip()
        if not text:
            continue
        delay = float(m.get("delay", 1.2))
        delay = max(MIN_MESSAGE_DELAY, min(MAX_MESSAGE_DELAY, delay))
        emphasis = bool(m.get("emphasis", False))
        if emphasis:
            has_emphasis = True
        cleaned.append(
            {"sender": sender, "text": text, "delay": delay, "emphasis": emphasis}
        )

    if len(cleaned) < MESSAGES_MIN:
        raise ValueError("after cleaning, too few messages")

    # Ensure exactly one emphasis — prefer the longest non-system message if none marked
    if not has_emphasis:
        non_sys = [(i, m) for i, m in enumerate(cleaned) if m["sender"] != "system"]
        if non_sys:
            idx, _ = max(non_sys, key=lambda p: len(p[1]["text"]))
            cleaned[idx]["emphasis"] = True

    # Guarantee last message is a system read receipt
    if cleaned[-1]["sender"] != "system":
        hour = random.randint(1, 2)
        minute = random.randint(10, 59)
        cleaned.append(
            {
                "sender": "system",
                "text": f"Read {hour}:{minute:02d} AM",
                "delay": 0.8,
                "emphasis": False,
            }
        )
        cleaned = cleaned[:MESSAGES_MAX]
        if cleaned[-1]["sender"] != "system":
            # If trimming removed the system line, replace last with it
            cleaned[-1] = {
                "sender": "system",
                "text": f"Read {hour}:{minute:02d} AM",
                "delay": 0.8,
                "emphasis": False,
            }

    return {
        "contact_name": contact_name,
        "person_name": person_name,
        "months_since": months_since,
        "messages": cleaned,
    }


def _has_specificity(messages: list[dict]) -> bool:
    for m in messages:
        if m["sender"] == "system":
            continue
        t = m["text"]
        if re.search(r"\d", t):
            return True
        if re.search(
            r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\b",
            t,
            re.IGNORECASE,
        ):
            return True
    return False


# ── Hardcoded fallbacks (used when Claude + fallback file both fail) ─────

_HARDCODED_FALLBACKS: list[dict] = [
    {
        "contact_name": "sarah",
        "person_name": "Sarah",
        "months_since": 4,
        "messages": [
            {"sender": "me",    "text": "I counted. we haven't actually talked in 4 months.", "delay": 1.4, "emphasis": False},
            {"sender": "other", "text": "that's not true", "delay": 1.2, "emphasis": False},
            {"sender": "me",    "text": "scroll up. every text for 16 weeks starts with me.", "delay": 1.8, "emphasis": True},
            {"sender": "other", "text": "...", "delay": 1.6, "emphasis": False},
            {"sender": "me",    "text": "we didn't fight. we just got busy. and it worked.", "delay": 2.0, "emphasis": False},
            {"sender": "system", "text": "Read 1:47 AM", "delay": 0.8, "emphasis": False},
        ],
    },
    {
        "contact_name": "best friend",
        "person_name": "Maya",
        "months_since": 6,
        "messages": [
            {"sender": "me",    "text": "be honest. when was the last time you texted me first.", "delay": 2.0, "emphasis": False},
            {"sender": "other", "text": "I text you all the time what", "delay": 1.2, "emphasis": False},
            {"sender": "me",    "text": "scroll up. every conversation for 6 months starts with me.", "delay": 2.2, "emphasis": True},
            {"sender": "other", "text": "...", "delay": 1.8, "emphasis": False},
            {"sender": "system", "text": "Read 2:04 AM", "delay": 0.8, "emphasis": False},
        ],
    },
    {
        "contact_name": "the group chat",
        "person_name": "Jake",
        "months_since": 5,
        "messages": [
            {"sender": "me",    "text": "the last real message in here is from october.", "delay": 1.6, "emphasis": False},
            {"sender": "other", "text": "damn was it really october", "delay": 1.2, "emphasis": False},
            {"sender": "me",    "text": "we used to send 40 texts a day. now it's crickets.", "delay": 1.8, "emphasis": True},
            {"sender": "me",    "text": "idk when we became acquaintances but we did.", "delay": 2.2, "emphasis": False},
            {"sender": "system", "text": "Read 1:28 AM", "delay": 0.8, "emphasis": False},
        ],
    },
]


def _fallback_script() -> dict:
    """Return a script from fallbacks/scripts.json if present, else hardcoded."""
    fallback_path = os.path.join(FALLBACKS_DIR, "scripts.json")
    try:
        with open(fallback_path) as f:
            data = json.load(f)
        if isinstance(data, list) and data:
            candidate = random.choice(data)
            if isinstance(candidate, dict) and "messages" in candidate:
                return _validate_script(candidate)
    except Exception:
        pass
    return dict(random.choice(_HARDCODED_FALLBACKS))
