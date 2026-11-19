$ErrorActionPreference = "Stop"

$container = (docker compose --profile documentacion ps -q nextcloud 2>$null | Select-Object -First 1)
if (-not $container) {
  Write-Error "El contenedor nextcloud no esta corriendo. Ejecuta: docker compose --profile documentacion up -d"
  exit 1
}

function Invoke-Occ {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$ArgsList)
  docker exec -u www-data $container php occ @ArgsList
}

Write-Host "Esperando a que Nextcloud complete la instalacion inicial..."
$installed = $false
for ($i = 0; $i -lt 40; $i++) {
  $prevPref = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $status = (docker exec -u www-data $container php occ status 2>&1 | Out-String)
  $ErrorActionPreference = $prevPref
  if ($status -match "installed:\s*true") { $installed = $true; break }
  Start-Sleep -Seconds 3
}
if (-not $installed) {
  Write-Error "Nextcloud no respondio como instalado a tiempo."
  exit 1
}

Write-Host "Habilitando app groupfolders (Team Folders)..."
$enabledApps = Invoke-Occ app:list --enabled | Out-String
if ($enabledApps -notmatch "groupfolders:") {
  $disabledApps = Invoke-Occ app:list --disabled | Out-String
  if ($disabledApps -match "groupfolders:") {
    Invoke-Occ app:enable groupfolders
  } else {
    Invoke-Occ app:install groupfolders
  }
}

foreach ($grp in @("equipo", "auditores", "automatizacion")) {
  $prevPref = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  docker exec -u www-data $container php occ group:info $grp *> $null
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $prevPref
  if ($exitCode -ne 0) {
    Invoke-Occ group:add $grp
  }
}

function Ensure-NextcloudUser {
  param([string]$User, [string]$Group, [string]$DisplayName, [string]$Password)
  $prevPref = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  docker exec -u www-data $container php occ user:info $User *> $null
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $prevPref
  if ($exitCode -ne 0) {
    docker exec -u www-data -e "OC_PASS=$Password" $container php occ user:add --password-from-env --display-name="$DisplayName" --group="$Group" $User
  } else {
    $prevPref2 = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    docker exec -u www-data $container php occ group:adduser $Group $User *> $null
    $ErrorActionPreference = $prevPref2
  }
}

$passEquipo = if ($env:NEXTCLOUD_EQUIPO_PASS) { $env:NEXTCLOUD_EQUIPO_PASS } else { "EquipoSoderia2026!" }
$passAuditor = if ($env:NEXTCLOUD_AUDITOR_PASS) { $env:NEXTCLOUD_AUDITOR_PASS } else { "AuditorSoderia2026!" }
$passN8n = if ($env:NEXTCLOUD_N8N_PASS) { $env:NEXTCLOUD_N8N_PASS } else { "N8nSoderia2026!" }

Ensure-NextcloudUser -User "equipo_dev" -Group "equipo" -DisplayName "Equipo Desarrollo" -Password $passEquipo
Ensure-NextcloudUser -User "auditor" -Group "auditores" -DisplayName "Auditor Catedra" -Password $passAuditor
Ensure-NextcloudUser -User "n8n_bot" -Group "automatizacion" -DisplayName "Bot Automatizacion n8n" -Password $passN8n

$folderName = "Soderia-TP-Final"
$foldersJson = Invoke-Occ groupfolders:list --output=json | ConvertFrom-Json
$folderId = $null
if ($foldersJson -is [System.Array]) {
  foreach ($item in $foldersJson) {
    if ($item.mountPoint -eq $folderName -or $item.mount_point -eq $folderName) {
      $folderId = [string]$item.id
      break
    }
  }
} elseif ($foldersJson) {
  foreach ($prop in $foldersJson.PSObject.Properties) {
    if ($prop.Value.mountPoint -eq $folderName -or $prop.Value.mount_point -eq $folderName) {
      $folderId = $prop.Name
      break
    }
  }
}

if (-not $folderId) {
  $createdOut = Invoke-Occ groupfolders:create $folderName | Out-String
  if ($createdOut -match "(\d+)") { $folderId = $Matches[1] }
}

Write-Host "Configurando permisos en '$folderName' (ID: $folderId)..."
Invoke-Occ groupfolders:group $folderId equipo read write delete share
Invoke-Occ groupfolders:group $folderId automatizacion read write
Invoke-Occ groupfolders:group $folderId auditores read

$mkcolPhp = @'
<?php
$pass = getenv('EQUIPO_PASS');
$dirs = ['01-Documentacion-Tecnica','02-Informes-Pruebas','03-Configuraciones-Infra','04-Reportes-n8n','05-Evidencias'];
foreach ($dirs as $d) {
  $c = curl_init("http://127.0.0.1/remote.php/dav/files/equipo_dev/Soderia-TP-Final/$d");
  curl_setopt_array($c, [
    CURLOPT_CUSTOMREQUEST => 'MKCOL',
    CURLOPT_USERPWD => "equipo_dev:$pass",
    CURLOPT_RETURNTRANSFER => true,
  ]);
  curl_exec($c);
  $code = curl_getinfo($c, CURLINFO_HTTP_CODE);
  if ($code !== 201 && $code !== 405) { fwrite(STDERR, "Error MKCOL $d: HTTP $code\n"); exit(1); }
}
'@
$mkcolPhp | docker exec -i -e "EQUIPO_PASS=$passEquipo" -u www-data $container php
Write-Host "Listo: estructura y permisos de Nextcloud configurados."
