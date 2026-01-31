# Nidaan AI - IBM Cloud Deployment Guide

## Prerequisites

1. **IBM Cloud Account** - [Sign up](https://cloud.ibm.com/registration)
2. **IBM Cloud CLI** - Install from [IBM Cloud CLI Docs](https://cloud.ibm.com/docs/cli)

## Quick Deploy (PowerShell)

```powershell
cd c:\Users\91902\OneDrive\Documents\Nidaan\apps\api
.\deploy-ibm.ps1
```

## Manual Deployment Steps

### Step 1: Install IBM Cloud CLI

**Windows (PowerShell as Admin):**
```powershell
iex(New-Object Net.WebClient).DownloadString('https://clis.cloud.ibm.com/install/powershell')
```

### Step 2: Login to IBM Cloud

```bash
ibmcloud login --sso
```

### Step 3: Install Code Engine Plugin

```bash
ibmcloud plugin install code-engine
```

### Step 4: Create Code Engine Project

```bash
ibmcloud ce project create --name nidaan-triage
ibmcloud ce project select --name nidaan-triage
```

### Step 5: Create Secrets

```bash
ibmcloud ce secret create --name nidaan-secrets \
  --from-literal CLOUDANT_URL="https://01e1127e-8c45-41c4-9495-6755487a914d-bluemix.cloudantnosqldb.appdomain.cloud" \
  --from-literal CLOUDANT_API_KEY="YOUR_CLOUDANT_API_KEY" \
  --from-literal CLOUDANT_DATABASE_NAME="nidaan_triage" \
  --from-literal IBM_STT_API_KEY="YOUR_STT_API_KEY" \
  --from-literal IBM_STT_URL="https://api.us-south.speech-to-text.watson.cloud.ibm.com/instances/YOUR_INSTANCE" \
  --from-literal IBM_NLU_API_KEY="YOUR_NLU_API_KEY" \
  --from-literal IBM_NLU_URL="https://api.us-south.natural-language-understanding.watson.cloud.ibm.com/instances/YOUR_INSTANCE" \
  --from-literal SMTP_SERVER="smtp.gmail.com" \
  --from-literal SMTP_PORT="587" \
  --from-literal SMTP_EMAIL="your-email@gmail.com" \
  --from-literal SMTP_PASSWORD="your-app-password"
```

### Step 6: Deploy Application

```bash
cd apps/api
ibmcloud ce app create --name nidaan-api \
  --build-source . \
  --env-from-secret nidaan-secrets \
  --port 8000 \
  --min-scale 0 \
  --max-scale 3 \
  --cpu 0.5 \
  --memory 1G
```

### Step 7: Get Application URL

```bash
ibmcloud ce app get --name nidaan-api
```

## Post-Deployment

### Update APP_BASE_URL

After deployment, update the APP_BASE_URL secret with your deployed URL:

```bash
ibmcloud ce secret update --name nidaan-secrets \
  --from-literal APP_BASE_URL="https://nidaan-api.xxxxx.us-south.codeengine.appdomain.cloud"
```

### Verify Deployment

```bash
# Health check
curl https://YOUR_APP_URL/health

# API documentation
open https://YOUR_APP_URL/docs

# Test urgent cases endpoint
curl https://YOUR_APP_URL/api/v1/triage/urgent-cases
```

## watsonx Orchestrate Integration

1. Go to [IBM watsonx Orchestrate](https://www.ibm.com/products/watsonx-orchestrate)
2. Click **"Add a Tool"** → **"Import API"**
3. Upload `openapi_orchestrate.json`
4. Set server URL to your deployed API URL
5. Test: *"Do we have any urgent patients waiting?"*

## Monitoring & Logs

```bash
# View application logs
ibmcloud ce app logs --name nidaan-api

# View build logs
ibmcloud ce buildrun logs --name nidaan-api-build-xxxxx

# Check application status
ibmcloud ce app get --name nidaan-api
```

## Scaling

```bash
# Update scaling settings
ibmcloud ce app update --name nidaan-api \
  --min-scale 1 \
  --max-scale 10
```

## Cleanup

```bash
# Delete application
ibmcloud ce app delete --name nidaan-api

# Delete project
ibmcloud ce project delete --name nidaan-triage
```

## Troubleshooting

### Build Fails
- Check `.ceignore` file
- Ensure `requirements.txt` is valid
- View build logs: `ibmcloud ce buildrun logs --build nidaan-api`

### App Won't Start
- Check secrets are properly configured
- View app logs: `ibmcloud ce app logs --name nidaan-api`
- Ensure port 8000 is exposed

### IBM Services Connection Issues
- Verify API keys are correct
- Check service URLs match your region (us-south)
- Ensure services are in the same IBM Cloud account
