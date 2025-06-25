"""
API response models and versioning utilities for LadChat
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Union
from datetime import datetime
from enum import Enum

class APIVersion(str, Enum):
    """API version enumeration"""
    V1 = "v1"
    V2 = "v2"

class ResponseStatus(str, Enum):
    """Response status enumeration"""
    SUCCESS = "success"
    ERROR = "error"
    PARTIAL = "partial"

# Base response models
class BaseResponse(BaseModel):
    """Base response model for all API responses"""
    success: bool = True
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: APIVersion = APIVersion.V1
    request_id: Optional[str] = None

class SuccessResponse(BaseResponse):
    """Standard success response"""
    message: str
    data: Optional[Dict[str, Any]] = None

class ErrorResponse(BaseResponse):
    """Standard error response"""
    success: bool = False
    error: Dict[str, Any]
    
    class Config:
        schema_extra = {
            "example": {
                "success": False,
                "error": {
                    "message": "Resource not found",
                    "code": 404,
                    "details": {}
                },
                "timestamp": "2024-01-01T12:00:00Z",
                "version": "v1",
                "request_id": "abc123"
            }
        }

class PaginatedResponse(BaseResponse):
    """Paginated response model"""
    data: List[Dict[str, Any]]
    pagination: Dict[str, Any]
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "data": [{"id": 1, "name": "Example"}],
                "pagination": {
                    "page": 1,
                    "per_page": 20,
                    "total": 1,
                    "total_pages": 1,
                    "has_next": False,
                    "has_prev": False
                },
                "timestamp": "2024-01-01T12:00:00Z",
                "version": "v1"
            }
        }

class ListResponse(BaseResponse):
    """List response model"""
    data: List[Dict[str, Any]]
    count: int
    filters: Optional[Dict[str, Any]] = None

# Pagination utilities
class PaginationParams(BaseModel):
    """Pagination parameters"""
    page: int = Field(default=1, ge=1, description="Page number")
    per_page: int = Field(default=20, ge=1, le=100, description="Items per page")
    sort_by: Optional[str] = Field(default=None, description="Sort field")
    sort_order: Optional[str] = Field(default="desc", pattern="^(asc|desc)$", description="Sort order")

class PaginationMeta(BaseModel):
    """Pagination metadata"""
    page: int
    per_page: int
    total: int
    total_pages: int
    has_next: bool
    has_prev: bool

def create_pagination_meta(page: int, per_page: int, total: int) -> PaginationMeta:
    """Create pagination metadata"""
    total_pages = (total + per_page - 1) // per_page
    has_next = page < total_pages
    has_prev = page > 1
    
    return PaginationMeta(
        page=page,
        per_page=per_page,
        total=total,
        total_pages=total_pages,
        has_next=has_next,
        has_prev=has_prev
    )

# Content response models
class MediaResponse(BaseModel):
    """Media file response model"""
    url: str
    type: str  # 'photo' or 'video'
    size: Optional[int] = None
    duration: Optional[float] = None  # For videos
    dimensions: Optional[Dict[str, int]] = None  # width, height

class UserPublicResponse(BaseModel):
    """Public user information response"""
    id: int
    username: str
    bio: Optional[str] = None
    interests: List[str] = []
    is_verified: bool = False
    profile_photo: Optional[MediaResponse] = None

class StoryResponse(BaseModel):
    """Story response model"""
    id: int
    user: UserPublicResponse
    media: MediaResponse
    caption: Optional[str] = None
    visibility: str
    view_count: int
    has_viewed: bool = False
    created_at: datetime
    expires_at: datetime

class SnapResponse(BaseModel):
    """Snap response model"""
    id: int
    sender: UserPublicResponse
    media: MediaResponse
    caption: Optional[str] = None
    view_duration: int
    is_opened: bool
    created_at: datetime
    expires_at: datetime

class HangoutResponse(BaseModel):
    """Hangout response model"""
    id: int
    creator: UserPublicResponse
    title: str
    description: Optional[str] = None
    location: Optional[Dict[str, Any]] = None
    media: Optional[MediaResponse] = None
    visibility: str
    attendee_count: int
    maybe_count: int
    user_rsvp: Optional[str] = None  # 'yes', 'maybe', 'no'
    start_time: Optional[datetime] = None
    created_at: datetime
    expires_at: datetime

class GroupChatResponse(BaseModel):
    """Group chat response model"""
    id: int
    name: str
    description: Optional[str] = None
    avatar: Optional[MediaResponse] = None
    member_count: int
    group_interests: List[str] = []
    is_member: bool = False
    is_admin: bool = False
    last_message_at: Optional[datetime] = None
    created_at: datetime

class VenueResponse(BaseModel):
    """Venue response model"""
    id: int
    name: str
    category: str
    city: str
    rating: float
    review_count: int
    lad_friendly_score: float
    price_range: Optional[str] = None
    main_photo: Optional[str] = None
    is_sponsored: bool = False
    distance: Optional[float] = None  # In kilometers
    features: List[str] = []

# Response builders
def build_success_response(
    message: str,
    data: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None
) -> SuccessResponse:
    """Build a standard success response"""
    return SuccessResponse(
        message=message,
        data=data,
        request_id=request_id
    )

def build_error_response(
    message: str,
    code: int,
    details: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None
) -> ErrorResponse:
    """Build a standard error response"""
    return ErrorResponse(
        error={
            "message": message,
            "code": code,
            "details": details or {}
        },
        request_id=request_id
    )

def build_paginated_response(
    data: List[Dict[str, Any]],
    pagination: PaginationMeta,
    request_id: Optional[str] = None
) -> PaginatedResponse:
    """Build a paginated response"""
    return PaginatedResponse(
        data=data,
        pagination=pagination.dict(),
        request_id=request_id
    )

def build_list_response(
    data: List[Dict[str, Any]],
    filters: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None
) -> ListResponse:
    """Build a list response"""
    return ListResponse(
        data=data,
        count=len(data),
        filters=filters,
        request_id=request_id
    )

# API versioning utilities
class APIVersionHeader:
    """API version header utilities"""
    
    @staticmethod
    def get_version_from_header(version_header: Optional[str]) -> APIVersion:
        """Extract API version from header"""
        if not version_header:
            return APIVersion.V1
        
        version_str = version_header.lower().strip()
        if version_str in ['v2', '2.0', '2']:
            return APIVersion.V2
        
        return APIVersion.V1
    
    @staticmethod
    def get_version_from_path(path: str) -> APIVersion:
        """Extract API version from URL path"""
        if '/v2/' in path or path.startswith('/v2'):
            return APIVersion.V2
        
        return APIVersion.V1

# Content transformation utilities
def transform_user_for_response(user_data: Dict[str, Any], include_private: bool = False) -> Dict[str, Any]:
    """Transform user data for API response"""
    public_data = {
        "id": user_data.get("id"),
        "username": user_data.get("username"),
        "bio": user_data.get("bio"),
        "interests": user_data.get("interests", []),
        "is_verified": user_data.get("is_verified", False)
    }
    
    if user_data.get("profile_photo_url"):
        public_data["profile_photo"] = {
            "url": user_data["profile_photo_url"],
            "type": "photo"
        }
    
    if include_private:
        public_data.update({
            "email": user_data.get("email"),
            "open_to_friends": user_data.get("open_to_friends", False),
            "location_radius": user_data.get("location_radius", 5),
            "created_at": user_data.get("created_at")
        })
    
    return public_data

def transform_story_for_response(story_data: Dict[str, Any], user_data: Dict[str, Any], has_viewed: bool = False) -> Dict[str, Any]:
    """Transform story data for API response"""
    return {
        "id": story_data.get("id"),
        "user": transform_user_for_response(user_data),
        "media": {
            "url": story_data.get("media_url"),
            "type": story_data.get("media_type")
        },
        "caption": story_data.get("caption"),
        "visibility": story_data.get("visibility"),
        "view_count": story_data.get("view_count", 0),
        "has_viewed": has_viewed,
        "created_at": story_data.get("created_at"),
        "expires_at": story_data.get("expires_at")
    }

def transform_hangout_for_response(hangout_data: Dict[str, Any], creator_data: Dict[str, Any], user_rsvp: Optional[str] = None) -> Dict[str, Any]:
    """Transform hangout data for API response"""
    response_data = {
        "id": hangout_data.get("id"),
        "creator": transform_user_for_response(creator_data),
        "title": hangout_data.get("title"),
        "description": hangout_data.get("description"),
        "visibility": hangout_data.get("visibility"),
        "attendee_count": hangout_data.get("attendee_count", 0),
        "maybe_count": hangout_data.get("maybe_count", 0),
        "user_rsvp": user_rsvp,
        "start_time": hangout_data.get("start_time"),
        "created_at": hangout_data.get("created_at"),
        "expires_at": hangout_data.get("expires_at")
    }
    
    # Add location if available
    if hangout_data.get("location_name"):
        response_data["location"] = {
            "name": hangout_data.get("location_name"),
            "latitude": hangout_data.get("latitude"),
            "longitude": hangout_data.get("longitude")
        }
    
    # Add media if available
    if hangout_data.get("media_url"):
        response_data["media"] = {
            "url": hangout_data.get("media_url"),
            "type": hangout_data.get("media_type")
        }
    
    return response_data 