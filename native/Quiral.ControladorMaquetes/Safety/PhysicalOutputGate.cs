namespace Quiral.ControladorMaquetes.Safety;

/// <summary>
/// Interbloqueig conservador per a sortides físiques. La nova aplicació no
/// incorpora encara controladors de maquinari: per tant, l'estat efectiu és BLOQUEJAT.
/// </summary>
public sealed class PhysicalOutputGate
{
    public bool IsArmed { get; private set; }
    public bool PhysicalOutputsEnabled => false;

    public IReadOnlyList<string> MissingRequirements { get; } =
    [
        "Controlador natiu de la central implementat i verificat",
        "Proves completes de comunicació i pèrdua de connexió",
        "Validació elèctrica i de proteccions fail-safe",
        "Parada d'emergència física independent verificada",
        "Validació física de la maqueta",
        "Regressió completa del programari",
        "Autorització explícita de l'operador"
    ];

    public void Disarm() => IsArmed = false;

    // No existeix cap mètode d'armament en aquesta fase de migració.
    // Les sortides físiques continuen deshabilitades per disseny.
}
