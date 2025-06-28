"""
Background tasks for updating embeddings every 24 hours
"""

import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_

from database import SessionLocal
from models import User, GroupChat, Event
from models.embeddings import UserEmbedding, GroupEmbedding, EventEmbedding
from .embedding_service import embedding_service
from .chroma_client import chroma_client
from utils.background_tasks import task_manager

logger = logging.getLogger(__name__)

async def update_user_embeddings():
    """Update user embeddings every 24 hours"""
    logger.info("Starting user embeddings update task")
    
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.is_active == True).all()
        updated_count = 0
        
        for user in users:
            try:
                existing = db.query(UserEmbedding).filter(UserEmbedding.user_id == user.id).first()
                
                needs_update = True
                if existing and existing.last_updated:
                    time_since_update = datetime.now(timezone.utc) - existing.last_updated
                    needs_update = time_since_update > timedelta(hours=24)
                
                if not needs_update:
                    continue
                
                profile_emb = await embedding_service.generate_user_profile_embedding(user)
                message_emb = await embedding_service.generate_user_message_embedding(user.id, db)
                
                if profile_emb and message_emb:
                    if existing:
                        existing.profile_embedding = profile_emb
                        existing.message_embedding = message_emb
                        existing.last_updated = datetime.now(timezone.utc)
                    else:
                        new_embedding = UserEmbedding(
                            user_id=user.id,
                            profile_embedding=profile_emb,
                            message_embedding=message_emb
                        )
                        db.add(new_embedding)
                    
                    chroma_client.add_user_embedding(user.id, profile_emb, message_emb)
                    db.commit()
                    updated_count += 1
                    
            except Exception as e:
                logger.error(f"Failed to update embeddings for user {user.id}: {e}")
                db.rollback()
        
        logger.info(f"Updated {updated_count} user embeddings")
        
    finally:
        db.close()

async def update_group_embeddings():
    """Update group embeddings every 24 hours"""
    logger.info("Starting group embeddings update task")
    
    db = SessionLocal()
    try:
        # Get all active groups
        groups = db.query(GroupChat).filter(GroupChat.is_active == True).all()
        updated_count = 0
        
        for group in groups:
            try:
                # Check if embeddings need update (older than 24 hours)
                existing = db.query(GroupEmbedding).filter(GroupEmbedding.group_id == group.id).first()
                
                needs_update = True
                if existing and existing.last_updated:
                    time_since_update = datetime.now(timezone.utc) - existing.last_updated
                    needs_update = time_since_update > timedelta(hours=24)
                
                if not needs_update:
                    continue
                
                logger.debug(f"Updating embedding for group {group.id}")
                
                # Generate new embedding
                group_emb = await embedding_service.generate_group_embedding(group.id, db)
                
                if not group_emb:
                    logger.warning(f"Failed to generate embedding for group {group.id}")
                    continue
                
                # Update or create embedding record
                if existing:
                    existing.group_embedding = group_emb
                    existing.last_updated = datetime.now(timezone.utc)
                else:
                    new_embedding = GroupEmbedding(
                        group_id=group.id,
                        group_embedding=group_emb,
                        last_updated=datetime.now(timezone.utc)
                    )
                    db.add(new_embedding)
                
                # Update ChromaDB
                chroma_client.add_group_embedding(
                    group.id,
                    group_emb,
                    metadata={
                        "group_name": group.name,
                        "member_count": group.member_count,
                        "group_interests": group.group_interests or []
                    }
                )
                
                db.commit()
                updated_count += 1
                
            except Exception as e:
                logger.error(f"Failed to update embedding for group {group.id}: {e}")
                db.rollback()
                continue
        
        logger.info(f"Group embeddings update completed. Updated {updated_count} groups.")
        
    except Exception as e:
        logger.error(f"Failed to update group embeddings: {e}")
    finally:
        db.close()

async def create_event_embeddings():
    """Create embeddings for new events (runs every hour)"""
    logger.info("Starting event embeddings creation task")
    
    db = SessionLocal()
    try:
        # Get events without embeddings
        events_without_embeddings = db.query(Event).filter(
            Event.is_active == True,
            ~Event.id.in_(
                db.query(EventEmbedding.event_id)
            )
        ).all()
        
        created_count = 0
        
        for event in events_without_embeddings:
            try:
                logger.debug(f"Creating embedding for event {event.id}")
                
                # Generate embedding
                event_emb = await embedding_service.generate_event_embedding(event)
                
                if not event_emb:
                    logger.warning(f"Failed to generate embedding for event {event.id}")
                    continue
                
                # Create embedding record
                new_embedding = EventEmbedding(
                    event_id=event.id,
                    event_embedding=event_emb
                )
                db.add(new_embedding)
                
                # Add to ChromaDB
                chroma_client.add_event_embedding(
                    event.id,
                    event_emb,
                    metadata={
                        "title": event.title,
                        "location_name": event.location_name,
                        "creator_id": event.creator_id,
                        "visibility": event.visibility,
                        "start_time": event.start_time.isoformat()
                    }
                )
                
                db.commit()
                created_count += 1
                
            except Exception as e:
                logger.error(f"Failed to create embedding for event {event.id}: {e}")
                db.rollback()
                continue
        
        logger.info(f"Event embeddings creation completed. Created {created_count} embeddings.")
        
    except Exception as e:
        logger.error(f"Failed to create event embeddings: {e}")
    finally:
        db.close()

async def cleanup_expired_embeddings():
    """Clean up embeddings for inactive/deleted content"""
    logger.info("Starting embedding cleanup task")
    
    db = SessionLocal()
    try:
        cleanup_count = 0
        
        # Clean up user embeddings for inactive users
        inactive_user_embeddings = db.query(UserEmbedding).join(User).filter(
            User.is_active == False
        ).all()
        
        for embedding in inactive_user_embeddings:
            chroma_client.delete_user_embedding(embedding.user_id)
            db.delete(embedding)
            cleanup_count += 1
        
        # Clean up event embeddings for inactive events
        inactive_event_embeddings = db.query(EventEmbedding).join(Event).filter(
            Event.is_active == False
        ).all()
        
        for embedding in inactive_event_embeddings:
            chroma_client.delete_event_embedding(embedding.event_id)
            db.delete(embedding)
            cleanup_count += 1
        
        # Clean up group embeddings for inactive groups
        inactive_group_embeddings = db.query(GroupEmbedding).join(GroupChat).filter(
            GroupChat.is_active == False
        ).all()
        
        for embedding in inactive_group_embeddings:
            chroma_client.delete_group_embedding(embedding.group_id)
            db.delete(embedding)
            cleanup_count += 1
        
        db.commit()
        logger.info(f"Embedding cleanup completed. Cleaned up {cleanup_count} embeddings.")
        
    except Exception as e:
        logger.error(f"Failed to cleanup embeddings: {e}")
        db.rollback()
    finally:
        db.close()

# Initialize tasks on import
async def initialize_embedding_tasks():
    """Initialize all embedding background tasks"""
    logger.info("Initializing embedding background tasks")
    
    # Tasks are registered via decorators, this function just ensures they're loaded
    tasks = [
        update_user_embeddings,
        update_group_embeddings, 
        create_event_embeddings,
        cleanup_expired_embeddings
    ]
    
    logger.info(f"Registered {len(tasks)} embedding tasks") 