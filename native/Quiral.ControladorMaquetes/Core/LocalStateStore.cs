using System.Text.Json;

namespace Quiral.ControladorMaquetes.Core;

/// <summary>Persistència JSON local amb substitució atòmica i protecció contra paths fora del directori de dades.</summary>
public sealed class LocalStateStore
{
    private readonly string _root;
    private readonly JsonSerializerOptions _json = new() { WriteIndented = true };

    public LocalStateStore(string rootDirectory)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(rootDirectory);
        _root = Path.GetFullPath(rootDirectory);
        Directory.CreateDirectory(_root);
    }

    public async Task<T?> ReadAsync<T>(string relativePath, CancellationToken cancellationToken = default)
    {
        var path = Resolve(relativePath);
        if (!File.Exists(path)) return default;
        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read,
            4096, FileOptions.Asynchronous | FileOptions.SequentialScan);
        return await JsonSerializer.DeserializeAsync<T>(stream, _json, cancellationToken);
    }

    public async Task WriteAsync<T>(string relativePath, T value, CancellationToken cancellationToken = default)
    {
        var path = Resolve(relativePath);
        var directory = Path.GetDirectoryName(path)!;
        Directory.CreateDirectory(directory);
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None,
                4096, FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await JsonSerializer.SerializeAsync(stream, value, _json, cancellationToken);
                await stream.FlushAsync(cancellationToken);
                stream.Flush(true);
            }
            File.Move(temporary, path, true);
        }
        finally
        {
            if (File.Exists(temporary)) File.Delete(temporary);
        }
    }

    private string Resolve(string relativePath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(relativePath);
        if (Path.IsPathRooted(relativePath))
            throw new ArgumentException("Només s'admeten rutes relatives al directori local de Quiral.", nameof(relativePath));

        var full = Path.GetFullPath(Path.Combine(_root, relativePath));
        var prefix = _root.EndsWith(Path.DirectorySeparatorChar)
            ? _root
            : _root + Path.DirectorySeparatorChar;
        if (!full.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(full, _root, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("La ruta sol·licitada surt del directori local de dades.");
        return full;
    }
}
