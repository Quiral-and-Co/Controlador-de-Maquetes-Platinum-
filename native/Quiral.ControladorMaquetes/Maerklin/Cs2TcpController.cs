using System.Net.Sockets;
using Quiral.ControladorMaquetes.Core;

namespace Quiral.ControladorMaquetes.Maerklin;

public enum Cs2ConnectionState { Disconnected, Connecting, Connected, Faulted }

/// <summary>
/// Controlador natiu mCAN/TCP per a CS2. Aquesta primera iteració només connecta,
/// consulta presència i rep feedback S88; no exposa ordres de tracció/accessoris.
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
    public Cs2ConnectionState State { get; private set; }=Cs2ConnectionState.Disconnected;
    public string? Host { get; private set; }
    public int Port { get; private set; }=DefaultPort;
    public event Action<S88ContactEvent>? S88ContactChanged;
    public event Action<S88ModuleSnapshot>? S88ModuleRead;
    public event Action<string>? Diagnostic;

    public Task StartAsync(QuiralCore core,CancellationToken cancellationToken)
    {
        _core=core;
        core.Devices.Upsert(new RailwayDevice("marklin-cs2-60215","Märklin Central Station 2",
            RailwayDeviceKind.CommandStation,RailwayDeviceState.Configured,"Märklin","60215"));
        return Task.CompletedTask;
    }

    public async Task ConnectAsync(string host,int port=DefaultPort,CancellationToken cancellationToken=default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(host);
        if(port is <1 or >65535) throw new ArgumentOutOfRangeException(nameof(port));
        if(State==Cs2ConnectionState.Connected) throw new InvalidOperationException("La CS2 ja està connectada.");
        State=Cs2ConnectionState.Connecting; Host=host; Port=port;
        var client=new TcpClient { NoDelay=true };
        try
        {
            await client.ConnectAsync(host,port,cancellationToken).ConfigureAwait(false);
            _client=client; _stream=client.GetStream();
            _hash=(ushort)((QuiralUid>>16)^(QuiralUid&0xFFFF));
            State=Cs2ConnectionState.Connected;
            _core?.Devices.Upsert(new RailwayDevice("marklin-cs2-60215","Märklin Central Station 2",
                RailwayDeviceKind.CommandStation,RailwayDeviceState.Connected,"Märklin","60215",$"{host}:{port}",DateTimeOffset.UtcNow));
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
            client.Dispose(); _client=null; _stream=null; throw;
        }
    }

    public Task SubscribeS88ContactAsync(ushort deviceId,ushort contactNumber,CancellationToken cancellationToken=default)
    {
        EnsureConnected();
        return SendFrameAsync(S88Feedback.BuildSubscribe(deviceId,contactNumber,NextHash()),cancellationToken);
    }

    /// <summary>Mode de compatibilitat legacy: la lectura S88 pot buidar buffers intermedis; usar només si Quiral és l'únic lector.</summary>
    public Task PollS88ModuleAsync(ushort deviceId,byte moduleNumber,CancellationToken cancellationToken=default)
    {
        EnsureConnected();
        return SendFrameAsync(S88Feedback.BuildPoll(deviceId,moduleNumber,QuiralUid,NextHash()),cancellationToken);
    }

    private ushort NextHash() { unchecked { _hash++; if(_hash==0) _hash=1; return _hash; } }

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
                var contact=S88Feedback.TryParseEvent(frame);
                if(contact is not null)
                {
                    S88ContactChanged?.Invoke(contact);
                    _core?.Events.Publish(new QuiralEvent(contact.ReceivedAt,"s88.contact.changed",
                        $"Contacte {contact.DeviceId}:{contact.ContactNumber} = {(contact.IsOccupied ? "OCUPAT" : "LLIURE")}"));
                }
                var module=S88Feedback.TryParsePollReply(frame);
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
        State=Cs2ConnectionState.Disconnected;
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
