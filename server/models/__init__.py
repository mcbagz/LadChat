"""
Models package for LadChat
Imports all database models to ensure they are registered with SQLAlchemy
"""

from .user import User
from .story import Story
from .snap import Snap
from .hangout import Event, Hangout
from .group_chat import GroupChat, GroupMessage
from .venue import Venue, VenueReview
from .direct_message import DirectMessage, Conversation
from .friendship import FriendRequest, Friendship
from .embeddings import UserEmbedding, GroupEmbedding, EventEmbedding, ChatActivity

__all__ = [
    "User",
    "Story", 
    "Snap",
    "Event",
    "Hangout",  # Backward compatibility alias
    "GroupChat",
    "GroupMessage",
    "Venue",
    "VenueReview",
    "DirectMessage",
    "Conversation",
    "FriendRequest",
    "Friendship",
    "UserEmbedding",
    "GroupEmbedding", 
    "EventEmbedding",
    "ChatActivity"
] 