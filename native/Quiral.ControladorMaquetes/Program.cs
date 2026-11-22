using System;
using System.Windows.Forms;
using Quiral.ControladorMaquetes.Core;

namespace Quiral.ControladorMaquetes;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        var core = new QuiralCore();
        try
        {
            core.InitializeAsync().GetAwaiter().GetResult();
            Application.Run(new MainForm(core));
        }
        catch (Exception exception)
        {
            MessageBox.Show(
                $"No s'ha pogut iniciar Quiral Control.\\r\\n\\r\\n{exception.Message}",
                "Quiral & Co. Platinum",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
        finally
        {
            core.DisposeAsync().AsTask().GetAwaiter().GetResult();
        }
    }
}
