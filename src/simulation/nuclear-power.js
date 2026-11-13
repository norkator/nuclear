/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { CORE_CHANNELS, NuclearPowerSimulation } from './nuclear-power-model.js';
import { advancePumpMotion, advanceProcessMotion, advanceInstrumentMotion, flowMarkerDistance, valveHandleAngle, SVG_FLOW_SCALE, createPolylinePath } from './nuclear-power-motion.js';
import styles from './nuclear-power.css?inline';
import { PlantAudio } from './nuclear-power-audio.js';
import { equipmentDialogs, initializeEquipment, updateEquipment, drawEquipmentMotion, exerciseDialog, initializeExercises, updateExercises } from './nuclear-power-equipment.js';
import lightStyles from './nuclear-power-light.css?inline';
import generationStyles from './nuclear-power-generation-console.css?inline';
import { PlantOverviewScene } from './nuclear-power-scene.js';
import { powerSourcePanel, electricalDialogs, initializeElectrical } from './nuclear-power-electrical.js';
import { loopTemperatures, temperatureColor } from './nuclear-power-temperature.js';
import { gridDispatchCapacity } from './nuclear-power-grid.js';
import { maintenancePanel, coreDamagePanel, initializeMaintenance, updateMaintenance } from './nuclear-power-maintenance.js';
import { FuelTransferAnimation } from './nuclear-power-refuelling.js';
import { spentFuelDialog, initializeSpentFuel, updateSpentFuel } from './nuclear-power-spent-fuel.js';
import { formatNumber, formatPercent, hasPlantMotion, setText } from './nuclear-power-presentation.js';
import { PUMPS, CIRCUITS, pumpDefinition, PRESSURE_LIMIT, PRESSURE_WARNING, FLOW_SCALE, FLOW_DAMAGE_LIMIT } from './nuclear-power-pumps.js';
import { leakSources, waterJetPoint } from './nuclear-power-leaks.js';
import { ELECTRICAL_TARGET_MAX_MW, TURBINE_RATING_MW } from './nuclear-power-turbine.js';
import { initializeCompanion, sessionControls, pairingDialog, updateSessionControls, publishSession, disconnectSession } from './nuclear-power-companion.js';
import companionStyles from './nuclear-power-companion.css?inline';
import { initializeGame, gameEntry, gamePanel, gameTasks, gameDialog } from './nuclear-power-game.js';
import gameStyles from './nuclear-power-game.css?inline';

const PLANT_TABS = ['reactor', 'maintenance'];
const STEAM_PATH = createPolylinePath([[610, 160], [790, 160], [790, 210]]);

const radiation = `<svg viewBox="0 0 40 40" fill="currentColor" aria-hidden="true"><circle cx="20" cy="20" r="3.4"/><path d="M16 13.1 12 6.2a16 16 0 0 1 16 0l-4 6.9a8 8 0 0 0-8 0ZM12 20H4a16 16 0 0 0 8 13.9l4-6.9a8 8 0 0 1-4-7Zm12 7 4 6.9A16 16 0 0 0 36 20h-8a8 8 0 0 1-4 7Z"/></svg>`;
// Explicit local (0,0) rotation avoids the asymmetric SVG bounding-box pivot.
const pumpRotor = `<g class="rotor" transform="rotate(0 0 0)">${[0, 120, 240].map(angle => `<path transform="rotate(${angle})" d="M0-18C13-18 19-9 6 0 6-10-3-9 0-18Z"/>`).join('')}</g><circle class="pump-hub" r="5"/>`;

const valveGlyph = (id, key, x, y, pipeAngle = 0) => `<g class="equipment-valve" data-valve-component="${id}" data-valve-key="${key}" data-pipe-angle="${pipeAngle}" transform="translate(${x} ${y})"><circle r="10"/><path transform="rotate(${pipeAngle})" d="M-12-6 0 0-12 6ZM12-6 0 0 12 6Z"/><g class="valve-handle"><path d="M-8 0h16"/></g></g>`;

const schematic = `
<svg class="schematic" viewBox="0 0 1000 640" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Interactive simulated reactor, parallel primary and secondary pumps, heat exchanger and turbine circuit">
 <defs>
  <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#263542" stroke-width=".6"/></pattern>
  <linearGradient id="vessel" x1="0" x2="1"><stop stop-color="#253642"/><stop offset=".45" stop-color="#435565"/><stop offset="1" stop-color="#23323e"/></linearGradient>
  <linearGradient id="coolant" x2="0" y2="1"><stop stop-color="#f7ab5b" stop-opacity=".16"/><stop offset="1" stop-color="#59cbbd" stop-opacity=".18"/></linearGradient>
  <linearGradient id="fuel" x2="0" y2="1"><stop stop-color="#ffd997"/><stop offset=".5" stop-color="#e79246"/><stop offset="1" stop-color="#ac5832"/></linearGradient>
  <radialGradient id="core-glow"><stop stop-color="#ffa35a" stop-opacity=".45"/><stop offset="1" stop-color="#ffa35a" stop-opacity="0"/></radialGradient>
  <radialGradient id="failure-glow"><stop stop-color="#ff443b" stop-opacity=".75"/><stop offset="1" stop-color="#ff443b" stop-opacity="0"/></radialGradient>
  <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V8" stroke="#52616c" stroke-width="2"/></pattern>
 </defs>
 <rect width="1000" height="640" fill="url(#grid)"/>
 <text x="30" y="33" class="drawing-label">P&amp;ID / UNIT 01</text><text x="970" y="33" text-anchor="end" class="drawing-label">SIMPLIFIED PROCESS DIAGRAM</text>

 <!-- Independent primary and secondary loops. Static pipework remains visible without flow. -->
 <path class="pipe-shell" d="M298 220H365V160H530M530 365H505V438M335 438H298V350"/>
 <path class="pipe hot" data-loop-segment="primaryHot" d="M298 220H365V160H530"/>
 <path class="pipe cold" data-loop-segment="primaryReturn" d="M530 365H505V438M335 438H298V350"/>
 <path class="flow primary hot-flow" data-loop-segment="primaryHot" d="M298 220H365V160H530"/>
 <path class="flow primary cold-flow" data-loop-segment="primaryReturn" d="M530 365H505V438M335 438H298V350"/>
 ${[['A', 'M505 438H335'], ['A2', 'M505 438V570H335V438']].map(([key, path]) => `<path class="pipe-shell" d="${path}"/><path class="pipe cold" data-loop-segment="primaryReturn" d="${path}"/><path class="flow primary pump-branch" data-pump-flow="${key}" data-loop-segment="primaryReturn" d="${path}"/>`).join('')}
 <path class="pipe-shell" d="M610 160H790V210M840 270V355M790 410V470H770M620 470H610V365"/>
 <path class="pipe steam" data-loop-segment="secondaryHot" d="${STEAM_PATH.d}"/>
 <path class="pipe cold" data-loop-segment="secondaryExhaust" d="M840 270V355"/><path class="pipe cold" data-loop-segment="secondaryReturn" d="M790 410V470H770M620 470H610V365"/>
 <path class="flow secondary steam-flow" data-loop-segment="secondaryHot" d="${STEAM_PATH.d}"/>
 <path class="flow secondary cold-flow" data-loop-segment="secondaryExhaust" d="M840 270V355"/><path class="flow secondary cold-flow" data-loop-segment="secondaryReturn" d="M790 410V470H770M620 470H610V365"/>
 ${[['B', 'M770 470H620'], ['B2', 'M770 470V570H620V470']].map(([key, path]) => `<path class="pipe-shell" d="${path}"/><path class="pipe cold" data-loop-segment="secondaryReturn" d="${path}"/><path class="flow secondary pump-branch" data-pump-flow="${key}" data-loop-segment="secondaryReturn" d="${path}"/>`).join('')}
 <g class="process-particles" aria-hidden="true">${Array.from({length: 6}, (_, i) => `<circle class="steam-particle" data-particle="${i}" r="2.5"/>`).join('')}</g>
 <path class="signal-line generator-export" d="M866 238H926V308"/><text x="926" y="329" text-anchor="middle" class="equipment-tag">GRID</text>
 <path d="m920 300 6 8 6-8" fill="none" stroke="#a9c5bf" stroke-width="2"/>

 <!-- Reactor vessel / rods and fuel channels. -->
 <g class="equipment" data-equipment="reactor" role="button" tabindex="0" aria-label="Open reactor core map" aria-haspopup="dialog" aria-controls="core-map-window" aria-expanded="false">
  <rect class="selection-ring" x="100" y="70" width="218" height="355" rx="30"/>
  <text x="208" y="63" text-anchor="middle" class="equipment-tag">R-01 / REACTOR VESSEL</text>
  <path d="M144 155Q144 105 208 105T272 155V345Q272 392 208 392T144 345Z" fill="url(#vessel)" stroke="#83929b" stroke-width="2"/>
  <path d="M155 161Q155 117 208 117T261 161V339Q261 379 208 379T155 339Z" fill="#152430" stroke="#647580"/>
  <path d="M155 161Q155 117 208 117T261 161V339Q261 379 208 379T155 339Z" fill="url(#coolant)"/>
  <ellipse class="core-glow" cx="208" cy="278" rx="100" ry="108" fill="url(#core-glow)"/>
  <g class="fuel-bundle" fill="url(#fuel)" stroke="#ffc785" stroke-width=".7">
   ${[170, 186, 202, 218, 234].map(x => `<rect x="${x}" y="230" width="12" height="112" rx="3"/>`).join('')}
  </g>
  <ellipse class="melt-pool" cx="208" cy="350" rx="48" ry="9" fill="#ff6043" opacity="0"/>
  <g class="fuel-drips" aria-hidden="true">${Array.from({length: 5}, (_,i) => `<ellipse data-fuel-drip="${i}" rx="2.5" ry="5"/>`).join('')}</g>
  <g stroke="#ffd29a" stroke-opacity=".35">${[250, 270, 290, 310, 330].map(y => `<path d="M168 ${y}h80"/>`).join('')}</g>
  <path d="M158 223h100M158 348h100" stroke="#98a7ac" stroke-width="5"/>
  <g class="rod-bank" fill="#bdccd2" stroke="#e4edf0" stroke-width=".6">
   ${Array.from({ length: 12 }, (_, index) => `<rect data-rod-side="CR-${String(index + 1).padStart(2, '0')}" x="${166 + index * 7}" y="95" width="4" height="150" rx="2"/>`).join('')}
  </g>
  <path d="M144 156h128M144 169h128" stroke="#94a5ae" stroke-width="3"/>
  <g fill="#c7d4d9">${[151, 172, 193, 214, 235, 256].map(x => `<rect x="${x}" y="155" width="5" height="15" rx="1"/>`).join('')}</g>
  <path d="M272 208h26v24h-26M272 338h26v24h-26" fill="url(#vessel)" stroke="#83929b" stroke-width="2"/>
  <path d="M165 383v27m86-27v27M151 410h28m58 0h28" stroke="#647580" stroke-width="6"/>
  <text x="208" y="447" text-anchor="middle" class="component-subtitle">BANK MEAN INSERTION</text>
  <text x="208" y="474" text-anchor="middle" class="diagram-value" data-value="rods">36.0%</text>
 </g>

 <!-- Core outlet and return instruments. -->
 <g class="instrument core-temperature-instrument" transform="translate(330 240)"><path d="M35-20V0"/><rect width="110" height="51" rx="5"/><text x="12" y="18" class="instrument-label">CORE OUTLET</text><text x="12" y="39" class="instrument-value loop-temperature-value" data-value="core">286.0 °C</text></g>
 <g class="instrument" transform="translate(325 349)"><path d="M40 51V89"/><rect width="110" height="51" rx="5"/><text x="12" y="18" class="instrument-label">CORE INLET</text><text x="12" y="39" class="instrument-value loop-temperature-value" data-value="return">258.0 °C</text></g>
 <text x="393" y="137" class="circuit-label warm">01 / PRIMARY</text>
 <path data-loop-segment="primaryHot" d="m464 155 8 5-8 5" class="arrow warm"/>
 <path data-loop-segment="primaryReturn" d="m369 433-8 5 8 5" class="arrow cool"/>

 <!-- Heat exchanger: separated hot and cold tube paths. -->
 <g class="equipment" data-equipment="exchanger" role="button" tabindex="0" aria-label="Inspect heat exchanger">
  <rect class="selection-ring" x="499" y="101" width="142" height="300" rx="22"/>
  <text x="570" y="88" text-anchor="middle" class="equipment-tag">HX-01</text>
  <rect x="522" y="124" width="96" height="270" rx="38" fill="url(#vessel)" stroke="#83929b" stroke-width="2"/>
  <rect x="533" y="140" width="74" height="236" rx="28" fill="#14232f" stroke="#5d6f79"/>
  <path data-loop-segment="primaryHot" d="M530 160h15v25h50v23h-50v23h50v23h-50v23h50v23h-50v23h50v23h-50v19h-15" fill="none" stroke="#d69a60" stroke-width="5"/>
  <path class="exchanger-heat-flow" d="M545 185h50v23h-50v23h50v23h-50v23h50v23h-50v23h50v23h-50"/>
  <g class="heat-transfer" aria-hidden="true">${[203,249,295,341].map(y => `<path d="M552 ${y}h34m-5-4 5 4-5 4"/>`).join('')}</g>
  <g class="exchanger-steam" aria-hidden="true">${Array.from({ length: 12 }, (_, index) => `<ellipse class="exchanger-steam-puff" data-steam-puff="${index}" rx="4" ry="6" opacity="0"/>`).join('')}</g>
  <path data-loop-segment="secondaryReturn" d="M610 365h-12V160h12" fill="none" stroke="#6ac9bc" stroke-width="4"/>
  <path d="M531 152v217" stroke="#e4edf0" stroke-opacity=".2" stroke-width="2"/>
  <path class="exchanger-bypass" data-loop-segment="primaryBypass" d="M530 160H490V365H530"/>
  ${valveGlyph('exchanger','bypass',490,270,90)}
  ${valveGlyph('exchanger','secondaryValve',610,190,90)}
  <text x="570" y="421" text-anchor="middle" class="component-subtitle">HEAT EXCHANGER</text>
 </g>

 <!-- Pump A, with animated impeller. -->
 <g class="equipment pump pump-a" data-equipment="pumpA" role="button" tabindex="0" aria-label="Inspect primary pump A">
  <rect class="selection-ring" x="424" y="402" width="72" height="74" rx="36"/>
  <circle cx="460" cy="438" r="28" fill="#172a34" stroke="#8fa2ab" stroke-width="2"/>
  <g transform="translate(460 438)">${pumpRotor}</g>
  ${valveGlyph('pumpA','dischargeValve',380,438)}
  <text x="460" y="495" text-anchor="middle" class="equipment-tag">P-01</text><text x="460" y="505" text-anchor="middle" class="pump-state" data-value="pumpA">RUNNING</text>
 </g>

 <!-- Steam turbine and generator. -->
 <text x="669" y="137" class="circuit-label warm">02 / SECONDARY</text>
 <g class="instrument" transform="translate(649 63)"><path d="M45 51v46"/><rect width="120" height="51" rx="5"/><text x="12" y="18" class="instrument-label">STEAM OUTLET</text><text x="12" y="39" class="instrument-value loop-temperature-value" data-value="secondary">184.0 °C</text></g>
 <g class="equipment turbine" data-equipment="turbine" role="button" tabindex="0" aria-label="Inspect turbine and generator">
  <rect class="selection-ring" x="739" y="187" width="146" height="106" rx="12"/>
  ${valveGlyph('turbine','admission',732,160)}
  <path d="m752 216 102-15v75l-102-15Z" fill="url(#vessel)" stroke="#8c9ca6" stroke-width="2"/>
  <g class="turbine-blades" stroke="#d7c7aa" stroke-width="3">${[767,784,801,818,835].map((x,i) => `<path data-turbine-blade="${i}" d="M${x} 218V258"/>`).join('')}</g>
  <g class="turbine-blade-fragments" aria-hidden="true">${Array.from({ length: 40 }, (_, index) => `<path data-turbine-fragment="${index}" d="M-2-6 3-5 2 6-2 4Z" visibility="hidden"/>`).join('')}</g>
  <path d="M742 238h132" stroke="#d2dcd9" stroke-width="3"/>
  <circle cx="898" cy="238" r="25" fill="#203c3d" stroke="#89b9ac" stroke-width="2"/><text x="898" y="245" text-anchor="middle" class="generator-letter">G</text>
  <g transform="translate(898 238)"><g class="generator-rotor" transform="rotate(0 0 0)" aria-hidden="true"><circle r="20"/><path d="M-20 0h40M0-20v40"/></g></g>
  <text x="805" y="315" text-anchor="middle" class="equipment-tag">TG-01 / TURBINE</text>
 </g>
 <g class="instrument" transform="translate(861 136)"><rect width="111" height="51" rx="5"/><text x="12" y="18" class="instrument-label">GENERATOR</text><text x="12" y="39" class="instrument-value cool" data-value="electric">262 MW</text></g>

 <!-- Condenser and return pump. -->
 <g class="equipment" data-equipment="condenser" role="button" tabindex="0" aria-label="Open condenser controls"><rect class="selection-ring" x="735" y="345" width="160" height="75" rx="12"/>
 <rect x="747" y="355" width="139" height="55" rx="9" fill="#1c303b" stroke="#7d96a1" stroke-width="2"/>
 <path d="M758 369h116m-116 12h116m-116 12h116" stroke="#6db7b3" stroke-width="3"/>
 ${valveGlyph('condenser','coolingValve',870,382)}
 <g class="condenser-drops" aria-hidden="true">${Array.from({length: 7}, (_,i) => `<path data-drop="${i}" d="M0-4Q-4 1 0 3Q4 1 0-4Z"/>`).join('')}</g>
 <text x="914" y="378" class="equipment-tag">C-01</text><text x="914" y="395" class="component-subtitle">CONDENSER</text>
 </g>
 <g class="equipment pump pump-b" data-equipment="pumpB" role="button" tabindex="0" aria-label="Inspect secondary pump B">
  <rect class="selection-ring" x="652" y="434" width="72" height="74" rx="36"/>
  <circle cx="688" cy="470" r="28" fill="#172a34" stroke="#8fa2ab" stroke-width="2"/>
  <g transform="translate(688 470)">${pumpRotor}</g>
  ${valveGlyph('pumpB','dischargeValve',735,470)}
  <text x="746" y="468" class="equipment-tag">P-02</text><text x="746" y="486" class="pump-state" data-value="pumpB">RUNNING</text>
 </g>
 <path data-loop-segment="secondaryReturn" d="m725 465-8 5 8 5" class="arrow cool"/>
 <g class="instrument" transform="translate(805 570)"><rect width="135" height="51" rx="5"/><text x="10" y="18" class="instrument-label">SECONDARY RETURN</text><text x="10" y="39" class="instrument-value loop-temperature-value" data-value="secondaryReturn"></text></g>
 ${[['A2', 420, 570, 375], ['B2', 688, 570, 735]].map(([key, x, y, valveX]) => `<g class="equipment pump pump-${key.toLowerCase()}" data-equipment="pump${key}" role="button" tabindex="0" aria-label="Inspect ${key === 'A2' ? 'primary' : 'secondary'} backup pump ${key}"><rect class="selection-ring" x="${x - 36}" y="${y - 36}" width="72" height="74" rx="36"/><circle cx="${x}" cy="${y}" r="28" fill="#172a34" stroke="#d1ab63" stroke-width="2"/><g transform="translate(${x} ${y})">${pumpRotor}</g>${valveGlyph(`pump${key}`, 'dischargeValve', valveX, y)}<text x="${x}" y="${y + 47}" text-anchor="middle" class="equipment-tag">${key === 'A2' ? 'P-03' : 'P-04'} / BACKUP</text><text x="${x}" y="${y + 58}" text-anchor="middle" class="pump-state" data-value="pump${key}">STOPPED</text></g>`).join('')}
 ${[['primary', 70, 510], ['secondary', 790, 500]].map(([circuit, x, y]) => `<g class="equipment pipe-inspection" data-equipment="${circuit}Pipes" role="button" tabindex="0" aria-label="Inspect ${circuit} pipework" transform="translate(${x} ${y})"><rect width="180" height="38" rx="5"/><text x="9" y="14" class="instrument-label">${circuit.toUpperCase()} PIPEWORK ↗</text><text x="9" y="30" class="instrument-value" data-value="${circuit}Pressure"></text></g>`).join('')}
 ${[['primaryPipes', 335, 438], ['secondaryPipes', 620, 470], ['pumpA', 380, 438], ['pumpA2', 375, 570], ['pumpB', 735, 470], ['pumpB2', 735, 570]].map(([id, x, y]) => `${id.endsWith('Pipes') ? `<circle class="equipment pipe-leak-hit" data-equipment="${id}" cx="${x}" cy="${y}" r="13" fill="transparent" role="button" tabindex="0" aria-label="Inspect ${id.startsWith('primary') ? 'primary' : 'secondary'} pipe joint"/>` : ''}<g class="water-leak" data-leak-source="${id}" transform="translate(${x} ${y})" aria-hidden="true"><path class="pipe-crack" d="m-6-5 4 4-3 4 6-2 3 5"/>${Array.from({ length: 14 }, (_, index) => `<ellipse class="water-leak-drop" data-leak-drop="${index}" rx="1.5" ry="2.7"/>`).join('')}</g>`).join('')}
</svg>`;



const coreMap = `<section class="core-map" aria-label="Top-down reactor core and individual control rods">
  <div class="core-map-heading"><span class="local-tag">R-01 / TOP-DOWN CORE MAP</span><span class="local-tag">FICTIONAL TWO-LOOP REACTOR</span></div>
  ${coreDamagePanel(CORE_CHANNELS.filter(channel => channel.rodId).map(channel => channel.rodId))}
  <div class="core-map-layout"><div class="core-map-drawing"><svg viewBox="0 0 500 500" class="core-map-svg" role="group" aria-label="Core channel map; select a numbered control rod">
    <circle cx="250" cy="250" r="227" class="core-vessel-outer"/><circle cx="250" cy="250" r="214" class="core-vessel-inner"/>
    <path d="M250 9v29m0 424v29M9 250h29m424 0h29" class="core-crosshair"/>
    ${CORE_CHANNELS.map(channel => `<g transform="translate(${250 + channel.x * 43} ${250 + channel.y * 43})" class="core-channel ${channel.rodId ? 'control-channel' : 'fuel-channel'}" ${channel.rodId ? `data-rod="${channel.rodId}" role="button" tabindex="0" aria-label="Select control rod ${channel.rodId}" aria-pressed="false"` : `data-fuel-x="${channel.x}" data-fuel-y="${channel.y}" data-fuel-id="${channel.fuelId}" role="button" tabindex="0" aria-label="Select fuel assembly ${channel.fuelId}" aria-pressed="false"`}>
      <rect x="-18" y="-18" width="36" height="36" rx="6"/>
      ${channel.rodId ? `<circle class="rod-depth-ring" r="14" transform="rotate(-90)"/><text text-anchor="middle" y="3.5">${channel.rodId.slice(3)}</text>` : '<title class="fuel-map-tooltip"></title><g class="fuel-exchange-glyph"><circle r="8" class="fuel-center"/><circle r="3" class="fuel-pin"/><circle r="14" class="fuel-reserve-ring" transform="rotate(-90)"/></g><g class="fuel-empty-marker" aria-hidden="true"><path d="M-6-13 6-1M6-13-6-1"/><text text-anchor="middle" y="12">EMPTY</text></g><text class="fuel-low-label" text-anchor="middle" y="4" aria-hidden="true"></text>'}
    </g>`).join('')}
  </svg><div class="core-map-legend"><span><i class="legend-dot"></i> Control rod / insertion ring</span><span><i class="legend-dot warm-dot"></i> Fuel / remaining reserve ring</span><span><i class="core-damage-key"></i> Red border = retained damage</span><span>× EMPTY = depleted · % = low reserve</span></div><p class="fuel-map-summary" data-value="fuelInventoryState" aria-live="polite"></p><div class="fuel-map-actions"><button class="control-button" data-action="replace-all-fuel" disabled>Replace all fuel</button><p data-value="fuelReplacementReadiness"></p><p class="fuel-service-status" role="status" data-value="fuelServiceStatus"></p></div></div>
  <section class="individual-rod" aria-label="Individual rod controls">
    <div class="eyebrow">INDIVIDUAL CONTROL ROD</div><label class="sr-only" for="rod-select">Selected control rod</label><select id="rod-select">${Array.from({ length: 12 }, (_, i) => `<option>CR-${String(i + 1).padStart(2, '0')}</option>`).join('')}</select>
    <div class="rod-depth-display"><div><span class="control-label">ACTUAL INSERTION</span><strong data-value="selectedRodActual">36.0%</strong><small data-value="selectedRodMotion">AT TARGET</small></div><div class="rod-depth-track"><i></i></div></div>
    <label for="individual-rod">Insertion target <strong data-value="selectedRodTarget">36%</strong></label><input id="individual-rod" type="range" min="0" max="100" step="1" value="36"/><div class="range-labels"><span>WITHDRAWN / 0%</span><span>INSERTED / 100%</span></div>
    <div class="button-pair"><button class="control-button compact" data-action="rod-withdraw">↑ Withdraw 1%</button><button class="control-button compact" data-action="rod-insert">↓ Insert 1%</button></div>
    <label class="rod-override"><input id="rod-override" type="checkbox"/> Manual override in Auto</label><p data-value="rodOwner"></p>
    <p>Override holds this rod under your control while Auto compensates with the others. Release it to return control to Auto. Stop and trip always insert every rod.</p>
    <dl><div><dt>Bank mean actual</dt><dd data-value="rods"></dd></div><div><dt>Core temperature</dt><dd data-value="core"></dd></div><div><dt>Local fuel temperature</dt><dd data-value="selectedZoneTemperature"></dd></div><div><dt>Channel damage</dt><dd data-value="selectedZoneDamage"></dd></div><div><dt>Control mode</dt><dd data-value="mode"></dd></div></dl>
  </section>
  <section class="individual-rod fuel-inspector" hidden aria-label="Selected fuel assembly">
    <div class="eyebrow">FUEL ASSEMBLY</div><h3 data-value="selectedFuelId"></h3><div class="rod-depth-display"><div><span class="control-label">REMAINING RESERVE</span><strong data-value="selectedFuelReserve"></strong><small data-value="selectedFuelState"></small></div></div>
    <dl><div><dt>Effectiveness</dt><dd data-value="selectedFuelEffectiveness"></dd></div><div><dt>Exposure</dt><dd data-value="selectedFuelExposure"></dd></div><div><dt>Replacements</dt><dd data-value="selectedFuelReplacements"></dd></div><div><dt>Core mean reserve</dt><dd data-value="fuelReserve"></dd></div><div><dt>Core capability</dt><dd data-value="fuelCapability"></dd></div></dl>
    <label for="fuel-rate">Fuel exposure speed</label><select id="fuel-rate"><option value="1">1× demo exposure</option><option value="10">10× demo exposure</option><option value="60">60× demo exposure</option></select><p>Six demo full-power hours consumes a fresh assembly at 1×. Exposure varies by channel and load. This is an accelerated illustration.</p>
    <button class="control-button" data-action="replace-fuel" disabled>Replace selected fuel</button><p data-value="fuelReplacementReadiness"></p><button class="small-button" data-action="select-control-rod">Back to control rods</button><p>Fuel replacement is always manual. Auto never replaces fuel.</p>
  </section></div><p class="core-map-note">Select a numbered control rod or an amber fuel assembly. Rings show actual insertion or remaining fuel reserve. Fictional layout and accelerated fuel model.</p>
</section>`;

const equipmentDetails = {
    reactor: { tag: 'R-01', name: 'Reactor vessel', description: 'Rod position sets simulated heat output. The primary loop carries heat to the exchanger.', fields: [['Core outlet', 'core'], ['Core inlet', 'return'], ['Rod insertion', 'rods']] },
    exchanger: { tag: 'HX-01', name: 'Heat exchanger', description: 'Transfers simulated heat between two separate circuits. Primary and secondary coolant remain separate.', fields: [['Primary inlet', 'core'], ['Primary return', 'return'], ['Secondary outlet', 'secondary']] },
    pumpA: { tag: 'P-01', name: 'Primary circulation', description: 'Circulates coolant through the reactor and heat exchanger. Rotation and flow follow actual speed, including coast-down.', fields: [['Pump state', 'pumpA'], ['Speed target', 'pumpATarget'], ['Actual speed', 'pumpAActual'], ['Primary flow', 'flow'], ['Stress', 'pumpAStress'], ['Damage', 'pumpADamage']] },
    pumpB: { tag: 'P-02', name: 'Secondary circulation', description: 'Returns cooled secondary coolant to the exchanger. Rotation and flow follow actual speed, including coast-down.', fields: [['Pump state', 'pumpB'], ['Speed target', 'pumpBTarget'], ['Actual speed', 'pumpBActual'], ['Secondary flow', 'secondaryFlow'], ['Stress', 'pumpBStress'], ['Damage', 'pumpBDamage']] },
    condenser: { tag: 'C-01', name: 'Condenser', description: 'Cooling water removes heat from the secondary loop. Valve position and inlet temperature affect cooling capacity.', fields: [['Secondary inlet', 'secondary'], ['Return to exchanger', 'secondaryReturn'], ['Secondary flow', 'secondaryFlow']] },
    turbine: { tag: 'TG-01', name: 'Turbine & generator', description: 'Converts a portion of simulated thermal output to electricity. Output responds to reactor load and secondary flow.', fields: [['Thermal output', 'thermal'], ['Electrical output', 'electric'], ['Actual load', 'load']] },
    ...Object.fromEntries(PUMPS.filter(pump => pump.backup).map(pump => [pump.id, { tag: pump.tag, name: `${pump.circuit === 'primary' ? 'Primary' : 'Secondary'} backup pump ${pump.key}`, description: 'Manually enabled parallel backup. It can replace the main pump or run alongside it. Both pumps at full speed can cause overpressure and retained damage.', fields: [['Pump state', pump.id], ['Speed target', `${pump.id}Target`], ['Actual speed', `${pump.id}Actual`], ['Branch flow', `${pump.id}Flow`], ['Stress', `${pump.id}Stress`], ['Damage', `${pump.id}Damage`]] }])),
    ...Object.fromEntries(CIRCUITS.map((circuit, index) => [`${circuit}Pipes`, { tag: `L-0${index + 1}`, name: `${circuit === 'primary' ? 'Primary' : 'Secondary'} pipework`, description: 'Shared circuit headers and pipes. Parallel pumps increase delivered flow and relative circulation pressure. Sustained overpressure damages pipework and causes water leaks.', fields: [['Pressure', `${circuit}Pressure`], ['Delivered flow', circuit === 'primary' ? 'flow' : 'secondaryFlow']] }])),
};

const flowMetric = (circuit, index) => `<article class="metric animated-metric flow-metric" data-instrument="${circuit === 'primary' ? 'flow' : 'secondaryFlow'}" data-circuit="${circuit}"><svg class="metric-motion" viewBox="0 0 60 42" aria-hidden="true"><path class="metric-flow-pipe" d="M4 12h52M4 30h52"/><circle class="metric-flow-particle" data-flow-dot="0" r="2.5"/><circle class="metric-flow-particle" data-flow-dot="1" r="2.5"/><circle class="metric-flow-particle" data-flow-dot="2" r="2.5"/><circle class="metric-flow-particle" data-flow-dot="3" r="2.5"/></svg><div class="metric-label"><span class="metric-icon cool">≋</span> ${circuit === 'primary' ? 'Primary' : 'Secondary'} flow <span class="channel">FI-0${index + 1}</span></div><div class="metric-reading"><span data-value="${circuit === 'primary' ? 'flowNumber' : 'secondaryFlowNumber'}">4,800</span><span class="unit">m³/h</span></div><div class="metric-flow-limit" title="Healthy-pipe flow at ${PRESSURE_LIMIT}% nominal differential pressure. Sustained excess damages pipework after 8 seconds. Leaks reduce delivered flow; the pressure reading remains authoritative.">Damage limit ≈ ${formatNumber(FLOW_DAMAGE_LIMIT)} m³/h</div><div class="metric-foot"><span><i class="status-dot" data-indicator="${circuit}"></i> <span data-value="${circuit}State">CIRCULATING</span></span><button class="flow-pressure" data-equipment="${circuit}Pipes" aria-label="Inspect ${circuit} pipework and pressure"><span data-value="${circuit}Pressure"></span> ↗</button></div><div class="metric-track"><i data-meter="${circuit === 'primary' ? 'flow' : 'secondaryFlow'}"></i></div></article>`;

const pumpRocker = key => `<button class="pump-rocker" data-action="pump${key}" role="switch" aria-checked="false" aria-label="Pump ${key} run switch" aria-describedby="pump-${key}-status"><span class="pump-rocker-face" aria-hidden="true"><span class="rocker-on">I <small>ON</small></span><span class="rocker-off">O <small>OFF</small></span></span></button>`;
const pumpSpeedControl = pump => `<div class="pump-control${pump.backup ? ' backup-pump-row' : ''}" data-pump-card="${pump.key}">
    <div class="pump-speed-setting">
      <div class="pump-speed-heading"><button class="pump-open" data-equipment="${pump.id}" aria-label="Inspect ${pump.backup ? 'backup ' : ''}pump ${pump.key}">${pump.backup ? 'Backup' : 'Pump'} ${pump.key} ↗</button><label class="regulator-display" for="pump-${pump.key}-speed"><span class="sr-only">${pump.circuit} ${pump.backup ? 'backup ' : ''}pump ${pump.key} speed target </span><span data-value="${pump.id}Target">100%</span></label></div>
      <div class="regulator-rail" style="--regulator-position:100%"><input id="pump-${pump.key}-speed" data-pump-speed="${pump.key}" type="range" min="0" max="100" step="1" value="100"/><div class="regulator-scale" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100%</span></div></div>
      <div class="pump-readback"><span class="pump-badge" id="pump-${pump.key}-status"><i class="pilot-lamp" aria-hidden="true"></i><span data-value="${pump.id}">STOPPED</span></span><span title="Actual motor speed">ACT <strong data-value="${pump.id}Actual">0%</strong></span><span data-value="${pump.id}Flow" title="Actual branch flow"></span></div>
    </div>${pumpRocker(pump.key)}
  </div>`;
const pumpControls = () => ['A', 'B'].map(key => {
    const { circuit } = pumpDefinition(key);
    return `<div class="pump-circuit">
      <div class="pump-circuit-heading"><span>${circuit === 'primary' ? 'Primary' : 'Secondary'} · Speed targets</span><button class="circuit-pressure" data-equipment="${circuit}Pipes" aria-label="Inspect ${circuit} pipework and pressure" title="Relative circulation pressure: 100% is nominal. Sustained pressure above 145% damages pipework."><span data-value="${circuit}Pressure"></span> ↗</button></div>
      ${PUMPS.filter(pump => pump.circuit === circuit).map(pumpSpeedControl).join('')}
    </div>`;
}).join('');

export class NuclearPowerConsole extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.simulation = new NuclearPowerSimulation();
        this.fuelTransfer = new FuelTransferAnimation(CORE_CHANNELS);
        this.selectedEquipment = 'reactor';
        this.selectedRod = 'CR-01';
        this.selectedFuel = null;
        this.logFilter = 'all';
        this.motion = Object.fromEntries(PUMPS.map(pump => [pump.key, { angle: 0, offset: 0, travel: 0 }]));
        this.dieselMotion = { A: 0, B: 0 };
        this.instrumentMotion = { thermal: 0, electrical: 0, flow: 0, secondaryFlow: 0 };
        this.processMotion = { speed: 0, angle: 0, steamPhase: 0, heatPhase: 0, supplyPhase: 0 };
        this.floatingDialogs = [];
        this.timer = null;
        this.animationFrame = null;
        this.overviewMode = '3d';
        this.sceneLabelMode = 'compact';
        this.plantTab = 'reactor';
        this.tripCoverOpen = false;
        this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
        this.intersecting = true;
        this.overviewIntersecting = true;
        this.onVisibilityChange = () => this.updateActivity();
        this.onViewportResize = () => this.shadowRoot.querySelectorAll('.floating-dialog').forEach(dialog => this.positionFloatingDialog(dialog));
    }

    connectedCallback() {
        if (!this.initialized) this.initialize();
        this.setOverview(this.overviewMode);
        this.setPlantTab(this.plantTab);
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        this.reducedMotion.addEventListener('change', this.onVisibilityChange);
        window.addEventListener('resize', this.onViewportResize);
        this.intersectionObserver = new IntersectionObserver(entries => {
            this.intersecting = entries[0].isIntersecting;
            this.updateActivity();
        });
        this.intersectionObserver.observe(this);
        this.overviewObserver = new IntersectionObserver(entries => {
            this.overviewIntersecting = entries[0].isIntersecting;
            this.overviewScene?.setVisible(this.overviewIntersecting);
            if (this.overviewIntersecting) {
                this.drawProcessMotion();
                if (this.overviewMode === 'schematic') this.updateSchematicState();
                this.updateOverview(true);
            }
        });
        this.overviewObserver.observe(this.shadowRoot.querySelector('.diagram-viewport'));
        this.updateActivity();
        this.update();
        this.game?.attach();
    }

    disconnectedCallback() {
        if (this.game) this.game.detaching = this.game.detach();
        disconnectSession(this);
        this.closeFloatingDialog(this.shadowRoot.querySelector('.game-dialog'), false);
        this.shadowRoot.querySelectorAll('.pairing-dialog').forEach(dialog => this.closeFloatingDialog(dialog, false));
        this.shadowRoot.querySelectorAll('.equipment-dialog').forEach(dialog=>this.closeFloatingDialog(dialog, false));
        this.closeCoreMap(false);
        this.closeFloatingDialog(this.shadowRoot.querySelector('.trends-dialog'), false);
        this.closeFloatingDialog(this.shadowRoot.querySelector('.meltdown-banner'), false);
        this.stopAlarmSound();
        clearInterval(this.timer);
        this.timer = null;
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
        this.dataset.animating = 'false';
        this.intersectionObserver?.disconnect();
        this.overviewObserver?.disconnect();
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
        this.reducedMotion.removeEventListener('change', this.onVisibilityChange);
        window.removeEventListener('resize', this.onViewportResize);
        this.overviewScene?.dispose();
        this.overviewScene = null;
    }

    initialize() {
        this.initialized = true;
        this.setAttribute('lang', 'en');
        this.shadowRoot.innerHTML = `<style>${styles}\n${lightStyles}\n${generationStyles}\n${companionStyles}\n${gameStyles}</style>
        <main class="console">
          <header class="masthead">
            <div class="brand-mark">${radiation}</div>
            <div class="heading"><div class="eyebrow">PÖRSSIOHJAIN / UNIT 01</div><h1>Nuclear Power<span class="title-dot">.</span></h1>${gameEntry}</div>
            <section class="header-control-card" aria-label="Plant control and display settings">
              <section class="automation-strip" aria-label="Process regulation">
            <div><span class="control-label">CONTROL MODE</span><div class="mode-switch" role="group" aria-label="Control mode"><button data-action="manual" aria-pressed="false">Manual</button><button data-action="auto" aria-pressed="true">Auto</button></div></div>
            <label for="auto-objective">Regulate <select id="auto-objective"><option value="power">Electrical output</option><option value="temperature">Core temperature</option></select></label>
            <label for="auto-electrical" class="electrical-target" hidden>Output target <span><input id="auto-electrical" type="number" min="0" max="${ELECTRICAL_TARGET_MAX_MW}" step="1" value="200"/> MW<span class="subscript">e</span></span></label>
            <label for="auto-temperature"><span data-value="temperatureLabel">Core target</span><span><input id="auto-temperature" type="number" min="40" step="1" value="286"/> °C</span></label>
            <label for="auto-flow">Circulation target <span><input id="auto-flow" type="number" min="25" max="100" step="1" value="85"/> %</span></label>
            <div class="regulation-status"><strong data-value="regulation">MANUAL CONTROL</strong><span data-value="regulationDetail">Individual rods and pump speeds available.</span><button class="small-button" data-action="fluctuations" aria-pressed="true">Fluctuations: On</button></div>
          </section>
              <div class="header-settings">${sessionControls}<div class="header-sound"><button class="small-button" data-action="sound" aria-pressed="false">Enable plant sounds</button><span class="ui-sound-status" role="status"></span></div><label class="theme-toggle"><input id="light-theme" type="checkbox" role="switch"/> Light theme</label><div class="session"><span class="simulation-badge"><i></i> SIMULATION</span><div class="session-clock" data-value="clock">T+00:00:00</div></div></div>
            </section>
          </header>

          ${gamePanel}
          <div class="console-layout">
          <aside class="instrument-column" aria-label="Plant instruments">
          <section class="metrics" aria-label="Simulated plant instruments">
            <article class="metric core-temperature-metric"><div class="metric-label"><span class="metric-icon warm">↗</span> Core temperature <span class="channel">TI-01</span></div><div class="metric-reading"><span data-value="coreNumber">286.0</span><span class="unit">°C</span></div><div class="metric-foot"><span><i class="status-dot"></i> <span data-value="temperatureState">WITHIN DEMO RANGE</span></span><span>SIMULATED</span></div><div class="metric-track warm-track"><i data-meter="temperature"></i></div></article>
            <article class="metric animated-metric thermal-metric" data-instrument="thermal"><svg class="metric-motion" viewBox="0 0 60 42" aria-hidden="true"><path class="thermal-base" d="M6 35h48"/><path class="metric-heat-wisp" data-wisp="0" d="M16 32q-7-5 0-10t0-10"/><path class="metric-heat-wisp" data-wisp="1" d="M30 32q-7-5 0-10t0-10"/><path class="metric-heat-wisp" data-wisp="2" d="M44 32q-7-5 0-10t0-10"/></svg><div class="metric-label"><span class="metric-icon warm">ϟ</span> Thermal output <span class="channel">PI-01</span></div><div class="metric-reading"><span data-value="thermalNumber">768</span><span class="unit">MW<span class="subscript">th</span></span></div><div class="metric-foot"><span><span data-value="load">64.0%</span> OF DEMO CAPACITY</span><span>SIMULATED</span></div><div class="metric-track warm-track"><i data-meter="power"></i></div></article>
            <article class="metric animated-metric electrical-metric" data-instrument="electrical"><svg class="metric-motion" viewBox="0 0 60 42" aria-hidden="true"><circle class="metric-electric-ring" cx="30" cy="21" r="16"/><g transform="translate(30 21)"><g class="metric-dynamo"><path d="M-12 0h24M0-12v24M-8-8 8 8M-8 8 8-8"/></g></g><path class="metric-electric-bolt" d="m32 8-10 15h8l-2 11 11-16h-8Z"/></svg><div class="metric-label"><span class="metric-icon cool">ϟ</span> Electrical output <span class="channel">EI-01</span></div><div class="metric-reading"><span data-value="electricNumber">262</span><span class="unit">MW<span class="subscript">e</span></span></div><div class="metric-foot"><span data-value="electricalTargetLabel">GENERATOR OUTPUT</span><span>SIMULATED</span></div><div class="metric-track"><i data-meter="electric"></i></div><div class="turbine-condition"><strong data-value="turbineCondition">TURBINE NORMAL</strong><span data-value="turbineWear">0% wear · 0% load</span></div></article>
            ${CIRCUITS.map(flowMetric).join('')}
            <article class="metric"><div class="metric-label"><span class="metric-icon cool">Ⅱ</span> Rod insertion <span class="channel">ZI-01</span></div><div class="metric-reading"><span data-value="rodsNumber">36.0</span><span class="unit">%</span></div><div class="metric-foot"><span>TARGET <span data-value="rodTarget">36%</span></span><span>SIMULATED</span></div><div class="metric-track"><i data-meter="rods"></i></div></article>
          </section>
          <details class="fault-console"><summary>Faults &amp; incident</summary><div><label for="fault-scenario">Simulated fault scenario</label><select id="fault-scenario"><option value="none">No injected fault</option><option value="primary-restriction">Primary-loop obstruction</option><option value="secondary-loss">Secondary cooling loss</option><option value="pump-wear">Primary pump deterioration</option></select><button class="small-button" data-action="clear-fault">Clear injected fault</button><button class="small-button" data-action="repair" disabled>Repair components</button><p>Stop, clear the fault and cool down to enable repair. Meltdown requires Reset demo.</p><p data-value="incidentSummary">No incident recorded.</p><button class="small-button" data-action="export-incident" disabled>Export incident report</button></div></details>
          ${powerSourcePanel()}
          <section class="panel grid-dispatch-panel" aria-label="Simulated grid controller"><div class="panel-heading"><h2>Grid controller</h2><span class="local-tag">SIMULATED</span></div><div class="grid-dispatch-content"><div class="grid-dispatch-controls"><label><input id="follow-grid" type="checkbox"/> Follow requests</label><button class="small-button" data-action="grid-request" disabled>Request now</button></div><strong data-value="gridStatus"></strong><p class="grid-dispatch-message" data-value="gridMessage" role="status" aria-live="polite"></p><span data-value="gridReadback"></span><span data-value="gridOperatingTargets"></span><span data-value="gridCapacity"></span><small data-value="gridNext"></small></div></section>
          </aside>

          <section class="control-column" aria-label="Reactor and operator controls">


          <div class="workspace">
            <section class="panel process-panel" aria-label="Plant overview">
              <div class="plant-tabs" role="tablist" aria-label="Plant overview"><button id="reactor-tab" role="tab" data-plant-tab="reactor" aria-controls="reactor-panel" aria-selected="true" tabindex="0">Reactor overview</button><button id="maintenance-tab" role="tab" data-plant-tab="maintenance" aria-controls="maintenance-panel" aria-selected="false" tabindex="-1">Maintenance <span class="maintenance-count">0</span></button></div>
              <div id="reactor-panel" role="tabpanel" aria-labelledby="reactor-tab">
              <div class="panel-heading"><div><span class="section-index">01</span><h2>Process view</h2></div><div class="diagram-tools"><button class="small-button" data-action="exercises" aria-controls="exercises-window" aria-expanded="false">Objectives &amp; scenarios</button><button class="small-button" data-action="core-view" aria-haspopup="dialog" aria-controls="core-map-window" aria-expanded="false">Core map ↗</button><button class="small-button" data-action="zoom" aria-label="Zoom process diagram" aria-pressed="false">Zoom +</button></div></div>
              <div class="annunciator" role="status"><span class="annunciator-icon">●</span><span data-value="annunciator">ALL SYSTEMS NORMAL</span><span class="plant-state" data-value="status">RUNNING</span></div>
              <div class="condition-strip" aria-label="Reactor condition"><strong data-value="conditionStage">NORMAL</strong><span>Fuel <b data-value="peakFuel"></b></span><span>Cooling margin <b data-value="coolingMargin"></b></span><span>Retained heat <b data-value="retainedHeat"></b></span><span>Rate <b data-value="temperatureRate"></b></span><span>Core damage <b data-value="coreDamage"></b></span><span>Pump stress <b data-value="pumpStress"></b></span></div>
              <p class="diagram-scroll-hint">Scroll sideways to explore · select equipment to inspect</p>
              <div class="overview-toolbar"><div class="mode-switch" role="group" aria-label="Reactor overview presentation"><button data-action="overview-3d" aria-pressed="true">3D cutaway</button><button data-action="overview-schematic" aria-pressed="false">Schematic</button></div><button class="small-button" data-action="spent-fuel" aria-haspopup="dialog" aria-controls="spent-fuel-window" aria-expanded="false">Spent fuel ↗</button><label class="scene-labels-control">Labels <select id="scene-labels" aria-label="3D equipment labels"><option value="off">Off</option><option value="compact" selected>Compact</option><option value="full">Full</option></select></label><span class="overview-status" role="status"></span><div class="scene-camera-tools" role="group" aria-label="3D camera"><button class="small-button" data-action="scene-zoom-out" aria-label="Zoom 3D view out">−</button><button class="small-button" data-action="scene-zoom-in" aria-label="Zoom 3D view in">+</button><button class="small-button" data-action="scene-home" aria-label="Reset 3D camera">Reset view</button></div></div>
              <div class="diagram-viewport" data-overview="3d" tabindex="0" aria-label="Interactive plant overview"><div class="plant-scene" aria-label="Low-poly reactor cutaway"></div>${schematic}</div>
              <div class="diagram-legend"><span><i class="temperature-scale" aria-hidden="true"></i> Loop temperature · 20 °C → 335+ °C</span><span><i class="legend-dot"></i> Simulated read-back</span><span class="diagram-note">Illustrative process · independent demo session</span></div>
              </div>
              ${maintenancePanel(equipmentDetails)}
            </section>

            <aside class="operator-column" aria-label="Operator console">
              <section class="panel operator-panel"><div class="panel-heading"><div><span class="section-index">02</span><h2>Operator console</h2></div><span class="local-tag">LOCAL</span></div>
                <div class="operator-content">
                  <div class="operation-state"><span><i class="status-dot" data-indicator="reactor"></i> REACTOR STATE</span><strong data-value="status">RUNNING</strong></div>
                  <div class="button-pair reactor-pushbuttons" role="group" aria-label="Reactor run controls"><button class="control-button hardware-button start-button" data-action="start" aria-label="Start reactor" aria-describedby="start-indication"><span class="hardware-face" aria-hidden="true">I</span><span class="hardware-label"><strong>Start</strong><span class="hardware-indication" id="start-indication"><i class="pilot-lamp" aria-hidden="true"></i><span data-value="startIndication">INTERLOCKED</span></span></span></button><button class="control-button hardware-button stop-button" data-action="stop" aria-label="Stop reactor" aria-describedby="stop-indication"><span class="hardware-face" aria-hidden="true">O</span><span class="hardware-label"><strong>Stop</strong><span class="hardware-indication" id="stop-indication"><i class="pilot-lamp" aria-hidden="true"></i><span data-value="stopIndication">STOPPED</span></span></span></button></div>
                  <section class="trip-recovery" hidden aria-label="Simulated trip recovery"><strong>SHUTDOWN RECOVERY</strong><ul></ul><button class="control-button reset-trip-button" data-action="reset-trip" disabled><span aria-hidden="true">↻</span> Reset trip <i class="pilot-lamp" aria-hidden="true"></i></button><p>Reset clears the latch. Then press Start to resume.</p></section>
                  <div class="setpoint"><label for="load"><span class="regulator-caption"><small>LR-01 / REACTOR LOAD</small><span>Load setpoint</span></span><strong class="regulator-display" data-value="demand">64%</strong></label><div class="regulator-rail" style="--regulator-position:64%"><input id="load" type="range" min="0" max="100" value="64" aria-label="Load setpoint" aria-describedby="load-owner"/><div class="regulator-scale" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100%</span></div></div><div class="load-trim-label"><span>FINE ADJUST</span><span id="load-owner" data-value="loadOwner">AUTO</span></div><div class="button-pair"><button class="control-button compact load-trim-button" data-action="load-down">− Decrease</button><button class="control-button compact load-trim-button" data-action="load-up">+ Increase</button></div></div>
                  <div class="rod-control"><div class="control-label">CONTROL RODS <span>IN <span data-value="rodTarget">36%</span></span></div><div class="button-pair"><button class="control-button compact" data-action="insert">↓ Insert</button><button class="control-button compact" data-action="withdraw">↑ Withdraw</button></div></div>
                  <div class="pump-controls">${pumpControls()}</div>
                  <section class="emergency-station" aria-label="Operator emergency shutdown" data-cover-open="false">
                    <div class="emergency-station-heading"><span>ESD-01 / REACTOR TRIP</span><span class="trip-latch-indicator"><i class="pilot-lamp" aria-hidden="true"></i><b data-value="tripLatch">ARMED</b></span></div>
                    <div class="emergency-guard">
                      <button type="button" class="emergency-cover-toggle" data-action="trip-cover" aria-label="Open emergency shutdown cover" aria-expanded="false" aria-controls="emergency-trip-button"><span class="emergency-cover-grip"><i aria-hidden="true"></i><span data-value="tripCoverAction">LIFT COVER ↑</span><i aria-hidden="true"></i></span></button>
                      <span class="emergency-cover-pane" aria-hidden="true"></span>
                      <button type="button" id="emergency-trip-button" class="emergency-button" data-action="trip" aria-label="Emergency shutdown" aria-pressed="false" aria-describedby="emergency-indication" disabled><span class="emergency-bezel" aria-hidden="true"><span class="emergency-stem"></span><span class="emergency-mushroom">TRIP</span></span><span class="emergency-label"><strong>Emergency shutdown</strong><small>INSERT ALL RODS</small><b id="emergency-indication" data-value="emergencyIndication">LIFT COVER TO ACCESS</b></span></button>
                    </div>
                    <p class="emergency-reset-note" data-value="emergencyResetNote">Operator only · Manual &amp; Auto</p>
                  </section>
                  <p class="control-note">Pilot lights show actual state · SIMULATED</p>
                </div>
              </section>
            </aside>
          </div>
          </section>
          <aside class="analysis-column" aria-label="Trends and event journal">
            ${gameTasks}
            <section class="panel trend-panel trend-display" role="button" tabindex="0" data-action="trends-view" aria-haspopup="dialog" aria-controls="trends-window" aria-expanded="false" aria-label="Open larger live trends chart"><div class="panel-heading"><div><span class="section-index">03</span><h2>Live trends ↗</h2></div><span class="local-tag">SIMULATED / 2 MIN</span></div>
              <div class="trend-legend"><span><i class="legend-dot warm-dot"></i> Core temperature <strong data-value="core">286.0 °C</strong></span><span><i class="legend-dot"></i> <span data-value="trendOutputLabel">Reactor output</span> <strong data-value="trendOutput">64.0%</strong></span><span class="target-legend" hidden><i class="legend-target"></i> Electrical target <strong data-value="electricalTarget"></strong></span></div>
              <svg class="trend-chart" viewBox="0 0 760 300" role="img" aria-label="Simulated temperature and reactor output over the last two minutes">
                <defs><linearGradient id="trend-fill" x2="0" y2="1"><stop stop-color="#efa35c" stop-opacity=".12"/><stop offset="1" stop-color="#efa35c" stop-opacity="0"/></linearGradient></defs>
                <g class="chart-grid"><path d="M40 40H715M40 145H715M40 250H715M40 40V250M208 40V250M377 40V250M546 40V250M715 40V250"/></g>
                <g class="chart-labels"><text x="0" y="22">°C</text><text x="725" y="22" data-value="chartOutputUnit">%</text><text x="0" y="44" data-value="chartTempMax">400</text><text x="0" y="149" data-value="chartTempMid">200</text><text x="12" y="254">0</text><text x="725" y="44" data-value="chartOutputMax">100</text><text x="731" y="149" data-value="chartOutputMid">50</text><text x="739" y="254">0</text><text x="40" y="282">−2 MIN</text><text x="355" y="282">−1 MIN</text><text x="675" y="282">NOW</text></g>
                <path class="trend-area"/><path class="temperature-trace"/><path class="power-trace"/><path class="target-trace"/><circle class="temperature-dot" r="3"/><circle class="power-dot" r="3"/>
              </svg><p class="trend-note">Trends build during this session. Both axes show simulated values.</p>
            </section>
            <section class="panel events-panel" aria-label="Simulation event log"><div class="panel-heading"><div><span class="section-index">04</span><h2>Event journal</h2></div><span class="event-count">0 EVENTS</span></div><div class="log-toolbar"><label for="log-filter">Show <select id="log-filter"><option value="all">All events</option><option value="operator">Operator</option><option value="automation">Automation</option><option value="process">Process readings</option><option value="alarm">Alarms</option><option value="system">System</option></select></label><span>Latest 200 events · this session</span><button class="small-button" data-action="export-log">↓ Export CSV</button></div><div class="alarm-list" aria-live="polite"></div><ol class="event-list" aria-label="Recent simulation events"></ol><button class="ack-button" data-action="acknowledge" disabled>✓ Acknowledge alarms</button></section>
          </aside>
          </div>
          <footer class="console-footer"><span><i class="status-dot"></i> <span data-value="sessionState">SIMULATION ACTIVE</span><span class="footer-divider">/</span> ALL SIGNALS SIMULATED</span><div><button data-action="meltdown-view" hidden class="footer-button" aria-controls="meltdown-window" aria-expanded="false">Meltdown incident ↗</button><button data-action="pause" class="footer-button">Ⅱ Pause</button><button data-action="reset" class="footer-button">↺ Reset demo</button></div><span class="footer-signature">PÖRSSIOHJAIN <span>NUCLEAR DIVISION</span></span></footer>
          <div id="core-map-window" class="core-dialog floating-dialog" popover="manual" role="dialog" aria-modal="false" aria-labelledby="core-map-title">
            <div class="core-dialog-titlebar" tabindex="0" aria-label="Move core map with arrow keys or drag this title bar"><span aria-hidden="true">⠿</span><h2 id="core-map-title">Reactor core map</h2><span class="local-tag">DRAG TO MOVE</span><button class="small-button" data-action="close-core" aria-label="Close core map">×</button></div>
            ${coreMap}
            <details class="reactor-equipment-detail equipment-content"><summary>Reactor vessel · equipment readings</summary><p>${equipmentDetails.reactor.description}</p><dl>${equipmentDetails.reactor.fields.map(([name,key])=>`<div><dt>${name}</dt><dd data-value="${key}"></dd></div>`).join('')}</dl></details>
          </div>
          ${pairingDialog}
          ${equipmentDialogs(equipmentDetails)}
          ${spentFuelDialog()}
          ${electricalDialogs()}
          ${exerciseDialog()}
          ${gameDialog}
          <div id="trends-window" class="trends-dialog floating-dialog" popover="manual" role="dialog" aria-modal="false" aria-labelledby="trends-window-title">
            <div class="core-dialog-titlebar" tabindex="0" aria-label="Move live trends with arrow keys or drag"><h2 id="trends-window-title">Live trends · enlarged</h2><button class="small-button" data-action="close-trends" aria-label="Close live trends">×</button></div>
            <div class="trend-display trends-dialog-content"></div>
          </div>
          <section id="meltdown-window" class="meltdown-banner floating-dialog" popover="manual" role="dialog" aria-modal="false" aria-labelledby="meltdown-window-title">
            <div class="core-dialog-titlebar" tabindex="0" aria-label="Move meltdown window with arrow keys or drag"><h2 id="meltdown-window-title">Meltdown incident</h2><button class="small-button" data-action="close-meltdown" aria-label="Close meltdown window">×</button></div>
            <div class="meltdown-content" role="alert">
            <strong class="meltdown-title">CORE MELTDOWN</strong>
            <p>SIMULATED · Incident recorded · Irreversible core damage</p>
            <p>Reset demo to start a new session. Export the incident before resetting.</p>
            <div><button class="control-button" data-action="export-incident">Export incident report</button> <button class="control-button" data-action="reset">↺ Reset demo</button></div>
          </div></section>
        </main>`;

        const expandedTrend = this.shadowRoot.querySelector('.trends-dialog-content');
        for (const selector of ['.trend-legend', '.trend-chart', '.trend-note']) {
            expandedTrend.append(this.shadowRoot.querySelector(`.trend-panel ${selector}`).cloneNode(true));
        }
        // Keep SVG paint-server identifiers unique inside the shared shadow root.
        expandedTrend.querySelector('#trend-fill').id = 'expanded-trend-fill';
        expandedTrend.querySelector('.trend-area').style.fill = 'url(#expanded-trend-fill)';

        initializeEquipment(this);
        initializeSpentFuel(this);
        initializeElectrical(this);
        initializeExercises(this);
        initializeMaintenance(this);
        this.shadowRoot.querySelector('#scene-labels').addEventListener('change', event => this.setSceneLabels(event.target.value));
        for (const trigger of this.shadowRoot.querySelectorAll('[data-equipment]:not([data-equipment="reactor"])')) {
            trigger.setAttribute('aria-haspopup', 'dialog');
            trigger.setAttribute('aria-controls', `equipment-${trigger.dataset.equipment}-window`);
            trigger.setAttribute('aria-expanded', 'false');
        }
        let savedTheme = 'dark';
        try { if (localStorage.getItem('porssiohjain.nuclear-power.theme') === 'light') savedTheme = 'light'; } catch { /* Storage can be disabled. */ }
        this.setTheme(savedTheme, false);
        this.shadowRoot.querySelector('#light-theme').addEventListener('change', event => this.setTheme(event.target.checked ? 'light' : 'dark'));
        this.shadowRoot.querySelector('#auto-objective').addEventListener('change', event => {
            this.simulation.setAutoObjective(event.target.value);
            this.update();
        });
        this.shadowRoot.querySelector('#auto-electrical').addEventListener('change', event => {
            if (!event.target.checkValidity() || event.target.value === '') { event.target.value = this.simulation.autoElectricalTarget; return; }
            this.simulation.setElectricalTarget(Number(event.target.value));
            this.update();
        });
        this.shadowRoot.querySelector('#follow-grid').addEventListener('change', event => {
            this.simulation.setGridDispatchEnabled(event.target.checked);
            this.update();
        });
        this.shadowRoot.querySelector('#fault-scenario').addEventListener('change', event => {
            this.simulation.injectFault(event.target.value);
            this.update();
        });

        this.shadowRoot.addEventListener('click', event => {
            const tab = event.target.closest('[data-plant-tab]');
            if (tab) this.setPlantTab(tab.dataset.plantTab);
            const fuel = event.target.closest('[data-fuel-id]');
            if (fuel) this.selectFuel(fuel.dataset.fuelId);
            const generator = event.target.closest('[data-generator-action]');
            if (generator && !generator.disabled) {
                this.simulation.supply.command(this.simulation, generator.dataset.generator, generator.dataset.generatorAction);
                this.update();
            }
            const rod = event.target.closest('[data-rod]');
            if (rod) this.selectRod(rod.dataset.rod);
            const equipment = event.target.closest('[data-equipment]');
            if (equipment) {
                this.inspect(equipment.dataset.equipment);
            }
            const button = event.target.closest('[data-action]');
            if (button && !button.disabled) this.act(button.dataset.action);
        });
        this.shadowRoot.addEventListener('keydown', event => {
            if (event.target.matches('[data-plant-tab]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const index = PLANT_TABS.indexOf(this.plantTab);
                const tab = event.key === 'Home' ? PLANT_TABS[0] : event.key === 'End' ? PLANT_TABS.at(-1) : PLANT_TABS[(index + (event.key === 'ArrowRight' ? 1 : -1) + PLANT_TABS.length) % PLANT_TABS.length];
                this.setPlantTab(tab);
                this.shadowRoot.querySelector(`[data-plant-tab="${tab}"]`).focus({ preventScroll: true });
            }
            if (event.target.matches('.trend-panel') && ['Enter', ' '].includes(event.key)) {
                event.preventDefault();
                this.act(event.target.dataset.action);
            }
            if (event.key === 'Escape') {
                const dialog = event.target.closest('.floating-dialog:popover-open') || this.floatingDialogs.at(-1);
                if (dialog) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.closeFloatingDialog(dialog);
                }
            }
            const rod = event.target.closest('[data-rod]');
            const fuel = event.target.closest('[data-fuel-id]');
            if (fuel && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                this.selectFuel(fuel.dataset.fuelId);
            }
            if (rod && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                this.selectRod(rod.dataset.rod);
            }
            const equipment = event.target.closest('[data-equipment]');
            if (equipment && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                this.inspect(equipment.dataset.equipment);
            }
        });
        this.shadowRoot.addEventListener('animationend', event => {
            if (event.animationName === 'fuel-exchange') event.target.closest('.fuel-channel')?.classList.remove('fuel-exchanging');
        });
        this.shadowRoot.querySelectorAll('.floating-dialog').forEach(dialog => this.configureFloatingDialogDrag(dialog));
        this.shadowRoot.querySelector('#rod-override').addEventListener('change', event => {
            this.simulation.setRodOverride(this.selectedRod, event.target.checked);
            this.update();
        });
        this.shadowRoot.querySelector('#fuel-rate').addEventListener('change', event => {
            this.simulation.fuel.setRate(this.simulation, Number(event.target.value));
            this.update();
        });
        for (const [id, method] of [['grid-supply', 'setGrid'], ['turbine-supply', 'setTurbine']]) {
            this.shadowRoot.querySelector(`#${id}`).addEventListener('change', event => {
                this.simulation.supply[method](this.simulation, event.target.checked);
                this.update();
            });
        }
        for (const input of this.shadowRoot.querySelectorAll('[data-diesel-auto]')) input.addEventListener('change', () => {
            this.simulation.supply.command(this.simulation, input.dataset.dieselAuto, 'auto');
            this.update();
        });
        this.shadowRoot.querySelector('#load').addEventListener('input', event => {
            event.target.closest('.regulator-rail').style.setProperty('--regulator-position', `${event.target.value}%`);
            // Update the requested setting immediately; journal once on commit.
            this.shadowRoot.querySelectorAll('[data-value="demand"]').forEach(element => { element.textContent = `${event.target.value}%`; });
        });
        this.shadowRoot.querySelector('#load').addEventListener('change', event => {
            this.simulation.setLoad(Number(event.target.value));
            this.update();
        });
        for (const input of this.shadowRoot.querySelectorAll('[data-pump-speed]')) {
            input.addEventListener('input', () => {
                input.closest('.regulator-rail').style.setProperty('--regulator-position', `${input.value}%`);
                this.shadowRoot.querySelector(`[data-value="pump${input.dataset.pumpSpeed}Target"]`).textContent = `${input.value}%`;
            });
            input.addEventListener('change', () => {
                this.simulation.setPumpSpeed(input.dataset.pumpSpeed, Number(input.value));
                this.update();
            });
        }
        this.shadowRoot.querySelector('#rod-select').addEventListener('change', event => this.selectRod(event.target.value));
        this.shadowRoot.querySelector('#individual-rod').addEventListener('input', event => {
            this.shadowRoot.querySelector('[data-value="selectedRodTarget"]').textContent = `${event.target.value}%`;
        });
        this.shadowRoot.querySelector('#individual-rod').addEventListener('change', event => {
            this.simulation.setRod(this.selectedRod, Number(event.target.value));
            this.update();
        });
        for (const id of ['auto-temperature', 'auto-flow']) {
            this.shadowRoot.querySelector(`#${id}`).addEventListener('change', event => {
                if (!event.target.checkValidity() || event.target.value === '') {
                    event.target.value = id === 'auto-temperature' ? this.simulation.autoTemperature : this.simulation.autoFlow;
                    return;
                }
                this.simulation.setAutoTargets(Number(this.shadowRoot.querySelector('#auto-temperature').value),
                    Number(this.shadowRoot.querySelector('#auto-flow').value));
                this.update();
            });
        }
        this.shadowRoot.querySelector('#log-filter').addEventListener('change', event => {
            this.logFilter = event.target.value;
            this.updateEvents();
        });
        this.shadowRoot.addEventListener('change', event => {
            const input = event.target;
            if (!input.matches('input, select') || input.disabled || !input.checkValidity()) return;
            if (input.dataset.component && this.componentMessages?.[input.dataset.component]) return;
            this.playUiSound(input.type === 'checkbox' ? input.checked ? 'on' : 'off' : 'adjust');
        });
        this.shadowRoot.addEventListener('click', event => {
            const button = event.target.closest('button');
            if (!button || button.disabled) return;
            const action = button.dataset.action;
            if (['start','stop','trip','sound','pause','reset'].includes(action)) return;
            if (pumpDefinition(action)) this.playUiSound(this.simulation[action] ? 'on' : 'off');
            else if (action === 'manual' || action === 'auto') this.playUiSound(this.simulation.autoMode ? 'on' : 'off');
            else if (action === 'fluctuations') this.playUiSound(this.simulation.fluctuationsEnabled ? 'on' : 'off');
            else if (button.classList.contains('diesel-run-switch')) this.playUiSound(button.getAttribute('aria-checked') === 'true' ? 'on' : 'off');
            else if (button.dataset.componentAction === 'toggle') this.playUiSound(this.simulation[button.dataset.component] ? 'on' : 'off');
            else this.playUiSound('adjust');
        });
        initializeCompanion(this);
        initializeGame(this);
        this.inspect('reactor', false);
    }

    setTheme(theme, persist = true) {
        this.dataset.theme = theme === 'light' ? 'light' : 'dark';
        this.shadowRoot.querySelector('#light-theme').checked = this.dataset.theme === 'light';
        if (persist) {
            try { localStorage.setItem('porssiohjain.nuclear-power.theme', this.dataset.theme); } catch { /* Theme still works without storage. */ }
        }
        this.updateOverview(true);
    }

    setOverview(mode) {
        if (this.companion) return;
        this.overviewMode = mode === 'schematic' ? 'schematic' : '3d';
        const viewport = this.shadowRoot.querySelector('.diagram-viewport');
        const host = viewport.querySelector('.plant-scene');
        if (this.overviewMode === '3d' && !this.overviewScene && !this.sceneUnavailable) {
            try {
                this.overviewScene = new PlantOverviewScene(host, {
                    inspect: key => this.inspect(key),
                    unavailable: () => this.fallbackOverview(),
                });
            } catch {
                this.fallbackOverview();
                return;
            }
        }
        if (this.sceneUnavailable) this.overviewMode = 'schematic';
        viewport.dataset.overview = this.overviewMode;
        this.shadowRoot.querySelector('.diagram-scroll-hint').textContent = this.overviewMode === '3d' ? 'Drag to orbit · use + / − to zoom · select equipment' : 'Scroll sideways to explore · select equipment to inspect';
        host.hidden = this.overviewMode !== '3d';
        viewport.querySelector('.schematic').setAttribute('aria-hidden', String(this.overviewMode === '3d'));
        for (const type of ['3d', 'schematic']) this.shadowRoot.querySelector(`[data-action="overview-${type}"]`).setAttribute('aria-pressed', String(type === this.overviewMode));
        this.shadowRoot.querySelector('.scene-camera-tools').hidden = this.overviewMode !== '3d';
        this.shadowRoot.querySelector('.scene-labels-control').hidden = this.overviewMode !== '3d';
        this.refreshOverviewVisibility();
        this.overviewScene?.setLabelMode(this.sceneLabelMode);
        const zoom = this.shadowRoot.querySelector('[data-action="zoom"]');
        zoom.hidden = this.overviewMode === '3d';
        zoom.setAttribute('aria-pressed', String(this.overviewMode === '3d' ? this.overviewScene?.zoom > 1 : viewport.classList.contains('zoomed')));
        zoom.textContent = zoom.getAttribute('aria-pressed') === 'true' ? 'Fit view' : 'Zoom +';
        this.overviewScene?.resize();
        this.drawProcessMotion();
        if (this.overviewMode === 'schematic') this.updateSchematicState();
        this.updateOverview(true);
        this.updateActivity();
    }

    fallbackOverview() {
        this.fuelTransfer.finish();
        this.sceneUnavailable = true;
        this.overviewScene?.dispose();
        this.overviewScene = null;
        this.shadowRoot.querySelector('[data-action="overview-3d"]').disabled = true;
        this.shadowRoot.querySelector('.overview-status').textContent = '3D unavailable · schematic active';
        this.setOverview('schematic');
    }

    setSceneLabels(mode) {
        this.sceneLabelMode = ['off', 'compact', 'full'].includes(mode) ? mode : 'compact';
        this.shadowRoot.querySelector('#scene-labels').value = this.sceneLabelMode;
        this.overviewScene?.setLabelMode(this.sceneLabelMode);
    }

    refreshOverviewVisibility() {
        // Explicit view/tab switches must refresh synchronously, including when
        // paused. The observer reports ordinary scrolling without frame-time reads.
        const rect = this.shadowRoot.querySelector('.diagram-viewport').getBoundingClientRect();
        this.overviewIntersecting = rect.width > 0 && rect.height > 0
            && rect.bottom > 0 && rect.top < window.innerHeight
            && rect.right > 0 && rect.left < window.innerWidth;
        this.overviewScene?.setVisible(this.overviewIntersecting);
    }

    updateOverview(force = false) {
        if (!this.isConnected || !this.intersecting || !this.overviewIntersecting || document.hidden) return;
        if (this.plantTab !== 'reactor' || this.overviewMode !== '3d' || !this.overviewScene) return;
        const sim = this.simulation;
        if (!hasPlantMotion(sim) && this.processMotion.speed <= .0001 && !this.fuelTransfer.job && !this.processMotion.turbineFragments?.some(fragment => fragment.age < 2.2)) {
            // The clock still ticks in a cold session. Redraw static geometry only
            // when its displayed readings, colors, valves or pool contents change.
            const signature = JSON.stringify([
                this.dataset.theme, this.selectedEquipment,
                [sim.temperature, sim.returnTemperature, sim.secondaryTemperature, sim.secondaryReturnTemperature].map(value => value.toFixed(1)),
                Object.values(loopTemperatures(sim)).map(temperatureColor),
                sim.controlRods.map(rod => rod.position.toFixed(2)),
                PUMPS.map(pump => [sim.components.items[pump.id].actual.dischargeValve, sim.condition.components[pump.key].damage,
                    ...Object.values(sim.condition.components[pump.key].parts)]),
                CIRCUITS.map(circuit => [sim.hydraulics.pipes[circuit].pressure.toFixed(1), sim.hydraulics.pipes[circuit].damage]),
                sim.components.items.exchanger.actual.bypass, sim.components.items.exchanger.actual.secondaryValve,
                sim.components.items.turbine.actual.admission, sim.components.items.condenser.actual.coolingValve,
                sim.components.turbineIntegrity.bladesLost, sim.components.turbineIntegrity.wear,
                sim.supply.source, sim.supply.factor, sim.supply.gridAvailable, sim.supply.demand.toFixed(2),
                sim.supply.generators.map(generator => [generator.state, generator.fuel.toFixed(0)]),
                this.fuelTransfer.pose.phase,
                this.fuelTransfer.samples.map(sample => sample && [sample.reference, this.fuelTransfer.dispatchReadiness(sample.reference).ready]),
            ]);
            if (!force && signature === this.idleOverviewSignature) return;
            this.idleOverviewSignature = signature;
        } else this.idleOverviewSignature = null;
        this.overviewScene.update(sim, this.processMotion, this.motion, this.selectedEquipment, this.dataset.theme, this.fuelTransfer, this.dieselMotion);
    }

    setPlantTab(tab) {
        this.plantTab = PLANT_TABS.includes(tab) ? tab : 'reactor';
        this.plantAudio?.setScene(this.plantTab);
        this.dataset.plantTab = this.plantTab;
        for (const name of PLANT_TABS) {
            const selected = this.plantTab === name;
            this.shadowRoot.querySelector(`#${name}-panel`).hidden = !selected;
            const button = this.shadowRoot.querySelector(`#${name}-tab`);
            button.setAttribute('aria-selected', String(selected));
            button.tabIndex = selected ? 0 : -1;
        }
        this.refreshOverviewVisibility();
        if (this.plantTab === 'reactor') this.overviewScene?.resize();
        this.drawProcessMotion();
        if (this.plantTab === 'reactor' && this.overviewMode === 'schematic') this.updateSchematicState();
        this.updateOverview(true);
        updateMaintenance(this);
        this.updateActivity();
        this.updateAlarmSound();
    }

    equipmentTrigger(key) {
        if (['dieselA', 'dieselB', 'grid', 'bus'].includes(key)) {
            if (this.plantTab !== 'reactor') return this.shadowRoot.querySelector(`#${this.plantTab}-tab`);
            return this.shadowRoot.querySelector(this.overviewMode === '3d' ? `[data-scene-equipment="${key}"]`
                : key.startsWith('diesel') ? `[data-electrical-open="${key.slice(-1)}"]` : '[data-action=power-supply]');
        }
        if (key === 'spentFuel' && this.plantTab !== 'reactor') return this.shadowRoot.querySelector(`#${this.plantTab}-tab`);
        if (key === 'spentFuel') return this.shadowRoot.querySelector(this.plantTab === 'reactor' && this.overviewMode === '3d'
            ? '[data-scene-equipment="spentFuel"]' : '[data-action="spent-fuel"]') || this.shadowRoot.querySelector('#reactor-tab');
        if (this.plantTab !== 'reactor') return this.shadowRoot.querySelector(`#${this.plantTab}-tab`);
        return this.shadowRoot.querySelector(this.overviewMode === '3d' ? `[data-scene-equipment="${key}"]` : `[data-equipment="${key}"]`);
    }

    selectRod(id) {
        if (!this.simulation.controlRods.some(rod => rod.id === id)) return;
        this.selectedRod = id;
        this.selectedFuel = null;
        this.shadowRoot.querySelector('#rod-select').value = id;
        this.update();
    }

    replaceFuelSelection(all, selectedId = this.selectedFuel) {
        if (this.companion) return this.sendSessionCommand({ method: all ? 'replaceAllFuel' : 'replaceFuel', args: all ? [] : [selectedId] });
        if (!this.fuelTransfer.hasCapacity) {
            this.fuelServiceStatus = 'Pool full. Dispatch cooled fuel to free a rack before replacement.';
            return false;
        }
        const ids = all ? this.simulation.fuel.assemblies.map(assembly => assembly.id) : [selectedId];
        const replaced = all ? this.simulation.replaceAllFuel() : this.simulation.replaceFuel(selectedId);
        if (!replaced) return false;
        const exampleId = ids.includes(selectedId) ? selectedId : ids[0];
        this.fuelTransfer.start(exampleId, ids.length, this.reducedMotion.matches || this.sceneUnavailable
            || this.overviewMode !== '3d' || this.plantTab !== 'reactor');
        this.fuelServiceStatus = all ? `All ${ids.length} fuel assemblies renewed. Reactor remains stopped.` : `${selectedId} renewed. Reactor remains stopped.`;
        this.fuelServiceStatus += ' One assembly represents this replacement in the crane view.';
        for (const [index, id] of ids.entries()) {
            const channel = this.shadowRoot.querySelector(`[data-fuel-id="${id}"]`);
            channel.classList.remove('fuel-exchanging');
            if (!this.reducedMotion.matches) {
                // Restart the illustrative removal/insertion if an operator repeats the action.
                void channel.getBoundingClientRect();
                channel.style.setProperty('--fuel-exchange-delay', `${Math.min(.6, index * .025)}s`);
                channel.classList.add('fuel-exchanging');
            }
        }
        return true;
    }

    selectFuel(id) {
        if (!this.simulation.fuel.assemblies.some(a => a.id === id)) return;
        this.selectedFuel = id;
        this.update();
    }

    openCoreMap() {
        if (this.companion) {
            this.shadowRoot.querySelector('[data-companion-view="core"]').click();
            return;
        }
        const dialog = this.shadowRoot.querySelector('.core-dialog');
        this.openFloatingDialog(dialog);
        this.shadowRoot.querySelector(this.selectedFuel ? '[data-action="replace-fuel"]' : '#rod-select').focus({ preventScroll: true });
    }

    closeCoreMap(restoreFocus = true) {
        this.closeFloatingDialog(this.shadowRoot?.querySelector('.core-dialog'), restoreFocus);
    }

    openElectricalSupply() {
        const dialog = this.shadowRoot.querySelector('.electrical-supply-dialog');
        this.openFloatingDialog(dialog);
        dialog.querySelector('.core-dialog-titlebar').focus({ preventScroll: true });
    }

    openDiesel(id) {
        if (!['A', 'B'].includes(id)) return;
        const dialog = this.shadowRoot.querySelector(`[data-diesel-dialog="${id}"]`);
        this.openFloatingDialog(dialog);
        dialog.querySelector(`[data-diesel-auto="${id}"]`).focus({ preventScroll: true });
    }

    openSpentFuel() {
        const dialog = this.shadowRoot.querySelector('.spent-fuel-dialog');
        this.openFloatingDialog(dialog);
        dialog.querySelector('.core-dialog-titlebar').focus({ preventScroll: true });
    }


    openFloatingDialog(dialog) {
        // Reopening an existing window brings it to the front without rebuilding its controls.
        if (dialog.matches(':popover-open')) dialog.hidePopover();
        dialog.showPopover();
        this.floatingDialogs = this.floatingDialogs.filter(item => item !== dialog);
        this.floatingDialogs.push(dialog);
        // Refresh before measuring/focusing a newly visible window, including while paused.
        if (dialog.classList.contains('core-dialog')) { this.updateCore(); updateMaintenance(this); }
        if (dialog.dataset.componentDialog) { updateEquipment(this); drawEquipmentMotion(this); }
        if (dialog.classList.contains('spent-fuel-dialog')) updateSpentFuel(this);
        if (dialog.classList.contains('exercises-dialog')) updateExercises(this);
        if (dialog.dataset.dieselDialog || dialog.classList.contains('electrical-supply-dialog')) { this.updateSupply(); this.drawSupplyMotion(); }
        if (dialog.classList.contains('trends-dialog')) this.updateTrend();
        this.positionFloatingDialog(dialog);
        for (const trigger of this.shadowRoot.querySelectorAll(`[aria-controls="${dialog.id}"]`)) trigger.setAttribute('aria-expanded', 'true');
    }

    closeFloatingDialog(dialog, restoreFocus = true) {
        if (!dialog?.matches(':popover-open')) return;
        dialog.hidePopover();
        if (dialog.classList.contains('core-dialog')) dialog.querySelectorAll('.fuel-exchanging').forEach(channel => channel.classList.remove('fuel-exchanging'));
        this.floatingDialogs = this.floatingDialogs.filter(item => item !== dialog);
        for (const trigger of this.shadowRoot.querySelectorAll(`[aria-controls="${dialog.id}"]`)) trigger.setAttribute('aria-expanded', 'false');
        if (restoreFocus && this.isConnected) {
            const trigger = dialog.classList.contains('game-dialog') ? this.shadowRoot.querySelector(this.game?.career ? '.game-entry [data-game-action="open"]' : '.game-entry [data-game-action="start"]') : dialog.dataset.dieselDialog ? this.equipmentTrigger(`diesel${dialog.dataset.dieselDialog}`) : dialog.classList.contains('electrical-supply-dialog') ? this.equipmentTrigger('grid') : dialog.classList.contains('spent-fuel-dialog') ? this.equipmentTrigger('spentFuel') : dialog.dataset.componentDialog ? this.equipmentTrigger(dialog.dataset.componentDialog) : dialog.classList.contains('core-dialog') ? this.equipmentTrigger('reactor') : this.shadowRoot.querySelector(dialog.classList.contains('exercises-dialog') ? '[data-action="exercises"]' : dialog.classList.contains('trends-dialog') ? '.trend-panel' : dialog.classList.contains('meltdown-banner') ? '[data-action="meltdown-view"]' : '[data-action="power-supply"]');
            trigger?.focus({ preventScroll: true });
        }
    }

    positionFloatingDialog(dialog, left, top) {
        if (!dialog?.matches(':popover-open')) return;
        const rect = dialog.getBoundingClientRect();
        const x = left ?? (dialog.style.left ? rect.left : dialog.classList.contains('core-dialog') ? innerWidth - rect.width - 20 : 20);
        const y = top ?? (dialog.style.top ? rect.top : dialog.classList.contains('core-dialog') ? 80 : 110);
        dialog.style.left = `${Math.max(12, Math.min(x, innerWidth - rect.width - 12))}px`;
        dialog.style.top = `${Math.max(12, Math.min(y, innerHeight - rect.height - 12))}px`;
    }

    configureFloatingDialogDrag(dialog) {
        const header = dialog.querySelector('.core-dialog-titlebar');
        let drag;
        header.addEventListener('pointerdown', event => {
            if (event.button !== 0 || event.target.closest('button')) return;
            this.openFloatingDialog(dialog);
            const rect = dialog.getBoundingClientRect();
            drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
            header.focus({ preventScroll: true });
            header.setPointerCapture(event.pointerId);
            event.preventDefault();
        });
        header.addEventListener('pointermove', event => {
            if (drag) this.positionFloatingDialog(dialog, drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
        });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) header.addEventListener(type, () => { drag = null; });
        header.addEventListener('keydown', event => {
            const deltas = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] };
            if (event.target !== header || !deltas[event.key]) return;
            event.preventDefault();
            const rect = dialog.getBoundingClientRect();
            this.positionFloatingDialog(dialog, rect.left + deltas[event.key][0], rect.top + deltas[event.key][1]);
        });
    }

    inspect(key, open = true) {
        if (key.startsWith('diesel')) { if (open) this.openDiesel(key.slice(-1)); return; }
        if (['grid', 'bus'].includes(key)) { if (open) this.openElectricalSupply(); return; }
        if (key === 'spentFuel') { if (open) this.openSpentFuel(); return; }
        if (!equipmentDetails[key]) return;
        this.selectedEquipment = key;
        this.shadowRoot.querySelectorAll('[data-equipment]').forEach(element => {
            element.classList.toggle('selected', element.dataset.equipment === key);
        });
        if (open) {
            if (key === 'reactor') this.openCoreMap();
            else {
                const dialog = this.shadowRoot.querySelector(`[data-component-dialog="${key}"]`);
                this.openFloatingDialog(dialog);
                dialog.querySelector('.core-dialog-titlebar').focus({ preventScroll: true });
            }
        }
        this.update();
    }

    async playUiSound(kind) {
        const allowed = () => this.soundEnabled && this.isConnected && this.intersecting && !document.hidden && !this.simulation.paused && (!this.companion || this.remoteReady);
        if (!allowed() || !this.plantAudio || !this.alarmAudio) return;
        const requestedAt = performance.now();
        try {
            if (this.alarmAudio.state !== 'running') await this.alarmAudio.resume();
            // Never replay a click delayed by autoplay restrictions or background suspension.
            if (allowed() && performance.now() - requestedAt < 500) this.plantAudio.ui(kind);
        } catch { /* UI sounds must not affect controls. */ }
    }

    act(action) {
        const sim = this.simulation;
        if (this.alarmAudio && this.soundEnabled) this.alarmAudio.resume().catch(() => {});
        const actions = {
            sound: () => {
                this.soundEnabled = !this.soundEnabled;
                if (this.soundEnabled) {
                    const Audio = window.AudioContext || window.webkitAudioContext;
                    if (Audio) {
                        this.alarmAudio ||= new Audio();
                        this.plantAudio ||= new PlantAudio(this.alarmAudio);
                        this.plantAudio.setScene(this.plantTab);
                        this.plantAudio.preloadUi().then(() => this.update());
                        this.plantAudio.preloadPlant().then(() => this.update());
                        this.plantAudio.preloadDiesels().then(() => this.update());
                        this.alarmAudio.resume().catch(() => {});
                    } else this.soundEnabled = false;
                }
                if (!this.soundEnabled) this.stopAlarmSound();
            },
            start: () => { const was = sim.running; sim.start(); if (!was && sim.running && this.soundEnabled && !sim.paused) this.plantAudio?.cue('start'); },
            stop: () => { const was = sim.running; sim.stop(); if (was && !sim.running && this.soundEnabled && !sim.paused) this.plantAudio?.cue('stop'); },
            'load-down': () => sim.setLoad(sim.demand - 5), 'load-up': () => sim.setLoad(sim.demand + 5),
            insert: () => sim.moveRods(5), withdraw: () => sim.moveRods(-5),
            pumpA: () => sim.togglePump('A'), pumpB: () => sim.togglePump('B'),
            pumpA2: () => sim.togglePump('A2'), pumpB2: () => sim.togglePump('B2'),
            'trip-cover': () => { this.tripCoverOpen = !this.tripCoverOpen; },
            trip: () => { if (this.tripCoverOpen) sim.trip(); }, acknowledge: () => sim.acknowledge(),
            'reset-trip': () => sim.resetTrip(),
            'rod-insert': () => sim.setRod(this.selectedRod, sim.controlRods.find(rod => rod.id === this.selectedRod).target + 1),
            'rod-withdraw': () => sim.setRod(this.selectedRod, sim.controlRods.find(rod => rod.id === this.selectedRod).target - 1),
            exercises: () => {this.openFloatingDialog(this.shadowRoot.querySelector('.exercises-dialog'));this.shadowRoot.querySelector('.exercises-dialog .core-dialog-titlebar').focus({preventScroll:true});},
            'core-view': () => this.openCoreMap(), 'close-core': () => this.closeCoreMap(),
            'replace-fuel': () => this.replaceFuelSelection(false),
            'replace-all-fuel': () => this.replaceFuelSelection(true),
            'select-control-rod': () => this.selectRod(this.selectedRod),
            'power-supply': () => this.openElectricalSupply(),
            'spent-fuel': () => this.openSpentFuel(),
            'trends-view': () => {
                this.openFloatingDialog(this.shadowRoot.querySelector('.trends-dialog'));
                this.shadowRoot.querySelector('.trends-dialog .core-dialog-titlebar').focus({ preventScroll: true });
            },
            'close-trends': () => this.closeFloatingDialog(this.shadowRoot.querySelector('.trends-dialog')),
            'close-meltdown': () => this.closeFloatingDialog(this.shadowRoot.querySelector('.meltdown-banner')),
            'meltdown-view': () => this.openFloatingDialog(this.shadowRoot.querySelector('.meltdown-banner')),
            manual: () => sim.setAutoMode(false), auto: () => sim.setAutoMode(true),
            fluctuations: () => sim.setFluctuations(!sim.fluctuationsEnabled),
            'export-log': () => this.exportLog(),
            'clear-fault': () => sim.injectFault('none'), repair: () => sim.repairComponents(),
            'export-incident': () => this.exportIncident(),
            pause: () => sim.togglePause(), reset: () => { if (this.game?.career) return; this.sessionGeneration = (this.sessionGeneration || 0) + 1; this.plantAudio?.stop(); this.fuelTransfer.reset(); this.spentFuelMessage = ''; this.tripCoverOpen = false; sim.reset(); },
            'overview-3d': () => this.setOverview('3d'),
            'overview-schematic': () => this.setOverview('schematic'),
            'scene-zoom-in': () => this.overviewScene?.setZoom(this.overviewScene.zoom + .15),
            'scene-zoom-out': () => this.overviewScene?.setZoom(this.overviewScene.zoom - .15),
            'scene-home': () => this.overviewScene?.resetCamera(),
            'grid-request': () => sim.requestGridDispatch(),
            zoom: () => {
                if (this.overviewMode === '3d') {
                    this.overviewScene?.setZoom(this.overviewScene.zoom > 1 ? 1 : 1.4);
                    const zoomed = this.overviewScene?.zoom > 1;
                    const button = this.shadowRoot.querySelector('[data-action="zoom"]');
                    button.textContent = zoomed ? 'Fit view' : 'Zoom +';
                    button.setAttribute('aria-pressed', String(zoomed));
                    return;
                }
                const viewport = this.shadowRoot.querySelector('.diagram-viewport');
                const zoomed = viewport.classList.toggle('zoomed');
                const button = this.shadowRoot.querySelector('[data-action="zoom"]');
                button.textContent = zoomed ? 'Fit view' : 'Zoom +';
                button.setAttribute('aria-pressed', String(zoomed));
                button.setAttribute('aria-label', zoomed ? 'Fit process diagram' : 'Zoom process diagram');
            }
        };
        actions[action]?.();
        this.updateActivity();
        this.update();
    }

    updateActivity() {
        const active = this.isConnected && this.intersecting && !document.hidden && !this.simulation.paused && (!this.companion || this.remoteReady);
        const remoteOperator = this.sessionStatus === 'connected' && this.connectedActiveScreens > 0;
        const clockActive = !this.companion && this.isConnected && !this.simulation.paused && (active || remoteOperator)
            && (!this.game?.career || this.game.owner);
        if (this.reducedMotion.matches && this.fuelTransfer.job) {
            this.fuelTransfer.finish();
            this.updateOverview();
        }
        this.dataset.animating = String(active);
        if (this.reducedMotion.matches) this.shadowRoot.querySelectorAll('.fuel-exchanging').forEach(channel => channel.classList.remove('fuel-exchanging'));
        if (!active) this.stopAlarmSound();
        if (!active) {
            // Pause keeps inspection windows open; hiding the feature closes them.
            if (!this.isConnected || !this.intersecting || document.hidden) {
                this.shadowRoot.querySelectorAll('.equipment-dialog, .game-dialog').forEach(dialog=>this.closeFloatingDialog(dialog, false));
                this.closeCoreMap(false);
                        this.closeFloatingDialog(this.shadowRoot.querySelector('.trends-dialog'), false);
                this.reopenMeltdown = this.simulation.condition.meltdown;
                this.closeFloatingDialog(this.shadowRoot.querySelector('.meltdown-banner'), false);
            }
        }
        if (clockActive && !this.timer) {
            this.lastTick = performance.now();
            this.timer = setInterval(() => {
                const now = performance.now();
                this.simulation.tick((now - this.lastTick) / 1000);
                this.lastTick = now;
                this.update(true);
            }, 250);
        } else if (!clockActive && this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        const animate = active && !this.reducedMotion.matches && this.hasVisualMotion();
        if (animate && !this.animationFrame) {
            this.lastFrame = performance.now();
            const frame = now => {
                const dt = (now - this.lastFrame) / 1000;
                // Cap presentation at 30 fps, independently of monitor refresh and plant ticks.
                if (dt >= 1 / 30 - .0005) {
                    this.lastFrame = now;
                    this.drawMotion(dt);
                }
                this.animationFrame = requestAnimationFrame(frame);
            };
            this.animationFrame = requestAnimationFrame(frame);
        } else if (!animate && this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    hasVisualMotion() {
        const sim = this.simulation;
        if (this.processMotion.turbineFragments?.some(fragment => fragment.age < 2.2)) return true;
        if (sim.power > .01 || sim.electricalOutput > .1 || sim.primaryFlow > .1 || sim.secondaryFlow > .1) return true;
        const processVisible = this.plantTab === 'reactor' || this.shadowRoot.querySelector('.equipment-dialog:popover-open');
        return !!processVisible && (hasPlantMotion(sim) || this.processMotion.speed > .0001
            || (this.plantTab === 'reactor' && this.overviewMode === '3d' && !!this.fuelTransfer.job));
    }

    drawMotion(seconds) {
        if (this.overviewIntersecting && this.plantTab === 'reactor' && this.overviewMode === '3d') this.fuelTransfer.advance(seconds);
        for (const pump of PUMPS) {
            const previous = this.motion[pump.key], actual = this.simulation.components.items[pump.id].actual;
            const flowMotion = advancePumpMotion(previous, actual.flow, seconds);
            const shaftMotion = advancePumpMotion(previous, actual.speed, seconds);
            this.motion[pump.key] = { angle: shaftMotion.angle, offset: flowMotion.offset,
                travel: (previous.travel || 0) + Math.min(.1, Math.max(0, seconds)) * actual.flow / 100 * 2 };
        }
        this.drawProcessMotion(seconds);
        drawEquipmentMotion(this);
        for (const generator of this.simulation.supply.generators) {
            const speed = generator.state === 'RUNNING' ? 360 : generator.state === 'STARTING' ? 120 : 0;
            this.dieselMotion[generator.id] = (this.dieselMotion[generator.id] + Math.min(.1, Math.max(0, seconds)) * speed) % 360;
        }
        this.drawInstrumentMotion(seconds);
        this.updateOverview();
    }

    drawInstrumentMotion(seconds = 0) {
        const sim = this.simulation;
        const nodes = this.instrumentMotionNodes ||= {
            cards: Object.fromEntries([...this.shadowRoot.querySelectorAll('[data-instrument]')].map(card => [card.dataset.instrument, card])),
            wisps: [...this.shadowRoot.querySelectorAll('.metric-heat-wisp')],
            dynamo: this.shadowRoot.querySelector('.metric-dynamo'),
            dots: [...this.shadowRoot.querySelectorAll('.metric-flow-particle')].map(dot => ({ dot,
                circuit: dot.closest('.flow-metric').dataset.instrument, index: Number(dot.dataset.flowDot) })),
        };
        this.instrumentMotion = advanceInstrumentMotion(this.instrumentMotion, {
            thermal: sim.power / 100, electrical: sim.electricalOutput / 410, flow: sim.primaryFlow / 100, secondaryFlow: sim.secondaryFlow / 100,
        }, seconds);
        for (const [kind, fraction] of Object.entries({ thermal: sim.power / 100, electrical: sim.electricalOutput / 410, flow: sim.primaryFlow / 100, secondaryFlow: sim.secondaryFlow / 100 })) {
            const card = nodes.cards[kind];
            const activity = Math.min(1, Math.max(0, fraction));
            card.style.setProperty('--instrument-strength', activity);
            card.style.setProperty('--instrument-phase', `${this.instrumentMotion[kind] * 160 - 30}%`);
            card.dataset.active = String(activity > .001);
        }
        for (const wisp of nodes.wisps) {
            const phase = (this.instrumentMotion.thermal + Number(wisp.dataset.wisp) / 3) % 1;
            wisp.setAttribute('transform', `translate(0 ${-phase * 13})`);
            wisp.style.opacity = Math.max(0, Math.min(1, sim.power / 100)) * Math.sin(phase * Math.PI);
        }
        nodes.dynamo.setAttribute('transform', `rotate(${this.instrumentMotion.electrical * 360} 0 0)`);
        for (const { dot, circuit, index } of nodes.dots) {
            const phase = (this.instrumentMotion[circuit] + index / 4) % 1;
            dot.setAttribute('cx', 8 + phase * 44);
            dot.setAttribute('cy', 21 + Math.sin(phase * Math.PI * 2) * 2);
        }
    }

    drawProcessMotion(seconds = 0, draw = true) {
        const sim = this.simulation;
        const motion = this.processMotion = advanceProcessMotion(this.processMotion, {
            temperature: sim.temperature, secondaryTemperature: sim.secondaryTemperature,
            primaryFlow: sim.primaryFlow, secondaryFlow: sim.secondaryFlow,
            fuelTemperature: sim.condition.peakTemperature,
            reactorPower: sim.running && !sim.tripped && !sim.condition.meltdown ? sim.power : 0,
            reactorActive: sim.running && !sim.tripped && !sim.condition.meltdown,
            reactorRods: sim.controlRods,
            reactorFuelCapability: sim.fuel.capability,
            shaftSpeed: sim.components?.items.turbine.actual.shaftSpeed,
            turbineFragments: sim.components.turbineIntegrity.fragments,
            exchangerTransferFactor: sim.components.items.exchanger.actual.transferFactor,
            condenserCoolingFactor: sim.components.items.condenser.actual.coolingFactor,
            condenserInletTemperature: sim.components.items.condenser.actual.inletTemperature,
            electricalOutput: sim.electricalOutput, supplyFactor: sim.supply.factor,
            leakActivity: Math.max(...leakSources(sim).map(source => source.rate)),
        }, seconds);
        if (!draw) return;
        if (this.overviewIntersecting && this.plantTab === 'reactor' && this.overviewMode === 'schematic') this.drawSchematicMotion();
        if (this.shadowRoot.querySelector('.electrical-supply-dialog').matches(':popover-open')) this.drawSupplyMotion();
    }

    drawSchematicMotion() {
        const sim = this.simulation, motion = this.processMotion;
        const root = this.shadowRoot.querySelector('.schematic');
        const nodes = this.schematicMotionNodes ||= {
            steam: root.querySelector('.steam-flow'),
            particles: [...root.querySelectorAll('.steam-particle')],
            segments: [...root.querySelectorAll('[data-loop-segment]')],
            flows: Object.fromEntries(CIRCUITS.map(circuit => [circuit, [...root.querySelectorAll(`.flow.${circuit}:not([data-pump-flow])`)]])),
            pumps: Object.fromEntries(PUMPS.map(pump => [pump.key, {
                rotor: root.querySelector(`.pump-${pump.key.toLowerCase()} .rotor`),
                branch: root.querySelector(`[data-pump-flow="${pump.key}"]`),
            }])),
            leaks: Object.fromEntries([...root.querySelectorAll('[data-leak-source]')].map(group => [group.dataset.leakSource, {
                crack: group.querySelector('.pipe-crack'), drops: [...group.querySelectorAll('[data-leak-drop]')],
            }])),
            rods: Object.fromEntries([...root.querySelectorAll('[data-rod-side]')].map(rod => [rod.dataset.rodSide, rod])),
            heatFlow: root.querySelector('.exchanger-heat-flow'), heatTransfer: root.querySelector('.heat-transfer'),
            puffs: [...root.querySelectorAll('.exchanger-steam-puff')],
            blades: [...root.querySelectorAll('[data-turbine-blade]')],
            fragments: [...root.querySelectorAll('[data-turbine-fragment]')],
            rotor: root.querySelector('.generator-rotor'), generatorExport: root.querySelector('.generator-export'),
            drops: [...root.querySelectorAll('[data-drop]')], glow: root.querySelector('.core-glow'),
            fuelDrips: [...root.querySelectorAll('[data-fuel-drip]')], meltPool: root.querySelector('.melt-pool'),
            valves: [...root.querySelectorAll('[data-valve-component]')].map(valve => ({ valve, handle: valve.querySelector('.valve-handle') })),
            bypass: root.querySelector('.exchanger-bypass'),
        };
        const temperatures = loopTemperatures(sim);
        for (const segment of nodes.segments) segment.style.stroke = temperatureColor(temperatures[segment.dataset.loopSegment]);
        for (const dot of nodes.particles) {
            dot.style.opacity = motion.steam;
            if (motion.steam <= 0) continue;
            const point = STEAM_PATH.pointAtDistance(flowMarkerDistance(motion.secondaryTravel * SVG_FLOW_SCALE, Number(dot.dataset.particle), nodes.particles.length, STEAM_PATH.length));
            dot.setAttribute('cx', point.x); dot.setAttribute('cy', point.y);
        }
        for (const circuit of CIRCUITS) {
            for (const path of nodes.flows[circuit]) path.style.strokeDashoffset = -(circuit === 'primary' ? motion.primaryTravel : motion.secondaryTravel) * SVG_FLOW_SCALE;
        }
        for (const pump of PUMPS) {
            const { rotor, branch } = nodes.pumps[pump.key];
            rotor.setAttribute('transform', `rotate(${this.motion[pump.key].angle} 0 0)`);
            branch.style.strokeDashoffset = -this.motion[pump.key].travel * SVG_FLOW_SCALE;
            branch.style.opacity = sim.components.items[pump.id].actual.flow > .1 ? 1 : 0;
        }
        for (const source of leakSources(sim)) {
            const leak = nodes.leaks[source.id], flowing = source.rate > .01;
            leak.crack.style.opacity = source.damage > 0 ? 1 : 0;
            if (!flowing) {
                if (leak.flowing !== false) for (const drop of leak.drops) drop.style.opacity = 0;
                leak.flowing = false;
                continue;
            }
            leak.flowing = true;
            for (const drop of leak.drops) {
                const point = waterJetPoint(motion.leakPhase || 0, Number(drop.dataset.leakDrop), 14, source.pressure);
                drop.setAttribute('cx', point.x * 32); drop.setAttribute('cy', -point.y * 32);
                drop.style.opacity = point.opacity;
            }
        }
        for (const rod of sim.controlRods) nodes.rods[rod.id].setAttribute('transform', `translate(0 ${-15 + rod.position * 1.12})`);
        nodes.steam.style.opacity = motion.steam;
        nodes.heatFlow.style.strokeDashoffset = -motion.heatPhase * 40;
        nodes.heatFlow.style.opacity = motion.heat;
        nodes.heatTransfer.style.opacity = motion.heat * (.55 + .45 * Math.sin(motion.heatPhase * Math.PI) ** 2);
        for (const puff of nodes.puffs) {
            if (motion.steam <= 0) { puff.setAttribute('opacity', 0); continue; }
            const index = Number(puff.dataset.steamPuff);
            const phase = (motion.steamPhase + index / 12) % 1;
            const turn = Math.min(1, Math.max(0, (phase - .72) / .28));
            puff.setAttribute('cx', (548 + index % 3 * 20 + Math.sin(phase * Math.PI * 2 + index) * 3) * (1 - turn) + 610 * turn);
            puff.setAttribute('cy', 345 - Math.min(1, phase / .8) * 185);
            puff.setAttribute('rx', 3 + Math.sin(phase * Math.PI) * 3);
            puff.setAttribute('ry', 4 + Math.sin(phase * Math.PI) * 5);
            puff.setAttribute('opacity', motion.steam * .55 * Math.sin(phase * Math.PI));
        }
        for (const blade of nodes.blades) {
            const i = Number(blade.dataset.turbineBlade);
            const half = (18 + i * 2) * Math.cos((motion.angle + i * 32) * Math.PI / 180);
            const x = 767 + i * 17;
            blade.setAttribute('d', `M${x - 3} ${238 - half}L${x + 3} ${238 + half}`);
            blade.style.visibility = i * 8 < sim.components.turbineIntegrity.bladesLost ? 'hidden' : 'visible';
        }
        for (const node of nodes.fragments) {
            const fragment = motion.turbineFragments?.[Number(node.dataset.turbineFragment)];
            node.style.visibility = fragment ? 'visible' : 'hidden';
            if (fragment) node.setAttribute('transform', `translate(${770 + Math.floor(fragment.blade / 8) * 17 + fragment.x * 24} ${238 - fragment.y * 24}) rotate(${fragment.spin})`);
        }
        nodes.rotor.setAttribute('transform', `rotate(${motion.angle} 0 0)`);
        nodes.generatorExport.style.strokeDashoffset = -motion.angle / 10;
        nodes.generatorExport.style.opacity = sim.electricalOutput > .1 ? 1 : .2;
        for (const drop of nodes.drops) {
            if (motion.steam <= 0) { drop.style.opacity = 0; continue; }
            const i = Number(drop.dataset.drop);
            const phase = (motion.steamPhase * 2 + i / 7) % 1;
            drop.setAttribute('transform', `translate(${766 + i * 17} ${363 + phase * 40})`);
            drop.style.opacity = motion.steam * Math.sin(phase * Math.PI);
        }
        const heatGlow = Math.min(1, Math.max(0, (sim.condition.peakTemperature - 100) / 550));
        const thermalPhase = motion.thermalPhase;
        nodes.glow.style.opacity = heatGlow * (.85 + .15 * Math.sin(thermalPhase * Math.PI * 2));
        for (const drop of nodes.fuelDrips) {
            if (sim.condition.meltProgress <= 0) { drop.style.opacity = 0; continue; }
            const i = Number(drop.dataset.fuelDrip);
            const phase = (thermalPhase + i / 5) % 1;
            drop.setAttribute('cx', 176 + i * 16);
            drop.setAttribute('cy', 290 + phase * 62);
            drop.style.opacity = sim.condition.meltProgress * Math.sin(phase * Math.PI);
        }
        if (sim.condition.meltProgress > 0) nodes.meltPool.style.fill = `hsl(${10 + 8 * Math.sin(thermalPhase * Math.PI * 2)} 100% 62%)`;
        for (const { valve, handle } of nodes.valves) {
            const actual = sim.components?.items[valve.dataset.valveComponent]?.actual[valve.dataset.valveKey] ?? 100;
            handle.setAttribute('transform', `rotate(${valveHandleAngle(actual, Number(valve.dataset.pipeAngle))} 0 0)`);
            valve.classList.toggle('restricted', actual < 25 && valve.dataset.valveKey !== 'bypass');
        }
        const bypass = sim.components?.items.exchanger.actual.bypass || 0;
        nodes.bypass.style.opacity = .12 + bypass / 100 * .88;
        nodes.bypass.style.strokeDashoffset = this.motion.A.offset;
    }

    updateSchematicState() {
        if (!this.overviewIntersecting) return;
        const condition = this.simulation.condition;
        for (const pump of PUMPS) {
            const glyph = this.shadowRoot.querySelector(`.pump-${pump.key.toLowerCase()}`);
            glyph.dataset.running = String(this.simulation.components.items[pump.id].actual.speed > .5);
            glyph.dataset.damaged = String(condition.components[pump.key].damage > 0);
        }
        const meltScale = 1 - condition.meltProgress * 0.25;
        this.shadowRoot.querySelector('.fuel-bundle').setAttribute('transform', `translate(0 ${350 * (1 - meltScale) + condition.meltProgress * 8}) scale(1 ${meltScale})`);
        this.shadowRoot.querySelector('.melt-pool').setAttribute('opacity', condition.meltProgress);
        this.shadowRoot.querySelector('.melt-pool').setAttribute('ry', 9 + condition.meltProgress * 15);
        for (const [i, channel] of [...this.shadowRoot.querySelectorAll('.fuel-bundle rect')].entries()) {
            const zones = condition.zones.slice(i * 2, i * 2 + 3);
            const temperature = Math.max(...zones.map(zone => zone.temperature));
            const heat = Math.min(1, Math.max(0, (temperature - 100) / 550));
            channel.style.fill = `hsl(${40 - heat * 35} 90% ${30 + heat * 40}%)`;
            channel.style.stroke = `hsl(${40 - heat * 35} 95% ${45 + heat * 40}%)`;
            const slump = condition.meltProgress * (8 + i * 3);
            channel.setAttribute('y', 230 + slump);
            channel.setAttribute('height', 112 - slump);
            channel.setAttribute('rx', 3 + condition.meltProgress * 3);
        }
        this.shadowRoot.querySelector('.melt-pool').setAttribute('rx', 38 + condition.meltProgress * 22);
    }

    drawSupplyMotion() {
        const sim = this.simulation, motion = this.processMotion, root = this.shadowRoot;
        const source = sim.supply.source;
        const dieselState = sim.supply.generators.some(generator => generator.state === 'STARTING') ? 'STARTING'
            : sim.supply.generators.some(generator => generator.state === 'RUNNING') ? 'RUNNING'
            : sim.supply.generators.some(generator => generator.automatic && generator.fuel > 0) ? 'STANDBY' : 'OFFLINE';
        const sourceStates = { turbine: sim.supply.turbineConnected ? 'CONNECTED' : 'ISOLATED', grid: sim.supply.gridAvailable ? 'AVAILABLE' : 'ISOLATED', diesel: dieselState };
        for (const item of root.querySelectorAll('[data-bus-source]')) {
            const active = source.includes({turbine: 'TURBINE', grid: 'GRID', diesel: 'BACKUP'}[item.dataset.busSource]);
            item.classList.toggle('energized', active);
            item.querySelector('.bus-flow').style.strokeDashoffset = -motion.supplyPhase * 36;
            const state = active ? 'SUPPLYING' : sourceStates[item.dataset.busSource];
            const label = item.querySelector('.bus-source-state');
            if (label.textContent !== state) label.textContent = state;
        }
        root.querySelector('.supply-overview').classList.toggle('unpowered', sim.supply.factor <= 0);
        root.querySelector('.bus-pump-flow').style.opacity = sim.supply.factor > 0 ? 1 : .15;
        root.querySelector('.bus-pump-flow').style.strokeDashoffset = -motion.supplyPhase * 36;
        root.querySelector('.electrical-bus').setAttribute('aria-label', `Simulated auxiliary power: ${source}; pump supply ${sim.supply.factor > 0 ? 'energized' : 'unavailable'}`);
    }

    stopAlarmSound(all = true) {
        for (const node of this.alarmNodes || []) {
            try { node.stop(); } catch { /* Already stopped. */ }
            node.disconnect();
        }
        this.alarmNodes = [];
        if (all) this.plantAudio?.stop();
        if (all) this.alarmAudio?.suspend().catch(() => {});
        this.nextAlarmAt = 0;
    }

    alarmSeverity() {
        const { condition, temperature, alarms } = this.simulation;
        if (condition.meltdown) return 5;
        if (condition.coreDamage >= 70 || condition.peakTemperature >= 600) return 4;
        if (condition.coreDamage >= 1 || condition.peakTemperature >= 450) return 3;
        if (temperature > 335 || condition.peakTemperature > 410) return 2;
        return alarms.some(alarm => !alarm.acknowledged) ? 1 : 0;
    }

    updateAlarmSound() {
        const sim = this.simulation;
        const meltdown = sim.condition.meltdown;
        const severity = this.alarmSeverity();
        const pending = sim.alarms.some(alarm => !alarm.acknowledged);
        const enabled = this.soundEnabled && this.isConnected && this.intersecting && !document.hidden && !sim.paused && (!this.companion || this.remoteReady);
        const button = this.shadowRoot.querySelector('[data-action="sound"]');
        button.textContent = this.soundEnabled ? 'Mute plant sounds' : 'Enable plant sounds';
        button.setAttribute('aria-pressed', String(!!this.soundEnabled));
        const audioStates = [this.plantAudio?.uiState, this.plantAudio?.plantState, this.plantAudio?.dieselState];
        this.shadowRoot.querySelector('.ui-sound-status').textContent = !this.soundEnabled ? ''
            : audioStates.includes('unavailable') ? 'Some sound files unavailable'
                : audioStates.every(state => state === 'ready') ? '' : 'Loading sounds…';
        if (!enabled) { this.stopAlarmSound(); return; }
        const context = this.alarmAudio;
        if (!context) return;
        if (context.state === 'suspended') { context.resume().catch(() => {}); return; }
        this.plantAudio?.updateScene(sim, this.plantTab);
        if (!pending && severity < 2) { this.stopAlarmSound(false); return; }
        const now = context.currentTime;
        const mode = meltdown ? 'meltdown' : ['quiet', 'attention', 'overheating', 'core-damage', 'critical'][severity];
        if (this.alarmMode !== mode) { this.nextAlarmAt = 0; this.alarmMode = mode; }
        if (now < (this.nextAlarmAt || 0)) return;
        this.alarmNodes = (this.alarmNodes || []).filter(node => {
            if (node.alarmEnd > now) return true;
            node.disconnect(); return false;
        });
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = severity >= 3 ? 'triangle' : 'sine';
        const low = 660 - severity * 28;
        const high = 880 + severity * 70;
        const volume = 0.045 + severity * 0.012;
        oscillator.frequency.setValueAtTime(low, now);
        oscillator.frequency.linearRampToValueAtTime(high, now + 0.35);
        oscillator.frequency.linearRampToValueAtTime(low, now + 0.7);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.03);
        gain.gain.setValueAtTime(volume, now + 0.55);
        gain.gain.linearRampToValueAtTime(0, now + 0.75);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.alarmEnd = now + 0.8;
        oscillator.onended = () => gain.disconnect();
        oscillator.start(now); oscillator.stop(now + 0.8);
        this.alarmNodes.push(oscillator);
        this.nextAlarmAt = now + [4, 3, 2, 1.3, 1, 0.85][severity];
    }

    update(fromTimer = false) {
        if (!this.initialized) return;
        const sim = this.simulation;
        if (this.lastProcessElapsed > sim.elapsed) {
            this.tripCoverOpen = false;
            this.fuelTransfer.reset();
            this.spentFuelMessage = '';
            this.plantAudio?.stop();
            this.componentMessages = {};
            this.revealScenario = false;
            this.fuelServiceStatus = '';
            this.shadowRoot.querySelectorAll('.fuel-exchanging').forEach(channel => channel.classList.remove('fuel-exchanging'));
            this.processMotion = { speed: 0, angle: 0, steamPhase: 0, heatPhase: 0, supplyPhase: 0 };
            this.dieselMotion = { A: 0, B: 0 };
            this.instrumentMotion = { thermal: 0, electrical: 0, flow: 0, secondaryFlow: 0 };
        }
        this.lastProcessElapsed = sim.elapsed;
        this.fuelTransfer.setPoolTime(sim.elapsed);
        if (sim.running || sim.condition.meltdown) this.fuelTransfer.cancel();
        const draw = !fromTimer || !this.animationFrame;
        this.drawProcessMotion(0, draw);
        if (draw) { this.drawInstrumentMotion(); this.updateOverview(); }
        const { signals, status } = sim.readings();
        this.classList.toggle('meltdown-active', sim.condition.meltdown);
        const meltdownDialog = this.shadowRoot.querySelector('.meltdown-banner');
        this.shadowRoot.querySelector('[data-action="meltdown-view"]').hidden = !sim.condition.meltdown;
        if (!sim.condition.meltdown) this.closeFloatingDialog(meltdownDialog, false);
        else if ((!this.meltdownShown || this.reopenMeltdown) && this.isConnected && this.intersecting && !document.hidden) {
            this.openFloatingDialog(meltdownDialog);
            this.meltdownShown = true;
            this.reopenMeltdown = false;
        }
        if (!sim.condition.meltdown) this.meltdownShown = false;
        this.updateAlarmSound();
        const n = formatNumber, percent = formatPercent;
        const selectedRod = sim.controlRods.find(rod => rod.id === this.selectedRod);
        const powerObjective = sim.autoObjective === 'power';
        const condition = sim.condition;
        const zone = condition.zones.find(zone => zone.id === this.selectedRod);
        const fuel = sim.fuel.assemblies.find(a => a.id === this.selectedFuel) || sim.fuel.assemblies[0];
        const fuelReadiness = sim.fuel.replacementReadiness(sim);
        const fuelPoolHasCapacity = this.companion ? this.remoteFuelService?.hasCapacity === true : this.fuelTransfer.hasCapacity;
        const rodBlocked = sim.tripped || !sim.running || (sim.autoMode && !selectedRod.manualOverride);
        const pumpState = (enabled, target, actual) => actual < 0.5 ? 'STOPPED' : !enabled || target === 0 || sim.supply.factor === 0 ? 'COASTING' : 'RUNNING';
        const values = {
            core: `${n(signals.coreTemperature.value, 1)} °C`, coreNumber: n(signals.coreTemperature.value, 1),
            return: `${n(signals.returnTemperature.value, 1)} °C`, secondary: `${n(signals.secondaryTemperature.value, 1)} °C`,
            secondaryReturn: `${n(signals.secondaryReturnTemperature.value, 1)} °C`,
            thermal: `${n(signals.thermalOutput.value)} MW`, thermalNumber: n(signals.thermalOutput.value),
            electric: `${n(signals.electricalOutput.value)} MW`, electricNumber: n(signals.electricalOutput.value),
            electricalTargetLabel: sim.autoObjective === 'power' ? `TARGET ${n(sim.autoElectricalTarget)} MW ELECTRIC` : 'GENERATOR OUTPUT',
            temperatureLabel: sim.autoObjective === 'power' ? 'Core limit' : 'Core target',
            trendOutputLabel: powerObjective ? 'Electrical output' : 'Reactor output',
            trendOutput: powerObjective ? `${n(signals.electricalOutput.value, 1)} MW` : `${n(sim.power, 1)}%`,
            electricalTarget: `${n(sim.autoElectricalTarget)} MW`,
            chartOutputUnit: powerObjective ? 'MW' : '%', chartOutputMax: powerObjective ? '400' : '100', chartOutputMid: powerObjective ? '200' : '50',
            flow: `${n(signals.primaryFlow.value)} m³/h`, flowNumber: n(signals.primaryFlow.value),
            rods: `${n(sim.rods, 1)}%`, rodsNumber: n(sim.rods, 1), rodTarget: percent(sim.rodTarget),
            load: `${n(sim.power, 1)}%`, demand: percent(sim.demand), status,
            loadOwner: sim.tripped ? 'TRIP LOCK' : sim.autoMode ? 'AUTO' : 'MANUAL',
            startIndication: sim.running ? 'RUNNING' : sim.startupReadiness().ready ? 'READY' : 'INTERLOCKED',
            stopIndication: sim.tripped ? 'TRIPPED' : sim.running ? 'AVAILABLE' : 'STOPPED',
            tripLatch: sim.tripped ? 'LATCHED' : 'ARMED',
            emergencyIndication: sim.tripped ? 'TRIP LATCHED' : this.tripCoverOpen ? 'PUSH TO TRIP' : 'LIFT COVER TO ACCESS',
            tripCoverAction: this.tripCoverOpen ? 'CLOSE COVER ↓' : 'LIFT COVER ↑',
            emergencyResetNote: sim.tripped ? 'Held down · use Reset trip after recovery' : 'Operator only · Manual & Auto',
            secondaryFlow: `${n(signals.secondaryFlow.value)} m³/h`, secondaryFlowNumber: n(signals.secondaryFlow.value),
            pumpA: pumpState(sim.pumpA, sim.pumpASpeed, sim.primaryFlow), pumpB: pumpState(sim.pumpB, sim.pumpBSpeed, sim.secondaryFlow),
            pumpATarget: percent(sim.pumpASpeed), pumpBTarget: percent(sim.pumpBSpeed),
            pumpAActual: `${n(sim.primaryFlow, 1)}%`, pumpBActual: `${n(sim.secondaryFlow, 1)}%`,
            selectedRodActual: `${n(selectedRod.position, 1)}%`, selectedRodTarget: percent(selectedRod.target),
            selectedRodMotion: Math.abs(selectedRod.target - selectedRod.position) < 0.5 ? 'AT TARGET' : selectedRod.target > selectedRod.position ? 'INSERTING' : 'WITHDRAWING',
            rodOwner: sim.autoMode ? selectedRod.manualOverride ? 'MANUAL OVERRIDE · Auto controls other rods' : 'AUTO OWNED · enable override to disturb regulation' : 'MANUAL CONTROL',
            selectedFuelId: fuel.id, selectedFuelReserve: `${n(fuel.remaining, 1)}%`,
            selectedFuelState: fuel.remaining <= 0 ? 'DEPLETED' : fuel.remaining <= 20 ? 'LOW RESERVE' : 'IN SERVICE',
            selectedFuelEffectiveness: percent(sim.fuel.effectiveness(fuel) * 100),
            selectedFuelExposure: `${n(fuel.exposure, 2)} demo FPH`, selectedFuelReplacements: String(fuel.replacements),
            fuelServiceStatus: (this.companion ? this.remoteFuelService?.message : this.fuelServiceStatus) || '',
            fuelInventoryState: `${sim.fuel.assemblies.filter(a => a.remaining <= 0).length} depleted · ${sim.fuel.assemblies.filter(a => a.remaining > 0 && a.remaining <= 20).length} low reserve · select an assembly to inspect or replace`,
            fuelReserve: percent(sim.fuel.remaining), fuelCapability: percent(sim.fuel.capability * 100),
            fuelReplacementReadiness: !fuelPoolHasCapacity ? 'Pool full. Dispatch cooled fuel to free a rack.' : fuelReadiness.ready ? 'Ready for manual replacement. Reactor will remain stopped.' : fuelReadiness.reasons.join('. ') + '.',
            powerSource: sim.supply.source, auxiliaryLoad: `${n(sim.supply.demand, 2)} MW requested / ${n(sim.supply.capacity, 1)} MW available`,
            gridStatus: sim.gridDispatch.status(sim),
            gridMessage: sim.gridDispatch.lastRequest ? `${this.time(sim.gridDispatch.lastRequest.time)} · ${sim.gridDispatch.lastRequest.message}` : 'Incoming requests set MW, core limit and circulation in Auto.',
            gridReadback: `Actual ${n(sim.electricalOutput, 1)} MW / target ${n(sim.autoElectricalTarget)} MW`,
            gridOperatingTargets: `Core limit ${n(sim.autoTemperature)} °C / circulation ${n(sim.autoFlow)}%`,
            gridCapacity: `Available dispatch: up to ${n(gridDispatchCapacity(sim))} MW`,
            gridNext: sim.gridDispatch.enabled ? `${sim.gridDispatch.readiness(sim).ready ? 'Next request in' : 'Countdown held at'} ${Math.ceil(sim.gridDispatch.remaining)} s` : 'Enable to follow simulated grid messages.',
            mode: sim.autoMode ? 'AUTO' : 'MANUAL',
            conditionStage: condition.stage,
            peakFuel: `${n(condition.peakTemperature, 1)} °C`,
            retainedHeat: `${n(condition.heatReserve * 1.5)} MW`,
            pumpAStress: percent(condition.components.A.stress), pumpBStress: percent(condition.components.B.stress),
            pumpADamage: percent(condition.components.A.damage), pumpBDamage: percent(condition.components.B.damage),
            coolingMargin: `${condition.coolingMargin >= 0 ? '+' : ''}${n(condition.coolingMargin)} MW`,
            temperatureRate: `${condition.temperatureRate >= 0 ? '+' : ''}${n(condition.temperatureRate, 1)} °C/min`,
            coreDamage: `${n(condition.coreDamage, 1)}%`,
            pumpStress: `A/A2 ${n(Math.max(condition.components.A.stress, condition.components.A2.stress))}% / B/B2 ${n(Math.max(condition.components.B.stress, condition.components.B2.stress))}%`,
            selectedZoneTemperature: `${n(zone.temperature, 1)} °C`, selectedZoneDamage: `${n(zone.damage, 1)}%`,
            incidentSummary: condition.incident ? `${this.time(condition.incident.startedAt)}: ${condition.incident.cause}. ${condition.incident.timeline.length} retained incident events${condition.incident.resolvedAt ? ' · recovered' : ''}.` : 'No incident recorded.',
            regulation: sim.tripped ? 'TRIP / AUTOMATION INHIBITED' : !sim.running ? 'STOPPED / WAITING FOR START' : sim.autoMode
                ? sim.autoObjective === 'power' ? `AUTO / ${n(signals.electricalOutput.value, 1)} / ${n(sim.autoElectricalTarget)} MW ELECTRIC` : `AUTO / ERROR ${n(sim.autoTemperature - sim.temperature, 1)} °C` : 'MANUAL CONTROL',
            regulationDetail: sim.autoMode ? sim.regulationLimit || (sim.autoObjective === 'power' ? 'Tracking electrical output; core setting limits temperature.' : 'Rods and pump speeds adjust to hold your targets.') : 'Manual protection: use Emergency shutdown. Temperature and flow alarms remain active.',
            clock: `T+${this.time(sim.elapsed)}`,
            sessionState: sim.paused ? 'SIMULATION PAUSED' : 'SIMULATION ACTIVE',
            temperatureState: sim.temperature > 335 ? 'HIGH TEMPERATURE' : sim.running ? 'WITHIN DEMO RANGE' : status === 'STOPPED' ? 'STOPPED' : 'COOLING DOWN',
            primaryState: sim.primaryFlow > 20 ? 'CIRCULATING' : 'LOW FLOW',
            annunciator: condition.meltdown ? 'CORE MELTDOWN · INCIDENT RECORDED · RESET DEMO REQUIRED' : sim.alarms.length ? `${sim.alarms.length} ACTIVE ${sim.alarms.length === 1 ? 'CONDITION' : 'CONDITIONS'} · ${sim.alarms[0].message.toUpperCase()}` : 'ALL SYSTEMS NORMAL'
        };
        for (const pump of PUMPS) {
            const actual = sim.components.items[pump.id].actual, state = condition.components[pump.key];
            values[pump.id] = pumpState(sim[pump.id], sim[`${pump.id}Speed`], actual.speed);
            values[`${pump.id}Target`] = percent(sim[`${pump.id}Speed`]);
            values[`${pump.id}Actual`] = `${n(actual.speed, 1)}%`;
            values[`${pump.id}Flow`] = `${n(actual.flow * FLOW_SCALE)} m³/h`;
            values[`${pump.id}Stress`] = percent(state.stress);
            values[`${pump.id}Damage`] = percent(state.damage);
        }
        for (const circuit of CIRCUITS) {
            const pipe = sim.hydraulics.pipes[circuit];
            const level = pipe.pressure > PRESSURE_LIMIT || pipe.damage > 0 ? 'danger' : pipe.pressure >= PRESSURE_WARNING ? 'warning' : 'normal';
            this.shadowRoot.querySelector(`.flow-metric[data-circuit="${circuit}"]`).dataset.pressureLevel = level;
            values[`${circuit}State`] = pipe.pressure > PRESSURE_LIMIT ? 'OVERPRESSURE' : pipe.damage > 0 ? 'PIPE DAMAGE' : level === 'warning' ? 'NEAR LIMIT' : sim[`${circuit}Flow`] > 20 ? 'CIRCULATING' : sim[`${circuit}Flow`] < .5 ? 'STOPPED' : 'LOW FLOW';
            values[`${circuit}Pressure`] = `${n(sim.hydraulics.pipes[circuit].pressure)}% ΔP`;
            this.shadowRoot.querySelector(`.circuit-pressure[data-equipment="${circuit}Pipes"]`).dataset.high = String(sim.hydraulics.pipes[circuit].pressure > 145);
        }
        const turbine = sim.components.turbineIntegrity;
        const electricalCard = this.shadowRoot.querySelector('.electrical-metric');
        electricalCard.dataset.integrity = turbine.level;
        electricalCard.title = `Turbine rating ${TURBINE_RATING_MW} MW · rotor load ${n(turbine.load)}% · blade damage ${n(turbine.damage, 1)}% · service wear ${n(turbine.wear, 2)}%`;
        values.turbineCondition = turbine.damage >= 100 ? 'ROTOR DESTROYED' : turbine.damage > 0 ? `BLADE DAMAGE ${n(turbine.damage, 1)}%` : turbine.serviceDue ? 'MAINTENANCE DUE' : turbine.load > 100 ? 'ABOVE RATED LOAD' : turbine.level === 'warning' ? 'NEAR RATED LOAD' : 'TURBINE NORMAL';
        values.turbineWear = `${n(turbine.wear, 2)}% wear`;
        for (const element of this.shadowRoot.querySelectorAll('[data-value]')) {
            if (values[element.dataset.value] !== undefined && element.textContent !== values[element.dataset.value]) element.textContent = values[element.dataset.value];
        }
        this.shadowRoot.querySelector('#follow-grid').checked = sim.gridDispatch.enabled;
        this.shadowRoot.querySelector('[data-action="grid-request"]').disabled = !sim.gridDispatch.readiness(sim).ready;
        this.shadowRoot.querySelector('.grid-dispatch-panel').dataset.following = String(sim.gridDispatch.enabled);
        this.dataset.state = sim.tripped ? 'tripped' : sim.running ? 'running' : 'stopped';
        this.dataset.overheated = String(sim.temperature > 335);
        this.dataset.temperatureOk = String(sim.running && !sim.tripped && !condition.damaged && sim.temperature <= 335 && condition.peakTemperature <= 410);
        this.dataset.condition = condition.stage.toLowerCase().replaceAll(' ', '-');
        this.dataset.pumpA = String(sim.pumpA);
        this.dataset.pumpB = String(sim.pumpB);
        this.dataset.primaryFlow = String(sim.primaryFlow >= 0.5);
        this.dataset.secondaryFlow = String(sim.secondaryFlow >= 0.5);
        this.dataset.turbine = String(sim.power > 2 && sim.secondaryFlow > 10);
        this.style.setProperty('--core-intensity', Math.min(1, Math.max(0.1, sim.power / 100, (condition.peakTemperature - 300) / 400)));
        if (this.plantTab === 'reactor' && this.overviewMode === 'schematic') this.updateSchematicState();
        this.updateCore();
        const meters = { temperature: Math.min(100, sim.temperature / 4), power: sim.power, electric: signals.electricalOutput.value / 4.1, flow: sim.primaryFlow * FLOW_SCALE / FLOW_DAMAGE_LIMIT * 100, secondaryFlow: sim.secondaryFlow * FLOW_SCALE / FLOW_DAMAGE_LIMIT * 100, rods: sim.rods };
        for (const [key, value] of Object.entries(meters)) this.shadowRoot.querySelector(`[data-meter="${key}"]`).style.width = `${Math.min(100, Math.max(0, value))}%`;
        for (const { key: pump } of PUMPS) this.shadowRoot.querySelector(`[data-action="pump${pump}"]`).setAttribute('aria-checked', String(sim[`pump${pump}`]));
        for (const { key: pump } of PUMPS) {
            const component = condition.components[pump];
            const button = this.shadowRoot.querySelector(`[data-action="pump${pump}"]`);
            button.dataset.condition = component.damage >= 1 ? 'damaged' : component.stress >= 25 ? 'strained' : 'normal';
            button.dataset.lamp = component.damage >= 1 || sim.components.items[`pump${pump}`].wear >= 1 ? 'fault' : component.stress >= 25 ? 'warning' : sim.components.items[`pump${pump}`].actual.speed >= .5 ? 'running' : 'off';
            const card = button.closest('.pump-control');
            card.dataset.condition = button.dataset.condition;
            card.dataset.lamp = button.dataset.lamp;
            button.title = `Actual motor speed ${n(sim.components.items[`pump${pump}`].actual.speed, 1)}%; branch flow ${n(sim.components.items[`pump${pump}`].actual.flow, 1)}%; stress ${n(component.stress)}%; damage ${n(component.damage, 1)}%`;
        }
        for (const circuit of CIRCUITS) this.shadowRoot.querySelector(`[data-indicator="${circuit}"]`).classList.toggle('off', sim[`${circuit}Flow`] < .5);
        this.shadowRoot.querySelector('[data-indicator="reactor"]').classList.toggle('off', !sim.running);
        this.shadowRoot.querySelector('[data-action="start"]').dataset.lamp = sim.running ? 'running' : 'off';
        this.shadowRoot.querySelector('[data-action="stop"]').dataset.lamp = !sim.running ? 'stopped' : 'off';
        const tripButton = this.shadowRoot.querySelector('[data-action="trip"]');
        tripButton.setAttribute('aria-pressed', String(sim.tripped));
        this.shadowRoot.querySelector('.emergency-station').dataset.latched = String(sim.tripped);
        this.shadowRoot.querySelector('.emergency-station').dataset.coverOpen = String(this.tripCoverOpen);
        const tripCover = this.shadowRoot.querySelector('[data-action="trip-cover"]');
        tripCover.setAttribute('aria-expanded', String(this.tripCoverOpen));
        tripCover.setAttribute('aria-label', `${this.tripCoverOpen ? 'Close' : 'Open'} emergency shutdown cover`);
        this.shadowRoot.querySelector('[data-action="reset-trip"]').dataset.lamp = sim.tripped && sim.tripRecovery().ready ? 'warning' : 'off';
        const disabled = {
            start: !sim.startupReadiness().ready, stop: !sim.running, trip: sim.tripped || !this.tripCoverOpen,
            insert: sim.autoMode || !sim.running || sim.tripped || sim.rodTarget >= 100,
            withdraw: sim.autoMode || !sim.running || sim.tripped || sim.rodTarget <= 0,
            'rod-insert': rodBlocked || selectedRod.target >= 100,
            'rod-withdraw': rodBlocked || selectedRod.target <= 0,
            'replace-fuel': !fuelReadiness.ready || !this.selectedFuel || !fuelPoolHasCapacity,
            'replace-all-fuel': !fuelReadiness.ready || !fuelPoolHasCapacity,
            'load-down': sim.autoMode || sim.tripped || sim.demand <= 0, 'load-up': sim.autoMode || sim.tripped || sim.demand >= 100,
            'reset-trip': !sim.tripped || !sim.tripRecovery().ready,
            repair: !sim.components.serviceReady, 'export-incident': !condition.incident,
            acknowledge: !sim.alarms.some(alarm => !alarm.acknowledged)
        };
        for (const [action, value] of Object.entries(disabled)) this.shadowRoot.querySelector(`[data-action="${action}"]`).disabled = value;
        const load = this.shadowRoot.querySelector('#load');
        // Preserve a pointer/keyboard adjustment until its change event is committed.
        if (this.shadowRoot.activeElement !== load) load.value = sim.demand;
        load.disabled = sim.tripped || sim.autoMode;
        load.closest('.regulator-rail').style.setProperty('--regulator-position', `${load.value}%`);
        const inputs = {
            '#individual-rod': [selectedRod.target, rodBlocked],
            ...Object.fromEntries(PUMPS.map(pump => [`#pump-${pump.key}-speed`, [sim[`${pump.id}Speed`], sim.autoMode && sim.running && !sim.components?.items[pump.id].override]])),
            '#auto-temperature': [sim.autoTemperature, false], '#auto-flow': [sim.autoFlow, false],
            '#auto-electrical': [sim.autoElectricalTarget, false]
        };
        for (const [selector, [value, isDisabled]] of Object.entries(inputs)) {
            const input = this.shadowRoot.querySelector(selector);
            if (this.shadowRoot.activeElement !== input) input.value = value;
            input.disabled = isDisabled;
            input.closest('.regulator-rail')?.style.setProperty('--regulator-position', `${input.value}%`);
            if (input.dataset.pumpSpeed) this.shadowRoot.querySelector(`[data-value="pump${input.dataset.pumpSpeed}Target"]`).textContent = `${input.value}%`;
        }
        this.shadowRoot.querySelector('#auto-objective').value = sim.autoObjective;
        this.shadowRoot.querySelector('#rod-override').checked = selectedRod.manualOverride;
        this.shadowRoot.querySelector('#rod-override').disabled = !sim.autoMode || !sim.running || sim.tripped;
        this.shadowRoot.querySelector('#fuel-rate').value = String(sim.fuel.rate);
        this.shadowRoot.querySelector('.individual-rod:not(.fuel-inspector)').hidden = !!this.selectedFuel;
        this.shadowRoot.querySelector('.fuel-inspector').hidden = !this.selectedFuel;
        this.updateSupply();
        updateEquipment(this);
        updateSpentFuel(this);
        updateMaintenance(this);
        updateExercises(this);
        drawEquipmentMotion(this);
        this.shadowRoot.querySelector('#fault-scenario').value = condition.fault;
        this.shadowRoot.querySelector('.electrical-target').hidden = sim.autoObjective !== 'power';
        for (const mode of ['manual', 'auto']) this.shadowRoot.querySelector(`[data-action="${mode}"]`).setAttribute('aria-pressed', String(sim.autoMode === (mode === 'auto')));
        const fluctuations = this.shadowRoot.querySelector('[data-action="fluctuations"]');
        fluctuations.textContent = `Fluctuations: ${sim.fluctuationsEnabled ? 'On' : 'Off'}`;
        fluctuations.setAttribute('aria-pressed', String(sim.fluctuationsEnabled));
        const recovery = this.shadowRoot.querySelector('.trip-recovery');
        recovery.hidden = !sim.tripped;
        const checks = sim.tripRecovery().checks;
        const recoverySignature = JSON.stringify(checks);
        if (this.recoverySignature !== recoverySignature) {
            this.recoverySignature = recoverySignature;
            recovery.querySelector('ul').replaceChildren(...checks.map(check => {
                const item = document.createElement('li');
                item.textContent = `${check.ready ? '✓' : '○'} ${check.label}`;
                item.classList.toggle('ready', check.ready);
                return item;
            }));
        }
        this.shadowRoot.querySelector('[data-action="pause"]').textContent = sim.paused ? '▶ Resume' : 'Ⅱ Pause';
        const pending = sim.alarms.some(alarm => !alarm.acknowledged);
        const annunciator = this.shadowRoot.querySelector('.annunciator');
        annunciator.classList.toggle('has-alarm', sim.alarms.length > 0);
        annunciator.classList.toggle('unacknowledged', pending);
        this.updateEvents();
        this.updateTrend();
        this.game?.update(fromTimer);
        this.updateActivity();
        updateSessionControls(this);
        if (!fromTimer) publishSession(this);
    }

    updateCore() {
        if (this.companion ? this.companionView !== 'core' : !this.shadowRoot.querySelector('.core-dialog').matches(':popover-open')) return;
        const sim = this.simulation;
        for (const rod of sim.controlRods) {
            const channel = this.shadowRoot.querySelector(`[data-rod="${rod.id}"]`);
            const zone = sim.condition.zones.find(zone => zone.id === rod.id);
            channel.dataset.condition = zone.damage > 0 ? 'damaged' : zone.temperature > 410 ? 'hot' : 'normal';
            channel.classList.toggle('selected', !this.selectedFuel && rod.id === this.selectedRod);
            channel.classList.toggle('manual-override', rod.manualOverride);
            channel.setAttribute('aria-pressed', String(!this.selectedFuel && rod.id === this.selectedRod));
            channel.setAttribute('aria-label', `${rod.id}: actual ${rod.position.toFixed(1)}%, target ${rod.target.toFixed(1)}% insertion; fuel ${zone.temperature.toFixed(1)} °C; damage ${zone.damage.toFixed(1)}%`);
            const ring = channel.querySelector('.rod-depth-ring');
            ring.style.strokeDasharray = `${2 * Math.PI * 14}`;
            ring.style.strokeDashoffset = `${2 * Math.PI * 14 * (1 - rod.position / 100)}`;
        }
        for (const element of this.shadowRoot.querySelectorAll('[data-fuel-x]')) {
            const fuel = sim.fuel.assemblies.find(a => a.id === element.dataset.fuelId);
            element.classList.toggle('selected', fuel.id === this.selectedFuel);
            element.dataset.reserve = fuel.remaining <= 0 ? 'spent' : fuel.remaining <= 20 ? 'low' : 'normal';
            element.setAttribute('aria-pressed', String(fuel.id === this.selectedFuel));
            const reserveState = fuel.remaining <= 0 ? 'DEPLETED — manual replacement required' : fuel.remaining <= 20 ? 'LOW RESERVE' : 'In service';
            const fuelLabel = `${fuel.id}: ${reserveState}; remaining ${fuel.remaining.toFixed(1)}%; exposure ${fuel.exposure.toFixed(2)} demo full-power hours`;
            element.setAttribute('aria-label', fuelLabel);
            element.querySelector('.fuel-map-tooltip').textContent = fuelLabel;
            element.querySelector('.fuel-low-label').textContent = `${Math.max(1, Math.ceil(fuel.remaining))}%`;
            const ring = element.querySelector('.fuel-reserve-ring');
            ring.style.strokeDasharray = `${Math.PI * 28}`;
            ring.style.strokeDashoffset = `${Math.PI * 28 * (1 - fuel.remaining / 100)}`;
            let total = 0;
            let weight = 0;
            for (const rod of sim.controlRods) {
                const w = 1 / (1 + (rod.x - Number(element.dataset.fuelX)) ** 2 + (rod.y - Number(element.dataset.fuelY)) ** 2);
                total += (100 - rod.position) * w;
                weight += w;
            }
            element.style.setProperty('--channel-activity', Math.max(0.06, total / weight / 100 * sim.power / 100));
            const nearest = sim.controlRods.reduce((best, rod) =>
                (rod.x - Number(element.dataset.fuelX)) ** 2 + (rod.y - Number(element.dataset.fuelY)) ** 2 <
                (best.x - Number(element.dataset.fuelX)) ** 2 + (best.y - Number(element.dataset.fuelY)) ** 2 ? rod : best);
            const zone = sim.condition.zones.find(zone => zone.id === nearest.id);
            element.dataset.condition = zone.damage > 0 ? 'damaged' : zone.temperature > 410 ? 'hot' : 'normal';
            const glow = Math.min(1, Math.max(0, (zone.temperature - 100) / 550));
            element.querySelector('.fuel-center').style.opacity = glow;
            element.querySelector('.fuel-center').style.fill = `hsl(${40 - glow * 35} 95% 65%)`;
        }
        this.shadowRoot.querySelector('.rod-depth-track i').style.height = `${sim.controlRods.find(rod => rod.id === this.selectedRod).position}%`;
    }

    updateSupply() {
        const supply = this.simulation.supply;
        this.shadowRoot.querySelector('#grid-supply').checked = supply.gridAvailable;
        this.shadowRoot.querySelector('#turbine-supply').checked = supply.turbineConnected;
        this.shadowRoot.querySelector('.power-source-panel').dataset.supply = supply.factor === 0 ? 'lost' : supply.source.startsWith('BACKUP') ? 'backup' : 'normal';
        for (const item of this.shadowRoot.querySelectorAll('[data-supply]')) item.classList.toggle('energized', supply.source.includes(item.dataset.supply === 'turbine' ? 'TURBINE' : item.dataset.supply === 'grid' ? 'GRID' : 'DIESEL'));
        for (const g of supply.generators) {
            setText(this.shadowRoot.querySelector(`[data-diesel-summary="${g.id}"]`), `${g.state} · ${g.fuel.toFixed(0)}%`);
            const card = this.shadowRoot.querySelector(`[data-diesel="${g.id}"]`);
            if (!card.closest('.diesel-dialog').matches(':popover-open')) continue;
            card.dataset.state = g.state.toLowerCase();
            card.dataset.loaded = String(g.state === 'RUNNING' && g.load > 0);
            const visualState = g.state === 'RUNNING' ? g.load > 0 ? 'SUPPLYING AUXILIARY BUS' : 'RUNNING / NO BUS LOAD'
                : g.state === 'STARTING' ? 'CRANKING / OUTPUT NOT READY' : g.state === 'EMPTY' ? 'FUEL EMPTY / STOPPED' : g.automatic ? 'AUTOMATIC STANDBY / STOPPED' : 'MANUAL / STOPPED';
            card.querySelector('[data-diesel-visual-status]').textContent = visualState;
            for (const [key, value] of Object.entries({ state: g.state, fuel: `${g.fuel.toFixed(1)}%`, load: `${g.load.toFixed(2)} / ${g.capacity} MW`, startup: g.state === 'STARTING' ? `${g.startRemaining.toFixed(1)} s` : '—' })) {
                card.querySelector(`[data-diesel-value="${g.id}-${key}"]`).textContent = value;
            }
            card.querySelector('[data-diesel-meter]').style.width = `${g.fuel}%`;
            card.querySelector('[data-diesel-auto]').checked = g.automatic;
            const active = ['RUNNING', 'STARTING'].includes(g.state);
            const rocker = card.querySelector('.diesel-run-switch');
            rocker.dataset.generatorAction = active ? 'stop' : 'start';
            rocker.setAttribute('aria-checked', String(active));
            rocker.disabled = !active && g.fuel <= 0;
            card.querySelector('[data-generator-action="refuel"]').disabled = active || g.fuel >= 100;
        }
    }

    updateEvents() {
        const sim = this.simulation;
        const signature = JSON.stringify([sim.events, sim.alarms, this.logFilter]);
        if (signature === this.eventSignature) return;
        this.eventSignature = signature;
        const list = this.shadowRoot.querySelector('.event-list');
        list.replaceChildren();
        const events = sim.events.filter(event => this.logFilter === 'all' || event.category === this.logFilter);
        for (const event of events) {
            const item = document.createElement('li');
            item.className = event.severity;
            const time = document.createElement('span');
            time.className = 'event-time';
            time.textContent = this.time(event.time);
            const message = document.createElement('span');
            message.textContent = event.message;
            const category = document.createElement('span');
            category.className = 'event-category';
            category.textContent = event.category.toUpperCase();
            item.append(time, category, message);
            list.append(item);
        }
        if (!events.length) {
            const empty = document.createElement('li');
            empty.textContent = 'No events in this category yet.';
            list.append(empty);
        }
        this.shadowRoot.querySelector('.event-count').textContent = `${events.length} / ${sim.events.length} EVENTS`;
        const alarms = this.shadowRoot.querySelector('.alarm-list');
        alarms.replaceChildren();
        for (const alarm of sim.alarms) {
            const item = document.createElement('div');
            item.className = 'alarm-item';
            const message = document.createElement('span');
            message.textContent = alarm.message;
            const state = document.createElement('strong');
            state.textContent = alarm.acknowledged ? 'ACK' : 'NEW';
            item.append(message, state);
            alarms.append(item);
        }
    }

    exportLog() {
        const quote = value => `"${String(value).replaceAll('"', '""')}"`;
        const rows = [['elapsed_seconds', 'category', 'severity', 'source', 'message'],
            ...this.simulation.events.toReversed().map(event => [event.time.toFixed(2), event.category, event.severity, 'SIMULATED', event.message])];
        const url = URL.createObjectURL(new Blob([rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'nuclear-power-simulation-log.csv';
        this.shadowRoot.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    exportIncident() {
        if (!this.simulation.condition.incident) return;
        const url = URL.createObjectURL(new Blob([JSON.stringify(this.simulation.condition.incident, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'nuclear-power-incident.json';
        this.shadowRoot.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    updateTrend() {
        const sim = this.simulation;
        const points = sim.history;
        for (const root of this.shadowRoot.querySelectorAll('.trend-display')) {
            const dialog = root.closest('.floating-dialog');
            if (dialog && !dialog.matches(':popover-open')) continue;
            const temperatureMax = Math.max(400, Math.ceil(Math.max(sim.temperature, ...points.map(point => point.temperature)) / 200) * 200);
            root.querySelector('[data-value="chartTempMax"]').textContent = temperatureMax;
            root.querySelector('[data-value="chartTempMid"]').textContent = temperatureMax / 2;
            const x = time => 40 + (time - sim.elapsed + 120) / 120 * 675;
            const y = (value, max) => 250 - Math.max(0, Math.min(1, value / max)) * 210;
            const path = (key, max) => points.map((point, index) => `${index ? 'L' : 'M'}${x(point.time).toFixed(1)} ${y(point[key], max).toFixed(1)}`).join(' ');
            root.querySelector('.temperature-trace').setAttribute('d', path('temperature', temperatureMax));
            const powerObjective = sim.autoObjective === 'power';
            const outputKey = powerObjective ? 'electricalOutput' : 'power';
            const outputMax = powerObjective ? Math.max(400, Math.ceil(Math.max(sim.autoElectricalTarget, sim.electricalOutput, ...points.map(point => point.electricalOutput)) / 100) * 100) : 100;
            root.querySelector('[data-value="chartOutputMax"]').textContent = outputMax;
            root.querySelector('[data-value="chartOutputMid"]').textContent = outputMax / 2;
            root.querySelector('.power-trace').setAttribute('d', path(outputKey, outputMax));
            let targetPath = '';
            let gap = true;
            if (powerObjective) for (const point of points) {
                if (point.electricalTarget === null) { gap = true; continue; }
                targetPath += `${gap ? 'M' : 'L'}${x(point.time).toFixed(1)} ${y(point.electricalTarget, outputMax).toFixed(1)} `;
                gap = false;
            }
            root.querySelector('.target-trace').setAttribute('d', targetPath);
            root.querySelector('.target-legend').hidden = !powerObjective || !sim.autoMode;
            root.querySelector('.trend-chart').setAttribute('aria-label', `Simulated core temperature in Celsius and ${powerObjective ? 'electrical output and target in megawatts' : 'reactor output in percent'} over the last two minutes`);
            const first = points[0];
            const last = points.at(-1);
            root.querySelector('.trend-area').setAttribute('d', `${path('temperature', temperatureMax)} L${x(last.time).toFixed(1)} 250 L${x(first.time).toFixed(1)} 250 Z`);
            for (const [className, key, max] of [['temperature-dot', 'temperature', temperatureMax], ['power-dot', outputKey, outputMax]]) {
                const dot = root.querySelector(`.${className}`);
                dot.setAttribute('cx', x(last.time));
                dot.setAttribute('cy', y(last[key], max));
            }
        }
    }

    time(seconds) {
        return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, Math.floor(seconds) % 60].map(value => String(value).padStart(2, '0')).join(':');
    }
}

if (!customElements.get('nuclear-power-console')) customElements.define('nuclear-power-console', NuclearPowerConsole);
