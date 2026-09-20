param([switch]$Force)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
if ($version -notmatch '^0\.1\.0-beta\.\d+$') { throw 'Invalid beta version.' }
$releaseName = '0.1.beta'
$releaseRoot = Join-Path $projectRoot 'releases'
$destination = Join-Path $releaseRoot $releaseName
$staging = Join-Path $projectRoot '.tools/release-staging/0.1.beta'

function Remove-CheckedDirectory([string]$Target, [string]$Parent) {
    $resolved = [IO.Path]::GetFullPath($Target)
    $allowed = [IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($allowed, [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe cleanup target: $resolved" }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}

if ((Test-Path -LiteralPath $destination) -and -not $Force) { throw "Release already exists: $destination. Use -Force to rebuild it." }
# Verify before replacing a previous local release.
Push-Location $projectRoot
try {
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }
    & npm.cmd run package
    if ($LASTEXITCODE -ne 0) { throw 'Module packaging failed.' }
} finally { Pop-Location }
Remove-CheckedDirectory $staging (Join-Path $projectRoot '.tools/release-staging')
New-Item -ItemType Directory -Force -Path $staging | Out-Null
$source = Join-Path $staging 'source'
New-Item -ItemType Directory -Path $source | Out-Null

# Explicit allowlist prevents local project data and probes from entering releases.
$sourceFiles = @(
    'package.json','package-lock.json','build-config.cjs','.prettierrc.json','.gitignore','CONTRIBUTING.md',
    'AGENTS.md','README.md','LICENSE','CHANGELOG.md','KNOWN-LIMITATIONS.md','DISCLAIMER.md','SECURITY.md',
    'scripts/release.ps1',
    'scripts/build-page.cjs','scripts/verify-package.mjs','templates/button-style.json',
    'docs/RASPBERRY-PI-SMB.md','docs/PROJECT-HANDOFF.md','docs/VIEWER-DEVELOPMENT.md','docs/TIMELINE-VIEWER.md','docs/VIEWER-TEST-REPORT.md','docs/ARCHITECTURE.md','docs/DEVELOPER-MANUAL.md','docs/TRACK-1-TESTS.md','docs/TRACK-6-TESTS.md','docs/GITHUB-SETUP.md','docs/BUILD.md'
)
foreach ($folder in @('src','test','companion')) {
    $sourceFiles += Get-ChildItem -LiteralPath (Join-Path $projectRoot $folder) -File -Recurse | ForEach-Object { $_.FullName.Substring($projectRoot.Length + 1) }
}
foreach ($relative in $sourceFiles) {
    $target = Join-Path $source $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot $relative) -Destination $target
}
$bundle = Join-Path $staging 'bundle'
New-Item -ItemType Directory -Path $bundle | Out-Null
foreach ($relative in @("disguise-layer-control-$version.tgz",'D3-Stream-Deck-Plus.companionconfig','D3-Stream-Deck-XL.companionconfig','README.md','LICENSE','CHANGELOG.md','KNOWN-LIMITATIONS.md','DISCLAIMER.md','SECURITY.md')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $relative) -Destination $bundle
}
New-Item -ItemType Directory -Path (Join-Path $bundle 'docs') | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/ARCHITECTURE.md') -Destination (Join-Path $bundle 'docs')
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/DEVELOPER-MANUAL.md') -Destination (Join-Path $bundle 'docs')
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/RASPBERRY-PI-SMB.md') -Destination (Join-Path $bundle 'docs')
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/BUILD.md') -Destination (Join-Path $bundle 'docs')
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/TRACK-1-TESTS.md') -Destination (Join-Path $bundle 'docs')
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/TRACK-6-TESTS.md') -Destination (Join-Path $bundle 'docs')
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/GITHUB-SETUP.md') -Destination (Join-Path $bundle 'docs')
Copy-Item -LiteralPath (Join-Path $projectRoot 'CONTRIBUTING.md') -Destination $bundle
Compress-Archive -Path (Join-Path $source '*') -DestinationPath (Join-Path $bundle "disguise-layer-editor-$releaseName-source.zip")

# Inspect the actual source archive before declaring the release ready.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead((Join-Path $bundle "disguise-layer-editor-$releaseName-source.zip"))
try {
    $entries = @($zip.Entries | ForEach-Object { $_.FullName.Replace('\','/') })
    foreach ($relative in $sourceFiles) { if ($entries -notcontains $relative.Replace('\','/')) { throw "Missing source file: $relative" } }
    if ($entries | Where-Object { $_ -match '(^|/)(node_modules|\.tools|track-[345]|history)/|\.d3$|\.log$' }) { throw 'Development data entered source archive.' }
} finally { $zip.Dispose() }
# Small installation download: module and both clean Companion pages.
Compress-Archive -LiteralPath @((Join-Path $bundle "disguise-layer-control-$version.tgz"), (Join-Path $bundle 'D3-Stream-Deck-Plus.companionconfig'), (Join-Path $bundle 'D3-Stream-Deck-XL.companionconfig')) -DestinationPath (Join-Path $bundle "disguise-layer-editor-$releaseName-companion.zip")
$hashes = Get-ChildItem -LiteralPath $bundle -File -Recurse | Sort-Object FullName | ForEach-Object {
    $name = $_.FullName.Substring($bundle.Length + 1).Replace('\','/')
    $stream = [IO.File]::OpenRead($_.FullName)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $hash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $stream.Dispose(); $sha.Dispose() }
    '{0}  {1}' -f $hash, $name
}
Set-Content -LiteralPath (Join-Path $bundle 'SHA256SUMS.txt') -Value $hashes -Encoding ascii
Remove-CheckedDirectory $destination $releaseRoot
New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
Move-Item -LiteralPath $bundle -Destination $destination
Write-Host "Release ready: $destination"
