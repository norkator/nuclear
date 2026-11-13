/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
// This content is rendered into ordinary HTML by Vite, never injected at runtime.
export const siteUrl = 'https://nuclear.porssiohjain.fi';
export const consolePaths = ['/reactor/', '/companion/'];

export const pages = [
    {
        path: '/',
        title: 'Nuclear Reactor Simulator — Free Online Control Room',
        heading: 'Nuclear reactor simulator',
        description: 'Run a fictional nuclear power plant in your browser. Control rods, cooling pumps and turbines, manage faults and explore a 3D reactor. Free, no download or login.',
        body: `
          <h1>Nuclear reactor simulator</h1>
          <p class="site-lead">Start a cold reactor, manage cooling and generate electricity. Free to use in your browser, with no download or account.</p>
          <p>The fictional plant has two coolant loops. The primary circuit carries core heat to a heat exchanger; the secondary circuit drives the turbine and generator. All plant readings are simulated.</p>
          <h2>Inside the control room</h2>
          <div class="site-grid">
            <section>
              <h3>Reactor core and control rods</h3>
              <p>Inspect individual rods, fuel reserves, temperatures and damage in the core map. Use automatic regulation or control the rods manually.</p>
            </section>
            <section>
              <h3>Cooling and power generation</h3>
              <p>Operate pumps, valves, the heat exchanger, turbine and condenser. Compare requested settings with actual speed, flow and electrical output.</p>
            </section>
            <section>
              <h3>Faults, blackouts and recovery</h3>
              <p>Try cooling loss, pump faults or blackouts. Read alarms and trends, use backup diesels and repair cooled equipment. Overheating can cause lasting damage.</p>
            </section>
            <section>
              <h3>Fuel handling and maintenance</h3>
              <p>Replace fuel after shutdown and cooldown. The crane shows a representative transfer to the spent-fuel pool; dispatch cooled batches to free space.</p>
            </section>
          </div>
          <h2>First startup</h2>
          <ol>
            <li>Keep <strong>Auto → Electrical output</strong> selected. The target starts at 200 MW.</li>
            <li>Switch on one pump per circuit and wait for actual circulation.</li>
            <li>Press reactor <strong>Start</strong> when the readiness checks pass.</li>
            <li>Watch output and cooling. Turn off grid following to keep your own targets.</li>
          </ol>
          <p>Guides open in another tab so the plant stays available.</p>
          <h2>Guides</h2>
          <nav class="site-grid site-guide-links" aria-label="Control-room guides">
            <a href="/guides/startup/" target="_blank" rel="noopener"><strong>Startup and first megawatts ↗</strong><span>Start both pumps, establish circulation and bring the cold reactor online.</span></a>
            <a href="/guides/reactor-controls/" target="_blank" rel="noopener"><strong>Control rods, cooling and output ↗</strong><span>Understand Auto, Manual, pump read-backs and the turbine breaker.</span></a>
            <a href="/guides/faults-and-recovery/" target="_blank" rel="noopener"><strong>Faults, shutdown and recovery ↗</strong><span>Investigate alarms, restore power and work through trip and repair checks.</span></a>
          </nav>
          <h2>Sessions and saved games</h2>
          <p>Free operation starts a fresh plant on reload. <strong>Start game</strong> creates a separate career with startup and reliable-operation assignments. Your plant, inbox and achievements save on this browser. <strong>Continue game</strong> restores the career paused; Save offers a JSON backup.</p>
          <p>Controls adapt to phones and tablets. Choose the SVG schematic if 3D WebGL is unavailable. The channel deck has an RBMK-inspired appearance, but this fictional two-loop plant does not model a specific real reactor.</p>
        `,
    },
    {
        path: '/guides/startup/',
        title: 'How to Start the Reactor | Nuclear Power Simulator',
        heading: 'How to start the nuclear reactor simulator',
        description: 'Start a cold reactor in Nuclear Power: enable both pumps, establish coolant flow and generate your first megawatts. Includes startup checks and camera controls.',
        body: `
          <p class="site-lead">Your first goal is to establish cooling, start the reactor and observe electrical generation. This guide follows the initial settings of the browser simulator.</p>
          <h2>1. Check the cold plant</h2>
          <p>A new session starts with the reactor stopped, control rods fully inserted, pumps switched off and no generated power. Pump speed targets are retained at 100%, but actual motor speed and flow are zero until you enable the pumps.</p>
          <p>Leave <strong>Auto</strong> selected with <strong>Electrical output</strong> regulation. The initial request is 200 MW. That number is a target, not electricity already being generated.</p>
          <h2>2. Start both cooling pumps</h2>
          <p>Switch the primary and secondary pump rockers to ON. Check their actual motor lamps, speed and flow readings as circulation builds. An ON request alone does not prove a pump is moving coolant: the pump also needs auxiliary AC power and available equipment.</p>
          <p>The external grid normally supplies the pumps before generation begins. Open <strong>Pump power source</strong> if the motors fail to accelerate. A disconnected source or unavailable cooling circuit can keep the reactor Start button interlocked.</p>
          <h2>3. Start the reactor</h2>
          <p>When both circuits are circulating and the startup readiness checks are satisfied, press the reactor's green <strong>Start</strong> button. Rods begin moving toward their operating targets. Core temperature and turbine output build over time rather than jumping to the request.</p>
          <p>Read the actual thermal, electrical and flow instruments. Open <strong>Live trends</strong> to compare the recent output curve with the target. Automatic control can limit output when cooling, fuel or equipment capacity cannot support the requested megawatts.</p>
          <h2>4. Choose who sets the operating targets</h2>
          <p><strong>Follow simulated Grid controller requests</strong> is enabled initially. Its first countdown waits until dispatch is ready, then counts 45 active seconds before the first request; later requests arrive every 60 active seconds. The controller coordinates electrical output, circulation and the operating core-temperature target.</p>
          <p>Disable following to keep your chosen operating targets. It does not stop the reactor or clear existing settings. Grid following is suspended while stopped, tripped, paused, in Manual, using temperature regulation or without the required circulation and generation capacity.</p>
          <h2>Why is Start disabled?</h2>
          <p>Check the startup readiness indications. Both coolant circuits need actual circulation and AC power. The reactor and turbine trip latches must be reset, usable fuel must remain, and the core must be cool enough. Active faults, retained damage or unavailable heat-rejection equipment also prevent startup.</p>
          <p>After an incident, use the <a href="/guides/faults-and-recovery/">fault recovery guide</a> rather than repeatedly pressing Start. Restoring power or switching to Auto never resets a trip or starts the plant for you.</p>
          <h2>Explore the plant</h2>
          <p>Select the reactor vessel for its floating core map, or select equipment for its own control window. Drag a window's title bar to move it; focus the title bar and use arrow keys for keyboard movement. Close a window with its close button or Escape.</p>
          <p>In the 3D view, drag to orbit, use the mouse wheel to zoom, and use middle-button drag or Shift+drag to pan. With the canvas focused, arrow keys orbit, Shift+arrow keys pan, and Home resets the camera. Select <strong>Schematic</strong> for the SVG process view.</p>
          <h2>Stop, pause and finish</h2>
          <p><strong>Stop</strong> inserts the rods while cooling continues if powered pumps remain enabled. Retained heat does not disappear immediately. <strong>Pause</strong> freezes plant time. Hiding the browser tab also suspends the simulation without fast-forwarding when you return.</p>
          <p>Enable plant sounds only if you want operating audio and alarms. Export free-operation logs before Reset demo, reload or closing the page. In a company career, use Save or Save &amp; return to free operation; Continue game restores the local career paused after reload. Continue with the <a href="/guides/reactor-controls/">control rods, cooling and output guide</a> to explore manual operation.</p>
        `,
    },
    {
        path: '/guides/reactor-controls/',
        title: 'Control Rods, Cooling & Output | Nuclear Power Simulator',
        heading: 'Control rods, cooling and electrical output',
        description: 'Learn the Nuclear Power simulator controls: rod insertion, Auto and Manual regulation, cooling loops, pump speeds, heat exchange and turbine generation.',
        body: `
          <p class="site-lead">Nuclear Power connects reactor heat, two coolant loops, a turbine and auxiliary power in one fictional plant. Understanding requested settings and actual read-backs makes the control room easier to operate.</p>
          <h2>Requested settings and actual readings</h2>
          <p>A slider sets a request. Equipment takes time to respond, and faults or missing power can prevent it from reaching that request. Compare the pump ON/OFF rocker with the actual motor lamp, speed and flow. Compare the MW target with the electrical instrument, and rod targets with their actual insertion.</p>
          <p>All of these are simulated signals. The app has no connected reactor, live telemetry or physical device commands.</p>
          <h2>Control rods and the core map</h2>
          <p>The core map exposes twelve individual control rods alongside separate fuel assemblies. Increasing rod insertion reduces the fictional reaction; withdrawing rods increases the available reaction. Movement is gradual, so a new target is not an immediate change in actual position.</p>
          <p>Automatic control normally owns rod targets. Enable an individual rod's manual override if you want to hold it yourself while Auto compensates with the other rods. Stop and emergency shutdown release overrides and request full insertion. Switching between Auto and Manual does not release a latched trip.</p>
          <p>Fuel reserve, local fuel temperature and retained damage have their own map indications. Replacing fuel and repairing damage are distinct actions. Neither is performed automatically by the regulator.</p>
          <h2>Auto: electrical output or core temperature</h2>
          <p>With electrical regulation selected, Auto adjusts rods toward the requested gross electrical megawatts while respecting the configured core-temperature ceiling. Cooling restrictions, depleted fuel, equipment limitations and manual overrides can reduce the available output. Read the limiting reason instead of assuming a high request can always be met.</p>
          <p>Temperature regulation instead targets the core temperature. Changing a target never changes the independent alarm and protection thresholds. The simulated grid controller follows requests only in eligible automatic electrical operation; turn following off when comparing your own fixed settings.</p>
          <h2>Manual operation</h2>
          <p>Manual gives the operator responsibility for load and rod settings. In both Manual and Auto, Stop and Emergency shutdown are operator actions. Low flow, excessive coolant temperature and local fuel hot spots raise alarms and affect damage, but never activate the emergency button. Auto still limits output against available cooling and fuel. Irreversible meltdown ends generation through its own failure state and requires Reset demo.</p>
          <p>Watch local fuel temperature as well as average coolant temperature. A local hot spot can develop before the bulk coolant reading looks extreme. Read the <a href="/guides/faults-and-recovery/">shutdown and recovery guide</a> before intentionally removing cooling.</p>
          <h2>Primary and secondary cooling</h2>
          <p>The primary loop carries reactor heat to the heat exchanger and returns cooler coolant to the core. The separate secondary loop takes up that heat and drives the turbine before returning through the condenser. The layout is illustrative, not a detailed model of a named reactor type.</p>
          <p>Each loop has its own pump request and actual flow. Valves, bypass position, exchanger transfer, condenser performance and component condition affect the common cooling and generation model. Selecting the heat exchanger opens an interactive cutaway with requested and actual positions shown separately.</p>
          <h2>Turbine, generator and auxiliary power</h2>
          <p>Electrical generation depends on available heat, secondary circulation, turbine condition and breaker state. A tripped turbine requires its own explicit reset and restart checks. Auto does not restart it or close a breaker for you.</p>
          <p>The pumps use an auxiliary AC bus supplied in priority order by the turbine feed, external grid or available backup diesels. Gross electrical generation and auxiliary pump demand are separate readings. Losing AC causes pumps to coast down even if their ON rockers remain selected.</p>
          <h2>Read trends before changing another setting</h2>
          <p>The expandable trend window shows recent temperature and output history. Component windows retain local trends and operator change markers. Make one adjustment and observe the response before changing another variable; this helps separate a requested change from a fault or capacity limit.</p>
          <p>For a repeatable first run, return to the <a href="/guides/startup/">startup guide</a>. Reloading opens a new cold free-operation session, so export its journal or incident report first. A saved company career can be restored through Continue game.</p>
        `,
    },
    {
        path: '/guides/faults-and-recovery/',
        title: 'Faults, Shutdown & Recovery | Nuclear Power Simulator',
        heading: 'Reactor faults, shutdown and recovery',
        description: 'Troubleshoot the Nuclear Power simulator: investigate cooling loss and blackouts, use emergency shutdown, restore circulation, repair damage and reset trips.',
        body: `
          <p class="site-lead">A fault is an opportunity to trace symptoms through the fictional plant: requested settings, actual flow, available power, temperatures and damage. These instructions apply only to this browser simulator.</p>
          <h2>Start with symptoms</h2>
          <p>Read the annunciator, condition strip and live trends. Falling actual flow with an unchanged speed request suggests a restriction, pump problem or missing AC supply. Falling electrical output can also come from the secondary loop, condenser or turbine rather than the reactor core.</p>
          <p>Open <strong>Faults &amp; incident</strong> to try the progressive plant faults, or inspect components for their disturbances and condition. Faults ramp over time. Check cooling margin, local fuel temperature, retained heat and damage as well as the average core temperature.</p>
          <h2>Stop and emergency shutdown</h2>
          <p><strong>Stop</strong> requests full rod insertion and leaves cooling available. <strong>Emergency shutdown</strong> also latches the reactor trip. The mushroom button stays visibly depressed until an explicit successful Reset trip.</p>
          <p>In both Auto and Manual, use Stop or Emergency shutdown yourself. Low flow, excessive coolant temperature, local fuel hot spots and high targets never activate the emergency button automatically. Alarms and progressive damage remain active, and Auto can reduce output. Switching modes cannot clear an existing operator trip. Irreversible meltdown stops generation separately and requires Reset demo.</p>
          <p>Shutdown removes the ongoing reaction but does not erase stored heat. Maintain actual cooling after stopping. Sustained loss of heat removal can cause further damage even with rods inserted.</p>
          <h2>Recover from auxiliary power loss</h2>
          <p>Open <strong>Pump power source</strong> or select the grid or AC bus in the plant view. The electrical window shows external-grid availability and the turbine-feed connection. Turbine supply is available only when the turbine is running, connected and producing enough power for the auxiliary demand.</p>
          <p>If normal sources are unavailable, armed standby diesels start automatically after an eight-second simulated startup. Open either diesel's window to inspect its actual state, fuel and load. One available diesel can support the simplified pumps; two share the load.</p>
          <p>Manual OFF disables that engine's standby behavior. Re-arm standby explicitly if wanted. Refuelling requires a stopped engine. Restoring AC allows requested pumps to accelerate again, but never resets trips or restarts the reactor.</p>
          <h2>Clear faults and repair damage</h2>
          <p>Use <strong>Maintenance</strong> to inspect core and pump damage, equipment wear and exchanger fouling. Clear active faults explicitly, then follow the shared repair readiness checklist. Clearing a fault removes the cause gradually; existing damage remains until repaired.</p>
          <p>Repairs require a stopped, cooled, fault-free plant without meltdown. The checklist requires coolant below 150 °C and peak local fuel temperature below 200 °C. These are simulator interlocks, not real equipment operating limits.</p>
          <p><strong>Repair all</strong> preserves heat, fuel, settings, operating hours and reactor and turbine trip latches. It does not refuel the plant, restart machinery or close a breaker. Fuel replacement has its own explicit checks and cannot substitute for repair.</p>
          <h2>Reset the reactor trip</h2>
          <p>Check that all rods have inserted, both circuits are circulating, coolant is below the demo reset limit, local fuel hot spots have cooled, and active faults and retained damage have been addressed. The recovery checklist explains which condition still blocks Reset trip.</p>
          <p>A successful <strong>Reset trip</strong> releases the latch while leaving the reactor stopped. Then complete startup readiness and press Start yourself. The turbine has separate readiness and trip handling; restoring the reactor latch alone does not restore generation.</p>
          <h2>Alarms, acknowledgement and meltdown</h2>
          <p>Acknowledging an alarm records that you have seen it. It does not fix its cause, clear damage or remove the red high-temperature indication while the core remains above 335 °C.</p>
          <p>A sustained severe incident can lead to a latched simulated meltdown. That session remains available for inspection, but repair and trip reset cannot restore it. Export the incident report. In free operation, use <strong>Reset demo</strong> for a new cold session. In Career, use Save &amp; return, then Start game to explicitly replace the saved career if desired; no bankruptcy or financial closeout is implemented yet.</p>
          <h2>Keep a record of the incident</h2>
          <p>The event journal contains operator, automation, process, alarm and system events. Export CSV for the retained journal, or export the incident JSON for its initiating cause and timeline. Both exports are marked simulated. Free-operation data is discarded by Reset demo, reload or closing the page. Career saves retain the bounded current journal and incident, plus separate achieved goals and assignment reports.</p>
          <p>Continue with the <a href="/guides/reactor-controls/">control and cooling guide</a> to understand the relationships, or use the <a href="/guides/startup/">startup guide</a> for the next run.</p>
        `,
    },
];
