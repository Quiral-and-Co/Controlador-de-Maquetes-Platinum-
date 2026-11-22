using System.Drawing;
using System.Windows.Forms;
using Quiral.ControladorMaquetes.Decoders;

namespace Quiral.ControladorMaquetes.Modules;

public sealed class DecoderManagementForm : Form
{
    private readonly DecoderConfigurationModule _module;
    private readonly IDccCvProgrammer _programmer;
    private readonly ComboBox _brand = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 220 };
    private readonly ComboBox _model = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 260 };
    private readonly TextBox _customModel = new() { Width = 260, PlaceholderText = "Referència exacta del fabricant" };
    private readonly ComboBox _kind = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 220 };
    private readonly ComboBox _protocol = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 140 };
    private readonly NumericUpDown _count = new() { Minimum = 2, Maximum = 16, Value = 4, Width = 90 };
    private readonly NumericUpDown _baseAddress = new() { Minimum = 1, Maximum = 2048, Value = 1, Width = 90 };
    private readonly DataGridView _outputs = new() { Dock = DockStyle.Fill, AllowUserToAddRows = false, AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill };
    private readonly DataGridView _saved = new() { Dock = DockStyle.Fill, ReadOnly = true, AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill, SelectionMode = DataGridViewSelectionMode.FullRowSelect };
    private readonly ComboBox _cvMode = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 180 };
    private readonly ComboBox _cvPreset = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 240 };
    private readonly NumericUpDown _cvNumber = new() { Minimum = 1, Maximum = 1024, Value = 1, Width = 90 };
    private readonly NumericUpDown _cvValue = new() { Minimum = 0, Maximum = 255, Value = 3, Width = 90 };
    private readonly Label _cvInfo = new() { AutoSize = true, MaximumSize = new Size(680, 0) };
    private readonly Label _status = new() { AutoSize = true };
    public DecoderManagementForm(DecoderConfigurationModule module, IDccCvProgrammer programmer)
    {
        _module = module; _programmer = programmer;
        Text = "Descodificadors i programació CV · Quiral Control"; Width = 1120; Height = 820;
        StartPosition = FormStartPosition.CenterParent; MinimumSize = new Size(900, 650);
        _brand.DataSource = DecoderCatalog.Brands.ToList(); _brand.DisplayMember = nameof(DecoderBrand.Name);
        _brand.SelectedIndexChanged += (_, _) => LoadModels();
        _kind.Items.AddRange(new object[] { "Accessoris / sortides", "Locomotora / mòbil" }); _kind.SelectedIndex = 0;
        _protocol.Items.AddRange(new object[] { "DCC", "MM / MM2", "Märklin mfx", "Motorola" }); _protocol.SelectedIndex = 0;
        _model.SelectedIndexChanged += (_, _) => _customModel.Text = _model.SelectedItem?.ToString() == "Altres / model personalitzat" || _model.SelectedItem?.ToString() == "Model personalitzat" ? "" : _model.SelectedItem?.ToString() ?? "";
        _count.ValueChanged += (_, _) => BuildOutputs();
        _baseAddress.ValueChanged += (_, _) => RebaseOutputs();
        _cvMode.Items.AddRange(new object[] { "Assistit (fàcil)", "Expert" }); _cvMode.SelectedIndex = 0;
        _cvMode.SelectedIndexChanged += (_, _) => UpdateCvMode();
        _cvPreset.DataSource = DccCvCatalog.MobileDecoderBasics.ToList(); _cvPreset.DisplayMember = nameof(CvDefinition.Name);
        _cvPreset.SelectedIndexChanged += (_, _) => SelectCvPreset();
        _outputs.Columns.Add("Number", "Sortida"); _outputs.Columns.Add("Name", "Nom / funció");
        _outputs.Columns.Add("Address", "Adreça DCC"); _outputs.Columns.Add("Enabled", "Activa");
        _outputs.Columns["Number"]!.ReadOnly = true;
        var tabs = new TabControl { Dock = DockStyle.Fill };
        var config = new TabPage("Configuració de descodificadors");
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(12), ColumnCount = 4, RowCount = 9 };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 145)); layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 40));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 145)); layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 60));
        Add(layout, "Marca", _brand, 0, 0); Add(layout, "Model / sèrie", _model, 0, 2);
        Add(layout, "Referència exacta", _customModel, 1, 0, 3);
        Add(layout, "Tipus", _kind, 2, 0); Add(layout, "Protocol", _protocol, 2, 2);
        Add(layout, "Nombre de sortides", _count, 3, 0); Add(layout, "Adreça base", _baseAddress, 3, 2);
        layout.Controls.Add(new Label { Text = "Configura cada sortida de manera independent", AutoSize = true }, 0, 4); layout.SetColumnSpan(layout.GetControlFromPosition(0,4)!, 4);
        layout.Controls.Add(_outputs, 0, 5); layout.SetColumnSpan(_outputs, 4);
        var save = new Button { Text = "Desar configuració", AutoSize = true }; save.Click += async (_, _) => await SaveAsync();
        var refresh = new Button { Text = "Actualitzar llista", AutoSize = true }; refresh.Click += async (_, _) => await RefreshAsync();
        var actions = new FlowLayoutPanel { AutoSize = true }; actions.Controls.AddRange(new Control[] { save, refresh });
        layout.Controls.Add(actions, 0, 6); layout.SetColumnSpan(actions, 4);
        layout.Controls.Add(_saved, 0, 7); layout.SetColumnSpan(_saved, 4);
        layout.Controls.Add(_status, 0, 8); layout.SetColumnSpan(_status, 4);
        config.Controls.Add(layout);
        var cv = new TabPage("Programació de CV");
        var cvLayout = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = new Padding(16), AutoScroll = true };
        cvLayout.Controls.Add(new Label { Text = "Mode de programació", AutoSize = true }); cvLayout.Controls.Add(_cvMode);
        cvLayout.Controls.Add(new Label { Text = "CV habitual (només descodificadors mòbils DCC)", AutoSize = true }); cvLayout.Controls.Add(_cvPreset);
        cvLayout.Controls.Add(new Label { Text = "Número de CV", AutoSize = true }); cvLayout.Controls.Add(_cvNumber);
        cvLayout.Controls.Add(new Label { Text = "Valor (0–255)", AutoSize = true }); cvLayout.Controls.Add(_cvValue);
        cvLayout.Controls.Add(_cvInfo);
        var cvActions = new FlowLayoutPanel { AutoSize = true };
        var read = new Button { Text = "Llegir CV", AutoSize = true, Enabled = _programmer.IsAvailable }; read.Click += async (_, _) => await ReadCvAsync();
        var write = new Button { Text = "Escriure CV", AutoSize = true, Enabled = _programmer.IsAvailable }; write.Click += async (_, _) => await WriteCvAsync();
        cvActions.Controls.AddRange(new Control[] { read, write }); cvLayout.Controls.Add(cvActions);
        cvLayout.Controls.Add(new Label { Text = "Interfície: " + _programmer.ProviderName, AutoSize = true });
        if (!_programmer.IsAvailable) cvLayout.Controls.Add(new Label { Text = "Lectura/escriptura física desactivada: encara no hi ha un programador CV compatible connectat. No es simulen resultats.", AutoSize = true, ForeColor = Color.DarkOrange, MaximumSize = new Size(700,0) });
        cv.Controls.Add(cvLayout);
        tabs.TabPages.Add(config); tabs.TabPages.Add(cv); Controls.Add(tabs);
        Shown += async (_, _) => { LoadModels(); BuildOutputs(); UpdateCvMode(); await RefreshAsync(); };
    }
    private static void Add(TableLayoutPanel p, string label, Control c, int row, int col, int span = 1)
    {
        p.Controls.Add(new Label { Text = label, AutoSize = true, Anchor = AnchorStyles.Left, Padding = new Padding(3,7,3,3) }, col, row);
        p.Controls.Add(c, col + 1, row); if (span > 1) p.SetColumnSpan(c, span);
    }
    private void LoadModels()
    {
        if (_brand.SelectedItem is not DecoderBrand brand) return;
        _model.DataSource = brand.Models.ToList();
    }
    private void BuildOutputs()
    {
        var count = (int)_count.Value; var baseAddress = (int)_baseAddress.Value;
        _outputs.Rows.Clear();
        for (var i = 1; i <= count; i++) _outputs.Rows.Add(i, $"Sortida {i}", Math.Min(2048, baseAddress + i - 1), true);
    }
    private void RebaseOutputs()
    {
        if (_outputs.Rows.Count == 0) return;
        var baseAddress = (int)_baseAddress.Value;
        for (var i = 0; i < _outputs.Rows.Count; i++) _outputs.Rows[i].Cells["Address"].Value = Math.Min(2048, baseAddress + i);
    }
    private async Task SaveAsync()
    {
        try
        {
            if (_brand.SelectedItem is not DecoderBrand brand) throw new InvalidOperationException("Selecciona una marca.");
            var model = _customModel.Text.Trim();
            if (string.IsNullOrWhiteSpace(model)) model = _model.SelectedItem?.ToString() ?? "";
            if (string.IsNullOrWhiteSpace(model) || model.Contains("personalitzat", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Escriu la referència exacta del model.");
            var outputs = _outputs.Rows.Cast<DataGridViewRow>().Select(r => new DecoderOutput(
                Convert.ToInt32(r.Cells["Number"].Value), Convert.ToString(r.Cells["Name"].Value) ?? "",
                Convert.ToInt32(r.Cells["Address"].Value), Convert.ToString(r.Cells["Name"].Value) ?? "",
                Convert.ToBoolean(r.Cells["Enabled"].Value))).ToArray();
            await _module.SaveAsync(new DecoderConfiguration("", brand.Name, model, _kind.Text, (int)_count.Value,
                _protocol.Text, (int)_baseAddress.Value, outputs, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow));
            _status.Text = $"Configuració desada: {brand.Name} {model} · {outputs.Length} sortides independents.";
            await RefreshAsync();
        }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "Descodificadors", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
    }
    private async Task RefreshAsync()
    {
        var all = await _module.SnapshotAsync();
        _saved.DataSource = null; _saved.DataSource = all.Select(x => new { x.Brand, x.Model, x.DecoderKind, x.OutputCount, x.Protocol, x.BaseAddress }).ToList();
    }
    private void UpdateCvMode()
    {
        var easy = _cvMode.SelectedIndex == 0;
        _cvPreset.Enabled = easy; _cvInfo.Text = easy
            ? "Mode assistit: tria una funció per veure què modifica. Els valors depenen del fabricant i del model; consulta sempre el manual."
            : "Mode expert: introdueix directament el número de CV i el valor decimal (0–255). Algunes CV poden tenir rangs o significats específics del fabricant.";
    }
    private void SelectCvPreset()
    {
        if (_cvPreset.SelectedItem is not CvDefinition cv) return;
        _cvNumber.Value = cv.Number; _cvValue.Value = cv.SuggestedValue;
        _cvInfo.Text = $"CV{cv.Number} · {cv.Name}: {cv.Explanation} Rang admès per aquesta referència general: {cv.Minimum}–{cv.Maximum}. Verifica compatibilitat amb el manual del model.";
    }
    private async Task ReadCvAsync()
    {
        try { var value = await _programmer.ReadCvAsync((int)_cvNumber.Value); _cvValue.Value = Math.Clamp(value, 0, 255); _cvInfo.Text = $"Lectura confirmada: CV{_cvNumber.Value} = {value}."; }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "Lectura CV", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
    }
    private async Task WriteCvAsync()
    {
        try
        {
            if (MessageBox.Show(this, $"Vols escriure el valor {(int)_cvValue.Value} a CV{(int)_cvNumber.Value}?", "Confirmar escriptura CV", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
            await _programmer.WriteCvAsync((int)_cvNumber.Value, (int)_cvValue.Value);
            _cvInfo.Text = $"Escriptura confirmada pel programador: CV{_cvNumber.Value} = {_cvValue.Value}.";
        }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "Escriptura CV", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
    }
}
