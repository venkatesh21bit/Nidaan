# ===========================================
# Nidaan AI - IBM Cloud Code Engine Deployment
# ===========================================

# Configuration
$PROJECT_NAME = "nidaan-triage"
$APP_NAME = "nidaan-api"
$REGION = "us-south"
$RESOURCE_GROUP = "Default"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Nidaan AI - IBM Cloud Deployment" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Check if IBM Cloud CLI is installed
if (-not (Get-Command ibmcloud -ErrorAction SilentlyContinue)) {
    Write-Host "`n[ERROR] IBM Cloud CLI not found!" -ForegroundColor Red
    Write-Host "`nPlease install IBM Cloud CLI from:" -ForegroundColor Yellow
    Write-Host "https://cloud.ibm.com/docs/cli?topic=cli-install-ibmcloud-cli" -ForegroundColor White
    Write-Host "`nOr run:" -ForegroundColor Yellow
    Write-Host "iex(New-Object Net.WebClient).DownloadString('https://clis.cloud.ibm.com/install/powershell')" -ForegroundColor White
    exit 1
}

# Step 1: Login to IBM Cloud
Write-Host "`n[1/6] Logging in to IBM Cloud..." -ForegroundColor Yellow
ibmcloud login --sso
if ($LASTEXITCODE -ne 0) {
    Write-Host "Login failed. Please try again." -ForegroundColor Red
    exit 1
}

# Step 2: Target resource group
Write-Host "`n[2/6] Setting target resource group..." -ForegroundColor Yellow
ibmcloud target -g $RESOURCE_GROUP -r $REGION

# Step 3: Install Code Engine plugin if not installed
Write-Host "`n[3/6] Checking Code Engine plugin..." -ForegroundColor Yellow
$plugins = ibmcloud plugin list
if ($plugins -notmatch "code-engine") {
    Write-Host "Installing Code Engine plugin..." -ForegroundColor Yellow
    ibmcloud plugin install code-engine -f
}

# Step 4: Create or select Code Engine project
Write-Host "`n[4/6] Setting up Code Engine project..." -ForegroundColor Yellow
$projects = ibmcloud ce project list --output json 2>$null | ConvertFrom-Json
$projectExists = $projects | Where-Object { $_.name -eq $PROJECT_NAME }

if (-not $projectExists) {
    Write-Host "Creating new project: $PROJECT_NAME" -ForegroundColor Yellow
    ibmcloud ce project create --name $PROJECT_NAME
} else {
    Write-Host "Project exists, selecting: $PROJECT_NAME" -ForegroundColor Green
}

ibmcloud ce project select --name $PROJECT_NAME

# Step 5: Create secrets for environment variables
Write-Host "`n[5/6] Creating secrets for environment variables..." -ForegroundColor Yellow

# Read .env file and create secrets
$envFile = ".env"
if (Test-Path $envFile) {
    # Create a configmap/secret from env file
    ibmcloud ce secret create --name nidaan-secrets --from-env-file $envFile --force
    Write-Host "Secrets created from .env file" -ForegroundColor Green
} else {
    Write-Host "[WARNING] .env file not found. Creating secrets manually..." -ForegroundColor Yellow
    
    # Create secrets individually
    ibmcloud ce secret create --name nidaan-secrets `
        --from-literal CLOUDANT_URL="https://01e1127e-8c45-41c4-9495-6755487a914d-bluemix.cloudantnosqldb.appdomain.cloud" `
        --from-literal CLOUDANT_API_KEY="mN-57wP97ujEMjTuMGI9d0ojRksj-DSPpYWoHQOlw4Py" `
        --from-literal CLOUDANT_DATABASE_NAME="nidaan_triage" `
        --from-literal IBM_STT_API_KEY="1rAK9tt3QiboojI6Ebqb1l6_h0zttUrjZtC7OHbu2BtG" `
        --from-literal IBM_STT_URL="https://api.us-south.speech-to-text.watson.cloud.ibm.com/instances/563687ea-153a-4c51-a0f4-b3c483984e74" `
        --from-literal IBM_NLU_API_KEY="u-GvYITBy02fnYmh7gJ8gNV51yIqIyHLqDWzBsAP69Qz" `
        --from-literal IBM_NLU_URL="https://api.us-south.natural-language-understanding.watson.cloud.ibm.com/instances/1fef2934-be73-4593-bfcf-1041451e98a8" `
        --from-literal SMTP_SERVER="smtp.gmail.com" `
        --from-literal SMTP_PORT="587" `
        --from-literal SMTP_EMAIL="venkatesh.k21062005@gmail.com" `
        --from-literal SMTP_PASSWORD="ywqc fghh kgdv kaqe" `
        --force
}

# Step 6: Build and deploy the application
Write-Host "`n[6/6] Building and deploying application..." -ForegroundColor Yellow

# Check if app exists
$apps = ibmcloud ce app list --output json 2>$null | ConvertFrom-Json
$appExists = $apps | Where-Object { $_.metadata.name -eq $APP_NAME }

if ($appExists) {
    Write-Host "Updating existing application..." -ForegroundColor Yellow
    ibmcloud ce app update --name $APP_NAME `
        --build-source . `
        --env-from-secret nidaan-secrets `
        --port 8000 `
        --min-scale 0 `
        --max-scale 3 `
        --cpu 0.5 `
        --memory 1G
} else {
    Write-Host "Creating new application..." -ForegroundColor Yellow
    ibmcloud ce app create --name $APP_NAME `
        --build-source . `
        --env-from-secret nidaan-secrets `
        --port 8000 `
        --min-scale 0 `
        --max-scale 3 `
        --cpu 0.5 `
        --memory 1G
}

# Wait for deployment
Write-Host "`nWaiting for deployment to complete..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Get application URL
Write-Host "`n=========================================" -ForegroundColor Green
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

$appInfo = ibmcloud ce app get --name $APP_NAME --output json | ConvertFrom-Json
$appUrl = $appInfo.status.url

Write-Host "`nApplication URL: $appUrl" -ForegroundColor Cyan
Write-Host "`nAPI Endpoints:" -ForegroundColor Yellow
Write-Host "  - Health Check: $appUrl/health" -ForegroundColor White
Write-Host "  - API Docs: $appUrl/docs" -ForegroundColor White
Write-Host "  - Urgent Cases: $appUrl/api/v1/triage/urgent-cases" -ForegroundColor White
Write-Host "  - OpenAPI Spec: $appUrl/openapi.json" -ForegroundColor White

Write-Host "`n[NEXT STEPS]" -ForegroundColor Yellow
Write-Host "1. Update APP_BASE_URL in secrets to: $appUrl" -ForegroundColor White
Write-Host "2. Upload openapi_orchestrate.json to watsonx Orchestrate" -ForegroundColor White
Write-Host "3. Set the server URL in Orchestrate to: $appUrl" -ForegroundColor White

# Update APP_BASE_URL
Write-Host "`nUpdating APP_BASE_URL in secrets..." -ForegroundColor Yellow
ibmcloud ce secret update --name nidaan-secrets --from-literal APP_BASE_URL="$appUrl" --force

Write-Host "`nDone!" -ForegroundColor Green
