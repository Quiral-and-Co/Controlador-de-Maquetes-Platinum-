# Mòduls natius Quiral Control

Aquesta implementació és a la branca `feature/native-windows-architecture` i utilitza exclusivament C#/.NET 10 i Windows Forms. No depèn de JMRI, HTML, CSS, JavaScript de navegador, Electron, Chromium, WebView ni serveis externs.

## Gestió de projectes

- Projectes H0 / Märklin C amb dimensions en mil·límetres.
- Nivells amb cota Z generada a partir de la separació vertical configurada.
- Creació, llistat, obertura, desament i eliminació de projectes.
- Índex persistent a `projects/index.json` mitjançant el magatzem local de Quiral.

## Geometria ferroviària

- Coordenades XYZ en mm.
- Distància espacial, longitud en planta i pendent percentual.
- Desplaçament paral·lel amb separació explícita; les proves cobreixen 77 mm i 64 mm.
- Rebuig de coordenades no finites i trams nuls.
- La geometria queda vinculada al projecte actiu i es filtra en canviar de projecte.
- Les connexions/topologia i les geometries de catàleg s'han de completar abans d'utilitzar el model com a validació constructiva.

## Material mòbil

- Inventari de locomotores, cotxes, vagons i unitats de tren.
- Fabricant, referència, escala, època, companyia, adreça, protocol, decoder i funcions.
- Prevenció de referències duplicades per fabricant.
- Composicions amb comprovació d'existència i unicitat dels vehicles.
- Persistència local a `rolling-stock/`.

## Märklin CS2 60215 i S88

- Controlador propi mCAN sobre TCP, port configurable (15731 per defecte).
- Paquets mCAN fixos de 13 bytes; codificació/descodificació del CAN-ID, prioritat, comandament, resposta, hash i DLC.
- PING de descobriment; trames fixes de 13 bytes i port TCP 15731 per defecte.
- Constructors tipats de velocitat, sentit i funcions per a Motorola/MM2, mfx i DCC; les ordres passen exclusivament pel `CommandDispatcher`.
- Subscripció d'esdeveniments S88 (comandament 0x11), identificador de contacte de 16 bits, estats anterior/nou i marca temporal de 10 ms.
- Recepció de broadcast S88 (0x12) i resposta de consulta per mòdul (0x10), amb el bit 15 associat al contacte 1.
- Lectura de compatibilitat S88 polling (0x10), documentada com a mode legacy perquè pot buidar buffers intermedis.
- Esdeveniments S88 publicats al bus intern de Quiral i diagnòstic de pèrdua de connexió.
- Les ordres de locomotora ja tenen codificadors i un controlador d'execució, però queden bloquejades pel `PhysicalOutputGate` fins a completar la validació. No hi ha encara comandes d'accessoris, energia de via ni automatització física.

## Límits de seguretat

- La connexió i el feedback no equivalen a validació física del cablejat ni dels mòduls.
- La CS2, la versió de firmware, la xarxa, el Link S88 i els mòduls 60881/60882 s'han de verificar a la maqueta.
- Les sortides físiques continuen bloquejades per `PhysicalOutputGate`.
- Cap prova de protocol simulada substitueix la prova real supervisada ni la parada d'emergència física independent.

## Proves

El projecte `native/Quiral.ControladorMaquetes.CoreTests` inclou proves del nucli, persistència, bloqueig fail-safe, cicle de vida, projectes, càlculs XYZ, paral·lels, inventari, composicions, codec mCAN i descodificació S88. La CI Windows ha de compilar l'aplicació i executar totes les proves abans de considerar aquesta fase validada.
