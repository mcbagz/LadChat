from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, and_
from typing import List, Optional
import logging
import json

from database import get_db
from models import User, Snap, GroupChat, DirectMessage, Conversation
from schemas import SnapCreate, SuccessResponse, MediaViewUpdate
from auth import get_current_user
from utils.error_handlers import raise_not_found, raise_forbidden, raise_bad_request
from utils.media_storage import save_uploaded_file, media_storage
from utils.logging_config import log_api_request, log_database_operation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/snaps", tags=["snaps"])

@router.post("/send", response_model=dict, status_code=status.HTTP_201_CREATED)
async def send_snap(
    recipient_ids: Optional[str] = Form(None),  # JSON string of user IDs
    group_ids: Optional[str] = Form(None),      # JSON string of group IDs
    caption: Optional[str] = Form(None),
    view_duration: int = Form(10),
    media_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a snap to users and/or groups"""
    
    # Parse recipient and group IDs
    parsed_recipient_ids = []
    parsed_group_ids = []
    
    if recipient_ids:
        try:
            parsed_recipient_ids = json.loads(recipient_ids)
        except json.JSONDecodeError:
            raise_bad_request("Invalid recipient_ids format")
    
    if group_ids:
        try:
            parsed_group_ids = json.loads(group_ids)
        except json.JSONDecodeError:
            raise_bad_request("Invalid group_ids format")
    
    # Validate at least one recipient
    if not parsed_recipient_ids and not parsed_group_ids:
        raise_bad_request("At least one recipient must be specified")
    
    # Validate recipients exist
    if parsed_recipient_ids:
        recipients = db.query(User).filter(User.id.in_(parsed_recipient_ids)).all()
        if len(recipients) != len(parsed_recipient_ids):
            raise_bad_request("One or more recipients not found")
    
    # Validate groups exist and user is member
    if parsed_group_ids:
        groups = db.query(GroupChat).filter(GroupChat.id.in_(parsed_group_ids)).all()
        if len(groups) != len(parsed_group_ids):
            raise_bad_request("One or more groups not found")
        
        for group in groups:
            if not group.is_member(current_user.id):
                raise_forbidden(f"You are not a member of group {group.name}")
    
    # Save media file
    try:
        media_url, media_type = await save_uploaded_file(media_file, current_user.id, "snap")
    except Exception as e:
        logger.error(f"Media upload failed: {e}")
        raise HTTPException(status_code=400, detail="Media upload failed")
    
    # Create snap
    snap = Snap(
        sender_id=current_user.id,
        recipient_ids=parsed_recipient_ids if parsed_recipient_ids else None,
        group_ids=parsed_group_ids if parsed_group_ids else None,
        media_url=media_url,
        media_type=media_type,
        caption=caption,
        view_duration=view_duration
    )
    
    db.add(snap)
    db.commit()
    db.refresh(snap)
    
    # Also create DirectMessage records for individual recipients to appear in conversations
    for recipient_id in parsed_recipient_ids:
        # Create a DirectMessage record for this snap
        direct_message = DirectMessage(
            sender_id=current_user.id,
            recipient_id=recipient_id,
            content=caption,
            media_url=media_url,
            media_type=media_type,
            message_type="media",
            view_duration=view_duration
        )
        
        db.add(direct_message)
        db.commit()
        db.refresh(direct_message)
        
        # Update conversation (avoid circular import by defining inline)
        await _update_snap_conversation(db, current_user.id, recipient_id, direct_message.id)
    
    log_database_operation("create", "snaps", snap.id, current_user.id)
    log_api_request("POST", "/snaps/send", current_user.id)
    
    return {
        "id": snap.id,
        "message": f"Snap sent to {len(parsed_recipient_ids)} users and {len(parsed_group_ids)} groups",
        "recipient_count": len(parsed_recipient_ids),
        "group_count": len(parsed_group_ids),
        "expires_at": snap.expires_at
    }

@router.get("/received", response_model=List[dict])
async def get_received_snaps(
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get snaps received by current user"""
    
    # Query for snaps where user is direct recipient
    direct_snaps = db.query(Snap).filter(
        Snap.recipient_ids.contains([current_user.id]),
        Snap.is_active == True
    )
    
    # Query for snaps sent to groups user is member of
    # TODO: This is a simplified version - in production, you'd want to
    # properly join with group membership
    user_groups = db.query(GroupChat).filter(
        GroupChat.members.contains([current_user.id]),
        GroupChat.is_active == True
    ).all()
    
    group_snaps = []
    if user_groups:
        group_ids = [g.id for g in user_groups]
        group_snaps = db.query(Snap).filter(
            Snap.group_ids.op('?|')(group_ids),  # PostgreSQL jsonb operator
            Snap.is_active == True,
            Snap.sender_id != current_user.id  # Don't include own snaps
        ).all()
    
    # Combine and sort all snaps
    all_snaps = list(direct_snaps.all()) + group_snaps
    all_snaps.sort(key=lambda x: x.created_at, reverse=True)
    
    # Apply filters
    if unread_only:
        all_snaps = [s for s in all_snaps if not s.get_view_info(current_user.id)]
    
    # Apply pagination
    paginated_snaps = all_snaps[offset:offset + limit]
    
    response_data = []
    for snap in paginated_snaps:
        if snap.can_view(current_user.id):
            snap_data = _format_snap_response(snap, current_user.id, db)
            response_data.append(snap_data)
    
    log_api_request("GET", "/snaps/received", current_user.id)
    return response_data

@router.get("/sent", response_model=List[dict])
async def get_sent_snaps(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get snaps sent by current user"""
    
    snaps = db.query(Snap).filter(
        Snap.sender_id == current_user.id,
        Snap.is_active == True
    ).order_by(desc(Snap.created_at)).offset(offset).limit(limit).all()
    
    response_data = []
    for snap in snaps:
        snap_data = _format_snap_response(snap, current_user.id, db, include_recipients=True)
        response_data.append(snap_data)
    
    log_api_request("GET", "/snaps/sent", current_user.id)
    return response_data

@router.get("/{snap_id}")
async def get_snap(
    snap_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific snap"""
    
    snap = db.query(Snap).filter(
        Snap.id == snap_id,
        Snap.is_active == True
    ).first()
    
    if not snap:
        raise_not_found("Snap", snap_id)
    
    if not snap.can_view(current_user.id):
        raise_forbidden("Cannot view this snap")
    
    if snap.is_expired():
        raise_bad_request("Snap has expired")
    
    snap_data = _format_snap_response(snap, current_user.id, db)
    
    log_api_request("GET", f"/snaps/{snap_id}", current_user.id)
    return snap_data

@router.post("/{snap_id}/view", response_model=SuccessResponse)
async def view_snap(
    snap_id: int,
    view_data: MediaViewUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark snap as viewed"""
    
    snap = db.query(Snap).filter(
        Snap.id == snap_id,
        Snap.is_active == True
    ).first()
    
    if not snap:
        raise_not_found("Snap", snap_id)
    
    if not snap.can_view(current_user.id):
        raise_forbidden("Cannot view this snap")
    
    if snap.is_expired():
        raise_bad_request("Snap has expired")
    
    # Mark as viewed
    snap.add_view(current_user.id, view_data.screenshot_taken)
    db.commit()
    
    # Log screenshot if taken
    if view_data.screenshot_taken:
        logger.warning(f"Screenshot taken by user {current_user.id} on snap {snap.id}")
        
        # TODO: Send notification to sender about screenshot
    
    return SuccessResponse(message="Snap viewed")

@router.delete("/{snap_id}", response_model=SuccessResponse)
async def delete_snap(
    snap_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete own snap"""
    
    snap = db.query(Snap).filter(
        Snap.id == snap_id,
        Snap.sender_id == current_user.id
    ).first()
    
    if not snap:
        raise_not_found("Snap", snap_id)
    
    # Soft delete
    snap.is_active = False
    db.commit()
    
    # Remove media file
    if snap.media_url:
        media_storage.delete_media_file(snap.media_url)
    
    log_database_operation("delete", "snaps", snap_id, current_user.id)
    
    return SuccessResponse(message="Snap deleted")

@router.get("/{snap_id}/views")
async def get_snap_views(
    snap_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get view information for a snap (sender only)"""
    
    snap = db.query(Snap).filter(
        Snap.id == snap_id,
        Snap.sender_id == current_user.id  # Only sender can see views
    ).first()
    
    if not snap:
        raise_not_found("Snap", snap_id)
    
    if not snap.views:
        return {"views": [], "total_views": 0, "total_screenshots": 0}
    
    # Get viewer details
    viewer_ids = [v.get('user_id') for v in snap.views if v.get('user_id')]
    viewers = db.query(User).filter(User.id.in_(viewer_ids)).all()
    viewer_map = {v.id: v for v in viewers}
    
    view_details = []
    for view in snap.views:
        user_id = view.get('user_id')
        if user_id and user_id in viewer_map:
            user = viewer_map[user_id]
            view_details.append({
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "profile_photo_url": user.profile_photo_url
                },
                "viewed_at": view.get('viewed_at'),
                "screenshot_taken": view.get('screenshot_taken', False)
            })
    
    return {
        "views": view_details,
        "total_views": snap.total_views,
        "total_screenshots": snap.total_screenshots
    }

# Helper functions
def _format_snap_response(snap: Snap, user_id: int, db: Session, include_recipients: bool = False) -> dict:
    """Format snap for API response"""
    
    # Get sender info
    sender = db.query(User).filter(User.id == snap.sender_id).first()
    
    data = {
        "id": snap.id,
        "sender": {
            "id": sender.id,
            "username": sender.username,
            "profile_photo_url": sender.profile_photo_url
        } if sender else None,
        "media_url": media_storage.get_media_url(snap.media_url),
        "media_type": snap.media_type,
        "caption": snap.caption,
        "view_duration": snap.view_duration,
        "total_views": snap.total_views,
        "total_screenshots": snap.total_screenshots,
        "is_opened": snap.is_opened,
        "created_at": snap.created_at,
        "expires_at": snap.expires_at,
        "is_active": snap.is_active
    }
    
    # Include recipient info if requested (for sender)
    if include_recipients and snap.sender_id == user_id:
        recipients_info = []
        if snap.recipient_ids:
            recipients = db.query(User).filter(User.id.in_(snap.recipient_ids)).all()
            recipients_info.extend([{
                "type": "user",
                "id": r.id,
                "username": r.username
            } for r in recipients])
        
        if snap.group_ids:
            groups = db.query(GroupChat).filter(GroupChat.id.in_(snap.group_ids)).all()
            recipients_info.extend([{
                "type": "group",
                "id": g.id,
                "name": g.name
            } for g in groups])
        
        data["recipients"] = recipients_info
    
    # Include user's view info
    view_info = snap.get_view_info(user_id)
    if view_info:
        data["user_view_info"] = view_info
    
    return data 

async def _update_snap_conversation(db: Session, user1_id: int, user2_id: int, message_id: int):
    """Update or create conversation between two users for snap"""
    
    # Ensure user1_id is smaller for consistent ordering
    if user1_id > user2_id:
        user1_id, user2_id = user2_id, user1_id
    
    conversation = db.query(Conversation).filter(
        Conversation.user1_id == user1_id,
        Conversation.user2_id == user2_id
    ).first()
    
    if not conversation:
        conversation = Conversation(
            user1_id=user1_id,
            user2_id=user2_id
        )
        db.add(conversation)
    
    conversation.update_last_message(message_id)
    
    # Increment unread count for recipient
    message = db.query(DirectMessage).filter(DirectMessage.id == message_id).first()
    if message:
        conversation.increment_unread(message.recipient_id)
    
    db.commit()