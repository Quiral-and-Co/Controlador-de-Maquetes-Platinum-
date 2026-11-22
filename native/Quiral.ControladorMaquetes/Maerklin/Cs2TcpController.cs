using System.Net.Sockets;
using Quiral.ControladorMaquetes.Core;
using Quiral.ControladorMaquetes.RollingStock;

namespace Quiral.ControladorMaquetes.Maerklin;

public enum Cs2ConnectionState { Disconnected, Connecting, Connected, Faulted }

public sealed record Cs2Participant(uint DeviceUid,ushort SoftwareVersion,ushort DeviceId,DateTimeOffset SeenAt);

/// <summary>
/// Controlador natiu mCAN/TCP per a CS2: feedback S88 i comandes de locomotora
/// codificades, sempre sotmeses al bloqueig físic fail-safe del nucli.
/// </summary>
public sealed class Cs2TcpController : IAsyncDisposable, IQuiralModule
{
    public const int DefaultPort=15731;
    public string Name => "MaerklinCS2Controller";
    private QuiralCore? _core;
    private const uint QuiralUid=0x51434F31;
    private readonly SemaphoreSlim _sendLock=new(1,1);
    private TcpClient? _client;
    private NetworkStream? _stream;
    private CancellationTokenSource? _readerCancellation;
    private Task? _readerTask;
    private ushort _hash;
    private readonly object _hashLock=new();
    public Cs2ConnectionState State { get; private set; }=Cs2ConnectionState.Disconnected;
    public string? Host { get; private set; }
    public int Port { get; private set; }=DefaultPort;
    public Cs2Participant? CentralIdentity { get; private set; }
    public bool IdentityVerified => CentralIdentity?.DeviceId==0xFFFF;
    public event Action<Cs2Participant>? ParticipantDiscovered;
    public event Action<S88ContactEvent>? S88ContactChanged;
    public event Action<S88ModuleSnapshot>? S88ModuleRead;
    public event Action<string>? Diagnostic;

    public Task StartAsync(QuiralCore core,CancellationToken cancellationToken)
    {
        _core=core;
        core.Commands.RegisterHandler(this);
        core.Devices.Upsert(new RailwayDevice("marklin-cs2-60215","Märklin Central Station 2",
            RailwayDeviceKind.CommandStation,RailwayDeviceState.Configured,"Märklin","60215"));
        return Task.CompletedTask;
    }

    public async Task ConnectAsync(string host,int port=DefaultPort,CancellationToken cancellationToken=default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(host);
        if(port is <1 or >65535) throw new ArgumentOutOfRangeException(nameof(port));
        if(State==Cs2ConnectionState.Connected) throw new InvalidOperationException("La CS2 ja està connectada.");
        if(State is Cs2ConnectionState.Faulted or Cs2ConnectionState.Connecting)
            await DisconnectAsync().ConfigureAwait(false);
        State=Cs2ConnectionState.Connecting; Host=host; Port=port; CentralIdentity=null;
        var client=new TcpClient { NoDelay=true };
        try
        {
            await client.ConnectAsync(host,port,cancellationToken).ConfigureAwait(false);
            _client=client; _stream=client.GetStream();
            _hash=(ushort)((QuiralUid>>16)^(QuiralUid&0xFFFF));
            State=Cs2ConnectionState.Connected;
            _core?.Devices.Upsert(new RailwayDevice("marklin-cs2-60215","Märklin Central Station 2",
                RailwayDeviceKind.CommandStation,RailwayDeviceState.Degraded,"Märklin","60215",$"{host}:{port}",DateTimeOffset.UtcNow));
            _readerCancellation=new CancellationTokenSource();
            _readerTask=ReadLoopAsync(_readerCancellation.Token);
            Diagnostic?.Invoke($"Connexió TCP establerta amb CS2 a {host}:{port}.");
            // PING de descobriment: cap ordre de tracció ni accessori.
            await SendFrameAsync(new McanFrame(0,0x18,false,_hash,Array.Empty<byte>()),cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            State=Cs2ConnectionState.Faulted;
            _core?.Devices.Upsert(new RailwayDevice("marklin-cs2-60215","Märklin Central Station 2",
                RailwayDeviceKind.CommandStation,RailwayDeviceState.Faulted,"Märklin","60215",$"{host}:{port}"));
            if(_readerCancellation is not null)
            {
                await _readerCancellation.CancelAsync().ConfigureAwait(false);
                if(_readerTask is not null) { try { await _readerTask.ConfigureAwait(false); } catch(OperationCanceledException) { } }
                _readerCancellation.Dispose();
            }
            _readerCancellation=null; _readerTask=null;
            client.Dispose(); _client=null; _stream=null; throw;
        }
    }


    public bool CanHandle(RailwayCommand command) =>
        command.DeviceId.Equals("marklin-cs2-60215",StringComparison.OrdinalIgnoreCase) &&
        (command.CommandName is "set-speed" or "set-direction" or "set-function");

    async Task<CommandDispatchResult> IRailwayCommandHandler.ExecuteAsync(RailwayCommand command,CancellationToken cancellationToken)
    {
        if(_core is null || !_core.SafetyGate.PhysicalOutputsEnabled || !IdentityVerified)
            return CommandDispatchResult.Blocked("Control de locomotores bloquejat: cal superar totes les validacions de seguretat.");
        if(command.Parameters is null) return new(false,"INVALID_PARAMETERS","Falten els paràmetres de la comanda.");
        try
        {
            if(!command.Parameters.TryGetValue("protocol",out var protocolText) ||
                !Enum.TryParse<DigitalProtocol>(protocolText,true,out var protocol) ||
                !command.Parameters.TryGetValue("address",out var addressText) ||
                !int.TryParse(addressText,out var address))
                return new(false,"INVALID_PARAMETERS","Cal indicar protocol i adreça vàlids.");

            McanFrame frame;
            switch(command.CommandName)
            {
                case "set-speed":
                    if(!command.Parameters.TryGetValue("speed",out var speedText)||!int.TryParse(speedText,out var speed))
                        return new(false,"INVALID_PARAMETERS","Cal indicar la velocitat.");
                    frame=McanLocomotiveCommands.BuildSpeed(protocol,address,speed,NextHash());
                    break;
                case "set-direction":
                    if(!command.Parameters.TryGetValue("direction",out var directionText)||!byte.TryParse(directionText,out var direction))
                        return new(false,"INVALID_PARAMETERS","Cal indicar el sentit (0-3).");
                    frame=McanLocomotiveCommands.BuildDirection(protocol,address,direction,NextHash());
                    break;
                case "set-function":
                    if(!command.Parameters.TryGetValue("function",out var functionText)||!int.TryParse(functionText,out var function) ||
                        !command.Parameters.TryGetValue("enabled",out var enabledText)||!bool.TryParse(enabledText,out var enabled))
                        return new(false,"INVALID_PARAMETERS","Cal indicar funció i estat.");
                    frame=McanLocomotiveCommands.BuildFunction(protocol,address,function,enabled,NextHash());
                    break;
                default:
                    return new(false,"UNSUPPORTED_COMMAND","Comanda no implementada.");
            }
            await SendFrameAsync(frame,cancellationToken).ConfigureAwait(false);
            return new(true,"SENT","Trama mCAN enviada a la CS2.");
        }
        catch(Exception ex)
        {
            return new(false,"DRIVER_ERROR",ex.Message);
        }
    }

    public Task SubscribeS88ContactAsync(ushort deviceId,ushort contactNumber,CancellationToken cancellationToken=default)
    {
        EnsureCentralVerified();
        return SendFrameAsync(S88Feedback.BuildSubscribe(deviceId,contactNumber),cancellationToken);
    }

    /// <summary>Mode de compatibilitat legacy: la lectura S88 pot buidar buffers intermedis; usar només si Quiral és l'únic lector.</summary>
    public Task PollS88ModuleAsync(byte moduleNumber,CancellationToken cancellationToken=default)
    {
        EnsureCentralVerified();
        return SendFrameAsync(S88Feedback.BuildPoll(moduleNumber,QuiralUid),cancellationToken);
    }

    private ushort NextHash() { lock(_hashLock) { unchecked { _hash++; if(_hash==0) _hash=1; return _hash; } } }

    private async Task SendFrameAsync(McanFrame frame,CancellationToken cancellationToken)
    {
        EnsureConnected();
        var bytes=frame.Encode();
        await _sendLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try { await _stream!.WriteAsync(bytes,cancellationToken).ConfigureAwait(false); await _stream.FlushAsync(cancellationToken).ConfigureAwait(false); }
        finally { _sendLock.Release(); }
    }

    private async Task ReadLoopAsync(CancellationToken cancellationToken)
    {
        var packet=new byte[McanFrame.WireLength];
        try
        {
            while(!cancellationToken.IsCancellationRequested)
            {
                await _stream!.ReadExactlyAsync(packet,cancellationToken).ConfigureAwait(false);
                var frame=McanFrame.Decode(packet);
                var participant=TryParseParticipant(frame);
                if(participant is not null)
                {
                    ParticipantDiscovered?.Invoke(participant);
                    if(participant.DeviceId==0xFFFF)
                    {
                        CentralIdentity=participant;
                        _core?.Devices.Upsert(new RailwayDevice("marklin-cs2-60215","Märklin Central Station 2",
                            RailwayDeviceKind.CommandStation,RailwayDeviceState.Connected,"Märklin","60215",$"{Host}:{Port}",participant.SeenAt));
                    }
                }
                var contact=S88Feedback.TryParseEvent(frame);
                if(contact is not null)
                {
                    S88ContactChanged?.Invoke(contact);
                    _core?.Events.Publish(new QuiralEvent(contact.ReceivedAt,"s88.contact.changed",
                        $"S88 {contact.DeviceId}:{contact.ContactNumber} = {(contact.IsOccupied ? "OCUPAT" : "LLIURE")}"));
                }
                var module=S88Feedback.TryParsePollReply(frame) ?? S88Feedback.TryParseBroadcast(frame);
                if(module is not null) S88ModuleRead?.Invoke(module);
            }
        }
        catch(OperationCanceledException) when(cancellationToken.IsCancellationRequested) { }
        catch(Exception ex)
        {
            State=Cs2ConnectionState.Faulted;
            _core?.Devices.Upsert(new RailwayDevice("marklin-cs2-60215","Märklin Central Station 2",
                RailwayDeviceKind.CommandStation,RailwayDeviceState.Faulted,"Märklin","60215",$"{Host}:{Port}"));
            _core?.Events.Publish(new QuiralEvent(DateTimeOffset.UtcNow,"cs2.connection.lost",ex.Message));
            Diagnostic?.Invoke($"S'ha perdut la comunicació amb la CS2: {ex.Message}");
        }
    }

    private static Cs2Participant? TryParseParticipant(McanFrame frame)
    {
        if(frame.Command!=0x18||!frame.IsResponse||frame.Dlc!=8) return null;
        var uid=System.Buffers.Binary.BinaryPrimitives.ReadUInt32BigEndian(frame.Data.AsSpan(0,4));
        var version=System.Buffers.Binary.BinaryPrimitives.ReadUInt16BigEndian(frame.Data.AsSpan(4,2));
        var deviceId=System.Buffers.Binary.BinaryPrimitives.ReadUInt16BigEndian(frame.Data.AsSpan(6,2));
        return new Cs2Participant(uid,version,deviceId,DateTimeOffset.UtcNow);
    }

    private void EnsureCentralVerified()
    {
        EnsureConnected();
        if(!IdentityVerified) throw new InvalidOperationException("La connexió TCP existeix, però encara no s'ha identificat la CS2 60215 (resposta PING 0xFFFF pendent).");
    }

    private void EnsureConnected()
    {
        if(State!=Cs2ConnectionState.Connected||_stream is null)
            throw new InvalidOperationException("La CS2 no està connectada.");
    }

    public async Task DisconnectAsync()
    {
        if(_readerCancellation is not null) { await _readerCancellation.CancelAsync().ConfigureAwait(false); }
        if(_readerTask is not null) { try { await _readerTask.ConfigureAwait(false); } catch(OperationCanceledException) { } }
        _stream?.Dispose(); _client?.Dispose(); _readerCancellation?.Dispose();
        _stream=null; _client=null; _readerCancellation=null; _readerTask=null;
        State=Cs2ConnectionState.Disconnected; CentralIdentity=null;
        if(_core is not null) _core.Devices.Upsert(new RailwayDevice("marklin-cs2-60215","Märklin Central Station 2",
            RailwayDeviceKind.CommandStation,RailwayDeviceState.Disconnected,"Märklin","60215"));
    }

    public Task StopAsync(CancellationToken cancellationToken) => DisconnectAsync();

    public async ValueTask DisposeAsync()
    {
        await DisconnectAsync().ConfigureAwait(false);
        _sendLock.Dispose();
    }
}
