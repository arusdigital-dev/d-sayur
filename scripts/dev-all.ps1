$ErrorActionPreference = 'Stop'

$requiredServices = @('postgresql-x64-16')
foreach ($name in $requiredServices) {
    $service = Get-Service -Name $name -ErrorAction Stop
    if ($service.Status -ne 'Running') {
        Write-Host "Menyalakan service $name..."
        Start-Service -Name $name
        (Get-Service -Name $name).WaitForStatus('Running', [TimeSpan]::FromSeconds(60))
    }
}

Write-Host 'Menyiapkan database PostgreSQL milik storefront...'
& npm.cmd run db:setup
if ($LASTEXITCODE -ne 0) { throw 'Database D-Sayur gagal disiapkan. Periksa DATABASE_URL dan service PostgreSQL.' }
Write-Host 'Storefront Next.js akan berjalan di http://localhost:3000'
Write-Host 'Tekan Ctrl+C untuk menghentikan Next.js. PostgreSQL tetap berjalan.'

& npm.cmd run dev
exit $LASTEXITCODE
