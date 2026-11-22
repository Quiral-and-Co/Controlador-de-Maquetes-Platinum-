using Quiral.ControladorMaquetes.Core;

namespace Quiral.ControladorMaquetes.Geometry;

public readonly record struct Point3(double X, double Y, double Z);
public sealed record TrackSegment(string Id, string ProjectId, Point3 Start, Point3 End, double GaugeMm = 16.5);
public sealed record GeometryIssue(string Code, string Message, string? ElementId = null);

public sealed class RailwayGeometryModule : IQuiralModule
{
    private readonly Dictionary<string, TrackSegment> _segments = new(StringComparer.OrdinalIgnoreCase);
    private QuiralCore? _core;
    private readonly ProjectModule? _projects;

    public RailwayGeometryModule(ProjectModule? projects = null) => _projects=projects;
    public string Name => "RailwayGeometry";
    public IReadOnlyList<TrackSegment> Segments => _projects is null ? _segments.Values.ToArray() :
        _projects.ActiveProject is null ? Array.Empty<TrackSegment>() :
        _segments.Values.Where(x=>x.ProjectId==_projects.ActiveProject.Id).ToArray();
    public async Task StartAsync(QuiralCore core, CancellationToken cancellationToken)
    {
        _core=core;
        var saved=await core.State.ReadAsync<List<TrackSegment>>("geometry/segments.json",cancellationToken).ConfigureAwait(false)??new();
        foreach(var segment in saved) _segments[segment.Id]=segment;
    }
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    public async Task<TrackSegment> AddSegmentAsync(Point3 start,Point3 end,double gaugeMm=16.5,CancellationToken cancellationToken=default)
    {
        if(_projects is not null && _projects.ActiveProject is null)
            throw new InvalidOperationException("Obre o crea un projecte abans d'editar-ne la geometria.");
        var segment=AddSegment(start,end,gaugeMm);
        await PersistAsync(cancellationToken).ConfigureAwait(false);
        return segment;
    }

    public async Task<bool> RemoveSegmentAsync(string id,CancellationToken cancellationToken=default)
    {
        var removed=_segments.Remove(id);
        if(removed) await PersistAsync(cancellationToken).ConfigureAwait(false);
        return removed;
    }

    private Task PersistAsync(CancellationToken cancellationToken) =>
        (_core??throw new InvalidOperationException("Mòdul no inicialitzat.")).State
        .WriteAsync("geometry/segments.json",_segments.Values.ToList(),cancellationToken);

    public TrackSegment AddSegment(Point3 start, Point3 end, double gaugeMm = 16.5)
    {
        ValidatePoint(start); ValidatePoint(end);
        if (!double.IsFinite(gaugeMm) || gaugeMm <= 0) throw new ArgumentOutOfRangeException(nameof(gaugeMm));
        if (Distance(start, end) < 0.01) throw new ArgumentException("El tram ha de tenir longitud.");
        if(_projects is not null && _projects.ActiveProject is null)
            throw new InvalidOperationException("Obre o crea un projecte abans d'editar-ne la geometria.");
        var projectId=_projects?.ActiveProject?.Id ?? string.Empty;
        var segment = new TrackSegment(Guid.NewGuid().ToString("N"), projectId, start, end, gaugeMm);
        _segments.Add(segment.Id, segment);
        return segment;
    }

    public static double Distance(Point3 a, Point3 b)
    {
        ValidatePoint(a); ValidatePoint(b);
        return Math.Sqrt(Math.Pow(b.X-a.X,2)+Math.Pow(b.Y-a.Y,2)+Math.Pow(b.Z-a.Z,2));
    }

    public static double Length2D(Point3 a, Point3 b) => Math.Sqrt(Math.Pow(b.X-a.X,2)+Math.Pow(b.Y-a.Y,2));
    public static double GradePercent(Point3 a, Point3 b)
    {
        var horizontal = Length2D(a,b);
        if (horizontal < 0.001) throw new ArgumentException("La projecció horitzontal és nul·la.");
        return (b.Z-a.Z)/horizontal*100.0;
    }

    public static IReadOnlyList<Point3> ParallelOffset(Point3 start, Point3 end, double offsetMm)
    {
        ValidatePoint(start); ValidatePoint(end);
        if (!double.IsFinite(offsetMm)) throw new ArgumentOutOfRangeException(nameof(offsetMm));
        var dx=end.X-start.X; var dy=end.Y-start.Y; var length=Math.Sqrt(dx*dx+dy*dy);
        if (length < 0.001) throw new ArgumentException("No es pot calcular el paral·lel d'un tram nul.");
        var ox=-dy/length*offsetMm; var oy=dx/length*offsetMm;
        return new[] { new Point3(start.X+ox,start.Y+oy,start.Z), new Point3(end.X+ox,end.Y+oy,end.Z) };
    }

    public static IReadOnlyList<GeometryIssue> ValidateConnections(IEnumerable<TrackSegment> segments, double toleranceMm = 1.0)
    {
        if (!double.IsFinite(toleranceMm) || toleranceMm < 0) throw new ArgumentOutOfRangeException(nameof(toleranceMm));
        var items=segments.ToArray(); var issues=new List<GeometryIssue>();
        for (var i=0;i<items.Length;i++) for(var j=i+1;j<items.Length;j++)
        {
            var a=items[i]; var b=items[j];
            var min=Math.Min(Math.Min(Distance(a.Start,b.Start),Distance(a.Start,b.End)),
                Math.Min(Distance(a.End,b.Start),Distance(a.End,b.End)));
            if (min > toleranceMm) issues.Add(new("OPEN_CONNECTION",$"Els trams {a.Id} i {b.Id} no tenen extrems coincidents.",a.Id));
        }
        return issues;
    }

    private static void ValidatePoint(Point3 p)
    {
        if (!double.IsFinite(p.X)||!double.IsFinite(p.Y)||!double.IsFinite(p.Z))
            throw new ArgumentException("Les coordenades XYZ han de ser finites.");
    }
}
