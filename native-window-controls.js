(() => {
  'use strict';
  const api = window.jmriDesktop;
  if (!api || document.querySelector('[data-native-window-controls]')) return;
  const definitions = [
    ['switchboard','Panell d’accessoris (Switchboard)','🎛️'],['keyboard','Teclat d’accessoris (Keyboard)','⌨️'],
    ['routes','Rutes i itineraris (Routes)','🔀'],['schedules','Horaris (Schedules)','🗓️'],
    ['trainWindow','Finestra del tren (Train Window)','🚂'],['trainDetector','Detecció d’ocupació (Train Detector)','📍'],['editor','Editor de maqueta','🛤️'],['levels','Nivells','▤'],['catalogue','Catàleg de vies','🧩'],
    ['properties','Propietats i geometria XYZ','📐'],['dispatcher','Despatxador','🚦'],
    ['traffic','Trànsit i circulacions','🚆'],['operation','Operació','⚙️'],
    ['commandStation','Central digital','🎛️'],['locomotiveDmi','DMI de locomotora','🚄'],['rollingStock','Material mòbil ferroviari','🚃'],['trainProtection','Protecció del tren','🛡️'],
    ['trainGround','Terminal tren-terra','📡'],['spielewelt','Món de Jocs','🎮'],['signalling','Senyalització','🚥'],
    ['validation','Validació i seguretat','✓'],['diagnostics','Metge Quiral','🩺']
  ];
  const byType = new Map(definitions.map(item => [item[0], item]));
  const nativeType = new URLSearchParams(location.search).get('nativeWindow');
  const nativePanelId = ({ rollingStock: 'rollingStockPanel', locomotiveDmi: 'locomotiveDmiPanel' })[nativeType];
  if (nativePanelId) {
    const target = document.getElementById(nativePanelId);
    if (target) {
      const shell = target.closest('.desktop-window') || target;
      document.querySelectorAll('main > *').forEach(node => { node.hidden = node !== shell && !node.contains(shell); });
      document.querySelectorAll('.desktop-window').forEach(node => { node.hidden = node !== shell; });
      document.querySelector('.topbar')?.setAttribute('hidden', '');
      document.querySelector('footer')?.setAttribute('hidden', '');
      shell.hidden = false;
      shell.classList.add('native-panel-shell');
      shell.style.position = 'fixed';
      shell.style.left = '8px';
      shell.style.top = '8px';
      shell.style.width = 'calc(100vw - 16px)';
      shell.style.height = 'calc(100vh - 16px)';
      shell.style.maxWidth = 'none';
      shell.style.maxHeight = 'none';
      target.hidden = false;
      document.body.classList.add('native-panel-window');
      return;
    }
  }
  const storageKey = 'quiral.nativeWindowDock.v1';
  const defaults = { side: 'right', collapsed: true, favourites: ['editor','dispatcher','traffic','schedules','diagnostics'] };
  let preferences = { ...defaults };
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (stored && typeof stored === 'object') preferences = {
      side: stored.side === 'left' ? 'left' : 'right',
      collapsed: stored.collapsed !== false,
      favourites: Array.isArray(stored.favourites) ? stored.favourites.filter(type => byType.has(type)) : defaults.favourites
    };
  } catch (_) {}
  const persist = () => { try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch (_) {} };

  const style = document.createElement('style');
  style.textContent = '.native-dock{position:fixed;z-index:10000;top:112px;bottom:18px;width:248px;max-width:calc(100vw - 44px);display:flex;flex-direction:column;background:#172536;border:1px solid #49617a;border-radius:12px;box-shadow:0 12px 34px #0009;color:#edf4fb;transition:transform .2s ease}' +
    '.native-dock[data-side="right"]{right:10px}.native-dock[data-side="left"]{left:10px}.native-dock[data-collapsed="true"][data-side="right"]{transform:translateX(calc(100% + 12px))}.native-dock[data-collapsed="true"][data-side="left"]{transform:translateX(calc(-100% - 12px))}' +
    '.native-dock-head{display:flex;align-items:center;gap:6px;padding:10px;border-bottom:1px solid #3a5067}.native-dock-head strong{flex:1;font-size:13px}.native-dock button{padding:7px 9px;font-size:12px}' +
    '.native-dock-tools{display:flex;gap:6px;padding:8px;border-bottom:1px solid #3a5067;flex-wrap:wrap}.native-dock-list{overflow:auto;padding:8px;display:grid;gap:5px}' +
    '.native-dock-entry{display:grid;grid-template-columns:1fr auto auto;gap:5px;align-items:center}.native-dock-open{display:flex;align-items:center;gap:8px;text-align:left;min-width:0}.native-dock-open span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.native-dock-icon{width:24px;text-align:center;font-size:16px}.native-dock-fav{min-width:32px;padding:6px!important}.native-dock-status{padding:8px 10px;color:#b8c9da;font-size:11px;min-height:34px;border-top:1px solid #3a5067}' +
    '.native-dock-tab{position:fixed;z-index:10001;top:48%;padding:11px 7px;border:1px solid #49617a;background:#172536;color:#fff;cursor:pointer;box-shadow:0 4px 15px #0008}.native-dock-tab[data-side="right"]{right:0;border-radius:9px 0 0 9px}.native-dock-tab[data-side="left"]{left:0;border-radius:0 9px 9px 0}' +
    '.native-dock-favourites{padding:8px;border-bottom:1px solid #3a5067}.native-dock-favourites strong{display:block;font-size:11px;color:#b8c9da;margin:0 0 6px}.native-dock-fav-list{display:flex;gap:5px;flex-wrap:wrap}' +
    '.native-window-controls button{margin:3px}.native-window-controls .native-open-group{display:flex;flex-wrap:wrap;gap:3px}@media(max-width:700px){.native-dock{top:90px;bottom:8px;width:220px}}';
  document.head.append(style);

  const dock = document.createElement('aside');
  dock.className = 'native-dock';
  dock.setAttribute('aria-label', 'Barra lateral de finestres');
  const head = document.createElement('div'); head.className = 'native-dock-head';
  const heading = document.createElement('strong'); heading.textContent = 'Accés ràpid';
  const sideButton = document.createElement('button'); sideButton.type = 'button'; sideButton.textContent = '⇄'; sideButton.title = 'Canviar de costat';
  sideButton.setAttribute('aria-label', 'Canviar la barra al costat oposat');
  const collapseButton = document.createElement('button'); collapseButton.type = 'button'; collapseButton.textContent = '×'; collapseButton.title = 'Amagar la barra';
  collapseButton.setAttribute('aria-label', 'Amagar la barra lateral'); head.append(heading, sideButton, collapseButton);
  const tools = document.createElement('div'); tools.className = 'native-dock-tools';
  const display = document.createElement('select'); display.setAttribute('aria-label', 'Monitor de destinació');
  display.innerHTML = '<option value="">Monitor principal / recordat</option>';
  const showAll = document.createElement('button'); showAll.type = 'button'; showAll.textContent = 'Mostrar totes'; tools.append(display, showAll);
  const favourites = document.createElement('div'); favourites.className = 'native-dock-favourites';
  const favouritesTitle = document.createElement('strong'); favouritesTitle.textContent = 'Preferides';
  const favouriteList = document.createElement('div'); favouriteList.className = 'native-dock-fav-list'; favourites.append(favouritesTitle, favouriteList);
  const list = document.createElement('div'); list.className = 'native-dock-list';
  const status = document.createElement('div'); status.className = 'native-dock-status'; status.setAttribute('role','status');
  status.setAttribute('aria-live','polite'); status.textContent = 'Preparat per obrir finestres.';
  dock.append(head, tools, favourites, list, status); document.body.append(dock);
  const tab = document.createElement('button'); tab.type = 'button'; tab.className = 'native-dock-tab';
  tab.title = 'Mostrar accessos ràpids'; tab.setAttribute('aria-label','Mostrar barra lateral d’accessos ràpids'); document.body.append(tab);

  function renderDockState() {
    dock.dataset.side = preferences.side; dock.dataset.collapsed = String(preferences.collapsed);
    tab.dataset.side = preferences.side; tab.textContent = preferences.side === 'right' ? '◀' : '▶';
    tab.hidden = !preferences.collapsed; persist();
  }
  function open(type, duplicate = false) {
    const selected = display.value, label = byType.get(type)?.[1] || type;
    status.textContent = (duplicate ? 'Creant una còpia de ' : 'Obrint ') + label + '…';
    return api.openNativeWindow({ type, duplicate, ...(selected ? { displayId: selected } : {}) })
      .then(result => { status.textContent = label + (result.reused ? ' ja era oberta.' : duplicate ? ' duplicada.' : ' oberta.') + (result.displayId ? ' Pantalla: ' + result.displayId : ''); })
      .catch(error => { status.textContent = 'No s’ha pogut obrir: ' + error.message; });
  }
  function renderFavourites() {
    favouriteList.replaceChildren();
    preferences.favourites.forEach(type => {
      const item = byType.get(type); if (!item) return;
      const button = document.createElement('button'); button.type = 'button'; button.textContent = item[2];
      button.title = 'Obrir ' + item[1]; button.setAttribute('aria-label','Obrir ' + item[1]);
      button.addEventListener('click', () => open(type)); favouriteList.append(button);
    });
    if (!favouriteList.children.length) { const empty = document.createElement('span'); empty.textContent = 'Marca una estrella per afegir accessos.'; empty.className = 'small muted'; favouriteList.append(empty); }
  }
  function renderDefinitions() {
    list.replaceChildren();
    definitions.forEach(([type,label,glyph]) => {
      const entry = document.createElement('div'); entry.className = 'native-dock-entry';
      const launch = document.createElement('button'); launch.type = 'button'; launch.className = 'native-dock-open'; launch.title = 'Obrir ' + label;
      const icon = document.createElement('span'); icon.className = 'native-dock-icon'; icon.textContent = glyph;
      const text = document.createElement('span'); text.textContent = label; launch.append(icon,text); launch.addEventListener('click', () => open(type));
      const duplicate = document.createElement('button'); duplicate.type = 'button'; duplicate.textContent = '+'; duplicate.title = 'Obrir una còpia independent de ' + label;
      const duplicable = ['switchboard','keyboard','trainWindow'].includes(type);
      duplicate.hidden = !duplicable;
      duplicate.setAttribute('aria-label','Duplicar ' + label); duplicate.addEventListener('click', () => open(type,true));
      const favourite = document.createElement('button'); favourite.type = 'button'; favourite.className = 'native-dock-fav';
      const isFavourite = preferences.favourites.includes(type); favourite.textContent = isFavourite ? '★' : '☆';
      favourite.title = isFavourite ? 'Treure de preferides' : 'Afegir a preferides'; favourite.setAttribute('aria-label',favourite.title + ': ' + label);
      favourite.setAttribute('aria-pressed',String(isFavourite));
      favourite.addEventListener('click', () => {
        preferences.favourites = isFavourite ? preferences.favourites.filter(item => item !== type) : [...preferences.favourites,type];
        renderDefinitions(); renderFavourites(); persist();
      });
      entry.append(launch,duplicate,favourite); list.append(entry);
    });
  }
  sideButton.addEventListener('click', () => { preferences.side = preferences.side === 'right' ? 'left' : 'right'; renderDockState(); });
  collapseButton.addEventListener('click', () => { preferences.collapsed = true; renderDockState(); });
  tab.addEventListener('click', () => { preferences.collapsed = false; renderDockState(); });
  showAll.addEventListener('click', async () => {
    try { status.textContent = 'Finestres visibles: ' + await api.showAllNativeWindows(); } catch (error) { status.textContent = error.message; }
  });

  const page = document.querySelector('[data-ribbon-page="windows"]');
  if (page) {
    const group = document.createElement('div'); group.className = 'ribbon-group native-window-controls'; group.dataset.nativeWindowControls = 'true';
    const title = document.createElement('strong'); title.textContent = 'Finestres i monitors';
    const launchers = document.createElement('div'); launchers.className = 'native-open-group';
    definitions.forEach(([type,label,glyph]) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = glyph;
      button.title = 'Obrir ' + label + ' · Maj + clic per duplicar'; button.setAttribute('aria-label','Obrir ' + label);
      button.addEventListener('click', event => open(type,event.shiftKey)); launchers.append(button);
    });
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.textContent = 'Barra d’accés ràpid';
    toggle.addEventListener('click', () => { preferences.collapsed = !preferences.collapsed; renderDockState(); });
    group.append(title,launchers,toggle); page.append(group);
  }
  api.getDisplays().then(displays => {
    display.replaceChildren(new Option('Monitor principal / recordat',''));
    displays.forEach(item => display.add(new Option((item.primary ? 'Principal · ' : '') + item.label + ' · ' + item.workArea.width + '×' + item.workArea.height,item.id)));
    status.textContent = displays.length + ' monitor(s) detectat(s).';
  }).catch(error => { status.textContent = 'No s’han pogut detectar monitors: ' + error.message; });
  renderDefinitions(); renderFavourites(); renderDockState();
})();