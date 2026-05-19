# WebMsh Azure Deployment with PostgreSQL

This guide deploys WebMsh using:

- **Backend:** Azure Container Apps
- **Database:** Azure Database for PostgreSQL Flexible Server
- **Frontend:** Azure Storage Static Website

This avoids SQLite file-locking issues on Azure Files and avoids Azure Static Web Apps region restrictions.

---

## 1. Build and Push the Backend Image

Run this on your local machine from the repo root:

```powershell
cd D:\Projects\WebMsh

$IMAGE="ghcr.io/noeltom30/webmsh-backend:postgres-20260518"

docker build -t $IMAGE .\backend
docker push $IMAGE
```

The GHCR package must be public, or Azure Container Apps must be configured with GHCR registry credentials.

---

## 2. Create Azure Base Resources

Run these in Azure Cloud Shell or Azure CLI:

```powershell
$RG="rg-webmsh"
$LOC="centralindia"
$ENV="cae-webmsh"
$APP="ca-webmsh-api"
$IMAGE="ghcr.io/noeltom30/webmsh-backend:postgres-20260518"

az group create --name $RG --location $LOC

az extension add --name containerapp --upgrade

az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
az provider register --namespace Microsoft.DBforPostgreSQL

az containerapp env create `
  --name $ENV `
  --resource-group $RG `
  --location $LOC
```

---

## 3. Create PostgreSQL Flexible Server

```powershell
$PGSERVER="pg-webmsh-$((Get-Random -Minimum 10000 -Maximum 99999))"
$PGDB="webmsh"
$PGUSER="webmshadmin"
$PGPASS="<PUT_A_STRONG_PASSWORD_HERE>"
```

Create the server:

```powershell
az postgres flexible-server create `
  --resource-group $RG `
  --name $PGSERVER `
  --location $LOC `
  --admin-user $PGUSER `
  --admin-password $PGPASS `
  --sku-name Standard_B1ms `
  --tier Burstable `
  --storage-size 32 `
  --version 16 `
  --public-access 0.0.0.0
```

Create the database separately:

```powershell
az postgres flexible-server db create `
  --resource-group $RG `
  --server-name $PGSERVER `
  --database-name $PGDB
```

Build the database URL. The backtick before `?` matters in PowerShell:

```powershell
$DATABASE_URL = "postgresql://${PGUSER}:$PGPASS@$PGSERVER.postgres.database.azure.com:5432/$PGDB`?sslmode=require"
$DATABASE_URL
```

It should end like this:

```text
/webmsh?sslmode=require
```

---

## 4. Deploy the Backend Container App

Generate an auth secret:

```powershell
$AUTH_SECRET = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

Create the Container App:

```powershell
az containerapp create `
  --name $APP `
  --resource-group $RG `
  --environment $ENV `
  --image $IMAGE `
  --target-port 8000 `
  --ingress external `
  --min-replicas 0 `
  --max-replicas 1 `
  --cpu 0.25 `
  --memory 0.5Gi `
  --secrets `
    database-url="$DATABASE_URL" `
    auth-secret="$AUTH_SECRET" `
  --env-vars `
    WEBMSH_DATABASE_URL=secretref:database-url `
    WEBMSH_AUTH_SECRET=secretref:auth-secret `
    WEBMSH_SESSION_COOKIE_SECURE=1 `
    WEBMSH_SESSION_COOKIE_SAMESITE=none `
    WEBMSH_OTP_ENABLED=0
```

If the backend cannot connect to Postgres, add the Azure services firewall rule:

```powershell
az postgres flexible-server firewall-rule create `
  --resource-group $RG `
  --name $PGSERVER `
  --rule-name AllowAzureServices `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 0.0.0.0
```

---

## 5. Test the Backend

Get the backend URL:

```powershell
$API_FQDN = az containerapp show `
  --name $APP `
  --resource-group $RG `
  --query "properties.configuration.ingress.fqdn" `
  -o tsv

$API_URL="https://$API_FQDN"
$API_URL
```

Test health and auth config:

```powershell
Invoke-RestMethod "$API_URL/health" | ConvertTo-Json
Invoke-RestMethod "$API_URL/auth/config" | ConvertTo-Json
```

Expected:

```text
status: ok
otp_enabled: false
```

If the app is unhealthy, inspect logs:

```powershell
az containerapp revision list `
  --name $APP `
  --resource-group $RG `
  --query "[].{name:name,active:properties.active,healthy:properties.healthState,image:properties.template.containers[0].image}" `
  -o table

az containerapp logs show `
  --name $APP `
  --resource-group $RG `
  --tail 100
```

---

## 6. Build the Frontend

Run this locally:

```powershell
cd D:\Projects\WebMsh\frontend

$env:VITE_API_BASE="<YOUR_API_URL>"
npm ci
npm run build
Remove-Item Env:VITE_API_BASE
```

Example:

```powershell
$env:VITE_API_BASE="https://ca-webmsh-api.example.azurecontainerapps.io"
```

---

## 7. Deploy Frontend with Azure Storage Static Website

Static Web Apps may be blocked by subscription region policies, so this setup uses Storage Static Website hosting.

Create a frontend storage account:

```powershell
$FE_ST="stwebmshfe$((Get-Random -Minimum 10000 -Maximum 99999))"

az storage account create `
  --name $FE_ST `
  --resource-group $RG `
  --location $LOC `
  --sku Standard_LRS `
  --kind StorageV2
```

Enable static website hosting:

```powershell
$FE_KEY = az storage account keys list `
  --resource-group $RG `
  --account-name $FE_ST `
  --query "[0].value" `
  -o tsv

az storage blob service-properties update `
  --account-name $FE_ST `
  --account-key $FE_KEY `
  --static-website `
  --index-document index.html `
  --404-document index.html
```

Upload the frontend build from your local machine:

```powershell
cd D:\Projects\WebMsh

az storage blob upload-batch `
  --account-name $FE_ST `
  --account-key $FE_KEY `
  --destination '$web' `
  --source .\frontend\dist `
  --overwrite
```

Get the frontend URL:

```powershell
$FRONTEND_URL = az storage account show `
  --name $FE_ST `
  --resource-group $RG `
  --query "primaryEndpoints.web" `
  -o tsv

$FRONTEND_URL = $FRONTEND_URL.TrimEnd("/")
$FRONTEND_URL
```

---

## 8. Update Backend CORS

After the frontend URL exists, update the backend:

```powershell
az containerapp update `
  --name $APP `
  --resource-group $RG `
  --set-env-vars `
    WEBMSH_FRONTEND_URL=$FRONTEND_URL `
    WEBMSH_CORS_ORIGINS=$FRONTEND_URL `
    WEBMSH_SESSION_COOKIE_SECURE=1 `
    WEBMSH_SESSION_COOKIE_SAMESITE=none `
    WEBMSH_OTP_ENABLED=0
```

Open the frontend URL in a browser and test the app.

---

## Updating Later

### Backend changes

Use a new image tag, then update Container Apps:

```powershell
cd D:\Projects\WebMsh

$IMAGE="ghcr.io/noeltom30/webmsh-backend:postgres-<NEW_TAG>"

docker build -t $IMAGE .\backend
docker push $IMAGE

az containerapp update `
  --name $APP `
  --resource-group $RG `
  --image $IMAGE
```

### Frontend changes

Rebuild with the API URL and upload again:

```powershell
cd D:\Projects\WebMsh\frontend

$env:VITE_API_BASE="<YOUR_API_URL>"
npm run build
Remove-Item Env:VITE_API_BASE

cd D:\Projects\WebMsh

az storage blob upload-batch `
  --account-name $FE_ST `
  --account-key $FE_KEY `
  --destination '$web' `
  --source .\frontend\dist `
  --overwrite
```

---

## Cost Control

Use these settings to keep costs low:

- PostgreSQL: `Standard_B1ms`, Burstable, 32 GB storage
- Container Apps: `min-replicas 0`, `max-replicas 1`, `cpu 0.25`, `memory 0.5Gi`
- Frontend: Azure Storage Static Website with `Standard_LRS`
- OTP disabled unless SMTP is configured

PostgreSQL is the main monthly cost.

---

## Reset / Stop Spending

To delete everything in this deployment:

```powershell
az group delete --name rg-webmsh --yes --no-wait
```

Verify:

```powershell
az group exists --name rg-webmsh
```

`false` means the resource group is gone.
