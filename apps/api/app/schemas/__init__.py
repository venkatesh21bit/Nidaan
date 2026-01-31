"""
Schemas module initialization
Exports all Pydantic schemas for the Nidaan API
"""
from app.schemas.patient import (
    PatientCreate,
    PatientResponse,
    PatientUpdate,
    Gender,
    LanguageCode
)

from app.schemas.triage import (
    SeverityLevel,
    TriageStatus,
    SurveyStatus,
    AppointmentCreate,
    AppointmentResponse,
    SurveyResponseSubmit,
    SurveyResponseResult,
    VoiceTriageRequest,
    VoiceTriageResponse,
    TriageCaseCreate,
    TriageCaseResponse,
    TriageCaseUpdate,
    UrgentCasesResponse,
    UrgentCaseItem,
    MarkCaseSeenRequest,
    MarkCaseSeenResponse,
    ExtractedEntities,
    NLUAnalysisResult,
    NurseAlert,
    TriageHealthCheck
)

__all__ = [
    # Patient schemas
    "PatientCreate",
    "PatientResponse", 
    "PatientUpdate",
    "Gender",
    "LanguageCode",
    
    # Triage schemas
    "SeverityLevel",
    "TriageStatus",
    "SurveyStatus",
    "AppointmentCreate",
    "AppointmentResponse",
    "SurveyResponseSubmit",
    "SurveyResponseResult",
    "VoiceTriageRequest",
    "VoiceTriageResponse",
    "TriageCaseCreate",
    "TriageCaseResponse",
    "TriageCaseUpdate",
    "UrgentCasesResponse",
    "UrgentCaseItem",
    "MarkCaseSeenRequest",
    "MarkCaseSeenResponse",
    "ExtractedEntities",
    "NLUAnalysisResult",
    "NurseAlert",
    "TriageHealthCheck"
]
