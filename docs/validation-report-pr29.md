# Acta de validació — senyalització RFIG (PR #29)

## Identificació i abast

- Repositori: `tc-jmri-team/jmri-tc-app`
- Branca: `feature/pr29-rfig-signalling-validation`
- PR: [#29 — validació VMR i seqüència RFIG](https://github.com/tc-jmri-team/jmri-tc-app/pull/29)
- Main de referència: `3e34d909ba1659debf270425dc4d9052bd224d1f`
- SHA de codi cobert per la CI completa més recent: `d35a4d39a18ec91a52d2a59960124e07e778224e`
- Data de l'acta: 2026-11-16

## Evidència de CI

| Execució | SHA provat | Workflow | Resultat |
|---|---|---|---|
| [#579](https://github.com/tc-jmri-team/jmri-tc-app/actions/runs/43953581406) | `3073ea5d989a53ae583661eddf3b80f7fee216f7` | Dispatcher and editor tests | SUCCESS |
| [#580](https://github.com/tc-jmri-team/jmri-tc-app/actions/runs/43953618305) | `3073ea5d989a53ae583661eddf3b80f7fee216f7` | Dispatcher and editor tests | SUCCESS |
| [#584](https://github.com/tc-jmri-team/jmri-tc-app/actions/runs/43954035805) | `b722e1b5269796fb2d02f8fd4b94f94701b8f393` | Dispatcher and editor tests | SUCCESS |
| [#585](https://github.com/tc-jmri-team/jmri-tc-app/actions/runs/43954048874) | `b722e1b5269796fb2d02f8fd4b94f94701b8f393` | Dispatcher and editor tests | SUCCESS |\n| [#591](https://github.com/tc-jmri-team/jmri-tc-app/actions/runs/43954384152) | `d35a4d39a18ec91a52d2a59960124e07e778224e` | Dispatcher and editor tests | SUCCESS |\n| [#592](https://github.com/tc-jmri-team/jmri-tc-app/actions/runs/43954451296) | `d35a4d39a18ec91a52d2a59960124e07e778224e` | Dispatcher and editor tests | SUCCESS |

Les execucions #579/#580, #584/#585 i #591/#592 van completar el workflow complet, incloent Chromium/Playwright, VMR de navegador real, proves de seguretat, integració de senyalització, supervisió JMRI i dues passades de regressió/fail-safe. #591/#592 cobreixen el SHA `d35a4d39a18ec91a52d2a59960124e07e778224e`. Els canvis documentals posteriors de revisió no queden coberts fins a una nova execució.

## Proves de fallada i recuperació afegides

A `tests/signalling-integration.cjs` s'han afegit comprovacions per:
- pèrdua de comunicació JMRI i retorn a comunicació amb heartbeat fresc;
- sensor amb codificació desconeguda, estat UNKNOWN i recuperació amb lectura FREE vàlida;
- recuperació de l'aspecte només després de reavaluar amb alimentació i telemetria vàlides;
- restauració d'una seqüència Senyal 1 / Senyal 2 coherent.

La mateixa suite ja cobreix heartbeat i lectures caducades, alimentació OFF/UNKNOWN, bloc ocupat, itinerari absent, desviaments no verificats o desalineats, emergència, referències inexistents i cicles. `tests/safety.cjs` i `tests/safety-bridge.cjs` cobreixen el bloqueig inicial, l'absència d'autorització, el trip i el reset bloquejat, i la negativa del pont a armar DCC sense les condicions requerides.

## Estat de la VMR

- VMR-023 — seqüència Senyal 1 / Senyal 2: PARCIAL-CI; proves unitàries verdes, però falta integrar la validació d'ordre físic del nou mòdul en el flux actiu.
- VMR-024 — aspectes i transicions: PASS-CI a #591/#592, SHA `d35a4d3`.
- VMR-025 — traçabilitat: PARCIAL; acta i matriu revisades, pendents de CI del commit documental actual.
- VMR-026 — fallada i recuperació: PARCIAL-CI; falta demostrar transició fallada→recuperada i restauració d'una referència que abans era absent.
- Requisits físics VMR-016 a VMR-020 i autorització VMR-022: PENDENT-FÍSIC.
- VMR-021 (referència Digikeijs ADJ9000): NO-VERIFICAT.

## Resultats de revisió tècnica (punt 1)

- La comparació confirma 13 commits per davant de `main` i 0 per darrere; el merge-base és `3e34d909ba1659debf270425dc4d9052bd224d1f`.
- Detectada i corregida la representació literal `\\n` a les files VMR-023…VMR-026; abans no eren files Markdown independents.
- Observació R1: `signalling-sequence-core.js` és un validador nou però no està cridat pel flux de l'aplicació (`signalling-integration.js`/`signalling-integration-core.js`). Cal integrar-lo o retirar l'afirmació que valida l'ordre físic en execució.
- Observació R2: les dues proves finals de recuperació de `tests/signalling-integration.cjs` són duplicades; `recoveredMissing` no parteix d'una referència absent. `recoveredCommunication` tampoc modela una seqüència temporal de pèrdua i retorn, sinó una nova avaluació amb telemetria sana.
- Per aquests motius, VMR-023 i VMR-026 es mantenen parcials, no certificats com a PASS.

## Incidències i limitacions pendents

1. Executar CI completa sobre el SHA documental actual després de la revisió.
2. Integrar i provar `signalling-sequence-core.js` en el flux real o ajustar l'abast de la VMR i documentació.
3. Afegir proves de recuperació genuïnes amb estat inicial fallit, reparació explícita i reavaluació; eliminar el duplicat `recoveredMissing`.
4. Cal inspecció elèctrica individual, verificació del cablejat, fusibles, polaritat i parada d'emergència física independent.
5. Cal validar en banc els models, protocols i firmware de les centrals reals.
6. Aquesta acta no és una certificació ADIF/RFIG, no valida distàncies de frenada reals ni substitueix un enclavament ferroviari homologat.

## Decisió

**NO AUTORITZAT per a operació física.** Mantenir DCC, sortides físiques, comandament de desviaments i automatització bloquejats fins a completar CI, revisió tècnica i totes les comprovacions físiques independents. La CI verda només acredita les proves de programari executades sobre el SHA corresponent.
