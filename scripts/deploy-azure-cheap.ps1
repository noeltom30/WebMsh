param(
    [Parameter(Mandatory = $true)]
    [string]$SubscriptionId,
    [string]$Location = "centralindia",
    [string]$ResourceGroup = "rg-webmsh",
    [string]$ContainerAppsEnv = "cae-webmsh",
    [string]$ContainerAppName = "ca-webmsh-api",
    [string]$BackendImageRepo = "ghcr.io/<github-username>/webmsh-backend",
    [string]$GhcrUsername = "",
    [string]$GhcrToken = "",
    [string]$BackendStorageAccount = "",
    [string]$BackendFileShare = "webmsh-data",
    [string]$FrontendStorageAccount = "",
    [switch]$SkipFrontend
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name"
    }
}

Require-Command az
Require-Command docker
if (-not $SkipFrontend) {
    Require-Command npm
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $repoRoot "backend"
$frontendPath = Join-Path $repoRoot "frontend"

if (-not (Test-Path (Join-Path $backendPath "requirements.txt"))) {
    throw "backend\requirements.txt not found. Run this script from the repo checkout."
}

$imageTag = Get-Date -Format "yyyyMMddHHmmss"
$image = "$BackendImageRepo`:$imageTag"

if ([string]::IsNullOrWhiteSpace($BackendStorageAccount)) {
    $BackendStorageAccount = ("stwebmsh" + (Get-Random -Minimum 10000 -Maximum 99999))
}
if ([string]::IsNullOrWhiteSpace($FrontendStorageAccount) -and -not $SkipFrontend) {
    $FrontendStorageAccount = ("stwebmshfe" + (Get-Random -Minimum 10000 -Maximum 99999))
}

Write-Host "Logging in and selecting subscription..."
az login | Out-Null
az account set --subscription $SubscriptionId

Write-Host "Registering Azure providers..."
az extension add --name containerapp --upgrade --only-show-errors | Out-Null
az provider register --namespace Microsoft.App --wait --only-show-errors | Out-Null
az provider register --namespace Microsoft.OperationalInsights --wait --only-show-errors | Out-Null

Write-Host "Creating resource group and Container Apps environment..."
az group create --name $ResourceGroup --location $Location --only-show-errors | Out-Null
az containerapp env create `
    --name $ContainerAppsEnv `
    --resource-group $ResourceGroup `
    --location $Location `
    --only-show-errors | Out-Null

Write-Host "Creating backend storage (Azure Files for SQLite persistence)..."
az storage account create `
    --name $BackendStorageAccount `
    --resource-group $ResourceGroup `
    --location $Location `
    --sku Standard_LRS `
    --kind StorageV2 `
    --only-show-errors | Out-Null

az storage share-rm create `
    --resource-group $ResourceGroup `
    --storage-account $BackendStorageAccount `
    --name $BackendFileShare `
    --quota 5 `
    --only-show-errors | Out-Null

$backendStorageKey = az storage account keys list `
    --resource-group $ResourceGroup `
    --account-name $BackendStorageAccount `
    --query "[0].value" -o tsv

az containerapp env storage set `
    --name $ContainerAppsEnv `
    --resource-group $ResourceGroup `
    --storage-name webmshfiles `
    --azure-file-account-name $BackendStorageAccount `
    --azure-file-account-key $backendStorageKey `
    --azure-file-share-name $BackendFileShare `
    --access-mode ReadWrite `
    --only-show-errors | Out-Null

if ([string]::IsNullOrWhiteSpace($GhcrUsername) -or [string]::IsNullOrWhiteSpace($GhcrToken)) {
    throw "Pass -GhcrUsername and -GhcrToken (PAT with package write access) for GHCR push."
}

Write-Host "Building and pushing backend image to GHCR..."
$dockerfilePath = Join-Path $backendPath "Dockerfile.azure.generated"
@"
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY app /app/app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
"@ | Set-Content -Path $dockerfilePath -Encoding UTF8

try {
    $GhcrToken | docker login ghcr.io -u $GhcrUsername --password-stdin | Out-Null
    docker build -f $dockerfilePath -t $image $backendPath
    docker push $image
}
finally {
    Remove-Item -Path $dockerfilePath -Force -ErrorAction SilentlyContinue
}

$authSecret = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
$corsOrigins = "http://localhost:5173,http://127.0.0.1:5173"
$frontendUrl = ""

if (-not $SkipFrontend) {
    Write-Host "Creating frontend storage account and static website..."
    az storage account create `
        --name $FrontendStorageAccount `
        --resource-group $ResourceGroup `
        --location $Location `
        --sku Standard_LRS `
        --kind StorageV2 `
        --only-show-errors | Out-Null

    $frontendStorageKey = az storage account keys list `
        --resource-group $ResourceGroup `
        --account-name $FrontendStorageAccount `
        --query "[0].value" -o tsv

    az storage blob service-properties update `
        --account-name $FrontendStorageAccount `
        --account-key $frontendStorageKey `
        --static-website `
        --index-document index.html `
        --404-document index.html `
        --only-show-errors | Out-Null

    $frontendUrl = (az storage account show `
        --name $FrontendStorageAccount `
        --resource-group $ResourceGroup `
        --query "primaryEndpoints.web" -o tsv).TrimEnd("/")

    $corsOrigins = $frontendUrl
}

Write-Host "Deploying backend Container App..."
$exists = az containerapp show --name $ContainerAppName --resource-group $ResourceGroup --only-show-errors 2>$null
if ($LASTEXITCODE -eq 0) {
    az containerapp update `
        --name $ContainerAppName `
        --resource-group $ResourceGroup `
        --image $image `
        --set-env-vars `
            WEBMSH_DB_PATH=/data/webmsh_auth.sqlite3 `
            WEBMSH_AUTH_SECRET=$authSecret `
            WEBMSH_SESSION_COOKIE_SECURE=1 `
            WEBMSH_SESSION_COOKIE_SAMESITE=none `
            WEBMSH_CORS_ORIGINS=$corsOrigins `
            WEBMSH_FRONTEND_URL=$frontendUrl `
        --only-show-errors | Out-Null
}
else {
    az containerapp create `
        --name $ContainerAppName `
        --resource-group $ResourceGroup `
        --environment $ContainerAppsEnv `
        --image $image `
        --target-port 8000 `
        --ingress external `
        --min-replicas 0 `
        --max-replicas 1 `
        --cpu 0.25 `
        --memory 0.5Gi `
        --env-vars `
            WEBMSH_DB_PATH=/data/webmsh_auth.sqlite3 `
            WEBMSH_AUTH_SECRET=$authSecret `
            WEBMSH_SESSION_COOKIE_SECURE=1 `
            WEBMSH_SESSION_COOKIE_SAMESITE=none `
            WEBMSH_CORS_ORIGINS=$corsOrigins `
            WEBMSH_FRONTEND_URL=$frontendUrl `
        --volume-mounts "mountPath=/data,volumeName=webmshvol" `
        --volumes "name=webmshvol,storageType=AzureFile,storageName=webmshfiles" `
        --only-show-errors | Out-Null
}

$apiFqdn = az containerapp show `
    --name $ContainerAppName `
    --resource-group $ResourceGroup `
    --query "properties.configuration.ingress.fqdn" -o tsv
$apiUrl = "https://$apiFqdn"

if (-not $SkipFrontend) {
    Write-Host "Building frontend with VITE_API_BASE=$apiUrl ..."
    Push-Location $frontendPath
    try {
        npm ci --silent
        $env:VITE_API_BASE = $apiUrl
        npm run build --silent
        Remove-Item Env:VITE_API_BASE -ErrorAction SilentlyContinue
    }
    finally {
        Pop-Location
    }

    Write-Host "Uploading frontend dist to static website..."
    $frontendStorageKey = az storage account keys list `
        --resource-group $ResourceGroup `
        --account-name $FrontendStorageAccount `
        --query "[0].value" -o tsv
    az storage blob upload-batch `
        --account-name $FrontendStorageAccount `
        --account-key $frontendStorageKey `
        --destination '$web' `
        --source (Join-Path $frontendPath "dist") `
        --overwrite `
        --only-show-errors | Out-Null
}

Write-Host ""
Write-Host "Deployment complete."
Write-Host "Backend API URL : $apiUrl"
if (-not $SkipFrontend) {
    Write-Host "Frontend URL    : $frontendUrl"
}
Write-Host ""
Write-Host "If you use Google OAuth, set WEBMSH_GOOGLE_REDIRECT_URI to:"
Write-Host "$apiUrl/auth/google/callback"
