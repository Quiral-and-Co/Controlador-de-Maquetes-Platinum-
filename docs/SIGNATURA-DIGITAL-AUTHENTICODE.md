# Política i procediment de signatura digital Authenticode

Estat: OPCIÓ GRATUÏTA SELECCIONADA — pendent de sol·licitud i acceptació de SignPath Foundation.

## Decisió

S'adopta SignPath Foundation com a primera opció per obtenir signatura Authenticode gratuïta per a JMRI TC Gold Custom, subjecte a l'aprovació de la sol·licitud i al compliment de totes les condicions del programa.

**Identitat del publicador:** la signatura mostrarà SignPath Foundation, no el nom personal del mantenidor ni el nom comercial JMRI TC Gold Custom com a titular del certificat. La fundació custodia la clau privada en un HSM i proporciona el servei de signatura sense cost als projectes OSS acceptats.

Aquesta opció compleix la preferència de cost zero, però no la preferència d'un certificat emès a nom de la persona física. Si és imprescindible que Windows mostri el nom personal del titular, caldrà un certificat comercial individual i aquesta opció gratuïta no ho resol.

## Requisits d'elegibilitat que cal verificar

Les condicions publicades per SignPath Foundation inclouen:
- Projecte amb llicència aprovada per l'OSI per a tots els components, sense doble llicència comercial ni components propietaris no exempts.
- Repositori públic, actiu i mantingut.
- Versió ja publicada del programari i pàgina de descàrrega amb descripció de funcionalitats.
- Equip que manté el codi i els binaris; signar només binaris construïts des del repositori propi.
- Revisió dels canvis proposats per persones no committers.
- Rols diferenciats d'autors/committers, revisors i aprovadores de signatura.
- MFA per als membres de l'equip amb accés al repositori i a SignPath.
- Aprovació manual per a cada petició de signatura.
- Política de signatura publicada a la pàgina principal i a les pàgines de descàrrega/versions.
- Metadades de producte i versió consistents als binaris.
- Origen verificable del binari respecte del repositori i del sistema de compilació de confiança.

La fundació pot rebutjar la sol·licitud; no es considera elegible fins que hi hagi acceptació explícita. Cal revisar la llicència de cada component i les condicions actualitzades abans de presentar-la.

## Política pública que s'haurà de publicar en el web/README i a les descàrregues

Quan la sol·licitud sigui acceptada, publicar exactament la declaració requerida pel programa:

> Free code signing provided by SignPath.io, certificate by SignPath Foundation.

També cal publicar:
- Rols i membres de committers/revisors.
- Rols i membres d'aprovació de versions signades.
- Enllaç a la política de privacitat o la declaració de privacitat exigida per SignPath.
- Enllaç a les pàgines de descàrrega i versions signades.

No publicar aquesta declaració com si el servei ja estigués actiu abans de l'acceptació.

## Integració prevista amb GitHub Actions

La documentació de SignPath ofereix l'acció `signpath/github-action-submit-signing-request@v3`. La configuració definitiva (organització, projecte, política, trusted build system i format de l'artefacte) s'ha de crear al compte SignPath després de l'acceptació.

Exemple orientatiu, no activat encara:

```yaml
- name: Pujar instal·lador sense signar per a la petició
  id: upload-unsigned
  uses: actions/upload-artifact@v4
  with:
    name: nsis-unsigned
    path: dist/*.exe
    if-no-files-found: error

- name: Sol·licitar signatura Authenticode
  uses: signpath/github-action-submit-signing-request@v3
  with:
    api-token: ${{ secrets.SIGNPATH_API_TOKEN }}
    organization-id: ${{ vars.SIGNPATH_ORGANIZATION_ID }}
    project-slug: ${{ vars.SIGNPATH_PROJECT_SLUG }}
    signing-policy-slug: ${{ vars.SIGNPATH_SIGNING_POLICY_SLUG }}
    github-artifact-id: ${{ steps.upload-unsigned.outputs.artifact-id }}
    wait-for-completion: true
    output-artifact-directory: signed
```

La integració només s'activarà després de:
1. Acceptació formal del projecte per SignPath Foundation.
2. Creació del projecte i política de signatura.
3. Configuració del sistema de compilació de confiança i verificació d'origen.
4. Configuració del token API com a secret de GitHub.
5. Validació de l'esquema d'artefacte d'entrada/sortida amb un build de prova.
6. Aprovació manual de cada versió de publicació.

## Secrets i protecció de claus

Secret previst:
- `SIGNPATH_API_TOKEN`: token limitat al projecte i a la submissió de peticions; mai al repositori ni als logs.

Variables no secretes:
- `SIGNPATH_ORGANIZATION_ID`
- `SIGNPATH_PROJECT_SLUG`
- `SIGNPATH_SIGNING_POLICY_SLUG`

La clau privada del certificat de SignPath Foundation no es descarrega ni s'emmagatzema a GitHub. No pujar PFX/P12, claus privades, PINs ni credencials personals a repositori, artefactes o logs.

## Controls obligatoris de publicació

- No signar pull requests ni branques de desenvolupament.
- Signar només versions etiquetades i protegides després de totes les proves PASS sobre el mateix commit.
- Exigir aprovació manual de cada petició de signatura de publicació.
- Activar verificació d'origen i restringir la política a les branques de release autoritzades.
- Verificar l'estat Authenticode, la cadena de confiança, el certificat SignPath Foundation i la marca de temps.
- Calcular SHA-256 després de signar; el manifest ha de correspondre als bytes exactes de l'EXE distribuït.
- No publicar l'artefacte sense signar com a instal·lador oficial.
- Mantenir logs d'auditoria, commit SHA, run ID i identificador de petició de signatura.

## Verificació a Windows

```powershell
signtool verify /pa /all /v .\\JMRI-TC-Gold-Custom-Setup-*.exe
Get-AuthenticodeSignature .\\JMRI-TC-Gold-Custom-Setup-*.exe | Format-List Status,StatusMessage,SignerCertificate,TimeStamperCertificate
```

El workflow ha de fallar si la signatura no és vàlida, si la cadena no és de confiança, si el certificat no és el de SignPath Foundation o si falta la marca de temps.

Una signatura vàlida no garanteix l'absència d'avisos SmartScreen en les primeres descàrregues; la reputació del fitxer es pot construir amb el temps. La signatura sí que permet verificar editor i integritat.

## Estat actual

- SignPath Foundation seleccionada com a opció gratuïta preferida.
- Sol·licitud d'admissió encara no presentada ni acceptada.
- No s'han creat secrets ni credencials a GitHub.
- No s'ha activat cap pas de signatura al workflow NSIS.
- Els instal·ladors actuals continuen sense signatura digital.
- No es declara el projecte com a signat fins que la fundació accepti el projecte i es verifiqui un EXE signat.
- PR #44 continua Draft i no s'ha de fusionar sense autorització explícita.
- Sortides físiques/DCC continuen bloquejades: `JMRI_TC_ENABLE_DCC=0` i `JMRI_TC_SAFETY_VALIDATED=0`.

## Referències

- SignPath Foundation: https://signpath.org/
- Condicions per a projectes OSS: https://github.com/SignPath/fdn-website/blob/main/docs/terms.md
- Integració GitHub: https://docs.signpath.io/trusted-build-systems/github
- Configuració de projectes i polítiques: https://docs.signpath.io/projects
- Microsoft — opcions de signatura Windows: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
