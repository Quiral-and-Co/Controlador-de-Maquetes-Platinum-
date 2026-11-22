using Quiral.ControladorMaquetes.Core;
using Quiral.ControladorMaquetes.Safety;

var checks = new List<(string Name, Func<Task> Run)>
{
    ("Event bus publish and unsubscribe", TestEventBus),
    ("Device registry upsert and snapshot", TestDeviceRegistry),
    ("Local state round-trip and path traversal rejection", TestLocalState),
    ("Physical commands blocked before driver execution", TestSafetyGate),
    ("Core lifecycle and audit log", TestCoreLifecycle),
    ("Module startup and reverse shutdown order", TestModuleLifecycle)
};

var failed = 0;
foreach (var check in checks)
{
    try
    {
        await check.Run();
        Console.WriteLine($"PASS: {check.Name}");
    }
    catch (Exception exception)
    {
        failed++;
        Console.Error.WriteLine($"FAIL: {check.Name}: {exception}");
    }
}

Console.WriteLine($"Quiral Control core self-tests: {checks.Count - failed}/{checks.Count} passed.");
return failed == 0 ? 0 : 1;

static Task TestEventBus()
{
    var bus = new QuiralEventBus();
    var received = 0;
    using (bus.Subscribe<int>(value => received += value))
        bus.Publish(3);
    bus.Publish(7);
    Assert(received == 3, "La subscripció no s'ha alliberat correctament.");
    return Task.CompletedTask;
}

static Task TestDeviceRegistry()
{
    var registry = new DeviceRegistry();
    registry.Upsert(new RailwayDevice("cs2-main", "Märklin CS2", RailwayDeviceKind.CommandStation,
        RailwayDeviceState.Configured, "Märklin", "60215"));
    Assert(registry.Snapshot().Count == 1, "El registre no conserva el dispositiu.");
    Assert(registry.TryGet("CS2-MAIN", out var device) && device?.Model == "60215",
        "La cerca no és insensible a majúscules.");
    return Task.CompletedTask;
}

static async Task TestLocalState()
{
    var root = Path.Combine(Path.GetTempPath(), "QuiralCoreTests", Guid.NewGuid().ToString("N"));
    try
    {
        var store = new LocalStateStore(root);
        await store.WriteAsync("projects/test.json", new TestState("project-alpha", 4));
        var restored = await store.ReadAsync<TestState>("projects/test.json");
        Assert(restored is { Name: "project-alpha", Revision: 4 }, "No s'ha recuperat l'estat guardat.");

        var rejected = false;
        try { await store.WriteAsync("../escape.json", new TestState("bad", 0)); }
        catch (UnauthorizedAccessException) { rejected = true; }
        Assert(rejected, "La persistència ha acceptat una ruta fora del directori.");
    }
    finally
    {
        if (Directory.Exists(root)) Directory.Delete(root, true);
    }
}

static async Task TestSafetyGate()
{
    var gate = new PhysicalOutputGate();
    var handler = new CountingHandler();
    var dispatcher = new CommandDispatcher(gate);
    dispatcher.RegisterHandler(handler);

    var result = await dispatcher.DispatchAsync(new RailwayCommand("cs2-main", "set-speed",
        RequiresPhysicalOutput: true));
    Assert(!result.Accepted && result.Code == "SAFETY_BLOCKED", "L'ordre física no ha estat bloquejada.");
    Assert(handler.Calls == 0, "El controlador ha rebut una ordre bloquejada.");
    Assert(!gate.PhysicalOutputsEnabled, "Les sortides físiques s'han habilitat.");
}

static async Task TestCoreLifecycle()
{
    var root = Path.Combine(Path.GetTempPath(), "QuiralCoreLifecycle", Guid.NewGuid().ToString("N"));
    try
    {
        var core = new QuiralCore(root);
        await core.InitializeAsync();
        Assert(core.StateOfCore == QuiralCoreState.Ready, "El nucli no ha entrat en estat Ready.");
        Assert(!core.SafetyGate.PhysicalOutputsEnabled, "El nucli ha habilitat sortides físiques.");
        Assert(File.Exists(Path.Combine(root, "logs", "quiral-audit.log")), "No s'ha creat el registre d'auditoria.");
        await core.DisposeAsync();
        Assert(core.StateOfCore == QuiralCoreState.Stopped, "El nucli no s'ha aturat correctament.");
    }
    finally
    {
        if (Directory.Exists(root)) Directory.Delete(root, true);
    }
}


static async Task TestModuleLifecycle()
{
    var root = Path.Combine(Path.GetTempPath(), "QuiralCoreModules", Guid.NewGuid().ToString("N"));
    var events = new List<string>();
    try
    {
        var core = new QuiralCore(root);
        core.RegisterModule(new TrackingModule("A", events));
        core.RegisterModule(new TrackingModule("B", events));
        await core.InitializeAsync();
        await core.DisposeAsync();
        var expected = new[] { "start:A", "start:B", "stop:B", "stop:A" };
        Assert(events.SequenceEqual(expected), "L'ordre d'inici/aturada dels mòduls no és correcte.");
    }
    finally
    {
        if (Directory.Exists(root)) Directory.Delete(root, true);
    }
}

static void Assert(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
}

sealed record TestState(string Name, int Revision);

sealed class CountingHandler : IRailwayCommandHandler
{
    public int Calls { get; private set; }
    public bool CanHandle(RailwayCommand command) => true;
    public Task<CommandDispatchResult> ExecuteAsync(RailwayCommand command, CancellationToken cancellationToken)
    {
        Calls++;
        return Task.FromResult(new CommandDispatchResult(true, "OK", "Executed"));
    }
}

sealed class TrackingModule(string name, List<string> events) : IQuiralModule
{
    public string Name => name;
    public Task StartAsync(QuiralCore core, CancellationToken cancellationToken)
    {
        events.Add($"start:{name}");
        return Task.CompletedTask;
    }
    public Task StopAsync(CancellationToken cancellationToken)
    {
        events.Add($"stop:{name}");
        return Task.CompletedTask;
    }
}
