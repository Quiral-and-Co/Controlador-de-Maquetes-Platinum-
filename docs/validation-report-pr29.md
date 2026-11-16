# Acta de validació — senyalització RFIG (PR #29)

## Identificació i abast

- Repositori: `tc-jmri-team/jmri-tc-app`
- Branca: `feature/pr29-rfig-signalling-validation`
- PR: [#29 — validació VMR i seqüència RFIG](https://github.com/tc-jmri-team/jmri-tc-app/pull/29)
- Main de referència: `3e34d909ba1659debf270425dc4d9052bd224d1f`
- SHA de codi cobert per la CI completa més recent: `3960e146fdf0e3e9a7af859e851972fbf34c3a90`
- Data de l'acta: 2026-11-16

## Evidència de CI

| Execució | SHA provat | Workflow | Resultat |
|---|---|---|---|
| [#579](https://github.com/tc-jmri-team/jmri-tc-app/actions/runs/43953581406) | `3073ea5d989a53ae583661eddf3b80f7fee216f7` | Dispatcher and editor tests | SUCCESS |
| [#580](https://github.com/tc-jmri-team/jmri-tc-app/actions/runs/43953618305) | `3073ea5d989a53ae583661eddf3b80f7fee216f7` | Dispatcher and editor tests | SUCCESS |
| [#584](https://github.com/tc-jmri-team/jmri-tc-app/actions/runs/43954035805) | `b722e1b5269796fb2d02f8fd4b94f94701b8f393` | Dispatcher and editor tests | SUCCESS |
| [#585](https://github.com/tc-jmri-team/jmri-tc-app/actions/runs/43954048874) | `b722e1b5269796fb2d02f8fd4b94f94701b8f393` | Dispatcher and editor tests | SUCCESS |\n| [#591](https://github.com/tc-jmri-team/jmri-tc-app/actions/runs/43954384152) | `d35a4d39a18ec91a52d2a59960124e07e778224e` | Dispatcher and editor tests | SUCCESS |\n| [#592](https://github.com/tc-jmri-team/jmri-tc-app/actions/runs/43954451296) | `d35a4d39a18ec91a52d2a59960124e07e778224e` | Dispatcher and editor tests | SUCCESS |

Les execucions #579/#580, #584/#585, #591/#592 i #605 van completar el workflow complet, incloent Chromium/Playwright, VMR de navegador real, proves de seguretat, integració de senyalització, supervisió JMRI i dues passades de regressió/fail-safe. #605 cobreix el SHA `3960e146fdf0e3e9a7af859e851972fbf34c3a90`; tots els passos, incloses les dues regressions/fail-safe, han acabat en SUCCESS.

## Proves de fallada i recuperació afegides

A `tests/signalling-integration.cjs` s'han afegit comprovacions per:
- pèrdua de comunicació JMRI i retorn a comunicació amb heartbeat fresc;
- sensor amb codificació desconeguda, estat UNKNOWN i recuperació amb lectura FREE vàlida;
- recuperació de l'aspecte només després de reavaluar amb alimentació i telemetria vàlides;
- restauració d'una seqüència Senyal 1 / Senyal 2 coherent.

La mateixa suite ja cobreix heartbeat i lectures caducades, alimentació OFF/UNKNOWN, bloc ocupat, itinerari absent, desviaments no verificats o desalineats, emergència, referències inexistents i cicles. `tests/safety.cjs` i `tests/safety-bridge.cjs` cobreixen el bloqueig inicial, l'absència d'autorització, el trip i el reset bloquejat, i la negativa del pont a armar DCC sense les condicions requerides.

## Estat de la VMR

- VMR-023 — seqüència Senyal 1 / Senyal 2: PASS-CI a #605, SHA `3960e14`; validador integrat en el flux actiu i provat amb ordre de blocs i sentit.
- VMR-024 — aspectes i transicions: PASS-CI a #591/#592, SHA `d35a4d3`.
- VMR-025 — traçabilitat: PASS-CI a #605, SHA `3960e14`; acta actualitzada amb evidències i límits.
- VMR-026 — fallada i recuperació: PASS-CI a #605, SHA `3960e14`; transicions fallada→recuperada amb evidència nova verificades.
- Requisits físics VMR-016 a VMR-020 i autorització VMR-022: PENDENT-FÍSIC.
- VMR-021 (referència Digikeijs ADJ9000): NO-VERIFICAT.

## Resolució de les observacions tècniques (R1 i R2)

- **R1 — resolta:** el validador de seqüències s'invoca des del nucli actiu. `index.html` carrega `signalling-sequence-core.js` abans de la integració. La suite integrada prova ordre correcte, sentit incompatible i bloqueig restrictiu.
- **R2 — resolta:** les proves de recuperació parteixen d'estats fallits explícits. La comunicació requereix heartbeat nou; el sensor requereix lectura FREE nova; l'alimentació requereix ON confirmat; la seqüència parteix d'una referència absent i només es recupera després de reparar-la.
- CI completa #605: SUCCESS. Les proves de navegador real, seguretat, integració, diagnòstics, supervisió, i dues passades completes de regressió/fail-safe han acabat correctament.

## Incidències i limitacions pendents

1. Executar CI completa sobre el SHA documental actual després de la revisió.
2. Integrar i provar `signalling-sequence-core.js` en el flux real o ajustar l'abast de la VMR i documentació.
3. Afegir proves de recuperació genuïnes amb estat inicial fallit, reparació explícita i reavaluació; eliminar el duplicat `recoveredMissing`.
4. Cal inspecció elèctrica individual, verificació del cablejat, fusibles, polaritat i parada d'emergència física independent.
5. Cal validar en banc els models, protocols i firmware de les centrals reals.
6. Aquesta acta no és una certificació ADIF/RFIG, no valida distàncies de frenada reals ni substitueix un enclavament ferroviari homologat.

## Decisió

**NO AUTORITZAT per a operació física.** Mantenir DCC, sortides físiques, comandament de desviaments i automatització bloquejats fins a completar CI, revisió tècnica i totes les comprovacions físiques independents. La CI verda només acredita les proves de programari executades sobre el SHA corresponent.
