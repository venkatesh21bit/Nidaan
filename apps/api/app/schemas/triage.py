"""
Pydantic schemas for Triage Module
Defines data models for patient intake, triage cases, and orchestrate API
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class SeverityLevel(str, Enum):
    """Severity levels for triage classification"""
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class TriageStatus(str, Enum):
    """Status of a triage case"""
    PENDING = "pending"
    REVIEWED = "reviewed"
    SEEN = "seen"


class SurveyStatus(str, Enum):
    """Status of a pre-consultation survey"""
    PENDING = "pending"
    SENT = "sent"
    COMPLETED = "completed"
    EXPIRED = "expired"


# ==================== APPOINTMENT SCHEMAS ====================

class AppointmentCreate(BaseModel):
    """Schema for creating a new appointment (triggers triage workflow)"""
    patient_id: str = Field(..., description="Unique patient identifier")
    patient_name: str = Field(..., min_length=2, max_length=100)
    patient_email: str = Field(..., description="Patient's email for survey delivery")
    doctor_id: str = Field(..., description="Assigned doctor identifier")
    doctor_name: str = Field(..., description="Doctor's display name")
    appointment_date: str = Field(..., description="Appointment date (YYYY-MM-DD)")
    appointment_time: str = Field(..., description="Appointment time (HH:MM)")
    reason: Optional[str] = Field(None, description="Reason for appointment")
    
    @field_validator('patient_email')
    @classmethod
    def validate_email(cls, v):
        if '@' not in v:
            raise ValueError('Invalid email format')
        return v


class AppointmentResponse(BaseModel):
    """Response after creating an appointment"""
    success: bool
    appointment_id: str
    survey_id: str
    email_sent: bool
    workflow_status: str
    next_step: str


# ==================== SURVEY SCHEMAS ====================

class SurveyQuestion(BaseModel):
    """Individual survey question"""
    id: str
    question: str
    type: str = Field(..., description="text, choice, scale")
    options: Optional[List[str]] = None
    required: bool = True
    urgent: bool = False


class SurveyResponseSubmit(BaseModel):
    """Patient's response to a survey"""
    survey_id: str
    response_text: str = Field(..., description="Free-form text response")
    answers: Optional[Dict[str, str]] = Field(None, description="Question ID to answer mapping")


class SurveyResponseResult(BaseModel):
    """Result of processing a survey response"""
    success: bool
    survey_id: str
    triage_case_id: Optional[str] = None
    severity: Optional[SeverityLevel] = None
    red_flags: List[str] = []
    ehr_updated: bool = False
    nurse_alerted: bool = False


# ==================== VOICE TRIAGE SCHEMAS ====================

class VoiceTriageRequest(BaseModel):
    """Request for voice-based triage"""
    patient_id: str
    patient_name: str
    language: str = Field(default="en-IN", description="Language code (en-IN, hi-IN, etc.)")
    appointment_id: Optional[str] = None


class VoiceTriageResponse(BaseModel):
    """Response from voice triage processing"""
    success: bool
    transcript: Optional[str] = None
    transcription_confidence: Optional[float] = None
    symptoms: List[str] = []
    medications: List[str] = []
    severity_score: Optional[SeverityLevel] = None
    red_flags: List[str] = []
    case_id: Optional[str] = None
    nurse_alerted: bool = False
    ehr_updated: bool = False
    error: Optional[str] = None


# ==================== TRIAGE CASE SCHEMAS ====================

class TriageCaseCreate(BaseModel):
    """Create a triage case manually (bypassing voice/survey)"""
    patient_id: str
    patient_name: str
    symptoms: List[str] = []
    medications: List[str] = []
    notes: str = ""
    appointment_id: Optional[str] = None


class TriageCaseResponse(BaseModel):
    """Triage case data returned by API"""
    case_id: str
    patient_id: str
    patient_name: str
    symptoms: List[str]
    medications: List[str]
    transcript: Optional[str] = None
    severity_score: SeverityLevel
    red_flags: List[str]
    status: TriageStatus
    created_at: str
    updated_at: str
    nurse_alerted: bool
    doctor_notes: Optional[str] = None


class TriageCaseUpdate(BaseModel):
    """Update a triage case (e.g., add doctor notes)"""
    status: Optional[TriageStatus] = None
    doctor_notes: Optional[str] = None


# ==================== ORCHESTRATE API SCHEMAS ====================
# These schemas are specifically designed for IBM watsonx Orchestrate integration

class UrgentCaseItem(BaseModel):
    """
    Individual urgent case for Orchestrate API
    
    This is what the AI agent will receive when checking for urgent patients.
    """
    case_id: str = Field(..., description="Unique triage case identifier")
    patient_id: str = Field(..., description="Patient identifier")
    patient_name: str = Field(..., description="Patient's full name")
    severity: SeverityLevel = Field(..., description="Severity level: HIGH, MEDIUM, or LOW")
    red_flags: List[str] = Field(..., description="List of red flag symptoms detected")
    symptoms: List[str] = Field(..., description="All symptoms reported")
    created_at: str = Field(..., description="ISO timestamp when case was created")
    status: str = Field(..., description="Current case status")
    summary: str = Field(..., description="Human-readable summary for the AI agent")
    
    class Config:
        json_schema_extra = {
            "example": {
                "case_id": "triage_abc123def456",
                "patient_id": "patient_789",
                "patient_name": "John Doe",
                "severity": "HIGH",
                "red_flags": ["breathing difficulty", "chest pain"],
                "symptoms": ["cough", "fever", "shortness of breath"],
                "created_at": "2024-01-15T10:30:00Z",
                "status": "pending",
                "summary": "Patient John Doe has breathing difficulty, chest pain."
            }
        }


class UrgentCasesResponse(BaseModel):
    """
    Response for GET /api/urgent-cases
    
    This is the main endpoint for watsonx Orchestrate to check urgent patients.
    The agent will call this when the doctor asks "Do we have any urgent patients waiting?"
    """
    count: int = Field(..., description="Total number of urgent cases")
    cases: List[UrgentCaseItem] = Field(..., description="List of urgent triage cases")
    retrieved_at: str = Field(..., description="ISO timestamp of retrieval")
    
    class Config:
        json_schema_extra = {
            "example": {
                "count": 2,
                "cases": [
                    {
                        "case_id": "triage_abc123",
                        "patient_id": "101",
                        "patient_name": "John Doe",
                        "severity": "HIGH",
                        "red_flags": ["breathing trouble"],
                        "symptoms": ["cough", "shortness of breath"],
                        "created_at": "2024-01-15T10:30:00Z",
                        "status": "pending",
                        "summary": "Patient John Doe has breathing trouble."
                    }
                ],
                "retrieved_at": "2024-01-15T11:00:00Z"
            }
        }


class MarkCaseSeenRequest(BaseModel):
    """Request to mark a case as seen by the doctor"""
    case_id: str = Field(..., description="Triage case ID to mark as seen")
    doctor_notes: Optional[str] = Field(None, description="Optional notes from the doctor")


class MarkCaseSeenResponse(BaseModel):
    """Response after marking a case as seen"""
    success: bool
    case_id: str
    status: str
    updated_at: str
    message: str = Field(..., description="Confirmation message for the AI agent")


# ==================== EXTRACTED ENTITY SCHEMAS ====================

class ExtractedEntities(BaseModel):
    """Entities extracted from NLU processing"""
    symptoms: List[str] = []
    medications: List[str] = []
    conditions: List[str] = []
    body_parts: List[str] = []
    durations: List[str] = []
    allergies: List[str] = []
    vital_signs: List[str] = []
    other_entities: List[Dict[str, str]] = []


class NLUAnalysisResult(BaseModel):
    """Complete NLU analysis result"""
    raw_text: str
    extracted_entities: ExtractedEntities
    sentiment: Dict[str, Any] = {}
    emotion: Dict[str, Any] = {}
    urgency_indicators: List[str] = []


# ==================== NURSE ALERT SCHEMAS ====================

class NurseAlert(BaseModel):
    """Nurse station alert for red flag cases"""
    alert_id: str
    patient_id: str
    patient_name: str
    triage_case_id: str
    severity_score: SeverityLevel
    red_flags: List[str]
    sent_at: str
    acknowledged: bool = False


# ==================== HEALTH CHECK ====================

class TriageHealthCheck(BaseModel):
    """Health check response for triage module"""
    status: str
    services: Dict[str, bool]
    timestamp: str
