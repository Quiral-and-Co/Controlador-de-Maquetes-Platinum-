# Pla de desenvolupament — versió 1.4.0

## Branca i punt de partida

- Branca: `release/1.4.0`
- Punt de partida: capçalera de la PR #52 (`09a5022f4aa0587436748a0d52830e8fea70b08d`).
- La branca incorpora com a base de treball els canvis de finestres multidisplay, Tren Automàtic i contactes virtuals. La PR #52 continua oberta i sense fusionar.
- Versió del paquet: `1.4.0`. Aquesta és una versió de desenvolupament, no una publicació final.

## Objectius de la versió

1. Consolidar el diagnòstic de senyals i la matriu de validació per senyal, bloc, sensor i desviament.
2. Completar la traçabilitat de les comprovacions, incidències, autoria i marques temporals sense confondre declaracions de l'operador amb mesures físiques.
3. Consolidar les finestres independents i el comportament en un o diversos monitors, preservant els modes clàssic i modern.
4. Completar la integració funcional de Tren Automàtic i contactes virtuals només en els límits que permetin dades reals verificades; no inferir posició ni velocitat.
5. Ampliar proves de regressió, navegador, instal·lació NSIS, compatibilitat de projectes i recuperació davant errors.

## Criteris d'acceptació

- Suite completa de CI i proves de navegador en el mateix commit que es pretén publicar.
- Regressió funcional dels modes clàssic i modern, menús, editor, despatxador, finestres flotants i múltiples monitors.
- Proves específiques de diagnòstic de senyals, matriu de validació, detectors, contactes virtuals, itineraris i recuperació fail-safe.
- Importació/exportació i compatibilitat de projectes antics verificades.
- Construcció NSIS x64, manifest SHA-256 i instal·lació neta supervisada en Windows 11.
- Revisió de dependències, permisos, persistència, registres i missatges d'error.

## Bloqueig de seguretat obligatori

- Sortides físiques, DCC i automatització física romanen deshabilitades per defecte.
- Cap contacte virtual pot declarar un bloc lliure, canviar-ne l'ocupació ni substituir un detector físic.
- Cap estimació de posició/velocitat no verificada pot activar distància, temps, frenada o aturada.
- Cap estat declarat a la matriu equival a una inspecció instrumental o certificació.
- Abans de qualsevol prova física cal revisar cablejat, polaritats, alimentacions, fusibles, proteccions i parada d'emergència física independent.
- No fusionar a `main` ni publicar la versió final fins que totes les portes de CI, regressió, fail-safe, instal·lació i validació supervisada hagin estat aprovades.

## Registre de treball

- [x] Crear branca de desenvolupament `release/1.4.0`.
- [x] Actualitzar la versió del paquet a `1.4.0`.
- [x] Identificar els objectius i les portes d'acceptació.
- [ ] Revisió tècnica de la matriu de validació i del diagnòstic de senyals.
- [ ] Revisió funcional de finestres independents i multimonitor.
- [ ] Revisió d'integració de telemetria verificada per als contactes virtuals.
- [ ] Suite CI i NSIS sobre el commit final de la versió.
- [ ] Instal·lació i validació supervisades en Windows 11.
