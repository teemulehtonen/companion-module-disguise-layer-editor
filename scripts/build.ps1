param([switch]$TestOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$nodePathFile = Join-Path $projectRoot '.tools/node-path.txt'
if (Test-Path -LiteralPath $nodePathFile) {
    $nodeFolder = (Get-Content -LiteralPath $nodePathFile -Raw).Trim()
    $nodePath = if ([System.IO.Path]::IsPathRooted($nodeFolder)) { $nodeFolder } else { Join-Path (Join-Path $projectRoot '.tools') $nodeFolder }
} else {
    # Source archives can use an existing Node installation without setup.ps1.
    $installedNode = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $installedNode) { throw 'Run scripts/setup.ps1 first or install Node.js 22.22.0.' }
    $nodePath = Split-Path $installedNode.Source -Parent
}
$env:PATH = "$nodePath;$env:PATH"
Push-Location $projectRoot
try {
    & "$nodePath/npm.cmd" test
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }
    if (-not $TestOnly) {
        & "$nodePath/npm.cmd" run package
        if ($LASTEXITCODE -ne 0) { throw 'Module packaging failed.' }
        $moduleVersion = (Get-Content 'package.json' -Raw | ConvertFrom-Json).version
        Write-Host "Package ready: $projectRoot\disguise-layer-control-$moduleVersion.tgz"
    }
} finally { Pop-Location }
