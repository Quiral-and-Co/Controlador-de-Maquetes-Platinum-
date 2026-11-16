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


## Dispatcher · despatxador (1.1)

El panell Dispatcher permet:
- Consultar els blocs lògics creats al projecte i el nivell al qual pertanyen.
- Calcular automàticament l'ocupació dels blocs a partir de sensors JMRI verificats.
- Simular els estats **Desconegut**, **Lliure** i **Ocupat** només als blocs sense sensors assignats.
- Definir itineraris com una seqüència de blocs (identificadors separats per comes).
- Reservar i alliberar itineraris de manera atòmica dins del simulador.
- Detectar conflictes quan dos itineraris comparteixen blocs.
- Alliberar automàticament les reserves afectades quan un bloc passa a ocupat o desconegut.

Les definicions dels itineraris es desen a `dispatcher.routes` dins del projecte JSON. Els estats simulats i les reserves són temporals i es reinicien en tornar a carregar la pàgina.

**Integració JMRI:** els sensors es llegeixen pel WebSocket JSON en mode només lectura. ACTIVE (2) significa ocupat i INACTIVE (4) significa lliure. Cal marcar sensor i bloc com a verificats físicament des dels registres de recursos. Si falta una lectura, el valor és invàlid o es perd el heartbeat/connexió, el bloc passa a desconegut; els blocs amb sensors no accepten canvis manuals. No s'envien ordres a locomotores, desviaments ni rutes. La reserva continua sent local i no és un interbloqueig ferroviari certificat. Consulta [docs/dispatcher.md](docs/dispatcher.md).

Proves del motor i de la integració de sensors:
```bash
node --check app.js
node --check dispatcher-core.js
node --check dispatcher.js
node tests/dispatcher.cjs
node tests/dispatcher-ui.cjs
node tests/smoke.cjs
```

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


## Gestió de circulacions Märklin DCC (1.2 alpha)

El panell de circulacions incorpora registre de locomotores DCC, itineraris, mode manual i mode automàtic supervisat. La lectura de sensors/alimentació continua al JSON WebSocket JMRI; les ordres de locomotora passen pel pont local WiThrottle TCP. Consulta [docs/traffic-management.md](docs/traffic-management.md) per instal·lació, configuració Märklin, ports, seguretat i limitacions.

**Seguretat per defecte:** el pont DCC està desactivat. Per provar només la interfície, executa `npm install` i `npm start` i obre `http://127.0.0.1:3000`. Les ordres reals exigeixen `JMRI_TC_ENABLE_DCC=1` i armar el control. L'automàtic rebutja rutes amb desviaments no verificats i atura davant lectures desconegudes. No és un enclavament ferroviari certificat.

Proves addicionals: `node tests/traffic.cjs`.


## Catàleg digital Märklin DCC / MM2 / mfx

La branca `feature/marklin-mm-mfx-accessory-catalogue` incorpora un registre local de locomotores i accessoris amb exportació/importació JSON. Admet fitxes DCC, MM2 i mfx per UID; tipus d'accessori: desviaments, senyals, llums, desacobladors, relés i altres. Consulta [docs/marklin-multiprotocol.md](docs/marklin-multiprotocol.md).

**Límit funcional:** el registre no és una importació automàtica de la base interna de la CS2 ni una base oficial completa de models. El control MM2/mfx i els mapes d'aspectes de senyals/llums encara no estan connectats. Les ordres MM2/mfx es bloquegen deliberadament; només hi ha un constructor per a una ordre de desviament DCC via JMRI JSON, pendent d'integració i prova física. No s'ha provat amb una CS2 real.


## Validació i bloqueig de seguretat (1.2.1 · en revisió)

El mòdul `safety-core.js` manté l'estat BLOQUEJAT per defecte i exigeix una llista explícita de validacions, confirmació física de l'operador, JMRI connectat, alimentació ON, pont WiThrottle connectat i sensors vàlids abans de permetre armar el control DCC. La interfície de circulacions, les ordres manuals i l'inici de circulacions passen per aquesta porta. El pont local exigeix també `JMRI_TC_SAFETY_VALIDATED=1` a més de `JMRI_TC_ENABLE_DCC=1`.

La confirmació és una declaració de l'operador, no una certificació ni una lectura del circuit d'emergència. Cal mantenir una parada física independent que talli la tracció; el programari no substitueix proteccions elèctriques ni un enclavament ferroviari certificat. Consulta `docs/safety-validation.md`.

Prova específica: `node tests/safety.cjs`. La suite completa inclou aquesta prova amb `npm test`.


## Planificació supervisada d’horaris (1.3.0)

El motor `automation-core.js` valida horaris, dies, finestres d’inici i velocitats limitades a 20 passos. El preflight exigeix explícitament la validació de seguretat de PR #7, JMRI i WiThrottle connectats, alimentació ON, DCC armat, sensors vàlids, primer bloc ocupat, blocs següents lliures, absència de conflictes de reserva i feedback verificat dels desviaments requerits (`CLOSED` o `THROWN`). La protecció contra execucions duplicades impedeix reclamar el mateix horari dues vegades el mateix dia.

**Límit deliberat:** el planificador només valida i registra; no envia ordres físiques ni inicia trens. `safetyValidated` s’ha de derivar de l’estat actual de `JMRI_TC_SAFETY.canEnablePhysical(runtime)`, mai d’un valor persistent. La parada d’emergència física independent i les proteccions elèctriques continuen sent obligatòries. Consulta `docs/automation-1.3.md`.

Proves: `node tests/automation.cjs` i `npm test`.


## Diagnòstic de senyals i matriu de validació física (1.4.0)

La selecció d'una senyal al registre ressalta al tauler les peces de via relacionades amb el bloc protegit i l'itinerari complet. El diagnòstic resumeix incidències per nivell. La matriu individual manté comprovacions separades per senyal, bloc, sensor i desviament, distingint revisió de programari i inspecció física. Les anotacions s'exporten amb el projecte JSON a `validationMatrix`.

**Límit de seguretat:** els estats de la matriu són registres declaratius de l'operador, no mesures instrumentals. Cap casella habilita sortides. DCC i automatització física continuen bloquejats fins a completar proves de programari, inspecció del cablejat i proteccions, i prova d'una parada d'emergència física independent. Consulta [docs/signalling-diagnostics-validation.md](docs/signalling-diagnostics-validation.md).

Prova específica: `node tests/physical-validation.cjs`; suite completa: `npm test`.


## Navegació del tauler 2D (0.10)

- **Zoom:** roda del ratolí centrada al cursor o botons +/−; l’indicador mostra el percentatge respecte de la vista completa.
- **Desplaçament:** mantén Espai i arrossega amb el botó principal, o arrossega amb el botó central.
- **Ajustar:** «Ajusta a superfície» retorna la vista completa de 3000 × 1800 mm.
- El zoom està limitat entre 10% i 1000%; el desplaçament no perd l’àrea de la maqueta.
- La navegació canvia exclusivament el `viewBox` SVG: no modifica coordenades en mm, geometries, connexions, blocs, sensors ni el JSON exportat.
- Proves: `node --check viewport-core.js`, `node tests/viewport.cjs` i `node tests/smoke.cjs`.
