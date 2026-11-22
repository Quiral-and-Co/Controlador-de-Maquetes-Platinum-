namespace Quiral.ControladorMaquetes.Maerklin;

public sealed record S88ContactEvent(uint ContactUid, ushort DeviceId, ushort ContactNumber,
    bool PreviousOccupied, bool IsOccupied, ushort Timestamp10Ms, DateTimeOffset ReceivedAt);

public sealed record S88ModuleSnapshot(ushort DeviceId, byte ModuleNumber, ushort ContactBits,
    DateTimeOffset ReceivedAt)
{
    public bool IsOccupied(int contactOneBased)
    {
        if(contactOneBased is <1 or >16) throw new ArgumentOutOfRangeException(nameof(contactOneBased));
        return (ContactBits & (1 << (16-contactOneBased))) != 0;
    }
}

public static class S88Feedback
{
    public const byte PollCommand=0x10;
    public const byte EventCommand=0x11;
    public const byte BroadcastCommand=0x12;

    public static McanFrame BuildSubscribe(ushort deviceId, ushort contactNumber, ushort hash)
    {
        var data=new byte[5];
        System.Buffers.Binary.BinaryPrimitives.WriteUInt16BigEndian(data.AsSpan(0,2),deviceId);
        System.Buffers.Binary.BinaryPrimitives.WriteUInt16BigEndian(data.AsSpan(2,2),contactNumber);
        data[4]=0;
        return new McanFrame(1,EventCommand,false,hash,data);
    }

    public static McanFrame BuildPoll(ushort deviceId, byte moduleNumber, uint senderUid, ushort hash)
    {
        var data=new byte[5];
        System.Buffers.Binary.BinaryPrimitives.WriteUInt32BigEndian(data.AsSpan(0,4),senderUid);
        data[4]=moduleNumber;
        return new McanFrame(1,PollCommand,false,hash,data);
    }

    public static S88ContactEvent? TryParseEvent(McanFrame frame)
    {
        if(frame.Command!=EventCommand||!frame.IsResponse||frame.Dlc!=8) return null;
        var device=System.Buffers.Binary.BinaryPrimitives.ReadUInt16BigEndian(frame.Data.AsSpan(0,2));
        var contact=System.Buffers.Binary.BinaryPrimitives.ReadUInt16BigEndian(frame.Data.AsSpan(2,2));
        var oldState=frame.Data[4]; var newState=frame.Data[5];
        if(oldState>1||newState>1) return null;
        var timestamp=System.Buffers.Binary.BinaryPrimitives.ReadUInt16BigEndian(frame.Data.AsSpan(6,2));
        var uid=((uint)device<<16)|contact;
        return new S88ContactEvent(uid,device,contact,oldState==1,newState==1,timestamp,DateTimeOffset.UtcNow);
    }

    public static S88ModuleSnapshot? TryParsePollReply(McanFrame frame)
    {
        if(frame.Command!=PollCommand||!frame.IsResponse||frame.Dlc!=7) return null;
        var device=(ushort)(System.Buffers.Binary.BinaryPrimitives.ReadUInt32BigEndian(frame.Data.AsSpan(0,4))&0xFFFF);
        var module=frame.Data[4];
        var bits=System.Buffers.Binary.BinaryPrimitives.ReadUInt16BigEndian(frame.Data.AsSpan(5,2));
        return new S88ModuleSnapshot(device,module,bits,DateTimeOffset.UtcNow);
    }
}
