# Configuració de centrals digitals

## Objectiu
El mòdul `command-station-core.js` i la interfície `command-station-ui.js` permeten registrar diverses centrals, seleccionar fabricant/model, protocol i interfície, i guardar paràmetres de connexió.

## Catàleg inicial
Märklin CS2/CS3, ESU ECoS, Roco Z21/z21, Digitrax DCS, Lenz LZV, NCE PowerCab/Powerhouse Pro, Hornby Elite, PIKO SmartControl, DCC-EX EX-CommandStation i SPROG. Els protocols i interfícies s'assignen per model al catàleg; no es permet una combinació arbitrària.

## Connexió
- TCP/Wi-Fi/WebSocket: host, port, ruta opcional i timeout.
- USB/Serial: identificador de port i baud rate.
- La interfície valida els camps i persisteix els perfils al navegador. Permet exportar/importar JSON.
- Aquesta entrega és un gestor de perfils, no un controlador de maquinari: no obre sockets, no detecta ports sèrie i no executa cap ordre de tracció.

## Seguretat
Totes les centrals noves queden `verified:false`; l'estat de connexió és `NOT_TESTED`; `physicalOutputsEnabled:false` és invariant. La selecció d'una central no arma DCC ni canvia la porta de seguretat. DCC, MM2, mfx, accessoris i automatismes físics continuen bloquejats fins a integrar i provar adaptadors específics, validar fail-safe, i completar inspecció elèctrica i parada d'emergència física independent.

## Proves
`node tests/command-station.cjs` i suite completa `npm test`.
