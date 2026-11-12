/*
 * Pörssiohjain - Energy usage optimization platform
 * Copyright (C) 2026 Martin Kankaanranta / Nitramite Tmi
 * Licensed under the Pörssiohjain Personal Use License v1.0.
 */
import { createElement } from 'react';
import './simulation/nuclear-power.js';

export default function App() {
  const companion = window.location.pathname.replace(/index\.html$/, '') === '/companion/';
  return (
    <div className="nuclear-power-view" lang="en">
      {createElement('nuclear-power-console', companion ? { screen: 'companion' } : {})}
    </div>
  );
}
