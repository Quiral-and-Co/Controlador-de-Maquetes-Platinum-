namespace Quiral.ControladorMaquetes.Core;

public enum RailwayDeviceKind
{
    CommandStation,
    FeedbackModule,
    AccessoryDecoder,
    Locomotive,
    Sensor,
    Unknown
}

public enum RailwayDeviceState
{
    Discovered,
    Configured,
    Connected,
    Degraded,
    Disconnected,
    Faulted
}

/// <summary>Descripció de dispositiu; registrar-lo no obre connexions ni envia ordres.</summary>
public sealed record RailwayDevice(
    string Id,
    string DisplayName,
    RailwayDeviceKind Kind,
    RailwayDeviceState State,
    string? Manufacturer = null,
    string? Model = null,
    string? ConnectionDescription = null,
    DateTimeOffset? LastSeenAt = null);

public sealed class DeviceRegistry
{
    private readonly object _sync = new();
    private readonly Dictionary<string, RailwayDevice> _devices =
        new(StringComparer.OrdinalIgnoreCase);

    public void Upsert(RailwayDevice device)
    {
        ArgumentNullException.ThrowIfNull(device);
        if (string.IsNullOrWhiteSpace(device.Id))
            throw new ArgumentException("L'identificador del dispositiu és obligatori.", nameof(device));
        lock (_sync)
            _devices[device.Id] = device;
    }

    public bool TryGet(string id, out RailwayDevice? device)
    {
        lock (_sync)
            return _devices.TryGetValue(id, out device);
    }

    public IReadOnlyList<RailwayDevice> Snapshot()
    {
        lock (_sync)
            return _devices.Values.OrderBy(x => x.DisplayName, StringComparer.CurrentCultureIgnoreCase).ToArray();
    }

    public bool Remove(string id)
    {
        lock (_sync)
            return _devices.Remove(id);
    }
}
