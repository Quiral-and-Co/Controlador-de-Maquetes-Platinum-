namespace Quiral.ControladorMaquetes.Decoders;

/// <summary>Protocols de transport i busos que poden exposar una central digital.</summary>
public enum CentralTransport
{
    Tcp, Udp, Serial, Usb, NetworkBridge
}

public enum CentralProtocol
{
    MaerklinCan, EsuEcos, Z21Lan, LocoNet, XpressNet, ZimoZcan,
    DccEx, Nce, SerialVendor, Unknown
}

[Flags]
public enum CentralCapabilities
{
    None = 0,
    LocomotiveControl = 1,
    AccessoryControl = 2,
    ProgrammingTrackRead = 4,
    ProgrammingTrackWrite = 8,
    PomWrite = 16,
    PomRead = 32,
    RailComFeedback = 64,
    OccupancyFeedback = 128,
    AccessoryFeedback = 256,
    Mfx = 512,
    Motorola = 1024,
    Dcc = 2048,
    FirmwareUpdate = 4096
}

/// <summary>
/// Perfil comercial/connexió. Les capacitats són funcions documentades a nivell de família;
/// l'adaptador ha de verificar model, firmware i mòduls connectats abans d'habilitar-les.
/// </summary>
public sealed record DigitalCentralProfile(
    string Manufacturer,
    string Model,
    string ProtocolName,
    CentralProtocol Protocol,
    IReadOnlyList<CentralTransport> Transports,
    string Notes);

/// <summary>Catàleg de centrals i interfícies. No implica que cada perfil tingui ja un driver operatiu.</summary>
public static class DigitalCentralCatalog
{
    public static IReadOnlyList<DigitalCentralProfile> Profiles { get; } = new[]
    {
        new DigitalCentralProfile("Märklin", "Central Station 1 (60212, original)", "CS1 PC network protocol (firmware-dependent)", CentralProtocol.EsuEcos, new[] { CentralTransport.Tcp }, "Model original, no confondre amb CS1 Reloaded. La compatibilitat de protocol depèn del firmware; verificar la versió exacta abans de connectar o habilitar programació."),
        new DigitalCentralProfile("ESU / Märklin", "Central Station 1 Reloaded (60212 actualitzada)", "ESU ECoSControl TCP", CentralProtocol.EsuEcos, new[] { CentralTransport.Tcp }, "Actualització ESU 3.x: la interfície de PC és compatible amb el protocol de programari ECoS 2.x. Cal validar firmware i capacitats reals."),
        new DigitalCentralProfile("Märklin", "Interface 6051 (per Control Unit / Control 80f)", "Märklin 6050/6051 serial protocol", CentralProtocol.SerialVendor, new[] { CentralTransport.Serial }, "És una interfície RS-232 de 9 pins, no una central independent. Controla locomotores Motorola i accessoris; permet entrada S88. Requereix una Control Unit/Control 80f i port sèrie o adaptador USB-sèrie."),
        new DigitalCentralProfile("Uhlenbrock", "Intellibox 3 (IB3) - xarxa", "Z21 LAN", CentralProtocol.Z21Lan, new[] { CentralTransport.Tcp, CentralTransport.Udp }, "La interfície WLAN de fàbrica ofereix Z21 LAN; adreça per defecte documentada 192.168.0.111. Confirmar configuració real abans de connectar."),
        new DigitalCentralProfile("Uhlenbrock", "Intellibox 3 (IB3) - LocoNet per xarxa", "LocoNet-over-TCP", CentralProtocol.LocoNet, new[] { CentralTransport.Tcp }, "La interfície WLAN també ofereix LocoNet-over-TCP; verificar port i configuració de xarxa."),
        new DigitalCentralProfile("Uhlenbrock", "Intellibox 3 (IB3) - USB", "LocoNet USB (115200 baud)", CentralProtocol.LocoNet, new[] { CentralTransport.Usb, CentralTransport.Serial }, "USB crea ports COM virtuals; protocol LocoNet a 115200 baud. El port assignat s'ha de seleccionar a la configuració.")
        new DigitalCentralProfile("Märklin", "Central Station 2 (60214/60215)", "Märklin CAN over TCP/UDP", CentralProtocol.MaerklinCan, new[] { CentralTransport.Tcp, CentralTransport.Udp }, "mCAN; feedback S88 segons configuració. La programació CV no s'ha de donar per disponible sense validar la funció i el firmware."),
        new DigitalCentralProfile("Märklin", "Central Station 3 / 3 plus (60226/60216)", "Märklin CAN / interfície de xarxa", CentralProtocol.MaerklinCan, new[] { CentralTransport.Tcp, CentralTransport.Udp }, "mfx, DCC i Motorola segons decoder i configuració; verificar separadament API i programació."),
        new DigitalCentralProfile("ESU", "ECoS 50000 / 50200 / 50210", "ESU ECoSControl TCP", CentralProtocol.EsuEcos, new[] { CentralTransport.Tcp }, "Interfície de xarxa ESU; funcions de programació i feedback dependents de model/firmware."),
        new DigitalCentralProfile("ESU", "CabControl", "ESU / interfície de xarxa", CentralProtocol.EsuEcos, new[] { CentralTransport.Tcp, CentralTransport.NetworkBridge }, "Cal verificar API pública i versió de firmware abans d'habilitar operacions."),
        new DigitalCentralProfile("Lenz", "LZV100 / LZV200 amb interfície LAN/USB", "XpressNet", CentralProtocol.XpressNet, new[] { CentralTransport.Serial, CentralTransport.Usb, CentralTransport.Tcp }, "El bus XpressNet requereix interfície física o pont compatible."),
        new DigitalCentralProfile("ZIMO", "MX10 / MX10EC", "ZIMO CAN 2.0 (ZCAN10/20)", CentralProtocol.ZimoZcan, new[] { CentralTransport.Tcp, CentralTransport.Usb, CentralTransport.Serial }, "Protocol oficial ZIMO CAN; validar versió i funcions de programació."),
        new DigitalCentralProfile("Uhlenbrock", "Intellibox / Intellibox IR", "LocoNet / interfície sèrie", CentralProtocol.LocoNet, new[] { CentralTransport.Serial, CentralTransport.Usb }, "La connexió varia segons generació i interfície."),
        new DigitalCentralProfile("Uhlenbrock", "Intellibox II / II Basic / IB-Com", "LocoNet / USB", CentralProtocol.LocoNet, new[] { CentralTransport.Usb, CentralTransport.Serial }, "Verificar firmware, port i implementació LocoNet."),
        new DigitalCentralProfile("Roco / Fleischmann", "Z21 negra / Z21 blanca / z21 start", "Z21 LAN", CentralProtocol.Z21Lan, new[] { CentralTransport.Tcp, CentralTransport.Udp }, "Protocol LAN documentat; POM i RailCom depenen de central, firmware, decoder i configuració."),
        new DigitalCentralProfile("Digikeijs", "DR5000", "Z21 LAN / LocoNet TCP / XpressNet LAN", CentralProtocol.Z21Lan, new[] { CentralTransport.Tcp, CentralTransport.Udp, CentralTransport.Usb }, "Protocol de xarxa seleccionable a la DR5000; només un mode de protocol LAN pot estar actiu alhora segons configuració."),
        new DigitalCentralProfile("YaMoRC", "YD7001", "Z21 LAN / LocoNet", CentralProtocol.Z21Lan, new[] { CentralTransport.Tcp, CentralTransport.Udp, CentralTransport.Usb }, "Cal seleccionar el protocol habilitat i verificar el firmware."),
        new DigitalCentralProfile("YaMoRC", "YD7010", "Z21 LAN / LocoNet", CentralProtocol.Z21Lan, new[] { CentralTransport.Tcp, CentralTransport.Udp, CentralTransport.Usb }, "Cal verificar quines funcions exposa la versió de firmware."),
        new DigitalCentralProfile("NCE", "Power Cab / Power Pro", "NCE serial", CentralProtocol.Nce, new[] { CentralTransport.Serial, CentralTransport.Usb }, "Connexió mitjançant interfície sèrie compatible."),
        new DigitalCentralProfile("Digitrax", "DCS / Zephyr amb interfície LocoNet", "LocoNet", CentralProtocol.LocoNet, new[] { CentralTransport.Usb, CentralTransport.Serial, CentralTransport.NetworkBridge }, "Cal interfície LocoNet compatible."),
        new DigitalCentralProfile("DCC-EX", "EX-CommandStation", "DCC-EX serial / WiFi", CentralProtocol.DccEx, new[] { CentralTransport.Serial, CentralTransport.Usb, CentralTransport.Tcp }, "Protocol obert; capacitats condicionades al firmware instal·lat.")
    };
}

/// <summary>Resultat de detecció; cap capacitat es considera activa abans de negociar amb el dispositiu.</summary>
public sealed record CentralConnectionInfo(
    string Manufacturer,
    string Model,
    string Firmware,
    CentralProtocol Protocol,
    CentralTransport Transport,
    CentralCapabilities VerifiedCapabilities,
    string DeviceIdentity);

/// <summary>Contracte comú per als drivers de centrals digitals.</summary>
public interface IDigitalCentralAdapter : IAsyncDisposable
{
    string AdapterId { get; }
    bool IsConnected { get; }
    CentralConnectionInfo? Connection { get; }
    Task ConnectAsync(DigitalCentralProfile profile, string endpoint, CancellationToken cancellationToken = default);
    Task DisconnectAsync(CancellationToken cancellationToken = default);
    Task<CentralCapabilities> ProbeCapabilitiesAsync(CancellationToken cancellationToken = default);
    Task SendAccessoryCommandAsync(int address, int output, bool active, CancellationToken cancellationToken = default);
    Task<int> ReadCvOnProgrammingTrackAsync(int cv, CancellationToken cancellationToken = default);
    Task WriteCvOnProgrammingTrackAsync(int cv, int value, CancellationToken cancellationToken = default);
    Task WriteCvPomAsync(int decoderAddress, int cv, int value, CancellationToken cancellationToken = default);
    Task<int> ReadCvPomAsync(int decoderAddress, int cv, CancellationToken cancellationToken = default);
}

/// <summary>Esdeveniment de feedback físic. "Confirmed" només quan la font retorna una lectura real.</summary>
public sealed record DecoderPhysicalFeedback(
    string CentralId,
    string DecoderId,
    int? Address,
    string Source,
    string State,
    DateTimeOffset ReceivedAt,
    bool Confirmed);

public interface IDecoderFeedbackSource
{
    event Action<DecoderPhysicalFeedback>? FeedbackReceived;
    Task StartFeedbackAsync(CancellationToken cancellationToken = default);
    Task StopFeedbackAsync(CancellationToken cancellationToken = default);
}
