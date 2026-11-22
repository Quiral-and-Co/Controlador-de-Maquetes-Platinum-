using Quiral.ControladorMaquetes.Core;

namespace Quiral.ControladorMaquetes.Accessories;

public enum AccessoryKind { Turnout, Signal, Uncoupler, Light, Relay, Other }
public enum AccessoryProtocol { Motorola, Mm2, Dcc }
public enum AccessoryPosition { Unknown, Straight, Diverging, On, Off }

public sealed record RailwayAccessory(
    string Id,
    string Name,
    AccessoryKind Kind,
    AccessoryProtocol Protocol,
    int Address,
    int Output = 1,
    AccessoryPosition Position = AccessoryPosition.Unknown,
    string? Decoder = null,
    string? Notes = null,
    DateTimeOffset CreatedAt = default,
    DateTimeOffset UpdatedAt = default,
    string? StateLabel = null);

/// <summary>
/// Registre local centralitzat d'accessoris i desviaments. Gestiona identitat,
/// adreçament, configuració i estat conegut; no envia ordres al maquinari.
/// </summary>
public sealed class AccessoryModule : IQuiralModule
{
    private readonly Dictionary<string, RailwayAccessory> _items = new(StringComparer.OrdinalIgnoreCase);
    private readonly SemaphoreSlim _sync = new(1, 1);
    private QuiralCore? _core;

    public string Name => "RailwayAccessoryManagement";
    public bool PhysicalControlImplemented => false;

    public async Task StartAsync(QuiralCore core, CancellationToken cancellationToken)
    {
        _core = core ?? throw new ArgumentNullException(nameof(core));
        var restored = await core.State.ReadAsync<List<RailwayAccessory>>(
            "accessories/registry.json", cancellationToken).ConfigureAwait(false) ?? new();
        foreach (var item in restored)
        {
            Validate(item);
            EnsureAddressAvailable(item, item.Id);
            _items.Add(item.Id, item);
            RegisterDevice(item);
        }
    }

    public async Task<RailwayAccessory> AddAsync(RailwayAccessory item, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(item);
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var now = DateTimeOffset.UtcNow;
            var saved = item with
            {
                Id = string.IsNullOrWhiteSpace(item.Id) ? Guid.NewGuid().ToString("N") : item.Id.Trim(),
                Name = item.Name.Trim(),
                CreatedAt = now,
                UpdatedAt = now
            };
            Validate(saved);
            if (_items.ContainsKey(saved.Id)) throw new InvalidOperationException("Ja existeix aquest identificador d'accessori.");
            EnsureAddressAvailable(saved, null);
            _items.Add(saved.Id, saved);
            RegisterDevice(saved);
            await PersistAsync(cancellationToken).ConfigureAwait(false);
            return saved;
        }
        finally { _sync.Release(); }
    }

    public async Task<RailwayAccessory> UpdateAsync(RailwayAccessory item, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(item);
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (!_items.TryGetValue(item.Id, out var current))
                throw new KeyNotFoundException("No s'ha trobat l'accessori.");
            var saved = item with { Name = item.Name.Trim(), CreatedAt = current.CreatedAt, UpdatedAt = DateTimeOffset.UtcNow };
            Validate(saved);
            EnsureAddressAvailable(saved, saved.Id);
            _items[saved.Id] = saved;
            RegisterDevice(saved);
            await PersistAsync(cancellationToken).ConfigureAwait(false);
            return saved;
        }
        finally { _sync.Release(); }
    }

    public async Task<bool> RemoveAsync(string id, CancellationToken cancellationToken = default)
    {
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (!_items.Remove(id)) return false;
            _core?.Devices.Remove("accessory-" + id);
            await PersistAsync(cancellationToken).ConfigureAwait(false);
            return true;
        }
        finally { _sync.Release(); }
    }

    public async Task<IReadOnlyList<RailwayAccessory>> SnapshotAsync(CancellationToken cancellationToken = default)
    {
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try { return _items.Values.OrderBy(x => x.Protocol).ThenBy(x => x.Address).ThenBy(x => x.Output).ToArray(); }
        finally { _sync.Release(); }
    }

    private static void Validate(RailwayAccessory item)
    {
        if (string.IsNullOrWhiteSpace(item.Id)) throw new ArgumentException("L'identificador és obligatori.");
        if (string.IsNullOrWhiteSpace(item.Name)) throw new ArgumentException("El nom de l'accessori és obligatori.");
        if (item.Address is < 1 or > 2048) throw new ArgumentOutOfRangeException(nameof(item), "L'adreça ha d'estar entre 1 i 2048.");
        if (item.Output is < 1 or > 4) throw new ArgumentOutOfRangeException(nameof(item), "La sortida ha d'estar entre 1 i 4.");
        if (!Enum.IsDefined(item.Kind) || !Enum.IsDefined(item.Protocol) || !Enum.IsDefined(item.Position))
            throw new ArgumentException("Tipus, protocol o posició no vàlids.");
    }

    private void EnsureAddressAvailable(RailwayAccessory candidate, string? exceptId)
    {
        if (_items.Values.Any(x => !string.Equals(x.Id, exceptId, StringComparison.OrdinalIgnoreCase) &&
            x.Protocol == candidate.Protocol && x.Address == candidate.Address && x.Output == candidate.Output))
            throw new InvalidOperationException($"L'adreça {candidate.Address}, sortida {candidate.Output} ({candidate.Protocol}) ja està assignada.");
    }

    private void RegisterDevice(RailwayAccessory item)
    {
        _core?.Devices.Upsert(new RailwayDevice(
            "accessory-" + item.Id, item.Name, RailwayDeviceKind.AccessoryDecoder,
            RailwayDeviceState.Configured, "Quiral", item.Decoder ?? item.Protocol.ToString(),
            $"{item.Protocol} · adreça {item.Address} · sortida {item.Output}", item.UpdatedAt));
    }

    private Task PersistAsync(CancellationToken cancellationToken) =>
        _core!.State.WriteAsync("accessories/registry.json", _items.Values.OrderBy(x => x.Address).ToList(), cancellationToken);

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
