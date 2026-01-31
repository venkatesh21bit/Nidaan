# 🚀 Quick Start - Nidaan.ai

## Fastest Way to Get Started (1 minute)

### Using PowerShell Script (Recommended)

1. Open PowerShell in the project directory
2. Run: `.\start.ps1`
3. Choose option 1 (Docker Compose)
4. Wait for services to start
5. Open http://localhost:3000

### Manual Quick Start

```powershell
# Copy environment files
cp apps\api\.env.example apps\api\.env
cp apps\web\.env.local.example apps\web\.env.local

# Start with Docker
docker-compose up -d

# Open browser
start http://localhost:3000
```

## 📱 Demo Accounts

**Doctor Dashboard:**
- URL: http://localhost:3000/login
- Email: `doctor@nidaan.ai`
- Password: `password`

**Patient Interface:**
- URL: http://localhost:3000/patient
- Email: `patient@nidaan.ai`
- Password: `password`

## 🧪 Test the AI Pipeline

1. **Login as Patient**
2. **Select Language** (Hindi, Tamil, English, etc.)
3. **Record Audio**: Click "Record" and say:
   
   ```
   English: "I have chest pain since this morning. The pain spreads to my left arm. I'm having difficulty breathing."
   
   Hindi: "मुझे आज सुबह से सीने में दर्द है। दर्द मेरे बाएं हाथ में फैल रहा है। मुझे सांस लेने में तकलीफ हो रही है।"
   ```

4. **Submit** the recording
5. **Switch to Doctor Account** (new browser tab)
6. **View the Visit** on the dashboard
7. **See AI-Generated**:
   - SOAP Note (4 sections)
   - Differential Diagnosis
   - Red Flag Alerts
   - Translated Text

## 📚 Important URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/api/docs
- **Interactive API**: http://localhost:8000/api/redoc

## 🔧 Common Commands

```powershell
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart a service
docker-compose restart api

# Rebuild after code changes
docker-compose up -d --build
```

## 📖 Full Documentation

- **Setup Guide**: See `SETUP.md`
- **Project Details**: See `README.md`
- **Completion Summary**: See `PROJECT_COMPLETE.md`

## ⚠️ Troubleshooting

**Port already in use?**
```powershell
# Check what's using port 8000
netstat -ano | findstr :8000

# Or change port in docker-compose.yml
```

**Docker not starting?**
- Make sure Docker Desktop is running
- Check Docker has enough memory allocated (4GB+)

**Can't access frontend?**
- Wait 30 seconds for services to fully start
- Check logs: `docker-compose logs web`

## 🎯 What to Try

1. ✅ Record patient symptoms in multiple languages
2. ✅ View real-time dashboard updates
3. ✅ Check red flag detection
4. ✅ Review differential diagnoses
5. ✅ Test with different symptom scenarios
6. ✅ Customize the UI/prompts
7. ✅ Deploy to AWS

## 💡 Tips

- **Mock Mode**: Backend runs in mock mode by default (no AWS needed)
- **Real AWS**: Add AWS credentials to `apps/api/.env` for production
- **Customize**: All AI prompts are in `apps/api/app/services/llm_engine/prompts.py`
- **Languages**: Add more languages in patient interface

---

**Need Help?** Check `SETUP.md` for detailed instructions and troubleshooting.

**Ready to Deploy?** See `README.md` deployment section.

🎉 **Enjoy building the future of healthcare documentation!**
