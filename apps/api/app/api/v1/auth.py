"""
Authentication endpoints
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field, field_validator
from typing import Optional
import uuid
import re
import logging
from datetime import datetime

from app.core.security import hash_password, verify_password, create_access_token, get_current_user
from app.core.db import db_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["authentication"])


class UserRegister(BaseModel):
    """Schema for user registration"""
    email: str = Field(...)
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(...)
    clinic_id: Optional[str] = None
    phone: Optional[str] = None
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', v):
            raise ValueError('Invalid email format')
        return v
    
    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        if v not in ['doctor', 'patient', 'admin']:
            raise ValueError('Role must be doctor, patient, or admin')
        return v


class UserLogin(BaseModel):
    """Schema for user login"""
    email: str
    password: str


class TokenResponse(BaseModel):
    """Schema for authentication token response"""
    access_token: str
    token_type: str = "bearer"
    user_id: str
    name: str
    role: str
    clinic_id: Optional[str]


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister):
    """
    Register a new user
    
    Creates a new user account and returns an access token
    """
    try:
        # In production, check if email already exists
        
        # Generate user ID
        user_id = f"USR_{uuid.uuid4().hex[:12].upper()}"
        
        # Hash password
        hashed_password = hash_password(user_data.password)
        
        # For clinic_id, generate one if not provided and role is doctor
        clinic_id = user_data.clinic_id
        if not clinic_id and user_data.role == "doctor":
            clinic_id = f"CLINIC_{uuid.uuid4().hex[:8].upper()}"
        
        # In production, store user in database
        # For MVP, we'll just create the token
        
        # Create JWT token
        token = create_access_token({
            "user_id": user_id,
            "email": user_data.email,
            "role": user_data.role,
            "clinic_id": clinic_id,
            "name": user_data.name
        })
        
        logger.info(f"Registered new user: {user_id} ({user_data.email})")
        
        return TokenResponse(
            access_token=token,
            user_id=user_id,
            name=user_data.name,
            role=user_data.role,
            clinic_id=clinic_id
        )
        
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """
    Login with email and password
    
    Returns an access token for authenticated requests
    """
    try:
        # In production, fetch user from database and verify password
        # For MVP/demo, create a mock token
        
        # Mock user data (in production, fetch from DB)
        if credentials.email == "doctor@nidaan.ai":
            if credentials.password != "doctor123":
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
            user_data = {
                "user_id": "USR_DEMO_DOC",
                "email": credentials.email,
                "name": "Dr. Ram Kumar",
                "role": "doctor",
                "clinic_id": "CLINIC_DEMO"
            }
        elif credentials.email == "patient@nidaan.ai":
            if credentials.password != "patient123":
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
            user_data = {
                "user_id": "USR_DEMO_PAT",
                "email": credentials.email,
                "name": "Patient Demo",
                "role": "patient",
                "clinic_id": "CLINIC_DEMO"
            }
        elif credentials.email == "admin@nidaan.ai":
            if credentials.password != "admin123":
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
            user_data = {
                "user_id": "USR_DEMO_ADMIN",
                "email": credentials.email,
                "name": "Admin User",
                "role": "admin",
                "clinic_id": "CLINIC_DEMO"
            }
        else:
            # For demo, allow any email
            user_data = {
                "user_id": f"USR_{uuid.uuid4().hex[:12].upper()}",
                "email": credentials.email,
                "name": "Demo User",
                "role": "doctor",
                "clinic_id": "CLINIC_DEMO"
            }
        
        # Create JWT token
        token = create_access_token(user_data)
        
        logger.info(f"User logged in: {user_data['email']}")
        
        return TokenResponse(
            access_token=token,
            user_id=user_data["user_id"],
            name=user_data["name"],
            role=user_data["role"],
            clinic_id=user_data.get("clinic_id")
        )
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )


@router.post("/refresh")
async def refresh_token(current_user: dict = Depends(get_current_user)):
    """
    Refresh access token
    
    Requires valid existing token
    """
    try:
        # Create new token with same data
        new_token = create_access_token({
            "user_id": current_user.get("user_id"),
            "email": current_user.get("email"),
            "role": current_user.get("role"),
            "clinic_id": current_user.get("clinic_id"),
            "name": current_user.get("name")
        })
        
        return TokenResponse(
            access_token=new_token,
            user_id=current_user.get("user_id"),
            name=current_user.get("name"),
            role=current_user.get("role"),
            clinic_id=current_user.get("clinic_id")
        )
        
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed"
        )


from app.core.security import get_current_user
