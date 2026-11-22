using Quiral.ControladorMaquetes.Safety;

namespace Quiral.ControladorMaquetes.Core;

public enum QuiralCoreState { Created, Initializing, Ready, Stopping, Stopped, Faulted }

public sealed class QuiralCore : IAsyncDisposable
{
    private readonly SemaphoreSlim _lifecycle = new(1, 1);
    private readonly string _dataDirectory;
    private bool _disposed;

    public QuiralEventBus Events { get; } = new();
    public DeviceRegistry Devices { get; } = new();
    public DiagnosticsCatalog Diagnostics { get; } = new();
    public PhysicalOutputGate SafetyGate { get; } = new();
    public CommandDispatcher Commands { get; }
    public LocalStateStore State { get; }
    public QuiralCoreState StateOfCore { get; private set; } = QuiralCoreState.Created;
    public string DataDirectory => _dataDirectory;

    public QuiralCore(string? dataDirectory = null)
    {
        _dataDirectory = Path.GetFullPath(dataDirectory ??
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "QuiralCo", "ControladorDeMaquetes"));
        State = new LocalStateStore(_dataDirectory);
        Commands = new CommandDispatcher(SafetyGate);
    }

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await _lifecycle.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (StateOfCore == QuiralCoreState.Ready) return;
            if (StateOfCore != QuiralCoreState.Created)
                throw new InvalidOperationException($"No es pot inicialitzar el nucli des de l'estat {StateOfCore}.");

            StateOfCore = QuiralCoreState.Initializing;
            Directory.CreateDirectory(Path.Combine(_dataDirectory, "logs"));
            Directory.CreateDirectory(Path.Combine(_dataDirectory, "projects"));
            Directory.CreateDirectory(Path.Combine(_dataDirectory, "backups"));

            Diagnostics.Record(DiagnosticSeverity.Information, "QuiralCore", "Inicialització del nucli local.");
            SafetyGate.Disarm();
            Diagnostics.Record(DiagnosticSeverity.Warning, "Safety", "Sortides físiques bloquejades: no hi ha cap controlador natiu validat.");

            StateOfCore = QuiralCoreState.Ready;
            Events.Publish(new QuiralEvent(DateTimeOffset.UtcNow, "core.ready", "Quiral Control està preparat en mode local."));
            await AppendAuditUnlockedAsync("CORE_READY", "Nucli iniciat; sortides físiques bloquejades.", cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            StateOfCore = QuiralCoreState.Faulted;
            throw;
        }
        finally
        {
            _lifecycle.Release();
        }
    }

    public async Task WriteAuditAsync(string code, string message, CancellationToken cancellationToken = default)
    {
        var line = $"{DateTimeOffset.UtcNow:O}\t{code}\t{message}{Environment.NewLine}";
        var path = Path.Combine(_dataDirectory, "logs", "quiral-audit.log");
        await _lifecycle.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            await File.AppendAllTextAsync(path, line, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            _lifecycle.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        await _lifecycle.WaitAsync().ConfigureAwait(false);
        try
        {
            if (StateOfCore is QuiralCoreState.Ready or QuiralCoreState.Faulted)
            {
                StateOfCore = QuiralCoreState.Stopping;
                SafetyGate.Disarm();
                var path = Path.Combine(_dataDirectory, "logs", "quiral-audit.log");
                if (Directory.Exists(Path.GetDirectoryName(path)!))
                    await File.AppendAllTextAsync(path,
                        $"{DateTimeOffset.UtcNow:O}\tCORE_STOPPED\tNucli aturat; sortides físiques bloquejades.{Environment.NewLine}")
                        .ConfigureAwait(false);
            }
            StateOfCore = QuiralCoreState.Stopped;
            _disposed = true;
        }
        finally
        {
            _lifecycle.Release();
            _lifecycle.Dispose();
        }
    }
}
