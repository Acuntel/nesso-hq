"""
Nesso Content Engine V22 — Render Pipeline

Flow:
  1. Generate script (hook line, messages, person_name, months_since, ai_message)
  2. Render HookText segment via Remotion  (2.5s)
  3. Render IMessageStory segment via Remotion  (9s, duration auto-fits messages)
  4. Render AppDemo segment via Remotion  (8s)
  5. Render LogoClose segment via Remotion  (2.5s)
  6. Generate ElevenLabs VO for messages + demo narration (optional)
  7. Download / synthesize background music
  8. Concat 4 segments, mix 3 audio layers, final encode
  9. Deliver via Telegram
"""

from __future__ import annotations

import logging
import math
import os
import shutil
import subprocess
import uuid

from config import (
    CLOSE_DURATION,
    DEMO_DURATION,
    DEMO_NARRATION_LINES,
    FFMPEG_PRESET,
    FFMPEG_THREADS,
    FFMPEG_TIMEOUT,
    FPS,
    HEIGHT,
    HOOK_DURATION,
    NESSO_LOGO_PATH,
    PSYCH_SFX_PATH,
    SFX_BUBBLE_POP,
    SFX_CASH_DING,
    SFX_IMPACT_HIT,
    SFX_LOGO_DING,
    SFX_NOTIFICATION_DING,
    SFX_RISER_SHORT,
    SFX_SEND_SWOOSH,
    SFX_TYPEWRITER_TICK,
    SFX_TYPING_TICK,
    SFX_UI_TAP,
    SFX_VOLUMES,
    SFX_WHOOSH_SHORT,
    STORY_DURATION,
    TEMP_DIR,
    WIDTH,
    generate_ig_caption,
    generate_ig_pin_comment,
    generate_tiktok_caption,
)
from analytics import log_render
from hooks import fetch_background_clip
from morph import morph_and_concat
from music import download_background_music, download_psych_sfx
from remotion_client import RemotionError, delete_asset, render_composition, upload_asset
from scripts import generate_hook_variants, generate_script
from verify import get_duration, verify_clip
from voiceover import (
    generate_demo_voiceover,
    generate_hook_voiceover,
    generate_story_voiceover,
)

log = logging.getLogger(__name__)


def _logo_file_uri() -> str:
    """
    The logo lives at remotion-reveal/public/nesso_logo.png and is referenced
    via Remotion's staticFile() inside compositions. We pass an empty string so
    the composition falls back to staticFile(), which is the canonical way.
    """
    return ""


def _story_duration_seconds(messages: list[dict]) -> float:
    """
    Compute the story segment duration from the messages.
    Accounts for: 0.1s intro pad + sum(delays) + ~0.4s typing pads + 0.4s settle.
    """
    intro = 0.1
    settle = 0.4
    typing_pad = 0.0
    for i, m in enumerate(messages):
        if m["sender"] == "other" and i > 0:
            typing_pad += 0.35
    total_delay = sum(float(m.get("delay", 1.2)) for m in messages)
    return round(intro + typing_pad + total_delay + settle, 2)


def ensure_psych_sfx() -> str:
    if os.path.exists(PSYCH_SFX_PATH):
        return PSYCH_SFX_PATH
    log.info("PSYCH sfx missing — downloading")
    result = download_psych_sfx(PSYCH_SFX_PATH)
    return result or ""


def _sfx(path: str, at: float, volume_key: str) -> dict:
    return {
        "path": path,
        "at": at,
        "volume": SFX_VOLUMES.get(volume_key, 0.4),
    }


def _build_sfx_placements(
    messages: list[dict],
    hook_dur: float,
    story_dur: float,
    demo_dur: float,
    close_dur: float,
    ai_message: str,
) -> list[dict]:
    """
    Build the frame-accurate SFX timeline.

    Every visible beat gets a sound effect:
      HOOK (0 - hook_dur):
        - none — PSYCH sfx covers the transition, handled by morph.py

      STORY (hook_dur - hook_dur+story_dur):
        - bubble_pop on each message appear (offset by 0.1s intro + typing pads)
        - typing_tick on each typing indicator before "other" messages

      DEMO (story_end - story_end+demo_dur):
        Scene boundaries come from AppDemo.tsx — beat-matched to 80 BPM:
        HOME:      0.0  - 1.500
        TAP_CARD:  1.50 - 2.250  → ui_tap at 1.75
        SLIDE:     2.25 - 3.000  → whoosh at 2.25
        PERSON:    3.00 - 4.500
        TAP_REACH: 4.50 - 4.875  → ui_tap at 4.50
        SHEET_UP:  4.875 - 5.250 → whoosh at 4.875
        AI_TYPING: 5.25 - 6.750  → ui_tap at 5.25, typewriter ticks across window
        SEND:      6.75 - 8.000  → ui_tap at 6.90, send_swoosh at 7.05

      CLOSE (last 2.5s):
        - logo_ding at close_start + 0.1
    """
    placements: list[dict] = []

    story_start = hook_dur
    demo_start = hook_dur + story_dur
    close_start = hook_dur + story_dur + demo_dur

    # ── STORY bubble + typing sfx ─────────────────────────────────────────
    # Matches the timeline built inside IMessageStory.tsx
    TYPING_DUR = 0.35
    INTRO_PAD = 0.1

    cursor = story_start + INTRO_PAD
    first_other_seen = False
    for i, msg in enumerate(messages):
        is_other = msg["sender"] == "other"
        is_system = msg["sender"] == "system"
        if is_other and i > 0:
            # Typing indicator tick (soft) at start of typing bubble
            placements.append(_sfx(SFX_TYPING_TICK, cursor + 0.05, "typing_tick"))
            placements.append(_sfx(SFX_TYPING_TICK, cursor + 0.18, "typing_tick"))
            cursor += TYPING_DUR
        # Bubble pop when the bubble springs in (system messages skip the pop)
        if not is_system:
            placements.append(_sfx(SFX_BUBBLE_POP, cursor, "bubble_pop"))
        # First incoming message gets an iMessage notification ding —
        # "NEW TEXT" primal hit for the viewer
        if is_other and not first_other_seen and not is_system:
            placements.append(
                _sfx(SFX_NOTIFICATION_DING, cursor + 0.02, "notification_ding")
            )
            first_other_seen = True
        # IMPACT hit on the gut-punch emphasis line — punctuates the beat
        if msg.get("emphasis") and not is_system:
            placements.append(_sfx(SFX_IMPACT_HIT, cursor + 0.08, "impact_hit"))
        cursor += float(msg.get("delay", 1.2))

    # Riser going into the demo — builds anticipation in the last 0.5s of story
    riser_start = story_start + story_dur - 0.5
    placements.append(_sfx(SFX_RISER_SHORT, riser_start, "riser_short"))

    # ── DEMO: scene-boundary sfx (absolute timestamps in final video) ─────
    # Beat-matched to 80 BPM — every hit lands on a beat/half-beat boundary.
    # Tap on Sarah's card — mid-beat of the TAP_CARD scene (1.50 → 2.25)
    placements.append(_sfx(SFX_UI_TAP, demo_start + 1.75, "ui_tap"))
    # Slide whoosh when screen pushes left → right
    placements.append(_sfx(SFX_WHOOSH_SHORT, demo_start + 2.25, "whoosh_short"))
    # Tap on Reach out button
    placements.append(_sfx(SFX_UI_TAP, demo_start + 4.50, "ui_tap"))
    # Sheet slide-up whoosh
    placements.append(_sfx(SFX_WHOOSH_SHORT, demo_start + 4.875, "whoosh_short"))
    # Tap on "Write with AI"
    placements.append(_sfx(SFX_UI_TAP, demo_start + 5.25, "ui_tap"))

    # Typewriter ticks during AI typing (5.25 → 6.75s) — one every ~0.2s
    # Total chars to reveal: len(ai_message). Reveal window: 1.05s (5.55 → 6.60).
    ai_start = demo_start + 5.55
    ai_end = demo_start + 6.60
    ai_window = ai_end - ai_start
    n_ticks = min(14, max(6, int(len(ai_message or "") / 6)))
    for k in range(n_ticks):
        t = ai_start + (k / n_ticks) * ai_window
        placements.append(_sfx(SFX_TYPEWRITER_TICK, t, "typewriter_tick"))

    # Tap on send Text button + send swoosh
    placements.append(_sfx(SFX_UI_TAP, demo_start + 6.90, "ui_tap"))
    placements.append(_sfx(SFX_SEND_SWOOSH, demo_start + 7.05, "send_swoosh"))
    # Celebration bubble pop when message lands
    placements.append(_sfx(SFX_BUBBLE_POP, demo_start + 7.45, "bubble_pop"))

    # ── CLOSE: logo ding + cash chime ────────────────────────────────────
    placements.append(_sfx(SFX_LOGO_DING, close_start + 0.12, "logo_ding"))
    # Cash-ding lands on "it's free" — payoff/value signal
    placements.append(_sfx(SFX_CASH_DING, close_start + 0.85, "cash_ding"))

    # Filter out any that fall past the total runtime
    total = hook_dur + story_dur + demo_dur + close_dur
    placements = [p for p in placements if p["at"] < total - 0.05]

    log.info("sfx placements: %d hits across %.1fs", len(placements), total)
    return placements


def render_single_video(
    theme: str | None = None,
    exclude_queries: list[str] | None = None,
) -> dict:
    """Render one V22 video end-to-end."""
    render_id = uuid.uuid4().hex[:8]
    render_dir = os.path.join(TEMP_DIR, f"render_{render_id}")
    os.makedirs(render_dir, exist_ok=True)

    result: dict = {
        "output_path": "",
        "tiktok_caption": "",
        "ig_caption": "",
        "ig_pin_comment": "",
        "hook_query": "",
        "hook_description": "",
        "duration": 0,
        "error": None,
    }

    try:
        # ── 1. Script ─────────────────────────────────────────────────────
        script = generate_script()
        messages = script["messages"]
        result["hook_description"] = script["hook_line"]
        result["hook_query"] = script["hook_line"][:60]
        log.info(
            "[%s] script: contact=%r person=%r months=%d msgs=%d palette=%s",
            render_id,
            script["contact_name"],
            script["person_name"],
            script["months_since"],
            len(messages),
            script["palette"],
        )

        # ── 2. Hook segment (Reddit clip background + kinetic text) ───────
        hook_clip_info = fetch_background_clip(render_dir, target_seconds=HOOK_DURATION)
        hook_bg_url = ""
        hook_remote_name = ""
        if hook_clip_info:
            clip_path, clip_dur, clip_desc = hook_clip_info
            result["hook_description"] = f"{script['hook_line']} | {clip_desc}"
            hook_remote_name = f"hook_{render_id}.mp4"
            try:
                hook_bg_url = upload_asset(clip_path, remote_name=hook_remote_name)
            except Exception as e:
                log.warning("[%s] hook clip upload failed: %s", render_id, e)
                hook_bg_url = ""
            try:
                os.remove(clip_path)
            except OSError:
                pass

        hook_video = os.path.join(render_dir, "hook.mp4")
        render_composition(
            "HookText",
            hook_video,
            props={
                "line": script["hook_line"],
                "subline": script["hook_subline"],
                "palette": script["palette"],
                "backgroundVideoUrl": hook_bg_url,
            },
            duration_seconds=HOOK_DURATION,
            fps=FPS,
        )

        # Clean up the uploaded asset once the hook has been rendered
        if hook_remote_name:
            delete_asset(hook_remote_name)

        if not verify_clip(hook_video):
            raise RuntimeError("hook video failed verification")

        # ── 3. Story duration (needed by VO + story render) ───────────────
        story_dur = _story_duration_seconds(messages)
        story_dur = max(STORY_DURATION - 1.0, min(STORY_DURATION + 2.0, story_dur))

        # ── 4. Voiceover — generated BEFORE story/demo so we have caption
        # timings to pass into those compositions. ───────────────────────
        hook_vo_path = generate_hook_voiceover(
            script["hook_line"], render_dir, target_duration=HOOK_DURATION
        )
        story_vo_result = generate_story_voiceover(
            messages, render_dir, target_duration=story_dur
        )
        story_vo_path = story_vo_result.get("path", "")
        story_captions = story_vo_result.get("timings", [])

        demo_vo_result = generate_demo_voiceover(
            DEMO_NARRATION_LINES, render_dir, target_duration=DEMO_DURATION
        )
        demo_vo_path = demo_vo_result.get("path", "")
        demo_captions = demo_vo_result.get("timings", [])

        # ── 5. Story segment (captions burned in) ─────────────────────────
        story_video = os.path.join(render_dir, "story.mp4")
        render_composition(
            "IMessageStory",
            story_video,
            props={
                "contactName": script["contact_name"],
                "messages": [
                    {
                        "sender": m["sender"],
                        "text": m["text"],
                        "delay": m["delay"],
                        "emphasis": m.get("emphasis", False),
                    }
                    for m in messages
                ],
                "captions": story_captions,
            },
            duration_seconds=story_dur,
            fps=FPS,
        )
        if not verify_clip(story_video):
            raise RuntimeError("story video failed verification")

        # ── 6. Demo segment (captions burned in) ──────────────────────────
        demo_video = os.path.join(render_dir, "demo.mp4")
        render_composition(
            "AppDemo",
            demo_video,
            props={
                "personName": script["person_name"],
                "monthsSinceText": script["months_since"],
                "aiMessage": script["ai_message"],
                "logoUrl": _logo_file_uri(),
                "captions": demo_captions,
            },
            duration_seconds=DEMO_DURATION,
            fps=FPS,
        )
        if not verify_clip(demo_video):
            raise RuntimeError("demo video failed verification")

        # ── 7. Close segment ──────────────────────────────────────────────
        close_video = os.path.join(render_dir, "close.mp4")
        render_composition(
            "LogoClose",
            close_video,
            props={
                "logoUrl": _logo_file_uri(),
                "payoff": "it's free",
                "handle": "nesso.ai",
                "appStoreHint": "on the App Store",
                "backdropUrl": "",
            },
            duration_seconds=CLOSE_DURATION,
            fps=FPS,
        )
        if not verify_clip(close_video):
            raise RuntimeError("close video failed verification")

        # ── 7. Music + psych ──────────────────────────────────────────────
        music_path = os.path.join(render_dir, "music.mp3")
        download_background_music(music_path, exclude_queries=exclude_queries)
        if not os.path.exists(music_path):
            music_path = ""
            log.warning("[%s] no background music", render_id)

        psych_path = ensure_psych_sfx()

        # ── 7b. SFX placements — timed to composition scene boundaries ────
        sfx_placements = _build_sfx_placements(
            messages=messages,
            hook_dur=HOOK_DURATION,
            story_dur=story_dur,
            demo_dur=DEMO_DURATION,
            close_dur=CLOSE_DURATION,
            ai_message=script["ai_message"],
        )

        # ── 8. Concat + audio mix ─────────────────────────────────────────
        concat_video = os.path.join(render_dir, "concat.mp4")
        morph_and_concat(
            hook_video=hook_video,
            story_video=story_video,
            demo_video=demo_video,
            close_video=close_video,
            hook_dur=HOOK_DURATION,
            story_dur=story_dur,
            demo_dur=DEMO_DURATION,
            close_dur=CLOSE_DURATION,
            story_vo_path=story_vo_path,
            demo_vo_path=demo_vo_path,
            hook_vo_path=hook_vo_path,
            music_path=music_path,
            psych_sfx_path=psych_path,
            sfx_placements=sfx_placements,
            output_path=concat_video,
        )

        # Clean intermediates
        for p in [hook_video, story_video, demo_video, close_video,
                  hook_vo_path, story_vo_path, demo_vo_path, music_path]:
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass

        # ── 9. Final encode ───────────────────────────────────────────────
        output_path = os.path.join(render_dir, f"nesso_{render_id}.mp4")
        cmd = [
            "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
            "-i", concat_video,
            "-c:v", "libx264", "-c:a", "aac",
            "-b:a", "128k",
            "-vf",
            f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease,"
            f"pad={WIDTH}:{HEIGHT}:-1:-1:color=black",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-preset", FFMPEG_PRESET,
            output_path,
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
        if proc.returncode != 0:
            raise RuntimeError(f"final encode failed: {proc.stderr[-500:]}")

        try:
            os.remove(concat_video)
        except OSError:
            pass

        if not verify_clip(output_path):
            raise RuntimeError("final video failed verification")

        result["output_path"] = output_path
        result["duration"] = get_duration(output_path)
        result["tiktok_caption"] = generate_tiktok_caption()
        result["ig_caption"] = generate_ig_caption()
        result["ig_pin_comment"] = generate_ig_pin_comment()

        log.info(
            "[%s] video complete: %s (%.1fs, %.1fMB)",
            render_id,
            output_path,
            result["duration"],
            os.path.getsize(output_path) / (1024 * 1024),
        )

    except RemotionError as e:
        result["error"] = f"Remotion: {e}"
        log.error("[%s] remotion failure: %s", render_id, e, exc_info=True)
    except Exception as e:
        result["error"] = str(e)
        log.error("[%s] pipeline failed: %s", render_id, e, exc_info=True)

    # analytics
    try:
        log_render(
            hook_query=result.get("hook_query", ""),
            hook_category="",
            hook_description=result.get("hook_description", ""),
            script_length=len(locals().get("messages", [])),
            duration=result.get("duration", 0),
            success=result["error"] is None,
            error=result.get("error", "") or "",
        )
    except Exception:
        pass

    return result


def render_batch(count: int = 1) -> list[dict]:
    """Render ``count`` videos sequentially. Logs batch outcome."""
    results: list[dict] = []
    used_hooks: list[str] = []
    for i in range(count):
        log.info("=== rendering %d/%d ===", i + 1, count)
        r = render_single_video(exclude_queries=used_hooks)
        if r.get("hook_query"):
            used_hooks.append(r["hook_query"])
        results.append(r)
    successful = sum(1 for r in results if r["error"] is None)
    log.info("batch done: %d/%d ok", successful, count)
    return results


def render_variants(n: int = 3) -> list[dict]:
    """
    Render ``n`` VARIANTS of the same video.

    Story + demo + close are identical across variants — rendered ONCE and
    reused. Only the HOOK differs per variant: different hook line, different
    Reddit background clip, different hook VO. The final concat + encode still
    runs N times because the hook changes.

    Returns a list of ``n`` result dicts using the same schema as
    ``render_single_video``. Failed variants still appear in the list with
    ``error`` populated.
    """
    if n < 1:
        raise ValueError("n must be >= 1")

    render_id = uuid.uuid4().hex[:8]
    render_dir = os.path.join(TEMP_DIR, f"variants_{render_id}")
    os.makedirs(render_dir, exist_ok=True)

    # Shared segment outputs (reused across all variants)
    story_video = os.path.join(render_dir, "story.mp4")
    demo_video = os.path.join(render_dir, "demo.mp4")
    close_video = os.path.join(render_dir, "close.mp4")
    story_vo_path = ""
    demo_vo_path = ""
    music_path = ""

    results: list[dict] = []

    try:
        # ── 1. Script — ONE base, N hook variants ─────────────────────────
        base_script = generate_script()
        variants = generate_hook_variants(n=n, seed_script=base_script)
        messages = base_script["messages"]
        log.info(
            "[%s] variants=%d contact=%r person=%r months=%d msgs=%d",
            render_id,
            len(variants),
            base_script["contact_name"],
            base_script["person_name"],
            base_script["months_since"],
            len(messages),
        )
        for i, v in enumerate(variants):
            log.info(
                "[%s]   variant %d/%d: hook=%r palette=%s",
                render_id, i + 1, n, v["hook_line"], v["palette"],
            )

        # ── 2. Shared story duration (used by story VO + story render) ────
        story_dur = _story_duration_seconds(messages)
        story_dur = max(STORY_DURATION - 1.0, min(STORY_DURATION + 2.0, story_dur))

        # ── 3. Shared VOs — generated BEFORE story/demo so we can pass
        # caption timings to their compositions. ONCE, reused. ────────────
        story_vo_result = generate_story_voiceover(
            messages, render_dir, target_duration=story_dur
        )
        story_vo_path = story_vo_result.get("path", "")
        story_captions = story_vo_result.get("timings", [])

        demo_vo_result = generate_demo_voiceover(
            DEMO_NARRATION_LINES, render_dir, target_duration=DEMO_DURATION
        )
        demo_vo_path = demo_vo_result.get("path", "")
        demo_captions = demo_vo_result.get("timings", [])

        # ── 4. Render STORY segment ONCE (with captions) ──────────────────
        render_composition(
            "IMessageStory",
            story_video,
            props={
                "contactName": base_script["contact_name"],
                "messages": [
                    {
                        "sender": m["sender"],
                        "text": m["text"],
                        "delay": m["delay"],
                        "emphasis": m.get("emphasis", False),
                    }
                    for m in messages
                ],
                "captions": story_captions,
            },
            duration_seconds=story_dur,
            fps=FPS,
        )
        if not verify_clip(story_video):
            raise RuntimeError("story video failed verification")

        # ── 5. Render DEMO segment ONCE (with captions) ───────────────────
        render_composition(
            "AppDemo",
            demo_video,
            props={
                "personName": base_script["person_name"],
                "monthsSinceText": base_script["months_since"],
                "aiMessage": base_script["ai_message"],
                "logoUrl": _logo_file_uri(),
                "captions": demo_captions,
            },
            duration_seconds=DEMO_DURATION,
            fps=FPS,
        )
        if not verify_clip(demo_video):
            raise RuntimeError("demo video failed verification")

        # ── 6. Render CLOSE segment ONCE ──────────────────────────────────
        render_composition(
            "LogoClose",
            close_video,
            props={
                "logoUrl": _logo_file_uri(),
                "payoff": "it's free",
                "handle": "nesso.ai",
                "appStoreHint": "on the App Store",
                "backdropUrl": "",
            },
            duration_seconds=CLOSE_DURATION,
            fps=FPS,
        )
        if not verify_clip(close_video):
            raise RuntimeError("close video failed verification")

        music_path = os.path.join(render_dir, "music.mp3")
        download_background_music(music_path)
        if not os.path.exists(music_path):
            music_path = ""
            log.warning("[%s] no background music", render_id)

        psych_path = ensure_psych_sfx()

        # ── 7. Shared SFX timeline (story/demo/close beats identical) ─────
        sfx_placements = _build_sfx_placements(
            messages=messages,
            hook_dur=HOOK_DURATION,
            story_dur=story_dur,
            demo_dur=DEMO_DURATION,
            close_dur=CLOSE_DURATION,
            ai_message=base_script["ai_message"],
        )

    except RemotionError as e:
        log.error("[%s] shared render failed: %s", render_id, e, exc_info=True)
        for _ in range(n):
            results.append(
                {
                    "output_path": "",
                    "tiktok_caption": "",
                    "ig_caption": "",
                    "ig_pin_comment": "",
                    "hook_query": "",
                    "hook_description": "",
                    "duration": 0,
                    "error": f"Remotion: {e}",
                }
            )
        return results
    except Exception as e:
        log.error("[%s] shared render failed: %s", render_id, e, exc_info=True)
        for _ in range(n):
            results.append(
                {
                    "output_path": "",
                    "tiktok_caption": "",
                    "ig_caption": "",
                    "ig_pin_comment": "",
                    "hook_query": "",
                    "hook_description": "",
                    "duration": 0,
                    "error": str(e),
                }
            )
        return results

    # ── 8. Per-variant: hook segment + VO + morph_and_concat + encode ─────
    for idx, variant in enumerate(variants):
        variant_num = idx + 1
        variant_dir = os.path.join(render_dir, f"variant_{variant_num}")
        os.makedirs(variant_dir, exist_ok=True)

        result: dict = {
            "output_path": "",
            "tiktok_caption": "",
            "ig_caption": "",
            "ig_pin_comment": "",
            "hook_query": variant["hook_line"][:60],
            "hook_description": variant["hook_line"],
            "duration": 0,
            "variant_index": variant_num,
            "variant_total": n,
            "error": None,
        }

        try:
            # 8a. Fetch a fresh Reddit background clip for this variant
            hook_clip_info = fetch_background_clip(
                variant_dir, target_seconds=HOOK_DURATION
            )
            hook_bg_url = ""
            hook_remote_name = ""
            if hook_clip_info:
                clip_path, _clip_dur, clip_desc = hook_clip_info
                result["hook_description"] = f"{variant['hook_line']} | {clip_desc}"
                hook_remote_name = f"hook_{render_id}_v{variant_num}.mp4"
                try:
                    hook_bg_url = upload_asset(clip_path, remote_name=hook_remote_name)
                except Exception as e:
                    log.warning(
                        "[%s] variant %d: hook clip upload failed: %s",
                        render_id, variant_num, e,
                    )
                    hook_bg_url = ""
                try:
                    os.remove(clip_path)
                except OSError:
                    pass

            # 8b. Render HOOK with this variant's line + palette + bg
            hook_video = os.path.join(variant_dir, "hook.mp4")
            render_composition(
                "HookText",
                hook_video,
                props={
                    "line": variant["hook_line"],
                    "subline": variant["hook_subline"],
                    "palette": variant["palette"],
                    "backgroundVideoUrl": hook_bg_url,
                },
                duration_seconds=HOOK_DURATION,
                fps=FPS,
            )

            if hook_remote_name:
                delete_asset(hook_remote_name)

            if not verify_clip(hook_video):
                raise RuntimeError("hook video failed verification")

            # 8c. Hook VO (per-variant — different line → different TTS)
            hook_vo_path = generate_hook_voiceover(
                variant["hook_line"], variant_dir, target_duration=HOOK_DURATION
            )

            # 8d. Concat + audio mix — writes into variant_dir so the
            # scratch files (norm_*.mp4, full_v.mp4, full_audio.m4a)
            # don't collide across variants.
            concat_video = os.path.join(variant_dir, "concat.mp4")
            morph_and_concat(
                hook_video=hook_video,
                story_video=story_video,
                demo_video=demo_video,
                close_video=close_video,
                hook_dur=HOOK_DURATION,
                story_dur=story_dur,
                demo_dur=DEMO_DURATION,
                close_dur=CLOSE_DURATION,
                story_vo_path=story_vo_path,
                demo_vo_path=demo_vo_path,
                hook_vo_path=hook_vo_path,
                music_path=music_path,
                psych_sfx_path=psych_path,
                sfx_placements=sfx_placements,
                output_path=concat_video,
            )

            # Clean hook-specific intermediates (don't touch shared files)
            for p in [hook_video, hook_vo_path]:
                if p and os.path.exists(p):
                    try:
                        os.remove(p)
                    except OSError:
                        pass

            # 8e. Final encode for this variant
            output_path = os.path.join(
                variant_dir, f"nesso_{render_id}_v{variant_num}.mp4"
            )
            cmd = [
                "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
                "-i", concat_video,
                "-c:v", "libx264", "-c:a", "aac",
                "-b:a", "128k",
                "-vf",
                f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease,"
                f"pad={WIDTH}:{HEIGHT}:-1:-1:color=black",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                "-preset", FFMPEG_PRESET,
                output_path,
            ]
            proc = subprocess.run(
                cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT
            )
            if proc.returncode != 0:
                raise RuntimeError(f"final encode failed: {proc.stderr[-500:]}")

            try:
                os.remove(concat_video)
            except OSError:
                pass

            if not verify_clip(output_path):
                raise RuntimeError("final video failed verification")

            result["output_path"] = output_path
            result["duration"] = get_duration(output_path)
            result["tiktok_caption"] = generate_tiktok_caption()
            result["ig_caption"] = generate_ig_caption()
            result["ig_pin_comment"] = generate_ig_pin_comment()

            log.info(
                "[%s] variant %d/%d complete: %s (%.1fs, %.1fMB)",
                render_id, variant_num, n, output_path,
                result["duration"],
                os.path.getsize(output_path) / (1024 * 1024),
            )

        except RemotionError as e:
            result["error"] = f"Remotion: {e}"
            log.error(
                "[%s] variant %d remotion failure: %s",
                render_id, variant_num, e, exc_info=True,
            )
        except Exception as e:
            result["error"] = str(e)
            log.error(
                "[%s] variant %d failed: %s",
                render_id, variant_num, e, exc_info=True,
            )

        results.append(result)

        try:
            log_render(
                hook_query=result.get("hook_query", ""),
                hook_category="",
                hook_description=result.get("hook_description", ""),
                script_length=len(messages),
                duration=result.get("duration", 0),
                success=result["error"] is None,
                error=result.get("error", "") or "",
            )
        except Exception:
            pass

    # ── 9. Cleanup shared intermediates (safe now — all variants done) ────
    for p in [story_video, demo_video, close_video,
              story_vo_path, demo_vo_path, music_path]:
        if p and os.path.exists(p):
            try:
                os.remove(p)
            except OSError:
                pass

    successful = sum(1 for r in results if r["error"] is None)
    log.info(
        "[%s] variants done: %d/%d ok", render_id, successful, n,
    )
    return results
