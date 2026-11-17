# Validació final — matriu d'acceptació i protocol físic

## Política de bloqueig

L'estat inicial és **BLOCKED**. DCC i les sortides físiques han de continuar deshabilitats durant tota la CI i durant el protocol físic inicial. El workflow fixa explícitament:

- JMRI_TC_ENABLE_DCC=0
- JMRI_TC_SAFETY_VALIDATED=0

No s'han d'afegir secrets, variables ni passos que canviïn aquests valors a la CI. Cap evidència de CI, casella declarativa o simulació pot desbloquejar sortides. L'acceptació física requereix evidència local revisada per una persona autoritzada; l'activació posterior de DCC queda fora d'aquesta PR.

## Matriu d'acceptació

Cada fila exigeix el resultat, el registre brut i la referència a l'evidència. Un resultat absent equival a **BLOCKED**, mai a PASS.

| ID | Comprovació | Criteri d'acceptació | Evidència obligatòria | Porta |
|---|---|---|---|---|
| SW-01 | Sintaxi i suite completa | npm test exit 0 | unit-regression.log | Obligatòria |
| SW-02 | Regressió de navegador | npm run test:browser exit 0 | browser-regression.log | Obligatòria |
| GEO-01 | Moviment X longitudinal | Desplaçament i coordenades esperades | log/prova XYZ amb entrada i sortida | Obligatòria |
| GEO-02 | Moviment Y transversal | Desplaçament i coordenades esperades | log/prova XYZ amb entrada i sortida | Obligatòria |
| GEO-03 | Moviment Z alçada | Desplaçament i coordenades esperades | log/prova XYZ amb entrada i sortida | Obligatòria |
| GEO-04 | Vies paral·leles 77 mm | Separació mesurada 77 mm dins la tolerància documentada | log de geometria i coordenades | Obligatòria |
| GEO-05 | Vies paral·leles 64 mm | Separació mesurada 64 mm dins la tolerància documentada | log de geometria i coordenades | Obligatòria |
| GEO-06 | Corbes | Radi, centre, tangència i continuïtat segons el model | log i valors geomètrics | Obligatòria |
| GEO-07 | Connexions de vies | Ports coincidents, cap connexió invàlida ni referència trencada | sortida del validador topològic | Obligatòria |
| SAFE-01 | Fail-safe | Pèrdua JMRI/WiThrottle, sensor desconegut o alimentació no vàlida manté/restitueix bloqueig | logs de tests/safety.cjs, tests/safety-bridge.cjs i regressió | Obligatòria |
| SAFE-02 | DCC per defecte | Cap ordre ni armament; variables a 0 | report.json i log d'entorn | Obligatòria |
| PKG-01 | Instal·lador NSIS x64 | Build correcte, EXE existent i mida major que zero | log NSIS, nom, bytes i SHA-256 | Obligatòria |
| PHY-01 | CS2 60215 i JMRI | Connexió observada només en lectura | captura/log local, hora i versions | BLOCKED fins a prova local |
| PHY-02 | Sensors S88 | Lectures ocupat/lliure verificades sensor a sensor | taula d'observacions, timestamps i identificadors | BLOCKED fins a prova local |
| PHY-03 | Cablejat i proteccions | Polaritat, seccions, aïllaments, fusibles i alimentacions inspeccionats | acta signada i fotografies/mesures locals | BLOCKED fins a prova local |
| PHY-04 | Emergència independent | Parada física independent inspeccionada i provada sense dependre del PC/JMRI | acta de prova local | BLOCKED fins a prova local |
| PHY-05 | No actuació | Cap ordre DCC/locomotora/desviament enviada; DCC roman desarmat | log de sessió i confirmació de l'operador | Obligatòria |

**Regla global:** qualsevol FAIL, evidència absent, dada desconeguda, pèrdua de comunicació o discrepància deixa l'estat en BLOCKED. No s'autoritza la fusió com a versió validada ni l'ús físic automatitzat mentre hi hagi portes pendents.

## Execució reproduïble

En Windows 11 x64, amb Node.js 22:

~~~powershell
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
node --version
npm --version
npm ci
$env:JMRI_TC_ENABLE_DCC="0"
$env:JMRI_TC_SAFETY_VALIDATED="0"
npm run validate:final
~~~

El workflow executa la suite completa, proves de navegador, acceptació geomètrica i empaquetatge NSIS. Desa logs individuals i genera:

- artifacts/final-validation/report.json
- artifacts/final-validation/report.md
- artifacts/final-validation/*.log

El JSON inclou SHA del commit, runtime, resultats, codis de sortida, artefactes i SHA-256 de l'instal·lador. Conserva els logs originals com a evidència; no substitueixis un log fallit per una captura de pantalla.

## Protocol físic inicial — exclusivament lectura

Aquest protocol no és una prova de circulació ni un permís per activar DCC. L'operador ha de ser físicament present a la maqueta. Si no es pot garantir que el DCC està deshabilitat i les sortides bloquejades, no s'inicia la sessió.

1. Confirma visualment que el pont DCC està desarmat i que les variables d'entorn són 0. No configuris JMRI_TC_ENABLE_DCC=1 ni JMRI_TC_SAFETY_VALIDATED=1.
2. Mantén locomotores estacionades i no enviïs ordres de velocitat, sentit, funcions, desviaments ni rutes.
3. Inspecciona sense manipular conductors energitzats: alimentacions, polaritat, seccions, aïllaments, fusibles, connexions i proteccions.
4. Verifica la disponibilitat i independència de la parada d'emergència física. Qualsevol prova que pugui energitzar tracció s'ajorna a un procediment separat, autoritzat i amb DCC bloquejat.
5. Connecta JMRI/CS2 60215 només per monitorització. Registra model, firmware, versions, ports, hora i estat de connexió; no enviïs ordres.
6. Observa els sensors un per un i registra identificador JMRI, estat reportat, hora i resultat d'una observació física independent. Si un sensor és desconegut, contradictori o intermitent, marca FAIL.
7. Observa l'estat d'alimentació i les pèrdues de comunicació sense provocar moviment ni enviar ordres. Confirma que l'aplicació es manté bloquejada davant dades desconegudes.
8. Tanca la sessió, desa logs i evidències, i confirma de nou que DCC continua deshabilitat.

### Registre manual obligatori

| Camp | Valor |
|---|---|
| Operador / revisor | Pendent |
| Data i hora local | Pendent |
| Commit / versió de l'aplicació | Pendent |
| CS2 60215 / firmware | Pendent |
| Versió JMRI | Pendent |
| DCC deshabilitat abans i després | Pendent — ha de ser SÍ |
| Sensors comprovats i evidència | Pendent |
| Cablejat/proteccions inspeccionats | Pendent |
| Parada d'emergència independent | Pendent |
| Ordres físiques enviades | Cap |
| Resultat | BLOCKED fins a revisió de totes les evidències |

## Límits

La CI no té accés a la CS2, a la maqueta, al cablejat, als sensors ni al circuit físic d'emergència. Per tant, pot construir l'instal·lador i provar el comportament de programari, però no pot declarar completat el protocol físic. Aquest document no certifica un enclavament ferroviari.
