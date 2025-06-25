from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_
from typing import List, Optional
import logging

from database import get_db
from models import User, Story
from schemas import StoryCreate, StoryResponse, SuccessResponse
from auth import get_current_user
from utils.error_handlers import raise_not_found, raise_forbidden, raise_bad_request
from utils.media_storage import save_uploaded_file, media_storage
from utils.logging_config import log_api_request, log_database_operation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/stories", tags=["stories"])

@router.post("/upload", response_model=StoryResponse, status_code=status.HTTP_201_CREATED)
async def create_story(
    caption: Optional[str] = Form(None),
    visibility: str = Form("public"),
    circles: Optional[str] = Form(None),  # JSON string of circle IDs
    media_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new story with media"""
    
    # Parse circles if provided
    circle_ids = []
    if circles:
        try:
            import json
            circle_ids = json.loads(circles)
        except json.JSONDecodeError:
            raise_bad_request("Invalid circles format")
    
    # Save media file
    try:
        media_url, media_type = await save_uploaded_file(media_file, current_user.id, "story")
    except Exception as e:
        logger.error(f"Media upload failed: {e}")
        raise HTTPException(status_code=400, detail="Media upload failed")
    
    # Create story
    story = Story(
        user_id=current_user.id,
        media_url=media_url,
        media_type=media_type,
        caption=caption,
        visibility=visibility,
        circles=circle_ids if circle_ids else None
    )
    
    db.add(story)
    db.commit()
    db.refresh(story)
    
    log_database_operation("create", "stories", story.id, current_user.id)
    log_api_request("POST", "/stories/upload", current_user.id)
    
    return _format_story_response(story, current_user, current_user.id)

@router.get("/feed", response_model=List[StoryResponse])
async def get_story_feed(
    limit: int = 20,
    offset: int = 0,
    visibility: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get story feed for user"""
    
    # Get list of user's friends
    from models.friendship import Friendship
    friend_ids = []
    friendships = db.query(Friendship).filter(
        or_(
            Friendship.user1_id == current_user.id,
            Friendship.user2_id == current_user.id
        )
    ).all()
    
    for friendship in friendships:
        friend_id = friendship.user2_id if friendship.user1_id == current_user.id else friendship.user1_id
        friend_ids.append(friend_id)
    
    print(f"📱 STORY FEED DEBUG - User {current_user.id} has {len(friend_ids)} friends: {friend_ids}")
    
    # Base query for active, non-expired stories
    query = db.query(Story).filter(
        Story.is_active == True,
        Story.expires_at > Story.created_at  # Using created_at as current time placeholder
    )
    
    # Filter by visibility if specified
    if visibility:
        query = query.filter(Story.visibility == visibility)
    else:
        # Show only friends' stories (not user's own stories in this feed):
        # 1. Public stories from friends
        # 2. Friends' stories with "friends" visibility  
        query = query.filter(
            and_(
                Story.user_id != current_user.id,  # Exclude own stories from friends feed
                or_(
                    and_(
                        Story.visibility == "public",
                        Story.user_id.in_(friend_ids)  # Public stories from friends only
                    ),
                    and_(
                        Story.visibility == "friends",
                        Story.user_id.in_(friend_ids)  # Friends-only stories from friends
                    )
                )
            )
        )
    
    # Get stories ordered by creation time (newest first)
    stories = query.order_by(desc(Story.created_at)).offset(offset).limit(limit).all()
    
    print(f"📱 STORY FEED DEBUG - Found {len(stories)} stories in feed")
    
    # Format response
    response_data = []
    for story in stories:
        # Get story owner info
        owner = db.query(User).filter(User.id == story.user_id).first()
        if owner:
            # Check if user has viewed this story
            has_viewed = bool(story.viewers and current_user.id in (story.viewers or []))
            story_data = _format_story_response(story, owner, current_user.id, has_viewed)
            response_data.append(story_data)
    
    log_api_request("GET", "/stories/feed", current_user.id)
    return response_data

@router.get("/my-stories", response_model=List[StoryResponse])
async def get_my_stories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's stories"""
    
    stories = db.query(Story).filter(
        Story.user_id == current_user.id,
        Story.is_active == True
    ).order_by(desc(Story.created_at)).all()
    
    response_data = []
    for story in stories:
        story_data = _format_story_response(story, current_user, current_user.id, True)
        response_data.append(story_data)
    
    log_api_request("GET", "/stories/my-stories", current_user.id)
    return response_data

@router.post("/{story_id}/view", response_model=SuccessResponse)
async def view_story(
    story_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark story as viewed"""
    
    story = db.query(Story).filter(
        Story.id == story_id,
        Story.is_active == True
    ).first()
    
    if not story:
        raise_not_found("Story", story_id)
    
    if story.is_expired():
        raise_bad_request("Story has expired")
    
    # Check if user can view this story
    if not _can_view_story(story, current_user.id, db):
        raise_forbidden("Cannot view this story")
    
    # Add view if not already viewed
    if not story.viewers or current_user.id not in story.viewers:
        story.add_view(current_user.id)
        db.commit()
    
    return SuccessResponse(message="Story viewed")

@router.delete("/{story_id}", response_model=SuccessResponse)
async def delete_story(
    story_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete own story"""
    
    story = db.query(Story).filter(
        Story.id == story_id,
        Story.user_id == current_user.id
    ).first()
    
    if not story:
        raise_not_found("Story", story_id)
    
    # Soft delete
    story.is_active = False
    db.commit()
    
    # Remove media file
    if story.media_url:
        media_storage.delete_media_file(story.media_url)
    
    log_database_operation("delete", "stories", story_id, current_user.id)
    
    return SuccessResponse(message="Story deleted")

@router.get("/{story_id}/viewers", response_model=List[dict])
async def get_story_viewers(
    story_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of users who viewed the story (only for story owner)"""
    
    story = db.query(Story).filter(
        Story.id == story_id,
        Story.user_id == current_user.id  # Only owner can see viewers
    ).first()
    
    if not story:
        raise_not_found("Story", story_id)
    
    if not story.viewers:
        return []
    
    # Get viewer details
    viewers = db.query(User).filter(User.id.in_(story.viewers)).all()
    
    response_data = []
    for viewer in viewers:
        response_data.append({
            "id": viewer.id,
            "username": viewer.username,
            "profile_photo_url": viewer.profile_photo_url
        })
    
    return response_data

@router.get("/user/{user_id}", response_model=List[StoryResponse])
async def get_user_stories(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get stories from a specific user"""
    
    # Check if target user exists
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise_not_found("User", user_id)
    
    # Get user's public stories or stories visible to current user
    query = db.query(Story).filter(
        Story.user_id == user_id,
        Story.is_active == True
    )
    
    # Apply visibility filters
    if user_id != current_user.id:  # If not viewing own stories
        query = query.filter(
            or_(
                Story.visibility == "public",
                and_(
                    Story.visibility == "friends",
                    # TODO: Add friend relationship check
                    False  # Placeholder - should check if users are friends
                )
            )
        )
    
    stories = query.order_by(desc(Story.created_at)).all()
    
    response_data = []
    for story in stories:
        if _can_view_story(story, current_user.id, db):
            has_viewed = story.viewers and current_user.id in (story.viewers or [])
            story_data = _format_story_response(story, target_user, current_user.id, has_viewed)
            response_data.append(story_data)
    
    log_api_request("GET", f"/stories/user/{user_id}", current_user.id)
    return response_data

# Helper functions
def _can_view_story(story: Story, user_id: int, db: Session = None) -> bool:
    """Check if user can view a story"""
    if story.user_id == user_id:
        return True  # Can always view own stories
    
    if story.visibility == "public":
        return True
    
    if story.visibility == "friends":
        # Check if users are friends
        if db:
            from models.friendship import Friendship
            friendship = db.query(Friendship).filter(
                or_(
                    and_(Friendship.user1_id == user_id, Friendship.user2_id == story.user_id),
                    and_(Friendship.user1_id == story.user_id, Friendship.user2_id == user_id)
                )
            ).first()
            return friendship is not None
        return False
    
    if story.visibility == "private":
        return False
    
    # Check circle-based visibility
    if story.circles and story.visibility == "friends":
        # TODO: Implement circle membership check
        return False  # Placeholder
    
    return False

def _format_story_response(story: Story, owner: User, viewer_id: int, has_viewed: bool = False) -> dict:
    """Format story for API response"""
    return {
        "id": story.id,
        "user_id": story.user_id,
        "user": {
            "id": owner.id,
            "username": owner.username,
            "bio": getattr(owner, 'bio', None),
            "interests": getattr(owner, 'interests', []),
            "profile_photo_url": owner.profile_photo_url,
            "is_verified": owner.is_verified,
            "open_to_friends": getattr(owner, 'open_to_friends', False),
            "created_at": getattr(owner, 'created_at', None).isoformat() if getattr(owner, 'created_at', None) else None
        },
        "media_url": media_storage.get_media_url(story.media_url),
        "media_type": story.media_type,
        "caption": story.caption,
        "visibility": story.visibility,
        "view_count": story.view_count,
        "has_viewed": bool(has_viewed),
        "created_at": story.created_at.isoformat(),
        "expires_at": story.expires_at.isoformat()
    } 