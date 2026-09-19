Set-Location $PSScriptRoot
Write-Host "Quiz Arena -> http://localhost:8088"
Write-Host "Media folder -> $PSScriptRoot\media"
wsl --cd $PSScriptRoot -e python3 server.py
