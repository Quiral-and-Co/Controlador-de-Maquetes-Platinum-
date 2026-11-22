using System.Drawing;
using System.Windows.Forms;
using Quiral.ControladorMaquetes.Projects;
using Quiral.ControladorMaquetes.Geometry;
using Quiral.ControladorMaquetes.RollingStock;
using Quiral.ControladorMaquetes.Maerklin;

namespace Quiral.ControladorMaquetes.Modules;

internal static class FormLayout
{
    public static NumericUpDown Number(decimal value, decimal min=-100000, decimal max=100000, int decimals=1)
        => new() { Minimum=min, Maximum=max, Value=value, DecimalPlaces=decimals, Width=110 };
    public static void AddRow(TableLayoutPanel panel,string label,Control control,int row)
    {
        panel.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        panel.Controls.Add(new Label { Text=label, AutoSize=true, Anchor=AnchorStyles.Left, Padding=new Padding(4,8,8,4) },0,row);
        panel.Controls.Add(control,1,row);
    }
}

public sealed class ProjectManagerForm : Form
{
    private readonly ProjectModule _module;
    private readonly TextBox _name=new() { Width=220, Text="Nova maqueta" };
    private readonly NumericUpDown _width=FormLayout.Number(3000,1,100000,0);
    private readonly NumericUpDown _height=FormLayout.Number(1800,1,100000,0);
    private readonly NumericUpDown _levels=FormLayout.Number(5,1,20,0);
    private readonly NumericUpDown _spacing=FormLayout.Number(110,0,10000,0);
    private readonly ListBox _projects=new() { Dock=DockStyle.Fill };
    private readonly Label _status=new() { AutoSize=true };
    public ProjectManagerForm(ProjectModule module)
    {
        _module=module; Text="Gestió de projectes · Quiral Control"; Width=720; Height=540; StartPosition=FormStartPosition.CenterParent;
        var root=new TableLayoutPanel { Dock=DockStyle.Fill, Padding=new Padding(12), ColumnCount=2, RowCount=8 };
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,180)); root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
        FormLayout.AddRow(root,"Nom del projecte",_name,0); FormLayout.AddRow(root,"Amplada (mm)",_width,1);
        FormLayout.AddRow(root,"Alçada (mm)",_height,2); FormLayout.AddRow(root,"Nombre de nivells",_levels,3);
        FormLayout.AddRow(root,"Separació vertical (mm)",_spacing,4);
        var buttons=new FlowLayoutPanel { AutoSize=true };
        var create=new Button { Text="Crear projecte", AutoSize=true }; create.Click+=async (_,_)=>await CreateProjectAsync();
        var open=new Button { Text="Obrir seleccionat", AutoSize=true }; open.Click+=async (_,_)=>await OpenProjectAsync();
        var refresh=new Button { Text="Actualitzar", AutoSize=true }; refresh.Click+=async (_,_)=>await RefreshAsync();
        buttons.Controls.AddRange(new Control[]{create,open,refresh});
        root.Controls.Add(buttons,0,5); root.SetColumnSpan(buttons,2);
        root.Controls.Add(_projects,0,6); root.SetColumnSpan(_projects,2);
        root.Controls.Add(_status,0,7); root.SetColumnSpan(_status,2);
        Controls.Add(root); Shown+=async (_,_)=>await RefreshAsync();
    }
    private async Task CreateProjectAsync()
    {
        try { var p=await _module.CreateAsync(_name.Text,(double)_width.Value,(double)_height.Value,(int)_levels.Value,(double)_spacing.Value);
            _status.Text=$"Creat: {p.Name} · {p.Levels.Count} nivells"; await RefreshAsync(); }
        catch(Exception ex) { MessageBox.Show(this,ex.Message,"Error de projecte",MessageBoxButtons.OK,MessageBoxIcon.Warning); }
    }
    private async Task OpenProjectAsync()
    {
        if(_projects.SelectedItem is not RailwayProject p) return;
        _status.Text=await _module.OpenAsync(p.Id)?"Projecte actiu: "+p.Name:"No s'ha pogut obrir el projecte.";
    }
    private async Task RefreshAsync()
    {
        _projects.DataSource=null; _projects.DataSource=(await _module.ListAsync()).ToList();
        _projects.DisplayMember=nameof(RailwayProject.Name);
    }
}

public sealed class GeometryWorkbenchForm : Form
{
    private readonly RailwayGeometryModule _module;
    private readonly NumericUpDown[] _xyz=Enumerable.Range(0,6).Select(_=>FormLayout.Number(0)).ToArray();
    private readonly ListBox _segments=new() { Dock=DockStyle.Fill };
    private readonly Label _status=new() { AutoSize=true };
    public GeometryWorkbenchForm(RailwayGeometryModule module)
    {
        _module=module; Text="Geometria ferroviària XYZ · Quiral Control"; Width=850; Height=560; StartPosition=FormStartPosition.CenterParent;
        var root=new TableLayoutPanel { Dock=DockStyle.Fill, Padding=new Padding(12), ColumnCount=2 };
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,190)); root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
        string[] labels={"X inicial (mm)","Y inicial (mm)","Z inicial (mm)","X final (mm)","Y final (mm)","Z final (mm)"};
        for(int i=0;i<labels.Length;i++) FormLayout.AddRow(root,labels[i],_xyz[i],i);
        var add=new Button { Text="Afegir tram",AutoSize=true }; add.Click+=(_,_)=>AddSegment();
        root.Controls.Add(add,0,6); root.SetColumnSpan(add,2);
        root.Controls.Add(_segments,0,7); root.SetColumnSpan(_segments,2);
        root.Controls.Add(_status,0,8); root.SetColumnSpan(_status,2);
        Controls.Add(root); RefreshSegments();
    }
    private void AddSegment()
    {
        try
        {
            var a=new Point3((double)_xyz[0].Value,(double)_xyz[1].Value,(double)_xyz[2].Value);
            var b=new Point3((double)_xyz[3].Value,(double)_xyz[4].Value,(double)_xyz[5].Value);
            var segment=_module.AddSegment(a,b);
            _status.Text=$"Longitud: {RailwayGeometryModule.Distance(a,b):F1} mm · Pendent: {RailwayGeometryModule.GradePercent(a,b):F2}%";
            RefreshSegments();
        }
        catch(Exception ex) { MessageBox.Show(this,ex.Message,"Geometria invàlida",MessageBoxButtons.OK,MessageBoxIcon.Warning); }
    }
    private void RefreshSegments() { _segments.DataSource=null; _segments.DataSource=_module.Segments.Select(x=>$"{x.Id[..8]}  ({x.Start.X:F1},{x.Start.Y:F1},{x.Start.Z:F1}) → ({x.End.X:F1},{x.End.Y:F1},{x.End.Z:F1})").ToList(); }
}

public sealed class RollingStockForm : Form
{
    private readonly RollingStockModule _module;
    private readonly ComboBox _kind=new() { DropDownStyle=ComboBoxStyle.DropDownList,Width=200 };
    private readonly TextBox _manufacturer=new() { Text="Märklin",Width=200 };
    private readonly TextBox _reference=new() { Width=200 };
    private readonly TextBox _name=new() { Width=300 };
    private readonly TextBox _search=new() { Width=220 };
    private readonly ListBox _items=new() { Dock=DockStyle.Fill };
    private readonly Label _status=new() { AutoSize=true };
    public RollingStockForm(RollingStockModule module)
    {
        _module=module; Text="Gestió de material mòbil · Quiral Control"; Width=820; Height=580; StartPosition=FormStartPosition.CenterParent;
        _kind.DataSource=Enum.GetValues<RollingStockKind>();
        var root=new TableLayoutPanel { Dock=DockStyle.Fill,Padding=new Padding(12),ColumnCount=2 };
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,180)); root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
        FormLayout.AddRow(root,"Tipus",_kind,0); FormLayout.AddRow(root,"Fabricant",_manufacturer,1);
        FormLayout.AddRow(root,"Referència",_reference,2); FormLayout.AddRow(root,"Nom",_name,3);
        var add=new Button { Text="Afegir a l'inventari",AutoSize=true }; add.Click+=async (_,_)=>await AddAsync();
        root.Controls.Add(add,0,4); root.SetColumnSpan(add,2);
        FormLayout.AddRow(root,"Cercar",_search,5);
        _search.TextChanged+=async (_,_)=>await RefreshAsync();
        root.Controls.Add(_items,0,6); root.SetColumnSpan(_items,2);
        root.Controls.Add(_status,0,7); root.SetColumnSpan(_status,2);
        Controls.Add(root); Shown+=async (_,_)=>await RefreshAsync();
    }
    private async Task AddAsync()
    {
        try
        {
            var now=DateTimeOffset.UtcNow;
            await _module.AddAsync(new RollingStockItem("",(RollingStockKind)_kind.SelectedItem!,_manufacturer.Text,_reference.Text,
                _name.Text,"H0","","",null,DigitalProtocol.None,null,Array.Empty<string>(),null,"",now,now));
            _status.Text="Material afegit correctament."; await RefreshAsync();
        }
        catch(Exception ex) { MessageBox.Show(this,ex.Message,"Inventari",MessageBoxButtons.OK,MessageBoxIcon.Warning); }
    }
    private async Task RefreshAsync()
    {
        var found=await _module.SearchAsync(_search.Text);
        _items.DataSource=null; _items.DataSource=found.Select(x=>$"{x.Manufacturer} · {x.Reference} · {x.Name} ({x.Kind})").ToList();
    }
}

public sealed class Cs2ConnectionForm : Form
{
    private readonly Cs2TcpController _controller;
    private readonly TextBox _host=new() { Width=180,Text="192.168.1.100" };
    private readonly NumericUpDown _port=FormLayout.Number(15731,1,65535,0);
    private readonly NumericUpDown _device=FormLayout.Number(1,0,65535,0);
    private readonly NumericUpDown _contact=FormLayout.Number(1,1,65535,0);
    private readonly NumericUpDown _module=FormLayout.Number(1,1,255,0);
    private readonly ListBox _log=new() { Dock=DockStyle.Fill };
    private readonly Label _status=new() { AutoSize=true,Text="Desconnectada" };
    public Cs2ConnectionForm(Cs2TcpController controller)
    {
        _controller=controller; Text="Märklin CS2 60215 · mCAN / S88"; Width=760; Height=540; StartPosition=FormStartPosition.CenterParent;
        _controller.S88ContactChanged+=OnContact; _controller.S88ModuleRead+=OnModule; _controller.Diagnostic+=OnDiagnostic;
        var root=new TableLayoutPanel { Dock=DockStyle.Fill,Padding=new Padding(12),ColumnCount=2 };
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,180)); root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
        FormLayout.AddRow(root,"Adreça IP / host",_host,0); FormLayout.AddRow(root,"Port TCP",_port,1);
        var connect=new Button { Text="Connectar",AutoSize=true }; connect.Click+=async (_,_)=>await ConnectAsync();
        var disconnect=new Button { Text="Desconnectar",AutoSize=true }; disconnect.Click+=async (_,_)=>await _controller.DisconnectAsync();
        var buttons=new FlowLayoutPanel { AutoSize=true }; buttons.Controls.AddRange(new Control[]{connect,disconnect});
        root.Controls.Add(buttons,0,2); root.SetColumnSpan(buttons,2);
        FormLayout.AddRow(root,"ID dispositiu S88",_device,3); FormLayout.AddRow(root,"Contacte S88",_contact,4);
        var subscribe=new Button { Text="Subscriure contacte",AutoSize=true }; subscribe.Click+=async (_,_)=>await SubscribeAsync();
        var poll=new Button { Text="Consultar mòdul (legacy)",AutoSize=true }; poll.Click+=async (_,_)=>await PollAsync();
        var feedbackButtons=new FlowLayoutPanel { AutoSize=true }; feedbackButtons.Controls.AddRange(new Control[]{subscribe,poll});
        root.Controls.Add(feedbackButtons,0,5); root.SetColumnSpan(feedbackButtons,2);
        FormLayout.AddRow(root,"Mòdul S88",_module,6);
        root.Controls.Add(_status,0,7); root.SetColumnSpan(_status,2);
        root.Controls.Add(_log,0,8); root.SetColumnSpan(_log,2);
        Controls.Add(root);
        FormClosed+=async (_,_)=>{ _controller.S88ContactChanged-=OnContact; _controller.S88ModuleRead-=OnModule; _controller.Diagnostic-=OnDiagnostic; await _controller.DisconnectAsync(); };
    }
    private async Task ConnectAsync()
    {
        try { await _controller.ConnectAsync(_host.Text,(int)_port.Value); _status.Text="Connectada · "+_host.Text; }
        catch(Exception ex) { _status.Text="Error de connexió"; Log(ex.Message); }
    }
    private async Task SubscribeAsync()
    {
        try { await _controller.SubscribeS88ContactAsync((ushort)_device.Value,(ushort)_contact.Value); Log("Subscripció S88 sol·licitada."); }
        catch(Exception ex) { Log(ex.Message); }
    }
    private async Task PollAsync()
    {
        try { await _controller.PollS88ModuleAsync((byte)_module.Value); Log("Consulta S88 legacy enviada."); }
        catch(Exception ex) { Log(ex.Message); }
    }
    private void OnContact(S88ContactEvent e)=>BeginInvoke(new Action(()=>Log($"S88 {e.DeviceId}:{e.ContactNumber} {(e.IsOccupied?"OCUPAT":"LLIURE")}")));
    private void OnModule(S88ModuleSnapshot e)=>BeginInvoke(new Action(()=>Log($"Mòdul {e.ModuleNumber}: 0x{e.ContactBits:X4}")));
    private void OnDiagnostic(string e)=>BeginInvoke(new Action(()=>Log(e)));
    private void Log(string value) { if(!IsDisposed) _log.Items.Insert(0,$"{DateTime.Now:HH:mm:ss}  {value}"); }
}
