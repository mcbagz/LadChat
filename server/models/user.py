from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    """
    User model for LadChat
    Stores basic user information with minimal data approach
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    # Profile information
    bio = Column(Text, nullable=True)  # Optional bio (max 100 chars in frontend)
    interests = Column(JSON, nullable=True)  # Array of interest strings
    profile_photo_url = Column(String(500), nullable=True)
    
    # Privacy and friend matching settings
    open_to_friends = Column(Boolean, default=False)
    location_radius = Column(Integer, default=5)  # Radius in km for friend matching
    
    # Account status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_active = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    stories = relationship("Story", back_populates="user", lazy="dynamic")
    created_hangouts = relationship("Hangout", back_populates="creator", lazy="dynamic")
    created_groups = relationship("GroupChat", back_populates="creator", lazy="dynamic")
    
    # Friend relationships
    sent_friend_requests = relationship("FriendRequest", foreign_keys="FriendRequest.sender_id", back_populates="sender", lazy="dynamic")
    received_friend_requests = relationship("FriendRequest", foreign_keys="FriendRequest.recipient_id", back_populates="recipient", lazy="dynamic")

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', active={self.is_active})>"

    def to_dict(self):
        """
        Convert user to dictionary (excluding sensitive information)
        """
        return {
            "id": self.id,
            "username": self.username,
            "bio": self.bio,
            "interests": self.interests or [],
            "profile_photo_url": self.profile_photo_url,
            "open_to_friends": self.open_to_friends,
            "is_verified": self.is_verified,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def to_public_dict(self):
        """
        Convert user to public dictionary (for friend recommendations)
        """
        return {
            "id": self.id,
            "username": self.username,
            "interests": self.interests or [],
            "is_verified": self.is_verified,
        } 