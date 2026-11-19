(() => {
  'use strict';
  const api = window.jmriDesktop;
  if (!api || document.querySelector('[data-native-window-controls]')) return;
  const page = document.querySelector('[data-ribbon-page="windows"]');
  if (!page) return;
  const group = document.createElement('div');
  group.className = 'ribbon-group native-window-controls';
  group.dataset.nativeWindowControls = 'true';
  const heading = document.createElement('strong');
  heading.textContent = 'Finestres natives i monitors';
  const controls = document.createElement('div');
  const display = document.createElement('select');
  display.setAttribute('aria-label', 'Monitor de destinació');
  display.innerHTML = '<option value="">Monitor principal / recordat</option>';
  const status = document.createElement('span');
  status.className = 'small muted';
  status.setAttribute('role', 'status');
  status.textContent = 'Carregant monitors…';
  const definitions = [
    ['editor', 'Editor de maqueta'], ['dispatcher', 'Despatxador'], ['traffic', 'Trànsit'],
    ['schedules', 'Horaris'], ['operation', 'Operació'], ['diagnostics', 'Metge Quiral']
  ];
  definitions.forEach(([type, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Obrir ' + label;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const result = await api.openNativeWindow({ type, ...(display.value ? { displayId: display.value } : {}) });
        status.textContent = label + ' obert a la pantalla ' + result.displayId + '.';
      } catch (error) {
        status.textContent = 'No s’ha pogut obrir: ' + error.message;
      } finally { button.disabled = false; }
    });
    controls.append(button);
  });
  const showAll = document.createElement('button');
  showAll.type = 'button';
  showAll.textContent = 'Mostrar totes';
  showAll.addEventListener('click', async () => {
    try { status.textContent = 'Finestres visibles: ' + await api.showAllNativeWindows(); }
    catch (error) { status.textContent = error.message; }
  });
  controls.prepend(display);
  controls.append(showAll, status);
  group.append(heading, controls);
  page.append(group);
  api.getDisplays().then(displays => {
    display.replaceChildren(new Option('Monitor principal / recordat', ''));
    displays.forEach(item => display.add(new Option(
      (item.primary ? 'Principal · ' : '') + item.label + ' · ' + item.workArea.width + '×' + item.workArea.height,
      item.id
    )));
    status.textContent = displays.length + ' monitor(s) detectat(s). Les finestres es poden moure i redimensionar independentment.';
  }).catch(error => { status.textContent = 'No s’han pogut detectar monitors: ' + error.message; });
})();
