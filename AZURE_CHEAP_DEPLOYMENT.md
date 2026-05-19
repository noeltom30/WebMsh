# Cheapest Azure Deployment for WebMsh

This project is cheapest to run on Azure with:

1. **Frontend:** Azure Static Web Apps (**Free** tier)  
2. **Backend:** Azure Container Apps (**Consumption**, `min-replicas 0`)  
3. **Persistence for SQLite:** Azure Files (small share)

This setup keeps cost near zero at low traffic while still supporting your current React + FastAPI architecture.

---

## 1) Minimal code changes before deploy

### `backend/app/db.py`
Allow DB path via environment variable (so SQLite can live on mounted Azure Files storage):

```python
import os
from pathlib import Path
import sqlite3
from datetime import datetime, timezone

DB_PATH = Path(os.getenv("WEBMSH_DB_PATH", str(Path(__file__).resolve().parent / "webmsh_auth.sqlite3")))
```

### `backend/app/main.py`
Make CORS configurable via environment variable:

```python
import os
# ...
cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "WEBMSH_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### `backend/app/auth.py`
Make cookie SameSite configurable for cross-site auth cookie:

```python
SESSION_COOKIE_SAMESITE = os.getenv("WEBMSH_SESSION_COOKIE_SAMESITE", "lax").lower()
# ...
response.set_cookie(
    SESSION_COOKIE_NAME,
    raw_token,
    httponly=True,
    secure=SESSION_COOKIE_SECURE,
    samesite=SESSION_COOKIE_SAMESITE,
    max_age=SESSION_TTL_SECONDS,
    path="/",
)
```

For separate frontend/backend domains in production, use:

- `WEBMSH_SESSION_COOKIE_SECURE=1`
- `WEBMSH_SESSION_COOKIE_SAMESITE=none`

---

## 2) Azure CLI deploy commands (PowerShell)

```powershell
# ---------- variables ----------
$RG="rg-webmsh"
$LOC="centralindia"
$ENV="cae-webmsh"
$APP="ca-webmsh-api"
$ST="stwebmsh$((Get-Random -Minimum 10000 -Maximum 99999))"
$SHARE="webmsh-data"
$SWA="swa-webmsh"

az login
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"

# providers/extensions
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights

# ---------- resource group ----------
az group create --name $RG --location $LOC

# ---------- container apps env ----------
az containerapp env create --name $ENV --resource-group $RG --location $LOC

# ---------- storage for sqlite ----------
az storage account create --name $ST --resource-group $RG --location $LOC --sku Standard_LRS
az storage share-rm create --resource-group $RG --storage-account $ST --name $SHARE --quota 5

$STKEY = az storage account keys list --resource-group $RG --account-name $ST --query "[0].value" -o tsv

az containerapp env storage set `
  --name $ENV `
  --resource-group $RG `
  --storage-name webmshfiles `
  --azure-file-account-name $ST `
  --azure-file-account-key $STKEY `
  --azure-file-share-name $SHARE `
  --access-mode ReadWrite
```

Build/push backend image to a **public GHCR image** (to avoid Azure Container Registry monthly cost), then deploy:

```powershell
$IMAGE="ghcr.io/<github-username>/webmsh-backend:latest"

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
  --env-vars `
    WEBMSH_DB_PATH=/data/webmsh_auth.sqlite3 `
    WEBMSH_AUTH_SECRET="<LONG_RANDOM_SECRET>" `
    WEBMSH_SESSION_COOKIE_SECURE=1 `
    WEBMSH_SESSION_COOKIE_SAMESITE=none `
    WEBMSH_OTP_ENABLED=1 `
  --volume-mounts "mountPath=/data,volumeName=webmshvol" `
  --volumes "name=webmshvol,storageType=AzureFile,storageName=webmshfiles"
```

Get backend URL:

```powershell
$API_FQDN = az containerapp show --name $APP --resource-group $RG --query "properties.configuration.ingress.fqdn" -o tsv
$API_URL = "https://$API_FQDN"
$API_URL
```

Set frontend prod API base:

```powershell
Set-Content -Path ".\frontend\.env.production" -Value "VITE_API_BASE=$API_URL"
```

Create Static Web App (Free):

```powershell
az staticwebapp create `
  --name $SWA `
  --resource-group $RG `
  --location $LOC `
  --sku Free `
  --source "https://github.com/noeltom30/WebMsh" `
  --branch "main" `
  --app-location "frontend" `
  --output-location "dist" `
  --login-with-github
```

After SWA URL is known, update backend env:

```powershell
$FRONTEND_URL = "https://<your-swa-url>.azurestaticapps.net"

az containerapp update `
  --name $APP `
  --resource-group $RG `
  --set-env-vars `
    WEBMSH_FRONTEND_URL=$FRONTEND_URL `
    WEBMSH_CORS_ORIGINS=$FRONTEND_URL
```

---

## 3) Notes for this repo

- Your frontend already supports env API base via `VITE_API_BASE`.
- Your backend currently defaults CORS to localhost and cookie `SameSite=lax`; adjust as above for production.
- SQLite is currently file-based in backend code; use mounted Azure Files to persist data across restarts.

