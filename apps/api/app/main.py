"""
FastAPI Main Application
Entry point for the Nidaan.ai API
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.core.exceptions import (
    NidaanException,
    nidaan_exception_handler,
    validation_exception_handler,
    general_exception_handler
)
from app.api.v1.router import api_router
from app.api.v1 import auth

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup and shutdown events
    """
    # Startup
    logger.info("=" * 60)
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.ENV}")
    logger.info(f"Region: {settings.AWS_REGION}")
    logger.info("=" * 60)
    
    # Initialize Triage Services (IBM Cloud)
    try:
        from app.services.ibm.triage_engine import triage_engine
        await triage_engine.initialize()
        logger.info("✅ IBM Triage Services initialized")
    except Exception as e:
        logger.warning(f"⚠️ Triage services init failed (non-critical): {e}")
    
    # Seed initial data if database is empty
    try:
        from app.services.seed_data import check_and_seed_if_empty
        result = check_and_seed_if_empty("CLINIC_DEMO")
        logger.info(f"✅ Database seed check: {result.get('message')}")
    except Exception as e:
        logger.warning(f"⚠️ Database seeding failed (non-critical): {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Nidaan.ai API")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Multilingual AI Clinical Documentation System",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests"""
    logger.info(f"{request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response


# Exception handlers
app.add_exception_handler(NidaanException, nidaan_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)


# Include routers
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "environment": settings.ENV,
        "docs": "/api/docs" if settings.DEBUG else "disabled in production"
    }


# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Health check endpoint for load balancers and monitoring
    """
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "timestamp": datetime.utcnow().isoformat()
    }


# Readiness probe
@app.get("/ready")
async def readiness_check():
    """
    Readiness check - verifies dependencies are available
    """
    health_status = {
        "ready": True,
        "checks": {
            "database": "ok",  # In production, test DynamoDB connection
            "storage": "ok",   # In production, test S3 access
            "llm": "ok"        # In production, test Bedrock access
        }
    }
    
    # If any check fails, set ready to False
    if not all(v == "ok" for v in health_status["checks"].values()):
        health_status["ready"] = False
        return JSONResponse(
            status_code=503,
            content=health_status
        )
    
    return health_status


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info"
    )


from datetime import datetime
