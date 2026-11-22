namespace Quiral.ControladorMaquetes.Core;

/// <summary>Bus d'esdeveniments tipat exclusivament dins del procés.</summary>
public sealed class QuiralEventBus
{
    private readonly object _sync = new();
    private readonly Dictionary<Type, List<Delegate>> _handlers = new();

    public IDisposable Subscribe<TEvent>(Action<TEvent> handler)
    {
        ArgumentNullException.ThrowIfNull(handler);
        lock (_sync)
        {
            if (!_handlers.TryGetValue(typeof(TEvent), out var list))
                _handlers[typeof(TEvent)] = list = new List<Delegate>();
            list.Add(handler);
        }
        return new Subscription(() => Remove(handler));
    }

    public void Publish<TEvent>(TEvent eventData)
    {
        Delegate[] snapshot;
        lock (_sync)
            snapshot = _handlers.TryGetValue(typeof(TEvent), out var list)
                ? list.ToArray()
                : Array.Empty<Delegate>();

        foreach (var handler in snapshot)
            ((Action<TEvent>)handler)(eventData);
    }

    private void Remove<TEvent>(Action<TEvent> handler)
    {
        lock (_sync)
        {
            if (!_handlers.TryGetValue(typeof(TEvent), out var list))
                return;
            list.Remove(handler);
            if (list.Count == 0)
                _handlers.Remove(typeof(TEvent));
        }
    }

    private sealed class Subscription(Action dispose) : IDisposable
    {
        private Action? _dispose = dispose;
        public void Dispose() => Interlocked.Exchange(ref _dispose, null)?.Invoke();
    }
}

public sealed record QuiralEvent(DateTimeOffset OccurredAt, string Category, string Message);
