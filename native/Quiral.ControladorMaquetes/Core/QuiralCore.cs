using Quiral.ControladorMaquetes.Safety;

namespace Quiral.ControladorMaquetes.Core;

public enum QuiralCoreState { Created, Initializing, Ready, Stopping, Stopped, Faulted }

/// <summary>
/// Nucli central de l'aplicació. Coordina mòduls interns, dispositius, ordres,
/// esdeveniments, diagnòstic, persistència i auditoria local.
/// </summary>
public sealed class QuiralCore : IAsyncDisposable
{
    private readonly SemaphoreSlim _lifecycle = new(1, 1);
    private readonly SemaphoreSlim _auditLock = new(1, 1);
    private readonly string _dataDirectory;
    private readonly List<IQuiralModule> _modules = new();
    private readonly List<IQuiralModule> _startedModules = new();
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

    public void RegisterModule(IQuiralModule module)
    {
        ArgumentNullException.ThrowIfNull(module);
        if (string.IsNullOrWhiteSpace(module.Name))
            throw new ArgumentException("El mòdul ha de tenir un nom.", nameof(module));
        if (StateOfCore != QuiralCoreState.Created)
            throw new InvalidOperationException("Els mòduls només es poden registrar abans d'inicialitzar el nucli.");
        if (_modules.Any(x => string.Equals(x.Name, module.Name, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException($"Ja existeix un mòdul amb el nom '{module.Name}'.");
        _modules.Add(module);
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

            foreach (var module in _modules)
            {
                cancellationToken.ThrowIfCancellationRequested();
                Diagnostics.Record(DiagnosticSeverity.Information, "QuiralCore", $"Iniciant mòdul: {module.Name}.");
                await module.StartAsync(this, cancellationToken).ConfigureAwait(false);
                _startedModules.Add(module);
            }

            StateOfCore = QuiralCoreState.Ready;
            Events.Publish(new QuiralEvent(DateTimeOffset.UtcNow, "core.ready", "Quiral Control està preparat en mode local."));
            await AppendAuditAsync("CORE_READY", "Nucli iniciat; sortides físiques bloquejades.", cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            await StopStartedModulesAsync().ConfigureAwait(false);
            StateOfCore = QuiralCoreState.Faulted;
            Diagnostics.Record(DiagnosticSeverity.Critical, "QuiralCore", "La inicialització del nucli ha fallat.");
            throw;
        }
        finally
        {
            _lifecycle.Release();
        }
    }

    public Task WriteAuditAsync(string code, string message, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        ArgumentNullException.ThrowIfNull(message);
        return AppendAuditAsync(code, message, cancellationToken);
    }

    private async Task AppendAuditAsync(string code, string message, CancellationToken cancellationToken)
    {
        var line = $"{DateTimeOffset.UtcNow:O}\\t{code}\\t{message}{Environment.NewLine}";
        var path = Path.Combine(_dataDirectory, "logs", "quiral-audit.log");
        await _auditLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            await File.AppendAllTextAsync(path, line, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            _auditLock.Release();
        }
    }

    private async Task StopStartedModulesAsync()
    {
        for (var index = _startedModules.Count - 1; index >= 0; index--)
        {
            var module = _startedModules[index];
            try
            {
                await module.StopAsync(CancellationToken.None).ConfigureAwait(false);
                Diagnostics.Record(DiagnosticSeverity.Information, "QuiralCore", $"Mòdul aturat: {module.Name}.");
            }
            catch (Exception exception)
            {
                Diagnostics.Record(DiagnosticSeverity.Error, "QuiralCore",
                    $"Error aturant el mòdul {module.Name}: {exception.Message}");
            }
        }
        _startedModules.Clear();
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
                await StopStartedModulesAsync().ConfigureAwait(false);
                await AppendAuditAsync("CORE_STOPPED", "Nucli aturat; sortides físiques bloquejades.", CancellationToken.None).ConfigureAwait(false);
            }
            StateOfCore = QuiralCoreState.Stopped;
            _disposed = true;
        }
        finally
        {
            _lifecycle.Release();
            _lifecycle.Dispose();
            _auditLock.Dispose();
        }
    }
}
