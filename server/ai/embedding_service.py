"""
Embedding service for generating vector embeddings using OpenAI's APIs
Handles text and image processing for the RAG system
"""

import openai
from openai import OpenAI
import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_
import base64
import requests
from pathlib import Path
import os

# Import models
from models import User, DirectMessage, GroupMessage, Snap, Event, GroupChat
from utils.media_storage import media_storage

logger = logging.getLogger(__name__)

class EmbeddingService:
    """Service for generating embeddings using OpenAI's APIs"""
    
    def __init__(self):
        """Initialize OpenAI client"""
        # Get API key from environment
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            logger.warning("OPENAI_API_KEY not found")
            self.client = None
        else:
            self.client = OpenAI(api_key=api_key)
            logger.info("OpenAI client initialized")
    
    async def generate_user_profile_embedding(self, user: User) -> List[float]:
        """Generate embedding from user's bio and interests"""
        if not self.client:
            logger.error("OpenAI client not initialized")
            return []
        
        try:
            # Construct profile text
            bio_text = user.bio or "No bio provided"
            interests_text = ", ".join(user.interests or []) if user.interests else "No interests listed"
            
            profile_text = f"""
            User Profile:
            Bio: {bio_text}
            Interests: {interests_text}
            
            This person is looking to make friends and connect with others who share similar interests and values.
            """
            
            # Generate embedding (remove await - OpenAI client is synchronous)
            response = self.client.embeddings.create(
                model="text-embedding-3-large",
                input=profile_text.strip()
            )
            
            embedding = response.data[0].embedding
            logger.debug(f"Generated profile embedding for user {user.id}, length: {len(embedding)}")
            return embedding
            
        except Exception as e:
            logger.error(f"Failed to generate profile embedding for user {user.id}: {e}")
            return []
    
    async def generate_user_message_embedding(self, user_id: int, db: Session) -> List[float]:
        """Generate embedding from user's recent messages and snaps"""
        if not self.client:
            logger.error("OpenAI client not initialized")
            return []
        
        try:
            # Get recent text messages (25 most recent)
            recent_direct_messages = db.query(DirectMessage).filter(
                DirectMessage.sender_id == user_id,
                DirectMessage.message_type == "text",
                DirectMessage.content.isnot(None)
            ).order_by(desc(DirectMessage.created_at)).limit(25).all()
            
            recent_group_messages = db.query(GroupMessage).filter(
                GroupMessage.sender_id == user_id,
                GroupMessage.message_type == "text",
                GroupMessage.content.isnot(None)
            ).order_by(desc(GroupMessage.created_at)).limit(25).all()
            
            # Combine and limit to 25 total
            all_text_messages = []
            for msg in recent_direct_messages:
                all_text_messages.append(msg.content)
            for msg in recent_group_messages:
                all_text_messages.append(msg.content)
            
            # Sort by timestamp and take most recent 25
            all_text_messages = all_text_messages[:25]
            
            # Get recent snaps (10 most recent)
            recent_snaps = db.query(Snap).filter(
                Snap.sender_id == user_id
            ).order_by(desc(Snap.created_at)).limit(10).all()
            
            # Process snaps with image descriptions
            message_texts = []
            
            # Add text messages
            if all_text_messages:
                message_texts.extend(all_text_messages)
            
            # Process snaps
            for snap in recent_snaps:
                snap_description = await self._process_snap_content(snap)
                if snap_description:
                    message_texts.append(snap_description)
            
            # Create combined text
            if not message_texts:
                combined_text = "This user hasn't sent many messages yet. They are looking to connect and make friends."
            else:
                combined_text = f"""
                Recent communication style and content from this user:
                
                {' '.join(message_texts[:50])}  # Limit to prevent token overflow
                
                This represents how this person communicates and what they share with friends.
                """
            
            # Generate embedding
            response = self.client.embeddings.create(
                model="text-embedding-3-large",
                input=combined_text.strip()
            )
            
            embedding = response.data[0].embedding
            logger.debug(f"Generated message embedding for user {user_id}, length: {len(embedding)}")
            return embedding
            
        except Exception as e:
            logger.error(f"Failed to generate message embedding for user {user_id}: {e}")
            return []
    
    async def generate_group_embedding(self, group_id: int, db: Session) -> List[float]:
        """Generate embedding from group's recent messages and snaps"""
        if not self.client:
            logger.error("OpenAI client not initialized")
            return []
        
        try:
            # Get group info
            group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
            if not group:
                logger.error(f"Group {group_id} not found")
                return []
            
            # Get recent text messages (50 most recent)
            recent_messages = db.query(GroupMessage).filter(
                GroupMessage.group_id == group_id,
                GroupMessage.message_type == "text",
                GroupMessage.content.isnot(None),
                GroupMessage.is_deleted == False
            ).order_by(desc(GroupMessage.created_at)).limit(50).all()
            
            # Get recent snaps sent to this group (20 most recent)
            recent_snaps = db.query(Snap).filter(
                Snap.group_ids.contains([group_id])
            ).order_by(desc(Snap.created_at)).limit(20).all()
            
            # Combine content
            content_texts = []
            
            # Add group name and description as context
            content_texts.append(f"Group name: {group.name}")
            if group.description:
                content_texts.append(f"Group description: {group.description}")
            
            # Add recent messages
            for msg in recent_messages:
                if msg.content:
                    content_texts.append(msg.content)
            
            # Process snaps
            for snap in recent_snaps:
                snap_description = await self._process_snap_content(snap)
                if snap_description:
                    content_texts.append(snap_description)
            
            # Create combined text
            if not content_texts:
                combined_text = f"This is a group chat named '{group.name}'. The group is just getting started and looking to build community."
            else:
                combined_text = f"""
                Group Chat Analysis for '{group.name}':
                
                {' '.join(content_texts[:100])}  # Limit to prevent token overflow
                
                This represents the collective interests, communication style, and activities of this group.
                """
            
            # Generate embedding
            response = self.client.embeddings.create(
                model="text-embedding-3-large",
                input=combined_text.strip()
            )
            
            embedding = response.data[0].embedding
            logger.debug(f"Generated group embedding for group {group_id}, length: {len(embedding)}")
            return embedding
            
        except Exception as e:
            logger.error(f"Failed to generate group embedding for group {group_id}: {e}")
            return []
    
    async def generate_event_embedding(self, event: Event) -> List[float]:
        """Generate embedding from event title and description"""
        if not self.client:
            logger.error("OpenAI client not initialized")
            return []
        
        try:
            # Construct event text
            title = event.title or "Event"
            description = event.description or ""
            story = event.story or ""
            location = event.location_name or ""
            
            event_text = f"""
            Event: {title}
            
            Location: {location}
            
            Description: {description}
            
            Story: {story}
            
            This is a social event where people can meet, connect, and enjoy activities together.
            """
            
            # Generate embedding (remove await - OpenAI client is synchronous)
            response = self.client.embeddings.create(
                model="text-embedding-3-large",
                input=event_text.strip()
            )
            
            embedding = response.data[0].embedding
            logger.debug(f"Generated event embedding for event {event.id}, length: {len(embedding)}")
            return embedding
            
        except Exception as e:
            logger.error(f"Failed to generate event embedding for event {event.id}: {e}")
            return []
    
    async def _process_snap_content(self, snap: Snap) -> Optional[str]:
        """Process snap content (image description + caption)"""
        try:
            content_parts = []
            
            # Add caption if present
            if snap.caption:
                content_parts.append(f"Caption: {snap.caption}")
            
            # Process image if it's an image snap
            if snap.media_type and snap.media_type.startswith('image') and snap.media_url:
                image_description = await self._describe_image(snap.media_url)
                if image_description:
                    content_parts.append(f"Image: {image_description}")
            
            # For video snaps, use caption only (video analysis is more complex)
            if snap.media_type and snap.media_type.startswith('video') and not snap.caption:
                content_parts.append("Shared a video")
            
            return " ".join(content_parts) if content_parts else None
            
        except Exception as e:
            logger.error(f"Failed to process snap content for snap {snap.id}: {e}")
            return None
    
    async def _describe_image(self, image_url: str) -> Optional[str]:
        """Use GPT-4o-mini to describe image content"""
        if not self.client:
            return None
        
        try:
            # Check if it's a local file path or URL
            if image_url.startswith('/') or image_url.startswith('media/'):
                # Local file - convert to base64
                full_path = Path(image_url)
                if not full_path.exists():
                    logger.warning(f"Image file not found: {image_url}")
                    return None
                
                with open(full_path, 'rb') as image_file:
                    image_data = base64.b64encode(image_file.read()).decode('utf-8')
                    image_url_for_api = f"data:image/jpeg;base64,{image_data}"
            else:
                # Assume it's already a URL
                image_url_for_api = image_url
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text", 
                                "text": "Describe what you see in this image. Focus on activities, interests, social context, and what this might tell us about the person who posted it. Keep it concise but informative."
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": image_url_for_api}
                            }
                        ]
                    }
                ],
                max_tokens=150  # Keep descriptions concise
            )
            
            description = response.choices[0].message.content
            logger.debug(f"Generated image description for {image_url}")
            return description
            
        except Exception as e:
            logger.error(f"Failed to describe image {image_url}: {e}")
            return None
    
    async def get_text_embedding(self, text: str) -> List[float]:
        """Get embedding for arbitrary text"""
        if not self.client:
            logger.error("OpenAI client not initialized")
            return []
        
        try:
            response = self.client.embeddings.create(
                model="text-embedding-3-large",
                input=text
            )
            
            return response.data[0].embedding
            
        except Exception as e:
            logger.error(f"Failed to generate text embedding: {e}")
            return []

# Global instance
embedding_service = EmbeddingService() 