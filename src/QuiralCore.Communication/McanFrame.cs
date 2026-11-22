namespace QuiralCore.Communication;

/// <summary>One fixed-size 13-byte Märklin CAN (MCAN) frame.</summary>
public sealed record McanFrame(byte Priority, ushort Command, bool IsResponse, ushort Hash, byte[] Data)
{
    public const int FrameLength = 13;
    public const int MaximumDataLength = 8;

    public static McanFrame Decode(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length != FrameLength)
            throw new ArgumentException("An MCAN frame must contain exactly 13 bytes.", nameof(bytes));

        var dlc = bytes[4];
        if (dlc > MaximumDataLength)
            throw new FormatException($"Invalid MCAN DLC: {dlc}.");

        var priority = (byte)(bytes[0] >> 4);
        var command = (ushort)(((bytes[0] & 0x0F) << 7) | (bytes[1] >> 1));
        var response = (bytes[1] & 1) != 0;
        var hash = (ushort)((bytes[2] << 8) | bytes[3]);
        return new McanFrame(priority, command, response, hash, bytes.Slice(5, dlc).ToArray());
    }

    public byte[] Encode()
    {
        if (Priority > 0x0F) throw new ArgumentOutOfRangeException(nameof(Priority));
        if (Command > 0x07FF) throw new ArgumentOutOfRangeException(nameof(Command));
        if (Data is null || Data.Length > MaximumDataLength)
            throw new ArgumentException("MCAN payload must contain 0–8 bytes.", nameof(Data));

        var bytes = new byte[FrameLength];
        bytes[0] = (byte)((Priority << 4) | ((Command >> 7) & 0x0F));
        bytes[1] = (byte)(((Command & 0x7F) << 1) | (IsResponse ? 1 : 0));
        bytes[2] = (byte)(Hash >> 8);
        bytes[3] = (byte)Hash;
        bytes[4] = (byte)Data.Length;
        Data.CopyTo(bytes, 5);
        return bytes;
    }
}
