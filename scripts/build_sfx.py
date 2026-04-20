"""
Nesso Content Engine V22 — SFX generator

Builds the full SFX library via FFmpeg synthesis. Run once at Docker build time
(see Dockerfile) or any time you want to regenerate. Writes to assets/sfx/.

Each SFX is designed to be punchy, short, and subtle — meant to sit UNDER the
voiceover at 20-40% mix volume without ever competing with it.
"""

from __future__ import annotations

import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT_DIR = os.path.join(REPO, "assets", "sfx")

os.makedirs(OUT_DIR, exist_ok=True)


def _run(cmd: list[str], out_label: str) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        sys.stderr.write(f"[sfx] FAILED {out_label}: {r.stderr[-300:]}\n")
        sys.exit(1)
    print(f"[sfx] built {out_label}")


def _ffmpeg(af: str, duration: float, output: str) -> None:
    """Generate silence → apply filter chain → write MP3."""
    cmd = [
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", f"anullsrc=r=44100:cl=mono:d={duration}",
        "-af", af,
        "-c:a", "libmp3lame", "-b:a", "128k",
        output,
    ]
    _run(cmd, os.path.basename(output))


def bubble_pop():
    """Soft 'pop' for iMessage bubble appear. Short sine + fast envelope."""
    out = os.path.join(OUT_DIR, "bubble_pop.mp3")
    # 340 Hz sine, 80ms, quick envelope attack/release, lowpass smoothing
    af = (
        "aevalsrc='sin(2*PI*340*t)*exp(-t*40)':d=0.1,"
        "volume=0.55,"
        "lowpass=f=1200,"
        "afade=t=in:d=0.004,afade=t=out:st=0.05:d=0.05"
    )
    cmd = [
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", f"aevalsrc='sin(2*PI*340*t)*exp(-t*40)':d=0.1",
        "-af", "volume=0.55,lowpass=f=1200,afade=t=in:d=0.004,afade=t=out:st=0.05:d=0.05",
        "-c:a", "libmp3lame", "-b:a", "128k",
        out,
    ]
    _run(cmd, "bubble_pop.mp3")


def typing_tick():
    """Very soft tick for typing indicator — one per dot wave."""
    out = os.path.join(OUT_DIR, "typing_tick.mp3")
    cmd = [
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", "aevalsrc='sin(2*PI*210*t)*exp(-t*80)':d=0.04",
        "-af", "volume=0.3,lowpass=f=900",
        "-c:a", "libmp3lame", "-b:a", "128k",
        out,
    ]
    _run(cmd, "typing_tick.mp3")


def ui_tap():
    """Satisfying button-press click. Two-tone: quick high + softer low."""
    out = os.path.join(OUT_DIR, "ui_tap.mp3")
    # Layer two clicks: 1800Hz (5ms) + 600Hz (12ms) both with sharp envelope
    filter_complex = (
        "aevalsrc='sin(2*PI*1800*t)*exp(-t*120)':d=0.02[a];"
        "aevalsrc='sin(2*PI*600*t)*exp(-t*55)':d=0.04[b];"
        "[a][b]amix=inputs=2:duration=longest:normalize=0,"
        "volume=0.7"
    )
    cmd = [
        "ffmpeg", "-y",
        "-filter_complex", filter_complex,
        "-t", "0.05",
        "-c:a", "libmp3lame", "-b:a", "128k",
        out,
    ]
    _run(cmd, "ui_tap.mp3")


def whoosh_short():
    """Low-pass filtered noise sweep for slide/sheet transitions."""
    out = os.path.join(OUT_DIR, "whoosh_short.mp3")
    # Pink noise, 0.4s, with high-pass sweep 200→1800Hz via bandpass + envelope
    cmd = [
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", "anoisesrc=r=44100:c=pink:d=0.4",
        "-af",
        (
            "volume=0.45,"
            "highpass=f=180,"
            "lowpass=f=2400,"
            "afade=t=in:d=0.04,afade=t=out:st=0.28:d=0.12"
        ),
        "-c:a", "libmp3lame", "-b:a", "128k",
        out,
    ]
    _run(cmd, "whoosh_short.mp3")


def typewriter_tick():
    """Very soft character tick for AI typewriter."""
    out = os.path.join(OUT_DIR, "typewriter_tick.mp3")
    cmd = [
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", "aevalsrc='sin(2*PI*1100*t)*exp(-t*200)':d=0.025",
        "-af", "volume=0.28,highpass=f=400",
        "-c:a", "libmp3lame", "-b:a", "128k",
        out,
    ]
    _run(cmd, "typewriter_tick.mp3")


def send_swoosh():
    """Upward sine sweep for message send — satisfying payoff."""
    out = os.path.join(OUT_DIR, "send_swoosh.mp3")
    # Exponential frequency sweep 250→1600Hz over 0.3s
    cmd = [
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", "aevalsrc='sin(2*PI*(250+1350*t/0.3)*t)*exp(-t*5)':d=0.3",
        "-af",
        (
            "volume=0.55,"
            "lowpass=f=3500,"
            "afade=t=in:d=0.01,afade=t=out:st=0.22:d=0.08"
        ),
        "-c:a", "libmp3lame", "-b:a", "128k",
        out,
    ]
    _run(cmd, "send_swoosh.mp3")


def logo_ding():
    """Soft chime for logo appearance — 2-note cluster."""
    out = os.path.join(OUT_DIR, "logo_ding.mp3")
    # Layer 880Hz (A5) + 1320Hz (E6) for a perfect-fifth chime
    filter_complex = (
        "aevalsrc='sin(2*PI*880*t)*exp(-t*3.5)':d=0.6[a];"
        "aevalsrc='sin(2*PI*1320*t)*exp(-t*4.0)':d=0.6[b];"
        "[a][b]amix=inputs=2:duration=longest:normalize=0,"
        "volume=0.45,"
        "afade=t=in:d=0.01,afade=t=out:st=0.42:d=0.18"
    )
    cmd = [
        "ffmpeg", "-y",
        "-filter_complex", filter_complex,
        "-t", "0.6",
        "-c:a", "libmp3lame", "-b:a", "128k",
        out,
    ]
    _run(cmd, "logo_ding.mp3")


def impact_hit():
    """
    Deep bass thud / stinger used to punctuate the emphasis line and
    payoff moments. Classic high-converting ad ingredient — gives a
    physical sense of impact and drives retention spike at the beat.
    """
    out = os.path.join(OUT_DIR, "impact_hit.mp3")
    # Layered: 55Hz sub-bass + 120Hz body + 800Hz transient click
    filter_complex = (
        # Sub-bass body — low frequency with slow decay
        "aevalsrc='sin(2*PI*55*t)*exp(-t*6)':d=0.6[sub];"
        # Body thump
        "aevalsrc='sin(2*PI*120*t)*exp(-t*10)':d=0.4[body];"
        # Transient click up front
        "aevalsrc='sin(2*PI*800*t)*exp(-t*80)':d=0.04[click];"
        "[sub][body][click]amix=inputs=3:duration=longest:normalize=0,"
        "lowpass=f=1800,"
        "volume=0.85,"
        "afade=t=in:d=0.002,afade=t=out:st=0.45:d=0.15"
    )
    cmd = [
        "ffmpeg", "-y",
        "-filter_complex", filter_complex,
        "-t", "0.6",
        "-c:a", "libmp3lame", "-b:a", "128k",
        out,
    ]
    _run(cmd, "impact_hit.mp3")


def riser_short():
    """
    Rising tension sweep — classic TikTok ad pattern played in the
    500ms before a big reveal. Builds anticipation then drops.
    """
    out = os.path.join(OUT_DIR, "riser_short.mp3")
    # Pink noise bandpass-swept from low to high over 0.5s with crescendo
    cmd = [
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", "anoisesrc=r=44100:c=pink:d=0.5",
        "-af",
        (
            # Volume ramps up across the duration
            "volume='0.15 + 0.5*t/0.5':eval=frame,"
            # Band-pass that opens up over time
            "highpass=f=200,"
            "lowpass=f=2800,"
            "afade=t=in:d=0.03,afade=t=out:st=0.46:d=0.04"
        ),
        "-c:a", "libmp3lame", "-b:a", "128k",
        out,
    ]
    _run(cmd, "riser_short.mp3")


def notification_ding():
    """
    iMessage-style notification ding. Used alongside bubble pop on the
    first incoming bubble to signal "NEW TEXT" — primal hit for ad viewers.
    """
    out = os.path.join(OUT_DIR, "notification_ding.mp3")
    # Two-note chime (1046 + 1568 Hz = C6 + G6, perfect fifth, bright)
    filter_complex = (
        "aevalsrc='sin(2*PI*1046*t)*exp(-t*8)':d=0.25[a];"
        "aevalsrc='sin(2*PI*1568*t)*exp(-t*10)':d=0.25[b];"
        "[a][b]amix=inputs=2:duration=longest:normalize=0,"
        "volume=0.5,"
        "afade=t=in:d=0.003,afade=t=out:st=0.18:d=0.06"
    )
    cmd = [
        "ffmpeg", "-y",
        "-filter_complex", filter_complex,
        "-t", "0.25",
        "-c:a", "libmp3lame", "-b:a", "128k",
        out,
    ]
    _run(cmd, "notification_ding.mp3")


def cash_ding():
    """
    Soft value chime for the 'it's free' moment. Subtle cash-register
    vibe without being gross. Boosts conversion signal.
    """
    out = os.path.join(OUT_DIR, "cash_ding.mp3")
    # Bright major triad C6-E6-G6 (1046/1318/1568 Hz)
    filter_complex = (
        "aevalsrc='sin(2*PI*1046*t)*exp(-t*5)':d=0.45[a];"
        "aevalsrc='sin(2*PI*1318*t)*exp(-t*5.5)':d=0.45[b];"
        "aevalsrc='sin(2*PI*1568*t)*exp(-t*6)':d=0.45[c];"
        "[a][b][c]amix=inputs=3:duration=longest:normalize=0,"
        "volume=0.45,"
        "afade=t=in:d=0.005,afade=t=out:st=0.3:d=0.15"
    )
    cmd = [
        "ffmpeg", "-y",
        "-filter_complex", filter_complex,
        "-t", "0.45",
        "-c:a", "libmp3lame", "-b:a", "128k",
        out,
    ]
    _run(cmd, "cash_ding.mp3")


def build_all():
    print(f"[sfx] output directory: {OUT_DIR}")
    bubble_pop()
    typing_tick()
    ui_tap()
    whoosh_short()
    typewriter_tick()
    send_swoosh()
    logo_ding()
    impact_hit()
    riser_short()
    notification_ding()
    cash_ding()
    print("[sfx] all sfx built")


if __name__ == "__main__":
    build_all()
