"""
Event routes for LadChat Phase 5
Handles event creation, management, RSVPs, and premium features
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import json

from database import get_db
from auth import get_current_user
from models import User, Event, Friendship
from models.embeddings import EventEmbedding
from schemas import (
    EventCreate, EventUpdate, EventRSVP, EventResponse, EventListResponse,
    EventStatsResponse, PremiumEventPayment, SuccessResponse, ErrorResponse
)
from utils.media_storage import media_storage
from utils.logging_config import log_database_operation
from ai.embedding_service import embedding_service
from ai.chroma_client import chroma_client
import geohash
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["events"])

# Helper functions
def check_friendship(db: Session, user1_id: int, user2_id: int) -> bool:
    """Check if two users are friends"""
    friendship = db.query(Friendship).filter(
        ((Friendship.user1_id == user1_id) & (Friendship.user2_id == user2_id)) |
        ((Friendship.user1_id == user2_id) & (Friendship.user2_id == user1_id))
    ).first()
    return friendship is not None

def get_user_friends_ids(db: Session, user_id: int) -> List[int]:
    """Get list of user's friend IDs"""
    friendships = db.query(Friendship).filter(
        (Friendship.user1_id == user_id) | (Friendship.user2_id == user_id)
    ).all()
    
    friend_ids = []
    for friendship in friendships:
        if friendship.user1_id == user_id:
            friend_ids.append(friendship.user2_id)
        else:
            friend_ids.append(friendship.user1_id)
    
    return friend_ids

def validate_event_permissions(event: Event, user: User, action: str, db: Session) -> bool:
    """Validate if user can perform action on event"""
    if action == "view":
        if event.visibility == "public":
            return True
        elif event.visibility == "friends":
            return event.creator_id == user.id or user.id in get_user_friends_ids(db, event.creator_id)
        elif event.visibility == "private":
            return event.creator_id == user.id
        elif event.visibility == "groups":
            # Check if user is in any of the shared groups
            if event.shared_with_groups:
                # This would need to check group membership - placeholder for now
                return True
    
    elif action == "edit":
        return event.creator_id == user.id
    
    elif action == "rsvp":
        return validate_event_permissions(event, user, "view", db) and event.can_rsvp(user.id)
    
    return False

# Event CRUD endpoints

@router.post("/", response_model=EventResponse)
async def create_event(
    event_data: EventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new event with location validation and creation limits
    """
    try:
        # Check if user can create more events (max 3 active)
        if not Event.can_user_create_event(db, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot create more than 3 active events"
            )
        
        # Validate location proximity (creator must be at event location)
        temp_event = Event(
            latitude=event_data.latitude,
            longitude=event_data.longitude,
            start_time=event_data.start_time,
            end_time=event_data.end_time
        )
        
        if not temp_event.validate_location_proximity(
            event_data.creator_latitude, 
            event_data.creator_longitude,
            max_distance_km=0.1  # 100 meters
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You must be at the event location to create an event"
            )
        
        # Create the event
        event = Event(
            creator_id=current_user.id,
            title=event_data.title,
            description=event_data.description,
            story=event_data.story,
            location_name=event_data.location_name,
            latitude=event_data.latitude,
            longitude=event_data.longitude,
            creator_latitude=event_data.creator_latitude,
            creator_longitude=event_data.creator_longitude,
            start_time=event_data.start_time,
            end_time=event_data.end_time,
            rsvp_deadline=event_data.rsvp_deadline,
            max_attendees=event_data.max_attendees,
            visibility=event_data.visibility,
            shared_with_friends=event_data.shared_with_friends,
            shared_with_groups=event_data.shared_with_groups,
            is_premium=event_data.is_premium,
            location_privacy=event_data.location_privacy
        )
        
        # Premium events require payment (placeholder - full payment integration needed)
        if event_data.is_premium:
            if event_data.visibility != "public":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Premium events must be public"
                )
            # Payment validation would happen here
            event.payment_status = "pending"
        
        db.add(event)
        db.commit()
        db.refresh(event)
        
        # Create event embedding immediately for testing
        try:
            event_embedding = await embedding_service.generate_event_embedding(event)
            if event_embedding:
                # Store in database
                embedding_record = EventEmbedding(
                    event_id=event.id,
                    event_embedding=event_embedding
                )
                db.add(embedding_record)
                db.commit()
                
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
                logger.info(f"Created embedding for new event {event.id}")
            else:
                logger.warning(f"Failed to create embedding for new event {event.id}")
        except Exception as e:
            logger.error(f"Error creating embedding for new event {event.id}: {e}")
            # Don't fail event creation if embedding creation fails
        
        log_database_operation("create", "events", event.id, user_id=current_user.id)
        
        # Get friend status for response (current user is always considered a friend to themselves)
        friend_ids = get_user_friends_ids(db, current_user.id)
        is_friend = True  # Creator is always a friend to themselves for their own event
        
        return EventResponse(**event.to_dict(user_id=current_user.id, is_friend=is_friend))
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create event"
        )

@router.get("/", response_model=EventListResponse)
async def get_events(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    filter_type: str = Query("all", regex="^(all|friends|public|ongoing|upcoming|my_events)$"),
    sort_by: str = Query("start_time", regex="^(start_time|distance|created_at)$"),
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    radius_km: Optional[float] = Query(5.0, ge=0.1, le=50.0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get events with filtering and sorting options
    """
    try:
        query = db.query(Event).filter(Event.is_active == True)
        
        # Apply filters
        if filter_type == "friends":
            friend_ids = get_user_friends_ids(db, current_user.id)
            query = query.filter(
                (Event.visibility == "friends") &
                (Event.creator_id.in_(friend_ids + [current_user.id]))
            )
        elif filter_type == "public":
            query = query.filter(Event.visibility == "public")
        elif filter_type == "ongoing":
            now = datetime.now(timezone.utc)
            query = query.filter(
                (Event.start_time <= now) &
                (Event.end_time >= now)
            )
        elif filter_type == "upcoming":
            now = datetime.now(timezone.utc)
            query = query.filter(Event.start_time > now)
        elif filter_type == "my_events":
            query = query.filter(Event.creator_id == current_user.id)
        
        # Location-based filtering for public events
        if latitude and longitude and filter_type in ["all", "public"]:
            try:
                # Generate geohash for location-based queries
                user_geohash = geohash.encode(latitude, longitude, precision=5)  # ~5km precision
                
                # Filter by geohash prefix for performance
                query = query.filter(Event.geohash.like(f"{user_geohash[:5]}%"))
            except Exception:
                # If geohash fails, fall back to simple distance filtering
                # This ensures events endpoint still works even if geohash has issues
                radius_deg = radius_km / 111.0  # Rough conversion: 1 degree ≈ 111 km
                query = query.filter(
                    Event.latitude.between(latitude - radius_deg, latitude + radius_deg),
                    Event.longitude.between(longitude - radius_deg, longitude + radius_deg)
                )
        
        # Apply sorting
        if sort_by == "start_time":
            query = query.order_by(Event.start_time)
        elif sort_by == "distance" and latitude and longitude:
            # Simple distance-based sorting (can be optimized with PostGIS)
            query = query.order_by(
                ((Event.latitude - latitude) ** 2 + (Event.longitude - longitude) ** 2)
            )
        elif sort_by == "created_at":
            query = query.order_by(Event.created_at.desc())
        
        # Get total count
        total_count = query.count()
        
        # Apply pagination
        events = query.offset(offset).limit(limit).all()
        
        # Convert to response format with friend status
        friend_ids = get_user_friends_ids(db, current_user.id)
        event_responses = []
        
        for event in events:
            # Increment view count for premium events
            if event.is_premium and event.creator_id != current_user.id:
                event.increment_view_count()
                db.commit()
            
            is_friend = event.creator_id in friend_ids or event.creator_id == current_user.id
            event_dict = event.to_dict(user_id=current_user.id, is_friend=is_friend)
            event_responses.append(EventResponse(**event_dict))
        
        return EventListResponse(
            events=event_responses,
            total_count=total_count,
            has_more=(offset + limit) < total_count
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve events"
        )

@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific event by ID
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Check view permissions
    if not validate_event_permissions(event, current_user, "view", db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this event"
        )
    
    # Increment view count for premium events
    if event.is_premium and event.creator_id != current_user.id:
        event.increment_view_count()
        db.commit()
    
    friend_ids = get_user_friends_ids(db, current_user.id)
    is_friend = event.creator_id in friend_ids or event.creator_id == current_user.id
    
    return EventResponse(**event.to_dict(user_id=current_user.id, is_friend=is_friend))

@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    event_update: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update an event (creator only)
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if not validate_event_permissions(event, current_user, "edit", db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to edit this event"
        )
    
    # Cannot edit past events
    now = datetime.now(timezone.utc)
    start_time = event.start_time
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    if start_time < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit past events"
        )
    
    # Update allowed fields
    if event_update.title is not None:
        event.title = event_update.title
    if event_update.description is not None:
        event.description = event_update.description
    if event_update.story is not None:
        event.story = event_update.story
    if event_update.end_time is not None:
        if event_update.end_time <= event.start_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End time must be after start time"
            )
        event.end_time = event_update.end_time
    if event_update.rsvp_deadline is not None:
        event.rsvp_deadline = event_update.rsvp_deadline
    if event_update.max_attendees is not None:
        event.max_attendees = event_update.max_attendees
    if event_update.location_privacy is not None:
        event.location_privacy = event_update.location_privacy
    
    event.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(event)
    
    log_database_operation("update", "events", event.id, user_id=current_user.id)
    
    friend_ids = get_user_friends_ids(db, current_user.id)
    is_friend = True  # Creator is always a friend to themselves for their own event
    
    return EventResponse(**event.to_dict(user_id=current_user.id, is_friend=is_friend))

@router.delete("/{event_id}", response_model=SuccessResponse)
async def delete_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete an event (creator only)
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if not validate_event_permissions(event, current_user, "edit", db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this event"
        )
    
    # Soft delete - set as inactive
    event.is_active = False
    event.updated_at = datetime.now(timezone.utc)
    db.commit()
    
    log_database_operation("delete", "events", event.id, user_id=current_user.id)
    
    return SuccessResponse(message="Event deleted successfully")

# RSVP endpoints

@router.post("/{event_id}/rsvp", response_model=SuccessResponse)
async def rsvp_to_event(
    event_id: int,
    rsvp_data: EventRSVP,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    RSVP to an event
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if not validate_event_permissions(event, current_user, "rsvp", db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot RSVP to this event"
        )
    
    # Check if user is friends with creator for friend tracking
    is_friend = check_friendship(db, current_user.id, event.creator_id)
    
    # Add RSVP
    event.add_rsvp(
        user_id=current_user.id,
        status=rsvp_data.status,
        comment=rsvp_data.comment,
        is_friend=is_friend
    )
    
    db.commit()
    
    log_database_operation("rsvp", "events", event.id, user_id=current_user.id)
    
    return SuccessResponse(message=f"RSVP updated to '{rsvp_data.status}'")

@router.get("/{event_id}/rsvps")
async def get_event_rsvps(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get event RSVPs (creator only for detailed view)
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if not validate_event_permissions(event, current_user, "view", db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this event"
        )
    
    # Only creator can see detailed RSVP list
    if event.creator_id == current_user.id:
        # Return full RSVP details
        rsvps = event.rsvps or []
        
        # Enhance with user info
        detailed_rsvps = []
        for rsvp in rsvps:
            user = db.query(User).filter(User.id == rsvp.get('user_id')).first()
            if user:
                detailed_rsvps.append({
                    "user_id": user.id,
                    "username": user.username,
                    "profile_photo_url": user.profile_photo_url,
                    "status": rsvp.get('status'),
                    "comment": rsvp.get('comment'),
                    "is_friend": rsvp.get('is_friend', False),
                    "timestamp": rsvp.get('timestamp')
                })
        
        return {
            "rsvps": detailed_rsvps,
            "counts": {
                "attendee_count": event.attendee_count,
                "maybe_count": event.maybe_count,
                "declined_count": event.declined_count,
                "friend_attendee_count": event.friend_attendee_count
            }
        }
    else:
        # Return only counts for non-creators
        friend_ids = get_user_friends_ids(db, current_user.id)
        is_friend = event.creator_id in friend_ids
        
        return {
            "counts": {
                "attendee_count": event.attendee_count,
                "maybe_count": event.maybe_count,
                "friend_attendee_count": event.friend_attendee_count if is_friend else None
            }
        }

# Media endpoints

@router.post("/{event_id}/media", response_model=SuccessResponse)
async def add_event_media(
    event_id: int,
    media_file: UploadFile = File(...),
    caption: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add media to event story (creator only)
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if not validate_event_permissions(event, current_user, "edit", db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to add media to this event"
        )
    
    try:
        # Save media file
        media_url, media_type = await media_storage.save_event_media(media_file, current_user.id)
        
        # Add to event story
        event.add_story_media(media_url, media_type, caption)
        
        # Set primary media if none exists
        if not event.media_url:
            event.media_url = media_url
            event.media_type = media_type
        
        db.commit()
        
        return SuccessResponse(message="Media added to event successfully")
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add media to event"
        )

# Premium event endpoints

@router.get("/{event_id}/stats", response_model=EventStatsResponse)
async def get_event_stats(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get event statistics (creator only, premium events only)
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if event.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only event creators can view statistics"
        )
    
    if not event.is_premium:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Statistics are only available for premium events"
        )
    
    # Generate RSVP breakdown
    rsvps = event.rsvps or []
    rsvp_breakdown = {
        "by_status": {
            "yes": len([r for r in rsvps if r.get('status') == 'yes']),
            "maybe": len([r for r in rsvps if r.get('status') == 'maybe']),
            "no": len([r for r in rsvps if r.get('status') == 'no'])
        },
        "by_friend_status": {
            "friends": len([r for r in rsvps if r.get('is_friend', False)]),
            "non_friends": len([r for r in rsvps if not r.get('is_friend', False)])
        }
    }
    
    return EventStatsResponse(
        event_id=event.id,
        view_count=event.view_count,
        attendee_count=event.attendee_count,
        maybe_count=event.maybe_count,
        friend_attendee_count=event.friend_attendee_count,
        rsvp_breakdown=rsvp_breakdown
    )

# Utility endpoints

@router.get("/my/active")
async def get_my_active_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user's active events (created events)
    """
    events = db.query(Event).filter(
        Event.creator_id == current_user.id,
        Event.is_active == True,
        Event.end_time > datetime.now(timezone.utc)
    ).order_by(Event.start_time).all()
    
    event_responses = []
    for event in events:
        event_dict = event.to_dict(user_id=current_user.id, is_friend=True)
        event_responses.append(EventResponse(**event_dict))
    
    return {
        "events": event_responses,
        "active_count": len(event_responses),
        "can_create_more": len(event_responses) < 3
    }

@router.get("/attending/upcoming")
async def get_attending_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get events user is attending (RSVP'd yes)
    """
    now = datetime.now(timezone.utc)
    events = db.query(Event).filter(
        Event.is_active == True,
        Event.start_time > now
    ).all()
    
    attending_events = []
    for event in events:
        user_rsvp = event.get_user_rsvp(current_user.id)
        if user_rsvp and user_rsvp.get('status') == 'yes':
            friend_ids = get_user_friends_ids(db, current_user.id)
            is_friend = event.creator_id in friend_ids or event.creator_id == current_user.id
            event_dict = event.to_dict(user_id=current_user.id, is_friend=is_friend)
            attending_events.append(EventResponse(**event_dict))
    
    return {
        "events": attending_events,
        "count": len(attending_events)
    } 