/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';

export const captureConsoleLayout = consoleCode => consoleCode(`
    if (!s) return null;
    const rect = selector => {
        const node = s.querySelector(selector);
        if (!node) return null;
        const r = node.getBoundingClientRect();
        return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,hidden:node.hidden};
    };
    const shell = s.querySelector('.console-layout');
    const scene = s.querySelector('.plant-scene');
    return {
        viewport: {width:innerWidth,height:innerHeight,contentWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth},
        theme:c.dataset.theme,
        overview: {rect:rect('.diagram-viewport'),visible:c.overviewIntersecting,consoleVisible:c.intersecting,documentHidden:document.hidden},
        panels: {...shell?.dataset},
        mobile: {active:!!c.mobileLayout?.active,kind:c.mobileLayout?.kind || null,
            surface:c.mobileLayout?.current ? rect(':popover-open[aria-modal="true"]') : null},
        columns: shell ? getComputedStyle(shell).gridTemplateColumns : null,
        transitions: ['.console-layout','.instrument-column','.analysis-column','.operator-column:popover-open','[data-mobile-surface="parts"]:popover-open','#mobile-more:popover-open'].flatMap(selector =>
            (s.querySelector(selector)?.getAnimations() || []).filter(a=>a.pending||a.playState==='running')
                .map(a=>({selector,property:a.transitionProperty,state:a.playState,pending:a.pending}))),
        sceneReady: !c.overviewScene || !scene?.clientWidth || c.overviewScene.width===scene.clientWidth,
        metrics:rect('.metrics'),controls:rect('.control-column'),analysis:rect('.analysis-column'),
        trends:rect('.trend-panel'),logs:rect('.events-panel'),footer:rect('.console-footer'),console:rect('.console')
    };
`);

export async function waitForConsoleLayout(consoleCode, label = 'Console layout') {
    // Ultrawide software-WebGL reallocations can take several browser frames
    // longer than ordinary layout. This is a readiness deadline, not a sleep:
    // return as soon as real transitions, geometry and renderer sizing settle.
    const deadline = Date.now() + 30_000;
    let previous, latest, samples = 0;
    // Software WebGL can block the initial resize read beyond the deadline.
    // Always obtain a frame-separated pair before deciding geometry is unstable.
    while (samples < 2 || Date.now() < deadline) {
        latest = await captureConsoleLayout(consoleCode);
        samples++;
        const signature = JSON.stringify(latest);
        if (latest?.console?.width > 0 && !latest.transitions.length && latest.sceneReady && signature === previous) return latest;
        previous = signature;
        // A timer can poll the same unpainted layout while headless Chrome has
        // a pending resize/transition. Sample actual frames so the compositor,
        // resize observers and visibility observers can settle between reads.
        await consoleCode('return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));');
    }
    throw new Error(`${label} did not settle: ${JSON.stringify(latest)}`);
}

export async function checkConsoleLayout({ consoleCode, page, screenshot }) {
    assert.equal(await consoleCode('return s.querySelector(".simulation-badge, [data-action=fluctuations], [data-value=sessionState]");'), null);
    assert.equal(await consoleCode('return s.querySelector(".footer-signature").textContent;'), 'PÖRSSIOHJAIN');
    assert.ok(await consoleCode('return !!(s.querySelector(".alert-mute-button").compareDocumentPosition(s.querySelector(".emergency-station")) & Node.DOCUMENT_POSITION_FOLLOWING);'), 'Mechanical alert button precedes ESD');
    const raised = await consoleCode('return getComputedStyle(s.querySelector(".alert-mute-button .hardware-face")).transform;');
    await consoleCode('s.querySelector(".alert-mute-button").click();');
    assert.equal(await consoleCode('return s.querySelector(".alert-mute-button").getAttribute("aria-pressed");'), 'true');
    await waitForConsoleLayout(consoleCode, 'Alert pushbutton pressed');
    assert.notEqual(await consoleCode('return getComputedStyle(s.querySelector(".alert-mute-button .hardware-face")).transform;'), raised);
    await consoleCode('s.querySelector(".alert-mute-button").click();');
    // This scenario needs both panels, independently of other tests/preferences.
    await consoleCode(`for (const button of s.querySelectorAll('.workspace-tools [data-workspace-panel]')) {
        if (button.getAttribute('aria-expanded') !== 'true') button.click();
    }`);
    // Include a large resize in both directions, where measuring mid-transition
    // previously caught the panel width ahead of its animated grid track.
    for (const [width, height] of [[1440, 900], [3440, 1440], [1920, 1080], [2560, 1440]]) {
        await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        for (const theme of ['dark', 'light']) {
            await consoleCode(`c.setTheme(${JSON.stringify(theme)});`);
            const layout = await waitForConsoleLayout(consoleCode, `${width}×${height} ${theme}`);
            const context = `${width}×${height} ${theme}: ${JSON.stringify(layout)}`;
            assert.ok(!layout.metrics.hidden && !layout.analysis.hidden && layout.metrics.width > 0 && layout.analysis.width > 0, `Side panels must be visible: ${context}`);
            assert.ok(layout.metrics.right <= layout.controls.x, `Instruments overlap the plant controls: ${context}`);
            assert.ok(layout.controls.right <= layout.analysis.x, `Plant controls overlap trends/events: ${context}`);
            assert.ok(layout.trends.bottom <= layout.logs.y, `Trends overlap the journal: ${context}`);
            assert.ok(layout.console.width > width - 50, `Console should use the available width: ${context}`);
            assert.ok(layout.footer.bottom <= height, `Console footer should fit the viewport: ${context}`);
            assert.ok(layout.viewport.scrollWidth <= width, `Console must not overflow horizontally: ${context}`);
            await screenshot(`wide-${width}-${theme}`);
        }
    }
    await consoleCode('c.setTheme("dark");');
}

export async function checkBatchedConsoleVisibility(consoleCode) {
    const result = await consoleCode(`
        const OriginalObserver = window.IntersectionObserver;
        const observers = [];
        window.IntersectionObserver = class extends OriginalObserver {
            constructor(callback, options) { super(callback, options); this.deliver = callback; observers.push(this); }
            observe(target) { this.observedTarget = target; super.observe(target); }
        };
        const parent = c.parentElement;
        try { c.remove(); parent.append(c); }
        finally { window.IntersectionObserver = OriginalObserver; }
        const whole = observers.find(observer=>observer.observedTarget===c);
        const process = observers.find(observer=>observer.observedTarget===s.querySelector('.diagram-viewport'));
        const sample = (observer, key) => {
            observer.deliver([{isIntersecting:false},{isIntersecting:true}]);
            const visible = c[key];
            observer.deliver([{isIntersecting:true},{isIntersecting:false}]);
            const hidden = c[key];
            observer.deliver([{isIntersecting:true}]);
            return {visible,hidden};
        };
        return {whole:sample(whole,'intersecting'),process:sample(process,'overviewIntersecting')};
    `);
    assert.deepEqual(result, { whole: { visible: true, hidden: false }, process: { visible: true, hidden: false } },
        'The last delivered visibility state must win when resize/capture notifications arrive in a batch');
}
