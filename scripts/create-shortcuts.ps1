$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$shortcutShell = New-Object -ComObject WScript.Shell
$launchers = @(
    @{ Name = 'Asenna ymparisto'; Target = '1 - Asenna ymparisto.cmd'; Icon = 162 },
    @{ Name = 'Kaanna moduuli'; Target = '2 - Kaanna moduuli.cmd'; Icon = 21 },
    @{ Name = 'Aja testit'; Target = '3 - Aja testit.cmd'; Icon = 167 },
    @{ Name = 'Lue ohje'; Target = 'README.md'; Icon = 23 }
)
foreach ($launcher in $launchers) {
    $shortcut = $shortcutShell.CreateShortcut((Join-Path $projectRoot ($launcher.Name + '.lnk')))
    $shortcut.TargetPath = Join-Path $projectRoot $launcher.Target
    $shortcut.WorkingDirectory = $projectRoot
    $shortcut.Description = $launcher.Name
    $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,$($launcher.Icon)"
    $shortcut.Save()
}
