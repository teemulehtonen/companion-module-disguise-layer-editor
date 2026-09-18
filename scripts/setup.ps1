param([string]$NodeVersion = '22.22.0')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$toolsPath = Join-Path $projectRoot '.tools'
$archiveName = "node-v$NodeVersion-win-x64.zip"
$nodePath = Join-Path $toolsPath "node-v$NodeVersion-win-x64"
New-Item -ItemType Directory -Force -Path $toolsPath | Out-Null
if (-not (Test-Path (Join-Path $nodePath 'node.exe'))) {
    $baseUrl = "https://nodejs.org/dist/v$NodeVersion"
    $archivePath = Join-Path $toolsPath $archiveName
    Write-Host "Downloading Node.js $NodeVersion..."
    Invoke-WebRequest "$baseUrl/$archiveName" -OutFile $archivePath -UseBasicParsing
    $checksums = (Invoke-WebRequest "$baseUrl/SHASUMS256.txt" -UseBasicParsing).Content
    $checksumLine = ($checksums -split "`n" | Where-Object { $_.Trim().EndsWith("  $archiveName") })
    if (-not $checksumLine) { throw 'Archive checksum not found.' }
    $expectedHash = ($checksumLine.Trim() -split '\s+')[0]
    if ((Get-FileHash $archivePath -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Node.js checksum mismatch.' }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $toolsPath -Force
}
Set-Content -LiteralPath (Join-Path $toolsPath 'node-path.txt') -Value "node-v$NodeVersion-win-x64"
$env:PATH = "$nodePath;$env:PATH"
Push-Location $projectRoot
try {
    if (Test-Path 'package-lock.json') { & "$nodePath/npm.cmd" ci --no-audit --no-fund }
    else { & "$nodePath/npm.cmd" install --no-audit --no-fund }
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
} finally { Pop-Location }
& (Join-Path $PSScriptRoot 'create-shortcuts.ps1')
Write-Host 'Ready. Build with: powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1'
