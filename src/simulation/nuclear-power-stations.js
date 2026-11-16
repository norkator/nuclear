/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { EQUIPMENT_STATIONS, equipmentStation } from './nuclear-power-stations-config.js';
import { EquipmentStationScene } from './nuclear-power-stations-scene.js';
import { ElectricalGridScene } from './nuclear-power-grid-scene.js';
import { feedSwitch } from './nuclear-power-electrical.js';
import { PUMPS, pumpDefinition } from './nuclear-power-pumps.js';
import { setText } from './nuclear-power-presentation.js';
import { COMPONENT_SETTINGS } from './nuclear-power-components.js';

const stationTab = ({ id, title }) => `<button id="${id}-tab" role="tab" data-plant-tab="${id}" aria-controls="${id}-panel" aria-selected="false" tabindex="-1">${title}</button>`;
export const electricalTab = stationTab(EQUIPMENT_STATIONS.find(station => station.id === 'electrical'));
export const stationTabs = EQUIPMENT_STATIONS.filter(station => station.id !== 'electrical').map(stationTab).join('');
export const stationPanels = EQUIPMENT_STATIONS.map(({ id, title, tag, parts }) => `<section id="${id}-panel" class="equipment-station" role="tabpanel" aria-labelledby="${id}-tab" hidden>
  <div class="station-heading"><div><span class="eyebrow">${tag} / EQUIPMENT STATION</span><h2>${title}</h2></div><button class="small-button" data-station-overview>← Plant overview</button></div>
  ${id === 'pumps' ? `<div class="station-pump-list" role="group" aria-label="Select a pump">${PUMPS.map(pump => `<button class="small-button" data-station-pump="${pump.id}" aria-pressed="false">${pump.tag} · ${pump.key}</button>`).join('')}</div>` : ''}
  <div class="station-health" role="status"><strong data-station-state></strong><span data-station-readings></span></div>
  <div class="station-workspace"><div class="station-viewport"><div class="station-scene" data-station-equipment="${id === 'pumps' ? 'pumpA' : id}"></div><p class="station-view-status" role="status" hidden></p><div class="station-camera-tools"><button class="small-button" data-station-camera="out" aria-label="Zoom equipment out">−</button><button class="small-button" data-station-camera="in" aria-label="Zoom equipment in">+</button><button class="small-button" data-station-camera="home">Reset view</button></div></div>
  <nav class="station-part-list" aria-label="Inspect ${title.toLowerCase()} parts">${id === 'electrical' ? `<div class="supply-switches">${feedSwitch('station-grid-supply', 'External grid available')}${feedSwitch('station-turbine-supply', 'Turbine auxiliary feed')}</div>` : ''}${parts.map(([key, name]) => `<button data-station-part="${key}" aria-haspopup="dialog" aria-expanded="false"><strong>${name}</strong><span data-station-part-reading="${key}"></span></button>`).join('')}<button data-station-inspect aria-haspopup="dialog" aria-expanded="false"><strong>${id === 'electrical' ? 'Supply & connections' : 'Controls, trends &amp; service'}</strong><span>${id === 'electrical' ? 'Source priority, available power and load' : 'Actual readings, disturbances and maintenance'}</span></button></nav></div>
  <p class="station-note">${id === 'electrical' ? 'Turbine → external grid → armed diesels. Select a source or bus to inspect. Engine motion and electrical markers follow actual supply. Restoring power never starts the reactor.' : 'Select a 3D part or a part button to open its controls. Solid levers show actual position; amber outlines show requests. Motion follows actual plant state.'}</p>
</section>`).join('');

export class EquipmentStations {
    constructor(host) {
        this.host = host; this.root = host.shadowRoot; this.selectedPump = 'pumpA';
        this.scenes = new Map(); this.visible = new Map(); this.unavailable = new Set(); this.triggers = new Map();
        this.root.addEventListener('change', event => {
            const method = { 'station-grid-supply': 'setGrid', 'station-turbine-supply': 'setTurbine' }[event.target.id];
            if (!method || host.companion || event.target.disabled) return;
            host.simulation.supply[method](host.simulation, event.target.checked); host.update();
        });
        this.root.addEventListener('click', event => {
            if (host.companion) return;
            const button = event.target.closest('[data-station-pump], [data-station-part], [data-station-inspect], [data-station-camera], [data-station-overview]');
            if (!button || button.disabled) return;
            if (button.dataset.stationPump) this.navigate(button.dataset.stationPump, false);
            else if (button.hasAttribute('data-station-overview')) { const id = host.plantTab === 'electrical' ? 'grid' : host.selectedEquipment; host.setPlantTab('reactor'); host.equipmentTrigger(id)?.focus({ preventScroll: true }); }
            else if (button.dataset.stationCamera) {
                const scene = this.scenes.get(host.plantTab); if (!scene) return;
                if (button.dataset.stationCamera === 'home') scene.resetCamera();
                else scene.setZoom(scene.zoom + (button.dataset.stationCamera === 'in' ? .15 : -.15));
            } else this.open(button.dataset.stationPart, button);
        });
    }
    panel(tab = this.host.plantTab) { return this.root.querySelector(`#${tab}-panel`); }
    equipment(tab = this.host.plantTab) { return tab === 'pumps' ? this.selectedPump : tab; }
    connect() {
        if (this.host.companion) return;
        this.observer?.disconnect();
        this.observer = new IntersectionObserver(entries => {
            for (const entry of entries) this.visible.set(entry.target.closest('.equipment-station').id.replace('-panel', ''), entry.isIntersecting);
            this.syncVisibility(); this.draw(); this.host.updateActivity();
        });
        for (const panel of this.root.querySelectorAll('.equipment-station')) this.observer.observe(panel.querySelector('.station-viewport'));
        this.activate();
    }
    disconnect() {
        this.observer?.disconnect();
        for (const scene of this.scenes.values()) scene.dispose();
        this.scenes.clear(); this.visible.clear(); this.triggers.clear();
    }
    canDraw(tab = this.host.plantTab) {
        return this.host.isConnected && !this.host.companion && this.host.plantTab === tab && this.visible.get(tab)
            && this.host.intersecting && !document.hidden && !this.unavailable.has(tab);
    }
    syncVisibility() { for (const [tab, scene] of this.scenes) scene.setVisible(Boolean(this.canDraw(tab))); }
    navigate(id, focus = true) {
        const tab = equipmentStation(id); if (!tab || this.host.companion) return;
        if (tab === 'pumps' && this.selectedPump !== id) {
            const previous = this.root.querySelector(`[data-component-dialog="${this.selectedPump}"]`);
            if (previous.dataset.stationControls) this.host.closeFloatingDialog(previous, false);
            this.selectedPump = id; this.scenes.get('pumps')?.dispose(); this.scenes.delete('pumps');
        }
        this.host.inspect(id, false); this.host.setPlantTab(tab);
        if (focus) this.root.querySelector(`#${tab}-tab`).focus({ preventScroll: true });
        this.host.update();
    }
    activate() {
        const tab = this.host.plantTab;
        if (!EQUIPMENT_STATIONS.some(station => station.id === tab) || this.host.companion) { this.syncVisibility(); return; }
        const panel = this.panel(), node = panel.querySelector('.station-scene');
        node.dataset.stationEquipment = this.equipment();
        const rect = panel.querySelector('.station-viewport').getBoundingClientRect();
        this.visible.set(tab, rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth);
        if (!this.scenes.has(tab) && !this.unavailable.has(tab)) {
            const Scene = tab === 'electrical' ? ElectricalGridScene : EquipmentStationScene;
            try { this.scenes.set(tab, new Scene(node, {
                inspect: part => this.open(part), unavailable: () => this.showUnavailable(tab), visible: Boolean(this.canDraw(tab)),
            })); } catch { this.showUnavailable(tab); }
        }
        this.syncVisibility(); this.scenes.get(tab)?.resize(); this.update();
    }
    showUnavailable(tab) {
        this.unavailable.add(tab); this.scenes.get(tab)?.dispose(); this.scenes.delete(tab);
        const panel = this.panel(tab); panel.querySelector('.station-scene').hidden = true;
        panel.querySelector('.station-camera-tools').hidden = true;
        const status = panel.querySelector('.station-view-status'); status.hidden = false;
        status.textContent = '3D equipment unavailable. Use the part buttons to operate, inspect and service this equipment.';
    }
    open(part, trigger) {
        const tab = this.host.plantTab, definition = EQUIPMENT_STATIONS.find(station => station.id === tab);
        if (!definition || this.host.companion) return;
        const id = this.equipment(), key = definition.parts.some(([key]) => key === part) ? part : null;
        if (tab === 'electrical') {
            const target = key?.startsWith('diesel') ? key : 'grid';
            this.triggers.set(target, trigger || this.panel().querySelector(key ? `[data-station-part="${key}"]` : '[data-station-inspect]'));
            if (target.startsWith('diesel')) this.host.openDiesel(target.slice(-1));
            else {
                this.host.openElectricalSupply();
                this.root.querySelector('.electrical-supply-dialog').dataset.stationControls = 'true';
                if (key === 'grid' || key === 'turbineFeed') this.root.querySelector(key === 'grid' ? '#grid-supply' : '#turbine-supply').focus({ preventScroll: true });
            }
            this.update(); return;
        }
        this.triggers.set(id, trigger || this.panel().querySelector(key ? `[data-station-part="${key}"]` : '[data-station-inspect]'));
        this.host.inspect(id);
        const dialog = this.root.querySelector(`[data-component-dialog="${id}"]`); dialog.dataset.stationControls = 'true';
        if (key) {
            const prefix = pumpDefinition(id) ? 'pump' : id === 'exchanger' ? 'hx' : 'generation';
            dialog.querySelector(`[data-${prefix}-select="${key}"]`)?.click();
            dialog.querySelector('input[data-component-setting]:not([type="checkbox"]):not([disabled])')?.focus({ preventScroll: true });
        }
        this.host.positionFloatingDialog(dialog);
        this.update();
    }
    trigger(id) {
        if (this.host.plantTab === 'electrical' && ['grid', 'bus', 'turbineFeed', 'dieselA', 'dieselB'].includes(id)) return this.triggers.get(id.startsWith('diesel') ? id : 'grid') || this.panel().querySelector('[data-station-inspect]');
        const tab = equipmentStation(id);
        if (this.host.plantTab !== tab || id !== this.equipment()) return null;
        return this.triggers.get(id) || this.panel().querySelector('[data-station-inspect]');
    }
    draw() {
        const tab = this.host.plantTab;
        if (!this.canDraw(tab)) return;
        this.scenes.get(tab)?.update(this.host.simulation, this.host.processMotion, tab === 'electrical' ? this.host.dieselMotion : this.host.motion, this.host.dataset.theme);
    }
    update() {
        const tab = this.host.plantTab, panel = this.panel();
        if (!panel?.classList.contains('equipment-station')) return;
        if (tab === 'electrical') { this.updateElectrical(panel); this.draw(); return; }
        const id = this.equipment(), sim = this.host.simulation, item = sim.components.items[id], pump = pumpDefinition(id);
        const state = pump ? `${pump.tag} / ${pump.circuit} ${pump.backup ? 'backup ' : ''}pump · ${item.actual.speed > .5 ? 'Motor running' : 'Motor stopped'}`
            : tab === 'turbine' ? `TG-01 · ${item.actual.shaftSpeed.toFixed(1)}% shaft speed · ${sim.components.turbineIntegrity.damage.toFixed(1)}% blade damage`
            : tab === 'exchanger' ? `HX-01 · ${item.actual.fouling.toFixed(1)}% fouling` : `C-01 · ${(item.actual.coolingFactor * 100).toFixed(1)}% cooling capacity`;
        setText(panel.querySelector('[data-station-state]'), state);
        const readings = pump ? `${item.actual.speed.toFixed(1)}% motor · ${item.actual.flow.toFixed(1)}% branch flow · ${item.actual.pressure.toFixed(1)}% differential pressure`
            : tab === 'turbine' ? `${sim.electricalOutput.toFixed(1)} MW · Breaker ${item.actual.breaker ? 'closed' : 'open'} · ${sim.components.turbineIntegrity.wear.toFixed(1)}% wear`
            : `${sim.secondaryTemperature.toFixed(1)} °C secondary hot · ${sim.secondaryReturnTemperature.toFixed(1)} °C return · ${sim.secondaryFlow.toFixed(1)}% secondary flow`;
        setText(panel.querySelector('[data-station-readings]'), readings);
        const dialog = this.root.querySelector(`[data-component-dialog="${id}"]`), open = dialog.matches(':popover-open');
        for (const button of panel.querySelectorAll('[data-station-part], [data-station-inspect]')) {
            button.setAttribute('aria-controls', dialog.id);
            button.setAttribute('aria-expanded', String(open && this.triggers.get(id) === button));
            const key = button.dataset.stationPart, reading = button.querySelector('[data-station-part-reading]');
            if (reading) {
                const requested = key === 'speed' ? sim[`${id}Speed`] : item.settings[key], actual = item.actual[key];
                const unit = key === 'speed' ? '%' : COMPONENT_SETTINGS[id]?.find(setting => setting.key === key)?.unit || '';
                const format = value => Number.isFinite(value) ? `${Number(value.toFixed(1))}${unit === '%' ? unit : unit ? ` ${unit}` : ''}` : '—';
                setText(reading, `${format(requested)} requested${Number.isFinite(actual) ? ` · ${format(actual)} actual` : ''}`);
            }
        }
        for (const button of panel.querySelectorAll('[data-station-pump]')) button.setAttribute('aria-pressed', String(button.dataset.stationPump === id));
        this.draw();
    }

    updateElectrical(panel) {
        const sim = this.host.simulation, supply = sim.supply;
        setText(panel.querySelector('[data-station-state]'), supply.source);
        setText(panel.querySelector('[data-station-readings]'), `${supply.demand.toFixed(2)} MW demand · ${supply.capacity.toFixed(2)} MW available · ${(supply.factor * 100).toFixed(0)}% auxiliary supply`);
        panel.querySelector('#station-grid-supply').checked = supply.gridAvailable;
        panel.querySelector('#station-turbine-supply').checked = supply.turbineConnected;
        for (const button of panel.querySelectorAll('[data-station-part], [data-station-inspect]')) {
            const key = button.dataset.stationPart, diesel = supply.generators.find(generator => `diesel${generator.id}` === key);
            const target = diesel ? key : 'grid';
            const dialog = this.root.querySelector(diesel ? `[data-diesel-dialog="${diesel.id}"]` : '.electrical-supply-dialog');
            button.setAttribute('aria-controls', dialog.id);
            button.setAttribute('aria-expanded', String(dialog.matches(':popover-open') && this.triggers.get(target) === button));
            const reading = button.querySelector('[data-station-part-reading]');
            if (reading) setText(reading, diesel ? `${diesel.state} · ${diesel.fuel.toFixed(0)}% fuel · ${diesel.load.toFixed(2)} MW`
                : key === 'grid' ? supply.gridAvailable ? supply.source.includes('GRID') ? 'SUPPLYING' : 'AVAILABLE' : 'ISOLATED'
                    : key === 'turbineFeed' ? `${supply.turbineConnected ? 'CONNECTED' : 'ISOLATED'} · ${sim.electricalOutput.toFixed(1)} MW gross`
                        : supply.factor > 0 ? `${supply.demand.toFixed(2)} MW supplied` : 'NO AC SUPPLY');
        }
    }
}
