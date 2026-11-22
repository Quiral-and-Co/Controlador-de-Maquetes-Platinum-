using System;
using System.Windows.Forms;

namespace Quiral.ControladorMaquetes;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }
}
