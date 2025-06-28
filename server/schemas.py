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
    profile_photo_url: Optional[str] = None

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
    content: Optional[str] = None
    message_type: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    view_duration: Optional[int] = None
    read_count: int = 0
    view_count: int = 0
    is_read_by_user: bool = False
    system_action: Optional[str] = None
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

# Group Chat Schemas
class GroupChatCreate(BaseModel):
    """Schema for creating a group chat"""
    name: str
    description: Optional[str] = None
    initial_member_ids: Optional[List[int]] = []
    visibility: str = "private"  # 'public', 'private', 'invite_only'
    max_members: int = 50
    
    @validator('name')
    def validate_name(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError('Group name must be at least 2 characters long')
        if len(v) > 100:
            raise ValueError('Group name must be less than 100 characters')
        return v.strip()
    
    @validator('description')
    def validate_description(cls, v):
        if v and len(v) > 500:
            raise ValueError('Group description must be less than 500 characters')
        return v
    
    @validator('visibility')
    def validate_visibility(cls, v):
        if v not in ['public', 'private', 'invite_only']:
            raise ValueError('Visibility must be public, private, or invite_only')
        return v
    
    @validator('max_members')
    def validate_max_members(cls, v):
        if v < 2 or v > 100:
            raise ValueError('Max members must be between 2 and 100')
        return v
    
    @validator('initial_member_ids')
    def validate_initial_members(cls, v):
        if v and len(v) > 20:
            raise ValueError('Cannot add more than 20 initial members')
        return v

class GroupChatUpdate(BaseModel):
    """Schema for updating group chat settings"""
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[str] = None
    max_members: Optional[int] = None
    auto_suggest_members: Optional[bool] = None
    auto_suggest_events: Optional[bool] = None
    join_approval_required: Optional[bool] = None
    
    @validator('name')
    def validate_name(cls, v):
        if v is not None:
            if not v or len(v.strip()) < 2:
                raise ValueError('Group name must be at least 2 characters long')
            if len(v) > 100:
                raise ValueError('Group name must be less than 100 characters')
        return v.strip() if v else v
    
    @validator('description')
    def validate_description(cls, v):
        if v and len(v) > 500:
            raise ValueError('Group description must be less than 500 characters')
        return v
    
    @validator('visibility')
    def validate_visibility(cls, v):
        if v and v not in ['public', 'private', 'invite_only']:
            raise ValueError('Visibility must be public, private, or invite_only')
        return v
    
    @validator('max_members')
    def validate_max_members(cls, v):
        if v and (v < 2 or v > 100):
            raise ValueError('Max members must be between 2 and 100')
        return v

class GroupMemberAdd(BaseModel):
    """Schema for adding members to a group"""
    user_ids: List[int]
    make_admin: bool = False
    
    @validator('user_ids')
    def validate_user_ids(cls, v):
        if not v:
            raise ValueError('At least one user ID must be provided')
        if len(v) > 10:
            raise ValueError('Cannot add more than 10 members at once')
        return v

class GroupMemberUpdate(BaseModel):
    """Schema for updating group member permissions"""
    is_admin: bool

class GroupChatResponse(BaseModel):
    """Schema for group chat response"""
    id: int
    creator_id: int
    name: str
    description: Optional[str]
    avatar_url: Optional[str]
    member_count: int
    max_members: int
    group_interests: List[str]
    visibility: str
    join_approval_required: bool
    auto_suggest_members: bool
    auto_suggest_events: bool
    last_message_at: Optional[datetime]
    message_count: int
    created_at: datetime
    is_active: bool
    user_is_member: bool
    user_is_admin: bool
    
    class Config:
        from_attributes = True

class GroupMemberResponse(BaseModel):
    """Schema for group member response"""
    user_id: int
    user: UserResponse
    is_admin: bool
    joined_at: datetime
    
    class Config:
        from_attributes = True

class GroupListResponse(BaseModel):
    """Schema for user's groups list response"""
    groups: List[GroupChatResponse]
    total_count: int

# Event/Hangout Schemas
class EventCreate(BaseModel):
    """Schema for creating an event"""
    title: str
    description: Optional[str] = None
    story: Optional[str] = None
    location_name: str
    latitude: float
    longitude: float
    creator_latitude: float  # Creator's current location for validation
    creator_longitude: float  # Creator's current location for validation
    start_time: datetime
    end_time: datetime
    rsvp_deadline: Optional[datetime] = None
    max_attendees: Optional[int] = None
    visibility: str = "friends"  # 'public', 'friends', 'private', 'groups'
    shared_with_friends: Optional[List[int]] = []
    shared_with_groups: Optional[List[int]] = []
    is_premium: bool = False
    location_privacy: str = "approximate"  # 'exact', 'approximate', 'hidden'
    
    @validator('title')
    def validate_title(cls, v):
        if not v or len(v.strip()) < 3:
            raise ValueError('Event title must be at least 3 characters long')
        if len(v) > 100:
            raise ValueError('Event title must be less than 100 characters')
        return v.strip()
    
    @validator('description')
    def validate_description(cls, v):
        if v and len(v) > 500:
            raise ValueError('Event description must be less than 500 characters')
        return v
    
    @validator('story')
    def validate_story(cls, v):
        if v and len(v) > 1000:
            raise ValueError('Event story must be less than 1000 characters')
        return v
    
    @validator('location_name')
    def validate_location_name(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError('Location name must be at least 2 characters long')
        if len(v) > 200:
            raise ValueError('Location name must be less than 200 characters')
        return v.strip()
    
    @validator('latitude', 'longitude', 'creator_latitude', 'creator_longitude')
    def validate_coordinates(cls, v):
        if v is None:
            raise ValueError('Coordinates are required')
        return v
    
    @validator('visibility')
    def validate_visibility(cls, v):
        if v not in ['public', 'friends', 'private', 'groups']:
            raise ValueError('Visibility must be public, friends, private, or groups')
        return v
    
    @validator('location_privacy')
    def validate_location_privacy(cls, v):
        if v not in ['exact', 'approximate', 'hidden']:
            raise ValueError('Location privacy must be exact, approximate, or hidden')
        return v
    
    @validator('end_time')
    def validate_end_time(cls, v, values):
        if 'start_time' in values and values['start_time'] and v <= values['start_time']:
            raise ValueError('End time must be after start time')
        return v
    
    @validator('start_time')
    def validate_start_time(cls, v):
        from datetime import datetime, timedelta, timezone
        
        # Ensure we're working with timezone-aware datetimes
        now = datetime.now(timezone.utc)
        
        # If v is timezone-naive, assume it's UTC
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        
        # Convert to UTC if it's in a different timezone
        if v.tzinfo != timezone.utc:
            v = v.astimezone(timezone.utc)
        
        max_advance = now + timedelta(weeks=1)
        
        if v < now:
            raise ValueError('Events cannot be created in the past')
        if v > max_advance:
            raise ValueError('Events cannot be created more than 1 week in advance')
        return v
    
    @validator('max_attendees')
    def validate_max_attendees(cls, v):
        if v is not None and (v < 2 or v > 1000):
            raise ValueError('Max attendees must be between 2 and 1000')
        return v

class EventUpdate(BaseModel):
    """Schema for updating an event"""
    title: Optional[str] = None
    description: Optional[str] = None
    story: Optional[str] = None
    end_time: Optional[datetime] = None
    rsvp_deadline: Optional[datetime] = None
    max_attendees: Optional[int] = None
    location_privacy: Optional[str] = None
    
    # Note: Cannot update location, start_time, visibility, or premium status after creation
    
    @validator('title')
    def validate_title(cls, v):
        if v is not None and (not v or len(v.strip()) < 3):
            raise ValueError('Event title must be at least 3 characters long')
        if v and len(v) > 100:
            raise ValueError('Event title must be less than 100 characters')
        return v.strip() if v else v

class EventRSVP(BaseModel):
    """Schema for RSVP to an event"""
    status: str  # 'yes', 'maybe', 'no'
    comment: Optional[str] = None
    
    @validator('status')
    def validate_status(cls, v):
        if v not in ['yes', 'maybe', 'no']:
            raise ValueError('RSVP status must be yes, maybe, or no')
        return v
    
    @validator('comment')
    def validate_comment(cls, v):
        if v and len(v) > 200:
            raise ValueError('RSVP comment must be less than 200 characters')
        return v

class EventResponse(BaseModel):
    """Schema for event response"""
    id: int
    creator_id: int
    title: str
    description: Optional[str]
    story: Optional[str]
    location_name: Optional[str]  # Based on privacy settings
    latitude: Optional[float]  # Based on privacy settings
    longitude: Optional[float]  # Based on privacy settings
    start_time: datetime
    end_time: datetime
    rsvp_deadline: Optional[datetime]
    expires_at: datetime
    visibility: str
    max_attendees: Optional[int]
    attendee_count: int
    maybe_count: int
    declined_count: int
    friend_attendee_count: Optional[int]  # Only shown to friends
    is_premium: bool
    is_featured: bool
    is_ongoing: bool
    is_active: bool
    view_count: Optional[int]  # Only shown to creator for premium events
    story_media: List[dict]
    media_url: Optional[str]
    media_type: Optional[str]
    can_rsvp: bool
    user_rsvp: Optional[dict]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class EventListResponse(BaseModel):
    """Schema for event list response"""
    events: List[EventResponse]
    total_count: int
    has_more: bool

class EventStatsResponse(BaseModel):
    """Schema for event statistics (creator only)"""
    event_id: int
    view_count: int
    attendee_count: int
    maybe_count: int
    friend_attendee_count: int
    rsvp_breakdown: dict  # Detailed RSVP statistics

# Premium Event Payment Schema
class PremiumEventPayment(BaseModel):
    """Schema for premium event payment"""
    event_id: int
    payment_method_id: str  # Stripe payment method ID
    
    @validator('payment_method_id')
    def validate_payment_method(cls, v):
        if not v or not v.startswith('pm_'):
            raise ValueError('Valid Stripe payment method ID required')
        return v 