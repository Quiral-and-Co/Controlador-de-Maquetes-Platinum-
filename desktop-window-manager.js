(() => {
  'use strict';
  const records = [];
  let workspace = null;
  let taskbar = null;
  let shellRecord = null;
  let zIndex = 20;
  let activeMode = 'classic';

  const titleFor = node => {
    const heading = node.querySelector('h1,h2,h3,[aria-labelledby]');
    if (heading) {
      const labelled = heading.getAttribute('aria-labelledby');
      const label = labelled ? document.getElementById(labelled)?.textContent : '';
      return (label || heading.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 64);
    }
    return node.classList.contains('summary-grid') ? 'Estat de la maqueta' : 'Eina de treball';
  };

  function makeWindow(node, title, bounds) {
    const placeholder = document.createComment('JMRI desktop window position');
    node.parentNode.insertBefore(placeholder, node);
    const win = document.createElement('section');
    win.className = 'desktop-window';
    win.setAttribute('role', 'region');
    win.setAttribute('aria-label', title);
    win.style.left = bounds.x + 'px';
    win.style.top = bounds.y + 'px';
    win.style.width = bounds.w + 'px';
    win.style.height = bounds.h + 'px';
    win.style.zIndex = String(++zIndex);

    const bar = document.createElement('header');
    bar.className = 'desktop-window-titlebar';
    const caption = document.createElement('strong');
    caption.textContent = title;
    const controls = document.createElement('div');
    controls.className = 'desktop-window-controls';
    const minimize = document.createElement('button');
    minimize.type = 'button';
    minimize.textContent = '—';
    minimize.title = 'Minimitzar finestra';
    minimize.setAttribute('aria-label', 'Minimitzar ' + title);
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.title = 'Amagar finestra';
    close.setAttribute('aria-label', 'Amagar ' + title);
    controls.append(minimize, close);
    bar.append(caption, controls);
    const content = document.createElement('div');
    content.className = 'desktop-window-content';
    content.append(node);
    win.append(bar, content);
    workspace.append(win);

    const task = document.createElement('button');
    task.type = 'button';
    task.className = 'desktop-task';
    task.textContent = title;
    task.title = 'Mostrar ' + title;
    task.addEventListener('click', () => {
      win.hidden = false;
      win.style.zIndex = String(++zIndex);
      task.classList.add('is-open');
    });
    const hide = () => { win.hidden = true; task.classList.remove('is-open'); };
    minimize.addEventListener('click', hide);
    close.addEventListener('click', hide);
    bar.addEventListener('pointerdown', event => {
      if (event.target.closest('button')) return;
      if (event.button !== 0) return;
      event.preventDefault();
      win.style.zIndex = String(++zIndex);
      const startX = event.clientX, startY = event.clientY;
      const startLeft = win.offsetLeft, startTop = win.offsetTop;
      bar.setPointerCapture?.(event.pointerId);
      const move = e => {
        win.style.left = Math.max(0, startLeft + e.clientX - startX) + 'px';
        win.style.top = Math.max(0, startTop + e.clientY - startY) + 'px';
      };
      const end = () => {
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', end);
        bar.removeEventListener('pointercancel', end);
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', end);
      bar.addEventListener('pointercancel', end);
    });
    win.addEventListener('pointerdown', () => { win.style.zIndex = String(++zIndex); });
    taskbar.append(task);
    records.push({ node, placeholder, win, task });
  }

  function enterModern() {
    if (workspace) return;
    const main = document.querySelector('main');
    if (!main) return;
    const notice = main.querySelector(':scope > .notice');
    const toolbar = main.querySelector(':scope > .toolbar');
    workspace = document.createElement('div');
    workspace.className = 'desktop-workspace';
    workspace.setAttribute('aria-label', 'Espai de treball amb finestres flotants');
    taskbar = document.createElement('nav');
    taskbar.className = 'desktop-taskbar';
    taskbar.setAttribute('aria-label', 'Finestres obertes');
    main.append(workspace, taskbar);

    let x = 18, y = 18;
    const add = (node, title, w, h, left, top, initiallyHidden = false) => {
      if (!node) return;
      const record = makeWindow(node, title, { x: left ?? x, y: top ?? y, w, h });
      if (initiallyHidden) record.win.hidden = true;
      x += 34; y += 28;
      if (x > 760) x = 18;
      if (y > 500) y = 18;
    };

    const editor = main.querySelector(':scope > .editor-shell');
    if (editor) {
      shellRecord = { node: editor, placeholder: document.createComment('JMRI editor shell position') };
      editor.parentNode.insertBefore(shellRecord.placeholder, editor);
      const sidebar = editor.querySelector('.editor-sidebar');
      const board = editor.querySelector('.track-area');
      const properties = editor.querySelector('.properties-panel');
      add(sidebar, 'Nivells i catàleg de vies', 310, 650, 12, 12);
      add(board, 'Tauler de disseny de la maqueta', 780, 650, 332, 12);
      add(properties, 'Propietats i geometria XYZ', 320, 650, 1120, 12);
      editor.remove();
    }

    const direct = [...main.children].filter(node =>
      node !== notice && node !== toolbar && node !== workspace && node !== taskbar &&
      node !== shellRecord?.placeholder && node.matches('section, .resource-grid, .monitor-grid')
    );
    direct.forEach(node => {
      let title = titleFor(node);
      if (node.classList.contains('summary-grid')) title = 'Estat de la maqueta';
      if (node.id === 'commandStationPanel') title = 'Centrals digitals';
      const wide = /dispatcher|traffic|signalling|spielewelt|locomotive|train|protection|ground/i.test(node.className + ' ' + node.id);
      add(node, title, wide ? 760 : 520, wide ? 520 : 360, undefined, undefined, true);
    });
    if (notice) notice.classList.add('desktop-notice');
    if (toolbar) toolbar.classList.add('desktop-commandbar');
  }

  function leaveModern() {
    if (!workspace) return;
    for (const record of [...records].reverse()) {
      if (record.placeholder.parentNode) record.placeholder.parentNode.insertBefore(record.node, record.placeholder);
      record.placeholder.remove();
      record.win.remove();
      record.task.remove();
    }
    records.length = 0;
    if (shellRecord) {
      shellRecord.placeholder.parentNode?.insertBefore(shellRecord.node, shellRecord.placeholder);
      shellRecord.placeholder.remove();
      shellRecord = null;
    }
    workspace.remove();
    taskbar.remove();
    workspace = taskbar = null;
    document.querySelector('.notice')?.classList.remove('desktop-notice');
    document.querySelector('.toolbar')?.classList.remove('desktop-commandbar');
  }

  window.JMRI_TC_DESKTOP = Object.freeze({
    setMode(mode) {
      const next = mode === 'modern' ? 'modern' : 'classic';
      if (next === activeMode) return;
      activeMode = next;
      if (next === 'modern') enterModern();
      else leaveModern();
    },
    getWindows() { return records.map(({ win }) => ({ title: win.getAttribute('aria-label'), visible: !win.hidden })); }
  });
})();
