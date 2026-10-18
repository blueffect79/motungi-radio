$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$package = Get-Content package.json -Raw | ConvertFrom-Json
$version = "$($package.version).0"
$stage = Join-Path $root 'dist-packages/microsoft-store/stage'
$out = Join-Path $root 'dist-packages/microsoft-store/output'
if ((Test-Path $stage) -or (Test-Path $out)) { throw 'MSIX output must be empty' }
New-Item -ItemType Directory -Path "$stage/Assets", $out -Force | Out-Null
$exe = Join-Path $root 'src-tauri/target-microsoft-store/x86_64-pc-windows-msvc/release/motungi-radio.exe'
node scripts/check-msix.mjs --exe $exe
if ($LASTEXITCODE -ne 0) { throw 'Invalid Windows x64 binary' }
Copy-Item $exe "$stage/motungi-radio.exe"
rustc --edition 2021 -O --target x86_64-pc-windows-msvc packaging/microsoft-store/startup.rs -o "$stage/motungi-startup.exe"
if ($LASTEXITCODE -ne 0) { throw 'Startup helper compilation failed' }
[xml]$manifest = Get-Content packaging/microsoft-store/AppxManifest.xml
$manifest.Package.Identity.Version = $version
$manifest.Save("$stage/AppxManifest.xml")
Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Image]::FromFile("$root/src-tauri/icons/icon.png")
try {
 foreach ($item in @(@('StoreLogo',50),@('Square44x44Logo',44),@('Square150x150Logo',150))) {
  $bitmap = New-Object System.Drawing.Bitmap($item[1],$item[1])
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try { $graphics.InterpolationMode = 'HighQualityBicubic'; $graphics.DrawImage($source,0,0,$item[1],$item[1]); $bitmap.Save("$stage/Assets/$($item[0]).png",[System.Drawing.Imaging.ImageFormat]::Png) }
  finally { $graphics.Dispose(); $bitmap.Dispose() }
 }
} finally { $source.Dispose() }
$sdk = Get-ChildItem "${env:ProgramFiles(x86)}/Windows Kits/10/bin/*/x64/makeappx.exe" | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $sdk) { throw 'Windows SDK MakeAppx not found' }
$file = Join-Path $out "motungi-radio-$($package.version)-windows-store-x64.msix"
& $sdk.FullName pack /d $stage /p $file /o
if ($LASTEXITCODE -ne 0) { throw 'MakeAppx validation failed' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($file)
try {
 $names = @($zip.Entries.FullName)
 foreach ($name in @('motungi-radio.exe','motungi-startup.exe','AppxManifest.xml','Assets/StoreLogo.png','Assets/Square44x44Logo.png','Assets/Square150x150Logo.png')) {
  if ($names -notcontains $name) { throw "Missing MSIX file: $name" }
 }
 if ($names -contains 'AppxSignature.p7x') { throw 'Store upload should not contain a test certificate' }
} finally { $zip.Dispose() }
Get-FileHash $file -Algorithm SHA256 | ForEach-Object { "$($_.Hash.ToLower())  $(Split-Path $_.Path -Leaf)" } | Set-Content "$out/SHA256SUMS.txt" -Encoding ascii
Copy-Item "$stage/AppxManifest.xml" $out
Write-Host 'Unsigned Store submission package created. Microsoft signs accepted Store packages.'
