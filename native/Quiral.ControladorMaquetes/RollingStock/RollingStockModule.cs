using Quiral.ControladorMaquetes.Core;

namespace Quiral.ControladorMaquetes.RollingStock;

public enum RollingStockKind { Locomotive, PassengerCar, FreightWagon, TrainSet, Other }
public enum DigitalProtocol { None, Motorola, Mm2, Mfx, Dcc, MultiProtocol }

public sealed record RollingStockItem(
    string Id, RollingStockKind Kind, string Manufacturer, string Reference, string Name,
    string Scale, string Era, string RailwayCompany, string? DigitalAddress,
    DigitalProtocol Protocol, string? Decoder, IReadOnlyList<string> Functions,
    string? ImagePath, string Notes, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

public sealed record TrainComposition(string Id, string Name, IReadOnlyList<string> VehicleIds, DateTimeOffset UpdatedAt);

public sealed class RollingStockModule : IQuiralModule
{
    private readonly Dictionary<string, RollingStockItem> _items = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, TrainComposition> _compositions = new(StringComparer.OrdinalIgnoreCase);
    private QuiralCore? _core;
    private readonly SemaphoreSlim _sync = new(1,1);
    public string Name => "RollingStockManagement";
    public Task StartAsync(QuiralCore core, CancellationToken cancellationToken) { _core=core; return LoadAsync(cancellationToken); }
    public async Task<RollingStockItem> AddAsync(RollingStockItem item, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(item);
        if (string.IsNullOrWhiteSpace(item.Manufacturer)||string.IsNullOrWhiteSpace(item.Reference)||string.IsNullOrWhiteSpace(item.Name))
            throw new ArgumentException("Fabricant, referència i nom són obligatoris.");
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_items.Values.Any(x=>x.Manufacturer.Equals(item.Manufacturer,StringComparison.OrdinalIgnoreCase)&&x.Reference.Equals(item.Reference,StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException("Ja existeix aquesta referència de fabricant.");
            var now=DateTimeOffset.UtcNow;
            var saved=item with { Id=string.IsNullOrWhiteSpace(item.Id)?Guid.NewGuid().ToString("N"):item.Id, CreatedAt=now, UpdatedAt=now };
            _items.Add(saved.Id,saved); await PersistAsync(cancellationToken); return saved;
        }
        finally { _sync.Release(); }
    }
    public async Task<IReadOnlyList<RollingStockItem>> SearchAsync(string query="", CancellationToken cancellationToken=default)
    {
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var q=query.Trim();
            return _items.Values.Where(x=>q.Length==0||x.Name.Contains(q,StringComparison.OrdinalIgnoreCase)||
                x.Reference.Contains(q,StringComparison.OrdinalIgnoreCase)||x.Manufacturer.Contains(q,StringComparison.OrdinalIgnoreCase))
                .OrderBy(x=>x.Manufacturer).ThenBy(x=>x.Reference).ToArray();
        }
        finally { _sync.Release(); }
    }
    public async Task<TrainComposition> CreateCompositionAsync(string name,IReadOnlyList<string> vehicleIds,CancellationToken cancellationToken=default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        if(vehicleIds.Count==0||vehicleIds.Distinct(StringComparer.OrdinalIgnoreCase).Count()!=vehicleIds.Count)
            throw new ArgumentException("La composició necessita vehicles únics.");
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var missing=vehicleIds.Where(id=>!_items.ContainsKey(id)).ToArray();
            if(missing.Length>0) throw new InvalidOperationException("Hi ha vehicles que no consten a l'inventari: "+string.Join(", ",missing));
            var composition=new TrainComposition(Guid.NewGuid().ToString("N"),name.Trim(),vehicleIds.ToArray(),DateTimeOffset.UtcNow);
            _compositions.Add(composition.Id,composition); await PersistAsync(cancellationToken); return composition;
        }
        finally { _sync.Release(); }
    }
    private async Task LoadAsync(CancellationToken ct)
    {
        var items=await _core!.State.ReadAsync<List<RollingStockItem>>("rolling-stock/items.json",ct).ConfigureAwait(false)??new();
        var comps=await _core.State.ReadAsync<List<TrainComposition>>("rolling-stock/compositions.json",ct).ConfigureAwait(false)??new();
        foreach(var x in items) _items[x.Id]=x;
        foreach(var x in comps) _compositions[x.Id]=x;
    }
    private async Task PersistAsync(CancellationToken ct)
    {
        await _core!.State.WriteAsync("rolling-stock/items.json",_items.Values.ToList(),ct).ConfigureAwait(false);
        await _core.State.WriteAsync("rolling-stock/compositions.json",_compositions.Values.ToList(),ct).ConfigureAwait(false);
    }
    public Task StopAsync(CancellationToken cancellationToken)=>Task.CompletedTask;
}
