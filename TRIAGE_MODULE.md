# 🏥 Nidaan Voice Triage Module

## IBM Cloud Implementation for Autonomous Patient Intake & Triage

This module implements an **AI-powered autonomous patient intake and triage system** using IBM Cloud services. It handles the logistical friction before the doctor sees the patient.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Workflow Steps](#workflow-steps)
3. [IBM Cloud Services Setup](#ibm-cloud-services-setup)
4. [API Endpoints](#api-endpoints)
5. [watsonx Orchestrate Integration](#watsonx-orchestrate-integration)
6. [Frontend Components](#frontend-components)
7. [Configuration](#configuration)
8. [Deployment](#deployment)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NIDAAN VOICE TRIAGE SYSTEM                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   Patient    │───▶│   Voice/     │───▶│   Triage     │              │
│  │   Frontend   │    │   Survey     │    │   Engine     │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│         │                   │                   │                       │
│         ▼                   ▼                   ▼                       │
│  ┌──────────────────────────────────────────────────────┐              │
│  │                 IBM CLOUD SERVICES                    │              │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │              │
│  │  │  Watson    │  │  Watson    │  │  Cloudant  │     │              │
│  │  │  STT       │  │  NLU       │  │  Database  │     │              │
│  │  └────────────┘  └────────────┘  └────────────┘     │              │
│  └──────────────────────────────────────────────────────┘              │
│         │                   │                   │                       │
│         ▼                   ▼                   ▼                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   Email      │    │   Severity   │    │   EHR        │              │
│  │   Alerts     │    │   Scoring    │    │   Update     │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│         │                                       │                       │
│         ▼                                       ▼                       │
│  ┌──────────────────────────────────────────────────────┐              │
│  │              IBM watsonx Orchestrate                  │              │
│  │         (Doctor's AI Assistant Interface)             │              │
│  └──────────────────────────────────────────────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Workflow Steps

### The Agentic Workflow

#### **Trigger: Patient Books an Appointment**

```
Patient books appointment → System activates triage workflow
```

#### **Action 1: Outreach (Email Survey)**

- System sends a **personalized pre-consultation survey** via email
- Survey questions are tailored based on:
  - Patient's medical history
  - Reason for appointment
  - Previous conditions/medications

```python
# Example: Appointment triggers survey
POST /api/v1/triage/appointments
{
    "patient_id": "P12345",
    "patient_name": "John Doe",
    "patient_email": "john@example.com",
    "doctor_id": "D001",
    "doctor_name": "Dr. Smith",
    "appointment_date": "2024-01-20",
    "appointment_time": "10:00",
    "reason": "chest pain and shortness of breath"
}
```

#### **Action 2: Processing (NLU Extraction)**

- Patient submits survey response OR records voice input
- **IBM Watson Speech-to-Text** converts audio to text
- **IBM Watson NLU** extracts:
  - Symptoms
  - Medications
  - Conditions
  - Allergies
  - Duration of symptoms

```python
# Example: Extracted entities
{
    "symptoms": ["chest pain", "shortness of breath", "fatigue"],
    "medications": ["aspirin", "lisinopril"],
    "allergies": ["penicillin"],
    "durations": ["3 days"],
    "vital_signs": ["pain_level:7"]
}
```

#### **Action 3: Integration (EHR Update)**

- System creates a **structured summary** from extracted data
- Updates the **IBM Cloudant** database with:
  - Triage case record
  - EHR update document
  - Linked appointment

```python
# Example: EHR Update structure
{
    "type": "ehr_update",
    "patient_id": "P12345",
    "summary": {
        "chief_complaint": ["chest pain", "shortness of breath"],
        "current_medications": ["aspirin", "lisinopril"],
        "allergies": ["penicillin"],
        "pain_level": 7,
        "symptom_duration": "3 days"
    },
    "severity_assessment": "HIGH",
    "red_flags_detected": ["chest pain", "shortness of breath"]
}
```

#### **Action 4: Flagging (Nurse Alert)**

- If **red flag symptoms** are detected → Auto-alert nurse station
- Red flags include:
  - Chest pain
  - Difficulty breathing
  - Severe bleeding
  - Stroke symptoms
  - Suicidal ideation

```python
# Example: Nurse alert
{
    "alert_type": "RED_FLAG",
    "patient": "John Doe",
    "severity": "HIGH",
    "red_flags": ["chest pain", "shortness of breath"],
    "action_required": "IMMEDIATE ATTENTION"
}
```

---

## 🔧 IBM Cloud Services Setup

### 1. IBM Cloudant (Database)

**Create the database:**

1. Go to [IBM Cloud Catalog](https://cloud.ibm.com/catalog/services/cloudant)
2. Create a Cloudant instance
3. Create a database named `nidaan_triage`
4. Get API credentials from Service Credentials tab

```bash
# Environment variables
CLOUDANT_URL=https://your-instance.cloudantnosqldb.appdomain.cloud
CLOUDANT_API_KEY=your-api-key
CLOUDANT_DATABASE_NAME=nidaan_triage
```

### 2. IBM Watson Speech to Text

1. Go to [IBM Cloud Catalog](https://cloud.ibm.com/catalog/services/speech-to-text)
2. Create a Speech-to-Text instance
3. Get API key and URL

```bash
IBM_STT_API_KEY=your-stt-api-key
IBM_STT_URL=https://api.us-south.speech-to-text.watson.cloud.ibm.com
```

### 3. IBM Watson Natural Language Understanding

1. Go to [IBM Cloud Catalog](https://cloud.ibm.com/catalog/services/natural-language-understanding)
2. Create an NLU instance
3. Get API key and URL

```bash
IBM_NLU_API_KEY=your-nlu-api-key
IBM_NLU_URL=https://api.us-south.natural-language-understanding.watson.cloud.ibm.com
```

### 4. IBM Code Engine (Deployment)

Deploy the FastAPI application to Code Engine:

```bash
# Build and deploy
ibmcloud ce application create \
  --name nidaan-triage-api \
  --image your-registry/nidaan-api:latest \
  --port 8000 \
  --env-from-secret nidaan-secrets
```

---

## 📡 API Endpoints

### Patient Frontend Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/triage/appointments` | POST | Book appointment (triggers workflow) |
| `/api/v1/triage/surveys/respond` | POST | Submit survey response |
| `/api/v1/triage/voice` | POST | Submit voice recording for triage |

### Orchestrate API Endpoints (For watsonx)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/triage/api/urgent-cases` | GET | Get all urgent (HIGH) cases |
| `/api/v1/triage/api/cases/{case_id}/seen` | POST | Mark case as seen |
| `/api/v1/triage/api/cases/{case_id}` | GET | Get case details |
| `/api/v1/triage/api/cases` | GET | List cases by severity |

### Admin/Nurse Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/triage/cases` | POST | Create manual triage case |
| `/api/v1/triage/cases/{case_id}` | PATCH | Update case status |
| `/api/v1/triage/health` | GET | Health check |

---

## 🤖 watsonx Orchestrate Integration

### Setup Steps

1. **Generate OpenAPI Spec:**
   ```bash
   cd apps/api
   python generate_openapi.py
   ```

2. **Upload to Orchestrate:**
   - Go to watsonx Orchestrate
   - Click "Add a Tool"
   - Upload `openapi_orchestrate.json`

3. **Test the Integration:**
   
   **Doctor:** "Do we have any urgent patients waiting?"
   
   **Orchestrate Agent:** *Calls GET /api/urgent-cases*
   
   **Orchestrate Agent:** "Yes, there are 2 urgent cases:
   - Patient John Doe has breathing trouble
   - Patient Jane Smith has chest pain
   Should I mark any of them as seen?"

### Example Conversation Flow

```
Doctor: "Do we have any urgent patients waiting?"

Agent: [Calls GET /api/v1/triage/api/urgent-cases]
       "Yes, there are 2 urgent cases:
       1. Patient 101 (John Doe) - breathing trouble
       2. Patient 102 (Jane Smith) - severe chest pain
       Should I mark them as 'Seen'?"

Doctor: "Tell me more about patient 101"

Agent: [Calls GET /api/v1/triage/api/cases/triage_abc123]
       "Patient John Doe:
       - Symptoms: cough, shortness of breath, fever
       - Medications: aspirin, inhaler
       - Red flags: breathing difficulty
       - Submitted at: 10:30 AM today"

Doctor: "Mark patient 101 as seen"

Agent: [Calls POST /api/v1/triage/api/cases/triage_abc123/seen]
       "Done! Patient John Doe has been marked as seen."
```

---

## 🖥️ Frontend Components

### 1. Voice Triage Page (`/patient/triage`)

- Audio recording with browser MediaRecorder API
- Real-time waveform visualization
- Automatic submission to triage pipeline
- Results display with severity badge

### 2. Survey Page (`/patient/survey/[surveyId]`)

- Dynamic question rendering
- Support for text, choice, and scale questions
- Emergency detection with immediate alerts
- Submission to NLU processing pipeline

### 3. Nurse Dashboard (`/nurse/dashboard`)

- Real-time urgent cases display
- Filter by severity level
- Mark cases as seen
- Auto-refresh every 30 seconds

---

## ⚙️ Configuration

### Environment Variables

```bash
# Copy and configure
cp apps/api/.env.ibm apps/api/.env

# Edit with your IBM Cloud credentials
```

### Key Settings

| Variable | Description | Required |
|----------|-------------|----------|
| `CLOUDANT_URL` | Cloudant instance URL | Yes |
| `CLOUDANT_API_KEY` | Cloudant API key | Yes |
| `IBM_STT_API_KEY` | Speech-to-Text API key | Yes |
| `IBM_NLU_API_KEY` | NLU API key | Yes |
| `SMTP_EMAIL` | Email for surveys | Yes |
| `SMTP_PASSWORD` | Email app password | Yes |
| `NURSE_STATION_EMAIL` | Alert recipient | Yes |

---

## 🚀 Deployment

### Local Development

```bash
# Backend
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd apps/web
npm install
npm run dev
```

### IBM Code Engine Deployment

```bash
# Build Docker image
docker build -t nidaan-api:latest apps/api/

# Push to IBM Container Registry
docker tag nidaan-api:latest us.icr.io/your-namespace/nidaan-api:latest
docker push us.icr.io/your-namespace/nidaan-api:latest

# Deploy to Code Engine
ibmcloud ce application create \
  --name nidaan-triage-api \
  --image us.icr.io/your-namespace/nidaan-api:latest \
  --port 8000
```

---

## 📊 Severity Scoring Logic

```python
RED_FLAG_SYMPTOMS = {
    # Cardiac - Immediate attention
    "chest pain": HIGH,
    "difficulty breathing": HIGH,
    "shortness of breath": HIGH,
    
    # Neurological
    "sudden numbness": HIGH,
    "stroke": HIGH,
    "seizure": HIGH,
    
    # Bleeding
    "severe bleeding": HIGH,
    "vomiting blood": HIGH,
    
    # Other critical
    "loss of consciousness": HIGH,
    "suicidal": HIGH,
    "overdose": HIGH,
}

# Scoring Algorithm:
# 1. Check for red flag symptoms → HIGH
# 2. Count urgency keywords → Adjust severity
# 3. Breathing difficulties → Always HIGH
# 4. Multiple symptoms → Increase severity
```

---

## 📁 File Structure

```
apps/api/
├── app/
│   ├── services/
│   │   └── ibm/
│   │       ├── __init__.py
│   │       ├── cloudant.py          # Cloudant database service
│   │       ├── email_service.py     # Email outreach
│   │       ├── nlu_processor.py     # Watson NLU integration
│   │       ├── speech_to_text.py    # Watson STT integration
│   │       └── triage_engine.py     # Core triage logic
│   ├── api/v1/
│   │   └── triage.py               # API endpoints
│   ├── schemas/
│   │   └── triage.py               # Pydantic models
│   └── core/
│       └── config.py               # IBM Cloud config
├── generate_openapi.py             # Orchestrate spec generator
└── .env.ibm                        # IBM Cloud credentials

apps/web/app/
├── patient/
│   ├── triage/page.tsx             # Voice recording page
│   └── survey/[surveyId]/page.tsx  # Survey form
└── nurse/
    └── dashboard/page.tsx          # Nurse triage dashboard
```

---

## 🔒 Security Considerations

1. **API Authentication**: Implement JWT tokens for all endpoints
2. **HIPAA Compliance**: Encrypt patient data at rest and in transit
3. **Email Security**: Use app-specific passwords, not main credentials
4. **Rate Limiting**: Prevent abuse of voice transcription endpoints
5. **Audit Logging**: Log all triage actions for compliance

---

## 🧪 Testing

```bash
# Run API tests
cd apps/api
pytest tests/

# Test triage endpoint
curl -X POST http://localhost:8000/api/v1/triage/voice \
  -F "audio=@test_audio.webm" \
  -F "patient_id=TEST001" \
  -F "patient_name=Test Patient"
```

---

## 📞 Support

For issues with IBM Cloud services:
- [IBM Cloud Documentation](https://cloud.ibm.com/docs)
- [Watson API Reference](https://cloud.ibm.com/apidocs)

For Nidaan-specific issues:
- Create an issue in the repository
- Contact: support@nidaan.ai
