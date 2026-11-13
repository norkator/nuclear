/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';

export async function checkCompanyGame({ consoleCode, action, input, page, evaluate, until, screenshot, send, baseUrl }) {
    const gameAction = name => consoleCode(`s.querySelector('[data-game-action="${name}"]').click();`);
    const ready = (expression, message) => until(`(()=>{const c=document.querySelector('nuclear-power-console');return ${expression};})()`, message);
    const tab = name => consoleCode(`s.querySelector('[data-game-tab="${name}"]').click();`);
    const steps = () => consoleCode('return Object.fromEntries([...s.querySelectorAll(".game-task-list li")].map(item=>[item.dataset.step,item.dataset.complete==="true"]));');
    const advance = seconds => consoleCode(`for(let i=0;i<${seconds * 4};i++){c.simulation.tick(.25);c.game.career.advance(c.simulation);}c.update();`);
    await ready('c?.game && !c.game.status.startsWith("Checking")', 'Career store initialized');
    assert.equal(await consoleCode('return c.game.career;'), undefined);
    assert.equal(await consoleCode('return c.simulation.running;'), false);
    assert.equal(await consoleCode('return s.querySelector(".game-tasks").hidden;'), true, 'Free operation has no assignment checklist');
    for (const [width, height] of [[1920, 1080], [2560, 1440]]) {
        await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        assert.ok(await consoleCode('return s.querySelector(".console-footer").getBoundingClientRect().bottom <= innerHeight;'), 'Free-operation game entry retains wide-screen fit');
    }
    await page('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1120, deviceScaleFactor: 1, mobile: false });
    await action('pumpA');
    await gameAction('start');
    assert.ok(await consoleCode('return s.querySelector(".game-page").textContent.includes("Your plant manager");'));
    await gameAction('begin');
    await ready('c.game.career && c.game.hasSave && !c.game.busy', 'New career saved');
    assert.equal(await consoleCode('return c.simulation.paused && !c.simulation.running && !c.simulation.pumpA;'), true);
    assert.ok(await consoleCode('return s.querySelector(".game-page").textContent.includes("Elena Ward");'));
    assert.equal(await consoleCode('return s.querySelector(".game-tasks").hidden;'), true, 'An unaccepted briefing does not show steps');
    await tab('assignments'); await gameAction('accept');
    await ready('!c.game.busy', 'Assignment accepted');
    assert.equal(await consoleCode('return s.querySelector(".game-tasks").hidden;'), false);
    assert.equal(await consoleCode('return s.querySelector(".game-dialog").matches(":popover-open");'), false, 'Accepting reveals the plant and checklist');
    assert.ok(await consoleCode('return s.querySelector(".game-tasks").nextElementSibling.classList.contains("trend-panel");'), 'Steps sit directly above Live trends');
    assert.deepEqual(await steps(), { regulation: false, circulation: false, start: false, condition: false, hold: false });
    const pendingColor = await consoleCode('return getComputedStyle(s.querySelector(".game-task-list li")).color;');
    await gameAction('resume');
    await ready('!c.game.busy', 'Shift resumed');
    await consoleCode('s.querySelector("#follow-grid").checked=false;s.querySelector("#follow-grid").dispatchEvent(new Event("change",{bubbles:true}));');
    await action('pumpA'); await action('pumpB');
    assert.equal((await steps()).circulation, false, 'Switch requests alone do not complete the circulation step');
    await advance(6); await action('start'); await advance(150);
    assert.equal(await consoleCode('return c.game.career.current.status;'), 'ready');
    assert.ok(Object.values(await steps()).every(Boolean), 'Verified steps all turn green');
    assert.notEqual(await consoleCode('return getComputedStyle(s.querySelector(".game-task-list li")).color;'), pendingColor);
    for (const [width, height] of [[1920, 1080], [2560, 1440]]) {
        await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        assert.ok(await consoleCode('return s.querySelector(".game-tasks").getBoundingClientRect().bottom <= s.querySelector(".trend-panel").getBoundingClientRect().top;'), 'Checklist and trends do not overlap inside the side panel');
        assert.ok(await consoleCode('const panel=s.querySelector(".analysis-column");panel.scrollTop=panel.scrollHeight;const journal=s.querySelector(".events-panel").getBoundingClientRect();const reachable=journal.bottom<=panel.getBoundingClientRect().bottom+1;panel.scrollTop=0;return reachable;'), 'Side-panel scrolling reaches the journal without moving the operator console');
        await screenshot(`career-steps-verified-${width}-dark`);
    }
    await page('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1120, deviceScaleFactor: 1, mobile: false });
    await gameAction('report');
    await ready('c.game.career.state.achievements.length===1 && !c.game.busy', 'First report archived');
    assert.equal(await consoleCode('return s.querySelector(".game-tasks").hidden;'), true, 'Next assignment waits for acceptance');
    await gameAction('open'); await tab('assignments');
    await gameAction('accept'); await ready('!c.game.busy', 'Reliability assignment accepted');
    await advance(40);
    await action('pause');
    await consoleCode('return c.game.save(true);');
    const saved = await consoleCode('return {elapsed:c.simulation.elapsed,held:c.game.career.current.held,strength:c.simulation.components.turbineIntegrity.strength};');
    const savedSteps = await steps();
    assert.equal(savedSteps.hold, false);
    await gameAction('open');
    await tab('achievements'); await screenshot('career-achievements-dark');
    assert.ok(await consoleCode('return s.querySelector(".game-page").textContent.includes("First generation");'));
    await tab('archive');
    assert.ok(await consoleCode('return s.querySelector(".game-page").textContent.includes("Report accepted");'));
    await tab('inbox');
    const heading = await consoleCode('return s.querySelector(".company-message h3").textContent;');
    await consoleCode('s.querySelector("[data-game-message]")?.click();');
    assert.equal(await consoleCode('return s.querySelector(".company-message h3").textContent;'), heading);
    await page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await consoleCode('c.setTheme("light");');
    await screenshot('career-inbox-mobile-light');
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Career fits phone');
    await gameAction('close');
    assert.equal(await consoleCode('return s.activeElement.dataset.gameAction;'), 'open', 'Company window restores focus');
    assert.ok(await consoleCode('const panel=s.querySelector(".game-tasks").getBoundingClientRect();return panel.width>0 && panel.left>=0 && panel.right<=innerWidth;'), 'Checklist fits a phone');
    await consoleCode('s.querySelector(".game-tasks").scrollIntoView({block:"start"});');
    await screenshot('career-steps-mobile-light');
    await consoleCode('s.querySelector(".game-tasks [data-game-action=open]").click();');
    assert.ok(await consoleCode('return s.querySelector(".game-dialog").matches(":popover-open") && s.querySelector(".game-page").textContent.includes(c.game.career.current.definition.brief);'), 'Full briefing opens the inbox with the issued requirements');
    await gameAction('close');
    await page('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1120, deviceScaleFactor: 1, mobile: false });
    await evaluate('scrollTo(0,0)');

    // A different desktop tab must not acquire the active career's write lock.
    const { targetId } = await send('Target.createTarget', { url: new URL('/reactor/', baseUrl).href });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const secondEvaluate = async expression => {
        const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    for (let attempt = 0; attempt < 100; attempt++) {
        if (await secondEvaluate('!!document.querySelector("nuclear-power-console")?.game?.hasSave')) break;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    const blocked = await secondEvaluate('(async()=>{const c=document.querySelector("nuclear-power-console");await c.game.action("continue");return {career:!!c.game.career,status:c.game.status};})()');
    assert.equal(blocked.career, false); assert.match(blocked.status, /another tab/);
    await send('Target.closeTarget', { targetId }); await page('Page.bringToFront');

    await gameAction('return');
    await ready('!c.game.career', 'Return restores free operation');
    assert.equal(await consoleCode('return s.querySelector(".game-tasks").hidden;'), true);
    assert.equal(await consoleCode('return c.simulation.pumpA;'), true, 'Original free plant retained');
    assert.equal(await consoleCode('return c.simulation.running;'), false);
    await page('Page.reload');
    await ready('c?.game?.hasSave', 'Reload offers saved career');
    assert.equal(await consoleCode('return !!c.game.career;'), false, 'Reload starts free operation');
    await gameAction('continue');
    await ready('c.game.career && !c.game.busy', 'Career restored');
    assert.equal(await consoleCode('return c.simulation.paused;'), true);
    assert.deepEqual(await consoleCode('return {elapsed:c.simulation.elapsed,held:c.game.career.current.held,strength:c.simulation.components.turbineIntegrity.strength};'), saved);
    assert.equal(await consoleCode('return c.game.career.state.achievements.length;'), 1);
    assert.deepEqual(await steps(), savedSteps, 'Continue restores the checklist from saved plant and mission evidence');
    await consoleCode('c.act("reset");');
    assert.equal(await consoleCode('return c.simulation.elapsed;'), saved.elapsed, 'Reset demo cannot erase a career');
    await gameAction('resume'); await ready('!c.game.busy', 'Restored shift resumes');
    await advance(300); await tab('assignments'); await gameAction('report');
    await ready('c.game.career.state.achievements.length===2 && !c.game.busy', 'Reliability goal achieved');
    await gameAction('open'); await tab('archive'); await screenshot('career-completed-reports');
    assert.equal(await consoleCode('return s.querySelector(".game-tasks").hidden;'), true, 'Completed commissioning has no active steps');
    assert.equal(await consoleCode('return c.game.career.current;'), undefined);
    // A failed write remains visible outside the company window and cannot claim success.
    assert.equal(await consoleCode('window.originalCareerWriter=c.game.store.write.bind(c.game.store);c.game.store.write=async()=>{throw new Error("Test storage unavailable");};return c.game.save(true);'), false);
    assert.ok(await consoleCode('return !s.querySelector(".game-error").hidden && s.querySelector(".game-error").textContent.includes("storage unavailable");'));
    await consoleCode('c.game.store.write=window.originalCareerWriter;return c.game.save(true);');
    assert.equal(await consoleCode('return s.querySelector(".game-error").hidden;'), true);
    // Detach/reconnect preserves the save and reacquires ownership before ticking.
    await consoleCode('window.retainedConsole=c;c.remove();document.querySelector("#root .nuclear-power-view").append(c);');
    await ready('c?.game.owner && !c.game.attaching', 'Reconnected element reacquires career lock');
    assert.equal(await consoleCode('return c.simulation.paused;'), true);
    await gameAction('return'); await ready('!c.game.career', 'Finished career saved');
    await consoleCode('c.setTheme("dark");'); await action('reset');
}
