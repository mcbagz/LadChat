from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
import logging

from database import get_db
from models import User, GroupChat, GroupMessage
from schemas import (
    GroupMessageCreate, GroupMessageResponse, MessageReadUpdate, 
    MediaViewUpdate, SuccessResponse, GroupChatCreate, GroupChatUpdate,
    GroupChatResponse, GroupMemberAdd, GroupMemberUpdate, GroupMemberResponse,
    GroupListResponse, UserResponse
)
from auth import get_current_user
from utils.error_handlers import raise_not_found, raise_forbidden, raise_bad_request
from utils.media_storage import save_uploaded_file, media_storage
from utils.logging_config import log_api_request, log_database_operation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/groups", tags=["groups"])

# Group Management Endpoints

@router.post("", response_model=GroupChatResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_data: GroupChatCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new group chat"""
    
    # Validate initial members exist and are friends
    if group_data.initial_member_ids:
        # Check if users exist
        members = db.query(User).filter(User.id.in_(group_data.initial_member_ids)).all()
        if len(members) != len(group_data.initial_member_ids):
            raise_bad_request("One or more specified users not found")
        
        # TODO: Add friendship validation when friendship system is ready
        # For now, allow adding any valid user
    
    # Create group
    group = GroupChat(
        creator_id=current_user.id,
        name=group_data.name,
        description=group_data.description,
        visibility=group_data.visibility,
        max_members=group_data.max_members,
        members=[current_user.id],  # Creator is always a member
        admins=[current_user.id],   # Creator is always an admin
        member_count=1
    )
    
    # Add initial members
    if group_data.initial_member_ids:
        for member_id in group_data.initial_member_ids:
            if member_id != current_user.id:  # Don't add creator twice
                group.add_member(member_id)
    
    db.add(group)
    db.commit()
    db.refresh(group)
    
    # Create system messages for member additions
    if group_data.initial_member_ids:
        for member_id in group_data.initial_member_ids:
            if member_id != current_user.id:
                system_message = GroupMessage(
                    group_id=group.id,
                    sender_id=member_id,
                    message_type="system",
                    system_action="added"
                )
                db.add(system_message)
    
    db.commit()
    
    log_database_operation("create", "group_chats", group.id, current_user.id)
    log_api_request("POST", "/groups", current_user.id)
    
    return _format_group_response(group, current_user.id)

@router.get("", response_model=GroupListResponse)
async def get_user_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all groups the current user is a member of"""
    
    # Get all groups where user is a member
    # For JSON arrays, we need to check if the user_id is IN the members array
    groups = db.query(GroupChat).filter(
        GroupChat.is_active == True
    ).all()
    
    # Filter groups where user is a member (in-memory filtering since JSON queries are DB-specific)
    user_groups = []
    for group in groups:
        if group.is_member(current_user.id):
            user_groups.append(group)
    
    # Sort by last message time
    user_groups.sort(key=lambda g: g.last_message_at or g.created_at, reverse=True)
    
    # Format response
    group_responses = []
    for group in user_groups:
        group_responses.append(_format_group_response(group, current_user.id))
    
    log_api_request("GET", "/groups", current_user.id)
    
    return GroupListResponse(
        groups=group_responses,
        total_count=len(group_responses)
    )

@router.get("/{group_id}/members", response_model=List[GroupMemberResponse])
async def get_group_members(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all members of a group"""
    
    # Validate group and membership
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group:
        raise_not_found("Group", group_id)
    
    if not group.is_member(current_user.id):
        raise_forbidden("You are not a member of this group")
    
    # Get member details
    member_users = db.query(User).filter(User.id.in_(group.members or [])).all()
    
    # Format response
    members_response = []
    for user in member_users:
        members_response.append(GroupMemberResponse(
            user_id=user.id,
            user=UserResponse.from_orm(user),
            is_admin=group.is_admin(user.id),
            joined_at=group.created_at  # TODO: Track individual join dates
        ))
    
    log_api_request("GET", f"/groups/{group_id}/members", current_user.id)
    return members_response

@router.post("/{group_id}/members", response_model=SuccessResponse)
async def add_group_members(
    group_id: int,
    member_data: GroupMemberAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add members to a group"""
    
    # Validate group and admin permissions
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group:
        raise_not_found("Group", group_id)
    
    if not group.is_member(current_user.id):
        raise_forbidden("You are not a member of this group")
    
    if not group.is_admin(current_user.id):
        raise_forbidden("Only admins can add members")
    
    # Check if group can accommodate new members
    if group.member_count + len(member_data.user_ids) > group.max_members:
        raise_bad_request("Adding these members would exceed group capacity")
    
    # Validate users exist
    users = db.query(User).filter(User.id.in_(member_data.user_ids)).all()
    if len(users) != len(member_data.user_ids):
        raise_bad_request("One or more specified users not found")
    
    # Add members
    added_count = 0
    for user_id in member_data.user_ids:
        if not group.is_member(user_id):
            group.add_member(user_id, member_data.make_admin)
            added_count += 1
            
            # Create system message
            system_message = GroupMessage(
                group_id=group_id,
                sender_id=user_id,
                message_type="system",
                system_action="added"
            )
            db.add(system_message)
    
    db.commit()
    
    log_database_operation("add_members", "group_chats", group_id, current_user.id)
    
    return SuccessResponse(message=f"Added {added_count} members to the group")

@router.delete("/{group_id}/members/{user_id}", response_model=SuccessResponse)
async def remove_group_member(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a member from a group"""
    
    # Validate group
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group:
        raise_not_found("Group", group_id)
    
    if not group.is_member(current_user.id):
        raise_forbidden("You are not a member of this group")
    
    # Check permissions - admin can remove anyone, users can remove themselves
    if user_id != current_user.id and not group.is_admin(current_user.id):
        raise_forbidden("Only admins can remove other members")
    
    # Cannot remove the creator
    if user_id == group.creator_id:
        raise_bad_request("Cannot remove the group creator")
    
    # Check if user is a member
    if not group.is_member(user_id):
        raise_bad_request("User is not a member of this group")
    
    # Remove member
    group.remove_member(user_id)
    db.commit()
    
    # Create system message
    action = "left" if user_id == current_user.id else "removed"
    system_message = GroupMessage(
        group_id=group_id,
        sender_id=user_id,
        message_type="system",
        system_action=action
    )
    db.add(system_message)
    db.commit()
    
    log_database_operation("remove_member", "group_chats", group_id, current_user.id)
    
    return SuccessResponse(message="Member removed successfully")

@router.put("/{group_id}/members/{user_id}", response_model=SuccessResponse)
async def update_group_member(
    group_id: int,
    user_id: int,
    member_update: GroupMemberUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update group member permissions (promote/demote admin)"""
    
    # Validate group and admin permissions
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group:
        raise_not_found("Group", group_id)
    
    if not group.is_member(current_user.id):
        raise_forbidden("You are not a member of this group")
    
    if not group.is_admin(current_user.id):
        raise_forbidden("Only admins can change member permissions")
    
    # Cannot change creator's admin status
    if user_id == group.creator_id:
        raise_bad_request("Cannot change creator's admin status")
    
    # Check if user is a member
    if not group.is_member(user_id):
        raise_bad_request("User is not a member of this group")
    
    # Update admin status
    if member_update.is_admin and not group.is_admin(user_id):
        # Promote to admin
        if not group.admins:
            group.admins = []
        group.admins.append(user_id)
        action = "promoted"
    elif not member_update.is_admin and group.is_admin(user_id):
        # Demote from admin
        group.admins.remove(user_id)
        action = "demoted"
    else:
        # No change needed
        return SuccessResponse(message="No changes made")
    
    db.commit()
    
    # Create system message
    system_message = GroupMessage(
        group_id=group_id,
        sender_id=user_id,
        message_type="system",
        system_action=action
    )
    db.add(system_message)
    db.commit()
    
    return SuccessResponse(message=f"Member {action} successfully")

@router.put("/{group_id}", response_model=GroupChatResponse)
async def update_group(
    group_id: int,
    group_update: GroupChatUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update group settings"""
    
    # Validate group and admin permissions
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group:
        raise_not_found("Group", group_id)
    
    if not group.is_member(current_user.id):
        raise_forbidden("You are not a member of this group")
    
    if not group.is_admin(current_user.id):
        raise_forbidden("Only admins can update group settings")
    
    # Update fields
    if group_update.name is not None:
        group.name = group_update.name
    if group_update.description is not None:
        group.description = group_update.description
    if group_update.visibility is not None:
        group.visibility = group_update.visibility
    if group_update.max_members is not None:
        if group_update.max_members < group.member_count:
            raise_bad_request("Max members cannot be less than current member count")
        group.max_members = group_update.max_members
    if group_update.auto_suggest_members is not None:
        group.auto_suggest_members = group_update.auto_suggest_members
    if group_update.auto_suggest_events is not None:
        group.auto_suggest_events = group_update.auto_suggest_events
    if group_update.join_approval_required is not None:
        group.join_approval_required = group_update.join_approval_required
    
    db.commit()
    db.refresh(group)
    
    log_database_operation("update", "group_chats", group_id, current_user.id)
    
    return _format_group_response(group, current_user.id)

# Group Messaging Endpoints (existing code starts here)

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
    
    # Load sender relationship for response
    db.refresh(message, ['sender'])
    
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
    
    # Load sender relationship for response
    db.refresh(message, ['sender'])
    
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
    
    # Get messages with sender information
    messages = query.join(GroupMessage.sender).order_by(desc(GroupMessage.created_at)).limit(limit).all()
    
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
    # Build complete response with all required fields
    data = {
        "id": message.id,
        "group_id": message.group_id,
        "sender_id": message.sender_id,
        "sender": {
            "id": message.sender.id,
            "username": message.sender.username,
            "profile_photo_url": message.sender.profile_photo_url,
            "is_verified": message.sender.is_verified
        },
        "message_type": message.message_type,
        "created_at": message.created_at,
        "expires_at": message.expires_at,
        "read_count": message.get_read_count(),
        "view_count": message.get_view_count() if message.message_type == "media" else 0,
        "is_read_by_user": message.is_read_by_user(user_id),
        "system_action": message.system_action,
        "content": None,
        "media_url": None,
        "media_type": None,
        "view_duration": None
    }
    
    # Add content based on message type
    if message.message_type == "text":
        data["content"] = message.content
    elif message.message_type == "media":
        if message.can_view(user_id):
            data.update({
                "media_url": media_storage.get_media_url(message.media_url) if message.media_url else None,
                "media_type": message.media_type,
                "view_duration": message.view_duration,
                "content": message.content  # Caption for media
            })
    elif message.message_type == "system":
        # Generate descriptive content for system messages
        if message.system_action == "added":
            data["content"] = "Member was added to the group"
        elif message.system_action == "left":
            data["content"] = "Member left the group" 
        elif message.system_action == "removed":
            data["content"] = "Member was removed from the group"
        elif message.system_action == "promoted":
            data["content"] = "Member was promoted to admin"
        elif message.system_action == "demoted":
            data["content"] = "Member was demoted from admin"
        else:
            data["content"] = f"System action: {message.system_action}"
    
    return data

def _format_group_response(group: GroupChat, user_id: int) -> GroupChatResponse:
    """Format group chat for API response"""
    return GroupChatResponse(
        id=group.id,
        creator_id=group.creator_id,
        name=group.name,
        description=group.description,
        avatar_url=group.avatar_url,
        member_count=group.member_count,
        max_members=group.max_members,
        group_interests=group.group_interests or [],
        visibility=group.visibility,
        join_approval_required=group.join_approval_required,
        auto_suggest_members=group.auto_suggest_members,
        auto_suggest_events=group.auto_suggest_events,
        last_message_at=group.last_message_at,
        message_count=group.message_count,
        created_at=group.created_at,
        is_active=group.is_active,
        user_is_member=group.is_member(user_id),
        user_is_admin=group.is_admin(user_id)
    ) 