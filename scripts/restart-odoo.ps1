# Restart service Odoo 20 setelah addon diubah. Meminta izin Administrator (UAC) sendiri bila perlu.
$serviceName = 'odoo-server-20.0'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    exit
}

Restart-Service -Name $serviceName -Force
$service = Get-Service -Name $serviceName
Write-Host "Service ${serviceName}: $($service.Status)"
Start-Sleep -Seconds 12
try {
    $response = Invoke-WebRequest -Uri 'http://localhost:8079/web/login' -UseBasicParsing -TimeoutSec 20
    Write-Host "Odoo merespons HTTP $($response.StatusCode)"
} catch {
    Write-Host "Odoo belum merespons: $($_.Exception.Message). Coba lagi beberapa detik."
}
Start-Sleep -Seconds 3
