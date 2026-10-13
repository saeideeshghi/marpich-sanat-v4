# Windows PowerShell 5.1 entry point; publication logic is shared with npm.
param([string]$ReleaseTag = '')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$mpsArguments = @((Join-Path $PSScriptRoot 'scripts\publish-github.js'))
if ($ReleaseTag) { $mpsArguments += @('--release-tag', $ReleaseTag) }
& node @mpsArguments
exit $LASTEXITCODE
