<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Equipment-station ambience

Original procedural sound designs created 2026-11-16 for this fictional plant.
No recordings or third-party samples were used; the repository license applies.
These are illustrative machinery sounds, not recordings of specific equipment.

| File | Sound |
| --- | --- |
| `computers-loop.wav` | Server ventilation, PSU/UPS hum and restrained drive chatter |
| `pumps-loop.wav` | Electric motor, impeller whirr and circulating water |
| `exchanger-loop.wav` | Water through tubes and secondary-side steam hiss |
| `turbine-loop.wav` | Shaft/generator hum, turbine whine and steam admission |
| `condenser-loop.wav` | Cooling-water circulation, spray, drops and basin resonance |

All five are seamless eight-second stereo 48 kHz PCM16 WAV loops, approximately
−22 dBFS RMS and below −6 dBFS peak. Periodic noise, whole-cycle tones/modulation
and circular reflections preserve the seam without fades or silent padding.
Regenerate with `python3 scripts/generate-station-audio.py` (NumPy required only
for generation). The script checks clipping and loop continuity.

**Enable plant sounds** remains the shared opt-in. Only the visible active
station loads its file, once per console instance. One station voice is allowed;
tab/pump changes stop the outgoing machinery immediately. Gain is bounded to
0.08. Actual motor/shaft speed controls pitch and intensity; actual circulation,
cooling and secondary heat shape water/steam texture through a low-pass filter.
Requests alone cannot make stopped equipment audible. The server room can sound
while the reactor is cold because its rack is powered and its fans are running.

Inactive tabs, offscreen station viewports, mute, pause, hidden pages and detach
stop voices and disconnect source/filter/gain nodes. Returning resumes current
actual operation, with no replayed events. Loading only caches the buffer and
cannot start playback independently. Missing files leave native controls usable.
Maintenance stays quiet; reactor/diesel audio, UI clicks and alarms retain their
existing behavior. Audio adds no simulation state or saved fields.
