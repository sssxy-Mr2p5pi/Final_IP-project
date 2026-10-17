$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tools = Join-Path $root '.tools'
$blender = Join-Path $tools 'blender\blender-4.5.14-windows-x64\blender.exe'
$tweego = Join-Path $tools 'tweego\tweego.exe'
$twine = Join-Path $env:LOCALAPPDATA 'Programs\Twine\Twine.exe'
$format = (Get-Content -LiteralPath (Join-Path $root 'tools.lock.json') -Raw | ConvertFrom-Json).storyFormat
$formatFile = Join-Path $tools ('storyformats\' + $format.compilerId + '\format.js')
function Get-NativeVersion([string]$executable, [string]$argument) {
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $executable
    $info.Arguments = $argument
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $process = [System.Diagnostics.Process]::Start($info)
    $output = $process.StandardOutput.ReadToEnd()
    $errorText = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    # Tweego 2.1.1 reports --version on stderr and returns 1.
    $combined = ($output + $errorText).Trim()
    if ($combined -notmatch '^tweego, version 2\.1\.1') { throw "Unexpected Tweego version: $executable" }
    return ($combined -split "`n" | Select-Object -First 1).Trim()
}
$report = [ordered]@{
    checkedAt = [DateTimeOffset]::Now.ToString('o')
    git = (& git --version | Out-String).Trim()
    node = (& node --version | Out-String).Trim()
    twine = if (Test-Path -LiteralPath $twine) { (Get-Item -LiteralPath $twine).VersionInfo.ProductVersion } else { 'MISSING' }
    blender = if (Test-Path -LiteralPath $blender) { (& $blender --version | Select-Object -First 1) } else { 'MISSING' }
    tweego = if (Test-Path -LiteralPath $tweego) { Get-NativeVersion $tweego '--version' } else { 'MISSING' }
    storyFormat = $format.name + ' ' + $format.version
    harlowe = (Test-Path -LiteralPath $formatFile) -and ((Get-FileHash -LiteralPath $formatFile -Algorithm SHA256).Hash -eq $format.sha256)
    chrome = Test-Path -LiteralPath 'C:\Program Files\Google\Chrome\Application\chrome.exe'
    edge = Test-Path -LiteralPath 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
}
$target = Join-Path $root 'evidence\environment\environment.json'
New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $target -Encoding utf8
$report | Format-List
if ($report.twine -eq 'MISSING' -or $report.blender -eq 'MISSING' -or $report.tweego -eq 'MISSING' -or -not $report.harlowe) { exit 1 }
