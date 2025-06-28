from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Text, ForeignKey, Float, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timedelta, timezone
import geohash

class Event(Base):
    """
    Event model for planning real-world meetups and events
    Enhanced from Hangout to support premium features and advanced event management
    """
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Event information
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    story = Column(Text, nullable=True)  # Event story/description for Phase 5
    
    # Location information (creator must be at location to create)
    location_name = Column(String(200), nullable=False)  # Required for events
    latitude = Column(Float, nullable=False)  # Required for location validation
    longitude = Column(Float, nullable=False)  # Required for location validation
    geohash = Column(String(20), nullable=False, index=True)  # For location-based queries
    creator_latitude = Column(Float, nullable=False)  # Creator's location when creating
    creator_longitude = Column(Float, nullable=False)  # Creator's location when creating
    location_privacy = Column(String(20), default="approximate")  # 'exact', 'approximate', 'hidden'
    
    # Media (story media - can have multiple)
    story_media = Column(JSON, nullable=True)  # Array of {url, type, caption} for event story
    media_url = Column(String(500), nullable=True)  # Primary photo/video (legacy)
    media_type = Column(String(20), nullable=True)  # 'photo' or 'video' (legacy)
    
    # Privacy and visibility
    visibility = Column(String(20), default="friends")  # 'public', 'friends', 'private', 'groups'
    shared_with_friends = Column(JSON, nullable=True)  # Array of friend IDs for targeted sharing
    shared_with_groups = Column(JSON, nullable=True)  # Array of group IDs for targeted sharing
    max_attendees = Column(Integer, nullable=True)  # Optional limit
    
    # Premium features
    is_premium = Column(Boolean, default=False)  # $50 premium public events
    payment_id = Column(String(255), nullable=True)  # Stripe payment ID for premium events
    payment_status = Column(String(50), default="pending")  # 'pending', 'completed', 'failed', 'refunded'
    view_count = Column(Integer, default=0)  # Analytics for premium events
    
    # Timing
    start_time = Column(DateTime(timezone=True), nullable=False)  # Required for events
    end_time = Column(DateTime(timezone=True), nullable=False)    # Required for events
    rsvp_deadline = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)  # Auto-expire after end_time
    
    # RSVP tracking with enhanced privacy
    rsvps = Column(JSON, nullable=True)  # Array of {user_id, status, comment, timestamp, is_friend}
    attendee_count = Column(Integer, default=0)
    maybe_count = Column(Integer, default=0)
    declined_count = Column(Integer, default=0)
    friend_attendee_count = Column(Integer, default=0)  # Count of attending friends
    
    # Status and metadata
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)  # For sponsored/promoted events
    is_ongoing = Column(Boolean, default=False)  # Currently happening
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Legacy alias for backward compatibility
    __table_args__ = ()
    
    # Create alias for backward compatibility
    Hangout = None
    
    # Relationships
    creator = relationship("User", back_populates="created_events")
    embedding = relationship("EventEmbedding", back_populates="event", uselist=False)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Generate geohash if coordinates provided
        if self.latitude and self.longitude and not self.geohash:
            try:
                self.geohash = geohash.encode(float(self.latitude), float(self.longitude), precision=7)
            except Exception:
                # If geohash fails, create a fallback geohash based on coordinates
                self.geohash = f"{int(self.latitude*100)}_{int(self.longitude*100)}"
        
        # Set expiration to end_time if not specified
        if not self.expires_at and self.end_time:
            # Events expire 1 hour after end_time
            self.expires_at = self.end_time + timedelta(hours=1)
        elif not self.expires_at:
            # Fallback: expire in 7 days (max advance time)
            self.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        # Validate creation constraints
        self._validate_creation_constraints()

    def __repr__(self):
        return f"<Event(id={self.id}, title='{self.title}', creator_id={self.creator_id}, is_premium={self.is_premium})>"

    def to_dict(self, include_location=True, user_id=None, is_friend=False):
        """Convert event to dictionary with privacy controls"""
        data = {
            "id": self.id,
            "creator_id": self.creator_id,
            "title": self.title,
            "description": self.description,
            "story": self.story,
            "visibility": self.visibility,
            "max_attendees": self.max_attendees,
            "attendee_count": self.attendee_count,
            "maybe_count": self.maybe_count,
            "declined_count": self.declined_count,
            "friend_attendee_count": self.friend_attendee_count if is_friend else None,
            "is_featured": self.is_featured,
            "is_premium": self.is_premium,
            "is_ongoing": self.is_ongoing,
            "view_count": self.view_count if self.is_premium and (user_id == self.creator_id) else None,
            "story_media": self.story_media or [],
            "media_url": self.media_url,
            "media_type": self.media_type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "rsvp_deadline": self.rsvp_deadline.isoformat() if self.rsvp_deadline else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_active": self.is_active,
            "can_rsvp": self.can_rsvp(user_id),
            "user_rsvp": self.get_user_rsvp(user_id) if user_id else None
        }
        
        # Include location based on privacy settings and user access
        if include_location:
            if self.location_privacy == "exact" or user_id == self.creator_id:
                data.update({
                    "location_name": self.location_name,
                    "latitude": self.latitude,
                    "longitude": self.longitude
                })
            elif self.location_privacy == "approximate":
                data.update({
                    "location_name": self.location_name,
                    "latitude": round(self.latitude, 2) if self.latitude else None,
                    "longitude": round(self.longitude, 2) if self.longitude else None
                })
            elif self.visibility == "public" and self.is_premium:
                # Premium public events show approximate location
                data.update({
                    "location_name": self.location_name,
                    "latitude": round(self.latitude, 1) if self.latitude else None,
                    "longitude": round(self.longitude, 1) if self.longitude else None
                })
            # 'hidden' shows no location info
        
        return data

    def is_expired(self):
        """Check if event has expired"""
        now = datetime.now(timezone.utc)
        # Ensure expires_at is timezone-aware for comparison
        expires_at = self.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return now > expires_at

    def is_happening_now(self):
        """Check if event is currently happening"""
        now = datetime.now(timezone.utc)
        # Ensure start_time and end_time are timezone-aware for comparison
        start_time = self.start_time
        end_time = self.end_time
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        return start_time <= now <= end_time

    def add_rsvp(self, user_id: int, status: str, comment: str = None, is_friend: bool = False):
        """Add or update RSVP for a user with friend tracking"""
        if not self.rsvps:
            self.rsvps = []
        
        # Remove existing RSVP from same user
        self.rsvps = [r for r in self.rsvps if r.get('user_id') != user_id]
        
        # Add new RSVP
        rsvp_data = {
            "user_id": user_id,
            "status": status,  # 'yes', 'maybe', 'no'
            "comment": comment,
            "is_friend": is_friend,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.rsvps.append(rsvp_data)
        
        # Update counts
        self._update_rsvp_counts()

    def _update_rsvp_counts(self):
        """Update RSVP counts based on current RSVPs"""
        if not self.rsvps:
            self.attendee_count = self.maybe_count = self.declined_count = self.friend_attendee_count = 0
            return
        
        self.attendee_count = sum(1 for r in self.rsvps if r.get('status') == 'yes')
        self.maybe_count = sum(1 for r in self.rsvps if r.get('status') == 'maybe')
        self.declined_count = sum(1 for r in self.rsvps if r.get('status') == 'no')
        self.friend_attendee_count = sum(1 for r in self.rsvps if r.get('status') == 'yes' and r.get('is_friend', False))

    def get_user_rsvp(self, user_id: int):
        """Get RSVP status for a specific user"""
        if not self.rsvps or not user_id:
            return None
        
        return next((r for r in self.rsvps if r.get('user_id') == user_id), None)

    def can_rsvp(self, user_id: int = None):
        """Check if RSVPs are still allowed"""
        if not self.is_active or self.is_expired():
            return False
        
        now = datetime.now(timezone.utc)
        
        # Check if event has already ended
        end_time = self.end_time
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        if now > end_time:
            return False
        
        # Check RSVP deadline
        if self.rsvp_deadline:
            deadline = self.rsvp_deadline
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            if now > deadline:
                return False
        
        # Check attendee limit
        if self.max_attendees and self.attendee_count >= self.max_attendees:
            # Allow if user already has an RSVP
            if user_id and self.get_user_rsvp(user_id):
                return True
            return False
        
        return True

    def increment_view_count(self):
        """Increment view count for analytics (premium events only)"""
        if self.is_premium:
            self.view_count += 1

    def add_story_media(self, media_url: str, media_type: str, caption: str = None):
        """Add media to event story"""
        if not self.story_media:
            self.story_media = []
        
        media_item = {
            "url": media_url,
            "type": media_type,
            "caption": caption,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.story_media.append(media_item)

    def validate_location_proximity(self, creator_lat: float, creator_lng: float, max_distance_km: float = 0.1):
        """Validate that creator is at the event location (within 100m by default)"""
        from math import radians, cos, sin, asin, sqrt
        
        # Haversine formula to calculate distance
        lat1, lng1, lat2, lng2 = map(radians, [creator_lat, creator_lng, self.latitude, self.longitude])
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
        distance_km = 2 * asin(sqrt(a)) * 6371  # Earth's radius in km
        
        return distance_km <= max_distance_km

    def _validate_creation_constraints(self):
        """Validate event creation constraints"""
        now = datetime.now(timezone.utc)
        
        # Ensure times are timezone-aware for comparison
        start_time = self.start_time
        end_time = self.end_time
        
        if start_time and start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time and end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        
        # Cannot create events more than 1 week in advance
        if start_time and start_time > now + timedelta(weeks=1):
            raise ValueError("Events cannot be created more than 1 week in advance")
        
        # End time must be after start time
        if start_time and end_time and end_time <= start_time:
            raise ValueError("End time must be after start time")
        
        # Events cannot be created in the past
        if start_time and start_time < now:
            raise ValueError("Events cannot be created in the past")

    @classmethod
    def get_user_active_event_count(cls, db_session, user_id: int):
        """Get count of active events created by user"""
        return db_session.query(cls).filter(
            cls.creator_id == user_id,
            cls.is_active == True,
            cls.end_time > datetime.now(timezone.utc)
        ).count()

    @classmethod
    def can_user_create_event(cls, db_session, user_id: int):
        """Check if user can create a new event (max 3 active events)"""
        active_count = cls.get_user_active_event_count(db_session, user_id)
        return active_count < 3

    def update_ongoing_status(self):
        """Update is_ongoing status based on current time"""
        now = datetime.now(timezone.utc)
        
        # Ensure times are timezone-aware for comparison
        start_time = self.start_time
        end_time = self.end_time
        
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
            
        self.is_ongoing = start_time <= now <= end_time

# Create backward-compatible alias
Hangout = Event 