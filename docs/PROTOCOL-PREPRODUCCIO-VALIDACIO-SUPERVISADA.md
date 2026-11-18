# Protocol de revisió de preproducció i validació supervisada

**Projecte:** JMRI TC Gold Custom  
**Estat inicial:** preproducció de programari validada per CI; acceptació supervisada de la instal·lació i de la maqueta encara pendent.  
**Regla de bloqueig:** cap FAIL, resultat desconegut o comprovació pendent no es pot convertir en PASS per omissió.

## 1. Objectiu i límits

Aquest protocol separa la validació del programari de la validació elèctrica i física de la maqueta. La superació de CI o la instal·lació correcta no autoritzen per si soles la circulació ni l'automatització.

Durant tot el protocol es mantenen:
- `JMRI_TC_ENABLE_DCC=0`
- `JMRI_TC_SAFETY_VALIDATED=0`
- Sortides físiques i automatitzacions bloquejades.
- PR #44 oberta, en Draft i sense fusionar fins a autorització explícita i revisió de tots els gates.

## 2. Identificació de la versió

Registrar abans de començar:
- Commit exacte (SHA complet) i branca.
- Versió de l'aplicació.
- Nom complet de l'instal·lador, que inclourà hora i data local de Catalunya: `HHMMSS-DDMMAA`.
- Mida del fitxer i SHA-256 del mateix EXE.
- Enllaç i identificador de l'artefacte de CI.
- Versió de Windows 11, arquitectura i data/hora de la prova.
- Persona que executa i persona que supervisa.

No reutilitzar un instal·lador antic encara que tingui el mateix número de versió. Comparar sempre el SHA-256 amb el manifest publicat.

## 3. Gate A — Revisió documental i CI

Marcar PASS només amb evidència del mateix commit:
- [ ] Branca i SHA identificats i coincideixen amb el HEAD de la PR.
- [ ] CI completa de Despatxador/Editor finalitzada amb SUCCESS.
- [ ] CI Windows 11 finalitzada amb SUCCESS.
- [ ] Regressió completa i fail-safe superades en les execucions exigides.
- [ ] Proves de navegador real superades.
- [ ] Gate de geometria: moviments X/Y/Z, vies paral·leles a 77 mm i 64 mm, corbes i topologia.
- [ ] Proves de seguretat, interbloquejos, Metge Quiral i recuperació superades.
- [ ] NSIS creat, EXE no buit, SHA-256 recalculat i coincident.
- [ ] EXE i manifest SHA-256 publicats com a artefacte de la mateixa execució.
- [ ] PR oberta, sense fusionar; cap canvi posterior al SHA validat.

**FAIL/ABORT:** qualsevol workflow fallit, pendent, cancel·lat o associat a un SHA diferent.

## 4. Gate B — Instal·lació neta a Windows 11

En un equip o màquina virtual de prova, sense connexió a la maqueta:
1. Descarregar l'artefacte de la CI indicada.
2. Verificar el SHA-256 de l'EXE amb el manifest abans d'executar-lo.
3. Registrar qualsevol avís de Windows o antivirus. La CI no disposa de certificat de signatura configurat; per tant, no s'ha de descriure l'instal·lador com a signat.
4. Instal·lar i iniciar l'aplicació.
5. Comprovar els modes clàssic i modern de manera independent, incloent cintes funcionals, menús, finestres flotants i restauració de disposició.
6. Comprovar català en menús, submenús, diàlegs propis, ajuda i diagnòstics del Metge Quiral. Anotar qualsevol text del sistema operatiu que depengui de l'idioma de Windows.
7. Obrir, desar i tornar a obrir un projecte de prova; comprovar que no es perden nivells, peces, seleccions ni connexions.
8. Provar Editor, Despatxador, Trànsit, Horaris, Operació i Metge Quiral sense activar sortides físiques.
9. Tancar i tornar a iniciar l'aplicació; comprovar persistència i absència d'errors.
10. Registrar resultat, captures/logs i incidències. No utilitzar projectes únics sense còpia de seguretat.

**PASS:** tots els punts verificats i evidència arxivada. **FAIL:** qualsevol bloqueig, pèrdua de dades, ordre inesperada o funció crítica inoperativa.

## 5. Gate C — Validació supervisada sense moviment

Abans de connectar la maqueta:
- [ ] Inspecció visual de cablejat, connectors, polaritat, seccions i aïllament.
- [ ] Proteccions dimensionades i verificades per una persona competent: fusibles, limitació de corrent i tall d'emergència.
- [ ] Tall d'emergència físic accessible, provat i independent del programari.
- [ ] Estat segur definit davant pèrdua d'alimentació, xarxa, servidor JMRI o comunicació amb la CS2.
- [ ] CS2 Märklin 60215 i alimentació identificades; cap cablejat dubtós o exposat.
- [ ] Sensors i desviaments documentats; cap element marcat com a verificat sense prova física real.
- [ ] Sortides DCC deshabilitades i bloqueig confirmat al registre de seguretat.

Fer primer les comprovacions sense tensió. Les proves elèctriques amb tensió només les pot fer una persona competent, amb la maqueta aïllada i el procediment de tall d'emergència disponible. No provocar curtcircuits ni fallades perilloses deliberadament.

## 6. Gate D — Proves de comunicació i fail-safe supervisades

Amb sortides físiques encara bloquejades:
- [ ] Verificar només la comunicació de dades amb la CS2, sense enviar ordres de moviment.
- [ ] Confirmar que la pèrdua de xarxa/comunicació no provoca cap activació ni recuperació automàtica de sortides.
- [ ] Confirmar que reiniciar l'aplicació o el pont no arma el sistema.
- [ ] Confirmar que un estat desconegut, un sensor no verificat o un diagnòstic crític manté el bloqueig.
- [ ] Confirmar que Metge Quiral informa dels errors i que no els marca com a resolts sense evidència.
- [ ] Confirmar que el tall d'emergència físic preval sobre qualsevol ordre de programari.

**ABORT immediat:** moviment inesperat, sortida activada, estat no segur, tall d'emergència ineficaç, pèrdua de supervisió o discrepància entre estat físic i programari. Desconnectar l'alimentació de tracció mitjançant el procediment físic segur i mantenir el sistema bloquejat.

## 7. Gate E — Prova física controlada (NO autoritzada per aquest protocol)

Aquesta etapa queda **NO AUTORITZADA** fins que els Gates A–D siguin PASS, les proteccions elèctriques estiguin signades per una persona competent i l'usuari doni autorització explícita separada.

Qualsevol prova futura haurà de tenir:
- Pla de prova específic, responsable i supervisor presents.
- Zona de prova aïllada, una única locomotora i velocitat mínima.
- Tall d'emergència físic provat abans de començar.
- Criteris d'aturada i recuperació documentats.
- Cap macro, esdeveniment programat ni automatització activa.
- Registre de cada ordre i de la resposta física observada.

La prova manual anterior amb Märklin CS2 60215 i BR 89 amb ESU LokPilot 5 M4 és antecedent informatiu, no substitueix aquesta acceptació ni autoritza automatització.

## 8. Registre de resultats i decisió

Per a cada comprovació registrar: ID, data/hora, commit/versió, responsable, resultat PASS/FAIL/BLOCKED, evidència, incidència i acció correctiva.

- **PASS:** evidència directa i repetible.
- **FAIL:** resultat contrari al criteri; bloqueja el gate.
- **BLOCKED/PENDING:** no executat o sense evidència; també bloqueja el gate.
- Després d'una correcció, repetir la prova afectada i les regressions relacionades sobre el nou SHA.

## 9. Autoritzacions

- Revisió de CI i instal·lador: pendent de signatura.
- Acceptació de Windows 11: pendent de prova supervisada.
- Revisió elèctrica i de proteccions: pendent de persona competent.
- Validació física fail-safe: pendent.
- Autorització de sortides DCC: **NO**.
- Autorització d'automatització física: **NO**.
- Autorització de fusió de PR #44: **NO**, requereix decisió explícita separada.
