<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Plant operating-state sounds

Original procedurally synthesized sound effects for this fictional plant, created
2026-11-07. No external recordings or sample packs were used. These are designed
gameplay cues, not recordings of a reactor core or a particular power station.

- `plant-normal-loop.wav`: smooth turbine tone, low generator hum, steady steam
  and room rumble; healthy generating operation.
- `plant-fault-loop.wav`: the same machinery with shaft wobble, surging steam,
  rough bearing chatter and intermittent electrical crackle; audible trouble.

Both are seamless 16-second, 48 kHz, stereo, 16-bit PCM WAV loops. No fade or silent
padding is baked in. Normal RMS is approximately -22 dBFS and fault RMS -20 dBFS;
peaks are bounded to -6 dBFS. The fault cue changes timbre, not just volume, and
contains no alarm siren, speech or music.

The app loads these files after **Enable plant sounds** and loops decoded
AudioBuffers without gaps. Actual running reactor power and turbine shaft speed
control intensity (maximum gain 0.10); Stop allows the shaft to coast down audibly.
A cold stopped plant is silent. Stress, damage, overheating, trips and actual
component disturbances crossfade to the fault texture over approximately one
second, independently of alarm acknowledgement. Requested MW and fault-selection
buttons alone do not choose the sound. Both voices stop immediately on mute,
pause, hidden view or detach; reset returns to cold silence. Late asset loading
cannot start playback independently. Missing files show an unavailable status.
UI clicks, command cues and alarms remain separate. Audio supports the visible
status rather than replacing it. To audition separately, open either WAV in a
player and enable repeat.

Regenerate with `python3 scripts/generate-plant-state-audio.py` from the repository root
(Python with NumPy required only for asset generation).
