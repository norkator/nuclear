<!--
Pörssiohjain - Energy usage optimization platform
Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
Licensed under the Pörssiohjain Personal Use License v1.0.
-->
# Diesel generator sounds

Original procedural sound designs created 2026-11-09 for this fictional plant.
No recordings or third-party samples were used; the repository license applies.
These illustrate engine states, not a particular real generator or measured RPM.

- `diesel-startup.wav`: 8 seconds of starter churn, uneven ignition, acceleration
  and settling into steady running, matching the simulated startup countdown.
- `diesel-running-loop.wav`: seamless 12-second exhaust throb, low engine rumble,
  combustion clatter and fan texture. All tones, modulation and noise are periodic.
- `diesel-shutdown.wav`: 3.2 seconds of cut combustion, slowing shaft and fading rattle.

All files are stereo 48 kHz PCM16 WAV, approximately -19 dBFS RMS, with peaks below
-5 dBFS. One-shots have quiet endpoints; the loop has no fade or silent padding.
From the repository root, regenerate with
`python3 scripts/generate-diesel-audio.py` (NumPy required only for generation). The script checks clipping and seam/endpoint continuity.

Enable plant sounds to load the assets locally. Each diesel has one independent
voice, driven by STARTING/RUNNING/STOPPED/EMPTY read-back. Running gain follows
actual bus load (0.035 unloaded to 0.05 fully loaded, at most 0.10 for both engines).
Automatic starts and fuel-exhaustion stops use the same sounds as manual commands.
Startup resumes at the current countdown position after pause or tab switching;
entering the tab with an already-running diesel plays only the running loop.
Past shutdowns and blocked/repeated starts are never replayed.

Reactor overview mixes the independent diesel voices with reactor operating
loops and reactor Start/Stop cues. Reactor cues never interrupt the diesels.
Maintenance has no machinery audio; the old Auxiliary power tab is removed. Alarms and
UI clicks remain shared. Mute, pause, hide, detach and Reset demo stop every voice.
Missing/late files never affect the simulation or independently start playback.
