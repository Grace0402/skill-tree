param(
  [string]$AppDir = "release\win-unpacked",
  [string]$Icon = "build\icon.ico"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$appDir = Join-Path $root $AppDir
$iconPath = Join-Path $root $Icon
$appExe = Join-Path $appDir "SkillTree-app.exe"
$launcherExe = Join-Path $appDir "SkillTree.exe"
$source = Join-Path $root "build\launcher.cs"

if (-not (Test-Path $appDir)) { throw "找不到打包目录：$appDir" }
if (-not (Test-Path $appExe)) {
  if (-not (Test-Path $launcherExe)) { throw "找不到 SkillTree.exe" }
  Move-Item -LiteralPath $launcherExe -Destination $appExe -Force
  Write-Host "已把 Electron 主程序重命名为 SkillTree-app.exe"
}

$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) {
  $csc = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}
if (-not (Test-Path $csc)) { throw "找不到 .NET Framework 的 csc.exe" }

& $csc /nologo /target:winexe /optimize+ /codepage:65001 `
  "/out:$launcherExe" `
  "/win32icon:$iconPath" `
  /reference:System.Windows.Forms.dll `
  $source

if ($LASTEXITCODE -ne 0) { throw "启动器编译失败，退出码 $LASTEXITCODE" }
Write-Host "启动器已生成：$launcherExe"
