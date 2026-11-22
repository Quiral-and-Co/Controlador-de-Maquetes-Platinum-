using QuiralCore.Communication;

static void Check(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
}

var source = new McanFrame(1, 0x11, true, 0x0300, [0x00, 0x01, 0x00, 0x05, 0x00, 0x01, 0x00, 0x2A]);
var encoded = source.Encode();
Check(encoded.Length == 13, "MCAN frame must be 13 bytes.");
var decoded = McanFrame.Decode(encoded);
Check(decoded.Priority == source.Priority && decoded.Command == source.Command &&
      decoded.IsResponse == source.IsResponse && decoded.Hash == source.Hash &&
      decoded.Data.SequenceEqual(source.Data), "MCAN frame round-trip failed.");

var rejectedLength = false;
try { McanFrame.Decode(new byte[12]); } catch (ArgumentException) { rejectedLength = true; }
Check(rejectedLength, "Malformed frame length must be rejected.");

var registry = new S88FeedbackRegistry();
registry.Register(new S88Contact(5, "Contacte de prova", 1));
S88ContactState? last = null;
registry.ContactChanged += (_, state) => last = state;

// CAN 2.0 S88 event: device ID, contact ID, previous/new state, timestamp.
var eventFrame = new McanFrame(0, 0x11, false, 0x0300,
    [0x00, 0x01, 0x00, 0x05, 0x00, 0x01, 0x00, 0x2A]);
Check(registry.TryProcess(eventFrame, out var eventState), "Registered S88 event was not accepted.");
Check(eventState is { ContactId: 5, IsActive: true, LevelId: 1 }, "S88 event mapping failed.");
Check(last == eventState, "S88 change event was not raised.");

// Module 1, bit 15 represents contact 1. Contact 5 is bit 11.
var broadcast = new McanFrame(0, 0x12, false, 0x0300, [0x01, 0x08, 0x00]);
Check(registry.TryProcess(broadcast, out _), "S88 broadcast was not processed.");
Check(last is { ContactId: 5, IsActive: true }, "S88 module bit mapping failed.");

var path = Path.Combine(Path.GetTempPath(), $"quiral-s88-{Guid.NewGuid():N}.json");
try
{
    await registry.SaveAsync(path);
    var restored = await S88FeedbackRegistry.LoadAsync(path);
    var restoredFrame = new McanFrame(0, 0x11, false, 0x0300,
        [0x00, 0x01, 0x00, 0x05, 0x00, 0x01, 0x00, 0x2A]);
    Check(restored.TryProcess(restoredFrame, out var restoredState) &&
          restoredState is { ContactId: 5, Name: "Contacte de prova" },
          "S88 registry persistence round-trip failed.");
}
finally
{
    if (File.Exists(path)) File.Delete(path);
}

Console.WriteLine("PASS: native MCAN codec, validation, S88 event/broadcast mapping and registry persistence.");
