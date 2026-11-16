/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
export const SERVER_BUILDING = { position: [-1.3, -.35, -12.5], label: [-1.3, 4, -12.5] };

export function buildServerBuilding(view) {
    const hall = view.component('computers', SERVER_BUILDING.position);
    hall.name = 'server-warehouse';
    const wall = view.material('#82959f'), roof = view.material('#4c6575');
    view.box(hall, [5, .25, 3.6], view.base, [0, .05, 0]);
    view.box(hall, [4.8, 2.9, .15], wall, [0, 1.6, -1.5]);
    for (const x of [-2.3, 2.3]) view.box(hall, [.16, 2.9, 3], wall, [x, 1.6, 0]);
    view.box(hall, [5, .18, 3.5], roof, [0, 3.12, -.15]);
    // Open front makes this building visibly different from the process equipment.
    const lamp = view.material('#59d8b0', { emissive: '#59d8b0', emissiveIntensity: .5 });
    view.serverBuildingLamp = lamp;
    for (const x of [-1.45, 0, 1.45]) {
        view.box(hall, [1, 2.3, 1.1], view.darkSteel, [x, 1.4, -.2]);
        for (let row = 0; row < 6; row++) {
            view.box(hall, [.82, .25, .08], view.steel, [x, .5 + row * .34, .4]);
            view.box(hall, [.08, .07, .04], lamp, [x + .28, .5 + row * .34, .46]);
        }
    }
    for (const x of [-1.4, 1.4]) {
        view.box(hall, [.8, .3, .9], view.steelLight, [x, 3.35, -.3]);
        for (let i = 0; i < 5; i++) view.box(hall, [.7, .025, .035], roof, [x, 3.51, -.6 + i * .15]);
    }
}

export function updateServerBuilding(view, computers) {
    const color = computers.automationAvailable ? '#59d8b0' : '#edaa59';
    view.serverBuildingLamp.color.set(color);
    view.serverBuildingLamp.emissive.set(color);
    view.serverBuildingLamp.emissiveIntensity = computers.powered ? .5 : 0;
}
