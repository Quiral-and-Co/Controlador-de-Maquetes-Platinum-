namespace Quiral.ControladorMaquetes.Maerklin;

/// <summary>Marc CAN Märklin encapsulat en el paquet Ethernet fix de 13 bytes.</summary>
public sealed record McanFrame(byte Priority, byte Command, bool IsResponse, ushort Hash, byte[] Data)
{
    public const int WireLength = 13;
    public byte Dlc => checked((byte)Data.Length);

    public byte[] Encode()
    {
        if (Priority > 3) throw new ArgumentOutOfRangeException(nameof(Priority));
        if (Data.Length > 8) throw new ArgumentOutOfRangeException(nameof(Data));
        var packet = new byte[WireLength];
        var canId = ((uint)Priority << 30) | ((uint)(Command * 2 + (IsResponse ? 1 : 0)) << 16) | Hash;
        System.Buffers.Binary.BinaryPrimitives.WriteUInt32BigEndian(packet.AsSpan(0,4), canId);
        packet[4] = Dlc;
        Data.CopyTo(packet,5);
        return packet;
    }

    public static McanFrame Decode(ReadOnlySpan<byte> packet)
    {
        if (packet.Length != WireLength) throw new ArgumentException("Un paquet mCAN Ethernet ha de tenir exactament 13 bytes.",nameof(packet));
        var canId=System.Buffers.Binary.BinaryPrimitives.ReadUInt32BigEndian(packet[..4]);
        var dlc=(int)(packet[4]&0x0F);
        if(dlc>8) throw new InvalidDataException("DLC mCAN invàlid.");
        var commandResponse=(ushort)((canId>>16)&0x1FF);
        return new McanFrame((byte)((canId>>30)&0x03),(byte)(commandResponse>>1),
            (commandResponse&1)!=0,(ushort)(canId&0xFFFF),packet.Slice(5,dlc).ToArray());
    }
}
