using System.Collections.Concurrent;

namespace Quiral.ControladorMaquetes.Core;

public enum DiagnosticSeverity { Information, Warning, Error, Critical }

public sealed record DiagnosticRecord(
    DateTimeOffset OccurredAt,
    DiagnosticSeverity Severity,
    string Component,
    string Message);

public sealed class DiagnosticsCatalog
{
    private readonly ConcurrentQueue<DiagnosticRecord> _records = new();
    private readonly int _capacity;

    public DiagnosticsCatalog(int capacity = 1000)
    {
        if (capacity < 10) throw new ArgumentOutOfRangeException(nameof(capacity));
        _capacity = capacity;
    }

    public void Record(DiagnosticSeverity severity, string component, string message)
    {
        if (string.IsNullOrWhiteSpace(component)) throw new ArgumentException("Component obligatori.", nameof(component));
        if (string.IsNullOrWhiteSpace(message)) throw new ArgumentException("Missatge obligatori.", nameof(message));
        _records.Enqueue(new DiagnosticRecord(DateTimeOffset.UtcNow, severity, component, message));
        while (_records.Count > _capacity)
            _records.TryDequeue(out _);
    }

    public IReadOnlyList<DiagnosticRecord> Snapshot() => _records.ToArray();
}
