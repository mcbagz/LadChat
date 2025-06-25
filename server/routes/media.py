from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
import logging
import os
from pathlib import Path

from database import get_db
from models import User
from auth import get_current_user
from utils.error_handlers import raise_not_found, raise_forbidden
from utils.media_storage import save_uploaded_file, media_storage, get_file_metadata
from utils.logging_config import log_api_request

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/media", tags=["media"])

@router.post("/upload", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_media(
    category: str = Form(...),  # 'story', 'snap', 'profile', 'hangout', 'venue'
    media_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a media file"""
    
    # Validate category
    valid_categories = ['story', 'snap', 'profile', 'hangout', 'venue']
    if category not in valid_categories:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}"
        )
    
    # Upload file
    try:
        media_url, media_type = await save_uploaded_file(media_file, current_user.id, category)
    except Exception as e:
        logger.error(f"Media upload failed: {e}")
        raise HTTPException(status_code=400, detail="Media upload failed")
    
    # Get file metadata
    metadata = get_file_metadata(media_url)
    
    log_api_request("POST", "/media/upload", current_user.id)
    
    return {
        "media_url": media_url,
        "media_type": media_type,
        "public_url": media_storage.get_media_url(media_url),
        "metadata": metadata,
        "message": "Media uploaded successfully"
    }

@router.get("/{file_path:path}")
async def serve_media(
    file_path: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Serve media files with access control"""
    
    # Construct full file path
    full_path = Path(file_path)
    
    # Security check - ensure path is within media directory
    if not str(full_path).startswith("media/"):
        raise_forbidden("Invalid file path")
    
    # Check if file exists
    if not full_path.exists():
        raise_not_found("Media file", file_path)
    
    # TODO: Implement proper access control based on content type
    # For now, allow access to any authenticated user
    # In production, you'd check:
    # - If it's a story, check visibility settings
    # - If it's a snap, check if user is recipient
    # - If it's a profile photo, allow public access
    # - etc.
    
    # Log access
    log_api_request("GET", f"/media/{file_path}", current_user.id)
    
    # Return file
    return FileResponse(
        path=full_path,
        filename=full_path.name,
        media_type=_get_media_type(full_path.suffix)
    )

@router.delete("/{file_path:path}", response_model=dict)
async def delete_media(
    file_path: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a media file"""
    
    # Security check - ensure path is within media directory
    if not file_path.startswith("media/"):
        raise_forbidden("Invalid file path")
    
    # TODO: Implement proper authorization
    # Check if user owns the media file
    # This would require tracking media ownership in database
    
    # Delete file
    success = media_storage.delete_media_file(file_path)
    
    if not success:
        raise_not_found("Media file", file_path)
    
    log_api_request("DELETE", f"/media/{file_path}", current_user.id)
    
    return {
        "message": "Media file deleted successfully",
        "file_path": file_path
    }

@router.get("/info/{file_path:path}", response_model=dict)
async def get_media_info(
    file_path: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get metadata for a media file"""
    
    # Security check
    if not file_path.startswith("media/"):
        raise_forbidden("Invalid file path")
    
    # Get metadata
    metadata = get_file_metadata(file_path)
    
    if not metadata:
        raise_not_found("Media file", file_path)
    
    log_api_request("GET", f"/media/info/{file_path}", current_user.id)
    
    return {
        "file_path": file_path,
        "metadata": metadata,
        "public_url": media_storage.get_media_url(file_path)
    }

@router.get("/storage/stats", response_model=dict)
async def get_storage_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get storage statistics (admin only for now)"""
    
    # TODO: Add admin check
    # For now, allow any authenticated user
    
    stats = media_storage.get_storage_stats()
    
    log_api_request("GET", "/media/storage/stats", current_user.id)
    
    return {
        "storage_stats": stats,
        "message": "Storage statistics retrieved"
    }

@router.post("/cleanup", response_model=dict)
async def cleanup_expired_media(
    hours_old: int = 48,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger media cleanup (admin only)"""
    
    # TODO: Add admin check
    # For now, allow any authenticated user
    
    media_storage.cleanup_expired_media(hours_old)
    
    log_api_request("POST", "/media/cleanup", current_user.id)
    
    return {
        "message": f"Cleanup completed for files older than {hours_old} hours"
    }

# Helper functions
def _get_media_type(file_extension: str) -> str:
    """Get MIME type from file extension"""
    extension_map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.webm': 'video/webm'
    }
    
    return extension_map.get(file_extension.lower(), 'application/octet-stream') 