from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError
import uvicorn
import logging
from pathlib import Path

# Import utilities
from utils.logging_config import setup_logging
from utils.error_handlers import (
    LadChatException,
    ladchat_exception_handler,
    validation_exception_handler,
    http_exception_handler,
    database_exception_handler,
    generic_exception_handler
)
from utils.background_tasks import task_manager

# Setup logging first
setup_logging()
logger = logging.getLogger(__name__)

# Create FastAPI instance
app = FastAPI(
    title="LadChat API",
    description="Backend API for LadChat - A mobile app for young men to foster authentic friendships",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add exception handlers
app.add_exception_handler(LadChatException, ladchat_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(SQLAlchemyError, database_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Mount static files for media serving
media_dir = Path("media")
media_dir.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory="media"), name="media")

# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Health check endpoint to verify the API is running
    """
    from utils.media_storage import media_storage
    from datetime import datetime
    
    # Basic health check
    health_data = {
        "status": "healthy",
        "message": "LadChat API is running",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "database": "healthy",
            "media_storage": "healthy",
            "background_tasks": "healthy" if task_manager.running else "stopped"
        }
    }
    
    try:
        # Test database connection
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
    except Exception as e:
        health_data["services"]["database"] = "unhealthy"
        health_data["status"] = "degraded"
        logger.error(f"Database health check failed: {e}")
    
    try:
        # Test media storage
        storage_stats = media_storage.get_storage_stats()
        health_data["services"]["media_storage"] = "healthy"
        health_data["storage"] = storage_stats
    except Exception as e:
        health_data["services"]["media_storage"] = "unhealthy"
        health_data["status"] = "degraded"
        logger.error(f"Media storage health check failed: {e}")
    
    return JSONResponse(
        status_code=200 if health_data["status"] == "healthy" else 503,
        content=health_data
    )

@app.get("/")
async def root():
    """
    Root endpoint with basic API information
    """
    return {
        "message": "Welcome to LadChat API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

# Import models (must be imported before create_tables)
import models

# Import routes
from routes.auth import router as auth_router
from routes.messages import router as messages_router
from routes.groups import router as groups_router
from routes.stories import router as stories_router
from routes.snaps import router as snaps_router
from routes.media import router as media_router
from routes.friends import router as friends_router
from database import create_tables, SessionLocal
from config import settings

# Create database tables on startup
create_tables()

# Include routers
app.include_router(auth_router)
app.include_router(messages_router)
app.include_router(groups_router)
app.include_router(stories_router)
app.include_router(snaps_router)
app.include_router(media_router)
app.include_router(friends_router)

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting LadChat API...")
    
    # Start background task manager
    await task_manager.start()
    
    logger.info("LadChat API started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down LadChat API...")
    
    # Stop background task manager
    await task_manager.stop()
    
    logger.info("LadChat API shut down complete")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Enable auto-reload during development
        log_level="info"
    ) 