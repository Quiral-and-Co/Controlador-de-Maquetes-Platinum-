# JMRI-TC Gold Custom 1.3.0 — base d’automatització

## Què incorpora aquesta entrega

- Motor pur `automation-core.js` per validar horaris, dies de circulació, finestra d’inici i velocitat màxima programada.
- Preflight supervisat: JMRI connectat, alimentació ON, WiThrottle connectat, DCC armat, lectures de sensors vàlides, primer bloc ocupat i blocs següents lliures.
- Requisits opcionals de desviaments: cada desviament requerit ha de tenir estat esperat i verificació tant al registre com a la telemetria actual.
- Registre d’execucions amb protecció contra doble activació del mateix horari en un mateix dia.
- Tests deterministes sense maquinari.

## Límit funcional d’aquesta entrega

Aquesta és la base del planificador i del preflight; **no inicia trens automàticament, no envia ordres de desviaments ni senyals i no substitueix el Dispatcher existent**. La resposta READY només indica que les condicions lògiques de planificació s’han complert i que cal una confirmació explícita de l’operador. La integració de maniobres físiques requereix validar els missatges JMRI i la CS2 60215 amb maquinari real, feedback i parada física independent.

El control DCC existent continua limitat a WiThrottle/DCC. MM2 i mfx continuen sent registres de catàleg, no protocols de control operatius.

## Windows 10/11

Requisits: Node.js 20 o superior i Git.

```powershell
git checkout main
git pull origin main
git fetch origin
git checkout feature/v1.3.0-automation-foundation
npm install
npm test
```

Per comprovar el nou motor individualment:

```powershell
node --check automation-core.js
node tests/automation.cjs
```

Per tornar a la branca principal:

```powershell
git checkout main
```

## Model d’horari

- `days`: dies de setmana JavaScript, 0 = diumenge i 6 = dissabte.
- `startTime`: hora local `HH:mm`.
- `windowMinutes`: marge d’inici, entre 1 i 15 minuts.
- `maxSpeed`: passos WiThrottle entre 1 i 20.
- `requiredTurnouts`: llista de desviaments amb `systemName`, `state` (`CLOSED` o `THROWN`) i `verified:true`.

Aquest motor no infereix adreces, estats, sensors ni alineacions. Si falta una dada o és desconeguda, el preflight bloqueja l’activació.

## Seguretat

JMRI-TC no és un enclavament ferroviari certificat. Mantén una parada d’emergència física independent, valida el traçat, la detecció, la frenada i les ordres de cada descodificador abans de qualsevol circulació real.
