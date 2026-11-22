param(
    [Parameter(Mandatory=$true)][ValidateSet('Backup','Restore')][string]$Action,
    [Parameter(Mandatory=$true)][string]$DataDirectory,
    [Parameter(Mandatory=$true)][string]$BackupFile
)
$ErrorActionPreference = 'Stop'
try {
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $data = [IO.Path]::GetFullPath($DataDirectory)
    $backup = [IO.Path]::GetFullPath($BackupFile)
    if ($Action -eq 'Backup') {
        if (-not (Test-Path -LiteralPath $data -PathType Container)) { exit 0 }
        if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force }
        [IO.Compression.ZipFile]::CreateFromDirectory($data, $backup, [IO.Compression.CompressionLevel]::Optimal, $true)
        if (-not (Test-Path -LiteralPath $backup -PathType Leaf) -or (Get-Item -LiteralPath $backup).Length -le 0) {
            throw 'La còpia de seguretat no s''ha creat correctament.'
        }
        $archive = [IO.Compression.ZipFile]::OpenRead($backup)
        try { if ($archive.Entries.Count -eq 0) { throw 'La còpia de seguretat és buida.' } }
        finally { $archive.Dispose() }
        exit 0
    }
    if (-not (Test-Path -LiteralPath $backup -PathType Leaf)) { exit 0 }
    New-Item -ItemType Directory -Force -Path $data | Out-Null
    $root = $data.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $archive = [IO.Compression.ZipFile]::OpenRead($backup)
    try {
        foreach ($entry in $archive.Entries) {
            $destination = [IO.Path]::GetFullPath((Join-Path $data $entry.FullName))
            if (-not $destination.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
                throw 'L''arxiu conté una ruta no vàlida.'
            }
            if ([string]::IsNullOrEmpty($entry.Name)) {
                New-Item -ItemType Directory -Force -Path $destination | Out-Null
                continue
            }
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
            $input = $entry.Open()
            try {
                $output = [IO.File]::Open($destination, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::None)
                try { $input.CopyTo($output) } finally { $output.Dispose() }
            } finally { $input.Dispose() }
        }
    } finally { $archive.Dispose() }
    if (-not (Test-Path -LiteralPath $data -PathType Container)) { throw 'No s’ha pogut restaurar el directori de dades.' }
    exit 0
}
catch {
    Write-Error $_
    exit 1
}
