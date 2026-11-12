# Pörssiohjain - Energy usage optimization platform
# Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
# Licensed under the Pörssiohjain Personal Use License v1.0.
"""Render original, periodic plant-state sound designs. Requires Python + NumPy.

Run from any directory: python3 scripts/generate-plant-state-audio.py
No recordings, external samples, or runtime dependencies are used.
"""

from pathlib import Path
import wave

import numpy as np


RATE = 48000
SECONDS = 16
COUNT = RATE * SECONDS
TIME = np.arange(COUNT) / RATE
FREQUENCIES = np.fft.rfftfreq(COUNT, 1 / RATE)
RNG = np.random.default_rng(20261107)
OUTPUT = Path(__file__).resolve().parents[1] / "public/audio/nuclear-power/plant-state"


def sine(hz, phase=0):
    # Frequencies and modulation rates complete whole cycles in the loop.
    return np.sin(2 * np.pi * hz * TIME + phase)


def noise(low, high):
    spectrum = np.fft.rfft(RNG.normal(size=COUNT))
    shape = np.exp(-0.5 * (FREQUENCIES / high) ** 4)
    shape *= 1 - np.exp(-0.5 * (FREQUENCIES / low) ** 4)
    signal = np.fft.irfft(spectrum * shape, n=COUNT)
    return signal / np.sqrt(np.mean(signal ** 2))


def body(fault):
    wobble = (0.32 if fault else 0.025) * sine(0.3125)
    wobble += (0.16 if fault else 0.012) * sine(0.8125)
    rotor_phase = 2 * np.pi * 50 * TIME + wobble
    rotor = (0.30 * np.sin(rotor_phase)
             + 0.22 * np.sin(2 * rotor_phase + 0.3)
             + 0.11 * np.sin(3 * rotor_phase + 0.7)
             + 0.045 * np.sin(6 * rotor_phase))
    rotor *= 1 + (0.22 if fault else 0.025) * sine(3.125)
    turbine = (0.065 * sine(750, 0.45 * wobble)
               + 0.025 * sine(1500, 0.8 * wobble))
    steam = noise(380, 3400) * 0.13
    steam *= 1 + (0.38 if fault else 0.055) * sine(0.4375)
    rumble = noise(25, 170) * 0.14
    signal = rotor + turbine + steam + rumble
    if fault:
        # Repeated rough bearing contact, irregular steam surges and short arcs.
        roughness = np.maximum(0, sine(6.375, 0.7 * sine(0.375))) ** 8
        signal += 0.22 * noise(280, 2400) * roughness
        signal += 0.10 * sine(437.5, 1.4 * sine(0.25)) * (0.5 + 0.5 * sine(0.625)) ** 4
        for center, width, strength in [(1.8, .11, .28), (4.2, .18, .34),
                                         (7.7, .08, .30), (10.3, .23, .27),
                                         (13.5, .13, .36), (14.1, .06, .24)]:
            distance = (TIME - center + SECONDS / 2) % SECONDS - SECONDS / 2
            envelope = np.exp(-0.5 * (distance / width) ** 2)
            signal += strength * envelope * noise(1100, 5600)
        signal += 0.13 * noise(90, 700) * (0.5 + 0.5 * sine(0.1875)) ** 5
    return signal


def render(name, fault):
    center = body(fault)
    side = noise(250, 2600) * 0.045
    # Small circular room reflections preserve the exact loop period.
    left = center + side + 0.11 * np.roll(center, 1771) + 0.06 * np.roll(center, 4517)
    right = center - side + 0.10 * np.roll(center, 2221) + 0.07 * np.roll(center, 5081)
    stereo = np.stack([left, right], axis=1)
    stereo -= stereo.mean(axis=0)
    target_rms = 10 ** ((-20 if fault else -22) / 20)
    stereo *= target_rms / np.sqrt(np.mean(stereo ** 2))
    peak = np.max(np.abs(stereo))
    if peak > 0.5:
        stereo *= 0.5 / peak
    pcm = np.round(stereo * 32767).astype('<i2')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    path = OUTPUT / name
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    steps = np.abs(np.diff(pcm.astype(float), axis=0))
    seam = np.abs(pcm[0].astype(float) - pcm[-1].astype(float))
    assert np.all(seam < np.percentile(steps, 99.9, axis=0)), 'Unexpected loop discontinuity'
    assert np.max(np.abs(pcm.astype(float))) < 32767, 'Clipping'
    print(f'{name}: {SECONDS}s stereo {RATE}Hz PCM16; '
          f'peak {20 * np.log10(np.max(np.abs(stereo))):.1f} dBFS; '
          f'RMS {20 * np.log10(np.sqrt(np.mean(stereo ** 2))):.1f} dBFS; seam OK')


if __name__ == '__main__':
    render('plant-normal-loop.wav', False)
    render('plant-fault-loop.wav', True)
