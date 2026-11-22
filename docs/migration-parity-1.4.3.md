# Pla de migració funcional — versió 1.4.3

## Objectiu

Traslladar progressivament les funcions de l'aplicació Electron a l'aplicació Windows nativa C# / .NET 10 / Windows Forms. Electron es conserva temporalment com a referència de comportament i banc de regressió; no és el runtime de la nova aplicació.

La versió 1.4.3 identifica la línia de migració nativa. **No significa que tota la paritat amb Electron ja estigui assolida.**

## Estat verificat al codi de la branca

| Àrea | Estat natiu actual | Diferència respecte d'Electron |
|---|---|---|
| Nucli local, esdeveniments, registre, persistència i diagnòstic | Parcialment implementat | Falta completar els serveis i pantalles de producte |
| Projectes | Parcial | Alta, llistat, obertura i desat bàsics; falta compatibilitat completa amb el model JSON v3 i operacions d'importació/exportació |
| Editor de maqueta | Parcial | Hi ha trams XYZ bàsics; falten editor gràfic 2D, biblioteca Märklin C, nivells complets, selecció, desfer/refer, connexions, corbes, topologia i importació/exportació XTrackCAD |
| Material mòbil | Parcial | Inventari i composicions bàsics; falten importació, camps avançats, editor complet i integració amb cabines |
| Centrals digitals | Parcial | CS2 té controlador específic; el catàleg d'altres centrals és descriptiu/arquitectònic, no un conjunt de drivers físics |
| Feedback S88 | Parcial | Integració nativa existent; cal paritat funcional, diagnòstic i proves amb maquinari real |
| Accessoris i descodificadors | Parcial | Gestió/configuració local; CV físic no disponible fins a disposar d'un programador real i verificat |
| Seguretat i sortides físiques | Bloquejat per disseny | No s'ha de portar cap bypass de l'antic pont; cal completar validació i proves físiques independents |
| Despatxador, blocs i itineraris | Pendent | Cal migrar el motor i la interfície mantenint l'estat desconegut com a estat segur |
| Circulacions, horaris i automatització | Pendent | Cal migrar motors, preflight, persistència i interfície sense habilitar moviment per defecte |
| Locomotive DMI i panells de cabina | Pendent | Cal migrar control visual i entrades; qualsevol ordre física continua subjecta al nucli de seguretat |
| Senyalització, topologia i diagnòstic | Pendent | Cal migrar el model, visualització, matriu de validació i proves de no-regressió |
| Protecció de tren, home mort i ràdio tren-terra | Pendent | Cal portar watchdogs i comportaments fail-safe a serveis natius, amb proves equivalents |
| Adaptadors JMRI i ponts locals | Pendent de decisió/adaptació | La nova arquitectura no pot dependre de JMRI ni de serveis web; només es poden portar protocols locals verificats i necessaris |
| Preferències, localització, finestres i multi-monitor | Parcial | Cal paritat d'estat, accessibilitat i comportament de finestres natives |
| Actualitzacions | Parcial | El comprovador obre la pàgina oficial de versions; no instal·la automàticament |

## Seqüència de migració

1. **Compatibilitat de dades:** importar, validar, desar i exportar projectes v2/v3 sense pèrdua; proves de round-trip i còpia de seguretat.
2. **Editor natiu:** geometria 2D/3D, catàleg, nivells, selecció, edició, undo/redo, connexions, corbes i topologia.
3. **Material mòbil i operació:** inventari complet, composicions, blocs, despatxador, itineraris i horaris.
4. **Interfície operativa:** panells de cabina, DMI, protecció de tren, home mort i ràdio tren-terra.
5. **Senyalització i diagnòstic:** senyals, supervisió, matriu de validació i eines d'inspecció.
6. **Maquinari i seguretat:** drivers documentats, feedback verificat, watchdog, interbloquejos i parada d'emergència independent.
7. **Distribució:** proves d'acceptació Windows, instal·lació/desinstal·lació, migració de dades d'usuari i publicació signada.

## Portes de qualitat

- Cap funció Electron es declara migrada només perquè existeixi un menú o una pantalla placeholder.
- Cada mòdul migrat necessita proves unitàries i d'integració equivalents, incloent-hi importació de dades reals.
- Les sortides físiques continuen bloquejades fins que el nucli de seguretat autoritzi explícitament el cas d'ús validat.
- No es retiren els fitxers Electron ni les proves de regressió fins que totes les funcions corresponents tinguin paritat nativa demostrada.
- No es publica la 1.4.3 com a substitut complet d'Electron mentre quedin àrees pendents d'aquesta matriu.
