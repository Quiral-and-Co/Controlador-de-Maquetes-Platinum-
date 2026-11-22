using Quiral.ControladorMaquetes.Core;

namespace Quiral.ControladorMaquetes.Maerklin;

public sealed record S88ContactState(
    uint ContactUid,
    ushort DeviceId,
    ushort ContactNumber,
    bool IsOccupied,
    DateTimeOffset LastChangedAt,
    ushort Timestamp10Ms);

/// <summary>
/// Adapta el feedback S88 validat de la CS2 al registre de dispositius i al bus
/// tipat de QuiralCore. No genera ordres ni modifica l'estat d'ocupació per
/// estimacions o contactes virtuals.
/// </summary>
public sealed class S88FeedbackModule : IQuiralModule
{
    private readonly Cs2TcpController _controller;
    private readonly object _sync = new();
    private readonly Dictionary<uint, S88ContactState> _contacts = new();
    private QuiralCore? _core;
    private readonly SemaphoreSlim _persistLock = new(1, 1);

    public string Name => "S88Feedback";
    public IReadOnlyList<S88ContactState> Snapshot
    {
        get { lock (_sync) return _contacts.Values.OrderBy(x => x.DeviceId).ThenBy(x => x.ContactNumber).ToArray(); }
    }

    public S88FeedbackModule(Cs2TcpController controller) =>
        _controller = controller ?? throw new ArgumentNullException(nameof(controller));

    public async Task StartAsync(QuiralCore core, CancellationToken cancellationToken)
    {
        _core = core ?? throw new ArgumentNullException(nameof(core));
        var restored = await core.State.ReadAsync<List<S88ContactState>>("feedback/s88-contacts.json", cancellationToken)
            .ConfigureAwait(false);
        if (restored is not null)
        {
            lock (_sync)
                foreach (var contact in restored)
                    _contacts[contact.ContactUid] = contact;
            foreach (var contact in restored)
                RegisterDevice(contact, RailwayDeviceState.Disconnected);
        }

        _controller.S88ContactChanged += OnContactChanged;
        _controller.S88ModuleRead += OnModuleRead;
    }

    private void OnContactChanged(S88ContactEvent value)
    {
        var state = new S88ContactState(value.ContactUid, value.DeviceId, value.ContactNumber,
            value.IsOccupied, value.ReceivedAt, value.Timestamp10Ms);
        lock (_sync) _contacts[value.ContactUid] = state;
        RegisterDevice(state, RailwayDeviceState.Connected);
        _core?.Events.Publish(state);
        _core?.Events.Publish(new QuiralEvent(value.ReceivedAt, "s88.contact.changed",
            $"S88 {value.DeviceId}:{value.ContactNumber} = {(value.IsOccupied ? "OCUPAT" : "LLIURE")}"));
        _ = PersistSafelyAsync();
    }

    private void OnModuleRead(S88ModuleSnapshot value)
    {
        _core?.Events.Publish(value);
        _core?.Events.Publish(new QuiralEvent(value.ReceivedAt, "s88.module.updated",
            $"Mòdul S88 {value.ModuleNumber}: 0x{value.ContactBits:X4}"));
    }

    private void RegisterDevice(S88ContactState contact, RailwayDeviceState state)
    {
        _core?.Devices.Upsert(new RailwayDevice(
            $"s88-{contact.DeviceId:X4}-{contact.ContactNumber:D4}",
            $"S88 {contact.DeviceId:X4}:{contact.ContactNumber}",
            RailwayDeviceKind.Sensor, state, "Märklin", "S88",
            "Märklin CS2 60215 / mCAN", contact.LastChangedAt));
    }

    private async Task PersistSafelyAsync()
    {
        try
        {
            if (_core is null) return;
            await _persistLock.WaitAsync().ConfigureAwait(false);
            try
            {
                await _core.State.WriteAsync("feedback/s88-contacts.json", Snapshot).ConfigureAwait(false);
            }
            finally { _persistLock.Release(); }
        }
        catch (Exception exception)
        {
            _core?.Diagnostics.Record(DiagnosticSeverity.Error, Name,
                $"No s'ha pogut persistir el feedback S88: {exception.Message}");
        }
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        _controller.S88ContactChanged -= OnContactChanged;
        _controller.S88ModuleRead -= OnModuleRead;
        if (_core is not null)
        {
            await _persistLock.WaitAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                await _core.State.WriteAsync("feedback/s88-contacts.json", Snapshot, cancellationToken)
                    .ConfigureAwait(false);
            }
            finally { _persistLock.Release(); }
        }
    }
}
