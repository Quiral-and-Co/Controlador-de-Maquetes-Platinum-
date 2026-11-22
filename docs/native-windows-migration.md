# Migració a l'aplicació nativa Windows

## Decisió arquitectònica

El producte final serà una aplicació d'escriptori nativa per a Windows 11, desenvolupada i mantinguda per Quiral & Co. No utilitzarà HTML, CSS, JavaScript de navegador, Electron, Chromium, WebView, interfícies web, JMRI ni serveis al núvol.

La primera base tècnica és **C# amb .NET 10 i Windows Forms**. Windows Forms proporciona controls d'escriptori natius de Windows i no requereix un navegador incrustat. La interfície es construeix amb codi C#; no s'utilitza cap document HTML ni cap capa web.

## Principis obligatoris

- Execució local i autònoma, sense connexió obligatòria a Internet.
- Cap dependència operativa de JMRI ni d'un servidor extern.
- Nucli propi Quiral Control per a sessions, dispositius, protocols, telemetria, registres i diagnòstic.
- Controladors de maquinari natius, implementats només a partir de protocols i manuals verificats.
- Persistència local de projectes i configuració.
- Instal·lador Windows que inclogui els components necessaris.
- Finestres independents i interfície en català.
- Cap activació de sortides físiques sense validació completa, interbloquejos i autorització explícita.

## Estat inicial

La carpeta native/Quiral.ControladorMaquetes és una base d'aplicació Windows nativa, no una substitució funcional completa de l'aplicació existent. El formulari inicial no controla cap central ni cap perifèric. Els menús ferroviaris encara no implementats apareixen deshabilitats.

El mòdul PhysicalOutputGate manté les sortides físiques deshabilitades per disseny. En aquesta fase no existeix cap mètode d'armament.

## Fases de migració

1. **Fonament natiu:** projecte .NET, finestra principal, menú, gestió de finestres, registre i configuració local.
2. **Nucli Quiral Control:** API interna tipada, cicle de vida, diagnòstic, esdeveniments i persistència.
3. **Disseny de maqueta:** migrar geometria, moviments XYZ, vies paral·leles de 77 mm i 64 mm, corbes i topologia.
4. **Material mòbil i panells:** migrar inventari, locomotores, composicions, panells de cabina, protecció del tren, ràdio tren-terra i home mort.
5. **Maquinari:** controlador natiu per a Märklin CS2 60215 com a primer objectiu; després S88 i altres centrals/perifèrics segons protocols verificats.
6. **Seguretat:** watchdog, parada d'emergència, pèrdua de comunicació, interbloquejos i validació elèctrica.
7. **Distribució:** instal·lador NSIS natiu, dependències integrades, proves en Windows 11 i funcionament offline.

## Criteris de no-regressió

No s'elimina ni es declara substituïda cap funcionalitat de l'aplicació existent fins que la versió nativa corresponent estigui implementada i superi les proves equivalents.

No es fusionarà a main mentre falli qualsevol prova obligatòria: moviment XYZ, separacions de vies 77/64 mm, geometria de corbes, connexions/topologia, regressió completa, comunicacions, fail-safe i validació física quan pertoqui.

La CI de compilació nativa ha de compilar el projecte Windows. La compilació no equival a validació de maquinari ni a certificació de seguretat.

## Nucli Quiral Control — primera implementació

La primera capa funcional del nucli es troba a `native/Quiral.ControladorMaquetes/Core`:

- `QuiralCore`: cicle de vida, registre de mòduls interns i coordinació de serveis.
- `IQuiralModule`: contracte d'extensió per a mòduls que s'executen dins del mateix procés Windows; inici seqüencial i aturada en ordre invers.
- `QuiralEventBus`: publicació/subscripció d'esdeveniments tipats en memòria, sense sockets ni ports.
- `DeviceRegistry`: inventari tipat de centrals, mòduls de feedback, descodificadors, locomotores i sensors. El registre no inicia comunicacions.
- `CommandDispatcher`: punt únic d'entrada per a ordres. Rebutja les ordres que requereixen sortides físiques abans d'invocar qualsevol controlador.
- `PhysicalOutputGate`: interbloqueig conservador. Les sortides físiques continuen deshabilitades.
- `LocalStateStore`: persistència JSON local amb escriptura temporal i substitució atòmica, i protecció contra rutes que surtin del directori de dades.
- `DiagnosticsCatalog` i auditoria: registres locals limitats en memòria i fitxer d'auditoria persistent.

Les dades es guarden per defecte a `%LOCALAPPDATA%\\QuiralCo\\ControladorDeMaquetes`, amb carpetes separades per a projectes, còpies de seguretat i registres.

La finestra principal ja crea i inicialitza el nucli, i mostra l'estat, el recompte de dispositius i el recompte de diagnòstics. Encara no hi ha cap controlador ferroviari real registrat, cap detecció de maquinari ni cap ordre enviada a una central.

### Proves del nucli

El projecte `native/Quiral.ControladorMaquetes.CoreTests` conté proves executables sense paquets de tercers per a:
- subscripció i alliberament del bus d'esdeveniments;
- registre i cerca de dispositius;
- persistència i rebuig de path traversal;
- bloqueig d'ordres físiques abans d'arribar a un controlador;
- inicialització, auditoria i aturada del nucli.

La CI de Windows executa aquestes proves després de compilar l'aplicació nativa.
