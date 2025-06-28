"""
Background tasks for LadChat API
Handles ephemeral content cleanup and other automated tasks
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from database import SessionLocal
from models import Story, Snap, Event, Hangout, GroupChat, DirectMessage, GroupMessage
from utils.logging_config import log_database_operation

logger = logging.getLogger(__name__)

class BackgroundTaskManager:
    """Manages background tasks for LadChat"""
    
    def __init__(self):
        self.tasks = {}
        self.running = False
    
    async def start(self):
        """Start background task manager"""
        if self.running:
            logger.warning("Background task manager is already running")
            return
        
        self.running = True
        logger.info("Starting background task manager")
        
        # Schedule periodic tasks
        self.tasks['cleanup'] = asyncio.create_task(self._run_periodic_cleanup())
        self.tasks['metrics'] = asyncio.create_task(self._run_periodic_metrics())
        
        logger.info("Background tasks started")
    
    async def stop(self):
        """Stop background task manager"""
        if not self.running:
            return
        
        self.running = False
        logger.info("Stopping background task manager")
        
        # Cancel all tasks
        for task_name, task in self.tasks.items():
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    logger.info(f"Task {task_name} cancelled")
        
        self.tasks.clear()
        logger.info("Background tasks stopped")
    
    async def _run_periodic_cleanup(self):
        """Run cleanup tasks periodically"""
        while self.running:
            try:
                await self.cleanup_expired_content()
                await asyncio.sleep(300)  # Run every 5 minutes
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic cleanup: {e}", exc_info=True)
                await asyncio.sleep(60)  # Wait before retrying
    
    async def _run_periodic_metrics(self):
        """Run metrics collection periodically"""
        while self.running:
            try:
                await self.collect_usage_metrics()
                await asyncio.sleep(3600)  # Run every hour
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic metrics: {e}", exc_info=True)
                await asyncio.sleep(600)  # Wait before retrying
    
    async def cleanup_expired_content(self):
        """Clean up expired ephemeral content"""
        logger.info("Starting cleanup of expired content")
        
        db = SessionLocal()
        try:
            current_time = datetime.utcnow()
            
            # Clean up expired stories
            expired_stories = db.query(Story).filter(
                and_(
                    Story.expires_at <= current_time,
                    Story.is_active == True
                )
            ).all()
            
            story_count = 0
            for story in expired_stories:
                story.is_active = False
                story_count += 1
                # TODO: Delete media files from storage
                log_database_operation("expire", "stories", story.id)
            
            # Clean up expired snaps
            expired_snaps = db.query(Snap).filter(
                and_(
                    Snap.expires_at <= current_time,
                    Snap.is_active == True
                )
            ).all()
            
            snap_count = 0
            for snap in expired_snaps:
                snap.is_active = False
                snap_count += 1
                # TODO: Delete media files from storage
                log_database_operation("expire", "snaps", snap.id)
            
            # Clean up expired events (hangouts)
            expired_events = db.query(Event).filter(
                and_(
                    Event.expires_at <= current_time,
                    Event.is_active == True
                )
            ).all()
            
            event_count = 0
            for event in expired_events:
                event.is_active = False
                event_count += 1
                log_database_operation("expire", "events", event.id)
            
            # Also update ongoing status for active events
            ongoing_events = db.query(Event).filter(Event.is_active == True).all()
            for event in ongoing_events:
                event.update_ongoing_status()
            
            # Clean up expired direct messages
            expired_direct_messages = db.query(DirectMessage).filter(
                and_(
                    DirectMessage.expires_at <= current_time,
                    DirectMessage.is_deleted == False
                )
            ).all()
            
            dm_count = 0
            for dm in expired_direct_messages:
                dm.is_deleted = True
                dm_count += 1
                # TODO: Delete media files from storage
                log_database_operation("expire", "direct_messages", dm.id)
            
            # Clean up expired group messages
            expired_group_messages = db.query(GroupMessage).filter(
                and_(
                    GroupMessage.expires_at <= current_time,
                    GroupMessage.is_deleted == False
                )
            ).all()
            
            gm_count = 0
            for gm in expired_group_messages:
                gm.is_deleted = True
                gm_count += 1
                # TODO: Delete media files from storage
                log_database_operation("expire", "group_messages", gm.id)
            
            db.commit()
            
            logger.info(f"Cleanup completed: {story_count} stories, {snap_count} snaps, {event_count} events, {dm_count} direct messages, {gm_count} group messages expired")
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}", exc_info=True)
            db.rollback()
        finally:
            db.close()
    
    async def collect_usage_metrics(self):
        """Collect usage metrics for monitoring"""
        logger.info("Collecting usage metrics")
        
        db = SessionLocal()
        try:
            current_time = datetime.utcnow()
            last_hour = current_time - timedelta(hours=1)
            
            # Count active content
            active_stories = db.query(Story).filter(Story.is_active == True).count()
            active_snaps = db.query(Snap).filter(Snap.is_active == True).count()
            active_events = db.query(Event).filter(Event.is_active == True).count()
            active_groups = db.query(GroupChat).filter(GroupChat.is_active == True).count()
            active_direct_messages = db.query(DirectMessage).filter(DirectMessage.is_deleted == False).count()
            active_group_messages = db.query(GroupMessage).filter(GroupMessage.is_deleted == False).count()
            
            # Count recent activity (last hour)
            recent_stories = db.query(Story).filter(
                Story.created_at >= last_hour
            ).count()
            
            recent_snaps = db.query(Snap).filter(
                Snap.created_at >= last_hour
            ).count()
            
            recent_events = db.query(Event).filter(
                Event.created_at >= last_hour
            ).count()
            
            recent_direct_messages = db.query(DirectMessage).filter(
                DirectMessage.created_at >= last_hour
            ).count()
            
            recent_group_messages = db.query(GroupMessage).filter(
                GroupMessage.created_at >= last_hour
            ).count()
            
            metrics = {
                "active_content": {
                    "stories": active_stories,
                    "snaps": active_snaps,
                    "events": active_events,
                    "groups": active_groups,
                    "direct_messages": active_direct_messages,
                    "group_messages": active_group_messages
                },
                "recent_activity": {
                    "stories": recent_stories,
                    "snaps": recent_snaps,
                    "events": recent_events,
                    "direct_messages": recent_direct_messages,
                    "group_messages": recent_group_messages
                },
                "timestamp": current_time.isoformat()
            }
            
            logger.info(f"Metrics collected: {metrics}")
            
            # TODO: Send metrics to monitoring system
            
        except Exception as e:
            logger.error(f"Error collecting metrics: {e}", exc_info=True)
        finally:
            db.close()
    
    async def cleanup_inactive_groups(self, days_inactive: int = 30):
        """Clean up inactive group chats"""
        logger.info(f"Cleaning up groups inactive for {days_inactive} days")
        
        db = SessionLocal()
        try:
            cutoff_time = datetime.utcnow() - timedelta(days=days_inactive)
            
            inactive_groups = db.query(GroupChat).filter(
                and_(
                    or_(
                        GroupChat.last_message_at <= cutoff_time,
                        GroupChat.last_message_at.is_(None)
                    ),
                    GroupChat.created_at <= cutoff_time,
                    GroupChat.is_active == True
                )
            ).all()
            
            count = 0
            for group in inactive_groups:
                group.is_active = False
                count += 1
                log_database_operation("deactivate", "group_chats", group.id)
            
            db.commit()
            
            logger.info(f"Deactivated {count} inactive groups")
            
        except Exception as e:
            logger.error(f"Error cleaning up inactive groups: {e}", exc_info=True)
            db.rollback()
        finally:
            db.close()
    
    async def update_venue_scores(self):
        """Update venue lad-friendly scores based on recent activity"""
        logger.info("Updating venue scores")
        
        db = SessionLocal()
        try:
            from models import Venue
            
            venues = db.query(Venue).filter(Venue.is_active == True).all()
            
            for venue in venues:
                # Recalculate lad-friendly score
                venue.calculate_lad_score()
                log_database_operation("update_score", "venues", venue.id)
            
            db.commit()
            
            logger.info(f"Updated scores for {len(venues)} venues")
            
        except Exception as e:
            logger.error(f"Error updating venue scores: {e}", exc_info=True)
            db.rollback()
        finally:
            db.close()

# Global task manager instance
task_manager = BackgroundTaskManager()

# Manual cleanup functions
async def cleanup_all_expired():
    """Manually trigger cleanup of all expired content"""
    await task_manager.cleanup_expired_content()

async def cleanup_old_data(days_old: int = 90):
    """Clean up old data that's past expiration + grace period"""
    logger.info(f"Cleaning up data older than {days_old} days")
    
    db = SessionLocal()
    try:
        cutoff_time = datetime.utcnow() - timedelta(days=days_old)
        
        # Delete old expired stories
        old_stories = db.query(Story).filter(
            and_(
                Story.expires_at <= cutoff_time,
                Story.is_active == False
            )
        )
        story_count = old_stories.count()
        old_stories.delete(synchronize_session=False)
        
        # Delete old expired snaps
        old_snaps = db.query(Snap).filter(
            and_(
                Snap.expires_at <= cutoff_time,
                Snap.is_active == False
            )
        )
        snap_count = old_snaps.count()
        old_snaps.delete(synchronize_session=False)
        
        # Delete old events
        old_events = db.query(Event).filter(
            and_(
                Event.expires_at <= cutoff_time,
                Event.is_active == False
            )
        )
        event_count = old_events.count()
        old_events.delete(synchronize_session=False)
        
        db.commit()
        
        logger.info(f"Deleted old data: {story_count} stories, {snap_count} snaps, {event_count} events")
        
    except Exception as e:
        logger.error(f"Error cleaning up old data: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close() 