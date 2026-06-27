# Parsea Registro-Pasaporte.docx -> scripts/data/participantes-2026.json
# Extrae las 2 tablas, infiere genero por nombre y deriva nivel escolar.

$ErrorActionPreference = "Stop"
$src = "$env:USERPROFILE\Downloads\Registro-Pasaporte.docx"
$tmp = Join-Path $env:TEMP ("docx_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($src, $tmp)

[xml]$xml = Get-Content (Join-Path $tmp "word\document.xml") -Raw -Encoding UTF8
$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")

# Nombres femeninos (primer token) presentes en este registro
$fem = @(
  "ruby","valeria","vanessa","fabiola","lucero","arroyo","maite","victoria","ingrid",
  "sofia","sofía","evelin","romina","eva","cecilia","cinthia","thesy","valentina",
  "mabel","elizabeth","alessandra","maxima","máxima","natalia","renata","camila","lucia","lucía",
  "isabella","mia","mía","emma"
) | ForEach-Object { $_.ToLower() }

function Get-Genero($nombre) {
  $first = ($nombre.Trim() -split "\s+")[0].ToLower()
  if ($fem -contains $first) { return "FEMENINO" }
  return "MASCULINO"
}

function Get-Nivel($grado, $escuela, $edad) {
  $t = ("$grado $escuela").ToLower()
  if ($t -match "no va a escuela|no asiste") { return "SIN_ESCUELA" }
  if ($t -match "preescolar|kinder|preesc") { return "PREESCOLAR" }
  if ($t -match "semestre|prepa|cecyte|bachill|media superior") { return "MEDIA_SUPERIOR" }
  if ($t -match "secundaria|sec\.|secund|esc\. sec") { return "SECUNDARIA" }
  if ($t -match "primaria|grado|°|º") {
    if ($edad -ge 12) { return "SECUNDARIA" }
    return "PRIMARIA"
  }
  # fallback por edad
  if ($edad -lt 6) { return "PREESCOLAR" }
  if ($edad -le 11) { return "PRIMARIA" }
  if ($edad -le 14) { return "SECUNDARIA" }
  return "MEDIA_SUPERIOR"
}

$result = New-Object System.Collections.ArrayList
$tablas = $xml.SelectNodes("//w:tbl", $ns)
$ti = 0
foreach ($t in $tablas) {
  $primeraFila = $true
  foreach ($row in $t.SelectNodes("w:tr", $ns)) {
    $cells = @()
    foreach ($c in $row.SelectNodes("w:tc", $ns)) {
      $txt = ($c.SelectNodes(".//w:t", $ns) | ForEach-Object { $_.InnerText }) -join ""
      $cells += $txt.Trim()
    }
    # Tabla 0 tiene encabezado; tabla 1 no
    if ($ti -eq 0 -and $primeraFila) { $primeraFila = $false; continue }
    if ($cells.Count -lt 5) { continue }
    if ([string]::IsNullOrWhiteSpace($cells[0])) { continue }
    $edad = 0; [int]::TryParse(($cells[2] -replace "[^\d]", ""), [ref]$edad) | Out-Null
    $escuela = $cells[4]
    if ($escuela -eq "-" -or [string]::IsNullOrWhiteSpace($escuela)) { $escuela = "Sin escuela" }
    $obj = [ordered]@{
      nombre        = $cells[0].Trim()
      apellidos     = $cells[1].Trim()
      edad          = $edad
      grado         = $cells[3].Trim()
      escuela       = $escuela
      correo        = if ($cells.Count -gt 5) { $cells[5].Trim() } else { "" }
      telefono      = if ($cells.Count -gt 6) { $cells[6].Trim() } else { "" }
      ciudad        = if ($cells.Count -gt 7 -and $cells[7].Trim()) { $cells[7].Trim() } else { "Mérida" }
      participacion = if ($cells.Count -gt 8 -and $cells[8].Trim()) { $cells[8].Trim() } else { "Presencial" }
      genero        = Get-Genero $cells[0]
      nivel         = Get-Nivel $cells[3] $escuela $edad
      grupo         = $ti  # 0 = primer grupo/registrante, 1 = registros individuales
    }
    [void]$result.Add($obj)
  }
  $ti++
}

$outDir = "scripts\data"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$json = $result | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Resolve-Path $outDir).Path + "\participantes-2026.json", $json, (New-Object System.Text.UTF8Encoding($false)))

Remove-Item $tmp -Recurse -Force
Write-Output "Participantes extraidos: $($result.Count)"
$fcount = ($result | Where-Object { $_.genero -eq "FEMENINO" }).Count
Write-Output "  Femenino: $fcount | Masculino: $($result.Count - $fcount)"
Write-Output "Niveles:"
$result | Group-Object nivel | Sort-Object Count -Descending | ForEach-Object { Write-Output "  $($_.Name): $($_.Count)" }