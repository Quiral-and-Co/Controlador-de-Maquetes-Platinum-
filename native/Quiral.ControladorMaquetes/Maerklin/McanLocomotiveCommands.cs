using System.Buffers.Binary;
using Quiral.ControladorMaquetes.RollingStock;

namespace Quiral.ControladorMaquetes.Maerklin;

/// <summary>Constructors tipats de comandes de locomotora mCAN segons el protocol Märklin.</summary>
public static class McanLocomotiveCommands
{
    public const byte SpeedCommand=0x04;
    public const byte DirectionCommand=0x05;
    public const byte FunctionCommand=0x06;

    public static uint ToLocId(DigitalProtocol protocol,int address)
    {
        if(address is <1 or >0x3FFF) throw new ArgumentOutOfRangeException(nameof(address));
        var prefix=protocol switch
        {
            DigitalProtocol.Motorola or DigitalProtocol.Mm2 => 0x0000u,
            DigitalProtocol.Mfx => 0x4000u,
            DigitalProtocol.Dcc => 0xC000u,
            _ => throw new ArgumentException("El protocol de locomotora no és compatible amb aquest constructor.",nameof(protocol))
        };
        return prefix | (uint)address;
    }

    public static McanFrame BuildSpeed(DigitalProtocol protocol,int address,int speed,ushort hash)
    {
        if(speed is <0 or >1000) throw new ArgumentOutOfRangeException(nameof(speed),"La velocitat mCAN ha d'estar entre 0 i 1000.");
        var data=new byte[6];
        BinaryPrimitives.WriteUInt32BigEndian(data.AsSpan(0,4),ToLocId(protocol,address));
        BinaryPrimitives.WriteUInt16BigEndian(data.AsSpan(4,2),(ushort)speed);
        return new McanFrame(3,SpeedCommand,false,hash,data);
    }

    public static McanFrame BuildDirection(DigitalProtocol protocol,int address,byte direction,ushort hash)
    {
        if(direction>3) throw new ArgumentOutOfRangeException(nameof(direction));
        var data=new byte[5];
        BinaryPrimitives.WriteUInt32BigEndian(data.AsSpan(0,4),ToLocId(protocol,address));
        data[4]=direction;
        return new McanFrame(3,DirectionCommand,false,hash,data);
    }

    public static McanFrame BuildFunction(DigitalProtocol protocol,int address,int function,bool enabled,ushort hash)
    {
        if(function is <0 or >31) throw new ArgumentOutOfRangeException(nameof(function));
        var data=new byte[6];
        BinaryPrimitives.WriteUInt32BigEndian(data.AsSpan(0,4),ToLocId(protocol,address));
        data[4]=(byte)function;
        data[5]=enabled?(byte)1:(byte)0;
        return new McanFrame(3,FunctionCommand,false,hash,data);
    }
}
