using Quiral.ControladorMaquetes.Core;

namespace Quiral.ControladorMaquetes.Projects;

public sealed record RailwayProject(
    string Id, string Name, int SchemaVersion, string Scale, string TrackSystem,
    double WidthMm, double HeightMm, double LevelSpacingMm,
    IReadOnlyList<ProjectLevel> Levels, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

public sealed record ProjectLevel(string Id, string Name, double ElevationMm);

public sealed class ProjectModule : IQuiralModule
{
    private readonly Dictionary<string, RailwayProject> _projects = new(StringComparer.OrdinalIgnoreCase);
    private readonly SemaphoreSlim _sync = new(1, 1);
    private QuiralCore? _core;
    public string Name => "ProjectManagement";
    public RailwayProject? ActiveProject { get; private set; }

    public async Task StartAsync(QuiralCore core, CancellationToken cancellationToken)
    {
        _core = core;
        var index = await core.State.ReadAsync<List<RailwayProject>>("projects/index.json", cancellationToken)
            .ConfigureAwait(false) ?? new();
        foreach (var project in index) _projects[project.Id] = project;
    }

    public async Task<RailwayProject> CreateAsync(string name, double widthMm, double heightMm,
        int levels = 1, double levelSpacingMm = 110, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        if (!double.IsFinite(widthMm) || !double.IsFinite(heightMm) || widthMm <= 0 || heightMm <= 0)
            throw new ArgumentOutOfRangeException(nameof(widthMm), "Les dimensions han de ser positives i finites.");
        if (levels is < 1 or > 20) throw new ArgumentOutOfRangeException(nameof(levels));
        if (!double.IsFinite(levelSpacingMm) || levelSpacingMm < 0) throw new ArgumentOutOfRangeException(nameof(levelSpacingMm));

        var now = DateTimeOffset.UtcNow;
        var project = new RailwayProject(Guid.NewGuid().ToString("N"), name.Trim(), 1, "H0", "Märklin C",
            widthMm, heightMm, levelSpacingMm,
            Enumerable.Range(0, levels).Select(i => new ProjectLevel(Guid.NewGuid().ToString("N"),
                $"Nivell {i + 1}", i * levelSpacingMm)).ToArray(), now, now);
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try { _projects.Add(project.Id, project); await PersistAsync(cancellationToken); ActiveProject = project; }
        finally { _sync.Release(); }
        return project;
    }

    public async Task<IReadOnlyList<RailwayProject>> ListAsync(CancellationToken cancellationToken = default)
    {
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try { return _projects.Values.OrderBy(x => x.Name).ToArray(); }
        finally { _sync.Release(); }
    }

    public async Task<bool> OpenAsync(string projectId, CancellationToken cancellationToken = default)
    {
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (!_projects.TryGetValue(projectId, out var project)) return false;
            ActiveProject = project;
            return true;
        }
        finally { _sync.Release(); }
    }

    public async Task SaveAsync(CancellationToken cancellationToken = default)
    {
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (ActiveProject is null) throw new InvalidOperationException("No hi ha cap projecte obert.");
            var updated = ActiveProject with { UpdatedAt = DateTimeOffset.UtcNow };
            _projects[updated.Id] = updated;
            ActiveProject = updated;
            await PersistAsync(cancellationToken);
        }
        finally { _sync.Release(); }
    }

    public async Task<bool> DeleteAsync(string projectId, CancellationToken cancellationToken = default)
    {
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (!_projects.Remove(projectId)) return false;
            if (ActiveProject?.Id == projectId) ActiveProject = null;
            await PersistAsync(cancellationToken);
            return true;
        }
        finally { _sync.Release(); }
    }

    private Task PersistAsync(CancellationToken cancellationToken) =>
        (_core ?? throw new InvalidOperationException("Mòdul no inicialitzat."))
        .State.WriteAsync("projects/index.json", _projects.Values.ToList(), cancellationToken);

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
