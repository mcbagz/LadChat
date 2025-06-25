from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Text, ForeignKey, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timedelta

class Hangout(Base):
    """
    Hangout model for planning real-world meetups
    """
    __tablename__ = "hangouts"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Event information
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Location information
    location_name = Column(String(200), nullable=True)  # Human-readable name
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    geohash = Column(String(20), nullable=True, index=True)  # For location-based queries
    location_privacy = Column(String(20), default="approximate")  # 'exact', 'approximate', 'hidden'
    
    # Media
    media_url = Column(String(500), nullable=True)  # Photo/video for the hangout
    media_type = Column(String(20), nullable=True)  # 'photo' or 'video'
    
    # Privacy and visibility
    visibility = Column(String(20), default="public")  # 'public', 'friends', 'private'
    circles = Column(JSON, nullable=True)  # Array of circle IDs for targeted sharing
    max_attendees = Column(Integer, nullable=True)  # Optional limit
    
    # Timing
    start_time = Column(DateTime(timezone=True), nullable=True)  # Optional scheduled start
    end_time = Column(DateTime(timezone=True), nullable=True)    # Optional end time
    rsvp_deadline = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)  # When hangout expires
    
    # RSVP tracking
    rsvps = Column(JSON, nullable=True)  # Array of {user_id, status, comment, timestamp}
    attendee_count = Column(Integer, default=0)
    maybe_count = Column(Integer, default=0)
    declined_count = Column(Integer, default=0)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)  # For sponsored/promoted hangouts
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    creator = relationship("User", back_populates="created_hangouts")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Set expiration to 30 days from creation if not specified
        if not self.expires_at:
            self.expires_at = datetime.utcnow() + timedelta(days=30)

    def __repr__(self):
        return f"<Hangout(id={self.id}, title='{self.title}', creator_id={self.creator_id})>"

    def to_dict(self, include_location=True):
        """Convert hangout to dictionary"""
        data = {
            "id": self.id,
            "creator_id": self.creator_id,
            "title": self.title,
            "description": self.description,
            "visibility": self.visibility,
            "max_attendees": self.max_attendees,
            "attendee_count": self.attendee_count,
            "maybe_count": self.maybe_count,
            "declined_count": self.declined_count,
            "is_featured": self.is_featured,
            "media_url": self.media_url,
            "media_type": self.media_type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "rsvp_deadline": self.rsvp_deadline.isoformat() if self.rsvp_deadline else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_active": self.is_active
        }
        
        # Include location based on privacy settings
        if include_location:
            if self.location_privacy == "exact":
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
            # 'hidden' shows no location info
        
        return data

    def is_expired(self):
        """Check if hangout has expired"""
        return datetime.utcnow() > self.expires_at

    def add_rsvp(self, user_id: int, status: str, comment: str = None):
        """Add or update RSVP for a user"""
        if not self.rsvps:
            self.rsvps = []
        
        # Remove existing RSVP from same user
        self.rsvps = [r for r in self.rsvps if r.get('user_id') != user_id]
        
        # Add new RSVP
        rsvp_data = {
            "user_id": user_id,
            "status": status,  # 'yes', 'maybe', 'no'
            "comment": comment,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.rsvps.append(rsvp_data)
        
        # Update counts
        self._update_rsvp_counts()

    def _update_rsvp_counts(self):
        """Update RSVP counts based on current RSVPs"""
        if not self.rsvps:
            self.attendee_count = self.maybe_count = self.declined_count = 0
            return
        
        self.attendee_count = sum(1 for r in self.rsvps if r.get('status') == 'yes')
        self.maybe_count = sum(1 for r in self.rsvps if r.get('status') == 'maybe')
        self.declined_count = sum(1 for r in self.rsvps if r.get('status') == 'no')

    def get_user_rsvp(self, user_id: int):
        """Get RSVP status for a specific user"""
        if not self.rsvps:
            return None
        
        return next((r for r in self.rsvps if r.get('user_id') == user_id), None)

    def can_rsvp(self, user_id: int = None):
        """Check if RSVPs are still allowed"""
        if not self.is_active or self.is_expired():
            return False
        
        # Check RSVP deadline
        if self.rsvp_deadline and datetime.utcnow() > self.rsvp_deadline:
            return False
        
        # Check attendee limit
        if self.max_attendees and self.attendee_count >= self.max_attendees:
            # Allow if user already has an RSVP
            if user_id and self.get_user_rsvp(user_id):
                return True
            return False
        
        return True 