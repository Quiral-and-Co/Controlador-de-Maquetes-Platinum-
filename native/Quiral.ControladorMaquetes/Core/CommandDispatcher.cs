using Quiral.ControladorMaquetes.Safety;

namespace Quiral.ControladorMaquetes.Core;

public sealed record RailwayCommand(
    string DeviceId,
    string CommandName,
    bool RequiresPhysicalOutput,
    IReadOnlyDictionary<string, string>? Parameters = null);

public sealed record CommandDispatchResult(bool Accepted, string Code, string Message)
{
    public static CommandDispatchResult Blocked(string message) => new(false, "SAFETY_BLOCKED", message);
    public static CommandDispatchResult NoDriver() => new(false, "NO_DRIVER", "No hi ha cap controlador natiu registrat per a aquest dispositiu.");
}

public interface IRailwayCommandHandler
{
    bool CanHandle(RailwayCommand command);
    Task<CommandDispatchResult> ExecuteAsync(RailwayCommand command, CancellationToken cancellationToken);
}

/// <summary>
/// Punt únic d'entrada de les ordres. Les ordres físiques es rebutgen sempre
/// mentre PhysicalOutputGate no autoritzi explícitament les sortides.
/// </summary>
public sealed class CommandDispatcher
{
    private readonly PhysicalOutputGate _safetyGate;
    private readonly List<IRailwayCommandHandler> _handlers = new();
    private readonly object _sync = new();

    public CommandDispatcher(PhysicalOutputGate safetyGate) =>
        _safetyGate = safetyGate ?? throw new ArgumentNullException(nameof(safetyGate));

    public void RegisterHandler(IRailwayCommandHandler handler)
    {
        ArgumentNullException.ThrowIfNull(handler);
        lock (_sync)
        {
            if (_handlers.Contains(handler)) return;
            _handlers.Add(handler);
        }
    }

    public async Task<CommandDispatchResult> DispatchAsync(RailwayCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);
        if (string.IsNullOrWhiteSpace(command.DeviceId) || string.IsNullOrWhiteSpace(command.CommandName))
            return new(false, "INVALID_COMMAND", "La destinació i el nom de l'ordre són obligatoris.");

        // La comprovació es fa abans de consultar o executar cap controlador.
        if (command.RequiresPhysicalOutput && !_safetyGate.PhysicalOutputsEnabled)
            return CommandDispatchResult.Blocked("Ordre rebutjada: les sortides físiques estan bloquejades per la validació de seguretat.");

        IRailwayCommandHandler[] handlers;
        lock (_sync) handlers = _handlers.ToArray();
        var handler = handlers.FirstOrDefault(x => x.CanHandle(command));
        if (handler is null) return CommandDispatchResult.NoDriver();
        return await handler.ExecuteAsync(command, cancellationToken).ConfigureAwait(false);
    }
}
