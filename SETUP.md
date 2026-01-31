# Nidaan.ai - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Option 1: Docker Compose (Recommended for Quick Start)

1. **Prerequisites**
   - Docker Desktop installed
   - Git installed

2. **Clone and Start**
   ```bash
   git clone <your-repo-url>
   cd Nidaan
   
   # Copy environment files
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.local.example apps/web/.env.local
   
   # Start all services
   docker-compose up -d
   ```

3. **Access the Application**
   - Frontend: http://localhost:3000
   - API: http://localhost:8000
   - API Docs: http://localhost:8000/api/docs

4. **Login with Demo Accounts**
   - Doctor: `doctor@nidaan.ai` / `password`
   - Patient: `patient@nidaan.ai` / `password`

---

### Option 2: Manual Setup (For Development)

#### Backend Setup

1. **Install Python 3.11+**

2. **Setup Backend**
   ```bash
   cd apps/api
   
   # Create virtual environment
   python -m venv venv
   
   # Activate virtual environment
   # On Windows:
   venv\Scripts\activate
   # On Mac/Linux:
   source venv/bin/activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Copy environment file
   cp .env.example .env
   
   # Edit .env and set:
   # - JWT_SECRET (use a secure random string)
   # - AWS credentials (if using real AWS services)
   # - DYNAMODB_ENDPOINT_URL=http://localhost:8001 (for local DynamoDB)
   ```

3. **Install Local DynamoDB (Optional but Recommended)**
   ```bash
   # Using Docker
   docker run -p 8001:8000 amazon/dynamodb-local
   ```

4. **Run Backend**
   ```bash
   # Make sure you're in apps/api and venv is activated
   uvicorn app.main:app --reload --port 8000
   ```

   Backend will be available at http://localhost:8000

#### Frontend Setup

1. **Install Node.js 18+**

2. **Setup Frontend**
   ```bash
   cd apps/web
   
   # Install dependencies
   npm install
   
   # Copy environment file
   cp .env.local.example .env.local
   
   # Edit .env.local and set:
   # NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
   ```

3. **Run Frontend**
   ```bash
   npm run dev
   ```

   Frontend will be available at http://localhost:3000

---

## 📱 Testing the Application

### As a Patient

1. Go to http://localhost:3000
2. Click "Patient Interface" or navigate to http://localhost:3000/patient
3. Login (or click "Try without login" if available)
4. Select your language (Hindi, Tamil, etc.)
5. Click "Record" and speak your symptoms
6. Click "Stop" when done
7. Click "Submit" to process

**Example symptoms to say (in English):**
> "I have chest pain that started this morning. The pain is spreading to my left arm. I'm also having difficulty breathing and feeling dizzy."

### As a Doctor

1. Go to http://localhost:3000
2. Click "Doctor Dashboard"
3. Login with: `doctor@nidaan.ai` / `password`
4. You'll see the dashboard with:
   - Today's visits count
   - Pending reviews
   - High-risk patients
   - List of all visits
5. Click on any visit to see:
   - Full SOAP note
   - Differential diagnosis
   - Red flag alerts
   - Original transcript

---

## 🔧 Configuration

### Backend Configuration (apps/api/.env)

```env
# Essential Settings
ENV=development
DEBUG=True
JWT_SECRET=your-secret-key-here  # Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"

# For Development (Mock Mode)
# Leave AWS credentials empty to use mock services
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Database (Local Development)
DYNAMODB_ENDPOINT_URL=http://localhost:8001

# For Production AWS Deployment
# Set real AWS credentials and remove DYNAMODB_ENDPOINT_URL
```

### Frontend Configuration (apps/web/.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

---

## 🐛 Troubleshooting

### Backend Issues

**Issue: ModuleNotFoundError**
```bash
# Solution: Make sure virtual environment is activated and dependencies installed
pip install -r requirements.txt
```

**Issue: DynamoDB connection error**
```bash
# Solution: Start local DynamoDB
docker run -p 8001:8000 amazon/dynamodb-local

# Or use mock mode by commenting out DYNAMODB_ENDPOINT_URL in .env
```

**Issue: Port 8000 already in use**
```bash
# Solution: Change port
uvicorn app.main:app --reload --port 8001

# Update frontend .env.local to point to new port
```

### Frontend Issues

**Issue: npm install fails**
```bash
# Solution: Clear npm cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Issue: Module not found errors**
```bash
# Solution: Reinstall dependencies
rm -rf node_modules .next
npm install
npm run dev
```

**Issue: API connection errors**
- Check that backend is running on http://localhost:8000
- Verify NEXT_PUBLIC_API_URL in .env.local matches backend URL
- Check browser console for CORS errors

### Docker Issues

**Issue: Container won't start**
```bash
# View logs
docker-compose logs api
docker-compose logs web

# Restart specific service
docker-compose restart api
```

**Issue: Port conflicts**
```bash
# Stop all containers
docker-compose down

# Check what's using the port
# On Windows:
netstat -ano | findstr :8000

# On Mac/Linux:
lsof -i :8000

# Kill the process or change port in docker-compose.yml
```

---

## 📊 Development Workflow

### Making Changes to Backend

1. Edit files in `apps/api/`
2. Backend will auto-reload (if using `--reload` flag)
3. Test at http://localhost:8000/api/docs

### Making Changes to Frontend

1. Edit files in `apps/web/`
2. Frontend will auto-reload
3. View changes at http://localhost:3000

### Adding New API Endpoints

1. Create route file in `apps/api/app/api/v1/`
2. Define Pydantic schemas in `apps/api/app/schemas/`
3. Add route to `apps/api/app/api/v1/router.py`
4. Test using FastAPI docs or Postman

### Adding New Frontend Pages

1. Create page in `apps/web/app/[route]/page.tsx`
2. Use shared components from `apps/web/components/`
3. Access at http://localhost:3000/[route]

---

## 🚀 Deployment Checklist

### Before Production Deployment

- [ ] Change JWT_SECRET to a secure random string
- [ ] Set up real AWS credentials
- [ ] Configure production database (DynamoDB)
- [ ] Set up S3 bucket for audio storage
- [ ] Configure SQS queue for async processing
- [ ] Set up AWS Bedrock access
- [ ] Enable HTTPS/SSL
- [ ] Set up monitoring and logging
- [ ] Configure backups
- [ ] Test with real data
- [ ] Set up CI/CD pipeline

---

## 📞 Need Help?

- **Documentation Issues**: Check README.md
- **Code Issues**: Review inline comments
- **API Questions**: Visit http://localhost:8000/api/docs
- **Bugs**: Create an issue on GitHub

---

## 🎯 Next Steps

1. ✅ Get the app running locally
2. ✅ Test patient recording flow
3. ✅ Test doctor dashboard
4. 🔄 Customize for your use case
5. 🔄 Deploy to production
6. 🔄 Connect real AWS services

**Happy Coding! 🎉**
