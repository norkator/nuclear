# Pörssiohjain - Energy usage optimization platform
# Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
# Licensed under the Pörssiohjain Personal Use License v1.0.
"""Original periodic equipment-room sound designs. Python + NumPy, no samples.

Run: python3 scripts/generate-station-audio.py
"""
from pathlib import Path
import wave

import numpy as np

RATE = 48000
SECONDS = 8
COUNT = RATE * SECONDS
TIME = np.arange(COUNT) / RATE
FREQUENCIES = np.fft.rfftfreq(COUNT, 1 / RATE)
OUTPUT = Path(__file__).resolve().parents[1] / 'public/audio/nuclear-power/stations'


def render(kind, seed):
    rng = np.random.default_rng(seed)

    def sine(hz, phase=0):
        # All frequencies/modulation finish whole cycles; no silent loop padding.
        return np.sin(2 * np.pi * hz * TIME + phase)

    def noise(low, high):
        spectrum = np.fft.rfft(rng.normal(size=COUNT))
        shape = np.exp(-.5 * (FREQUENCIES / high) ** 4)
        shape *= 1 - np.exp(-.5 * (FREQUENCIES / low) ** 4)
        signal = np.fft.irfft(spectrum * shape, n=COUNT)
        return signal / np.sqrt(np.mean(signal ** 2))

    if kind == 'computers':
        # Ventilation dominates, with a restrained PSU hum and drive activity.
        fans = .26 * noise(200, 2300) * (1 + .035 * sine(.5))
        hum = .13 * sine(100) + .05 * sine(200, .3) + .025 * sine(400, .8)
        blades = .035 * sine(312.5, .06 * sine(.25)) + .02 * sine(625)
        drives = .012 * noise(1200, 3400) * np.maximum(0, sine(2.125)) ** 18
        center = fans + hum + blades + drives
    elif kind == 'pumps':
        motor = .23 * sine(50, .025 * sine(.375)) + .10 * sine(100) + .05 * sine(200, .4)
        impeller = .06 * sine(350, .08 * sine(1.25)) + .025 * sine(700)
        water = .18 * noise(180, 2500) * (1 + .045 * sine(3.5))
        center = motor + impeller + water + .04 * noise(35, 130)
    elif kind == 'exchanger':
        # Lower water circulation and higher secondary-side steam separate under
        # the runtime low-pass filter as actual heat/flow changes.
        circulation = .25 * noise(110, 850) * (1 + .07 * sine(.375))
        steam = .18 * noise(1100, 4200) * (1 + .055 * sine(.625))
        tubes = .025 * sine(187.5) + .015 * sine(562.5, .3)
        center = circulation + steam + tubes
    elif kind == 'turbine':
        shaft = .17 * sine(50, .025 * sine(.5)) + .08 * sine(100) + .035 * sine(150, .5)
        whine = .11 * sine(625, .07 * sine(.375)) + .04 * sine(1250) + .015 * sine(2500, .8)
        admission = .17 * noise(500, 3900) * (1 + .045 * sine(.625))
        center = shaft + whine + admission + .04 * noise(25, 110)
    else:
        circulation = .21 * noise(80, 950) * (1 + .09 * sine(.25))
        spray = .15 * noise(850, 3200) * (1 + .1 * sine(1.375))
        droplets = .05 * noise(350, 1800) * np.maximum(0, sine(7.125, .2 * sine(.5))) ** 5
        basin = .025 * sine(87.5) + .015 * sine(175, .5)
        center = circulation + spray + droplets + basin

    side = .025 * noise(250, 2200)
    stereo = np.stack([center + side + .10 * np.roll(center, 1399),
                       center - side + .10 * np.roll(center, 1877)], axis=1)
    stereo -= stereo.mean(axis=0)
    stereo *= 10 ** (-22 / 20) / np.sqrt(np.mean(stereo ** 2))
    stereo *= min(1, .5 / np.max(np.abs(stereo)))
    pcm = np.round(stereo * 32767).astype('<i2')
    steps = np.abs(np.diff(pcm.astype(float), axis=0))
    seam = np.abs(pcm[0].astype(float) - pcm[-1].astype(float))
    assert np.all(seam < np.percentile(steps, 99.9, axis=0)), 'Loop discontinuity'
    assert np.max(np.abs(pcm.astype(float))) < 32767, 'Clipping'
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUTPUT / f'{kind}-loop.wav'), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    print(f'{kind}: {SECONDS}s stereo PCM16; '
          f'peak {20 * np.log10(np.max(np.abs(stereo))):.1f} dBFS; seam OK')


if __name__ == '__main__':
    for index, kind in enumerate(['computers', 'pumps', 'exchanger', 'turbine', 'condenser']):
        render(kind, 2026111600 + index)
