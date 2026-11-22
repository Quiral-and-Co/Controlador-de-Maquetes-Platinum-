using System.Net.Sockets;
using Quiral.ControladorMaquetes.Core;

namespace Quiral.ControladorMaquetes.Maerklin;

public enum Cs2ConnectionState { Disconnected, Connecting, Connected, Faulted }

/// <summary>
/// Controlador natiu mCAN/TCP per a CS2. Aquesta primera iteració només connecta,
/// consulta presència i rep feedback S88; no exposa ordres de tracció/accessoris.
/// </summary>
public sealed class Cs2TcpController : IAsyncDisposable
{
    public const int DefaultPort=15731;
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
    public event EventHandler<S88ContactEvent>? S88ContactChanged;
    public event EventHandler<S88ModuleSnapshot>? S88ModuleRead;
    public event EventHandler<string>? Diagnostic;

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
            _readerCancellation=CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            _readerTask=ReadLoopAsync(_readerCancellation.Token);
            Diagnostic?.Invoke(this,$"Connexió TCP establerta amb CS2 a {host}:{port}.");
            // PING de descobriment: cap ordre de tracció ni accessori.
            await SendFrameAsync(new McanFrame(0,0x18,false,_hash,Array.Empty<byte>()),cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            State=Cs2ConnectionState.Faulted; client.Dispose(); _client=null; _stream=null; throw;
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
                if(contact is not null) S88ContactChanged?.Invoke(this,contact);
                var module=S88Feedback.TryParsePollReply(frame);
                if(module is not null) S88ModuleRead?.Invoke(this,module);
            }
        }
        catch(OperationCanceledException) when(cancellationToken.IsCancellationRequested) { }
        catch(Exception ex)
        {
            State=Cs2ConnectionState.Faulted;
            Diagnostic?.Invoke(this,$"S'ha perdut la comunicació amb la CS2: {ex.Message}");
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
    }

    public async ValueTask DisposeAsync()
    {
        await DisconnectAsync().ConfigureAwait(false);
        _sendLock.Dispose();
    }
}
