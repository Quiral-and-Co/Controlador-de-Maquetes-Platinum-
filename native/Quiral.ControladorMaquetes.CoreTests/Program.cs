using Quiral.ControladorMaquetes.Core;
using Quiral.ControladorMaquetes.Safety;
using Quiral.ControladorMaquetes.Projects;
using Quiral.ControladorMaquetes.Geometry;
using Quiral.ControladorMaquetes.RollingStock;
using Quiral.ControladorMaquetes.Maerklin;

var checks = new List<(string Name, Func<Task> Run)>
{
    ("Event bus publish and unsubscribe", TestEventBus),
    ("Device registry upsert and snapshot", TestDeviceRegistry),
    ("Local state round-trip and path traversal rejection", TestLocalState),
    ("Physical commands blocked before driver execution", TestSafetyGate),
    ("Core lifecycle and audit log", TestCoreLifecycle),
    ("Module startup and reverse shutdown order", TestModuleLifecycle),
    ("Project create, open and persistence", TestProjects),
    ("XYZ geometry, parallel offset and grade", TestGeometry),
    ("Geometry isolation by active project", TestGeometryProjectScope),
    ("Rolling stock uniqueness and train composition", TestRollingStock),
    ("mCAN frame codec and S88 event decoding", TestMcanS88),
    ("mCAN locomotive command encoders", TestMcanLocomotiveCommands)
};

var failed = 0;
foreach (var check in checks)
{
    try { await check.Run(); Console.WriteLine($"PASS: {check.Name}"); }
    catch (Exception exception) { failed++; Console.Error.WriteLine($"FAIL: {check.Name}: {exception}"); }
}
Console.WriteLine($"Quiral Control core self-tests: {checks.Count - failed}/{checks.Count} passed.");
return failed == 0 ? 0 : 1;

static Task TestEventBus()
{
    var bus = new QuiralEventBus(); var received = 0;
    using (bus.Subscribe<int>(value => received += value)) bus.Publish(3);
    bus.Publish(7); Assert(received == 3, "La subscripció no s'ha alliberat.");
    return Task.CompletedTask;
}
static Task TestDeviceRegistry()
{
    var registry = new DeviceRegistry();
    registry.Upsert(new RailwayDevice("cs2-main", "Märklin CS2", RailwayDeviceKind.CommandStation,
        RailwayDeviceState.Configured, "Märklin", "60215"));
    Assert(registry.Snapshot().Count == 1, "Registre buit.");
    Assert(registry.TryGet("CS2-MAIN", out var device) && device?.Model == "60215", "Cerca no sensible.");
    return Task.CompletedTask;
}
static async Task TestLocalState()
{
    var root = Temp("QuiralCoreTests");
    try {
        var store = new LocalStateStore(root);
        await store.WriteAsync("projects/test.json", new TestState("project-alpha", 4));
        var restored = await store.ReadAsync<TestState>("projects/test.json");
        Assert(restored is { Name: "project-alpha", Revision: 4 }, "Round-trip incorrecte.");
        var rejected = false;
        try { await store.WriteAsync("../escape.json", new TestState("bad", 0)); }
        catch (UnauthorizedAccessException) { rejected = true; }
        Assert(rejected, "Path traversal acceptat.");
    } finally { Delete(root); }
}
static async Task TestSafetyGate()
{
    var gate = new PhysicalOutputGate(); var handler = new CountingHandler();
    var dispatcher = new CommandDispatcher(gate); dispatcher.RegisterHandler(handler);
    var result = await dispatcher.DispatchAsync(new RailwayCommand("cs2-main", "set-speed", true));
    Assert(!result.Accepted && result.Code == "SAFETY_BLOCKED", "Ordre no bloquejada.");
    Assert(handler.Calls == 0 && !gate.PhysicalOutputsEnabled, "El controlador ha rebut una ordre bloquejada.");

    var root=Temp("QuiralCs2Safety");
    try
    {
        var core=new QuiralCore(root); var cs2=new Cs2TcpController(); core.RegisterModule(cs2); await core.InitializeAsync();
        var guarded=await core.Commands.DispatchAsync(new RailwayCommand("marklin-cs2-60215","set-speed",true,
            new Dictionary<string,string>{{"protocol","Dcc"},{"address","3"},{"speed","100"}}));
        Assert(!guarded.Accepted && guarded.Code=="SAFETY_BLOCKED","El nucli no ha bloquejat una ordre física CS2.");
        var untrusted=await core.Commands.DispatchAsync(new RailwayCommand("marklin-cs2-60215","set-speed",false,
            new Dictionary<string,string>{{"protocol","Dcc"},{"address","3"},{"speed","100"}}));
        Assert(!untrusted.Accepted && untrusted.Code=="SAFETY_BLOCKED","El controlador ha permès evitar el bloqueig indicant RequiresPhysicalOutput=false.");
        await core.DisposeAsync();
    }
    finally { Delete(root); }
}
static async Task TestCoreLifecycle()
{
    var root = Temp("QuiralCoreLifecycle");
    try {
        var core = new QuiralCore(root); await core.InitializeAsync();
        Assert(core.StateOfCore == QuiralCoreState.Ready && !core.SafetyGate.PhysicalOutputsEnabled, "Estat del nucli incorrecte.");
        Assert(File.Exists(Path.Combine(root, "logs", "quiral-audit.log")), "Falta auditoria.");
        await core.DisposeAsync(); Assert(core.StateOfCore == QuiralCoreState.Stopped, "Nucli no aturat.");
    } finally { Delete(root); }
}
static async Task TestModuleLifecycle()
{
    var root = Temp("QuiralCoreModules"); var events = new List<string>();
    try {
        var core = new QuiralCore(root); core.RegisterModule(new TrackingModule("A", events));
        core.RegisterModule(new TrackingModule("B", events)); await core.InitializeAsync(); await core.DisposeAsync();
        Assert(events.SequenceEqual(new[] { "start:A", "start:B", "stop:B", "stop:A" }), "Ordre lifecycle incorrecte.");
    } finally { Delete(root); }
}
static async Task TestProjects()
{
    var root=Temp("QuiralProjects");
    try {
        var core=new QuiralCore(root); var module=new ProjectModule(); core.RegisterModule(module); await core.InitializeAsync();
        var p=await module.CreateAsync("Maqueta prova",3000,1800,5,110);
        Assert(p.Scale=="H0" && p.Levels.Count==5 && p.Levels[4].ElevationMm==440,"Projecte o nivells incorrectes.");
        Assert(await module.OpenAsync(p.Id),"No es pot obrir el projecte.");
        var restored=await core.State.ReadAsync<List<RailwayProject>>("projects/index.json");
        Assert(restored?.Count==1 && restored[0].Id==p.Id,"Persistència del projecte incorrecta.");
        Assert(File.Exists(Path.Combine(root,"projects",p.Id+".json")),"Fitxer individual del projecte no creat.");
        await core.DisposeAsync();
    } finally { Delete(root); }
}
static Task TestGeometry()
{
    var a=new Point3(0,0,0); var b=new Point3(1000,0,50);
    Assert(Math.Abs(RailwayGeometryModule.Distance(a,b)-Math.Sqrt(1002500))<0.001,"Distància XYZ incorrecta.");
    Assert(Math.Abs(RailwayGeometryModule.GradePercent(a,b)-5)<0.0001,"Pendent incorrecte.");
    var p77=RailwayGeometryModule.ParallelOffset(a,b,77);
    var p64=RailwayGeometryModule.ParallelOffset(a,b,64);
    Assert(Math.Abs(p77[0].Y-77)<0.001 && Math.Abs(p64[0].Y-64)<0.001,"Separació paral·lela incorrecta.");
    var module=new RailwayGeometryModule();
    var rejected=false; try { module.AddSegment(a,a); } catch(ArgumentException) { rejected=true; }
    Assert(rejected,"S'ha acceptat un tram nul.");
    return Task.CompletedTask;
}
static async Task TestRollingStock()
{
    var root=Temp("QuiralRollingStock");
    try {
        var core=new QuiralCore(root); var module=new RollingStockModule(); core.RegisterModule(module); await core.InitializeAsync();
        var now=DateTimeOffset.UtcNow;
        var loco=await module.AddAsync(new RollingStockItem("",RollingStockKind.Locomotive,"Märklin","3003",
            "Locomotora vapor Märklin 3003","H0","III","DB",null,DigitalProtocol.None,null,
            Array.Empty<string>(),null,"Referència històrica",now,now));
        var rejected=false;
        try { await module.AddAsync(loco with { Id="" }); } catch(InvalidOperationException) { rejected=true; }
        Assert(rejected,"Referència duplicada acceptada.");
        var wagon=await module.AddAsync(new RollingStockItem("",RollingStockKind.PassengerCar,"Märklin","test-car",
            "Cotxe prova","H0","III","DB",null,DigitalProtocol.None,null,Array.Empty<string>(),null,"",now,now));
        var consist=await module.CreateCompositionAsync("Tren prova",new[]{loco.Id,wagon.Id});
        Assert(consist.VehicleIds.Count==2,"Composició incompleta.");
        await core.DisposeAsync();
        var reloadCore=new QuiralCore(root); var reloadModule=new RollingStockModule(); reloadCore.RegisterModule(reloadModule); await reloadCore.InitializeAsync();
        Assert((await reloadModule.SearchAsync()).Count==2,"Inventari no recuperat després de reiniciar el nucli.");
        await reloadCore.DisposeAsync();
    } finally { Delete(root); }
}
static string Temp(string name) { var p=Path.Combine(Path.GetTempPath(),name,Guid.NewGuid().ToString("N")); Directory.CreateDirectory(p); return p; }
static void Delete(string path) { if(Directory.Exists(path)) Directory.Delete(path,true); }
static void Assert(bool condition,string message) { if(!condition) throw new InvalidOperationException(message); }
sealed record TestState(string Name,int Revision);
sealed class CountingHandler : IRailwayCommandHandler
{
    public int Calls { get; private set; }
    public bool CanHandle(RailwayCommand command)=>true;
    public Task<CommandDispatchResult> ExecuteAsync(RailwayCommand command,CancellationToken ct)
    { Calls++; return Task.FromResult(new CommandDispatchResult(true,"OK","Executed")); }
}
sealed class TrackingModule(string name,List<string> events) : IQuiralModule
{
    public string Name=>name;
    public Task StartAsync(QuiralCore core,CancellationToken ct) { events.Add($"start:{name}"); return Task.CompletedTask; }
    public Task StopAsync(CancellationToken ct) { events.Add($"stop:{name}"); return Task.CompletedTask; }
}

static Task TestMcanS88()
{
    var data=new byte[]{0x00,0x07,0x00,0x01,0x00,0x2A,0x00,0x00};
    var original=new McanFrame(1,S88Feedback.EventCommand,true,0x1234,data);
    var encoded=original.Encode();
    Assert(encoded.Length==13,"Longitud de trama mCAN incorrecta.");
    var decoded=McanFrame.Decode(encoded);
    Assert(decoded.Command==0x11 && decoded.IsResponse && decoded.Priority==1 && decoded.Dlc==8,"mCAN frame no preservat.");
    var evt=S88Feedback.TryParseEvent(decoded);
    Assert(evt is { ContactId:7, PreviousOccupied:false, IsOccupied:true, Timestamp10Ms:42 },"Esdeveniment S88 incorrecte.");
    var pollData=new byte[]{0x00,0x00,0x00,0x00,0x01,0x80,0x01};
    var poll=S88Feedback.TryParsePollReply(new McanFrame(1,S88Feedback.PollCommand,true,0x1234,pollData));
    Assert(poll is { ModuleNumber:1 } && poll.IsOccupied(1) && poll.IsOccupied(16),"Resposta de consulta S88 incorrecta.");
    var pollRequest=S88Feedback.BuildPoll(2,0x12345678);
    Assert(pollRequest.Priority==0 && pollRequest.Hash==S88Feedback.BroadcastHash && pollRequest.Data.SequenceEqual(new byte[]{0x12,0x34,0x56,0x78,2}),"Consulta S88 incorrecta.");
    var subscription=S88Feedback.BuildSubscribe(7);
    Assert(subscription.Command==0x11 && subscription.Dlc==5 && subscription.Priority==0 && subscription.Hash==S88Feedback.BroadcastHash && subscription.Data.SequenceEqual(new byte[]{0,7,0,0,0}),"Registre de contacte S88 incorrecte.");
    var broadcast=S88Feedback.TryParseBroadcast(new McanFrame(0,S88Feedback.BroadcastCommand,false,S88Feedback.BroadcastHash,new byte[]{2,0x80,0x01}));
    Assert(broadcast is { ModuleNumber:2 } && broadcast.IsOccupied(1) && broadcast.IsOccupied(16),"Broadcast S88 incorrecte.");
    return Task.CompletedTask;
}

static Task TestMcanLocomotiveCommands()
{
    var speed=McanLocomotiveCommands.BuildSpeed(DigitalProtocol.Dcc,3,800,0x4711);
    Assert(speed.Command==0x04 && speed.Dlc==6 && speed.Data.SequenceEqual(new byte[]{0,0,0xC0,3,3,0x20}),"Codificació de velocitat DCC incorrecta.");
    var direction=McanLocomotiveCommands.BuildDirection(DigitalProtocol.Mm2,72,2,0x4712);
    Assert(direction.Dlc==5 && direction.Data.SequenceEqual(new byte[]{0,0,0,72,2}),"Codificació del sentit MM2 incorrecta.");
    var function=McanLocomotiveCommands.BuildFunction(DigitalProtocol.Mfx,5,3,true,0x4713);
    Assert(function.Dlc==6 && function.Data.SequenceEqual(new byte[]{0,0,0x40,5,3,1}),"Codificació de funció mfx incorrecta.");
    var rejected=false; try { McanLocomotiveCommands.BuildSpeed(DigitalProtocol.Dcc,3,1001,0x4711); }
    catch(ArgumentOutOfRangeException) { rejected=true; }
    Assert(rejected,"S'ha acceptat una velocitat fora de rang.");
    return Task.CompletedTask;
}

static async Task TestGeometryProjectScope()
{
    var root=Temp("QuiralGeometryProjects");
    try
    {
        var core=new QuiralCore(root); var projects=new ProjectModule(); var geometry=new RailwayGeometryModule(projects);
        core.RegisterModule(projects); core.RegisterModule(geometry); await core.InitializeAsync();
        var blocked=false; try { await geometry.AddSegmentAsync(new Point3(0,0,0),new Point3(100,0,0)); }
        catch(InvalidOperationException) { blocked=true; }
        Assert(blocked,"La geometria s'ha pogut editar sense projecte actiu.");
        var first=await projects.CreateAsync("Projecte A",3000,1800);
        var firstSegment=await geometry.AddSegmentAsync(new Point3(0,0,0),new Point3(100,0,0));
        var second=await projects.CreateAsync("Projecte B",2000,1000);
        var secondSegment=await geometry.AddSegmentAsync(new Point3(0,0,0),new Point3(200,0,0));
        Assert(geometry.Segments.Count==1 && geometry.Segments[0].Id==secondSegment.Id,"La geometria no s'ha filtrat pel projecte actiu.");
        await projects.OpenAsync(first.Id);
        Assert(geometry.Segments.Count==1 && geometry.Segments[0].Id==firstSegment.Id,"La geometria del projecte A no s'ha recuperat.");
        await core.DisposeAsync();
    }
    finally { Delete(root); }
}
