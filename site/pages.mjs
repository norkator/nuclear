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
        heading: 'Nuclear reactor simulator: run your own control room',
        description: 'Run a fictional nuclear power plant in your browser. Control rods, cooling pumps and turbines, manage faults and explore a 3D reactor. Free, no download or login.',
        body: `
          <p class="site-eyebrow">NUCLEAR POWER · PÖRSSIOHJAIN</p>
          <h1>Nuclear reactor simulator: run your own control room</h1>
          <p class="site-lead">Start a cold reactor, balance cooling and electrical output, and respond when equipment fails. Nuclear Power is a free online nuclear power plant simulator with an interactive 3D control room. Play directly in your browser, with no download or account.</p>
          <nav class="site-actions" aria-label="Simulator and guides">
            <a class="site-button" href="/reactor/">Open the reactor</a>
            <a href="/guides/startup/" target="_blank" rel="noopener">Read the startup guide ↗</a>
          </nav>
          <p>The plant uses a fictional two-loop layout: a primary coolant circuit carries heat from the core to a heat exchanger, while a separate secondary circuit drives the turbine and generator. All readings and commands are simulated locally in this browser session.</p>
          <h2>What can you control?</h2>
          <div class="site-grid">
            <section>
              <h3>Reactor core and control rods</h3>
              <p>Open the core map to inspect individual rods, fuel reserves, local temperatures and damage. Try automatic electrical-output regulation or take manual control and watch the actual rod positions follow your requests.</p>
            </section>
            <section>
              <h3>Cooling and power generation</h3>
              <p>Run both cooling pumps, adjust valves and heat-exchanger settings, and inspect the turbine and condenser. Requested pump speed, actual circulation, core heat and electrical megawatts are separate readings.</p>
            </section>
            <section>
              <h3>Faults, blackouts and recovery</h3>
              <p>Explore cooling loss, pump deterioration and auxiliary power failures. Follow alarms and trends, manage backup diesels, clear faults and repair cooled equipment. Sustained overheating can cause lasting damage and a simulated meltdown.</p>
            </section>
            <section>
              <h3>Fuel handling and maintenance</h3>
              <p>Inspect uneven fuel use, replace fuel after shutdown and cooldown, and watch the handling crane transfer a representative batch to the spent-fuel pool. Dispatch cooled batches to free pool space.</p>
            </section>
          </div>
          <h2>How to start your first session</h2>
          <ol>
            <li>Leave <strong>Auto</strong> and <strong>Electrical output</strong> selected for a first run. The initial target is 200 MW, but the reactor starts stopped and cold.</li>
            <li>Switch on the primary and secondary pumps. Wait for actual motor speed and coolant flow to build in both loops.</li>
            <li>Press the reactor <strong>Start</strong> button when the startup interlocks are satisfied. Watch actual output rise toward the requested target.</li>
            <li>Inspect components and live trends. Grid-controller following is enabled initially; disable it if you want to keep your own operating targets.</li>
          </ol>
          <p>The <a href="/guides/startup/" target="_blank" rel="noopener">full startup guide</a> explains blocked starts, camera controls and ending a session. Guides open in another tab so your current plant session stays available.</p>
          <h2>Control-room guides</h2>
          <nav class="site-grid site-guide-links" aria-label="Control-room guides">
            <a href="/guides/startup/" target="_blank" rel="noopener"><strong>Startup and first megawatts ↗</strong><span>Start both pumps, establish circulation and bring the cold reactor online.</span></a>
            <a href="/guides/reactor-controls/" target="_blank" rel="noopener"><strong>Control rods, cooling and output ↗</strong><span>Understand Auto, Manual, pump read-backs and the turbine breaker.</span></a>
            <a href="/guides/faults-and-recovery/" target="_blank" rel="noopener"><strong>Faults, shutdown and recovery ↗</strong><span>Investigate alarms, restore power and work through trip and repair checks.</span></a>
          </nav>
          <h2>Frequently asked questions</h2>
          <section>
            <h3>Is this nuclear reactor simulator free?</h3>
            <p>Yes. The current simulator is free to use in your browser. You do not need to install an app, sign in or connect any equipment.</p>
            <h3>Is this a Chernobyl or RBMK simulator?</h3>
            <p>No. The 3D channel deck has an RBMK-inspired appearance, but the plant is a fictional two-loop design. Its behavior, temperatures and protection limits do not reproduce a specific real reactor.</p>
            <h3>Is it a game or an engineering simulator?</h3>
            <p>It is an interactive control-room sandbox with objectives, fault scenarios and progressive equipment damage. It is intended for experimentation and play; it is not a validated engineering model or operator training tool.</p>
            <h3>Can I play on a phone or without WebGL?</h3>
            <p>The controls adapt to small screens. The 3D cutaway uses WebGL 2; an interactive SVG schematic is available when WebGL is unavailable or when you select Schematic.</p>
            <h3>Does the simulator save my reactor?</h3>
            <p>Free operation belongs to the current page session and is discarded on reload. Start game creates a separate commissioning career with a company inbox, assignments and achieved goals saved on this browser. Continue game restores that career paused. Use Save to export a career backup; export free-operation logs before resetting.</p>
          </section>
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
