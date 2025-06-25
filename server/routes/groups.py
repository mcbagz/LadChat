from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
import logging

from database import get_db
from models import User, GroupChat, GroupMessage
from schemas import (
    GroupMessageCreate, GroupMessageResponse, MessageReadUpdate, 
    MediaViewUpdate, SuccessResponse
)
from auth import get_current_user
from utils.error_handlers import raise_not_found, raise_forbidden, raise_bad_request
from utils.media_storage import save_uploaded_file, media_storage
from utils.logging_config import log_api_request, log_database_operation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/groups", tags=["group_messages"])

@router.post("/{group_id}/messages", response_model=GroupMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_group_message(
    group_id: int,
    message_data: GroupMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a text message to a group"""
    
    # Validate group exists and user is member
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group:
        raise_not_found("Group", group_id)
    
    if not group.is_member(current_user.id):
        raise_forbidden("You are not a member of this group")
    
    if not group.is_active:
        raise_bad_request("Cannot send message to inactive group")
    
    # Create message
    message = GroupMessage(
        group_id=group_id,
        sender_id=current_user.id,
        content=message_data.content,
        message_type=message_data.message_type,
        view_duration=message_data.view_duration
    )
    
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Update group activity
    group.update_activity()
    db.commit()
    
    log_database_operation("create", "group_messages", message.id, current_user.id)
    log_api_request("POST", f"/groups/{group_id}/messages", current_user.id)
    
    return _format_group_message_response(message, current_user.id)

@router.post("/{group_id}/messages/media", response_model=GroupMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_group_media_message(
    group_id: int,
    view_duration: int = Form(10),
    caption: Optional[str] = Form(None),
    media_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a media message (photo/video) to a group"""
    
    # Validate group and membership
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group:
        raise_not_found("Group", group_id)
    
    if not group.is_member(current_user.id):
        raise_forbidden("You are not a member of this group")
    
    # Save media file
    try:
        media_url, media_type = await save_uploaded_file(media_file, current_user.id, "snap")
    except Exception as e:
        logger.error(f"Media upload failed: {e}")
        raise HTTPException(status_code=400, detail="Media upload failed")
    
    # Create media message
    message = GroupMessage(
        group_id=group_id,
        sender_id=current_user.id,
        content=caption,
        media_url=media_url,
        media_type=media_type,
        message_type="media",
        view_duration=view_duration
    )
    
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Update group activity
    group.update_activity()
    db.commit()
    
    log_database_operation("create", "group_messages", message.id, current_user.id)
    
    return _format_group_message_response(message, current_user.id)

@router.get("/{group_id}/messages", response_model=List[GroupMessageResponse])
async def get_group_messages(
    group_id: int,
    limit: int = 50,
    before_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get messages in a group"""
    
    # Validate group and membership
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group:
        raise_not_found("Group", group_id)
    
    if not group.is_member(current_user.id):
        raise_forbidden("You are not a member of this group")
    
    # Build query
    query = db.query(GroupMessage).filter(
        GroupMessage.group_id == group_id,
        GroupMessage.is_deleted == False
    )
    
    # Add before_id filter for pagination
    if before_id:
        query = query.filter(GroupMessage.id < before_id)
    
    # Get messages
    messages = query.order_by(desc(GroupMessage.created_at)).limit(limit).all()
    
    # Format response
    response_data = []
    for message in messages:
        if message.can_view(current_user.id):
            response_data.append(_format_group_message_response(message, current_user.id))
    
    log_api_request("GET", f"/groups/{group_id}/messages", current_user.id)
    return response_data

@router.post("/{group_id}/messages/read", response_model=SuccessResponse)
async def mark_group_messages_as_read(
    group_id: int,
    read_data: MessageReadUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark group messages as read"""
    
    # Validate group membership
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group:
        raise_not_found("Group", group_id)
    
    if not group.is_member(current_user.id):
        raise_forbidden("You are not a member of this group")
    
    # Get messages
    messages = db.query(GroupMessage).filter(
        GroupMessage.id.in_(read_data.message_ids),
        GroupMessage.group_id == group_id
    ).all()
    
    read_count = 0
    for message in messages:
        if not message.is_read_by_user(current_user.id):
            message.mark_as_read(current_user.id)
            read_count += 1
    
    db.commit()
    
    return SuccessResponse(message=f"Marked {read_count} messages as read")

@router.post("/{group_id}/messages/{message_id}/view", response_model=SuccessResponse)
async def mark_group_media_as_viewed(
    group_id: int,
    message_id: int,
    view_data: MediaViewUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark group media message as viewed"""
    
    # Validate group membership
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group:
        raise_not_found("Group", group_id)
    
    if not group.is_member(current_user.id):
        raise_forbidden("You are not a member of this group")
    
    # Get message
    message = db.query(GroupMessage).filter(
        GroupMessage.id == message_id,
        GroupMessage.group_id == group_id,
        GroupMessage.message_type == "media"
    ).first()
    
    if not message:
        raise_not_found("Media message", message_id)
    
    if not message.can_view(current_user.id):
        raise_forbidden("Cannot view this message")
    
    message.mark_as_viewed(current_user.id, view_data.screenshot_taken)
    db.commit()
    
    # Log screenshot if taken
    if view_data.screenshot_taken:
        logger.warning(f"Screenshot taken by user {current_user.id} on group message {message.id}")
    
    return SuccessResponse(message="Media viewed successfully")

@router.delete("/{group_id}/messages/{message_id}", response_model=SuccessResponse)
async def delete_group_message(
    group_id: int,
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a group message (admin only or own message)"""
    
    # Validate group membership
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group:
        raise_not_found("Group", group_id)
    
    if not group.is_member(current_user.id):
        raise_forbidden("You are not a member of this group")
    
    # Get message
    message = db.query(GroupMessage).filter(
        GroupMessage.id == message_id,
        GroupMessage.group_id == group_id
    ).first()
    
    if not message:
        raise_not_found("Message", message_id)
    
    # Check permissions - sender or group admin can delete
    if message.sender_id != current_user.id and not group.is_admin(current_user.id):
        raise_forbidden("Cannot delete this message")
    
    message.is_deleted = True
    db.commit()
    
    # If media message, remove file
    if message.media_url:
        media_storage.delete_media_file(message.media_url)
    
    return SuccessResponse(message="Message deleted successfully")

@router.get("/{group_id}/info")
async def get_group_info(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get group information"""
    
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group:
        raise_not_found("Group", group_id)
    
    # For public groups, anyone can view basic info
    # For private groups, only members can view
    if group.visibility == "private" and not group.is_member(current_user.id):
        raise_forbidden("Cannot view private group info")
    
    # Get member details if user is a member
    include_members = group.is_member(current_user.id)
    group_data = group.to_dict(include_members=include_members)
    
    # Add user's membership status
    group_data["user_is_member"] = group.is_member(current_user.id)
    group_data["user_is_admin"] = group.is_admin(current_user.id)
    
    log_api_request("GET", f"/groups/{group_id}/info", current_user.id)
    return group_data

@router.post("/{group_id}/join", response_model=SuccessResponse)
async def join_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Join a group"""
    
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group:
        raise_not_found("Group", group_id)
    
    if not group.can_join(current_user.id):
        raise_bad_request("Cannot join this group")
    
    if group.is_member(current_user.id):
        raise_bad_request("Already a member of this group")
    
    # For invite-only groups, this would need invitation validation
    if group.join_approval_required:
        raise_bad_request("This group requires approval to join")
    
    group.add_member(current_user.id)
    db.commit()
    
    # Create system message
    system_message = GroupMessage(
        group_id=group_id,
        sender_id=current_user.id,
        message_type="system",
        system_action="join"
    )
    db.add(system_message)
    db.commit()
    
    log_database_operation("join", "group_chats", group_id, current_user.id)
    
    return SuccessResponse(message="Joined group successfully")

@router.post("/{group_id}/leave", response_model=SuccessResponse)
async def leave_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Leave a group"""
    
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group:
        raise_not_found("Group", group_id)
    
    if not group.is_member(current_user.id):
        raise_bad_request("Not a member of this group")
    
    group.remove_member(current_user.id)
    db.commit()
    
    # Create system message
    system_message = GroupMessage(
        group_id=group_id,
        sender_id=current_user.id,
        message_type="system",
        system_action="leave"
    )
    db.add(system_message)
    db.commit()
    
    log_database_operation("leave", "group_chats", group_id, current_user.id)
    
    return SuccessResponse(message="Left group successfully")

# Helper functions
def _format_group_message_response(message: GroupMessage, user_id: int) -> dict:
    """Format group message for API response"""
    data = message.to_dict(user_id)
    
    # Add media URL if available
    if message.media_url:
        data["media_url"] = media_storage.get_media_url(message.media_url)
    
    # Add read/view counts
    data["read_count"] = message.get_read_count()
    if message.message_type == "media":
        data["view_count"] = message.get_view_count()
    
    return data 