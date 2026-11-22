using System;
using System.Windows.Forms;
using Quiral.ControladorMaquetes.Core;
using Quiral.ControladorMaquetes.Projects;
using Quiral.ControladorMaquetes.Geometry;
using Quiral.ControladorMaquetes.RollingStock;
using Quiral.ControladorMaquetes.Maerklin;
using Quiral.ControladorMaquetes.Accessories;

namespace Quiral.ControladorMaquetes;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        var core = new QuiralCore();
        var projects = new ProjectModule();
        var geometry = new RailwayGeometryModule(projects);
        var rollingStock = new RollingStockModule();
        var accessories = new AccessoryModule();
        var cs2 = new Cs2TcpController();
        var s88Feedback = new S88FeedbackModule(cs2);
        core.RegisterModule(projects);
        core.RegisterModule(geometry);
        core.RegisterModule(rollingStock);
        core.RegisterModule(accessories);
        core.RegisterModule(cs2);
        core.RegisterModule(s88Feedback);
        try
        {
            core.InitializeAsync().GetAwaiter().GetResult();
            var connectionSettings = new Cs2ConnectionSettingsStore(core.State);
            Application.Run(new MainForm(core, projects, geometry, rollingStock, cs2, accessories, connectionSettings));
        }
        catch (Exception exception)
        {
            MessageBox.Show(
                $"No s'ha pogut iniciar Quiral Control.\r\n\r\n{exception.Message}",
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
