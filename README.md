# JMRI TC Gold Custom — editor 0.9

Editor web independent per a una maqueta Märklin H0 de cinc nivells. JMRI continua sent el motor extern; la connexió JSON/WebSocket és exclusivament de monitorització i només lectura. El projecte no conté un traçat ferroviari real.

## Funcions disponibles

### Edició 2D (0.3–0.4)
- Tauler de 3000 × 1800 mm, graella de 10 mm i cinc nivells amb cotes previstes de 0, 110, 220, 330 i 440 mm.
- Primitives gràfiques genèriques de recta, corba i desviament; selecció, moviment, rotació i geometria editable. No són referències de catàleg Märklin C.
- Connexions geomètriques entre ports A/B/C amb `verified:false`; no validen continuïtat elèctrica.
- Historial Desfer/Refer (fins a 100 estats), duplicació i mesura euclidiana en mm.

### Blocs, sensors i nivells (0.6)
- Crear blocs lògics al nivell actual i assignar-los a peces. `trackIds` i `sensorIds` es recalculen des de les assignacions de les peces.
- Registrar sensors amb el `systemName` JMRI i nom visible opcional; assignar-los a peces. Tots els sensors nous queden `verified:false`.
- Canviar una peça de nivell només si no té bloc, sensor ni connexions. No es crea cap enllaç vertical.
- Importar configuracions v2. Les assignacions textuals antigues es migren a registres provisionals explícits, no verificats.
- Exportació JSON en model v3 i comprovacions d'IDs, referències i connexions dins del mateix nivell.

## Execució i proves

Obre `index.html` en un navegador modern. No cal servidor per editar offline. Per monitoritzar JMRI, activa el Web Server de JMRI i configura l'adreça i el port a la interfície (habitualment 12080).

Executa:

```bash
node --check app.js
node tests/smoke.cjs
python3 -m json.tool config/layout.example.json
```

El fitxer `config/layout.example.json` ha de validar contra `schema/layout-v3.schema.json` (JSON Schema Draft 2020-12).

## Context de maquetisme i límits de seguretat

- Märklin H0, via C, cinc nivells, superfície 3000 × 1800 mm; separació vertical prevista de 110 mm. Les cotes s'han de contrastar amb l'estructura física.
- Central Märklin CS2 60215. Retroalimentació prevista S88 amb mòduls 60881/60882; la interfície física, el cablejat i la configuració real s'han de verificar abans de donar per operatiu el bus.
- Les peces poden provenir de la biblioteca de catàleg o ser primitives geomètriques lliures. No s'ha importat ni inferit cap traçat real des de XTrackCAD.
- Un bloc és només una agrupació de disseny; no implica cantó validat, reserva, frenada ni automatització. Un sensor registrat no confirma existència, adreça ni funcionament físic.
- No s'envien ordres de locomotores, desviaments, rutes ni automatismes. Aquesta restricció es manté fins que traçat, detecció, reserves i parada d'emergència estiguin verificats.

## Validació topològica (0.6)

Prem **Validar topologia** per revisar totes les connexions definides. La comprovació detecta referències a ports inexistents, nivells inconsistents, duplicats, ports compartits i extrems separats més d'1 mm. Els ports oberts només es mostren com a avisos mentre el traçat no estigui complet. Aquesta eina és de diagnòstic local i no valida el circuit elèctric ni activa cap equip.

Per executar les proves automatitzades amb Node.js:

```bash
node --check app.js
node tests/smoke.cjs
```


## Connexió manual de ports (0.7)

Activa **Activar connexió manual de ports** al panell de propietats i fes clic a dos ports (A/B/C) visibles al tauler. Els ports es mostren amb marcadors grocs i el primer seleccionat queda ressaltat. La connexió només es crea si els dos extrems coincideixen a una distància màxima d'1 mm; l'eina no mou ni gira cap peça automàticament. Els ports ja ocupats es rebutgen. La connexió queda amb `verified:false` i només representa topologia geomètrica.

La funció **Connexió ràpida** de versions anteriors es conserva com a eina auxiliar; per treballar amb precisió, prioritza la connexió manual.


## Accessibilitat i proves de connexió (0.7.1)

Els marcadors de ports accepten focus de teclat i es poden activar amb **Enter** o **barra espaiadora**. Cada marcador exposa una etiqueta accessible amb el nom de la peça i el port. Les proves automatitzades cobreixen connexions exactes, activació per teclat, autoconnexions, ports ocupats i extrems separats més d'1 mm. Una connexió rebutjada no mou peces ni modifica el model.

## Biblioteca Märklin C (0.9)

La paleta ara és una biblioteca filtrable per categoria i cercable per referència o nom. Les dades viuen a `catalogue-marklin-c.json` i es carreguen des de `catalogue.js`; afegir referències no requereix modificar el motor. La càrrega inicial inclou 68 referències trobades en documentació pública Märklin (rectes, corbes R1–R5, desviaments, creuaments i accessoris). Les dimensions confirmades i les geometries parcials/no verificades estan diferenciades explícitament. No es declara encara exhaustivitat del catàleg històric o comercial complet. Consulta `docs/catalogue-c-track.md` abans d'utilitzar la geometria per construir o validar encaixos.

El tipus `special` s'afegeix al model v3 i es manté compatible amb projectes antics. La importació/exportació JSON conserva les metadades de referència. La geometria esquemàtica de desviaments i peces especials no valida encaixos físics.
