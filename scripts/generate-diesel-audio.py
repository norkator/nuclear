# Pörssiohjain - Energy usage optimization platform
# Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
# Licensed under the Pörssiohjain Personal Use License v1.0.
"""Original diesel sound design; Python + NumPy, no recordings or runtime synthesis.

Run: python3 scripts/generate-diesel-audio.py
"""
from pathlib import Path
import wave

import numpy as np

RATE = 48000
OUTPUT = Path(__file__).resolve().parents[1] / 'public/audio/nuclear-power/diesel'


def render(kind, seconds, seed):
    rng = np.random.default_rng(seed)
    count = round(RATE * seconds)
    t = np.arange(count) / RATE
    frequencies = np.fft.rfftfreq(count, 1 / RATE)

    def noise(low, high):
        spectrum = np.fft.rfft(rng.normal(size=count))
        shape = np.exp(-.5 * (frequencies / high) ** 4)
        shape *= 1 - np.exp(-.5 * (frequencies / low) ** 4)
        signal = np.fft.irfft(spectrum * shape, n=count)
        return signal / np.sqrt(np.mean(signal ** 2))

    looping = kind == 'running-loop'
    if looping:
        # Whole cycles, including the low-rate modulation, make the loop periodic.
        phase = 2 * np.pi * 25 * t + .045 * np.sin(2 * np.pi * t / 3)
        firing = np.ones(count)
        envelope = np.ones(count)
    elif kind == 'startup':
        speed = 3.5 + 1.2 * np.minimum(t, 2)
        speed = np.where(t > 2, 25 - 19.1 * np.exp(-(t - 2) / 1.05), speed)
        phase = 2 * np.pi * np.cumsum(speed) / RATE
        # Starter churn, uneven first ignitions, then a settled idle.
        firing = np.clip((t - 1.4) / 1.3, 0, 1)
        firing *= 1 - .6 * np.exp(-((t - 2.15) / .13) ** 2)
        envelope = np.minimum(t / .04, 1) * np.minimum((seconds - t) / .08, 1)
    else:
        speed = 25 * np.maximum(0, 1 - t / 2.9) ** 1.6
        phase = 2 * np.pi * np.cumsum(speed) / RATE
        firing = np.exp(-t / .35)
        envelope = np.minimum(t / .012, 1) * np.maximum(0, 1 - t / seconds) ** .7

    # Six-cylinder four-stroke-like cadence: three exhaust beats per crank turn.
    # Illustrative engine timbre, not an RPM or hardware model.
    exhaust = sum(weight * np.sin(3 * harmonic * phase + harmonic * .22)
                  for harmonic, weight in [(1, .48), (2, .23), (3, .12), (4, .07)])
    uneven = 1 + .13 * np.sin(phase / 2) + .05 * np.sin(phase)
    knock = np.maximum(0, np.cos(3 * phase)) ** 16
    chatter = noise(600, 4200) * (.055 + .24 * knock)
    rumble = .19 * np.sin(phase) + .12 * np.sin(2 * phase) + .09 * noise(30, 220)
    fan = .055 * noise(240, 1800)
    center = (exhaust * uneven * (.22 + .78 * firing)
              + chatter * (.4 + .6 * firing) + rumble + fan)
    if kind == 'startup':
        starter = np.clip(1 - (t - 1.9) / .6, 0, 1)
        center += starter * (.13 * np.sin(phase * 18) + .10 * noise(350, 2300))
    if kind == 'shutdown':
        center *= np.maximum(0, 1 - t / 3) ** .45

    side = .025 * noise(300, 2600)
    # Circular room reflections only for the loop; zero-padded ones for one-shots.
    def echo(samples):
        shifted = np.roll(center, samples)
        if not looping:
            shifted[:samples] = 0
        return shifted

    stereo = np.stack([center + side + .09 * echo(1321),
                       center - side + .09 * echo(1783)], axis=1)
    stereo -= stereo.mean(axis=0)
    stereo *= envelope[:, None]
    stereo *= 10 ** (-19 / 20) / np.sqrt(np.mean(stereo ** 2))
    stereo *= min(1, .55 / np.max(np.abs(stereo)))
    pcm = np.round(stereo * 32767).astype('<i2')
    assert np.max(np.abs(pcm.astype(float))) < 32767, 'Clipping'
    if looping:
        steps = np.abs(np.diff(pcm.astype(float), axis=0))
        seam = np.abs(pcm[0].astype(float) - pcm[-1].astype(float))
        assert np.all(seam < np.percentile(steps, 99.9, axis=0)), 'Loop seam'
    else:
        assert np.max(np.abs(pcm[[0, -1]].astype(float))) < 20, 'One-shot endpoint'
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUTPUT / f'diesel-{kind}.wav'), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    print(f'{kind}: {seconds}s stereo PCM16, '
          f'peak {20 * np.log10(np.max(np.abs(stereo))):.1f} dBFS; endpoints OK')


if __name__ == '__main__':
    render('startup', 8, 2026110901)
    render('running-loop', 12, 2026110902)
    render('shutdown', 3.2, 2026110903)
