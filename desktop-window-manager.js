(() => {
  'use strict';
  const records = [];
  let workspace = null;
  let taskbar = null;
  let shellRecord = null;
  let zIndex = 20;
  // No mode is applied until app.js sends its initial state. This ensures
  // the default modern mode actually builds the floating-window workspace.
  let activeMode = null;

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
    const maximize = document.createElement('button');
    maximize.type = 'button'; maximize.textContent = '□';
    maximize.title = 'Maximitzar / restaurar finestra';
    maximize.setAttribute('aria-label', 'Maximitzar o restaurar ' + title);
    const original = document.createElement('button');
    original.type = 'button'; original.textContent = '↺';
    original.title = 'Restaurar mida i posició originals';
    original.setAttribute('aria-label', 'Restaurar mida original de ' + title);
    const dock = document.createElement('button');
    dock.type = 'button'; dock.textContent = '⇥';
    dock.title = 'Ancorar a la dreta (clic repetit: esquerra)';
    dock.setAttribute('aria-label', 'Ancorar ' + title);
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = '×';
    close.title = 'Amagar finestra';
    close.setAttribute('aria-label', 'Amagar ' + title);
    controls.append(minimize, maximize, original, dock, close);
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
    const boundsNow = () => ({ x: win.offsetLeft, y: win.offsetTop, w: win.offsetWidth, h: win.offsetHeight });
    const saveRestoreBounds = () => { if (!win.classList.contains('is-maximized') && !win.classList.contains('is-docked')) record.restore = boundsNow(); };
    const applyBounds = b => { win.style.left=b.x+'px'; win.style.top=b.y+'px'; win.style.width=b.w+'px'; win.style.height=b.h+'px'; };
    const restorePrevious = () => {
      if (win.classList.contains('is-maximized') || win.classList.contains('is-docked')) {
        applyBounds(record.restore || record.initial); win.classList.remove('is-maximized','is-docked');
      } else if (record.restore) applyBounds(record.restore);
    };
    const maximizeWindow = () => {
      if (win.classList.contains('is-maximized')) { restorePrevious(); return; }
      saveRestoreBounds(); win.classList.remove('is-docked'); win.classList.add('is-maximized');
      applyBounds({x:6,y:6,w:Math.max(280,workspace.clientWidth-12),h:Math.max(200,workspace.clientHeight-12)});
    };
    const restoreOriginal = () => { applyBounds(record.initial); win.classList.remove('is-maximized','is-docked'); record.restore=null; };
    const dockWindow = side => {
      if (!win.classList.contains('is-docked') && !win.classList.contains('is-maximized')) saveRestoreBounds();
      win.classList.remove('is-maximized'); win.classList.add('is-docked');
      const w=workspace.clientWidth||1440, h=workspace.clientHeight||900;
      const b={left:{x:6,y:6,w:w/2-9,h:h-12},right:{x:w/2+3,y:6,w:w/2-9,h:h-12},top:{x:6,y:6,w:w-12,h:h/2-9},bottom:{x:6,y:h/2+3,w:w-12,h:h/2-9}}[side];
      applyBounds(b);
    };
    minimize.addEventListener('click', hide);
    maximize.addEventListener('click', maximizeWindow);
    original.addEventListener('click', restoreOriginal);
    dock.addEventListener('click', () => { const side=win.dataset.dockSide==='left'?'right':'left'; win.dataset.dockSide=side; dockWindow(side); });
    close.addEventListener('click', hide);
    bar.addEventListener('pointerdown', event => {
      if (event.target.closest('button')) return;
      if (event.button !== 0) return;
      event.preventDefault();
      win.style.zIndex = String(++zIndex);
      const startX = event.clientX, startY = event.clientY;
      if (win.classList.contains('is-maximized')) return;
      const startLeft = win.offsetLeft, startTop = win.offsetTop;
      saveRestoreBounds(); win.classList.remove('is-docked');
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
    const record = { node, placeholder, win, task, initial: { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h }, restore: null };
    records.push(record);
    win.addEventListener('dblclick', event => { if (event.target.closest('.desktop-window-titlebar') && !event.target.closest('button')) maximizeWindow(); });
    win.addEventListener('pointerdown', () => { if (win.classList.contains('is-maximized')) return; win.style.zIndex=String(++zIndex); });
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
    const add = (node, title, w, h, left, top) => {
      if (!node) return;
      makeWindow(node, title, { x: left ?? x, y: top ?? y, w, h });
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
      !node.matches('.modern-ribbon') &&
      node !== shellRecord?.placeholder && node.matches('section, .resource-grid, .monitor-grid')
    );
    direct.forEach(node => {
      let title = titleFor(node);
      if (node.classList.contains('summary-grid')) title = 'Estat de la maqueta';
      if (node.id === 'commandStationPanel') title = 'Centrals digitals';
      const wide = /dispatcher|traffic|signalling|spielewelt|locomotive|train|protection|ground/i.test(node.className + ' ' + node.id);
      const index = records.length - 3;
      add(node, title, 700, 500, 18 + (index % 2) * 720, 680 + Math.floor(index / 2) * 540);
    });
    workspace.style.minHeight = (700 + Math.ceil(direct.length / 2) * 540) + 'px';
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
    getWindows() { return records.map(({ win }) => ({ title: win.getAttribute('aria-label'), visible: !win.hidden })); },
    showAll() { records.forEach(({ win, task }) => { win.hidden = false; win.style.zIndex = String(++zIndex); task.classList.add('is-open'); }); },
    minimizeAll() { records.forEach(({ win, task }) => { win.hidden = true; task.classList.remove('is-open'); }); },
    focusWindow(query) {
      const needle = String(query || '').toLowerCase();
      const record = records.find(({ win }) => win.getAttribute('aria-label').toLowerCase().includes(needle));
      if (!record) return false;
      record.win.hidden = false; record.win.style.zIndex = String(++zIndex); record.task.classList.add('is-open'); return true;
    },
    restoreLayout() {
      records.forEach(({ win, task, initial, record }) => {
        win.hidden = false; win.classList.remove('is-maximized','is-docked'); win.style.left = initial.x + 'px'; win.style.top = initial.y + 'px';
        win.style.width = initial.w + 'px'; win.style.height = initial.h + 'px';
        win.style.zIndex = String(++zIndex); task.classList.add('is-open');
      });
    },
    cascade() {
      records.forEach(({ win, task }, index) => {
        win.hidden = false; win.style.left = (18 + index * 34) + 'px'; win.style.top = (18 + index * 28) + 'px';
        win.style.zIndex = String(++zIndex); task.classList.add('is-open');
      });
    },
    dock(side) {
      if (!workspace) return;
      records.forEach((record,index)=>{const {win,task}=record;if(!win.classList.contains('is-docked')&&!win.classList.contains('is-maximized'))record.restore={x:win.offsetLeft,y:win.offsetTop,w:win.offsetWidth,h:win.offsetHeight};win.hidden=false;win.classList.remove('is-maximized');win.classList.add('is-docked');const w=workspace.clientWidth||1440,h=workspace.clientHeight||900;const b={left:{x:6,y:6,w:w/2-9,h:h-12},right:{x:w/2+3,y:6,w:w/2-9,h:h-12},top:{x:6,y:6,w:w-12,h:h/2-9},bottom:{x:6,y:h/2+3,w:w-12,h:h/2-9}}[side];const n=records.length;const slot=side==='left'||side==='right'?Math.max(200,(h-12)/n):Math.max(260,(w-12)/n);if(side==='left'||side==='right'){b.y=6+index*slot;b.h=slot-6;}else{b.x=6+index*slot;b.w=slot-6;}win.style.left=b.x+'px';win.style.top=b.y+'px';win.style.width=b.w+'px';win.style.height=b.h+'px';win.style.zIndex=String(++zIndex);task.classList.add('is-open');});
    },
    tilePreset(preset='grid') {
      if (!workspace || !records.length) return;
      const count=records.length, cols=preset==='columns'?count:preset==='two-columns'?2:Math.ceil(Math.sqrt(count)), rows=Math.ceil(count/cols);
      const width=Math.max(260,Math.floor((workspace.clientWidth||1440)/cols)),height=Math.max(200,Math.floor((workspace.clientHeight||900)/rows));
      records.forEach(({win,task},index)=>{const col=index%cols,row=Math.floor(index/cols);win.hidden=false;win.classList.remove('is-maximized','is-docked');win.style.left=(col*width+6)+'px';win.style.top=(row*height+6)+'px';win.style.width=Math.max(240,width-12)+'px';win.style.height=Math.max(180,height-12)+'px';win.style.zIndex=String(++zIndex);task.classList.add('is-open');});
    },
    tile() {
      if (!workspace || !records.length) return;
      const count = records.length, columns = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / columns);
      const width = Math.max(280, Math.floor((workspace.clientWidth || 1440) / columns));
      const height = Math.max(220, Math.floor(760 / rows));
      records.forEach(({ win, task }, index) => {
        const col = index % columns, row = Math.floor(index / columns);
        win.hidden = false; win.classList.remove('is-maximized','is-docked'); win.style.left = (col * width + 8) + 'px'; win.style.top = (row * height + 8) + 'px';
        win.style.width = Math.max(260, width - 16) + 'px'; win.style.height = Math.max(200, height - 16) + 'px';
        win.style.zIndex = String(++zIndex); task.classList.add('is-open');
      });
    }
  });
})();
