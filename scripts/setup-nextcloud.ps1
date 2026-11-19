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
for ($i = 0; $i -lt 30; $i++) {
  $status = Invoke-Occ status 2>$null | Out-String
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
  docker exec -u www-data $container php occ group:info $grp 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Invoke-Occ group:add $grp
  }
}

function Ensure-NextcloudUser {
  param([string]$User, [string]$Group, [string]$DisplayName, [string]$Password)
  docker exec -u www-data $container php occ user:info $User 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    docker exec -u www-data -e "OC_PASS=$Password" $container php occ user:add --password-from-env --display-name="$DisplayName" --group="$Group" $User
  } else {
    docker exec -u www-data $container php occ group:adduser $Group $User 2>$null | Out-Null
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
if ($foldersJson) {
  foreach ($prop in $foldersJson.PSObject.Properties) {
    if ($prop.Value.mount_point -eq $folderName) {
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
Invoke-Occ groupfolders:group $folderId equipo read write create delete share
Invoke-Occ groupfolders:group $folderId automatizacion read write create
Invoke-Occ groupfolders:group $folderId auditores read

$baseDir = "/var/www/html/data/__groupfolders/$folderId"
docker exec -u www-data $container mkdir -p `
  "$baseDir/01-Documentacion-Tecnica" `
  "$baseDir/02-Informes-Pruebas" `
  "$baseDir/03-Configuraciones-Infra" `
  "$baseDir/04-Reportes-n8n" `
  "$baseDir/05-Evidencias"

Invoke-Occ groupfolders:scan $folderId
Write-Host "Listo: estructura y permisos de Nextcloud configurados."
