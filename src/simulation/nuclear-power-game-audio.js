/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { assignmentSteps } from './nuclear-power-missions.js';

// Presentation-only history. Prime from restored evidence; never save audio state
// or let sound availability, checklist rendering or wall time advance a mission.
export class AssignmentSoundTracker {
    reset(career, sim) {
        const current = career?.current;
        this.career = career;
        this.mission = current?.definition.id;
        this.status = current?.status;
        this.seen = new Set(assignmentSteps(current, sim).filter(step => step.done).map(step => step.id));
    }

    observe(career, sim) {
        const current = career?.current;
        if (career !== this.career || current?.definition.id !== this.mission
                || this.status === 'assigned' || !['active', 'ready'].includes(current?.status)) {
            this.reset(career, sim);
            return null;
        }
        const previous = this.status;
        this.status = current.status;
        const completed = assignmentSteps(current, sim).filter(step => step.done && !this.seen.has(step.id));
        for (const step of completed) this.seen.add(step.id);
        if (previous === 'active' && current.status === 'ready') return 'complete';
        // Several steps can turn green together. Conditions returning to green
        // never chatter; whole-assignment verification takes priority over steps.
        return current.status === 'active' && completed.length ? 'step' : null;
    }
}
