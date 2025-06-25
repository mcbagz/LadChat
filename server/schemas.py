from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
from datetime import datetime

# Authentication Schemas
class UserRegistration(BaseModel):
    """Schema for user registration"""
    username: str
    email: EmailStr
    password: str
    bio: Optional[str] = None
    interests: Optional[List[str]] = []

    @validator('username')
    def validate_username(cls, v):
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters long')
        if len(v) > 50:
            raise ValueError('Username must be less than 50 characters')
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username can only contain letters, numbers, hyphens, and underscores')
        return v.lower()
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if len(v) > 128:
            raise ValueError('Password must be less than 128 characters')
        return v
    
    @validator('bio')
    def validate_bio(cls, v):
        if v and len(v) > 100:
            raise ValueError('Bio must be less than 100 characters')
        return v
    
    @validator('interests')
    def validate_interests(cls, v):
        if len(v) > 3:
            raise ValueError('You can select up to 3 interests')
        
        valid_interests = [
            'Soccer', 'Basketball', 'Gaming', 'BBQ', 'Hiking', 'Photography',
            'Music', 'Movies', 'Coffee', 'Fitness', 'Tech', 'Art', 'Cooking',
            'Travel', 'Reading', 'Cycling', 'Skateboarding', 'Surfing'
        ]
        
        for interest in v:
            if interest not in valid_interests:
                raise ValueError(f'Invalid interest: {interest}')
        
        return v

class UserLogin(BaseModel):
    """Schema for user login"""
    username: str  # Can be username or email
    password: str

class TokenResponse(BaseModel):
    """Schema for token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class TokenRefresh(BaseModel):
    """Schema for token refresh"""
    refresh_token: str

class UserResponse(BaseModel):
    """Schema for user response (public info)"""
    id: int
    username: str
    bio: Optional[str]
    interests: List[str]
    profile_photo_url: Optional[str]
    open_to_friends: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    """Schema for updating user profile"""
    bio: Optional[str] = None
    interests: Optional[List[str]] = None
    open_to_friends: Optional[bool] = None
    location_radius: Optional[int] = None

    @validator('bio')
    def validate_bio(cls, v):
        if v and len(v) > 100:
            raise ValueError('Bio must be less than 100 characters')
        return v
    
    @validator('interests')
    def validate_interests(cls, v):
        if v and len(v) > 3:
            raise ValueError('You can select up to 3 interests')
        
        valid_interests = [
            'Soccer', 'Basketball', 'Gaming', 'BBQ', 'Hiking', 'Photography',
            'Music', 'Movies', 'Coffee', 'Fitness', 'Tech', 'Art', 'Cooking',
            'Travel', 'Reading', 'Cycling', 'Skateboarding', 'Surfing'
        ]
        
        if v:
            for interest in v:
                if interest not in valid_interests:
                    raise ValueError(f'Invalid interest: {interest}')
        
        return v

    @validator('location_radius')
    def validate_location_radius(cls, v):
        if v and (v < 1 or v > 50):
            raise ValueError('Location radius must be between 1 and 50 km')
        return v

class PasswordChange(BaseModel):
    """Schema for password change"""
    current_password: str
    new_password: str
    
    @validator('new_password')
    def validate_new_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if len(v) > 128:
            raise ValueError('Password must be less than 128 characters')
        return v

# Messaging schemas
class DirectMessageCreate(BaseModel):
    """Schema for creating a direct message"""
    recipient_id: int
    content: Optional[str] = None
    message_type: str = "text"  # 'text' or 'media'
    view_duration: Optional[int] = None  # For media messages
    
    @validator('message_type')
    def validate_message_type(cls, v):
        if v not in ['text', 'media']:
            raise ValueError('Message type must be text or media')
        return v
    
    @validator('view_duration')
    def validate_view_duration(cls, v, values):
        if values.get('message_type') == 'media' and v:
            if v < 1 or v > 60:
                raise ValueError('View duration must be between 1 and 60 seconds')
        return v
    
    @validator('content')
    def validate_content(cls, v, values):
        if values.get('message_type') == 'text' and not v:
            raise ValueError('Text messages must have content')
        if v and len(v) > 1000:
            raise ValueError('Message content must be less than 1000 characters')
        return v

class GroupMessageCreate(BaseModel):
    """Schema for creating a group message"""
    group_id: int
    content: Optional[str] = None
    message_type: str = "text"  # 'text' or 'media'
    view_duration: Optional[int] = None  # For media messages
    
    @validator('message_type')
    def validate_message_type(cls, v):
        if v not in ['text', 'media']:
            raise ValueError('Message type must be text or media')
        return v
    
    @validator('view_duration')
    def validate_view_duration(cls, v, values):
        if values.get('message_type') == 'media' and v:
            if v < 1 or v > 60:
                raise ValueError('View duration must be between 1 and 60 seconds')
        return v

class SnapCreate(BaseModel):
    """Schema for creating a snap"""
    recipient_ids: Optional[List[int]] = []
    group_ids: Optional[List[int]] = []
    caption: Optional[str] = None
    view_duration: int = 10  # Default 10 seconds
    
    @validator('view_duration')
    def validate_view_duration(cls, v):
        if v < 1 or v > 60:
            raise ValueError('View duration must be between 1 and 60 seconds')
        return v
    
    @validator('caption')
    def validate_caption(cls, v):
        if v and len(v) > 200:
            raise ValueError('Caption must be less than 200 characters')
        return v
    
    def validate_recipients(self):
        """Validate that at least one recipient is specified"""
        if not self.recipient_ids and not self.group_ids:
            raise ValueError('At least one recipient must be specified')

class StoryCreate(BaseModel):
    """Schema for creating a story"""
    caption: Optional[str] = None
    visibility: str = "public"  # 'public', 'friends', 'private'
    circles: Optional[List[int]] = []
    
    @validator('visibility')
    def validate_visibility(cls, v):
        if v not in ['public', 'friends', 'private']:
            raise ValueError('Visibility must be public, friends, or private')
        return v
    
    @validator('caption')
    def validate_caption(cls, v):
        if v and len(v) > 200:
            raise ValueError('Caption must be less than 200 characters')
        return v

class MessageReadUpdate(BaseModel):
    """Schema for marking messages as read"""
    message_ids: List[int]

class MediaViewUpdate(BaseModel):
    """Schema for marking media as viewed"""
    message_id: int
    screenshot_taken: bool = False

# Response schemas
class DirectMessageResponse(BaseModel):
    """Direct message response schema"""
    id: int
    sender_id: int
    recipient_id: int
    content: Optional[str]
    message_type: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    view_duration: Optional[int] = None
    is_read: bool
    is_opened: Optional[bool] = None
    screenshot_taken: Optional[bool] = None
    created_at: datetime
    expires_at: datetime

class GroupMessageResponse(BaseModel):
    """Group message response schema"""
    id: int
    group_id: int
    sender_id: int
    content: Optional[str]
    message_type: str
    view_duration: Optional[int]
    read_count: int
    view_count: int
    is_read_by_user: bool
    created_at: datetime
    expires_at: datetime

class ConversationResponse(BaseModel):
    """Conversation response schema"""
    id: int
    other_user_id: int
    other_user: UserResponse  # Use existing UserResponse instead
    last_message: Optional[DirectMessageResponse]
    unread_count: int
    is_archived: bool
    is_muted: bool
    updated_at: datetime

class StoryResponse(BaseModel):
    """Story response schema"""
    id: int
    user_id: int
    user: UserResponse  # Use existing UserResponse instead
    media_url: str
    media_type: str
    caption: Optional[str]
    visibility: str
    view_count: int
    has_viewed: bool
    created_at: datetime
    expires_at: datetime

# Generic response schemas
class SuccessResponse(BaseModel):
    """Generic success response"""
    success: bool = True
    message: str

class ErrorResponse(BaseModel):
    """Generic error response"""
    success: bool = False
    error: str
    detail: Optional[str] = None 