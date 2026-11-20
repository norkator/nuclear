/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { getAndroidBootstrap } from '../platform/android-bridge.js';

export class SoundChoice {
    constructor(host) {
        this.host = host;
        const template = document.createElement('template');
        template.innerHTML = `<dialog class="sound-choice-dialog" aria-labelledby="sound-choice-title" aria-describedby="sound-choice-description">
          <h2 id="sound-choice-title">Enable plant sounds?</h2>
          <p id="sound-choice-description">Hear machinery, control switches and alerts. You can change this at any time in the sound settings.</p>
          <div class="sound-choice-buttons"><button class="small-button" data-sound-choice="yes" autofocus>Yes</button><button class="small-button" data-sound-choice="no">No</button></div>
        </dialog>`;
        host.shadowRoot.append(template.content);
        this.dialog = host.shadowRoot.querySelector('.sound-choice-dialog');
        this.dialog.addEventListener('click', event => {
            const choice = event.target.closest('[data-sound-choice]');
            if (choice) this.choose(choice.dataset.soundChoice === 'yes');
        });
        this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.choose(false); });
    }

    connect() {
        if (this.asked) return;
        this.asked = true;
        const native = getAndroidBootstrap();
        // The bundled WebView explicitly permits playback without a gesture.
        // Older wrappers and ordinary browsers retain the explicit sound choice.
        if (native?.platform === 'android' && native.audioEnabledByDefault === true) {
            if (!this.host.soundEnabled) this.host.act('sound');
            return;
        }
        this.dialog.showModal();
    }

    choose(enabled) {
        this.dialog.close();
        // Keep AudioContext creation/resume inside this explicit user gesture.
        if (Boolean(this.host.soundEnabled) !== enabled) this.host.act('sound');
    }

    disconnect() { if (this.dialog.open) this.dialog.close(); }
}
