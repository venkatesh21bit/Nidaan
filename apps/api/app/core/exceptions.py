"""
Custom Exception Handlers
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
import logging

logger = logging.getLogger(__name__)


class NidaanException(Exception):
    """Base exception for Nidaan application"""
    
    def __init__(self, message: str, status_code: int = 500, details: dict = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class AudioProcessingException(NidaanException):
    """Exception raised during audio processing"""
    
    def __init__(self, message: str = "Audio processing failed", details: dict = None):
        super().__init__(message, status.HTTP_500_INTERNAL_SERVER_ERROR, details)


class TranscriptionException(NidaanException):
    """Exception raised during transcription"""
    
    def __init__(self, message: str = "Transcription failed", details: dict = None):
        super().__init__(message, status.HTTP_500_INTERNAL_SERVER_ERROR, details)


class LLMException(NidaanException):
    """Exception raised during LLM processing"""
    
    def __init__(self, message: str = "LLM processing failed", details: dict = None):
        super().__init__(message, status.HTTP_500_INTERNAL_SERVER_ERROR, details)


class DatabaseException(NidaanException):
    """Exception raised during database operations"""
    
    def __init__(self, message: str = "Database operation failed", details: dict = None):
        super().__init__(message, status.HTTP_500_INTERNAL_SERVER_ERROR, details)


class StorageException(NidaanException):
    """Exception raised during S3 operations"""
    
    def __init__(self, message: str = "Storage operation failed", details: dict = None):
        super().__init__(message, status.HTTP_500_INTERNAL_SERVER_ERROR, details)


async def nidaan_exception_handler(request: Request, exc: NidaanException):
    """Handler for custom Nidaan exceptions"""
    logger.error(f"NidaanException: {exc.message}", extra=exc.details)
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.message,
            "details": exc.details,
            "path": str(request.url)
        }
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handler for validation errors"""
    logger.warning(f"Validation error: {exc.errors()}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation failed",
            "details": exc.errors(),
            "path": str(request.url)
        }
    )


async def general_exception_handler(request: Request, exc: Exception):
    """Handler for uncaught exceptions"""
    logger.exception(f"Unhandled exception: {str(exc)}")
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred",
            "path": str(request.url)
        }
    )
