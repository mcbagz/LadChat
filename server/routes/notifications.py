"""
Notifications API routes for LadChat
Handles in-app notifications for chat messages and activity tracking
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel

from database import get_db
from models import User, DirectMessage, GroupMessage, GroupChat, Conversation
from models.embeddings import ChatActivity
from auth import get_current_user
from schemas import SuccessResponse

class MarkChatOpenedRequest(BaseModel):
    chat_type: str
    chat_id: int

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/chat-summary")
async def get_chat_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get summary of all chats with unread message counts
    Only returns chats that have unread messages
    """
    try:
        chat_summary = []
        
        # Get direct conversations
        conversations = db.query(Conversation).filter(
            or_(
                Conversation.user1_id == current_user.id,
                Conversation.user2_id == current_user.id
            )
        ).all()
        
        for conv in conversations:
            # Get chat activity to determine last opened time
            activity = db.query(ChatActivity).filter(
                ChatActivity.user_id == current_user.id,
                ChatActivity.chat_type == 'direct',
                ChatActivity.chat_id == conv.id
            ).first()
            
            # Default to very old date if never opened
            last_opened = activity.last_opened_at if activity else datetime.min.replace(tzinfo=timezone.utc)
            
            # Count unread messages since last opened
            other_user_id = conv.get_other_user_id(current_user.id)
            
            unread_count = db.query(DirectMessage).filter(
                DirectMessage.sender_id == other_user_id,
                DirectMessage.recipient_id == current_user.id,
                DirectMessage.created_at > last_opened,
                DirectMessage.is_deleted == False
            ).count()
            
            if unread_count > 0:  # Only include chats with unread messages
                other_user = db.query(User).filter(User.id == other_user_id).first()
                
                # Get most recent message for preview
                last_message = db.query(DirectMessage).filter(
                    or_(
                        and_(DirectMessage.sender_id == current_user.id, DirectMessage.recipient_id == other_user_id),
                        and_(DirectMessage.sender_id == other_user_id, DirectMessage.recipient_id == current_user.id)
                    )
                ).order_by(DirectMessage.created_at.desc()).first()
                
                chat_summary.append({
                    "chat_type": "direct",
                    "chat_id": conv.id,
                    "other_user": other_user.to_dict() if other_user else None,
                    "unread_count": unread_count,
                    "last_message_preview": last_message.content[:50] + "..." if last_message and last_message.content and len(last_message.content) > 50 else (last_message.content if last_message else None),
                    "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None
                })
        
        # Get group chats where user is a member
        groups = db.query(GroupChat).filter(
            GroupChat.is_active == True
        ).all()
        
        # Filter to groups where user is actually a member
        user_groups = [group for group in groups if group.is_member(current_user.id)]
        
        for group in user_groups:
            # Get chat activity to determine last opened time
            activity = db.query(ChatActivity).filter(
                ChatActivity.user_id == current_user.id,
                ChatActivity.chat_type == 'group',
                ChatActivity.chat_id == group.id
            ).first()
            
            # Default to very old date if never opened
            last_opened = activity.last_opened_at if activity else datetime.min.replace(tzinfo=timezone.utc)
            
            # Count unread messages since last opened (excluding own messages)
            unread_count = db.query(GroupMessage).filter(
                GroupMessage.group_id == group.id,
                GroupMessage.created_at > last_opened,
                GroupMessage.sender_id != current_user.id,  # Don't count own messages
                GroupMessage.is_deleted == False
            ).count()
            
            if unread_count > 0:  # Only include chats with unread messages
                # Get most recent message for preview
                last_message = db.query(GroupMessage).filter(
                    GroupMessage.group_id == group.id,
                    GroupMessage.is_deleted == False
                ).order_by(GroupMessage.created_at.desc()).first()
                
                chat_summary.append({
                    "chat_type": "group",
                    "chat_id": group.id,
                    "group_name": group.name,
                    "group_avatar_url": group.avatar_url,
                    "member_count": group.member_count,
                    "unread_count": unread_count,
                    "last_message_preview": last_message.content[:50] + "..." if last_message and last_message.content and len(last_message.content) > 50 else (last_message.content if last_message else None),
                    "last_message_at": group.last_message_at.isoformat() if group.last_message_at else None
                })
        
        # Sort by most recent activity
        chat_summary.sort(key=lambda x: x.get('last_message_at') or '', reverse=True)
        
        return {
            "success": True,
            "data": chat_summary,
            "total_unread_chats": len(chat_summary),
            "message": f"Found {len(chat_summary)} chats with unread messages"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get chat summary: {str(e)}"
        )

@router.post("/mark-chat-opened", response_model=SuccessResponse)
async def mark_chat_opened(
    request: MarkChatOpenedRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark a chat as opened, resetting the unread count
    This should be called when the user opens a chat conversation
    """
    # Validate chat_type
    if request.chat_type not in ['direct', 'group']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="chat_type must be 'direct' or 'group'"
        )
    
    try:
        # Verify chat exists and user has access
        if request.chat_type == 'direct':
            conversation = db.query(Conversation).filter(Conversation.id == request.chat_id).first()
            if not conversation:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Conversation not found"
                )
            
            # Check if user is part of this conversation
            if current_user.id not in [conversation.user1_id, conversation.user2_id]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not part of this conversation"
                )
        
        elif request.chat_type == 'group':
            group = db.query(GroupChat).filter(GroupChat.id == request.chat_id).first()
            if not group:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Group not found"
                )
            
            # Check if user is a member of this group
            if not group.is_member(current_user.id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not a member of this group"
                )
        
        # Update or create chat activity record
        activity = db.query(ChatActivity).filter(
            ChatActivity.user_id == current_user.id,
            ChatActivity.chat_type == request.chat_type,
            ChatActivity.chat_id == request.chat_id
        ).first()
        
        current_time = datetime.now(timezone.utc)
        
        if activity:
            activity.last_opened_at = current_time
        else:
            activity = ChatActivity(
                user_id=current_user.id,
                chat_type=request.chat_type,
                chat_id=request.chat_id,
                last_opened_at=current_time
            )
            db.add(activity)
        
        db.commit()
        
        return SuccessResponse(
            message=f"Chat marked as opened successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark chat as opened: {str(e)}"
        )

@router.get("/unread-count")
async def get_total_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get total count of unread messages across all chats
    Useful for showing a badge with total unread count
    """
    try:
        total_unread = 0
        unread_chats = 0
        
        # Count unread direct messages
        conversations = db.query(Conversation).filter(
            or_(
                Conversation.user1_id == current_user.id,
                Conversation.user2_id == current_user.id
            )
        ).all()
        
        for conv in conversations:
            activity = db.query(ChatActivity).filter(
                ChatActivity.user_id == current_user.id,
                ChatActivity.chat_type == 'direct',
                ChatActivity.chat_id == conv.id
            ).first()
            
            last_opened = activity.last_opened_at if activity else datetime.min.replace(tzinfo=timezone.utc)
            other_user_id = conv.get_other_user_id(current_user.id)
            
            unread_count = db.query(DirectMessage).filter(
                DirectMessage.sender_id == other_user_id,
                DirectMessage.recipient_id == current_user.id,
                DirectMessage.created_at > last_opened,
                DirectMessage.is_deleted == False
            ).count()
            
            if unread_count > 0:
                total_unread += unread_count
                unread_chats += 1
        
        # Count unread group messages
        groups = db.query(GroupChat).filter(GroupChat.is_active == True).all()
        user_groups = [group for group in groups if group.is_member(current_user.id)]
        
        for group in user_groups:
            activity = db.query(ChatActivity).filter(
                ChatActivity.user_id == current_user.id,
                ChatActivity.chat_type == 'group',
                ChatActivity.chat_id == group.id
            ).first()
            
            last_opened = activity.last_opened_at if activity else datetime.min.replace(tzinfo=timezone.utc)
            
            unread_count = db.query(GroupMessage).filter(
                GroupMessage.group_id == group.id,
                GroupMessage.created_at > last_opened,
                GroupMessage.sender_id != current_user.id,
                GroupMessage.is_deleted == False
            ).count()
            
            if unread_count > 0:
                total_unread += unread_count
                unread_chats += 1
        
        return {
            "success": True,
            "data": {
                "total_unread_messages": total_unread,
                "unread_chats_count": unread_chats
            },
            "message": f"Total: {total_unread} unread messages in {unread_chats} chats"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get unread count: {str(e)}"
        ) 