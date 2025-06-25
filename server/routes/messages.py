from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from typing import List, Optional
import logging

from database import get_db
from models import User, DirectMessage, Conversation
from schemas import (
    DirectMessageCreate, DirectMessageResponse, ConversationResponse,
    MessageReadUpdate, MediaViewUpdate, SuccessResponse
)
from auth import get_current_user
from utils.error_handlers import raise_not_found, raise_forbidden, raise_bad_request
from utils.media_storage import save_uploaded_file, media_storage
from utils.logging_config import log_api_request, log_database_operation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/messages", tags=["direct_messages"])

@router.post("/send", status_code=status.HTTP_201_CREATED)
async def send_direct_message(
    message_data: DirectMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a text message to another user"""
    
    # Validate recipient exists
    recipient = db.query(User).filter(User.id == message_data.recipient_id).first()
    if not recipient:
        raise_not_found("User", message_data.recipient_id)
    
    if not recipient.is_active:
        raise_bad_request("Cannot send message to inactive user")
    
    # Create message
    message = DirectMessage(
        sender_id=current_user.id,
        recipient_id=message_data.recipient_id,
        content=message_data.content,
        message_type=message_data.message_type,
        view_duration=message_data.view_duration
    )
    
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Update or create conversation
    await _update_conversation(db, current_user.id, message_data.recipient_id, message.id)
    
    log_database_operation("create", "direct_messages", message.id, current_user.id)
    log_api_request("POST", "/messages/send", current_user.id)
    
    return _format_message_response(message, current_user.id)

@router.post("/send-media", status_code=status.HTTP_201_CREATED)
async def send_media_message(
    recipient_id: int = Form(...),
    view_duration: int = Form(10),
    caption: Optional[str] = Form(None),
    media_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a media message (photo/video) to another user"""
    
    # Validate recipient
    recipient = db.query(User).filter(User.id == recipient_id).first()
    if not recipient:
        raise_not_found("User", recipient_id)
    
    # Save media file
    try:
        media_url, media_type = await save_uploaded_file(media_file, current_user.id, "snap")
    except Exception as e:
        logger.error(f"Media upload failed: {e}")
        raise HTTPException(status_code=400, detail="Media upload failed")
    
    # Create media message
    message = DirectMessage(
        sender_id=current_user.id,
        recipient_id=recipient_id,
        content=caption,
        media_url=media_url,
        media_type=media_type,
        message_type="media",
        view_duration=view_duration
    )
    
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Update conversation
    await _update_conversation(db, current_user.id, recipient_id, message.id)
    
    log_database_operation("create", "direct_messages", message.id, current_user.id)
    
    return _format_message_response(message, current_user.id)

@router.get("/conversations")
async def get_conversations(
    limit: int = 20,
    offset: int = 0,
    archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's conversations"""
    
    # Get conversations where user is participant
    conversations = db.query(Conversation).filter(
        or_(
            Conversation.user1_id == current_user.id,
            Conversation.user2_id == current_user.id
        )
    ).order_by(desc(Conversation.last_message_at)).offset(offset).limit(limit).all()
    
    response_data = []
    for conv in conversations:
        # Check if archived filter matches
        is_archived = conv.is_archived_by(current_user.id)
        if archived != is_archived:
            continue
        
        # Get other user info
        other_user_id = conv.get_other_user_id(current_user.id)
        other_user = db.query(User).filter(User.id == other_user_id).first()
        
        # Get last message
        last_message = None
        if conv.last_message_id:
            last_msg = db.query(DirectMessage).filter(DirectMessage.id == conv.last_message_id).first()
            if last_msg and last_msg.can_view(current_user.id):
                last_message = _format_message_response(last_msg, current_user.id)
        
        response_data.append({
            "id": conv.id,
            "other_user_id": other_user_id,
            "other_user": other_user.to_dict() if other_user else None,
            "last_message": last_message,
            "unread_count": conv.get_unread_count(current_user.id),
            "is_archived": is_archived,
            "is_muted": conv.is_muted_by(current_user.id),
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else None
        })
    
    log_api_request("GET", "/messages/conversations", current_user.id)
    return response_data

@router.get("/{user_id}")
async def get_conversation_messages(
    user_id: int,
    limit: int = 50,
    before_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get messages in a conversation with a specific user"""
    
    # Validate other user exists
    other_user = db.query(User).filter(User.id == user_id).first()
    if not other_user:
        raise_not_found("User", user_id)
    
    # Build query for messages between users
    query = db.query(DirectMessage).filter(
        or_(
            and_(DirectMessage.sender_id == current_user.id, DirectMessage.recipient_id == user_id),
            and_(DirectMessage.sender_id == user_id, DirectMessage.recipient_id == current_user.id)
        )
    )
    
    # Add before_id filter for pagination
    if before_id:
        query = query.filter(DirectMessage.id < before_id)
    
    # Get messages
    messages = query.order_by(desc(DirectMessage.created_at)).limit(limit).all()
    
    # Format response
    response_data = []
    for message in messages:
        if message.can_view(current_user.id):
            response_data.append(_format_message_response(message, current_user.id))
    
    log_api_request("GET", f"/messages/{user_id}", current_user.id)
    return response_data

@router.post("/read", response_model=SuccessResponse)
async def mark_messages_as_read(
    read_data: MessageReadUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark messages as read"""
    
    messages = db.query(DirectMessage).filter(
        DirectMessage.id.in_(read_data.message_ids),
        DirectMessage.recipient_id == current_user.id
    ).all()
    
    read_count = 0
    for message in messages:
        if not message.is_read:
            message.mark_as_read(current_user.id)
            read_count += 1
    
    db.commit()
    
    # Update conversation unread counts
    for message in messages:
        conversation = db.query(Conversation).filter(
            or_(
                and_(Conversation.user1_id == current_user.id, Conversation.user2_id == message.sender_id),
                and_(Conversation.user1_id == message.sender_id, Conversation.user2_id == current_user.id)
            )
        ).first()
        
        if conversation:
            conversation.reset_unread(current_user.id)
    
    db.commit()
    
    return SuccessResponse(message=f"Marked {read_count} messages as read")

@router.post("/view", response_model=SuccessResponse)
async def mark_media_as_viewed(
    view_data: MediaViewUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark media message as viewed (for snaps)"""
    
    message = db.query(DirectMessage).filter(
        DirectMessage.id == view_data.message_id,
        DirectMessage.recipient_id == current_user.id,
        DirectMessage.message_type == "media"
    ).first()
    
    if not message:
        raise_not_found("Media message", view_data.message_id)
    
    if not message.can_view(current_user.id):
        raise_forbidden("Cannot view this message")
    
    message.mark_as_opened(current_user.id, view_data.screenshot_taken)
    db.commit()
    
    # Log screenshot if taken
    if view_data.screenshot_taken:
        logger.warning(f"Screenshot taken by user {current_user.id} on message {message.id}")
    
    return SuccessResponse(message="Media viewed successfully")

@router.delete("/{message_id}", response_model=SuccessResponse)
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a message for the current user"""
    
    message = db.query(DirectMessage).filter(DirectMessage.id == message_id).first()
    if not message:
        raise_not_found("Message", message_id)
    
    # Check if user can delete this message
    if current_user.id not in [message.sender_id, message.recipient_id]:
        raise_forbidden("Cannot delete this message")
    
    message.delete_for_user(current_user.id)
    db.commit()
    
    # If message is completely deleted, remove media file
    if message.is_deleted and message.media_url:
        media_storage.delete_media_file(message.media_url)
    
    return SuccessResponse(message="Message deleted successfully")

# Helper functions
async def _update_conversation(db: Session, user1_id: int, user2_id: int, message_id: int):
    """Update or create conversation between two users"""
    
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

def _format_message_response(message: DirectMessage, user_id: int) -> dict:
    """Format message for API response"""
    data = {
        "id": message.id,
        "sender_id": message.sender_id,
        "recipient_id": message.recipient_id,
        "content": message.content,
        "message_type": message.message_type,
        "media_url": media_storage.get_media_url(message.media_url) if message.media_url else None,
        "media_type": message.media_type,
        "view_duration": message.view_duration,
        "is_read": message.is_read,
        "is_opened": message.is_opened if message.message_type == "media" else None,
        "screenshot_taken": message.screenshot_taken if message.message_type == "media" else None,
        "created_at": message.created_at,
        "expires_at": message.expires_at
    }
    
    return data 