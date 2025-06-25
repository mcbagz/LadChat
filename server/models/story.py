from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timedelta

class Story(Base):
    """
    Story model for ephemeral content (24-hour expiration)
    """
    __tablename__ = "stories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Content information
    media_url = Column(String(500), nullable=False)  # S3 URL or local path
    media_type = Column(String(20), nullable=False)  # 'photo' or 'video'
    caption = Column(Text, nullable=True)
    
    # Privacy and visibility
    visibility = Column(String(20), default="public")  # 'public', 'friends', 'private'
    circles = Column(JSON, nullable=True)  # Array of circle IDs for targeted sharing
    
    # Ephemeral settings
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Engagement
    view_count = Column(Integer, default=0)
    viewers = Column(JSON, nullable=True)  # Array of user IDs who viewed
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    
    # Relationships
    user = relationship("User", back_populates="stories")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Set expiration to 24 hours from creation
        if not self.expires_at:
            self.expires_at = datetime.utcnow() + timedelta(hours=24)

    def __repr__(self):
        return f"<Story(id={self.id}, user_id={self.user_id}, active={self.is_active})>"

    def to_dict(self):
        """Convert story to dictionary"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "media_url": self.media_url,
            "media_type": self.media_type,
            "caption": self.caption,
            "visibility": self.visibility,
            "view_count": self.view_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_active": self.is_active
        }

    def is_expired(self):
        """Check if story has expired"""
        return datetime.utcnow() > self.expires_at

    def add_view(self, viewer_id: int):
        """Add a view to the story"""
        if not self.viewers:
            self.viewers = []
        
        if viewer_id not in self.viewers:
            self.viewers.append(viewer_id)
            self.view_count = len(self.viewers) 