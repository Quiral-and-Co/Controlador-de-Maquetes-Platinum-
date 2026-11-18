# Política i procediment de signatura digital Authenticode

Estat: PREPARACIÓ — signatura desactivada fins a contractar i validar el certificat.

## Objectiu

Signar l'instal·lador NSIS de JMRI TC Gold Custom perquè Windows pugui verificar la identitat del publicador i la integritat del fitxer. La signatura Authenticode de l'EXE és independent de les signatures Git/GitHub dels commits.

Titular desitjat: persona física. El subjecte del certificat ha de mostrar el nom legal verificat del titular, no un nom de marca inventat.

## Comparativa consultada (18-11-2026)

- Certum Standard Code Signing: web oficial anuncia preus des de 139 EUR; indica que el subjecte pot contenir nom i cognoms o nom d'empresa, amb disponibilitat al núvol. Cal confirmar el preu final, el tractament fiscal i la modalitat individual exacta.
- Certum Individual Code Signing in Cloud: un distribuïdor publica preus des de 97 EUR. És una oferta de distribuïdor, no un preu final confirmat pel fabricant. Cal obtenir confirmació escrita de la compatibilitat amb CI/CD i GitHub Actions.
- Sectigo EV: un distribuïdor publica preus des de 599 EUR, però EV no és la via indicada per a un titular individual; no s'ha d'adquirir com si fos un certificat personal.
- SignPath Foundation: pot oferir signatura gratuïta a projectes OSS acceptats, però el certificat apareix a nom de SignPath Foundation, no del titular individual. Per tant, no compleix el requisit de publicador personal. SignPath amb certificat propi (BYOC) podria ser una capa d'orquestració, pendent de confirmar compatibilitat tècnica del certificat i custòdia de clau.

Microsoft Azure Artifact Signing Public Trust per a desenvolupadors individuals està restringit geogràficament als EUA i al Canadà; no és l'opció per a un particular resident a Espanya.

## Decisió provisional

Candidat preferit: certificat individual Certum Code Signing amb custòdia cloud/HSM.

No contractar fins que Certum o el distribuïdor confirmi per escrit:
1. Que el certificat s'emet a nom d'una persona física resident a Espanya i quin text exacte apareixerà com a Subject/Publisher.
2. Que la clau privada roman en HSM o servei cloud conforme als requisits actuals de CA/B Forum.
3. Que existeix un mecanisme suportat per a signatura des de GitHub Actions (API, PKCS#11/KSP o integració oficial).
4. Que es permet la marca de temps RFC 3161 i es faciliten els endpoints recomanats.
5. Preu final amb IVA, termini, durada efectiva del certificat, renovació/reemissió i política de revocació.

## Integració prevista amb GitHub Actions

Arquitectura preferida si el proveïdor és compatible:
1. Workflow Windows construeix l'instal·lador NSIS.
2. Completa totes les proves de regressió, navegador, geometria i fail-safe.
3. Publica temporalment l'EXE sense signar com a artefacte intern de GitHub Actions.
4. Un pas de signatura remot (preferentment SignPath amb certificat propi, si confirma suport) rep l'artefacte del workflow de confiança i retorna l'EXE signat.
5. El runner verifica la signatura amb SignTool i comprova el subject del certificat esperat.
6. Només després de la verificació, afegeix el sufix local HHMMSS-DDMMAA al nom final i calcula SHA-256 sobre l'EXE ja signat.
7. Publica l'EXE signat i el manifest SHA-256. Conserva també el registre de la petició de signatura i el commit SHA d'origen.

### Acció SignPath — patró documentat, no activat

La documentació oficial de SignPath mostra l'acció `signpath/github-action-submit-signing-request@v3`. La integració requereix un compte/organització, projecte, política de signatura, configuració de l'artefacte i un API token amb permís de submitter.

Exemple orientatiu (placeholders; no és encara un pas executable del workflow):

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

Aquest patró només s'activarà quan el proveïdor confirmi que el certificat individual i la seva clau poden utilitzar-se en el servei de signatura seleccionat. La configuració d'artefacte SignPath ha de tractar correctament l'embolcall ZIP que crea upload-artifact.

## Secrets i permisos

Secrets previstos a GitHub Actions:
- `SIGNPATH_API_TOKEN`: token d'API, mai al repositori ni als logs.
Variables no secretes:
- `SIGNPATH_ORGANIZATION_ID`
- `SIGNPATH_PROJECT_SLUG`
- `SIGNPATH_SIGNING_POLICY_SLUG`

No s'ha de pujar mai cap fitxer PFX/P12, clau privada, PIN, llavor, token de dispositiu o credencial del proveïdor al repositori, als artefactes ni als logs. Si el proveïdor exigeix exportar una clau privada a un runner efímer, aturar la integració i revisar el disseny.

## Controls obligatoris

- No signar execucions de pull request ni branques de desenvolupament.
- La signatura de publicació només s'executa amb etiqueta de versió protegida i després de totes les proves PASS sobre el mateix commit.
- Requerir aprovació manual de la petició de signatura de publicació.
- Limitar el token al projecte i política necessaris; rotar-lo i revocar-lo quan calgui.
- No signar un artefacte que no provingui del workflow de GitHub autoritzat.
- Verificar amb SignTool: estat de signatura, cadena de confiança, subject esperat i marca de temps.
- Calcular SHA-256 després de signar. El manifest sempre ha de correspondre als bytes exactes de l'EXE distribuït.
- Mantenir l'artefacte sense signar separat i identificat com a tal; no publicar-lo com a instal·lador oficial.

## Verificació Windows

La verificació automatitzada ha d'incloure una ordre equivalent a:

```powershell
signtool verify /pa /all /v .\JMRI-TC-Gold-Custom-Setup-*.exe
Get-AuthenticodeSignature .\JMRI-TC-Gold-Custom-Setup-*.exe | Format-List Status,StatusMessage,SignerCertificate,TimeStamperCertificate
```

El workflow ha de fallar si l'estat no és `Valid`, si el subject no coincideix amb el titular verificat, si falta la marca de temps o si la cadena no és de confiança.

## Estat actual i límits

- Cap certificat ha estat comprat ni emès.
- No s'han creat secrets ni credencials de proveïdor a GitHub.
- No s'ha activat cap pas de signatura en el workflow NSIS.
- Els instal·ladors actuals continuen sense signatura digital.
- La signatura Authenticode no substitueix la validació supervisada de Windows 11 ni les comprovacions elèctriques.
- La PR #44 continua Draft i no s'ha de fusionar sense autorització explícita.
- Les sortides físiques/DCC continuen bloquejades: `JMRI_TC_ENABLE_DCC=0` i `JMRI_TC_SAFETY_VALIDATED=0`.

## Referències

- Microsoft: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- Certum: https://www.certum.eu/en/code-signing-certificates/
- Certum Shop: https://shop.certum.eu/code-signing.html
- SignPath GitHub integration: https://docs.signpath.io/trusted-build-systems/github
- SignPath Foundation terms: https://signpath.org/terms
