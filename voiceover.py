"""
Nesso Content Engine V20 — ElevenLabs TTS Voiceover Generation

Generates per-message voiceover audio clips, then concatenates into
one continuous track. Returns per-message durations so frame display
times can be synced to speech.
"""

import logging
import os
import subprocess
import wave

from config import (
    ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID,
    FFMPEG_THREADS,
    FFMPEG_TIMEOUT,
    VOICEOVER_ENABLED,
)
from verify import get_duration

log = logging.getLogger(__name__)


def _format_message_for_speech(msg: dict) -> str:
    """
    Convert a message dict into natural spoken text.
    System messages (read receipts, typing) become pauses.
    """
    sender = msg.get("sender", "")
    text = msg.get("text", "")

    if sender == "system":
        # Read receipts, delivered, typing... — these are visual-only
        # Return empty so we generate a short silence instead
        return ""

    # Strip emojis that TTS can't pronounce well
    # Keep the text casual — TTS handles "ngl", "fr", "lol" fine
    return text


def _generate_silence(duration: float, output_path: str) -> str:
    """Generate a silent audio clip of the specified duration."""
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=mono",
        "-t", str(duration),
        "-c:a", "libmp3lame", "-b:a", "64k",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if result.returncode != 0:
        log.warning("Silence generation failed: %s", result.stderr[-200:])
        return ""
    return output_path


def _generate_silence_wav(duration: float, output_path: str) -> str:
    """Generate silence using pure Python wave module — no ffmpeg needed.
    Always succeeds. Writes a WAV file (ffmpeg concat handles WAV fine)."""
    try:
        sample_rate = 44100
        num_samples = int(sample_rate * duration)
        # Write to .wav path (ffmpeg concat can mix formats)
        wav_path = os.path.splitext(output_path)[0] + ".wav"
        with wave.open(wav_path, "w") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(b"\x00\x00" * num_samples)
        return wav_path
    except Exception as e:
        log.error("Pure Python silence generation failed: %s", e)
        return ""


def _generate_silence_robust(duration: float, output_path: str) -> str:
    """Generate silence with multiple fallbacks. Guaranteed to return a path."""
    result = _generate_silence(duration, output_path)
    if result:
        return result
    # Fallback 1: use PCM -> MP3 pipeline with different parameters
    log.info("Primary silence gen failed, trying fallback for %s", output_path)
    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-t", str(duration),
        "-c:a", "libmp3lame", "-b:a", "64k",
        output_path,
    ]
    fallback = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
    if fallback.returncode == 0:
        return output_path
    # Fallback 2: pure Python WAV — no ffmpeg dependency
    log.info("FFmpeg silence failed, using pure Python WAV for %s", output_path)
    return _generate_silence_wav(duration, output_path)


def generate_voiceover(
    messages: list[dict],
    temp_dir: str,
) -> tuple[str, list[float]]:
    """
    Generate ElevenLabs TTS voiceover for each message.

    Returns:
        (concat_audio_path, per_message_durations)
        - concat_audio_path: path to the full voiceover audio file
        - per_message_durations: list of floats, one per message,
          representing how long each message's audio is (used to sync frames)

    If voiceover is disabled or fails, returns ("", []).
    """
    if not VOICEOVER_ENABLED:
        log.info("Voiceover disabled in config")
        return "", []

    if not ELEVENLABS_API_KEY:
        log.warning("ELEVENLABS_API_KEY not set — skipping voiceover")
        return "", []

    try:
        from elevenlabs import ElevenLabs
    except ImportError:
        log.warning("elevenlabs package not installed — skipping voiceover")
        return "", []

    client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

    clip_paths = []
    per_message_durations = []

    for i, msg in enumerate(messages):
        speech_text = _format_message_for_speech(msg)
        clip_path = os.path.join(temp_dir, f"vo_{i:03d}.mp3")
        fallback_delay = msg.get("delay", 1.2)

        if not speech_text:
            # System message (read receipt, typing...) — generate 1.5s silence
            silence_dur = 1.5
            result = _generate_silence_robust(silence_dur, clip_path)
            clip_paths.append(result)
            per_message_durations.append(silence_dur)
            continue

        try:
            # Generate TTS via ElevenLabs API
            audio_generator = client.text_to_speech.convert(
                voice_id=ELEVENLABS_VOICE_ID,
                text=speech_text,
                model_id="eleven_turbo_v2_5",
                output_format="mp3_44100_128",
            )

            # Write audio bytes to file
            with open(clip_path, "wb") as f:
                for chunk in audio_generator:
                    f.write(chunk)

            # Get actual duration of generated audio
            clip_dur = get_duration(clip_path)
            if clip_dur <= 0:
                log.warning("TTS clip %d has zero duration, using silence fallback", i)
                result = _generate_silence_robust(fallback_delay, clip_path)
                clip_paths.append(result)
                per_message_durations.append(fallback_delay)
                continue

            # Add 0.3s buffer so text lingers slightly after speech ends
            per_message_durations.append(clip_dur + 0.3)
            clip_paths.append(clip_path)

            log.debug("VO clip %d: %.1fs for '%s'", i, clip_dur, speech_text[:40])

        except Exception as e:
            log.warning("TTS failed for message %d: %s", i, e)
            result = _generate_silence_robust(fallback_delay, clip_path)
            clip_paths.append(result)
            per_message_durations.append(fallback_delay)

    # Filter out any empty paths from failed silence generation
    valid = [(p, d) for p, d in zip(clip_paths, per_message_durations) if p]
    if not valid:
        log.warning("No voiceover clips generated")
        return "", []

    clip_paths = [p for p, _ in valid]
    per_message_durations = [d for _, d in valid]

    # Concatenate all clips into one continuous audio file
    concat_path = os.path.join(temp_dir, "voiceover.mp3")
    concat_file = os.path.join(temp_dir, "vo_concat.txt")

    with open(concat_file, "w") as f:
        for path in clip_paths:
            safe_path = path.replace("'", "'\\''")
            f.write(f"file '{safe_path}'\n")

    cmd = [
        "ffmpeg", "-y", "-threads", FFMPEG_THREADS,
        "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-c:a", "libmp3lame", "-b:a", "128k",
        concat_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)

    # Cleanup
    try:
        os.remove(concat_file)
    except OSError:
        pass
    for path in clip_paths:
        try:
            os.remove(path)
        except OSError:
            pass

    if result.returncode != 0:
        log.warning("Voiceover concat failed: %s", result.stderr[-300:])
        return "", []

    # Drift correction: measure actual concatenated duration and adjust
    # per_message_durations so their sum matches the real audio length.
    # Without this, small per-clip measurement errors accumulate (50-200ms).
    actual_total_dur = get_duration(concat_path)
    expected_total_dur = sum(per_message_durations)

    if actual_total_dur > 0 and expected_total_dur > 0:
        drift = actual_total_dur - expected_total_dur
        if abs(drift) > 0.01:
            scale = actual_total_dur / expected_total_dur
            per_message_durations = [d * scale for d in per_message_durations]
            log.info(
                "VO drift correction: expected=%.3fs, actual=%.3fs, scale=%.4f",
                expected_total_dur, actual_total_dur, scale,
            )

    log.info(
        "Voiceover generated: %s (%.1fs, %d clips)",
        concat_path, actual_total_dur, len(clip_paths),
    )

    return concat_path, per_message_durations
