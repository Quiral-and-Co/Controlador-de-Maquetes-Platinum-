using System.Text.Json;

namespace QuiralCore.Communication;

public sealed record S88Contact(int ContactId, string Name, int LevelId, bool ActiveWhenBitSet = true);
public sealed record S88ContactState(int ContactId, string Name, int LevelId, bool IsActive, DateTimeOffset ReceivedAt);

/// <summary>Central identity registry and decoder for CS2 S88 feedback.</summary>
public sealed class S88FeedbackRegistry
{
    private readonly Dictionary<int, S88Contact> _contacts = new();
    public event EventHandler<S88ContactState>? ContactChanged;

    public void Register(S88Contact contact)
    {
        if (contact.ContactId is < 1 or > 65535) throw new ArgumentOutOfRangeException(nameof(contact));
        if (string.IsNullOrWhiteSpace(contact.Name)) throw new ArgumentException("Contact name is required.", nameof(contact));
        if (contact.LevelId < 1) throw new ArgumentOutOfRangeException(nameof(contact));
        if (_contacts.TryGetValue(contact.ContactId, out var current) && current != contact)
            throw new InvalidOperationException($"S88 contact {contact.ContactId} is already registered.");
        _contacts[contact.ContactId] = contact;
    }

    public bool TryProcess(McanFrame frame, out S88ContactState? state)
    {
        state = null;
        if (frame.Command == 0x11 && frame.Data.Length == 8)
        {
            // CS2 CAN 2.0 S88 event: device ID (D0-D1), contact ID (D2-D3),
            // old/new state (D4-D5), timestamp (D6-D7).
            var contactId = (frame.Data[2] << 8) | frame.Data[3];
            var rawState = frame.Data[5];
            return Publish(contactId, rawState, out state);
        }

        if (frame.Command == 0x12 && frame.Data.Length == 3)
        {
            // Feedback broadcast: module index followed by a 16-bit state word.
            var module = frame.Data[0];
            var bits = (frame.Data[1] << 8) | frame.Data[2];
            if (module == 0) return false;
            for (var bit = 0; bit < 16; bit++)
            {
                var contactId = ((module - 1) * 16) + bit + 1;
                var mask = 1 << (15 - bit);
                var raw = (bits & mask) != 0;
                if (_contacts.TryGetValue(contactId, out var contact))
                {
                    var active = raw == contact.ActiveWhenBitSet;
                    state = new S88ContactState(contactId, contact.Name, contact.LevelId, active, DateTimeOffset.UtcNow);
                    ContactChanged?.Invoke(this, state);
                }
            }
            return true;
        }
        return false;
    }

    private bool Publish(int contactId, int rawState, out S88ContactState? state)
    {
        state = null;
        if (!_contacts.TryGetValue(contactId, out var contact)) return false;
        var active = (rawState != 0) == contact.ActiveWhenBitSet;
        state = new S88ContactState(contactId, contact.Name, contact.LevelId, active, DateTimeOffset.UtcNow);
        ContactChanged?.Invoke(this, state);
        return true;
    }

    public async Task SaveAsync(string path, CancellationToken cancellationToken = default)
    {
        var fullPath = Path.GetFullPath(path);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        var json = JsonSerializer.Serialize(_contacts.Values.OrderBy(x => x.ContactId),
            new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(fullPath, json, cancellationToken).ConfigureAwait(false);
    }

    public static async Task<S88FeedbackRegistry> LoadAsync(string path, CancellationToken cancellationToken = default)
    {
        var registry = new S88FeedbackRegistry();
        if (!File.Exists(path)) return registry;
        var json = await File.ReadAllTextAsync(path, cancellationToken).ConfigureAwait(false);
        var contacts = JsonSerializer.Deserialize<List<S88Contact>>(json) ?? new();
        foreach (var contact in contacts) registry.Register(contact);
        return registry;
    }
}
