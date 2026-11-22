using System.Drawing;
using System.Windows.Forms;
using Quiral.ControladorMaquetes.Safety;

namespace Quiral.ControladorMaquetes;

public sealed class MainForm : Form
{
    private readonly PhysicalOutputGate _outputGate = new();
    private readonly ToolStripStatusLabel _status = new()
    {
        Text = "SORTIDES FÍSIQUES BLOQUEJADES",
        ForeColor = Color.DarkRed,
        Font = new Font(SystemFonts.StatusFont, FontStyle.Bold)
    };

    public MainForm()
    {
        Text = "Controlador de Maquetes by Quiral & Co. Platinum — 1.4.0";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(1050, 700);
        Size = new Size(1280, 820);
        AutoScaleMode = AutoScaleMode.Dpi;

        var menu = new MenuStrip();
        menu.Items.Add(BuildMenu("Fitxer", "Nou projecte", "Obrir projecte…", "Desar projecte", "Sortir"));
        menu.Items.Add(BuildMenu("Maqueta", "Disseny de vies", "Material mòbil", "Gestió de circulacions"));
        menu.Items.Add(BuildMenu("Ferrocarril", "Centrals digitals", "Control de locomotores", "Panells de cabina", "Seguretat del tren"));
        menu.Items.Add(BuildMenu("Eines", "Validació del sistema", "Diagnòstic", "Preferències"));
        MainMenuStrip = menu;

        var statusStrip = new StatusStrip();
        statusStrip.Items.Add(_status);
        statusStrip.Items.Add(new ToolStripStatusLabel { Spring = true });
        statusStrip.Items.Add(new ToolStripStatusLabel("Quiral Control · Mode local"));

        var heading = new Label
        {
            Dock = DockStyle.Top,
            Height = 74,
            Text = "CONTROLADOR DE MAQUETES  |  PLATINUM",
            Font = new Font("Segoe UI", 19, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleLeft,
            Padding = new Padding(22, 0, 0, 0)
        };
        var subtitle = new Label
        {
            Dock = DockStyle.Top,
            Height = 38,
            Text = "Quiral & Co. · Aplicació nativa Windows · Arquitectura local independent",
            Font = new Font("Segoe UI", 10),
            ForeColor = Color.DimGray,
            Padding = new Padding(24, 4, 0, 0)
        };
        var notice = new Label
        {
            Dock = DockStyle.Fill,
            Text = "BASE NATIVA EN CONSTRUCCIÓ\r\n\r\n" +
                   "Aquesta és la primera base de l'aplicació Windows nativa.\r\n" +
                   "Les funcions ferroviàries s'hi migraran progressivament.\r\n\r\n" +
                   "No hi ha cap connexió a centrals ni cap ordre física habilitada.\r\n" +
                   "Les sortides físiques romanen bloquejades durant tota aquesta fase.",
            Font = new Font("Segoe UI", 13),
            TextAlign = ContentAlignment.MiddleCenter,
            Padding = new Padding(35),
            BackColor = SystemColors.Control
        };

        Controls.Add(notice);
        Controls.Add(subtitle);
        Controls.Add(heading);
        Controls.Add(statusStrip);
        Controls.Add(menu);
        MainMenuStrip = menu;
        statusStrip.Dock = DockStyle.Bottom;
        menu.Dock = DockStyle.Top;
    }

    private static ToolStripMenuItem BuildMenu(string title, params string[] entries)
    {
        var menu = new ToolStripMenuItem(title);
        foreach (var entry in entries)
        {
            if (entry == "Sortir")
                menu.DropDownItems.Add(new ToolStripMenuItem(entry, null, (_, _) => Application.Exit()));
            else
                menu.DropDownItems.Add(new ToolStripMenuItem(entry) { Enabled = false });
        }
        return menu;
    }
}
