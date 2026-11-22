using Quiral.ControladorMaquetes.Core;

namespace Quiral.ControladorMaquetes.Decoders;

public sealed record DecoderBrand(string Name, IReadOnlyList<string> Models);
public sealed record DecoderOutput(int Number, string Name, int Address, string Function, bool Enabled = true);
public sealed record DecoderConfiguration(
    string Id, string Brand, string Model, string DecoderKind, int OutputCount,
    string Protocol, int BaseAddress, IReadOnlyList<DecoderOutput> Outputs,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

/// <summary>Catàleg inicial de fabricants. Els models específics s'amplien a partir de la referència real del fabricant.</summary>
public static class DecoderCatalog
{
    public static IReadOnlyList<DecoderBrand> Brands { get; } = new[]
    {
        new DecoderBrand("Märklin", new[] { "m83 / 60831", "m84 / 60841", "k83 / 6083", "k84 / 6084", "Altres / model personalitzat" }),
        new DecoderBrand("ESU", new[] { "SwitchPilot", "SwitchPilot Servo", "SwitchPilot Extension", "LokPilot / LokSound (funcions)", "Altres / model personalitzat" }),
        new DecoderBrand("Uhlenbrock", new[] { "67800 / Accessory Decoder", "63410 / Switch-Control", "Altres / model personalitzat" }),
        new DecoderBrand("Yamorc", new[] { "YD7001", "YD8116", "YD7403", "Altres / model personalitzat" }),
        new DecoderBrand("Digikeijs", new[] { "DR4018", "DR4024", "DR4050", "Altres / model personalitzat" }),
        new DecoderBrand("Roco", new[] { "10836 Z21 switch DECODER", "10775", "Altres / model personalitzat" }),
        new DecoderBrand("Lenz", new[] { "LS150", "LS100", "LS110", "Altres / model personalitzat" }),
        new DecoderBrand("ZIMO", new[] { "MX820", "MX821", "Altres / model personalitzat" }),
        new DecoderBrand("Viessmann", new[] { "5211", "5231", "5212", "Altres / model personalitzat" }),
        new DecoderBrand("Tams", new[] { "S DEC", "M DEC", "Altres / model personalitzat" }),
        new DecoderBrand("Qdecoder", new[] { "ZA1", "ZA2", "Altres / model personalitzat" }),
        new DecoderBrand("Altres fabricants", new[] { "Model personalitzat" })
    };

    public static IReadOnlyList<int> SupportedOutputCounts { get; } = Enumerable.Range(2, 15).ToArray();
}

public sealed class DecoderConfigurationModule : IQuiralModule
{
    private const string StorePath = "decoders/configurations.json";
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly Dictionary<string, DecoderConfiguration> _items = new(StringComparer.OrdinalIgnoreCase);
    private QuiralCore? _core;
    public string Name => "DecoderConfiguration";
    public Task StartAsync(QuiralCore core, CancellationToken ct)
    {
        _core = core ?? throw new ArgumentNullException(nameof(core));
        return RestoreAsync(ct);
    }
    private async Task RestoreAsync(CancellationToken ct)
    {
        var saved = await _core!.State.ReadAsync<List<DecoderConfiguration>>(StorePath, ct).ConfigureAwait(false) ?? new();
        foreach (var item in saved) { Validate(item); _items[item.Id] = item; }
    }
    public async Task<IReadOnlyList<DecoderConfiguration>> SnapshotAsync(CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try { return _items.Values.OrderBy(x => x.Brand).ThenBy(x => x.Model).ToArray(); }
        finally { _gate.Release(); }
    }
    public async Task<DecoderConfiguration> SaveAsync(DecoderConfiguration item, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(item);
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            Validate(item);
            var now = DateTimeOffset.UtcNow;
            var saved = item with { Id = string.IsNullOrWhiteSpace(item.Id) ? Guid.NewGuid().ToString("N") : item.Id,
                CreatedAt = item.CreatedAt == default ? now : item.CreatedAt, UpdatedAt = now,
                Outputs = item.Outputs.OrderBy(x => x.Number).ToArray() };
            _items[saved.Id] = saved;
            await _core!.State.WriteAsync(StorePath, _items.Values.OrderBy(x => x.Brand).ToList(), ct).ConfigureAwait(false);
            return saved;
        }
        finally { _gate.Release(); }
    }
    private static void Validate(DecoderConfiguration item)
    {
        if (string.IsNullOrWhiteSpace(item.Brand) || string.IsNullOrWhiteSpace(item.Model))
            throw new ArgumentException("Cal indicar marca i model del decoder.");
        if (item.OutputCount is < 2 or > 16) throw new ArgumentOutOfRangeException(nameof(item.OutputCount), "El decoder ha de tenir entre 2 i 16 sortides.");
        if (item.Outputs.Count != item.OutputCount || item.Outputs.Select(x => x.Number).Distinct().Count() != item.OutputCount ||
            item.Outputs.Any(x => x.Number < 1 || x.Number > item.OutputCount || x.Address < 1 || x.Address > 2048))
            throw new ArgumentException("Les sortides han de ser úniques, completes i tenir adreces vàlides.");
    }
    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}

public interface IDccCvProgrammer
{
    bool IsAvailable { get; }
    string ProviderName { get; }
    Task<int> ReadCvAsync(int cvNumber, CancellationToken ct = default);
    Task WriteCvAsync(int cvNumber, int value, CancellationToken ct = default);
}

/// <summary>La UI no simula lectures: fins que no es connecti un programador físic, l'operació queda no disponible.</summary>
public sealed class UnavailableDccCvProgrammer : IDccCvProgrammer
{
    public bool IsAvailable => false;
    public string ProviderName => "Cap interfície de programació CV connectada";
    public Task<int> ReadCvAsync(int cvNumber, CancellationToken ct = default) =>
        throw new NotSupportedException("No hi ha cap interfície física de programació CV connectada. No s'ha llegit cap valor.");
    public Task WriteCvAsync(int cvNumber, int value, CancellationToken ct = default) =>
        throw new NotSupportedException("No hi ha cap interfície física de programació CV connectada. No s'ha escrit cap valor.");
}

public sealed record CvDefinition(int Number, string Name, string Explanation, int Minimum, int Maximum, int SuggestedValue);
public static class DccCvCatalog
{
    // Valors estàndard habituals per a descodificadors mòbils DCC. No s'apliquen a descodificadors d'accessoris.
    public static IReadOnlyList<CvDefinition> MobileDecoderBasics { get; } = new[]
    {
        new CvDefinition(1, "Adreça curta", "Adreça bàsica del vehicle (quan s'utilitza adreça curta).", 1, 127, 3),
        new CvDefinition(2, "Tensió inicial", "Velocitat mínima d'arrencada.", 0, 255, 0),
        new CvDefinition(3, "Acceleració", "Inèrcia d'acceleració. Valors més alts donen una resposta més suau.", 0, 255, 0),
        new CvDefinition(4, "Frenada", "Inèrcia de frenada.", 0, 255, 0),
        new CvDefinition(5, "Velocitat màxima", "Límit superior de velocitat (si el decoder ho implementa).", 0, 255, 0),
        new CvDefinition(6, "Velocitat mitjana", "Punt intermedi de la corba de velocitat (si s'admet).", 0, 255, 0),
        new CvDefinition(29, "Configuració bàsica", "Bits de configuració DCC; modificar només si se'n coneix el significat.", 0, 255, 6)
    };
}
