$ErrorActionPreference = 'Stop'

$legacyConfig = 'C:\Program Files\Odoo 19.0e.20260618\server\dsayur.conf'
$odoo20Config = 'C:\Program Files\Odoo 20.0.20260930\server\odoo.conf'
$customAddons = Join-Path (Split-Path -Parent $PSScriptRoot) 'odoo\addons'
$serviceName = 'odoo-server-20.0'

if (-not (Test-Path -LiteralPath $legacyConfig)) {
    throw "Konfigurasi Odoo 19 tidak ditemukan: $legacyConfig"
}
if (-not (Test-Path -LiteralPath $odoo20Config)) {
    throw "Konfigurasi Odoo 20 tidak ditemukan: $odoo20Config"
}
if (-not (Test-Path -LiteralPath $customAddons)) {
    throw "Addon DSayur tidak ditemukan: $customAddons"
}

$legacyText = [System.IO.File]::ReadAllText($legacyConfig)
$passwordMatch = [regex]::Match($legacyText, '(?m)^db_password\s*=\s*(.*)$')
if (-not $passwordMatch.Success) {
    throw 'Password database tidak ditemukan di konfigurasi Odoo 19.'
}
$databasePassword = $passwordMatch.Groups[1].Value
$envFile = Join-Path (Split-Path -Parent $PSScriptRoot) '.env.local'
if (-not (Test-Path -LiteralPath $envFile)) {
    throw '.env.local tidak ditemukan; API key Odoo tidak dapat disinkronkan.'
}
$apiKeyLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^\s*ODOO_API_KEY\s*=' } | Select-Object -First 1
if (-not $apiKeyLine) {
    throw 'ODOO_API_KEY tidak ditemukan di .env.local.'
}
$apiKey = (($apiKeyLine -replace '^\s*ODOO_API_KEY\s*=\s*', '').Trim()).Trim('"', "'")
if (-not $apiKey -or $apiKey -match 'replace-with-a-long-random-secret') {
    throw 'ODOO_API_KEY masih kosong atau memakai placeholder.'
}

$odoo20Text = [System.IO.File]::ReadAllText($odoo20Config)
$backupPath = "$odoo20Config.bak-dsayur"
if (-not (Test-Path -LiteralPath $backupPath)) {
    [System.IO.File]::Copy($odoo20Config, $backupPath)
}

$odoo20Text = [regex]::Replace(
    $odoo20Text,
    '(?m)^db_password\s*=\s*.*$',
    [System.Text.RegularExpressions.MatchEvaluator]{ param($match) "db_password = $databasePassword" }
)
$lines = [System.Collections.Generic.List[string]]::new()
$lines.AddRange([string[]]($odoo20Text -split '[\r\n]+'))
$addonsIndex = -1
for ($index = 0; $index -lt $lines.Count; $index++) {
    if ($lines[$index] -match '^\s*addons_path\s*=') {
        $addonsIndex = $index
        break
    }
}
if ($addonsIndex -lt 0) {
    throw 'addons_path tidak ditemukan di konfigurasi Odoo 20.'
}
$coreAddons = 'C:\Program Files\Odoo 20.0.20260930\server\odoo\addons'
$lines[$addonsIndex] = "addons_path = $coreAddons,$customAddons"
for ($index = $lines.Count - 1; $index -gt $addonsIndex; $index--) {
    if ($lines[$index].TrimStart().StartsWith(',') -and $lines[$index].Contains('d-sayur\odoo\addons')) {
        $lines.RemoveAt($index)
    }
}
$odoo20Text = ($lines -join "`r`n").TrimEnd() + "`r`n"
$settings = [ordered]@{
    http_port = '8079'
    db_name = 'dsayur'
    dbfilter = '^dsayur$'
    list_db = 'False'
    logfile = 'C:\ProgramData\Odoo\odoo20-dsayur.log'
}
New-Item -ItemType Directory -Path 'C:\ProgramData\Odoo' -Force | Out-Null
foreach ($setting in $settings.GetEnumerator()) {
    $settingIndex = -1
    for ($index = 0; $index -lt $lines.Count; $index++) {
        if ($lines[$index] -match "^\s*$($setting.Key)\s*=") {
            $settingIndex = $index
            break
        }
    }
    if ($settingIndex -ge 0) {
        $lines[$settingIndex] = "$($setting.Key) = $($setting.Value)"
    } else {
        $lines.Insert(1, "$($setting.Key) = $($setting.Value)")
    }
}
$odoo20Text = ($lines -join "`r`n").TrimEnd() + "`r`n"

[System.IO.File]::WriteAllText($odoo20Config, $odoo20Text, [System.Text.UTF8Encoding]::new($false))
Stop-Service -Name $serviceName
$python = 'C:\Program Files\Odoo 20.0.20260930\python\python.exe'
$odooBin = 'C:\Program Files\Odoo 20.0.20260930\server\odoo-bin'
& $python -B $odooBin -c $odoo20Config -d dsayur -u dsayur_headless --test-enable --test-tags /dsayur_headless --stop-after-init
if ($LASTEXITCODE -ne 0) {
    Start-Service -Name $serviceName
    throw "Upgrade/test addon gagal (exit code $LASTEXITCODE). Service Odoo 20 sudah dimulai kembali."
}
$dbUserMatch = [regex]::Match($odoo20Text, '(?m)^db_user\s*=\s*(.*)$')
if (-not $dbUserMatch.Success) {
    Start-Service -Name $serviceName
    throw 'db_user tidak ditemukan di konfigurasi Odoo 20.'
}
$escapedApiKey = $apiKey.Replace("'", "''")
$sql = "INSERT INTO ir_config_parameter (key, value, create_uid, write_uid, create_date, write_date) VALUES ('dsayur_headless.api_key', '$escapedApiKey', 1, 1, NOW(), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, write_uid = 1, write_date = NOW();"
$oldPgPassword = $env:PGPASSWORD
$env:PGPASSWORD = $databasePassword
try {
    $sql | & 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -X -v ON_ERROR_STOP=1 -h localhost -p 5432 -U $dbUserMatch.Groups[1].Value.Trim() -d dsayur
    if ($LASTEXITCODE -ne 0) {
        Start-Service -Name $serviceName
        throw 'Gagal menyimpan API key ke system parameter Odoo.'
    }
} finally {
    if ($null -eq $oldPgPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $oldPgPassword }
}
Start-Service -Name $serviceName
Start-Sleep -Seconds 10
$service = Get-Service -Name $serviceName
if ($service.Status -ne 'Running') {
    throw "Service $serviceName tidak berjalan setelah konfigurasi."
}

Write-Output "Konfigurasi Odoo 20 diperbarui; backup: $backupPath"
Write-Output "Service $serviceName status: $($service.Status)"
Write-Output 'Odoo 20 memakai port 8079 dan database dsayur.'
