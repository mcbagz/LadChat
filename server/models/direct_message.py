from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timedelta

class DirectMessage(Base):
    """
    Direct message model for private messaging between users
    """
    __tablename__ = "direct_messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Message content
    content = Column(Text, nullable=True)  # Text content (null for media-only messages)
    media_url = Column(String(500), nullable=True)  # Media file URL
    media_type = Column(String(20), nullable=True)  # 'photo', 'video', 'audio'
    
    # Message type and behavior
    message_type = Column(String(20), default="text")  # 'text', 'media', 'system'
    view_duration = Column(Integer, nullable=True)  # For media messages (1-60 seconds)
    
    # Ephemeral settings
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Read status
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    
    # Media viewing for snaps
    is_opened = Column(Boolean, default=False)  # For media messages
    opened_at = Column(DateTime(timezone=True), nullable=True)
    screenshot_taken = Column(Boolean, default=False)
    
    # Status
    is_deleted = Column(Boolean, default=False)
    deleted_for_sender = Column(Boolean, default=False)
    deleted_for_recipient = Column(Boolean, default=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])

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
        return f"<DirectMessage(id={self.id}, from={self.sender_id}, to={self.recipient_id}, type={self.message_type})>"

    def to_dict(self, for_user_id: int = None):
        """Convert message to dictionary"""
        data = {
            "id": self.id,
            "sender_id": self.sender_id,
            "recipient_id": self.recipient_id,
            "message_type": self.message_type,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None
        }
        
        # Include content based on message type and user permissions
        if self.message_type == "text":
            data["content"] = self.content
        elif self.message_type == "media":
            # Only include media info if user can view it
            if self.can_view(for_user_id or self.recipient_id):
                data.update({
                    "media_url": self.media_url,
                    "media_type": self.media_type,
                    "view_duration": self.view_duration,
                    "is_opened": self.is_opened,
                    "screenshot_taken": self.screenshot_taken
                })
        
        # Include read status for sender
        if for_user_id == self.sender_id:
            data.update({
                "read_at": self.read_at.isoformat() if self.read_at else None,
                "opened_at": self.opened_at.isoformat() if self.opened_at else None
            })
        
        return data

    def is_expired(self):
        """Check if message has expired"""
        return datetime.utcnow() > self.expires_at

    def can_view(self, user_id: int):
        """Check if user can view this message"""
        if self.is_deleted or self.is_expired():
            return False
        
        # Check if user is sender or recipient
        if user_id not in [self.sender_id, self.recipient_id]:
            return False
        
        # Check if deleted for this specific user
        if user_id == self.sender_id and self.deleted_for_sender:
            return False
        if user_id == self.recipient_id and self.deleted_for_recipient:
            return False
        
        return True

    def mark_as_read(self, user_id: int):
        """Mark message as read by recipient"""
        if user_id == self.recipient_id and not self.is_read:
            self.is_read = True
            self.read_at = datetime.utcnow()

    def mark_as_opened(self, user_id: int, screenshot_taken: bool = False):
        """Mark media message as opened by recipient"""
        if user_id == self.recipient_id and self.message_type == "media":
            if not self.is_opened:
                self.is_opened = True
                self.opened_at = datetime.utcnow()
                self.mark_as_read(user_id)  # Also mark as read
            
            if screenshot_taken:
                self.screenshot_taken = True

    def delete_for_user(self, user_id: int):
        """Delete message for a specific user"""
        if user_id == self.sender_id:
            self.deleted_for_sender = True
        elif user_id == self.recipient_id:
            self.deleted_for_recipient = True
        
        # If deleted for both users, mark as completely deleted
        if self.deleted_for_sender and self.deleted_for_recipient:
            self.is_deleted = True

class Conversation(Base):
    """
    Conversation model to track messaging between two users
    """
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user1_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    user2_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Last message info
    last_message_id = Column(Integer, ForeignKey("direct_messages.id"), nullable=True)
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    
    # Unread counts for each user
    unread_count_user1 = Column(Integer, default=0)
    unread_count_user2 = Column(Integer, default=0)
    
    # Archive/mute status
    archived_by_user1 = Column(Boolean, default=False)
    archived_by_user2 = Column(Boolean, default=False)
    muted_by_user1 = Column(Boolean, default=False)
    muted_by_user2 = Column(Boolean, default=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user1 = relationship("User", foreign_keys=[user1_id])
    user2 = relationship("User", foreign_keys=[user2_id])
    last_message = relationship("DirectMessage", foreign_keys=[last_message_id])

    def __repr__(self):
        return f"<Conversation(id={self.id}, users=[{self.user1_id}, {self.user2_id}])>"

    def get_other_user_id(self, user_id: int):
        """Get the other participant's user ID"""
        return self.user2_id if user_id == self.user1_id else self.user1_id

    def get_unread_count(self, user_id: int):
        """Get unread count for a specific user"""
        if user_id == self.user1_id:
            return self.unread_count_user1
        elif user_id == self.user2_id:
            return self.unread_count_user2
        return 0

    def increment_unread(self, recipient_id: int):
        """Increment unread count for recipient"""
        if recipient_id == self.user1_id:
            self.unread_count_user1 = (self.unread_count_user1 or 0) + 1
        elif recipient_id == self.user2_id:
            self.unread_count_user2 = (self.unread_count_user2 or 0) + 1

    def reset_unread(self, user_id: int):
        """Reset unread count for user"""
        if user_id == self.user1_id:
            self.unread_count_user1 = 0
        elif user_id == self.user2_id:
            self.unread_count_user2 = 0

    def update_last_message(self, message_id: int):
        """Update last message info"""
        self.last_message_id = message_id
        self.last_message_at = datetime.utcnow()

    def is_archived_by(self, user_id: int):
        """Check if conversation is archived by user"""
        if user_id == self.user1_id:
            return self.archived_by_user1
        elif user_id == self.user2_id:
            return self.archived_by_user2
        return False

    def is_muted_by(self, user_id: int):
        """Check if conversation is muted by user"""
        if user_id == self.user1_id:
            return self.muted_by_user1
        elif user_id == self.user2_id:
            return self.muted_by_user2
        return False 