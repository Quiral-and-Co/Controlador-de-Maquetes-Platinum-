(() => {
  'use strict';
  const icons = {
    home: ['#2878d0','M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5z'],
    folder: ['#d99a22','M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2h7.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z'],
    save: ['#23966b','M4 3h13l4 4v14H3V4a1 1 0 0 1 1-1zm3 0v6h9V3M7 21v-8h10v8'],
    edit: ['#a36ad1','M4 16.5 16.8 3.7a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L7.5 20H4zM14.5 6l3.5 3.5'],
    delete: ['#d65353','M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6'],
    connect: ['#249b9b','M8 8 5 5m14 14-3-3M8 16l-3 3m14-14-3 3M9 12h6'],
    train: ['#2878d0','M6 3h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 4h12v6H6zm2 12-2 3m10-3 2 3M8 16h.01M16 16h.01'],
    steamLocomotive: ['#2878d0','M3 20h18M4 18h16M5 16V9h4V7h3v3h7v6M5 11h14M8 7V5h2v2M12 10V8h2v2M17 10V7h1v3M4 9c-1-1-1-2 0-3 1-1 2-1 3 0 1-2 4-2 5 0 2-1 4 0 4 2 2-1 4 1 3 3M7 16a2 2 0 1 0 4 0m1 0a2 2 0 1 0 4 0m1 0a2 2 0 1 0 4 0M19 7V4h1v3'],
    list: ['#2c9b76','M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01'],
    settings: ['#7b8797','M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4'],
    zoom: ['#2d83c7','M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM16 16l5 5M10.5 7v7m-3.5-3.5h7'],
    ruler: ['#bd7b37','M3 7h18v10H3zM7 7v4m4-4v2m4-2v4m4-4v2'],
    shield: ['#269b78','M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6zM8 12l2.5 2.5L16 9'],
    window: ['#5b80c9','M3 4h18v16H3zM3 8h18M7 6h.01M10 6h.01'],
    help: ['#8b67c7','M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm-2.5-11a2.5 2.5 0 1 1 4.5 1.5c-1.5 1-2 1.5-2 3m0 3h.01'],
    copy: ['#5485bf','M8 8V4h12v12h-4M4 8h12v12H4z'],
    cut: ['#c66b9b','M6 6l12 12M18 6 6 18M6 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm12 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'],
    paste: ['#c18a36','M9 4h6l1 2h3v15H5V6h3zm0 0a3 3 0 0 1 6 0'],
    route: ['#279b88','M5 5h.01M19 19h.01M5 5c0 8 14 3 14 14M5 5l3 3m11 11-3-3'],
    measure: ['#ba803c','M3 17 17 3l4 4L7 21H3zm5-1 2 2m1-5 2 2m1-5 2 2'],
    eye: ['#238bba','M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6zm9.5-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
    minimize: ['#64748b','M4 12h16'],
    cascade: ['#9a6ac7','M5 5h12v12H5zM8 8h12v12H8'],
    grid: ['#269b78','M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z'],
    columns: ['#2b83b8','M4 4h7v16H4zM13 4h7v16h-7zM7.5 7v10m9-10v10'],
    columnsWide: ['#3977a8','M3 4h5v16H3zM9.5 4h5v16h-5zM16 4h5v16h-5z'],
    dockLeft: ['#2878d0','M4 3h16v18H4zM9 3v18M12 8h5m-5 4h5m-5 4h5'],
    dockRight: ['#2878d0','M4 3h16v18H4zM15 3v18M7 8h5M7 12h5m-5 4h5'],
    dockTop: ['#269b78','M4 4h16v16H4zM4 9h16M8 6.5h8'],
    dockBottom: ['#269b78','M4 4h16v16H4zM4 15h16M8 18h8'],
    restore: ['#b47b32','M5 8V4h15v12h-4M4 12h12v8H4zM7 16h6'],
    editor: ['#2b83b8','M3 4h8v7H3zM13 4h8v4h-8zM13 10h8v10h-8zM3 13h8v7H3z'],
    dispatcher: ['#268b62','M3 18h18M5 15V8l7-4 7 4v7M8 15v-3h8v3M10 8h4'],
    traffic: ['#2878d0','M6 3h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 4h12v6H6zm2 12-2 3m10-3 2 3'],
    calendar: ['#b47b32','M4 5h16v16H4zM8 3v4m8-4v4M4 9h16M8 13h3m2 0h3m-8 4h3'],
    operation: ['#8b67c7','M4 5h6v6H4zM14 13h6v6h-6zM10 8h4v8m-2-2 2 2 2-2'],
    health: ['#c05b76','M3 12h4l2-5 4 10 2-5h6'],
    default: ['#64748b','M4 4h16v16H4zM8 8h8v8H8z']
  };
  const windowCommandIcons = {
    windowShowAll: 'eye',
    windowMinimizeAll: 'minimize',
    windowCascade: 'cascade',
    windowTile: 'grid',
    windowTileTwoColumns: 'columns',
    windowTileColumns: 'columnsWide',
    windowDockLeft: 'dockLeft',
    windowDockRight: 'dockRight',
    windowDockTop: 'dockTop',
    windowDockBottom: 'dockBottom',
    windowRestoreLayout: 'restore',
    windowShowEditor: 'editor',
    windowShowDispatcher: 'dispatcher',
    windowShowTraffic: 'steamLocomotive',
    windowShowSchedules: 'calendar',
    windowShowOperation: 'operation',
    windowShowMetgeQuiral: 'health'
  };
  const commandIcon = command => {
    if (windowCommandIcons[command]) return windowCommandIcons[command];
    if (/^(new|open|save|saveAs)$/.test(command)) return command === 'new' ? 'folder' : command === 'open' ? 'folder' : 'save';
    if (/undo|redo|cut|copy|paste|delete/.test(command)) return /undo|redo/.test(command) ? 'edit' : command;
    if (/connect|disconnect/.test(command)) return 'connect';
    if (/train|engine|car|couple|uncouple/.test(command)) return 'train';
    if (/dispatcher|traffic|schedule|operation|list|successor|route|flag|counter|event/.test(command)) return 'list';
    if (/zoom/.test(command)) return 'zoom';
    if (/measure/.test(command)) return 'measure';
    if (/topology|validate|safety|digital|diagnostic/.test(command)) return 'shield';
    if (/window/.test(command)) return 'window';
    if (/help|about|shortcut|contents|quick/.test(command)) return 'help';
    if (/parallel|gap|port|track|selectAll/.test(command)) return 'route';
    if (/commandStation|status|config/.test(command)) return 'settings';
    return 'default';
  };
  document.querySelectorAll('#modernRibbon [data-ribbon-command]').forEach(button => {
    const label = button.textContent.trim();
    if (!label || button.disabled || button.dataset.iconized === 'true') return;
    const command = button.dataset.ribbonCommand;
    const [color, path] = icons[commandIcon(command)] || icons.default;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('ribbon-icon');
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x','1'); bg.setAttribute('y','1'); bg.setAttribute('width','22'); bg.setAttribute('height','22'); bg.setAttribute('rx','6'); bg.setAttribute('fill',color); bg.setAttribute('opacity','.13');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', path); p.setAttribute('stroke',color); p.setAttribute('stroke-width','1.8'); p.setAttribute('stroke-linecap','round'); p.setAttribute('stroke-linejoin','round'); p.setAttribute('fill','none');
    svg.append(bg,p);
    button.dataset.ribbonLabel = label;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('data-tooltip', label);
    button.replaceChildren(svg);
    button.classList.add('ribbon-icon-button');
    button.dataset.iconized = 'true';
  });
})();
