"""
RAG Recommendation Engine for LadChat
Provides AI-powered recommendations for friends, events, and group members
"""

import logging
from typing import List, Dict, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, not_
import math
from datetime import datetime, timezone

# Import services and models
from .chroma_client import chroma_client
from .embedding_service import embedding_service
from models import User, Event, GroupChat, Friendship, FriendRequest
from database import SessionLocal

logger = logging.getLogger(__name__)

class RAGRecommendationEngine:
    """AI-powered recommendation engine using RAG"""
    
    def __init__(self):
        self.chroma_client = chroma_client
        self.embedding_service = embedding_service
        logger.info("RAG Recommendation Engine initialized")
    
    async def recommend_friends(self, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Recommend potential friends based on embedding similarity"""
        try:
            db = SessionLocal()
            
            # Get current user
            current_user = db.query(User).filter(User.id == user_id).first()
            if not current_user or not current_user.open_to_friends:
                return []
            
            # Get user's profile embedding (simplified for testing)
            user_embedding = await self._get_user_profile_embedding(user_id, db)
            if not user_embedding:
                logger.warning(f"No embedding found for user {user_id}")
                return []
            
            # Get users to exclude (existing friends, pending requests, declined requests)
            exclude_user_ids = await self._get_excluded_user_ids(user_id, db)
            exclude_user_ids.append(user_id)  # Exclude self
            
            # Query ChromaDB for similar users (no location filtering for testing)
            similar_users = self.chroma_client.query_similar_users(
                query_embedding=user_embedding,
                n_results=limit * 3,  # Get extra to filter out excluded users
                exclude_user_ids=exclude_user_ids
            )
            
            # Format recommendations with user details
            recommendations = []
            for result in similar_users[:limit]:
                user_detail = db.query(User).filter(
                    User.id == result['user_id'],
                    User.is_active == True,
                    User.open_to_friends == True
                ).first()
                
                if user_detail and user_detail.id not in exclude_user_ids:
                    # Get mutual friends count
                    mutual_count = self._get_mutual_friends_count(user_id, user_detail.id, db)
                    
                    recommendations.append({
                        "user_id": user_detail.id,
                        "username": user_detail.username,
                        "bio": user_detail.bio,
                        "interests": user_detail.interests or [],
                        "profile_photo_url": user_detail.profile_photo_url,
                        "is_verified": user_detail.is_verified,
                        "similarity_score": 1.0 - (result.get('distance', 0.5)),  # Convert distance to similarity
                        "mutual_friends_count": mutual_count,
                        "reason": self._generate_friend_reason(current_user, user_detail)
                    })
            
            db.close()
            logger.info(f"Generated {len(recommendations)} friend recommendations for user {user_id}")
            return recommendations
            
        except Exception as e:
            logger.error(f"Failed to generate friend recommendations for user {user_id}: {e}")
            return []
    
    async def recommend_events_to_user(self, user_id: int, user_lat: float, user_lng: float, 
                                     limit: int = 10) -> List[Dict[str, Any]]:
        """Recommend events based on similarity (location filtering disabled for testing)"""
        try:
            db = SessionLocal()
            
            # Get user's profile embedding (simplified for testing)
            user_embedding = await self._get_user_profile_embedding(user_id, db)
            if not user_embedding:
                return []
            
            # Get all public events (no location filtering for testing)
            all_events = db.query(Event).filter(
                Event.is_active == True,
                Event.visibility == "public"  # Only recommend public events
            ).all()
            
            if not all_events:
                logger.info(f"No public events available for user {user_id}")
                return []
            
            # Get events user has declined
            declined_event_ids = self._get_declined_event_ids(user_id, db)
            
            # Filter out declined events and expired events
            valid_events = [e for e in all_events if e.id not in declined_event_ids and not e.is_expired()]
            if not valid_events:
                return []
            
            # Query ChromaDB for similar events
            event_ids = [event.id for event in valid_events]
            similar_events = self.chroma_client.query_similar_events(
                query_embedding=user_embedding,
                n_results=limit,
                event_ids=event_ids
            )
            
            # Format recommendations
            recommendations = []
            for result in similar_events:
                event = next((e for e in valid_events if e.id == result['event_id']), None)
                if event and event.is_active and not event.is_expired():
                    # Calculate distance if coordinates provided (for display only)
                    distance_miles = None
                    if user_lat and user_lng:
                        distance_miles = self._calculate_distance(
                            user_lat, user_lng, event.latitude, event.longitude
                        )
                    
                    recommendations.append({
                        "event_id": event.id,
                        "title": event.title,
                        "description": event.description,
                        "location_name": event.location_name,
                        "start_time": event.start_time.isoformat(),
                        "end_time": event.end_time.isoformat(),
                        "attendee_count": event.attendee_count,
                        "distance_miles": round(distance_miles, 2) if distance_miles else None,
                        "similarity_score": 1.0 - (result.get('distance', 0.5)),
                        "can_rsvp": event.can_rsvp(user_id),
                        "reason": self._generate_event_reason(event)
                    })
            
            db.close()
            logger.info(f"Generated {len(recommendations)} event recommendations for user {user_id}")
            return recommendations
            
        except Exception as e:
            logger.error(f"Failed to generate event recommendations for user {user_id}: {e}")
            return []
    
    async def recommend_events_to_group(self, group_id: int, admin_lat: float, admin_lng: float, 
                                      limit: int = 5) -> List[Dict[str, Any]]:
        """Recommend events to group admins (location filtering disabled for testing)"""
        try:
            db = SessionLocal()
            
            # Get group embedding
            group_embedding = self.chroma_client.get_group_embedding(group_id)
            if not group_embedding:
                logger.warning(f"No embedding found for group {group_id}")
                return []
            
            # Get all public events (no location filtering for testing)
            all_events = db.query(Event).filter(
                Event.is_active == True,
                Event.visibility == "public"
            ).all()
            
            if not all_events:
                return []
            
            # Query ChromaDB for similar events
            event_ids = [event.id for event in all_events if event.is_active and not event.is_expired()]
            if not event_ids:
                return []
            
            similar_events = self.chroma_client.query_similar_events(
                query_embedding=group_embedding,
                n_results=limit,
                event_ids=event_ids
            )
            
            # Format recommendations
            recommendations = []
            for result in similar_events:
                event = next((e for e in all_events if e.id == result['event_id']), None)
                if event:
                    # Calculate distance if coordinates provided (for display only)
                    distance_miles = None
                    if admin_lat and admin_lng:
                        distance_miles = self._calculate_distance(
                            admin_lat, admin_lng, event.latitude, event.longitude
                        )
                    
                    recommendations.append({
                        "event_id": event.id,
                        "title": event.title,
                        "description": event.description,
                        "location_name": event.location_name,
                        "start_time": event.start_time.isoformat(),
                        "distance_miles": round(distance_miles, 2) if distance_miles else None,
                        "similarity_score": 1.0 - (result.get('distance', 0.5)),
                        "reason": f"This event aligns with your group's interests and activities"
                    })
            
            db.close()
            logger.info(f"Generated {len(recommendations)} event recommendations for group {group_id}")
            return recommendations
            
        except Exception as e:
            logger.error(f"Failed to generate event recommendations for group {group_id}: {e}")
            return []
    
    async def _get_user_profile_embedding(self, user_id: int, db: Session) -> Optional[List[float]]:
        """Get user's profile embedding from database or generate new one (simplified for testing)"""
        try:
            from models.embeddings import UserEmbedding
            
            # First try to get from database
            user_embedding = db.query(UserEmbedding).filter(UserEmbedding.user_id == user_id).first()
            
            if user_embedding and user_embedding.profile_embedding:
                return user_embedding.profile_embedding
            
            # If not in database, try to generate new embedding
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return None
            
            profile_emb = await self.embedding_service.generate_user_profile_embedding(user)
            
            if profile_emb:
                # Save to database
                if user_embedding:
                    user_embedding.profile_embedding = profile_emb
                    user_embedding.last_updated = datetime.now(timezone.utc)
                else:
                    user_embedding = UserEmbedding(
                        user_id=user_id,
                        profile_embedding=profile_emb,
                        message_embedding=None  # Not using message embeddings for testing
                    )
                    db.add(user_embedding)
                
                db.commit()
                
                # Add to ChromaDB with only profile embedding
                self.chroma_client.add_user_embedding(user_id, profile_emb, [])
                
                return profile_emb
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get profile embedding for user {user_id}: {e}")
            return None
    
    async def _get_excluded_user_ids(self, user_id: int, db: Session) -> List[int]:
        """Get list of user IDs to exclude from recommendations"""
        excluded_ids = []
        
        try:
            # Get existing friends
            friendships = db.query(Friendship).filter(
                or_(
                    Friendship.user1_id == user_id,
                    Friendship.user2_id == user_id
                )
            ).all()
            
            for friendship in friendships:
                friend_id = friendship.user2_id if friendship.user1_id == user_id else friendship.user1_id
                excluded_ids.append(friend_id)
            
            # Get pending/declined friend requests
            requests = db.query(FriendRequest).filter(
                or_(
                    FriendRequest.sender_id == user_id,
                    FriendRequest.recipient_id == user_id
                )
            ).all()
            
            for request in requests:
                other_id = request.recipient_id if request.sender_id == user_id else request.sender_id
                excluded_ids.append(other_id)
            
            return list(set(excluded_ids))  # Remove duplicates
            
        except Exception as e:
            logger.error(f"Failed to get excluded user IDs: {e}")
            return []
    
    def _get_mutual_friends_count(self, user1_id: int, user2_id: int, db: Session) -> int:
        """Get count of mutual friends between two users"""
        try:
            # Get user1's friends
            user1_friends = db.query(Friendship).filter(
                or_(
                    Friendship.user1_id == user1_id,
                    Friendship.user2_id == user1_id
                )
            ).all()
            
            user1_friend_ids = set()
            for f in user1_friends:
                friend_id = f.user2_id if f.user1_id == user1_id else f.user1_id
                user1_friend_ids.add(friend_id)
            
            # Get user2's friends
            user2_friends = db.query(Friendship).filter(
                or_(
                    Friendship.user1_id == user2_id,
                    Friendship.user2_id == user2_id
                )
            ).all()
            
            user2_friend_ids = set()
            for f in user2_friends:
                friend_id = f.user2_id if f.user1_id == user2_id else f.user1_id
                user2_friend_ids.add(friend_id)
            
            # Count mutual friends
            return len(user1_friend_ids.intersection(user2_friend_ids))
            
        except Exception as e:
            logger.error(f"Failed to get mutual friends count: {e}")
            return 0
    
    def _get_declined_event_ids(self, user_id: int, db: Session) -> List[int]:
        """Get list of event IDs user has declined"""
        try:
            declined_ids = []
            events = db.query(Event).filter(Event.is_active == True).all()
            
            for event in events:
                user_rsvp = event.get_user_rsvp(user_id)
                if user_rsvp and user_rsvp.get('status') == 'no':
                    declined_ids.append(event.id)
            
            return declined_ids
            
        except Exception as e:
            logger.error(f"Failed to get declined event IDs: {e}")
            return []
    
    def _calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance in miles using Haversine formula"""
        # Convert latitude and longitude from degrees to radians
        lat1, lng1, lat2, lng2 = map(math.radians, [lat1, lng1, lat2, lng2])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Radius of earth in miles
        r = 3956
        
        return c * r
    
    def _generate_friend_reason(self, current_user: User, potential_friend: User) -> str:
        """Generate a reason why users might be compatible"""
        reasons = []
        
        # Check for common interests
        current_interests = set(current_user.interests or [])
        potential_interests = set(potential_friend.interests or [])
        common_interests = current_interests.intersection(potential_interests)
        
        if common_interests:
            if len(common_interests) == 1:
                reasons.append(f"You both love {list(common_interests)[0]}")
            else:
                reasons.append(f"You share interests in {', '.join(list(common_interests)[:2])}")
        
        # Default reason
        if not reasons:
            reasons.append("You might have a lot in common")
        
        return reasons[0]
    
    def _generate_event_reason(self, event: Event) -> str:
        """Generate a reason why an event might be interesting"""
        if event.attendee_count > 5:
            return f"Popular event with {event.attendee_count} people attending"
        elif event.is_premium:
            return "Featured premium event"
        else:
            return "Great opportunity to meet new people"

# Global instance
rag_engine = RAGRecommendationEngine() 