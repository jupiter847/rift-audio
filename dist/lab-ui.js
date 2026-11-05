const components = {
  cushion: {
    code: 'N01 / CSH-01', number: '01 / CONTACT SURFACE',
    title: ['SOFT-TOUCH.', 'LONG-SESSION.'],
    copy: 'Trace the cushion mesh, its open centre and the recessed driver surface.',
    parts: ['CONTACT RING', 'CUSHION SEAM', 'DRIVER OPENING'],
  },
  frame: {
    code: 'N01 / FRM-02', number: '02 / STRUCTURAL CORE',
    title: ['LIGHT FRAME.', 'SOLID FEEL.'],
    copy: 'An open structural frame. Follow the bridge, sliding rails and pivot points in a mesh view.',
    parts: ['SEGMENTED BRIDGE', 'SLIDING RAILS', 'PIVOT JOINTS'],
  },
  controls: {
    code: 'N01 / CTL-03', number: '03 / HUMAN INTERFACE',
    title: ['LESS LOOKING.', 'MORE LISTENING.'],
    copy: 'Explore the raised controls and layered cup shell. Each part has a position you can find by touch.',
    parts: ['TACTILE WHEEL', 'MODE BUTTONS', 'CONNECTION PORTS'],
  },
};

export function installComponentLabUI() {
  const root = document.querySelector('#component-lab');
  if (!root) return { destroy() {} };
  const find = (selector) => root.querySelector(selector);
  const buttons = [...root.querySelectorAll('[data-component]')];
  const surfaceButtons = [...root.querySelectorAll('[data-surface]')];
  let component = 'frame';
  let surface = 'wireframe';
  let highlight = null;
  let desiredHighlight = null;
  let constructing = false;
  let viewer = null;
  let pending = null;
  let disposed = false;
  let failed = false;
  let announceTimer;
  const removals = [];

  function announce() {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      const detail = highlight ? ` Detail ${highlight}: ${components[component].parts[highlight.charCodeAt(0) - 65]}.` : '';
      find('#lab-status').textContent = `${component[0].toUpperCase()}${component.slice(1)} selected. ${surface === 'wireframe' ? 'Wireframe' : 'Solid'} view.${detail} Drag or use the arrow keys to turn the part.`;
    }, 180);
  }

  function renderSelection() {
    const content = components[component];
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.component === component)));
    surfaceButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.surface === surface)));
    find('#lab-model-code').textContent = content.code;
    find('#lab-part-number').textContent = content.number;
    const heading = find('#lab-feature-heading');
    heading.replaceChildren(document.createTextNode(content.title[0]), document.createElement('br'), document.createTextNode(content.title[1]));
    find('#lab-feature-copy').textContent = content.copy;
    const list = find('#lab-part-list');
    list.replaceChildren(...content.parts.map((part, index) => {
      const item = document.createElement('li');
      const marker = document.createElement('span');
      marker.textContent = String.fromCharCode(65 + index);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.highlight = marker.textContent;
      button.setAttribute('aria-pressed', String(highlight === marker.textContent));
      button.disabled = failed;
      const arrow = document.createElement('i');
      arrow.textContent = '↗';
      arrow.setAttribute('aria-hidden', 'true');
      button.append(marker, document.createTextNode(part), arrow);
      item.append(button);
      return item;
    }));
    find('#lab-geometry-type').textContent = surface === 'wireframe' ? 'TRIANGULATED MESH' : 'SHADED SURFACE';
    find('#component-canvas').setAttribute('aria-label', `Interactive 3D ${component} geometry in ${surface} view. Drag or use arrow keys to rotate. Home resets the view.`);
    root.dataset.component = component;
    root.dataset.surfaceMode = surface;
    root.querySelectorAll('[data-fallback-part]').forEach((group) => group.toggleAttribute('hidden', group.dataset.fallbackPart !== component));
    announce();
  }

  function showFallback() {
    if (disposed) return;
    failed = true;
    find('#component-canvas').hidden = true;
    find('#lab-loading').hidden = true;
    find('#lab-fallback').hidden = false;
    find('#lab-reset').disabled = true;
    surface = 'wireframe';
    surfaceButtons.forEach((button) => { button.disabled = true; });
    find('#lab-part-list').querySelectorAll('button').forEach(button => { button.disabled = true; });
    find('#lab-vertices').textContent = '—';
    find('#lab-triangles').textContent = '—';
    root.dataset.renderer = 'static';
    renderSelection();
  }

  function onChange(state) {
    if (disposed || failed || state.component !== component) return;
    if (!constructing) {
      const previousHighlight = highlight;
      highlight = state.highlight || null;
      desiredHighlight = highlight;
      find('#lab-part-list').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.highlight === highlight)));
      if (highlight !== previousHighlight) announce();
    }
    for (const [key, selector] of [['vertices', '#lab-vertices'], ['triangles', '#lab-triangles']]) {
      find(selector).textContent = Number.isFinite(state[key]) ? Math.round(state[key]).toLocaleString('en-US') : '—';
    }
  }

  function ensureViewer() {
    if (disposed || failed) return Promise.resolve(null);
    if (pending) return pending;
    pending = (async () => {
      try {
        const { createComponentLab } = await import('./component-lab.js?v=4');
        constructing = true;
        const created = await createComponentLab(find('#component-canvas'), {
          onReady: () => {
            if (disposed || failed) return;
            find('#lab-loading').hidden = true;
            root.dataset.renderer = 'webgl';
            root.dataset.ready = 'true';
          },
          onError: showFallback,
          onChange,
        });
        if (disposed) { created?.destroy(); return null; }
        viewer = created;
        if (!failed) {
          viewer.selectComponent(component);
          viewer.setSurfaceMode(surface);
          constructing = false;
          viewer.setHighlight(desiredHighlight);
        }
        return viewer;
      } catch { showFallback(); return null; }
    })();
    return pending;
  }

  function listen(element, name, handler, options) {
    element.addEventListener(name, handler, options);
    removals.push(() => element.removeEventListener(name, handler, options));
  }

  buttons.forEach((button) => listen(button, 'click', () => {
    component = button.dataset.component;
    highlight = null;
    desiredHighlight = null;
    renderSelection();
    if (viewer && !failed) viewer.selectComponent(component);
    else ensureViewer();
  }));
  surfaceButtons.forEach((button) => listen(button, 'click', () => {
    surface = button.dataset.surface;
    renderSelection();
    if (viewer && !failed) viewer.setSurfaceMode(surface);
    else ensureViewer();
  }));
  listen(find('#lab-reset'), 'click', () => { viewer?.reset(); announce(); });
  listen(find('#lab-part-list'), 'click', (event) => {
    const button = event.target.closest('button[data-highlight]');
    if (!button || failed) return;
    highlight = highlight === button.dataset.highlight ? null : button.dataset.highlight;
    desiredHighlight = highlight;
    find('#lab-part-list').querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.highlight === highlight)));
    if (viewer) viewer.setHighlight(highlight); else ensureViewer();
    announce();
  });
  listen(root, 'focusin', ensureViewer, { once: true });
  listen(root, 'pointerenter', ensureViewer, { once: true });

  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); ensureViewer(); }
  }, { rootMargin: '250px' });
  observer.observe(root);
  renderSelection();

  return {
    destroy() {
      disposed = true;
      observer.disconnect();
      clearTimeout(announceTimer);
      removals.forEach((remove) => remove());
      viewer?.destroy();
    },
  };
}
