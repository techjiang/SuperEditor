# 生成 Windows 桌面版交付物：
#   desktop-release/win-unpacked/SuperEditor.exe   免安装应用（直接双击运行）
#   desktop-release/SuperEditor-Setup-<ver>.exe    NSIS 安装包
#
# 本环境的安全策略会拦截所有删除/回收站操作，electron-builder 常规流程
# 在清理 Electron 自带 resources 时会失败。因此先手动组装一份完整应用
# （Electron 运行时 + resources/app.asar），再用 --prepackaged 交给
# electron-builder 生成安装包 —— 该模式不复制 Electron、不触发删除。
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stage = Join-Path $root 'pkg-stage'
$out = Join-Path $root 'desktop-release'
$stamp = Get-Date -Format 'yyyyMMddHHmmss'

Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessName -eq 'SuperEditor' -or $_.ProcessName -eq 'electron' } |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# 移走旧目录（rename 不触发删除策略）
if (Test-Path $out) { Rename-Item $out (Join-Path $root "desktop-release-old-$stamp") -ErrorAction SilentlyContinue }
if (Test-Path $stage) { Rename-Item $stage (Join-Path $root "pkg-stage-old-$stamp") -ErrorAction SilentlyContinue }

# 1) 完整复制 Electron 运行时
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item (Join-Path $root 'node_modules/electron/dist/*') $stage -Recurse -Force
$exeSrc = Join-Path $stage 'electron.exe'
$exeDst = Join-Path $stage 'SuperEditor.exe'
if (Test-Path $exeSrc) { Copy-Item $exeSrc $exeDst -Force }

# 2) 把前端产物 + 主进程代码打包进 resources/app.asar
$appSrc = Join-Path $root "pkg-appsrc-$stamp"
New-Item -ItemType Directory -Force $appSrc | Out-Null
Copy-Item (Join-Path $root 'dist') (Join-Path $appSrc 'dist') -Recurse -Force
Copy-Item (Join-Path $root 'desktop') (Join-Path $appSrc 'desktop') -Recurse -Force
Copy-Item (Join-Path $root 'public') (Join-Path $appSrc 'public') -Recurse -Force
Copy-Item (Join-Path $root 'package.json') (Join-Path $appSrc 'package.json') -Force
$asarCli = Join-Path $root 'node_modules/asar/bin/asar.js'
if (Test-Path $asarCli) { node $asarCli pack $appSrc (Join-Path $stage 'resources/app.asar') }
else { npx --yes asar pack $appSrc (Join-Path $stage 'resources/app.asar') }

# 3) 生成 NSIS 安装包（失败也不影响免安装目录）
try { npx electron-builder --win --prepackaged $stage }
catch { Write-Warning "NSIS 生成失败：$($_.Exception.Message)" }

# 4) 免安装目录始终以手动组装的完整内容为准
$wd = Join-Path $out 'win-unpacked'
if (-not (Test-Path $wd)) { New-Item -ItemType Directory -Force $wd | Out-Null }
Copy-Item (Join-Path $stage '*') $wd -Recurse -Force

Write-Output "EXE: $(Join-Path $wd 'SuperEditor.exe')"

$version = (Get-Content (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version

# 5) Portable build: a clean zip, no installer, no registry changes
$portableRoot = Join-Path $root "portable-stage-$stamp"
$portableApp = Join-Path $portableRoot 'SuperEditor'
New-Item -ItemType Directory -Force $portableApp | Out-Null
Get-ChildItem $stage -Force |
  Where-Object { $_.Name -notin @('electron.exe', 'electron-bak.exe', 'app-src') } |
  ForEach-Object { Copy-Item $_.FullName $portableApp -Recurse -Force }
$zip = Join-Path $out "SuperEditor-Portable-$version.zip"
if (Get-Command tar.exe -ErrorAction SilentlyContinue) {
  & tar.exe -a -cf $zip -C $portableRoot 'SuperEditor'
} else {
  Compress-Archive -Path $portableApp -DestinationPath $zip -CompressionLevel Optimal -Force
}
Write-Output "PORTABLE: $zip ($((Get-Item $zip).Length) bytes)"

# 6) Checksums for the release assets
$setup = Get-ChildItem $out -Filter 'SuperEditor-Setup-*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($setup) {
  Write-Output "SETUP: $($setup.FullName) ($($setup.Length) bytes)"
  $lines = @()
  foreach ($f in @($setup, (Get-Item $zip))) {
    $hash = (Get-FileHash $f.FullName -Algorithm SHA256).Hash.ToLower()
    $lines += "$hash  $($f.Name)"
  }
  [System.IO.File]::WriteAllText((Join-Path $out 'SHA256SUMS.txt'), ($lines -join "`n") + "`n", [System.Text.UTF8Encoding]::new($false))
  Write-Output "CHECKSUMS: $(Join-Path $out 'SHA256SUMS.txt')"
}
