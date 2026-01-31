#!/bin/bash
# Nidaan.ai Development Startup Script
# For Linux/Mac users

echo "🏥 Starting Nidaan.ai Development Environment..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start infrastructure services with Docker Compose
echo "📦 Starting infrastructure services (DynamoDB, LocalStack, Redis)..."
docker-compose up -d dynamodb-local localstack redis

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Check if services are healthy
echo "🔍 Checking service health..."
curl -s http://localhost:8001 > /dev/null && echo "✅ DynamoDB Local is ready" || echo "⚠️ DynamoDB Local may not be ready"
curl -s http://localhost:4566/_localstack/health > /dev/null && echo "✅ LocalStack is ready" || echo "⚠️ LocalStack may not be ready"

echo ""
echo "🚀 Starting backend and frontend..."
echo ""

# Open two terminals for backend and frontend
if command -v gnome-terminal &> /dev/null; then
    gnome-terminal -- bash -c "cd apps/api && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000; exec bash"
    gnome-terminal -- bash -c "cd apps/web && npm install && npm run dev; exec bash"
elif command -v osascript &> /dev/null; then
    # macOS
    osascript -e 'tell application "Terminal" to do script "cd '$(pwd)'/apps/api && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"'
    osascript -e 'tell application "Terminal" to do script "cd '$(pwd)'/apps/web && npm install && npm run dev"'
else
    echo "Please start the services manually:"
    echo ""
    echo "Terminal 1 (Backend):"
    echo "  cd apps/api"
    echo "  python -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install -r requirements.txt"
    echo "  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
    echo ""
    echo "Terminal 2 (Frontend):"
    echo "  cd apps/web"
    echo "  npm install"
    echo "  npm run dev"
fi

echo ""
echo "=============================================="
echo "🎉 Nidaan.ai is starting up!"
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000"
echo "📖 API Docs: http://localhost:8000/api/docs"
echo ""
echo "Demo Accounts:"
echo "  Doctor: doctor@nidaan.ai / password"
echo "  Patient: patient@nidaan.ai / password"
echo "=============================================="
