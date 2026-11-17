# Gestió de fitxers de projecte

## Operacions d'escriptori

La versió Electron incorpora el menú natiu **Fitxer** i les dreceres:
- Nou: `Ctrl+N`
- Obrir: `Ctrl+O`
- Guardar: `Ctrl+S`
- Guardar com: `Ctrl+Maj+S`

Els projectes nadius es desen com a JSON del model JMRI TC Gold Custom v3. Abans de crear un projecte nou o substituir el projecte obert, l'aplicació demana confirmació si hi ha canvis pendents.

## XTrackCAD

S'accepten fitxers de text `.xtc`, `.xti` i `.xtm` que continguin elements XTrackCAD `STRAIGHT` i `CURVE`. Les coordenades en polzades es converteixen a mil·límetres. Les capes 0–4 s'assignen als cinc nivells de JMRI TC.

L'exportació `.xtc` genera capçalera/versionat XTrackCAD i peces rectes i corbes. No converteix encara desviaments, joints, Bezier, blocs, sensors, senyals, estructures ni objectes gràfics. Els elements no exportats es mostren al registre. Les connexions topològiques no es marquen com a verificades.

L'exportació no substitueix la validació de geometria i gàlib amb el catàleg Märklin C.

## AnyRail

El format natiu `.any` és propietari i no disposa d'una especificació pública interoperable suficient per implementar un lector/escriptor fiable sense fitxers de referència i proves de compatibilitat. Per això, la versió actual no llegeix ni genera `.any` directament.

AnyRail documenta l'opció **Fitxer → Exportar com → JMRI Layout file** per generar XML destinat a JMRI PanelPro. La importació d'aquest XML requereix un adaptador específic i queda pendent; no s'ha de confondre amb l'obertura d'un `.any`.

## Seguretat i pèrdua de dades

Les importacions externes només modifiquen el model gràfic. No activen JMRI, DCC, sensors ni sortides físiques. Les connexions importades o generades continuen no verificades fins que superin les proves geomètriques, topològiques i de seguretat del projecte.
