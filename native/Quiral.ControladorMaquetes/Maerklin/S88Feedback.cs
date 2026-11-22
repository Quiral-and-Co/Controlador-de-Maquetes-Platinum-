namespace Quiral.ControladorMaquetes.Maerklin;

public sealed record S88ContactEvent(ushort ContactId, bool PreviousOccupied, bool IsOccupied,
    ushort Timestamp10Ms, DateTimeOffset ReceivedAt);

public sealed record S88ModuleSnapshot(byte ModuleNumber, ushort ContactBits, DateTimeOffset ReceivedAt)
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
    public const ushort BroadcastHash=0x0300;

    public static McanFrame BuildSubscribe(ushort contactId)
    {
        var data=new byte[5];
        System.Buffers.Binary.BinaryPrimitives.WriteUInt16BigEndian(data.AsSpan(0,2),contactId);
        return new McanFrame(0,EventCommand,false,BroadcastHash,data);
    }

    public static McanFrame BuildPoll(byte moduleNumber, uint senderUid)
    {
        var data=new byte[5];
        System.Buffers.Binary.BinaryPrimitives.WriteUInt32BigEndian(data.AsSpan(0,4),senderUid);
        data[4]=moduleNumber;
        return new McanFrame(0,PollCommand,false,BroadcastHash,data);
    }

    public static S88ContactEvent? TryParseEvent(McanFrame frame)
    {
        if(frame.Command!=EventCommand||frame.Dlc!=8) return null;
        var contact=System.Buffers.Binary.BinaryPrimitives.ReadUInt16BigEndian(frame.Data.AsSpan(0,2));
        var oldState=frame.Data[2]; var newState=frame.Data[3];
        if(oldState>1||newState>1) return null;
        var timestamp=System.Buffers.Binary.BinaryPrimitives.ReadUInt16BigEndian(frame.Data.AsSpan(4,2));
        return new S88ContactEvent(contact,oldState==1,newState==1,timestamp,DateTimeOffset.UtcNow);
    }

    public static S88ModuleSnapshot? TryParseBroadcast(McanFrame frame)
    {
        if(frame.Command!=BroadcastCommand||frame.Dlc!=3) return null;
        var module=frame.Data[0];
        var bits=System.Buffers.Binary.BinaryPrimitives.ReadUInt16BigEndian(frame.Data.AsSpan(1,2));
        return new S88ModuleSnapshot(module,bits,DateTimeOffset.UtcNow);
    }

    public static S88ModuleSnapshot? TryParsePollReply(McanFrame frame)
    {
        if(frame.Command!=PollCommand||!frame.IsResponse||frame.Dlc!=7) return null;
        var module=frame.Data[4];
        var bits=System.Buffers.Binary.BinaryPrimitives.ReadUInt16BigEndian(frame.Data.AsSpan(5,2));
        return new S88ModuleSnapshot(module,bits,DateTimeOffset.UtcNow);
    }
}
