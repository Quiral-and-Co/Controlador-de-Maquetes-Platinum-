namespace Quiral.ControladorMaquetes.Core;

/// <summary>
/// Extensió interna del nucli. Els mòduls s'executen dins del procés Windows;
/// no són serveis web ni processos externs.
/// </summary>
public interface IQuiralModule
{
    string Name { get; }
    Task StartAsync(QuiralCore core, CancellationToken cancellationToken);
    Task StopAsync(CancellationToken cancellationToken);
}
