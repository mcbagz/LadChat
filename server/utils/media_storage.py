"""
Media storage utilities for LadChat API
Handles file uploads, validation, and temporary storage
"""

import os
import hashlib
import mimetypes
from pathlib import Path
from typing import Optional, Tuple, List
from datetime import datetime, timedelta
from fastapi import UploadFile, HTTPException, status
import aiofiles
import logging

from config import settings

logger = logging.getLogger(__name__)

class MediaStorageManager:
    """Manages media file storage and validation"""
    
    # Allowed file types and sizes
    ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
    ALLOWED_VIDEO_TYPES = {'video/mp4', 'video/quicktime', 'video/x-msvideo'}
    MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
    MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB
    
    def __init__(self):
        self.storage_path = Path("media/temp")
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        # Create subdirectories
        (self.storage_path / "stories").mkdir(exist_ok=True)
        (self.storage_path / "snaps").mkdir(exist_ok=True)
        (self.storage_path / "hangouts").mkdir(exist_ok=True)
        (self.storage_path / "profiles").mkdir(exist_ok=True)
        (self.storage_path / "venues").mkdir(exist_ok=True)
    
    def _generate_filename(self, original_filename: str, user_id: int, content_type: str) -> str:
        """Generate a unique filename for uploaded media"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        
        # Get file extension
        _, ext = os.path.splitext(original_filename)
        if not ext:
            # Guess extension from content type
            ext = mimetypes.guess_extension(content_type) or '.bin'
        
        # Create hash from user_id, timestamp and original filename
        hash_input = f"{user_id}_{timestamp}_{original_filename}".encode()
        file_hash = hashlib.md5(hash_input).hexdigest()[:8]
        
        return f"{timestamp}_{user_id}_{file_hash}{ext}"
    
    def _validate_file(self, file: UploadFile, max_size: int, allowed_types: set) -> Tuple[bool, str]:
        """Validate uploaded file"""
        # Check content type
        if file.content_type not in allowed_types:
            return False, f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
        
        # Check file size
        if file.size and file.size > max_size:
            return False, f"File too large. Maximum size: {max_size / (1024*1024):.1f}MB"
        
        return True, "Valid"
    
    async def save_story_media(self, file: UploadFile, user_id: int) -> Tuple[str, str]:
        """Save media file for a story"""
        return await self._save_media_file(file, user_id, "stories")
    
    async def save_snap_media(self, file: UploadFile, user_id: int) -> Tuple[str, str]:
        """Save media file for a snap"""
        return await self._save_media_file(file, user_id, "snaps")
    
    async def save_hangout_media(self, file: UploadFile, user_id: int) -> Tuple[str, str]:
        """Save media file for a hangout"""
        return await self._save_media_file(file, user_id, "hangouts")
    
    async def save_profile_media(self, file: UploadFile, user_id: int) -> Tuple[str, str]:
        """Save media file for a profile"""
        return await self._save_media_file(file, user_id, "profiles")
    
    async def save_venue_media(self, file: UploadFile, user_id: int) -> Tuple[str, str]:
        """Save media file for a venue"""
        return await self._save_media_file(file, user_id, "venues")
    
    async def _save_media_file(self, file: UploadFile, user_id: int, category: str) -> Tuple[str, str]:
        """Save media file to temporary storage"""
        # Determine file type and validation rules
        if file.content_type in self.ALLOWED_IMAGE_TYPES:
            media_type = "photo"
            max_size = self.MAX_IMAGE_SIZE
            allowed_types = self.ALLOWED_IMAGE_TYPES
        elif file.content_type in self.ALLOWED_VIDEO_TYPES:
            media_type = "video"
            max_size = self.MAX_VIDEO_SIZE
            allowed_types = self.ALLOWED_VIDEO_TYPES
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file type"
            )
        
        # Validate file
        is_valid, message = self._validate_file(file, max_size, allowed_types)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )
        
        # Generate unique filename
        filename = self._generate_filename(file.filename, user_id, file.content_type)
        file_path = self.storage_path / category / filename
        
        try:
            # Save file
            async with aiofiles.open(file_path, 'wb') as buffer:
                content = await file.read()
                await buffer.write(content)
            
            logger.info(f"Saved {media_type} file: {file_path}")
            
            # Return relative path and media type
            relative_path = f"media/temp/{category}/{filename}"
            return relative_path, media_type
            
        except Exception as e:
            logger.error(f"Error saving file {filename}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save file"
            )
    
    def delete_media_file(self, file_path: str) -> bool:
        """Delete a media file"""
        try:
            full_path = Path(file_path)
            if full_path.exists():
                full_path.unlink()
                logger.info(f"Deleted media file: {file_path}")
                return True
            else:
                logger.warning(f"File not found for deletion: {file_path}")
                return False
        except Exception as e:
            logger.error(f"Error deleting file {file_path}: {e}")
            return False
    
    def get_media_url(self, file_path: str) -> str:
        """Get URL for accessing media file"""
        # For local development, return a local URL
        # In production, this would return a CDN/S3 URL
        base_url = getattr(settings, 'MEDIA_BASE_URL', 'http://localhost:8000/')
        return f"{base_url.rstrip('/')}/{file_path}"
    
    def cleanup_expired_media(self, hours_old: int = 48):
        """Clean up media files older than specified hours"""
        logger.info(f"Cleaning up media files older than {hours_old} hours")
        
        cutoff_time = datetime.utcnow() - timedelta(hours=hours_old)
        deleted_count = 0
        
        try:
            for category_dir in self.storage_path.iterdir():
                if category_dir.is_dir():
                    for file_path in category_dir.iterdir():
                        if file_path.is_file():
                            # Check file modification time
                            file_time = datetime.fromtimestamp(file_path.stat().st_mtime)
                            if file_time < cutoff_time:
                                file_path.unlink()
                                deleted_count += 1
                                logger.debug(f"Deleted expired media file: {file_path}")
            
            logger.info(f"Cleaned up {deleted_count} expired media files")
            
        except Exception as e:
            logger.error(f"Error during media cleanup: {e}")
    
    def get_storage_stats(self) -> dict:
        """Get storage statistics"""
        stats = {
            "total_files": 0,
            "total_size": 0,
            "categories": {}
        }
        
        try:
            for category_dir in self.storage_path.iterdir():
                if category_dir.is_dir():
                    category_stats = {
                        "files": 0,
                        "size": 0
                    }
                    
                    for file_path in category_dir.iterdir():
                        if file_path.is_file():
                            file_size = file_path.stat().st_size
                            category_stats["files"] += 1
                            category_stats["size"] += file_size
                    
                    stats["categories"][category_dir.name] = category_stats
                    stats["total_files"] += category_stats["files"]
                    stats["total_size"] += category_stats["size"]
            
            # Convert size to MB
            stats["total_size_mb"] = round(stats["total_size"] / (1024 * 1024), 2)
            for category in stats["categories"]:
                stats["categories"][category]["size_mb"] = round(
                    stats["categories"][category]["size"] / (1024 * 1024), 2
                )
            
        except Exception as e:
            logger.error(f"Error getting storage stats: {e}")
        
        return stats

# Global media storage manager
media_storage = MediaStorageManager()

# Utility functions
async def save_uploaded_file(file: UploadFile, user_id: int, category: str) -> Tuple[str, str]:
    """Save uploaded file based on category"""
    if category == "story":
        return await media_storage.save_story_media(file, user_id)
    elif category == "snap":
        return await media_storage.save_snap_media(file, user_id)
    elif category == "hangout":
        return await media_storage.save_hangout_media(file, user_id)
    elif category == "profile":
        return await media_storage.save_profile_media(file, user_id)
    elif category == "venue":
        return await media_storage.save_venue_media(file, user_id)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid media category"
        )

def validate_image_dimensions(file_path: str, max_width: int = 2048, max_height: int = 2048) -> bool:
    """Validate image dimensions (requires PIL/Pillow)"""
    try:
        from PIL import Image
        
        with Image.open(file_path) as img:
            width, height = img.size
            if width > max_width or height > max_height:
                return False
        return True
    except ImportError:
        logger.warning("PIL not available for image dimension validation")
        return True  # Skip validation if PIL not installed
    except Exception as e:
        logger.error(f"Error validating image dimensions: {e}")
        return False

def get_file_metadata(file_path: str) -> dict:
    """Get metadata for a media file"""
    try:
        path = Path(file_path)
        if not path.exists():
            return {}
        
        stat = path.stat()
        content_type, _ = mimetypes.guess_type(str(path))
        
        metadata = {
            "filename": path.name,
            "size": stat.st_size,
            "size_mb": round(stat.st_size / (1024 * 1024), 2),
            "content_type": content_type,
            "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
        }
        
        return metadata
        
    except Exception as e:
        logger.error(f"Error getting file metadata: {e}")
        return {} 