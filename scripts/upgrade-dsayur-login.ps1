$ErrorActionPreference = 'Stop'

$serviceName = 'odoo-server-20.0'
$pythonExe = 'C:\Program Files\Odoo 20.0.20260930\python\python.exe'
$odooBin = 'C:\Program Files\Odoo 20.0.20260930\server\odoo-bin'
$configFile = 'C:\Program Files\Odoo 20.0.20260930\server\odoo.conf'
$database = 'dsayur'
$seedFile = Join-Path $PSScriptRoot '..\odoo\seed\seed_storefront_accounts.py'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Jalankan PowerShell sebagai Administrator.'
}

foreach ($path in @($pythonExe, $odooBin, $configFile, $seedFile)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "File tidak ditemukan: $path"
    }
}

Write-Host 'Menghentikan Odoo Community 20...'
Stop-Service -Name $serviceName -Force

try {
    Write-Host 'Meng-upgrade modul D-Sayur...'
    & $pythonExe $odooBin -c $configFile -d $database -u dsayur_headless --stop-after-init --no-http --max-cron-threads=0
    if ($LASTEXITCODE -ne 0) {
        throw "Upgrade modul gagal dengan exit code $LASTEXITCODE"
    }

    Write-Host 'Membuat kredensial storefront yang terpisah...'
    Get-Content -Raw -LiteralPath $seedFile |
        & $pythonExe $odooBin shell -c $configFile -d $database --no-http --max-cron-threads=0
    if ($LASTEXITCODE -ne 0) {
        throw "Seeder kredensial gagal dengan exit code $LASTEXITCODE"
    }
}
finally {
    Write-Host 'Menyalakan kembali Odoo Community 20...'
    Start-Service -Name $serviceName
}

Start-Sleep -Seconds 4
Get-Service -Name $serviceName | Format-Table Status, Name, DisplayName -AutoSize
Write-Host 'Upgrade login D-Sayur selesai.' -ForegroundColor Green

