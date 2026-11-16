# Acta de validació — senyalització RFIG (PR #29)

## Identificació i abast

- Repositori: `tc-jmri-team/jmri-tc-app`
- Branca: `feature/pr29-rfig-signalling-validation`
- PR: [#29 — validació VMR i seqüència RFIG](https://github.com/tc-jmri-team/jmri-tc-app/pull/29)
- Main de referència: `3e34d909ba1659debf270425dc4d9052bd224d1f`
- SHA de la branca amb les proves de fallada/recuperació i la correcció de la matriu: `b722e1b5269796fb2d02f8fd4b94f94701b8f393`
- Data de l'acta: 2026-11-16

## Evidència de CI

| Execució | SHA provat | Workflow | Resultat |
|---|---|---|---|
| [#579](https://github.com/tc-jmri-team/jmri-tc-app/actions/runs/43953581406) | `3073ea5d989a53ae583661eddf3b80f7fee216f7` | Dispatcher and editor tests | SUCCESS |
| [#580](https://github.com/tc-jmri-team/jmri-tc-app/actions/runs/43953618305) | `3073ea5d989a53ae583661eddf3b80f7fee216f7` | Dispatcher and editor tests | SUCCESS |
| [#584](https://github.com/tc-jmri-team/jmri-tc-app/actions/runs/43954035805) | `b722e1b5269796fb2d02f8fd4b94f94701b8f393` | Dispatcher and editor tests | SUCCESS |
| [#585](https://github.com/tc-jmri-team/jmri-tc-app/actions/runs/43954048874) | `b722e1b5269796fb2d02f8fd4b94f94701b8f393` | Dispatcher and editor tests | SUCCESS |

Les execucions #579 i #580 van completar amb èxit la CI completa, incloent Chromium/Playwright, VMR de navegador real, proves de seguretat, integració de senyalització, supervisió JMRI i dues passades de regressió/fail-safe. Les execucions #584 i #585 són evidència completa del SHA indicat i inclouen les proves afegides de fallada/recuperació. No cobreixen els commits documentals posteriors.

## Proves de fallada i recuperació afegides

A `tests/signalling-integration.cjs` s'han afegit comprovacions per:
- pèrdua de comunicació JMRI i retorn a comunicació amb heartbeat fresc;
- sensor amb codificació desconeguda, estat UNKNOWN i recuperació amb lectura FREE vàlida;
- recuperació de l'aspecte només després de reavaluar amb alimentació i telemetria vàlides;
- restauració d'una seqüència Senyal 1 / Senyal 2 coherent.

La mateixa suite ja cobreix heartbeat i lectures caducades, alimentació OFF/UNKNOWN, bloc ocupat, itinerari absent, desviaments no verificats o desalineats, emergència, referències inexistents i cicles. `tests/safety.cjs` i `tests/safety-bridge.cjs` cobreixen el bloqueig inicial, l'absència d'autorització, el trip i el reset bloquejat, i la negativa del pont a armar DCC sense les condicions requerides.

## Estat de la VMR

- VMR-023 — seqüència Senyal 1 / Senyal 2: PASS-CI a #584/#585, SHA `b722e1b`.
- VMR-024 — aspectes i transicions: PASS-CI a #584/#585, SHA `b722e1b`.
- VMR-025 — traçabilitat de senyalització RFIG: PASS-CI documental i de proves a #584/#585, SHA `b722e1b`.
- VMR-026 — fallada i recuperació: PASS-CI a #584/#585, SHA `b722e1b`.
- Requisits físics VMR-016 a VMR-020 i autorització VMR-022: PENDENT-FÍSIC.
- VMR-021 (referència Digikeijs ADJ9000): NO-VERIFICAT.

## Incidències i limitacions pendents

1. La CI #584/#585 del SHA `b722e1b5269796fb2d02f8fd4b94f94701b8f393` és verda. La PR continua oberta i en esborrany fins a revisar la CI del commit documental actual.
2. La recuperació només es produeix després de reavaluar amb telemetria vàlida; no ha d'armar automàticament sortides físiques.
3. Cal inspecció elèctrica individual, verificació del cablejat, fusibles, polaritat i parada d'emergència física independent.
4. Cal validar en banc els models, protocols i firmware de les centrals reals.
5. Aquesta acta no és una certificació ADIF/RFIG, no valida distàncies de frenada reals ni substitueix un enclavament ferroviari homologat.

## Decisió

**NO AUTORITZAT per a operació física.** Mantenir DCC, sortides físiques, comandament de desviaments i automatització bloquejats fins a completar CI, revisió tècnica i totes les comprovacions físiques independents. La CI verda només acredita les proves de programari executades sobre el SHA corresponent.
