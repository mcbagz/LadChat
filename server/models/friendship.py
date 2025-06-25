from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class FriendRequest(Base):
    __tablename__ = "friend_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="pending")  # pending, accepted, declined, cancelled
    message = Column(String(500), nullable=True)  # Optional message with request
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_friend_requests")
    recipient = relationship("User", foreign_keys=[recipient_id], back_populates="received_friend_requests")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_friend_request_sender', 'sender_id'),
        Index('idx_friend_request_recipient', 'recipient_id'),
        Index('idx_friend_request_status', 'status'),
    )

class Friendship(Base):
    __tablename__ = "friendships"
    
    id = Column(Integer, primary_key=True, index=True)
    user1_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user2_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user1 = relationship("User", foreign_keys=[user1_id])
    user2 = relationship("User", foreign_keys=[user2_id])
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_friendship_user1', 'user1_id'),
        Index('idx_friendship_user2', 'user2_id'),
        Index('idx_friendship_users', 'user1_id', 'user2_id'),
    ) 