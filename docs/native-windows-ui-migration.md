# Renovació de la interfície Windows — JMRI TC Gold Custom

## Decisió funcional

La interfície nova serà el mode predeterminat i tindrà una experiència d'aplicació d'escriptori Windows: barra de menús desplegables, barra d'eines, àrea central de maqueta, panells acoblables i diàlegs de Windows.

Es mantindrà el mode clàssic actual com a alternativa seleccionable en qualsevol moment.

### Modes

- **Mode modern (predeterminat):** interfície d'escriptori Windows amb menús Fitxer, Edició, Visualització, Maqueta, Vies, Elements, Locomotores, Digital i analògic, Automatització, JMRI, Eines, Finestra i Ajuda.
- **Mode clàssic:** conserva la interfície actual, inclosa la seva disposició i flux de treball.
- Un control visible a la barra d'eines permet alternar entre els dos modes.
- El menú **Fitxer** inclou l'ordre **Menús clàssics**, que activa el mode clàssic. En mode clàssic, el mateix punt de menú es presentarà com **Menús moderns** per tornar al mode nou.
- El canvi de mode no reinicia l'aplicació ni descarta el projecte, la selecció, el nivell actiu, les dades de maqueta o la configuració.

## Requisit d'arquitectura nativa

El repositori actual utilitza Electron 38 amb una interfície HTML/CSS/JavaScript. Electron ja proporciona diàlegs natius de fitxers i un menú d'aplicació del sistema, però el contingut principal continua sent una interfície web.

Per satisfer literalment el requisit de **interfície nativa de Windows**, el mode modern s'haurà d'implementar amb tecnologia Windows nativa (preferentment WinUI 3; WPF és una alternativa acceptable si la compatibilitat amb el desplegament o els components existents ho exigeix). No s'ha de presentar una pàgina HTML dins d'Electron com si fos una interfície nativa.

La migració s'ha de fer per adaptadors i etapes, mantenint el motor ferroviari i els contractes de dades existents. No s'ha d'eliminar ni substituir el mode clàssic fins que el mode nou superi les proves.

## Estructura de menús del mode modern

- Fitxer: Nou, Obrir, Desar, Desar com, Importar, Exportar, Projectes recents, Configuració, Menús clàssics, Sortir.
- Edició: Desfer, Refer, Retallar, Copiar, Enganxar, Seleccionar-ho tot.
- Visualització: Zoom, Ajustar a superfície, Panells, Pantalla completa.
- Maqueta: Propietats, Nivells, Validar maqueta.
- Vies: Biblioteca, Rectes, Corbes, Desviaments, Vies paral·leles, Connexions, Topologia.
- Elements: Blocs, Sensors, Senyals, Accessoris.
- Locomotores: Registre, Perfils, Cabina, Diagnòstic.
- Digital i analògic: Centrals, CS2, Protocols, Estat de connexió.
- Automatització: Circulacions, Itineraris, Horaris, Supervisió.
- JMRI: Connexió, Web Server, Sensors, Desviaments, Diagnòstic.
- Eines: Geometria XYZ, Mesures, Importació/exportació XTrackCAD, Metge Quiral.
- Finestra: Organització de panells i finestres obertes.
- Ajuda: Manual, Sobre el programa, Diagnòstics.

## Seguretat i compatibilitat obligatòries

- Les sortides físiques, DCC i automatitzacions continuen bloquejades per defecte.
- La interfície nova no pot obrir una via alternativa que eviti `safety-core.js`, el pont o les comprovacions fail-safe.
- Els estats de seguretat han de provenir del motor de seguretat, no de preferències visuals ni de valors persistents.
- Cap canvi de mode pot enviar ordres a la CS2, locomotores, desviaments o accessoris.
- Conservar compatibilitat amb els projectes JSON existents i amb els fluxos XTrackCAD.
- La interfície clàssica continua disponible com a fallback.

## Porta de qualitat abans de publicar

1. Proves unitàries dels adaptadors i de l'estat compartit entre modes.
2. Proves de preservació de projecte, selecció, nivell, zoom i panells durant el canvi de mode.
3. Regressió completa existent (`npm test` i `npm run test:browser`).
4. Validació de fail-safe i confirmació que cap sortida s'habilita per canviar de mode.
5. Construcció i instal·lació Windows 11 NSIS.
6. Prova manual de menús, diàlegs, teclat, accessibilitat i canvi de mode.
7. No fusionar ni publicar si hi ha cap FAIL.

## Estat

Branca de treball creada des de `main`: `feature/native-windows-ui-modes`.

Aquest document fixa l'especificació. No afirma que la migració nativa estigui implementada ni que les proves s'hagin executat.