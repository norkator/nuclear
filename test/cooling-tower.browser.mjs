/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import assert from 'node:assert/strict';

export async function checkCoolingTower({ consoleCode, action, page, until, screenshot, warmOperatingPoint }) {
    const showOverview = async () => {
        // Scrolling and full-page captures can suspend the overview independently
        // of the plant. Wait for its visibility observer before reading particles.
        await consoleCode(`s.querySelector('.diagram-viewport').scrollIntoView({block:'center'});
            return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));`);
        await until(`(()=>{const c=document.querySelector('nuclear-power-console');return c.intersecting && c.overviewIntersecting && !document.hidden;})()`, 'Cooling tower overview did not become visible');
    };
    await page('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await until(`!!document.querySelector('nuclear-power-console')?.overviewScene?.coolingTower`, 'Cooling tower did not build');
    await showOverview();
    assert.equal(await consoleCode('return c.overviewScene.coolingTower.plume.mesh.count;'), 0);
    assert.ok(await consoleCode(`return s.querySelector('[data-scene-feature="cooling-tower"]').textContent.includes('No heat rejection');`));
    await screenshot('cooling-tower-cold');
    await warmOperatingPoint();
    await until(`document.querySelector('nuclear-power-console').overviewScene.coolingTower.plume.mesh.count > 0`, 'Hot circulation produced no tower vapor');
    const phase = await consoleCode('return c.processMotion.coolingTowerPhase;');
    await until(`document.querySelector('nuclear-power-console').processMotion.coolingTowerPhase !== ${phase}`, 'Tower plume did not advance');
    await action('pause');
    const frozen = await consoleCode('return {phase:c.processMotion.coolingTowerPhase,matrices:[...c.overviewScene.coolingTower.plume.mesh.instanceMatrix.array]};');
    await screenshot('cooling-tower-running-dark');
    assert.deepEqual(await consoleCode('return {phase:c.processMotion.coolingTowerPhase,matrices:[...c.overviewScene.coolingTower.plume.mesh.instanceMatrix.array]};'), frozen);
    await consoleCode('c.setTheme("light");');
    await screenshot('cooling-tower-running-light');
    await consoleCode('c.setTheme("dark");');
    await showOverview();
    const density = await consoleCode(`
        const sim=c.simulation, actual=sim.components.items.condenser.actual;
        const saved={temperature:sim.secondaryTemperature,cooling:actual.coolingFactor};
        sim.secondaryTemperature=90;c.update();
        const low=c.overviewScene.coolingTower.plume.mesh.count;
        sim.secondaryTemperature=220;c.update();
        const high=c.overviewScene.coolingTower.plume.mesh.count;
        sim.components.items.condenser.settings.coolingValve=0;c.update();
        const requested=c.overviewScene.coolingTower.plume.mesh.count;
        actual.coolingFactor=0;c.update();
        const blocked=c.overviewScene.coolingTower.plume.mesh.count;
        actual.coolingFactor=saved.cooling;sim.secondaryTemperature=saved.temperature;
        sim.components.items.condenser.settings.coolingValve=100;c.update();
        return {low,high,requested,blocked};`);
    assert.ok(density.high > density.low && density.low > 0, `Tower vapor must increase with actual heat: ${JSON.stringify(density)}`);
    assert.equal(density.requested, density.high, 'Requested valve changes must not substitute for actual cooling');
    assert.equal(density.blocked, 0);
    await action('stop');
    assert.ok(await consoleCode('return !c.simulation.running && c.overviewScene.coolingTower.plume.mesh.count > 0;'), 'Retained hot circulation should still reject heat');
    // Tower surfaces share condenser picking, preserving the existing control window.
    assert.equal(await consoleCode('return c.overviewScene.coolingTower.group.userData.equipment;'), 'condenser');
    const towerPoint = await consoleCode(`
        const view=c.overviewScene, point=view.coolingTower.group.position.clone();
        point.y+=5;point.z+=2;point.project(view.camera);
        const rect=view.renderer.domElement.getBoundingClientRect();
        return {x:rect.x+(point.x+1)*rect.width/2,y:rect.y+(1-point.y)*rect.height/2};`);
    await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...towerPoint, button: 'left', buttons: 1, clickCount: 1 });
    await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...towerPoint, button: 'left', buttons: 0, clickCount: 1 });
    assert.ok(await consoleCode(`return s.querySelector('[data-component-dialog="condenser"]').matches(':popover-open');`));
    await consoleCode(`c.closeFloatingDialog(s.querySelector('[data-component-dialog="condenser"]'));`);
    await consoleCode(`s.querySelector('[data-scene-feature="cooling-tower"]').click();`);
    assert.ok(await consoleCode(`return s.querySelector('[data-component-dialog="condenser"]').matches(':popover-open');`));
    await consoleCode(`c.closeFloatingDialog(s.querySelector('[data-component-dialog="condenser"]'));`);
    assert.ok(await consoleCode('return c.overviewScene.renderer.info.programs.every(program=>program.diagnostics?.runnable!==false);'), 'Cooling tower shaders must compile');
    await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await action('pause');
    const reduced = await consoleCode('return c.processMotion.coolingTowerPhase;');
    await screenshot('cooling-tower-reduced-motion');
    assert.equal(await consoleCode('return c.processMotion.coolingTowerPhase;'), reduced);
    await page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await showOverview();
    await screenshot('cooling-tower-mobile');
    await action('reset');
    await showOverview();
    await until(`document.querySelector('nuclear-power-console').overviewScene.coolingTower.plume.mesh.count === 0`, 'Reset did not clear tower vapor after the overview became visible');
    await page('Emulation.setEmulatedMedia', { features: [] });
    await page('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1120, deviceScaleFactor: 1, mobile: false });
    await consoleCode('window.scrollTo(0,0);');
    await action('reset');
}
