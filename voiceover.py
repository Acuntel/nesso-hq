"""
Nesso Content Engine V24 — ElevenLabs TTS Voiceover

V24 contract:
  generate_hook_voiceover(...) → "" ALWAYS. The hook is raw chaos clip + native
    audio, no VO, no overlay text in the first 1s. Function kept for
    backward-compat with pipeline.py's call signature.

  generate_story_voiceover(messages, render_dir, target_duration)
    -> {"path": str, "timings": [...], "actual_delays": [...], "total_duration": float}
       messages spoken in sequence with +0.7s breathing room after each line so
       ElevenLabs trailing tails don't get clipped (was +0.4s in V23).

  generate_demo_voiceover(narration_lines, render_dir, target_duration)
    -> {"path": str, "timings": [...]}
       each demo line placed at its scene-start timestamp.

  generate_close_voiceover(close_line, render_dir, target_duration)
    -> {"path": str, "duration": float}
       NEW IN V24. Reads the close payoff and reports the actual measured
       duration so pipeline.py can flex CLOSE_DURATION to fit.

All gracefully degrade to empty output on any failure.
"""

from __future__ import annotations

import base64
import logging
import os
import subprocess

from config import (
    ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID,
    ELEVENLABS_VOICE_ID_2,
    FFMPEG_THREADS,
    FFMPEG_TIMEOUT,
    VOICEOVER_ENABLED,
)
from verify import get_duration

log = logging.getLogger(__name__)


def _have_tts() -> bool:
    if not VOICEOVER_ENABLED or not ELEVENLABS_API_KEY:
        return False
    try:
        import elevenlabs  # noqa: F401
        return True
    except ImportError:
        return False


def _group_chars_into_words(
    chars: list[str],
    starts: list[float],
    ends: list[float],
) -> list[dict]:
    """
    Turn ElevenLabs' per-character alignment into per-word timings.

    A "word" is a contiguous run of non-whitespace characters. Its start time
    is the first character's start; its end time is the last character's end.
    Whitespace and punctuation characters are attached to the adjacent word.
    """
    words: list[dict] = []
    cur_chars: list[str] = []
    cur_start: float | None = None
    cur_end: float | None = None

    def flush() -> None:
        nonlocal cur_chars, cur_start, cur_end
        if cur_chars and cur_start is not None and cur_end is not None:
            w = "".join(cur_chars).strip()
            if w:
                words.append(
                    {"word": w, "start_sec": float(cur_start), "end_sec": float(cur_end)}
                )
        cur_chars = []
        cur_start = None
        cur_end = None

    for c, s, e in zip(chars, starts, ends):
        if c.isspace():
            flush()
            continue
        if cur_start is None:
            cur_start = s
        cur_chars.append(c)
        cur_end = e
    flush()
    return words


def _tts_clip(
    text: str,
    voice_id: str,
    output_path: str,
    expressive: bool = True,
) -> tuple[bool, list[dict]]:
    """
    Generate one ElevenLabs TTS clip WITH word-level timings.

    Returns (ok, words) where words = [{word, start_sec, end_sec}, ...] with
    times relative to the start of this clip. Falls back to the non-timestamped
    endpoint if the timestamped one fails, in which case words = [].
    """
    try:
        import httpx
        from elevenlabs import ElevenLabs

        # Explicit httpx client with a per-request timeout. Without this
        # ElevenLabs' default has no upper bound and a stalled TLS or slow
        # voice generation can hang the whole render. 60s is plenty for
        # a sub-200-char message.
        client = ElevenLabs(
            api_key=ELEVENLABS_API_KEY,
            httpx_client=httpx.Client(
                timeout=httpx.Timeout(connect=10.0, read=60.0, write=20.0, pool=10.0)
            ),
        )
        model_id = "eleven_multilingual_v2" if expressive else "eleven_turbo_v2_5"

        # First try with timestamps (per-character alignment)
        try:
            resp = client.text_to_speech.convert_with_timestamps(
                voice_id=voice_id,
                text=text,
                model_id=model_id,
                output_format="mp3_44100_128",
            )
            audio_bytes = base64.b64decode(resp.audio_base_64)
            with open(output_path, "wb") as f:
                f.write(audio_bytes)
            words: list[dict] = []
            alignment = getattr(resp, "normalized_alignment", None) or getattr(
                resp, "alignment", None
            )
            if alignment is not None:
                chars = list(alignment.characters)
                starts = list(alignment.character_start_times_seconds)
                ends = list(alignment.character_end_times_seconds)
                if chars and len(chars) == len(starts) == len(ends):
                    words = _group_chars_into_words(chars, starts, ends)
            if get_duration(output_path) <= 0.1:
                return (False, [])
            return (True, words)
        except Exception as inner_e:
            log.info(
                "convert_with_timestamps failed for '%s' (%s) — falling back to plain convert",
                text[:30],
                inner_e,
            )

        # Fallback — plain audio, no word timings
        audio_gen = client.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id=model_id,
            output_format="mp3_44100_128",
        )
        with open(output_path, "wb") as f:
            for chunk in audio_gen:
                f.write(chunk)
        return (get_duration(output_path) > 0.1, [])
    except Exception as e:
        log.warning("TTS failed for '%s': %s", text[:40], e)
        return (False, [])


def _silence(duration: float, output_path: str) -> str:
    subprocess.run(
        [
            "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
            "-t", f"{max(0.05, duration):.3f}",
            "-c:a", "libmp3lame", "-b:a", "96k",
            output_path,
        ],
        capture_output=True, timeout=FFMPEG_TIMEOUT,
    )
    return output_path


def _pad_to(clip_path: str, target_dur: float, output_path: str) -> str:
    """Pad a clip with trailing silence to reach target_dur."""
    cur = get_duration(clip_path)
    if cur >= target_dur - 0.02:
        subprocess.run(
            ["cp", clip_path, output_path], capture_output=True, timeout=30
        )
        return output_path
    subprocess.run(
        [
            "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
            "-i", clip_path,
            "-af", f"apad=whole_dur={target_dur:.3f}",
            "-c:a", "libmp3lame", "-b:a", "96k",
            output_path,
        ],
        capture_output=True, timeout=FFMPEG_TIMEOUT,
    )
    return output_path


def _concat_audio(parts: list[str], output_path: str, target_duration: float | None = None) -> str:
    """Concat a list of mp3 files into one, optionally trim to duration."""
    temp_dir = os.path.dirname(output_path)
    concat_file = os.path.join(temp_dir, "vo_concat.txt")
    with open(concat_file, "w") as f:
        for p in parts:
            safe = p.replace("'", "'\\''")
            f.write(f"file '{safe}'\n")
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "concat", "-safe", "0", "-i", concat_file,
        "-c:a", "libmp3lame", "-b:a", "128k",
    ]
    if target_duration is not None:
        cmd.extend(["-t", f"{target_duration:.3f}"])
    cmd.append(output_path)
    subprocess.run(cmd, capture_output=True, timeout=FFMPEG_TIMEOUT)
    try:
        os.remove(concat_file)
    except OSError:
        pass
    return output_path


# ── Hook voiceover ──────────────────────────────────────────────────────────

def generate_hook_voiceover(
    hook_line: str,
    render_dir: str,
    target_duration: float,
    intro_pad: float = 0.25,
) -> str:
    """
    V24: hook is RAW chaos clip + native audio. No VO. No overlay text in the
    first 1s. We keep the signature so pipeline.py doesn't have to change its
    call site, but the function is now a no-op that always returns "".

    Hook line still drives kinetic typography in HookText.tsx (starting at 1s).
    """
    log.info("hook VO suppressed (V24: raw chaos clip carries the moment)")
    return ""


# ── Story voiceover ─────────────────────────────────────────────────────────

def generate_story_voiceover(
    messages: list[dict],
    render_dir: str,
    target_duration: float,
) -> dict:
    """
    Build a story VO timeline matching the IMessageStory bubble schedule.

    For each message the IMessageStory composition does:
      - ~0.35s typing indicator BEFORE "other" messages (skipped for first msg)
      - bubble appears, then waits `delay` seconds before the next

    So the VO for message i starts at the bubble-appear moment and must fit
    within ~0.5s LESS than the message's delay (leaving room for the bubble to
    settle). System messages are silent.

    Returns {"path": str, "timings": [...]} where timings are caption lines
    with word-level timings, relative to the story segment's local 0.
    Empty path on failure; empty timings if the timestamp API isn't available.
    """
    if not _have_tts():
        log.info("TTS unavailable — story will be silent")
        return {"path": "", "timings": []}

    output_path = os.path.join(render_dir, "story_vo.mp3")
    intro_pad = 0.1
    typing_pad_per_other = 0.35

    parts: list[str] = []
    # Cursor tracks where the NEXT part will start (in seconds) relative to the
    # segment's local 0. Used to offset TTS word timings into the segment frame.
    cursor: float = 0.0
    caption_lines: list[dict] = []

    # Intro silence so VO doesn't talk over the first bubble's spring-in
    silence0 = os.path.join(render_dir, "story_silence_intro.mp3")
    parts.append(_silence(intro_pad, silence0))
    cursor += intro_pad

    # Per-message actual on-screen durations (we may extend them if VO needs
    # more room). Indexed the same as `messages`. Passed back to pipeline so
    # the IMessageStory composition can be re-timed to stay in sync.
    actual_delays: list[float] = []

    for i, msg in enumerate(messages):
        delay = float(msg.get("delay", 1.2))
        sender = msg["sender"]
        text = msg["text"]

        # Typing pad before incoming messages (except the first)
        if sender == "other" and i > 0:
            typing_silence = os.path.join(render_dir, f"story_typing_{i}.mp3")
            parts.append(_silence(typing_pad_per_other, typing_silence))
            cursor += typing_pad_per_other

        if sender == "system" or not text.strip() or text.strip() == "...":
            slot_dur = max(0.3, delay - 0.1)
            gap = os.path.join(render_dir, f"story_gap_{i}.mp3")
            parts.append(_silence(slot_dur, gap))
            cursor += slot_dur
            actual_delays.append(slot_dur)
            continue

        voice_id = ELEVENLABS_VOICE_ID if sender == "me" else ELEVENLABS_VOICE_ID_2

        raw_path = os.path.join(render_dir, f"story_vo_{i:02d}.mp3")
        ok, words = _tts_clip(text, voice_id, raw_path, expressive=True)
        if not ok:
            slot_dur = max(0.3, delay - 0.1)
            gap = os.path.join(render_dir, f"story_gap_fail_{i}.mp3")
            parts.append(_silence(slot_dur, gap))
            cursor += slot_dur
            actual_delays.append(slot_dur)
            continue

        clip_dur = get_duration(raw_path)
        clip_offset = cursor

        # NEVER trim a VO mid-word. Instead, extend the on-screen slot so the
        # viewer actually hears the full message. V24: bumped breathing room
        # to 0.7s (was 0.4s) — ElevenLabs trailing tails were getting clipped
        # on the gut-punch line. The bubble can stay on a beat longer; nobody
        # complains about a punchline holding for an extra third of a second.
        slot_dur = max(0.3, delay - 0.1)
        if clip_dur + 0.2 > slot_dur:
            slot_dur = clip_dur + 0.7

        # Pad the raw clip with trailing silence so its playback matches slot_dur
        padded = os.path.join(render_dir, f"story_vo_{i:02d}_p.mp3")
        _pad_to(raw_path, slot_dur, padded)
        parts.append(padded)
        actual_clip_dur = slot_dur
        cursor += actual_clip_dur
        actual_delays.append(actual_clip_dur)

        # Offset each word's time by where the clip starts in the segment,
        # then record one caption line for the whole message.
        offset_words = [
            {
                "word": w["word"],
                "startSec": clip_offset + float(w["start_sec"]),
                "endSec": clip_offset + float(w["end_sec"]),
            }
            for w in words
        ]
        if offset_words:
            line_start = offset_words[0]["startSec"]
            line_end = offset_words[-1]["endSec"]
        else:
            # No alignment came back — fall back to uniform word spacing across
            # the clip so we still get something reasonable.
            spoken_dur = min(clip_dur, actual_clip_dur)
            ws = text.split()
            per = spoken_dur / max(1, len(ws))
            offset_words = [
                {
                    "word": w,
                    "startSec": clip_offset + k * per,
                    "endSec": clip_offset + (k + 1) * per,
                }
                for k, w in enumerate(ws)
            ]
            line_start = clip_offset
            line_end = clip_offset + spoken_dur

        caption_lines.append(
            {
                "text": text,
                "startSec": float(line_start),
                "endSec": float(line_end),
                "words": offset_words,
            }
        )

    _concat_audio(parts, output_path, target_duration=target_duration)

    # Cleanup per-clip files
    for p in parts:
        if p != output_path:
            try:
                os.remove(p)
            except OSError:
                pass

    actual = get_duration(output_path)
    log.info(
        "story VO: %.1fs (target %.1fs) — %d caption lines",
        actual,
        target_duration,
        len(caption_lines),
    )
    return {
        "path": output_path if actual > 0.5 else "",
        "timings": caption_lines if actual > 0.5 else [],
        "actual_delays": actual_delays,
        "total_duration": actual,
    }


# ── Demo voiceover ─────────────────────────────────────────────────────────

def generate_demo_voiceover(
    narration_lines: list[tuple[str, float]],
    render_dir: str,
    target_duration: float,
) -> dict:
    """
    Demo VO: each narration_lines entry is (text, scene_start_seconds).
    Returns {"path": str, "timings": [...]} with word-level caption timings
    relative to the demo segment's local 0. Empty path on failure.
    """
    if not _have_tts() or not narration_lines:
        log.info("TTS unavailable or no narration — demo will be silent")
        return {"path": "", "timings": []}

    output_path = os.path.join(render_dir, "demo_vo.mp3")

    # Generate every TTS clip with word alignment
    clip_records: list[dict] = []
    for i, (text, scene_start) in enumerate(narration_lines):
        raw_path = os.path.join(render_dir, f"demo_vo_{i:02d}.mp3")
        ok, words = _tts_clip(text, ELEVENLABS_VOICE_ID, raw_path, expressive=True)
        if ok:
            clip_records.append(
                {
                    "path": raw_path,
                    "text": text,
                    "scene_start": scene_start,
                    "duration": get_duration(raw_path),
                    "words": words,
                }
            )

    if not clip_records:
        return {"path": "", "timings": []}

    # Build timeline: silence[0..first_start] + clip0 + silence[...] + clip1 + ...
    parts: list[str] = []
    caption_lines: list[dict] = []
    cursor = 0.0
    for i, rec in enumerate(clip_records):
        start = rec["scene_start"]
        dur = rec["duration"]
        gap = start - cursor
        if gap > 0.02:
            silence_path = os.path.join(render_dir, f"demo_gap_{i}.mp3")
            parts.append(_silence(gap, silence_path))
            cursor += gap

        next_start = (
            clip_records[i + 1]["scene_start"]
            if i + 1 < len(clip_records)
            else target_duration
        )
        max_dur = max(0.3, next_start - start - 0.15)

        clip_offset = cursor  # when this clip begins in the demo timeline
        if dur > max_dur:
            trim_path = os.path.join(render_dir, f"demo_vo_{i:02d}_t.mp3")
            subprocess.run(
                [
                    "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
                    "-i", rec["path"],
                    "-t", f"{max_dur:.3f}",
                    "-c:a", "libmp3lame", "-b:a", "128k",
                    trim_path,
                ],
                capture_output=True, timeout=FFMPEG_TIMEOUT,
            )
            parts.append(trim_path)
            actual_dur = max_dur
            # Drop words past the trim
            words = [w for w in rec["words"] if w["start_sec"] < max_dur - 0.02]
            for w in words:
                w["end_sec"] = min(w["end_sec"], max_dur)
        else:
            parts.append(rec["path"])
            actual_dur = dur
            words = rec["words"]

        cursor += actual_dur

        # Offset words into the segment timeline and append a caption line
        offset_words = [
            {
                "word": w["word"],
                "startSec": clip_offset + float(w["start_sec"]),
                "endSec": clip_offset + float(w["end_sec"]),
            }
            for w in words
        ]
        if offset_words:
            line_start = offset_words[0]["startSec"]
            line_end = offset_words[-1]["endSec"]
        else:
            # Fallback to uniform spacing if ElevenLabs didn't return alignment
            spoken_dur = min(dur, actual_dur)
            ws = rec["text"].split()
            per = spoken_dur / max(1, len(ws))
            offset_words = [
                {
                    "word": w,
                    "startSec": clip_offset + k * per,
                    "endSec": clip_offset + (k + 1) * per,
                }
                for k, w in enumerate(ws)
            ]
            line_start = clip_offset
            line_end = clip_offset + spoken_dur

        caption_lines.append(
            {
                "text": rec["text"],
                "startSec": float(line_start),
                "endSec": float(line_end),
                "words": offset_words,
            }
        )

    if cursor < target_duration:
        tail = os.path.join(render_dir, "demo_tail.mp3")
        parts.append(_silence(target_duration - cursor, tail))

    _concat_audio(parts, output_path, target_duration=target_duration)

    for p in parts:
        if p != output_path:
            try:
                os.remove(p)
            except OSError:
                pass

    actual = get_duration(output_path)
    log.info(
        "demo VO: %.1fs (target %.1fs) — %d caption lines",
        actual,
        target_duration,
        len(caption_lines),
    )
    return {
        "path": output_path if actual > 0.5 else "",
        "timings": caption_lines if actual > 0.5 else [],
    }


# ── Close voiceover (V24) ──────────────────────────────────────────────────

def generate_close_voiceover(
    close_line: str,
    render_dir: str,
    intro_pad: float = 0.2,
    tail_pad: float = 0.5,
) -> dict:
    """
    V24: render the close payoff ("nesso. it's free. on the app store.") and
    return its measured duration so pipeline.py can flex CLOSE_DURATION to fit.

    Returns {"path": str, "duration": float}. Empty path on failure — pipeline
    falls back to a silent close at CLOSE_DURATION_MIN.
    """
    if not _have_tts() or not close_line.strip():
        return {"path": "", "duration": 0.0}

    output_path = os.path.join(render_dir, "close_vo.mp3")
    raw = os.path.join(render_dir, "close_vo_raw.mp3")

    ok, _words = _tts_clip(close_line, ELEVENLABS_VOICE_ID, raw, expressive=True)
    if not ok:
        return {"path": "", "duration": 0.0}

    raw_dur = get_duration(raw)
    if raw_dur <= 0.2:
        try:
            os.remove(raw)
        except OSError:
            pass
        return {"path": "", "duration": 0.0}

    # Build: [intro silence] + [VO] + [tail silence], no atempo speed-up.
    # We trust pipeline to extend CLOSE_DURATION instead of cramping the VO.
    parts: list[str] = []
    if intro_pad > 0:
        intro = os.path.join(render_dir, "close_vo_intro.mp3")
        parts.append(_silence(intro_pad, intro))
    parts.append(raw)
    if tail_pad > 0:
        tail = os.path.join(render_dir, "close_vo_tail.mp3")
        parts.append(_silence(tail_pad, tail))

    _concat_audio(parts, output_path)

    for p in parts:
        if p != output_path:
            try:
                os.remove(p)
            except OSError:
                pass

    actual = get_duration(output_path)
    log.info("close VO: %.2fs (raw VO=%.2fs)", actual, raw_dur)
    return {
        "path": output_path if actual > 0.3 else "",
        "duration": actual,
    }
