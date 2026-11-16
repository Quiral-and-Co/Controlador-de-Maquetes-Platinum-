# Acta de congelació de versió — 2026-11-16

## Identificació de la versió

- Repositori: `terrsola/jmri-tc`
- Branca validada: `main`
- SHA congelat: `2a5ed33a3231d83e7e0f6bf810c10c9ebe0a43c0`
- Commit: `Merge pull request #21 — fix unique SVG track identifiers`
- PR integrada: #21
- Data del commit: 2026-11-16 01:41:12 UTC

## Evidència CI

- Workflow: `Dispatcher and editor tests`
- Fitxer: `.github/workflows/dispatcher-tests.yml`
- Run: #472
- Run ID: `43787699630`
- SHA executat: `2a5ed33a3231d83e7e0f6bf810c10c9ebe0a43c0`
- Estat: `completed`
- Conclusió: `success`
- Job `test`: `success`

## Resultats de regressió

Tots els passos reportats pel job `test` han acabat amb `success`, incloent:

- Sintaxi JavaScript i validació JSON d'exemples.
- Instal·lació del pont local i Chromium per Playwright.
- Proves d'integració VMR amb navegador real.
- Nucli de seguretat i integració del pont de seguretat.
- Horaris supervisats, màquina d'estats de trànsit i seqüència dead-man.
- Proves unitàries i d'integració UI del Dispatcher.
- Regressió de l'editor.
- Mapeig de topologia de senyals i proves de la matriu de validació física.
- Integració UI SVG, Dispatcher i senyalització.
- Diagnòstic JMRI en viu.
- Supervisió de desviaments i itineraris, incloses proves de fallada i recuperació.
- Suite completa de regressió i fail-safe, dues execucions consecutives (run 1 i run 2).

## Limitacions i estat de congelació

- Aquesta acta acredita el resultat de CI per al SHA indicat; no és una certificació de seguretat del maquinari ni una inspecció elèctrica física.
- La protecció de branca de `main` constava desactivada en la consulta de GitHub.
- La congelació és una referència immutable per identificació del SHA; no s'ha modificat `main` ni s'ha creat un tag Git.
- Els outputs físics, DCC, desviaments físics i automatismes han de continuar bloquejats fins a completar i aprovar la validació física independent i verificar el comportament fail-safe.

## Enllaços d'evidència

- Commit: https://github.com/terrsola/jmri-tc/commit/2a5ed33a3231d83e7e0f6bf810c10c9ebe0a43c0
- GitHub Actions run: https://github.com/terrsola/jmri-tc/actions/runs/43787699630
