# Isolated GitHub Windows runner only. The upload MSIX remains unsigned.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$inputDir = Join-Path $root 'dist-packages/microsoft-store/input'
$proof = Join-Path $root 'dist-packages/microsoft-store/proof'
New-Item -ItemType Directory -Path $proof -Force | Out-Null
$msix = Get-ChildItem "$inputDir/*.msix" | Select-Object -First 1
if (-not $msix) { throw 'No MSIX artifact' }
$expected = ((Get-Content "$inputDir/SHA256SUMS.txt").Trim() -split '\s+')[0]
if ((Get-FileHash $msix.FullName -Algorithm SHA256).Hash.ToLower() -ne $expected) { throw 'Artifact SHA256 mismatch' }
$cert = New-SelfSignedCertificate -Type Custom -Subject 'CN=5FE78193-5A43-4768-8FA9-0207BF80006C' -KeyUsage DigitalSignature -FriendlyName 'Motungi ephemeral CI test only' -CertStoreLocation Cert:\CurrentUser\My -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3','2.5.29.19={text}')
$copy = Join-Path $env:RUNNER_TEMP 'motungi-ci-test.msix'
Copy-Item $msix.FullName $copy
$signTool = Get-ChildItem "${env:ProgramFiles(x86)}/Windows Kits/10/bin/*/x64/signtool.exe" | Sort-Object FullName -Descending | Select-Object -First 1
& $signTool.FullName sign /fd SHA256 /sha1 $cert.Thumbprint $copy
if ($LASTEXITCODE -ne 0) { throw 'CI test signing failed' }
$publicCert = Join-Path $env:RUNNER_TEMP 'motungi-ci-test.cer'
Export-Certificate -Cert $cert -FilePath $publicCert | Out-Null
Import-Certificate -FilePath $publicCert -CertStoreLocation Cert:\LocalMachine\TrustedPeople | Out-Null
try {
 Add-AppxPackage -Path $copy
 $pkg = Get-AppxPackage -Name 'EA466DAE.395942762A201'
 if (-not $pkg -or $pkg.PackageFamilyName -ne 'EA466DAE.395942762A201_46m7zv2hp1s6j') { throw 'Installed package identity mismatch' }
 Start-Process explorer.exe "shell:AppsFolder\$($pkg.PackageFamilyName)!MotungiRadio"
 Add-Type -AssemblyName System.Drawing
 Add-Type @'
using System;
using System.Runtime.InteropServices;
public class MotungiCapture {
 public delegate bool EnumProc(IntPtr hwnd,IntPtr data);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback,IntPtr data);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint id);
 public static IntPtr FindWindow(uint process) { IntPtr result=IntPtr.Zero; EnumWindows((h,d)=>{uint id; GetWindowThreadProcessId(h,out id); if(id==process && IsWindowVisible(h)) {result=h; return false;} return true;},IntPtr.Zero);return result;}
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd,out RECT rect);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd,IntPtr hdc,uint flags);
}
'@
 $process = $null
 $window = [IntPtr]::Zero
 for ($i=0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 500
  $process = Get-Process -Name motungi-radio -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq (Join-Path $pkg.InstallLocation 'motungi-radio.exe') } | Select-Object -First 1
  if ($process) { $window = [MotungiCapture]::FindWindow($process.Id); if ($window -ne [IntPtr]::Zero) { break } }
 }
 if (-not $process -or $window -eq [IntPtr]::Zero) { throw 'Packaged app did not show a window' }
 Start-Sleep -Seconds 3
 $rect = New-Object MotungiCapture+RECT
 [MotungiCapture]::GetWindowRect($window,[ref]$rect) | Out-Null
 $image = New-Object Drawing.Bitmap(($rect.Right-$rect.Left),($rect.Bottom-$rect.Top))
 $graphics = [Drawing.Graphics]::FromImage($image)
 $hdc=$graphics.GetHdc()
 try { if (-not [MotungiCapture]::PrintWindow($window,$hdc,2)) { throw 'Window capture failed' } }
 finally { $graphics.ReleaseHdc($hdc); $graphics.Dispose() }
 try { $image.Save("$proof/windows-onboarding.png",[Drawing.Imaging.ImageFormat]::Png) } finally { $image.Dispose() }
 @("Source workflow run: $env:SOURCE_RUN", "Installed identity: $($pkg.PackageFullName)", "MSIX SHA256: $expected", 'Installed and launched. Audio, login, sleep and upgrade not verified.') | Set-Content "$proof/verification.txt" -Encoding utf8
} finally {
 Get-Process -Name motungi-radio -ErrorAction SilentlyContinue | Stop-Process -Force
 Get-AppxPackage -Name 'EA466DAE.395942762A201' | Remove-AppxPackage
 Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -ErrorAction SilentlyContinue
 Remove-Item "Cert:\LocalMachine\TrustedPeople\$($cert.Thumbprint)" -ErrorAction SilentlyContinue
}
