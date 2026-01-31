# Nidaan.ai - Startup Script
# Run this script to start the application

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Nidaan.ai - Startup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
$dockerRunning = $false
try {
    docker ps | Out-Null
    $dockerRunning = $true
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not running" -ForegroundColor Red
    Write-Host "Please start Docker Desktop first" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Choose startup method:" -ForegroundColor Yellow
Write-Host "1. Docker Compose (Recommended - All services in containers)" -ForegroundColor White
Write-Host "2. Manual (Backend + Frontend separately)" -ForegroundColor White
Write-Host "3. Backend Only" -ForegroundColor White
Write-Host "4. Frontend Only" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter your choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Starting with Docker Compose..." -ForegroundColor Cyan
        Write-Host ""
        
        # Check if .env files exist
        if (-not (Test-Path "apps\api\.env")) {
            Write-Host "Creating backend .env file..." -ForegroundColor Yellow
            Copy-Item "apps\api\.env.example" "apps\api\.env"
            Write-Host "✓ Created apps\api\.env" -ForegroundColor Green
        }
        
        if (-not (Test-Path "apps\web\.env.local")) {
            Write-Host "Creating frontend .env file..." -ForegroundColor Yellow
            Copy-Item "apps\web\.env.local.example" "apps\web\.env.local"
            Write-Host "✓ Created apps\web\.env.local" -ForegroundColor Green
        }
        
        Write-Host ""
        Write-Host "Starting all services..." -ForegroundColor Yellow
        docker-compose up -d
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "   Services Started Successfully!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Access URLs:" -ForegroundColor Yellow
        Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor White
        Write-Host "  Backend:   http://localhost:8000" -ForegroundColor White
        Write-Host "  API Docs:  http://localhost:8000/api/docs" -ForegroundColor White
        Write-Host ""
        Write-Host "Demo Accounts:" -ForegroundColor Yellow
        Write-Host "  Doctor:  doctor@nidaan.ai / password" -ForegroundColor White
        Write-Host "  Patient: patient@nidaan.ai / password" -ForegroundColor White
        Write-Host ""
        Write-Host "To view logs: docker-compose logs -f" -ForegroundColor Cyan
        Write-Host "To stop:      docker-compose down" -ForegroundColor Cyan
    }
    
    "2" {
        Write-Host ""
        Write-Host "Starting Manual Mode..." -ForegroundColor Cyan
        Write-Host ""
        Write-Host "This will open 2 terminal windows:" -ForegroundColor Yellow
        Write-Host "  1. Backend (FastAPI)" -ForegroundColor White
        Write-Host "  2. Frontend (Next.js)" -ForegroundColor White
        Write-Host ""
        
        # Start Backend
        Write-Host "Starting Backend..." -ForegroundColor Yellow
        Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
            Write-Host 'Nidaan.ai - Backend (FastAPI)' -ForegroundColor Cyan
            Write-Host ''
            cd '$PWD\apps\api'
            
            if (-not (Test-Path 'venv')) {
                Write-Host 'Creating virtual environment...' -ForegroundColor Yellow
                python -m venv venv
            }
            
            Write-Host 'Activating virtual environment...' -ForegroundColor Yellow
            .\venv\Scripts\Activate.ps1
            
            if (-not (Test-Path '.env')) {
                Write-Host 'Creating .env file...' -ForegroundColor Yellow
                Copy-Item '.env.example' '.env'
            }
            
            Write-Host 'Installing dependencies...' -ForegroundColor Yellow
            pip install -r requirements.txt
            
            Write-Host ''
            Write-Host 'Starting FastAPI server...' -ForegroundColor Green
            Write-Host 'API will be available at: http://localhost:8000' -ForegroundColor Cyan
            Write-Host 'API Docs: http://localhost:8000/api/docs' -ForegroundColor Cyan
            Write-Host ''
            
            uvicorn app.main:app --reload
"@
        
        Start-Sleep -Seconds 2
        
        # Start Frontend
        Write-Host "Starting Frontend..." -ForegroundColor Yellow
        Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
            Write-Host 'Nidaan.ai - Frontend (Next.js)' -ForegroundColor Cyan
            Write-Host ''
            cd '$PWD\apps\web'
            
            if (-not (Test-Path 'node_modules')) {
                Write-Host 'Installing dependencies...' -ForegroundColor Yellow
                npm install
            }
            
            if (-not (Test-Path '.env.local')) {
                Write-Host 'Creating .env.local file...' -ForegroundColor Yellow
                Copy-Item '.env.local.example' '.env.local'
            }
            
            Write-Host ''
            Write-Host 'Starting Next.js dev server...' -ForegroundColor Green
            Write-Host 'Frontend will be available at: http://localhost:3000' -ForegroundColor Cyan
            Write-Host ''
            
            npm run dev
"@
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "   Services Starting..." -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Wait a moment for services to start, then access:" -ForegroundColor Yellow
        Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor White
        Write-Host "  Backend:   http://localhost:8000" -ForegroundColor White
        Write-Host "  API Docs:  http://localhost:8000/api/docs" -ForegroundColor White
    }
    
    "3" {
        Write-Host ""
        Write-Host "Starting Backend Only..." -ForegroundColor Cyan
        Write-Host ""
        
        cd apps\api
        
        if (-not (Test-Path "venv")) {
            Write-Host "Creating virtual environment..." -ForegroundColor Yellow
            python -m venv venv
        }
        
        Write-Host "Activating virtual environment..." -ForegroundColor Yellow
        .\venv\Scripts\Activate.ps1
        
        if (-not (Test-Path ".env")) {
            Write-Host "Creating .env file..." -ForegroundColor Yellow
            Copy-Item ".env.example" ".env"
        }
        
        Write-Host "Installing dependencies..." -ForegroundColor Yellow
        pip install -r requirements.txt
        
        Write-Host ""
        Write-Host "Starting FastAPI server..." -ForegroundColor Green
        Write-Host ""
        Write-Host "Backend will be available at: http://localhost:8000" -ForegroundColor Cyan
        Write-Host "API Docs: http://localhost:8000/api/docs" -ForegroundColor Cyan
        Write-Host ""
        
        uvicorn app.main:app --reload
    }
    
    "4" {
        Write-Host ""
        Write-Host "Starting Frontend Only..." -ForegroundColor Cyan
        Write-Host ""
        
        cd apps\web
        
        if (-not (Test-Path "node_modules")) {
            Write-Host "Installing dependencies..." -ForegroundColor Yellow
            npm install
        }
        
        if (-not (Test-Path ".env.local")) {
            Write-Host "Creating .env.local file..." -ForegroundColor Yellow
            Copy-Item ".env.local.example" ".env.local"
        }
        
        Write-Host ""
        Write-Host "Starting Next.js dev server..." -ForegroundColor Green
        Write-Host ""
        Write-Host "Frontend will be available at: http://localhost:3000" -ForegroundColor Cyan
        Write-Host ""
        
        npm run dev
    }
    
    default {
        Write-Host "Invalid choice. Exiting." -ForegroundColor Red
        exit 1
    }
}
