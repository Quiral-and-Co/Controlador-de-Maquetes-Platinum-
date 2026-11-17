# Controlador Märklin CS2 60215 — PR #23

## Abast d'aquesta entrega
S'afegeix un monitor de diagnòstic MCAN de només lectura per a Märklin Central Station 2 (60214/60215). Inclou connexió TCP passiva, escolta UDP de broadcasts, reassemblatge del flux TCP, validació dels paquets MCAN de 13 bytes i simulació automatitzada amb un servidor TCP local.

**No és encara un controlador de trens.** No hi ha cap API per enviar ordres, activar locomotores, canviar accessoris, programar CV ni habilitar sortides físiques. `physicalOutputsEnabled` és sempre `false`.

## Xarxa CS2
- TCP: connexió a la CS2, port 15731 (recomanat per JMRI).
- UDP: el PC escolta al port 15730 per rebre els broadcasts MCAN. La CS2 ha de tenir CAN Gateway en mode Broadcast i l'adreça IP del PC com a destí. Els equips han de compartir subxarxa per al retorn UDP.
- Paquet MCAN Ethernet: 13 bytes: identificador CAN de 4 bytes big-endian, DLC d'1 byte i 8 bytes de dades. Només es processen trames amb DLC de 0 a 8.

La implementació TCP és deliberadament passiva: obre el socket i només consumeix dades. No envia cap paquet d'inicialització ni ordre de control.

## Ús des de Node.js 20+
```js
const { MarklinCS2Monitor } = require('./marklin-cs2-driver');

const cs2 = new MarklinCS2Monitor({
  host: '192.168.1.50',
  tcpPort: 15731,
  timeoutMs: 5000
});
cs2.on('frame', frame => console.log('MCAN', frame));
cs2.on('connectionError', error => console.error(error));
cs2.on('disconnected', () => console.log('CS2 desconnectada'));
cs2.connectTCP().catch(console.error);

// Per aturar el monitor:
// cs2.disconnect();
```

Per escoltar broadcasts UDP, utilitza `await cs2.listenUDP({ bindHost: '0.0.0.0' })` en lloc de `connectTCP()`. No s'han d'executar els dos modes simultàniament.

## Proves
```powershell
npm test
node tests/marklin-cs2-driver.cjs
```
Les proves creen un servidor TCP local i comproven el fragmentat/reassemblatge de trames sense maquinari real.

## Validació abans de control físic
Abans d'afegir tracció o accessoris cal implementar i revisar els identificadors CAN i els formats de missatge contra l'especificació Märklin, validar MM/MM2, mfx i DCC separadament, i afegir confirmacions, watchdog, parada d'emergència física independent i proves amb maqueta aïllada. Aquesta PR no dona per fet que la detecció de protocol equivalgui a compatibilitat de control.
