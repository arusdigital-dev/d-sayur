$ErrorActionPreference = 'Stop'

$envFile = Join-Path (Get-Location) '.env.local'
if (Test-Path -LiteralPath $envFile) {
    foreach ($line in Get-Content -LiteralPath $envFile) {
        if ($line -match '^\s*ODOO_URL\s*=\s*(.*)\s*$' -and -not $env:ODOO_URL) { $env:ODOO_URL = $Matches[1].Trim('"', "'") }
        if ($line -match '^\s*ODOO_API_KEY\s*=\s*(.*)\s*$' -and -not $env:ODOO_API_KEY) { $env:ODOO_API_KEY = $Matches[1].Trim('"', "'") }
        if ($line -match '^\s*ODOO_DATABASE\s*=\s*(.*)\s*$' -and -not $env:ODOO_DATABASE) { $env:ODOO_DATABASE = $Matches[1].Trim('"', "'") }
    }
}

if (-not $env:ODOO_URL) {
    throw 'ODOO_URL belum diatur di .env.local. Jalankan Odoo Community 20 lebih dulu.'
}
if (-not $env:ODOO_API_KEY) {
    throw 'ODOO_API_KEY belum diatur di .env.local.'
}
if (-not $env:ODOO_DATABASE) {
    throw 'ODOO_DATABASE belum diatur di .env.local.'
}

try {
    $health = Invoke-RestMethod -Uri "$($env:ODOO_URL.TrimEnd('/'))/dsayur/api/health" -Method Get -Headers @{
        'X-DSayur-API-Key' = $env:ODOO_API_KEY
        'X-DSayur-Database' = $env:ODOO_DATABASE
    } -TimeoutSec 8
} catch {
    throw 'Odoo tidak merespons health check. Pastikan Odoo Community 20 berjalan, addon terpasang, API key/database cocok, lalu coba lagi.'
}
if (-not $health.success -or -not $health.data.odoo_version.StartsWith('20.')) {
    throw 'Target bukan Odoo 20 yang siap. dev:all hanya ditujukan ke Odoo Community 20.'
}

Write-Host "Odoo $($health.data.odoo_version) dan addon D-Sayur siap."
Write-Host "Storefront memakai Odoo pada $($env:ODOO_URL)"
Write-Host 'Storefront Next.js akan berjalan di http://localhost:3000'
Write-Host 'Tekan Ctrl+C untuk menghentikan Next.js; Odoo/PostgreSQL tidak dihentikan.'

& npm.cmd run dev
exit $LASTEXITCODE
