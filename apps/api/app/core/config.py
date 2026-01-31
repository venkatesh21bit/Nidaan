"""
Core Configuration Module
Manages environment variables and application settings
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application Settings"""
    
    # Application
    APP_NAME: str = "Nidaan.ai"
    APP_VERSION: str = "1.0.0"
    ENV: str = "development"
    DEBUG: bool = True
    APP_BASE_URL: str = "http://localhost:3000"  # Frontend URL for survey links
    
    # API
    API_V1_PREFIX: str = "/api/v1"
    
    # Security
    JWT_SECRET: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60 * 24  # 24 hours
    
    # AWS Configuration
    AWS_REGION: str = "ap-south-1"
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    
    # ==================== IBM Cloud Configuration ====================
    
    # IBM Cloudant (Database)
    CLOUDANT_URL: str = "https://your-cloudant-instance.cloudantnosqldb.appdomain.cloud"
    CLOUDANT_API_KEY: str = "your-cloudant-api-key"
    CLOUDANT_DATABASE_NAME: str = "nidaan_triage"
    
    # IBM Watson Speech to Text
    IBM_STT_API_KEY: str = "your-stt-api-key"
    IBM_STT_URL: str = "https://api.us-south.speech-to-text.watson.cloud.ibm.com"
    
    # IBM Watson Natural Language Understanding
    IBM_NLU_API_KEY: str = "your-nlu-api-key"
    IBM_NLU_URL: str = "https://api.us-south.natural-language-understanding.watson.cloud.ibm.com"
    
    # ==================== Email Configuration (SMTP) ====================
    # Using Gmail SMTP for patient outreach
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_EMAIL: str = "venkatesh.k21062005@gmail.com"
    SMTP_PASSWORD: str = "ywqc fghh kgdv kaqe"  # App password
    
    # Nurse Station Alert Email
    NURSE_STATION_EMAIL: str = "nurse.station@hospital.com"
    
    # S3
    S3_BUCKET_NAME: str = "nidaan-audio-storage"
    S3_PRESIGNED_URL_EXPIRATION: int = 600  # 10 minutes
    S3_ENDPOINT_URL: Optional[str] = None  # For local development with LocalStack
    
    # DynamoDB
    DYNAMODB_TABLE_NAME: str = "NidaanVisits"
    DYNAMODB_ENDPOINT_URL: Optional[str] = None  # For local development
    
    # SQS
    SQS_QUEUE_NAME: str = "AudioProcessQueue"
    SQS_ENDPOINT_URL: Optional[str] = None
    
    # AWS Bedrock
    BEDROCK_MODEL_ID: str = "anthropic.claude-3-5-sonnet-20240620-v1:0"
    BEDROCK_ENDPOINT_URL: Optional[str] = None
    
    # AWS Transcribe
    TRANSCRIBE_LANGUAGE_CODES: list = [
        "hi-IN",  # Hindi
        "ta-IN",  # Tamil
        "te-IN",  # Telugu
        "mr-IN",  # Marathi
        "bn-IN",  # Bengali
        "en-IN"   # English
    ]
    
    # OpenSearch (Vector DB)
    OPENSEARCH_ENDPOINT: Optional[str] = None
    OPENSEARCH_INDEX: str = "medical_knowledge"
    
    # Redis (for caching and real-time)
    REDIS_URL: str = "redis://localhost:6379"
    
    # CORS
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://nidaan.ai",
        "https://nidaan-web.25r5a6g2yvmy.eu-de.codeengine.appdomain.cloud"
    ]
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
