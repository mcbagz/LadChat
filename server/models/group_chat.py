from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timedelta

class GroupChat(Base):
    """
    GroupChat model for group conversations with AI-powered recommendations
    """
    __tablename__ = "group_chats"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Group information
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    
    # Member management
    members = Column(JSON, nullable=False)  # Array of user IDs
    admins = Column(JSON, nullable=True)    # Array of admin user IDs
    member_count = Column(Integer, default=0)
    max_members = Column(Integer, default=50)
    
    # AI-powered group profiling
    group_interests = Column(JSON, nullable=True)  # Auto-generated from member interests
    profile_embeddings = Column(JSON, nullable=True)  # For RAG-based recommendations
    auto_suggest_members = Column(Boolean, default=True)
    auto_suggest_events = Column(Boolean, default=True)
    
    # Privacy settings
    visibility = Column(String(20), default="private")  # 'public', 'private', 'invite_only'
    join_approval_required = Column(Boolean, default=True)
    
    # Activity tracking
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    message_count = Column(Integer, default=0)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    creator = relationship("User", back_populates="created_groups")
    embedding = relationship("GroupEmbedding", back_populates="group_chat", uselist=False)

    def __repr__(self):
        return f"<GroupChat(id={self.id}, name='{self.name}', members={self.member_count})>"

    def to_dict(self, include_members=False):
        """Convert group chat to dictionary"""
        data = {
            "id": self.id,
            "creator_id": self.creator_id,
            "name": self.name,
            "description": self.description,
            "avatar_url": self.avatar_url,
            "member_count": self.member_count,
            "max_members": self.max_members,
            "group_interests": self.group_interests or [],
            "visibility": self.visibility,
            "join_approval_required": self.join_approval_required,
            "auto_suggest_members": self.auto_suggest_members,
            "auto_suggest_events": self.auto_suggest_events,
            "last_message_at": self.last_message_at.isoformat() if self.last_message_at else None,
            "message_count": self.message_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "is_active": self.is_active
        }
        
        if include_members:
            data["members"] = self.members or []
            data["admins"] = self.admins or []
        
        return data

    def add_member(self, user_id: int, is_admin: bool = False):
        """Add a member to the group"""
        if not self.members:
            self.members = []
        if not self.admins:
            self.admins = []
        
        if user_id not in self.members:
            self.members.append(user_id)
            self.member_count = len(self.members)
        
        if is_admin and user_id not in self.admins:
            self.admins.append(user_id)

    def remove_member(self, user_id: int):
        """Remove a member from the group"""
        if self.members and user_id in self.members:
            self.members.remove(user_id)
            self.member_count = len(self.members)
        
        if self.admins and user_id in self.admins:
            self.admins.remove(user_id)

    def is_member(self, user_id: int):
        """Check if user is a member"""
        return user_id in (self.members or [])

    def is_admin(self, user_id: int):
        """Check if user is an admin"""
        return user_id in (self.admins or [])

    def can_join(self, user_id: int = None):
        """Check if a user can join the group"""
        if not self.is_active:
            return False
        
        if self.member_count >= self.max_members:
            return False
        
        if user_id and self.is_member(user_id):
            return False  # Already a member
        
        return True

    def update_activity(self):
        """Update last activity timestamp"""
        self.last_message_at = datetime.utcnow()
        self.message_count += 1

    def generate_group_vibe(self, member_interests: list):
        """Generate group vibe/interests from member data"""
        # Simple implementation - count interest frequency
        interest_counts = {}
        for interests in member_interests:
            for interest in interests:
                interest_counts[interest] = interest_counts.get(interest, 0) + 1
        
        # Get top 3 most common interests
        sorted_interests = sorted(interest_counts.items(), key=lambda x: x[1], reverse=True)
        self.group_interests = [interest for interest, count in sorted_interests[:3]]

class GroupMessage(Base):
    """
    Messages within group chats (separate table for scalability)
    """
    __tablename__ = "group_messages"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("group_chats.id"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Message content
    content = Column(Text, nullable=True)
    media_url = Column(String(500), nullable=True)
    media_type = Column(String(20), nullable=True)  # 'photo', 'video', 'audio'
    
    # Message type and behavior
    message_type = Column(String(20), default="text")  # 'text', 'media', 'system', 'suggestion'
    view_duration = Column(Integer, nullable=True)  # For media messages (1-60 seconds)
    
    # System messages (member joins, leaves, etc.)
    system_action = Column(String(50), nullable=True)  # 'join', 'leave', 'add_member', etc.
    
    # Ephemeral settings
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Read receipts - JSON array of {user_id, read_at}
    read_receipts = Column(JSON, nullable=True)
    
    # Media viewing tracking
    view_receipts = Column(JSON, nullable=True)  # For media messages
    screenshot_alerts = Column(JSON, nullable=True)  # Track screenshots
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    is_deleted = Column(Boolean, default=False)
    
    # Relationships
    group = relationship("GroupChat")
    sender = relationship("User")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Set default expiration based on message type
        if not self.expires_at:
            if self.message_type == "media":
                # Media messages expire after 24 hours (viewing window)
                self.expires_at = datetime.utcnow() + timedelta(hours=24)
            else:
                # Text messages expire after 1 week
                self.expires_at = datetime.utcnow() + timedelta(weeks=1)

    def __repr__(self):
        return f"<GroupMessage(id={self.id}, group_id={self.group_id}, sender_id={self.sender_id}, type={self.message_type})>"

    def to_dict(self, for_user_id: int = None):
        """Convert message to dictionary"""
        data = {
            "id": self.id,
            "group_id": self.group_id,
            "sender_id": self.sender_id,
            "message_type": self.message_type,
            "system_action": self.system_action,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_deleted": self.is_deleted
        }
        
        # Include content based on message type
        if self.message_type == "text":
            data["content"] = self.content
        elif self.message_type == "media":
            if self.can_view(for_user_id):
                data.update({
                    "media_url": self.media_url,
                    "media_type": self.media_type,
                    "view_duration": self.view_duration
                })
        
        # Include read receipt info for sender
        if for_user_id and self.sender_id == for_user_id:
            data["read_receipts"] = self.read_receipts or []
            if self.message_type == "media":
                data["view_receipts"] = self.view_receipts or []
                data["screenshot_alerts"] = self.screenshot_alerts or []
        
        # Include user's read status
        if for_user_id:
            data["is_read_by_user"] = self.is_read_by_user(for_user_id)
            if self.message_type == "media":
                data["is_viewed_by_user"] = self.is_viewed_by_user(for_user_id)
        
        return data

    def is_expired(self):
        """Check if message has expired"""
        return datetime.utcnow() > self.expires_at

    def can_view(self, user_id: int):
        """Check if user can view this message"""
        if self.is_deleted or self.is_expired():
            return False
        
        # For now, assume all group members can view
        # In a real implementation, check if user is group member
        return True

    def mark_as_read(self, user_id: int):
        """Mark message as read by user"""
        if not self.read_receipts:
            self.read_receipts = []
        
        # Check if already marked as read by this user
        for receipt in self.read_receipts:
            if receipt.get('user_id') == user_id:
                return  # Already marked as read
        
        # Add read receipt
        self.read_receipts.append({
            "user_id": user_id,
            "read_at": datetime.utcnow().isoformat()
        })

    def mark_as_viewed(self, user_id: int, screenshot_taken: bool = False):
        """Mark media message as viewed by user"""
        if self.message_type != "media":
            return
        
        if not self.view_receipts:
            self.view_receipts = []
        
        # Check if already viewed by this user
        for receipt in self.view_receipts:
            if receipt.get('user_id') == user_id:
                if screenshot_taken:
                    self._add_screenshot_alert(user_id)
                return
        
        # Add view receipt
        self.view_receipts.append({
            "user_id": user_id,
            "viewed_at": datetime.utcnow().isoformat(),
            "screenshot_taken": screenshot_taken
        })
        
        # Also mark as read
        self.mark_as_read(user_id)
        
        if screenshot_taken:
            self._add_screenshot_alert(user_id)

    def _add_screenshot_alert(self, user_id: int):
        """Add screenshot alert"""
        if not self.screenshot_alerts:
            self.screenshot_alerts = []
        
        self.screenshot_alerts.append({
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        })

    def is_read_by_user(self, user_id: int):
        """Check if message is read by specific user"""
        if not self.read_receipts:
            return False
        
        return any(receipt.get('user_id') == user_id for receipt in self.read_receipts)

    def is_viewed_by_user(self, user_id: int):
        """Check if media message is viewed by specific user"""
        if self.message_type != "media" or not self.view_receipts:
            return False
        
        return any(receipt.get('user_id') == user_id for receipt in self.view_receipts)

    def get_read_count(self):
        """Get total read count"""
        return len(self.read_receipts) if self.read_receipts else 0

    def get_view_count(self):
        """Get total view count for media messages"""
        return len(self.view_receipts) if self.view_receipts and self.message_type == "media" else 0 