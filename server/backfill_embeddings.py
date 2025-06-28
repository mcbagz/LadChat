"""
Backfill embeddings for existing users and events
Run this script to generate embeddings for all users and events that don't currently have them
"""

import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from database import SessionLocal
from models import User, Event
from models.embeddings import UserEmbedding, EventEmbedding
from ai.embedding_service import embedding_service
from ai.chroma_client import chroma_client

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def backfill_user_embeddings():
    """Generate embeddings for all users without embeddings"""
    logger.info("Starting user embeddings backfill...")
    
    db = SessionLocal()
    try:
        # Get all active users
        all_users = db.query(User).filter(User.is_active == True).all()
        logger.info(f"Found {len(all_users)} active users")
        
        # Get users that already have embeddings
        existing_embeddings = db.query(UserEmbedding).all()
        existing_user_ids = {emb.user_id for emb in existing_embeddings}
        
        # Find users without embeddings
        users_without_embeddings = [user for user in all_users if user.id not in existing_user_ids]
        logger.info(f"Found {len(users_without_embeddings)} users without embeddings")
        
        created_count = 0
        for user in users_without_embeddings:
            try:
                logger.info(f"Creating embedding for user {user.id} ({user.username})")
                
                # Generate profile embedding
                profile_embedding = await embedding_service.generate_user_profile_embedding(user)
                
                if profile_embedding:
                    # Store in database
                    user_embedding = UserEmbedding(
                        user_id=user.id,
                        profile_embedding=profile_embedding,
                        message_embedding=None  # Not using message embeddings for testing
                    )
                    db.add(user_embedding)
                    
                    # Store in ChromaDB
                    chroma_client.add_user_embedding(
                        user.id,
                        profile_embedding,
                        [],  # Empty message embedding for testing
                        metadata={
                            "username": user.username
                        }
                    )
                    
                    created_count += 1
                    logger.info(f"✅ Created embedding for user {user.id}")
                else:
                    logger.warning(f"❌ Failed to generate embedding for user {user.id}")
                    
            except Exception as e:
                logger.error(f"❌ Error creating embedding for user {user.id}: {e}")
                continue
        
        # Commit all changes
        db.commit()
        logger.info(f"✅ User embeddings backfill completed. Created {created_count} embeddings.")
        
    except Exception as e:
        logger.error(f"❌ Failed to backfill user embeddings: {e}")
        db.rollback()
    finally:
        db.close()

async def backfill_event_embeddings():
    """Generate embeddings for all events without embeddings"""
    logger.info("Starting event embeddings backfill...")
    
    db = SessionLocal()
    try:
        # Get all active events
        all_events = db.query(Event).filter(Event.is_active == True).all()
        logger.info(f"Found {len(all_events)} active events")
        
        # Get events that already have embeddings
        existing_embeddings = db.query(EventEmbedding).all()
        existing_event_ids = {emb.event_id for emb in existing_embeddings}
        
        # Find events without embeddings
        events_without_embeddings = [event for event in all_events if event.id not in existing_event_ids]
        logger.info(f"Found {len(events_without_embeddings)} events without embeddings")
        
        created_count = 0
        for event in events_without_embeddings:
            try:
                logger.info(f"Creating embedding for event {event.id} ({event.title})")
                
                # Generate event embedding
                event_embedding = await embedding_service.generate_event_embedding(event)
                
                if event_embedding:
                    # Store in database
                    embedding_record = EventEmbedding(
                        event_id=event.id,
                        event_embedding=event_embedding
                    )
                    db.add(embedding_record)
                    
                    # Store in ChromaDB
                    chroma_client.add_event_embedding(
                        event.id,
                        event_embedding,
                        metadata={
                            "title": event.title,
                            "creator_id": event.creator_id,
                            "visibility": event.visibility,
                            "is_premium": event.is_premium
                        }
                    )
                    
                    created_count += 1
                    logger.info(f"✅ Created embedding for event {event.id}")
                else:
                    logger.warning(f"❌ Failed to generate embedding for event {event.id}")
                    
            except Exception as e:
                logger.error(f"❌ Error creating embedding for event {event.id}: {e}")
                continue
        
        # Commit all changes
        db.commit()
        logger.info(f"✅ Event embeddings backfill completed. Created {created_count} embeddings.")
        
    except Exception as e:
        logger.error(f"❌ Failed to backfill event embeddings: {e}")
        db.rollback()
    finally:
        db.close()

async def get_embedding_stats():
    """Get statistics about current embeddings"""
    logger.info("Getting embedding statistics...")
    
    db = SessionLocal()
    try:
        # User stats
        total_users = db.query(User).filter(User.is_active == True).count()
        users_with_embeddings = db.query(UserEmbedding).count()
        
        # Event stats
        total_events = db.query(Event).filter(Event.is_active == True).count()
        events_with_embeddings = db.query(EventEmbedding).count()
        
        # ChromaDB stats
        chroma_stats = chroma_client.get_collection_stats()
        
        logger.info(f"📊 Embedding Statistics:")
        logger.info(f"   Users: {users_with_embeddings}/{total_users} have embeddings")
        logger.info(f"   Events: {events_with_embeddings}/{total_events} have embeddings")
        logger.info(f"   ChromaDB - Users: {chroma_stats['users']}, Events: {chroma_stats['events']}")
        
        return {
            "users": {"total": total_users, "with_embeddings": users_with_embeddings},
            "events": {"total": total_events, "with_embeddings": events_with_embeddings},
            "chromadb": chroma_stats
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get embedding statistics: {e}")
        return None
    finally:
        db.close()

async def main():
    """Main function to run the backfill process"""
    logger.info("🚀 Starting embeddings backfill process...")
    
    # Get initial stats
    await get_embedding_stats()
    
    # Backfill user embeddings
    await backfill_user_embeddings()
    
    # Backfill event embeddings
    await backfill_event_embeddings()
    
    # Get final stats
    logger.info("📊 Final statistics:")
    await get_embedding_stats()
    
    logger.info("🎉 Embeddings backfill process completed!")

if __name__ == "__main__":
    asyncio.run(main()) 