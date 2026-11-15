# Adaptador JMRI JSON per a accessoris

Aquest mòdul és el primer pas d'integració operativa amb el servidor JSON/WebSocket de JMRI. No parla directament amb la CS2: JMRI ha d'estar connectat prèviament a la Märklin CS2 60215 mitjançant **MARKLIN > Command Station 2**, preferiblement TCP.

## Funcions d'aquesta versió

- Connexió WebSocket a `ws://HOST:12080/json/` (port i ruta configurables).
- Lectura d'estat de desviaments i sensors per `systemName` JMRI.
- Ordre de desviament DCC amb el format JSON de JMRI: `method: post`, estat 2 (CLOSED) o 4 (THROWN).
- Bloqueig de qualsevol ordre si no hi ha verificació física, connexió, alimentació ON o armament explícit.
- MM2, mfx, senyals i llums continuen bloquejats; no es transforma cap UID en una adreça DCC.

## Proves

```powershell
npm test
node --check jmri-json-adapter.js
```

La prova crea un servidor WebSocket simulat local. **No** prova la CS2 física.

## Configuració

1. A JMRI, configura MARKLIN > Command Station 2 amb l'adreça IP de la CS2 i TCP.
2. Activa el servidor JSON de JMRI i comprova que el port configurat és accessible des de l'ordinador.
3. El client es crea així:

```js
const { JmriJsonAdapter } = require('./jmri-json-adapter');
const jmri = new JmriJsonAdapter({ host: '127.0.0.1', port: 12080 });
await jmri.connect();
const state = await jmri.getTurnout('LT1');
```

Per enviar una ordre, el programa que la invoca ha de proporcionar els quatre permisos de seguretat: `jmriConnected: true`, `power: 'ON'`, `armed: true` i un accessori DCC verificat.

## Límit de seguretat

Aquest adaptador no és un enclavament ferroviari certificat. La confirmació de l'estat elèctric i la verificació de camp s'han de validar a la instal·lació real. Mantén accessible la parada física d'emergència. La CS2/JMRI i el material rodant no s'han provat en aquesta implementació.
