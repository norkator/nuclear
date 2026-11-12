/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// Shared electrical source panel and independent diesel operator windows.
const rockerFace = `<span class="pump-rocker-face" aria-hidden="true"><span class="rocker-on">I <small>ON</small></span><span class="rocker-off">O <small>OFF</small></span></span>`;
const feedSwitch = (id, name) => `<label class="supply-feed-row" for="${id}"><span>${name}</span><span class="pump-rocker feed-rocker"><input id="${id}" type="checkbox" role="switch" checked/>${rockerFace}</span></label>`;
export function powerSourcePanel() {
    return `<section class="panel power-source-panel" aria-label="Pump power source"><div class="panel-heading"><h2>Pump power source</h2><button class="small-button" data-action="power-supply" aria-label="Open electrical supply connections" aria-haspopup="dialog" aria-controls="electrical-supply-window" aria-expanded="false">↗</button></div><div class="power-source-content"><strong data-value="powerSource"></strong><small data-value="auxiliaryLoad"></small><div class="power-source-generators">${['A','B'].map(id => `<button class="small-button" data-electrical-open="${id}" aria-haspopup="dialog" aria-controls="diesel${id}-window" aria-expanded="false">Diesel ${id}<small data-diesel-summary="${id}"></small></button>`).join('')}</div></div></section>`;
}

const supplyOverview = `<section class="supply-overview"><span class="control-label">PUMP POWER SOURCE</span><strong data-value="powerSource"></strong><span data-value="auxiliaryLoad"></span> <svg class="auxiliary-power-diagram electrical-bus" viewBox="0 0 300 165" role="img" aria-label="Simulated auxiliary power source and pump supply">
  ${[['turbine',8,'TURBINE'],['grid',108,'GRID'],['diesel',208,'DIESELS']].map(([id,x,label]) => `<g data-bus-source="${id}"><rect x="${x}" y="14" width="84" height="38" rx="5"/><text x="${x+42}" y="31" text-anchor="middle">${label}</text><text class="bus-source-state" data-source-state="${id}" x="${x+42}" y="44" text-anchor="middle"></text><path class="bus-wire" d="M${x+42} 52v24H150v19"/><path class="bus-flow" d="M${x+42} 52v24H150v19"/></g>`).join('')}
  <rect class="ac-bus-node" x="108" y="89" width="84" height="26" rx="4"/><text x="150" y="106" text-anchor="middle">AC BUS</text>
  <path class="bus-wire" d="M150 115v12H65v10m85-10h85v10"/><path class="bus-pump-flow" d="M150 115v12H65v10m85-10h85v10"/>
  <rect class="bus-pump-node" x="20" y="137" width="90" height="22" rx="4"/><text x="65" y="152" text-anchor="middle">PUMPS A / A2</text><rect class="bus-pump-node" x="190" y="137" width="90" height="22" rx="4"/><text x="235" y="152" text-anchor="middle">PUMPS B / B2</text>
 </svg><div class="supply-switches">${feedSwitch("grid-supply", "External grid available")}${feedSwitch("turbine-supply", "Turbine auxiliary feed connected")}</div><p>Turbine → grid → armed diesels. Pumps need AC; restoring supply never restarts the reactor.</p></section>`;
const dieselCard = id => `<section class="diesel-card" data-diesel="${id}"><div class="diesel-title"><span class="diesel-symbol">ϟ</span><h3>Diesel ${id}</h3><strong data-diesel-value="${id}-state"></strong></div><div class="diesel-visual-status" data-diesel-visual-status="${id}"></div><div class="diesel-meter"><i data-diesel-meter="${id}"></i></div><dl><div><dt>Fuel reserve</dt><dd data-diesel-value="${id}-fuel"></dd></div><div><dt>Bus load / capacity</dt><dd data-diesel-value="${id}-load"></dd></div><div><dt>Startup</dt><dd data-diesel-value="${id}-startup"></dd></div></dl><label><input type="checkbox" data-diesel-auto="${id}" checked/> Automatic standby</label><div class="diesel-run-control"><span>Engine run switch</span><button class="pump-rocker diesel-run-switch" data-generator="${id}" data-generator-action="start" role="switch" aria-checked="false" aria-label="Diesel ${id} run switch">${rockerFace}</button></div><button class="small-button" data-generator="${id}" data-generator-action="refuel">Refuel diesel</button></section>`;

export function electricalDialogs() {
    return `<section id="electrical-supply-window" class="electrical-supply-dialog equipment-dialog floating-dialog" popover="manual" role="dialog" aria-modal="false" aria-labelledby="electrical-supply-title"><div class="core-dialog-titlebar" tabindex="0" aria-label="Move electrical supply with arrow keys or drag"><h2 id="electrical-supply-title">Electrical supply &amp; connections</h2><button class="small-button" data-electrical-close aria-label="Close electrical supply">×</button></div><div class="equipment-dialog-body">${supplyOverview}<p class="component-description">Select each diesel in the plant or source panel to open its own controls. Restoring AC never restarts the reactor or resets a trip.</p></div></section>
    ${['A','B'].map(id => `<section id="diesel${id}-window" class="diesel-dialog equipment-dialog floating-dialog" data-diesel-dialog="${id}" popover="manual" role="dialog" aria-modal="false" aria-labelledby="diesel${id}-title"><div class="core-dialog-titlebar" tabindex="0" aria-label="Move Diesel ${id} with arrow keys or drag"><h2 id="diesel${id}-title">DG-${id} / Backup diesel ${id}</h2><button class="small-button" data-electrical-close aria-label="Close diesel ${id}">×</button></div><div class="equipment-dialog-body">${dieselCard(id)}<p class="component-description">Manual Stop disables automatic standby. Re-arm standby when wanted. Refuel only while stopped. Demo startup: 8 seconds.</p></div></section>`).join('')}`;
}

export function initializeElectrical(host) {
    host.shadowRoot.addEventListener('click', event => {
        const open = event.target.closest('[data-electrical-open]');
        if (open) {
            if (open.dataset.electricalOpen === 'supply') host.openElectricalSupply();
            else host.openDiesel(open.dataset.electricalOpen);
        }
        const close = event.target.closest('[data-electrical-close]');
        if (close) host.closeFloatingDialog(close.closest('.floating-dialog'));
    });
}
