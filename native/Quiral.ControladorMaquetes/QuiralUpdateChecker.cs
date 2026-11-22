using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text.Json;

namespace Quiral.ControladorMaquetes;

public sealed record QuiralUpdateInfo(string Version, string ReleaseUrl, string TagName);

/// <summary>Consulta pública de versions publicades a GitHub; no requereix compte ni token.</summary>
public static class QuiralUpdateChecker
{
    private const string Api = "https://api.github.com/repos/Quiral-and-Co/Controlador-de-Maquetes-Platinum-/releases/latest";
    public static async Task<QuiralUpdateInfo?> CheckLatestAsync(CancellationToken ct = default)
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
        client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("Quiral-Control", "1.4.3"));
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        using var response = await client.GetAsync(Api, ct).ConfigureAwait(false);
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound) return null;
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(ct).ConfigureAwait(false);
        using var json = await JsonDocument.ParseAsync(stream, cancellationToken: ct).ConfigureAwait(false);
        var root = json.RootElement;
        var tag = root.GetProperty("tag_name").GetString() ?? "";
        var url = root.GetProperty("html_url").GetString() ?? "";
        if (string.IsNullOrWhiteSpace(tag) || !Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps || uri.Host != "github.com")
            throw new InvalidDataException("La resposta de GitHub no conté una publicació vàlida.");
        return new QuiralUpdateInfo(tag.TrimStart('v', 'V'), uri.ToString(), tag);
    }
    public static void OpenReleasePage(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps || uri.Host != "github.com")
            throw new ArgumentException("URL de publicació no vàlida.", nameof(url));
        Process.Start(new ProcessStartInfo(uri.ToString()) { UseShellExecute = true });
    }
}