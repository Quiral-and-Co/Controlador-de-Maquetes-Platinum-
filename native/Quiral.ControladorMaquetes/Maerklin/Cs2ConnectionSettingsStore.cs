using Quiral.ControladorMaquetes.Core;

namespace Quiral.ControladorMaquetes.Maerklin;

public sealed record Cs2ConnectionSettings(string Host, int Port, bool DhcpEnabled);

/// <summary>Preferències compartides i persistents de connexió amb la CS2.</summary>
public sealed class Cs2ConnectionSettingsStore
{
    private readonly LocalStateStore _state;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private const string PathName = "settings/cs2-connection.json";
    public Cs2ConnectionSettingsStore(LocalStateStore state) => _state = state ?? throw new ArgumentNullException(nameof(state));
    public async Task<Cs2ConnectionSettings> LoadAsync(CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try { return await _state.ReadAsync<Cs2ConnectionSettings>(PathName, ct).ConfigureAwait(false) ?? new Cs2ConnectionSettings("", Cs2TcpController.DefaultPort, false); }
        finally { _gate.Release(); }
    }
    public async Task SaveAsync(Cs2ConnectionSettings settings, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(settings);
        if (settings.Port is < 1 or > 65535) throw new ArgumentOutOfRangeException(nameof(settings));
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try { await _state.WriteAsync(PathName, settings, ct).ConfigureAwait(false); }
        finally { _gate.Release(); }
    }
}