using System.Net.Sockets;

namespace QuiralCore.Communication;

/// <summary>
/// Native, read-only MCAN TCP connection to a Märklin CS2.
/// It deliberately exposes no command-transmission API: physical control remains locked.
/// </summary>
public sealed class Cs2TcpConnection : IAsyncDisposable
{
    public const int DefaultPort = 15731;
    private readonly string _host;
    private readonly int _port;
    private readonly TimeSpan _frameTimeout;
    private TcpClient? _client;
    private CancellationTokenSource? _lifetime;
    private Task? _reader;

    public event EventHandler<McanFrame>? FrameReceived;
    public event EventHandler<Exception>? ConnectionFaulted;

    public bool IsConnected => _client?.Connected == true;

    public Cs2TcpConnection(string host, int port = DefaultPort, TimeSpan? frameTimeout = null)
    {
        if (string.IsNullOrWhiteSpace(host)) throw new ArgumentException("A CS2 host/IP is required.", nameof(host));
        if (port is < 1 or > 65535) throw new ArgumentOutOfRangeException(nameof(port));
        _host = host;
        _port = port;
        _frameTimeout = frameTimeout ?? TimeSpan.FromSeconds(5);
    }

    public async Task ConnectAsync(CancellationToken cancellationToken = default)
    {
        if (_client is not null) throw new InvalidOperationException("Connection is already started.");
        var client = new TcpClient { NoDelay = true };
        await client.ConnectAsync(_host, _port, cancellationToken).ConfigureAwait(false);
        _client = client;
        _lifetime = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _reader = ReadLoopAsync(client, _lifetime.Token);
    }

    private async Task ReadLoopAsync(TcpClient client, CancellationToken cancellationToken)
    {
        var frameBytes = new byte[McanFrame.FrameLength];
        try
        {
            var stream = client.GetStream();
            while (!cancellationToken.IsCancellationRequested)
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                timeout.CancelAfter(_frameTimeout);
                await stream.ReadExactlyAsync(frameBytes, timeout.Token).ConfigureAwait(false);
                var frame = McanFrame.Decode(frameBytes);
                FrameReceived?.Invoke(this, frame);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
        catch (Exception ex)
        {
            ConnectionFaulted?.Invoke(this, ex);
            _lifetime?.Cancel();
        }
    }

    public async ValueTask DisposeAsync()
    {
        _lifetime?.Cancel();
        _client?.Close();
        if (_reader is not null)
        {
            try { await _reader.ConfigureAwait(false); }
            catch (OperationCanceledException) { }
        }
        _lifetime?.Dispose();
        _client?.Dispose();
        _lifetime = null;
        _client = null;
    }
}
