"""
Pydantic schemas for patient data
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum
import re


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class LanguageCode(str, Enum):
    HINDI = "hi-IN"
    TAMIL = "ta-IN"
    TELUGU = "te-IN"
    MARATHI = "mr-IN"
    BENGALI = "bn-IN"
    ENGLISH = "en-IN"


class PatientCreate(BaseModel):
    """Schema for creating a new patient"""
    name: str = Field(..., min_length=2, max_length=100)
    age: int = Field(..., ge=0, le=150)
    gender: Gender
    phone: str = Field(...)
    language_preference: LanguageCode = LanguageCode.HINDI
    clinic_id: str
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if not re.match(r'^\+?[0-9]{10,15}$', v):
            raise ValueError('Invalid phone number format')
        return v


class PatientResponse(BaseModel):
    """Schema for patient response"""
    patient_id: str
    name: str
    age: int
    gender: Gender
    phone: str
    language_preference: LanguageCode
    clinic_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class PatientUpdate(BaseModel):
    """Schema for updating patient"""
    name: Optional[str] = None
    phone: Optional[str] = None
    language_preference: Optional[LanguageCode] = None
