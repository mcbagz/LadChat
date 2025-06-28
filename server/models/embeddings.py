from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class UserEmbedding(Base):
    """
    Store user embeddings for RAG-based recommendations
    Two embeddings per user: profile-based and message-based
    """
    __tablename__ = "user_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    profile_embedding = Column(JSON, nullable=True)  # From bio + interests
    message_embedding = Column(JSON, nullable=True)  # From recent messages + snaps
    last_updated = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="embedding")

    def __repr__(self):
        return f"<UserEmbedding(user_id={self.user_id}, last_updated={self.last_updated})>"

class GroupEmbedding(Base):
    """
    Store group embeddings for RAG-based event recommendations to groups
    Based on recent group messages and snaps
    """
    __tablename__ = "group_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("group_chats.id"), unique=True, nullable=False)
    group_embedding = Column(JSON, nullable=False)  # From recent group messages + snaps
    last_updated = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    group_chat = relationship("GroupChat", back_populates="embedding")

    def __repr__(self):
        return f"<GroupEmbedding(group_id={self.group_id}, last_updated={self.last_updated})>"

class EventEmbedding(Base):
    """
    Store event embeddings for RAG-based event recommendations
    Based on event title and description, created when event is created
    """
    __tablename__ = "event_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), unique=True, nullable=False)
    event_embedding = Column(JSON, nullable=False)  # From title + description
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    event = relationship("Event", back_populates="embedding")

    def __repr__(self):
        return f"<EventEmbedding(event_id={self.event_id}, created_at={self.created_at})>"

class ChatActivity(Base):
    """
    Track when users last opened chats for in-app notifications
    """
    __tablename__ = "chat_activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    chat_type = Column(String(20), nullable=False)  # 'direct' or 'group'
    chat_id = Column(Integer, nullable=False)  # conversation_id or group_id
    last_opened_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="chat_activities")
    
    # Ensure unique combination of user + chat
    __table_args__ = (
        UniqueConstraint('user_id', 'chat_type', 'chat_id', name='unique_user_chat'),
    )

    def __repr__(self):
        return f"<ChatActivity(user_id={self.user_id}, chat_type={self.chat_type}, chat_id={self.chat_id})>" 