"""
Pydantic schemas for medical data (SOAP notes, diagnoses, etc.)
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum


class VisitStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    TRANSCRIBING = "TRANSCRIBING"
    ANALYZING = "ANALYZING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class RiskLevel(str, Enum):
    ROUTINE = "ROUTINE"
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    URGENT = "URGENT"
    CRITICAL = "CRITICAL"


class SOAPNote(BaseModel):
    """SOAP Note structure"""
    subjective: str = Field(..., description="Subjective findings from patient")
    objective: str = Field(..., description="Objective findings and vitals")
    assessment: str = Field(..., description="Clinical assessment")
    plan: str = Field(..., description="Treatment plan")


class DifferentialDiagnosis(BaseModel):
    """Single differential diagnosis"""
    diagnosis: str
    probability: str  # HIGH, MEDIUM, LOW
    supporting_factors: List[str]
    against: List[str]
    next_steps: List[str]


class RedFlag(BaseModel):
    """Red flag alert"""
    category: str
    finding: str
    urgency: str  # CRITICAL, URGENT, ROUTINE
    action: str


class RedFlagAnalysis(BaseModel):
    """Red flag analysis result"""
    has_red_flags: bool
    severity: RiskLevel
    red_flags_detected: List[RedFlag]
    triage_recommendation: str


class VisitCreate(BaseModel):
    """Schema for creating a new visit"""
    patient_id: str
    clinic_id: str
    doctor_id: Optional[str] = None
    language_code: str = "hi-IN"
    audio_duration_seconds: Optional[float] = None


class VisitResponse(BaseModel):
    """Schema for visit response"""
    visit_id: str
    patient_id: str
    clinic_id: str
    doctor_id: Optional[str]
    status: VisitStatus
    language_code: str
    audio_s3_key: Optional[str]
    transcript: Optional[str]
    translated_text: Optional[str]
    soap_note: Optional[SOAPNote]
    differential_diagnosis: Optional[List[DifferentialDiagnosis]]
    red_flags: Optional[RedFlagAnalysis]
    risk_level: Optional[RiskLevel]
    created_at: datetime
    updated_at: datetime
    processing_time_seconds: Optional[float]
    
    class Config:
        from_attributes = True


class VisitSummary(BaseModel):
    """Condensed visit information for list views"""
    visit_id: str
    patient_name: str
    patient_age: int
    chief_complaint: Optional[str]
    status: VisitStatus
    risk_level: Optional[RiskLevel]
    created_at: datetime
    has_red_flags: bool


class AudioUploadRequest(BaseModel):
    """Request for audio upload URL"""
    visit_id: str
    file_extension: str = "webm"
    content_type: str = "audio/webm"


class AudioUploadResponse(BaseModel):
    """Response with presigned URL"""
    upload_url: str
    audio_s3_key: str
    expiration_seconds: int


class ProcessingStatusResponse(BaseModel):
    """Status of audio processing"""
    visit_id: str
    status: VisitStatus
    progress_percentage: int
    current_step: str
    estimated_completion_seconds: Optional[int]
    error_message: Optional[str]
