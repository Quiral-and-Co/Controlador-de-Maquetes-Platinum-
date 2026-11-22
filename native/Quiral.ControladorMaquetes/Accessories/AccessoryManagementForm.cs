using System.Drawing;
using System.Windows.Forms;

namespace Quiral.ControladorMaquetes.Accessories;

/// <summary>Finestra nativa per administrar el registre de desviaments i accessoris.</summary>
public sealed class AccessoryManagementForm : Form
{
    private readonly AccessoryModule _module;
    private readonly DataGridView _grid = new();

    public AccessoryManagementForm(AccessoryModule module)
    {
        _module = module ?? throw new ArgumentNullException(nameof(module));
        Text = "Desviaments i accessoris · Quiral Control";
        StartPosition = FormStartPosition.CenterParent;
        MinimumSize = new Size(760, 460);
        Size = new Size(980, 620);

        _grid.Dock = DockStyle.Fill;
        _grid.ReadOnly = true;
        _grid.AllowUserToAddRows = false;
        _grid.AllowUserToDeleteRows = false;
        _grid.MultiSelect = false;
        _grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
        _grid.AutoGenerateColumns = true;

        var toolbar = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 48, Padding = new Padding(8), WrapContents = false };
        var add = new Button { Text = "Nou accessori", AutoSize = true };
        var edit = new Button { Text = "Editar", AutoSize = true };
        var remove = new Button { Text = "Eliminar", AutoSize = true };
        var refresh = new Button { Text = "Actualitzar", AutoSize = true };
        add.Click += async (_, _) => await AddItemAsync();
        edit.Click += async (_, _) => await EditItemAsync();
        remove.Click += async (_, _) => await RemoveItemAsync();
        refresh.Click += async (_, _) => await RefreshAsync();
        toolbar.Controls.AddRange([add, edit, remove, refresh]);

        var warning = new Label
        {
            Dock = DockStyle.Bottom, Height = 42, Padding = new Padding(10),
            Text = "Registre i configuració locals. L'accionament físic de desviaments i accessoris continua bloquejat.",
            ForeColor = Color.DarkRed, TextAlign = ContentAlignment.MiddleLeft
        };
        Controls.Add(_grid);
        Controls.Add(warning);
        Controls.Add(toolbar);
        Shown += async (_, _) => await RefreshAsync();
    }

    private RailwayAccessory? Selected => _grid.CurrentRow?.DataBoundItem as RailwayAccessory;

    private async Task RefreshAsync()
    {
        _grid.DataSource = (await _module.SnapshotAsync()).ToList();
        if (_grid.Columns[nameof(RailwayAccessory.Id)] is { } id) id.Visible = false;
        if (_grid.Columns[nameof(RailwayAccessory.StateLabel)] is { } state) state.HeaderText = "Estat actual (descriptiu; sense feedback físic)";
    }

    private async Task AddItemAsync()
    {
        using var dialog = new AccessoryEditorForm();
        if (dialog.ShowDialog(this) != DialogResult.OK || dialog.Value is not { } item) return;
        try { await _module.AddAsync(item); await RefreshAsync(); }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "No s'ha pogut crear", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
    }

    private async Task EditItemAsync()
    {
        if (Selected is not { } current) return;
        using var dialog = new AccessoryEditorForm(current);
        if (dialog.ShowDialog(this) != DialogResult.OK || dialog.Value is not { } item) return;
        try { await _module.UpdateAsync(item); await RefreshAsync(); }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "No s'ha pogut actualitzar", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
    }

    private async Task RemoveItemAsync()
    {
        if (Selected is not { } current) return;
        if (MessageBox.Show(this, $"Eliminar «{current.Name}» del registre?", "Confirmar eliminació",
            MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
        try { await _module.RemoveAsync(current.Id); await RefreshAsync(); }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "No s'ha pogut eliminar", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
    }
}

internal sealed class AccessoryEditorForm : Form
{
    private readonly TextBox _name = new() { Dock = DockStyle.Fill };
    private readonly ComboBox _kind = new() { DropDownStyle = ComboBoxStyle.DropDownList, Dock = DockStyle.Fill };
    private readonly ComboBox _protocol = new() { DropDownStyle = ComboBoxStyle.DropDownList, Dock = DockStyle.Fill };
    private readonly NumericUpDown _address = new() { Minimum = 1, Maximum = 2048, Dock = DockStyle.Fill };
    private readonly NumericUpDown _output = new() { Minimum = 1, Maximum = 4, Dock = DockStyle.Fill };
    private readonly ComboBox _position = new() { DropDownStyle = ComboBoxStyle.DropDownList, Dock = DockStyle.Fill };
    private readonly TextBox _decoder = new() { Dock = DockStyle.Fill };
    private readonly TextBox _notes = new() { Dock = DockStyle.Fill };
    private readonly TextBox _stateLabel = new() { Dock = DockStyle.Fill };
    private readonly string? _id;
    private readonly DateTimeOffset _created;

    public RailwayAccessory? Value { get; private set; }

    public AccessoryEditorForm(RailwayAccessory? item = null)
    {
        _id = item?.Id;
        _created = item?.CreatedAt ?? DateTimeOffset.UtcNow;
        Text = item is null ? "Nou desviament o accessori" : "Editar accessori";
        StartPosition = FormStartPosition.CenterParent;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MinimizeBox = false; MaximizeBox = false;
        ClientSize = new Size(460, 370);

        _kind.DataSource = Enum.GetValues<AccessoryKind>();
        _protocol.DataSource = Enum.GetValues<AccessoryProtocol>();
        _position.DataSource = Enum.GetValues<AccessoryPosition>();
        if (item is not null)
        {
            _name.Text = item.Name; _kind.SelectedItem = item.Kind; _protocol.SelectedItem = item.Protocol;
            _address.Value = item.Address; _output.Value = item.Output; _position.SelectedItem = item.Position;
            _decoder.Text = item.Decoder ?? ""; _notes.Text = item.Notes ?? ""; _stateLabel.Text = item.StateLabel ?? "";
        }

        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(12), ColumnCount = 2, RowCount = 10 };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 135));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        AddRow(layout, 0, "Nom", _name); AddRow(layout, 1, "Tipus", _kind);
        AddRow(layout, 2, "Protocol", _protocol); AddRow(layout, 3, "Adreça", _address);
        AddRow(layout, 4, "Sortida", _output); AddRow(layout, 5, "Posició coneguda", _position);
        AddRow(layout, 6, "Decoder", _decoder); AddRow(layout, 7, "Notes", _notes);
        AddRow(layout, 8, "Estat / posició", _stateLabel);
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft };
        var save = new Button { Text = "Desar", DialogResult = DialogResult.None, AutoSize = true };
        var cancel = new Button { Text = "Cancel·lar", DialogResult = DialogResult.Cancel, AutoSize = true };
        save.Click += (_, _) =>
        {
            if (string.IsNullOrWhiteSpace(_name.Text))
            { MessageBox.Show(this, "El nom és obligatori."); return; }
            Value = new RailwayAccessory(_id ?? "", _name.Text, (AccessoryKind)_kind.SelectedItem!,
                (AccessoryProtocol)_protocol.SelectedItem!, (int)_address.Value, (int)_output.Value,
                (AccessoryPosition)_position.SelectedItem!, string.IsNullOrWhiteSpace(_decoder.Text) ? null : _decoder.Text,
                string.IsNullOrWhiteSpace(_notes.Text) ? null : _notes.Text, _created, DateTimeOffset.UtcNow,
                string.IsNullOrWhiteSpace(_stateLabel.Text) ? null : _stateLabel.Text.Trim());
            DialogResult = DialogResult.OK;
            Close();
        };
        buttons.Controls.Add(save); buttons.Controls.Add(cancel);
        layout.Controls.Add(buttons, 0, 9); layout.SetColumnSpan(buttons, 2);
        Controls.Add(layout);
        AcceptButton = save; CancelButton = cancel;
    }

    private static void AddRow(TableLayoutPanel layout, int row, string label, Control control)
    {
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 38));
        layout.Controls.Add(new Label { Text = label, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft }, 0, row);
        layout.Controls.Add(control, 1, row);
    }
}
