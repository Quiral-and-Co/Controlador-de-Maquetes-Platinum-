using System.Drawing;
using System.Windows.Forms;
using Quiral.ControladorMaquetes.Core;

namespace Quiral.ControladorMaquetes;

public sealed class MainForm : Form
{
    private readonly QuiralCore _core;
    private readonly ToolStripStatusLabel _status = new();
    private readonly Label _diagnosticsValue = new();
    private readonly Label _devicesValue = new();
    private readonly Label _dataPathValue = new();

    public MainForm(QuiralCore core)
    {
        _core = core ?? throw new ArgumentNullException(nameof(core));
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

        var statusStrip = new StatusStrip();
        _status.Text = "SORTIDES FÍSIQUES BLOQUEJADES";
        _status.ForeColor = Color.DarkRed;
        _status.Font = new Font(SystemFonts.StatusFont, FontStyle.Bold);
        statusStrip.Items.Add(_status);
        statusStrip.Items.Add(new ToolStripStatusLabel { Spring = true });
        statusStrip.Items.Add(new ToolStripStatusLabel("Quiral Control · Nucli local preparat"));

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

        var dashboard = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 4,
            Padding = new Padding(28),
            BackColor = SystemColors.Control
        };
        dashboard.RowStyles.Add(new RowStyle(SizeType.Absolute, 62));
        dashboard.RowStyles.Add(new RowStyle(SizeType.Absolute, 62));
        dashboard.RowStyles.Add(new RowStyle(SizeType.Absolute, 62));
        dashboard.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        dashboard.Controls.Add(CreateMetric("ESTAT DEL NUCLI", _core.StateOfCore.ToString()), 0, 0);
        _devicesValue.Text = $"Dispositius registrats: {_core.Devices.Snapshot().Count}";
        dashboard.Controls.Add(CreateMetric("REGISTRE DE DISPOSITIUS", _devicesValue.Text), 0, 1);
        _diagnosticsValue.Text = $"Registres de diagnòstic: {_core.Diagnostics.Snapshot().Count}";
        dashboard.Controls.Add(CreateMetric("DIAGNÒSTIC LOCAL", _diagnosticsValue.Text), 0, 2);

        var details = new GroupBox
        {
            Dock = DockStyle.Fill,
            Text = "Quiral Control · Informació del sistema",
            Font = new Font("Segoe UI", 10, FontStyle.Bold),
            Padding = new Padding(16)
        };
        _dataPathValue.Dock = DockStyle.Fill;
        _dataPathValue.Font = new Font("Segoe UI", 9);
        _dataPathValue.Text = "Dades locals: " + _core.DataDirectory + Environment.NewLine + Environment.NewLine +
            "Nucli intern inicialitzat correctament." + Environment.NewLine +
            "Sense servidor web, navegador incrustat ni dependència de serveis externs." + Environment.NewLine +
            "No hi ha cap controlador de maquinari registrat." + Environment.NewLine +
            "Les ordres que requereixen sortides físiques són rebutjades pel gestor de seguretat.";
        details.Controls.Add(_dataPathValue);
        dashboard.Controls.Add(details, 0, 3);

        Controls.Add(dashboard);
        Controls.Add(subtitle);
        Controls.Add(heading);
        Controls.Add(statusStrip);
        Controls.Add(menu);
        MainMenuStrip = menu;
        statusStrip.Dock = DockStyle.Bottom;
        menu.Dock = DockStyle.Top;
    }

    private static Control CreateMetric(string title, string value)
    {
        var panel = new Panel { Dock = DockStyle.Fill, Padding = new Padding(8, 4, 8, 4) };
        panel.Controls.Add(new Label
        {
            Dock = DockStyle.Left,
            Width = 260,
            Text = title,
            Font = new Font("Segoe UI", 9, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleLeft
        });
        panel.Controls.Add(new Label
        {
            Dock = DockStyle.Fill,
            Text = value,
            Font = new Font("Segoe UI", 10),
            TextAlign = ContentAlignment.MiddleLeft
        });
        return panel;
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
