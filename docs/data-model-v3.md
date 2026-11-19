# Model de dades v3 — JMRI TC Gold Custom

El model separa geometria, topologia i recursos lògics de detecció. No es pressuposa cap traçat real.

## Entitats

- **Layout**: `schemaVersion: 3`, escala H0, sistema de via, dimensions 3000 × 1800 mm, separació prevista de 110 mm i cinc nivells.
- **Level**: `id`, `name`, `elevationMm`, `tracks[]`, `blocks[]`, `sensors[]`. Les cotes 0/110/220/330/440 mm són de projecte i s'han de contrastar amb l'estructura física.
- **TrackPiece**: `id`, `type`, `name`, `x`, `y`, `rotation`, `levelId`, `blockId`, `sensorName`, `geometry`. Les coordenades són mm des de la cantonada superior esquerra del nivell. Les peces de paleta continuen sent primitives genèriques, no articles de catàleg Märklin.
- **Ports i Connection**: ports geomètrics A/B/C; connexions `from`/`to` entre peces del mateix nivell. `verified:false` fins a una comprovació elèctrica i física.
- **Block**: `id`, `name`, `trackIds[]`, `lengthMm`, `sensorIds[]`, `verified`. En 0.5 `trackIds` i `sensorIds` es recalculen a partir de les assignacions de peces; la longitud no s'infereix ni es calcula automàticament.
- **Sensor**: `id`, `systemName` (nom de sistema JMRI), `userName`, `invert`, `verified`. `systemName` és únic al projecte. Els registres nous i els migrats queden `verified:false`.

## Funcions verificables de la versió 0.5

1. Crear blocs lògics al nivell actiu.
2. Registrar sensors JMRI per `systemName`; no es prova ni es valida el maquinari.
3. Assignar o desassignar un bloc i un sensor a una peça seleccionada mitjançant selectors.
4. Moure una peça sense assignacions ni connexions a un altre nivell. No es creen connexions verticals.
5. Importar model v2 i migrar les assignacions textuals antigues a registres explícits provisionals no verificats.
6. Validar IDs, referències, unicitat de sensors i que les connexions no travessin nivells.

## Seguretat i límits

- Cap bloc és un cantó de circulació validat ni implica reserva o parada.
- Un sensor registrat no confirma que existeixi físicament ni que la seva adreça S88 sigui correcta.
- 60881/60882 són mòduls de retroalimentació; la interfície CS2/Link S88 i el cablejat real s'han de confirmar in situ.
- No hi ha ordres de locomotores, desviaments, rutes ni automatismes.
- Les connexions entre nivells continuen sense suport.

## Auditoria topològica de la versió 0.6

L'acció **Validar topologia** inspecciona totes les peces i connexions dels cinc nivells sense canviar el document. Cada extrem de connexió s'identifica per la parella `pieceId + port` (ports A/B a rectes i corbes; A/B/C a desviaments genèrics). La validació comprova:

- referències a peces i ports existents;
- coherència del `levelId` de la connexió amb el nivell de les dues peces;
- absència d'auto connexions, connexions duplicades i ports utilitzats més d'una vegada;
- distància entre els dos extrems connectats: màxim 1 mm.

Els ports sense connexió es compten com a **avisos**, no com a errors: el projecte encara no conté el traçat definitiu. Aquesta comprovació és geomètrica/topològica i no certifica continuïtat elèctrica, polaritat, cablejat de via, detecció S88, reserves ni seguretat operacional.

## Auditoria de gàlibs i interferències 3D (editor 0.12)

El perfil opcional `clearanceProfile` desa dos llindars **entre eixos**:

- `horizontalAxisMm`: separació horitzontal mínima configurada per l'usuari.
- `verticalAxisMm`: separació vertical mínima configurada per l'usuari.
- `source: "user-defined"` i `verified: false`: el programa no certifica l'origen ni la validació física dels valors.

Els dos llindars comencen sense configurar-se; no s'infereixen de l'escala H0 ni de la separació prevista de 110 mm entre nivells. L'auditoria mostreja rectes, corbes i rutes de desviaments genèrics, transforma els punts a coordenades del tauler i compara la separació horitzontal i vertical. Les peces connectades directament s'exclouen de la comparació entre si. Les peces especials, els perfils Z incomplets i els desviaments amb perfil vertical no definit queden com a geometria pendent.

Estats possibles: `CONFLICT`, `POTENTIAL_CONFLICT`, `UNCONFIGURED`, `INCOMPLETE`, `EMPTY` i `WITHIN_THRESHOLDS_UNVERIFIED`. Aquest darrer estat vol dir únicament que no s'ha trobat cap conflicte dins dels llindars introduïts; **no vol dir que el gàlib sigui segur o verificat**. Les geometries sense `geometryStatus: "confirmed"` mai no produeixen una declaració de separació verificada.

La comparació usa mostreig geomètric de 5 mm per defecte i tolerància de projecció d'1 mm; és una eina de detecció preliminar, no un càlcul de gàlib reglamentari ni una comprovació de vehicles, estructures, pantògrafs, cablejat, deformacions o toleràncies de muntatge. No envia ordres a JMRI/CS2 ni habilita sortides físiques.
