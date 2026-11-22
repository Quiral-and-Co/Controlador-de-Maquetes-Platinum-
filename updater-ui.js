(() => {
  'use strict';
  const button = document.getElementById('checkUpdatesBtn');
  const status = document.getElementById('updateStatus');
  if (!button || !status) return;

  button.addEventListener('click', async () => {
    if (!window.jmriDesktop?.checkForUpdates) {
      status.textContent = 'Disponible només a l’aplicació d’escriptori.';
      return;
    }
    button.disabled = true;
    status.textContent = 'Comprovant GitHub…';
    try {
      const result = await window.jmriDesktop.checkForUpdates();
      if (result.noRelease) {
        status.textContent = 'No hi ha cap Release publicada a GitHub.';
      } else if (result.updateAvailable) {
        status.textContent = `Nova versió ${result.latestVersion} disponible (instal·lada: ${result.currentVersion}).`;
        const open = window.confirm(`Hi ha una nova versió (${result.latestVersion}).\nVersió instal·lada: ${result.currentVersion}.\n\nVols obrir la pàgina oficial de descàrrega de GitHub?`);
        if (open) await window.jmriDesktop.openReleasePage(result.releaseUrl);
      } else {
        status.textContent = `El programa està actualitzat (${result.currentVersion}).`;
      }
    } catch (error) {
      status.textContent = `No s’han pogut comprovar les actualitzacions: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  });
})();
