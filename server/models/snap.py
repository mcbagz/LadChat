from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timedelta

class Snap(Base):
    """
    Snap model for direct ephemeral messages (1-60 seconds or 24 hours viewing)
    """
    __tablename__ = "snaps"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Recipients (can be individuals, groups, or circles)
    recipient_ids = Column(JSON, nullable=True)  # Array of user IDs for direct recipients
    group_ids = Column(JSON, nullable=True)      # Array of group IDs for group recipients
    circle_ids = Column(JSON, nullable=True)     # Array of circle IDs (if sent to circles)
    
    # Content information
    media_url = Column(String(500), nullable=False)  # S3 URL or local path
    media_type = Column(String(20), nullable=False)  # 'photo' or 'video'
    caption = Column(Text, nullable=True)
    
    # Ephemeral settings
    view_duration = Column(Integer, default=10)  # Duration in seconds (1-60) for viewing
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)  # When snap expires completely
    
    # Viewing tracking
    views = Column(JSON, nullable=True)  # Array of {user_id, viewed_at, screenshot_taken}
    total_views = Column(Integer, default=0)
    total_screenshots = Column(Integer, default=0)
    
    # Status
    is_opened = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    sender = relationship("User", foreign_keys=[sender_id])

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Set expiration to 24 hours from creation if not specified
        if not self.expires_at:
            self.expires_at = datetime.utcnow() + timedelta(hours=24)

    def __repr__(self):
        total_recipients = len(self.recipient_ids or []) + len(self.group_ids or [])
        return f"<Snap(id={self.id}, sender_id={self.sender_id}, recipients={total_recipients})>"

    def to_dict(self, for_user_id: int = None):
        """Convert snap to dictionary"""
        data = {
            "id": self.id,
            "sender_id": self.sender_id,
            "recipient_ids": self.recipient_ids or [],
            "group_ids": self.group_ids or [],
            "media_url": self.media_url,
            "media_type": self.media_type,
            "caption": self.caption,
            "view_duration": self.view_duration,
            "total_views": self.total_views,
            "total_screenshots": self.total_screenshots,
            "is_opened": self.is_opened,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_active": self.is_active
        }
        
        # Include view info if user has access
        if for_user_id and self.can_view(for_user_id):
            view_info = self.get_view_info(for_user_id)
            if view_info:
                data["user_view_info"] = view_info
        
        return data

    def is_expired(self):
        """Check if snap has expired"""
        return datetime.utcnow() > self.expires_at

    def add_view(self, viewer_id: int, screenshot_taken: bool = False):
        """Add a view to the snap"""
        if not self.views:
            self.views = []
        
        # Check if user already viewed
        existing_view = next((v for v in self.views if v.get('user_id') == viewer_id), None)
        
        if not existing_view:
            view_data = {
                "user_id": viewer_id,
                "viewed_at": datetime.utcnow().isoformat(),
                "screenshot_taken": screenshot_taken
            }
            self.views.append(view_data)
            self.total_views = len(self.views)
            self.is_opened = True
        
        # Update screenshot count
        if screenshot_taken:
            if existing_view:
                existing_view["screenshot_taken"] = True
            self.total_screenshots = sum(1 for v in self.views if v.get("screenshot_taken", False))

    def can_view(self, user_id: int):
        """Check if user can view this snap"""
        if not self.is_active or self.is_expired():
            return False
        
        # Check if user is a direct recipient
        if user_id in (self.recipient_ids or []):
            return True
        
        # Check if user is in any of the recipient groups
        # Note: This would require checking group membership in a real implementation
        # For now, we'll assume they can view if they have group_ids
        if self.group_ids:
            # TODO: Implement actual group membership check
            return True
        
        return False

    def get_view_info(self, user_id: int):
        """Get viewing information for a specific user"""
        if not self.views:
            return None
        
        return next((v for v in self.views if v.get('user_id') == user_id), None) 