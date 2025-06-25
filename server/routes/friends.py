from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from typing import List, Optional
from database import get_db
from models import User, FriendRequest, Friendship
from auth import get_current_user
from utils.api_models import BaseResponse, UserPublicResponse
from pydantic import BaseModel

router = APIRouter(prefix="/friends", tags=["friends"])

# Pydantic models
class FriendRequestCreate(BaseModel):
    recipient_id: int
    message: Optional[str] = None

class FriendRequestResponse(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    status: str
    message: Optional[str]
    created_at: str
    sender: UserPublicResponse
    recipient: UserPublicResponse

class FriendshipResponse(BaseModel):
    id: int
    friend: UserPublicResponse
    created_at: str

# Search for users
@router.get("/search")
async def search_users(
    query: str = Query(..., min_length=1, max_length=50, description="Search query"),
    limit: int = Query(20, ge=1, le=50, description="Number of results to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search for users by username
    Returns users that are open to friends and match the search query
    """
    try:
        # Search for users by username (case insensitive)
        users = db.query(User).filter(
            and_(
                User.username.ilike(f"%{query}%"),
                User.id != current_user.id,  # Exclude current user
                User.open_to_friends == True,  # Only show users open to friends
                User.is_active == True  # Only active users
            )
        ).limit(limit).all()
        
        # Convert to public format
        # DEBUG: Log search details
        print(f"🔍 FRIEND SEARCH DEBUG:")
        print(f"  Current User ID: {current_user.id}")
        print(f"  Query: '{query}'")
        print(f"  Raw users found: {len(users)}")
        for u in users:
            print(f"    - ID: {u.id}, Username: {u.username}, Open: {u.open_to_friends}, Active: {u.is_active}")
        
        user_list = []
        for user in users:
            # Check if already friends or has pending request
            existing_friendship = db.query(Friendship).filter(
                or_(
                    and_(Friendship.user1_id == current_user.id, Friendship.user2_id == user.id),
                    and_(Friendship.user1_id == user.id, Friendship.user2_id == current_user.id)
                )
            ).first()
            
            pending_request = db.query(FriendRequest).filter(
                and_(
                    or_(
                        and_(FriendRequest.sender_id == current_user.id, FriendRequest.recipient_id == user.id),
                        and_(FriendRequest.sender_id == user.id, FriendRequest.recipient_id == current_user.id)
                    ),
                    FriendRequest.status == "pending"
                )
            ).first()
            
            user_data = user.to_public_dict()
            user_data["friendship_status"] = "none"
            
            if existing_friendship:
                user_data["friendship_status"] = "friends"
            elif pending_request:
                if pending_request.sender_id == current_user.id:
                    user_data["friendship_status"] = "request_sent"
                else:
                    user_data["friendship_status"] = "request_received"
            
            user_list.append(user_data)
            print(f"    ✅ Added to results: {user.username} (status: {user_data['friendship_status']})")
        
        response_data = {
            "success": True,
            "data": user_list,
            "message": f"Found {len(user_list)} users"
        }
        
        # DEBUG: Log response
        print(f"  📤 RESPONSE: {len(user_list)} users in final result")
        print(f"  📤 Full response data: {response_data}")
        
        return response_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

# Send friend request
@router.post("/request")
async def send_friend_request(
    request_data: FriendRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a friend request to another user
    """
    try:
        # Check if recipient exists and is open to friends
        recipient = db.query(User).filter(
            and_(
                User.id == request_data.recipient_id,
                User.is_active == True,
                User.open_to_friends == True
            )
        ).first()
        
        if not recipient:
            raise HTTPException(status_code=404, detail="User not found or not accepting friend requests")
        
        if recipient.id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")
        
        # Check if already friends
        existing_friendship = db.query(Friendship).filter(
            or_(
                and_(Friendship.user1_id == current_user.id, Friendship.user2_id == recipient.id),
                and_(Friendship.user1_id == recipient.id, Friendship.user2_id == current_user.id)
            )
        ).first()
        
        if existing_friendship:
            raise HTTPException(status_code=400, detail="Already friends with this user")
        
        # Check for existing pending request
        existing_request = db.query(FriendRequest).filter(
            and_(
                or_(
                    and_(FriendRequest.sender_id == current_user.id, FriendRequest.recipient_id == recipient.id),
                    and_(FriendRequest.sender_id == recipient.id, FriendRequest.recipient_id == current_user.id)
                ),
                FriendRequest.status == "pending"
            )
        ).first()
        
        if existing_request:
            raise HTTPException(status_code=400, detail="Friend request already pending")
        
        # Create friend request
        friend_request = FriendRequest(
            sender_id=current_user.id,
            recipient_id=recipient.id,
            message=request_data.message,
            status="pending"
        )
        
        db.add(friend_request)
        db.commit()
        db.refresh(friend_request)
        
        return {
            "success": True,
            "data": {
                "id": friend_request.id,
                "recipient_username": recipient.username,
                "status": "pending"
            },
            "message": "Friend request sent successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to send friend request: {str(e)}")

# Get friend requests (received)
@router.get("/requests")
async def get_friend_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all pending friend requests received by the current user
    """
    try:
        # Use join to eagerly load the sender information
        requests = db.query(FriendRequest).join(
            User, FriendRequest.sender_id == User.id
        ).filter(
            and_(
                FriendRequest.recipient_id == current_user.id,
                FriendRequest.status == "pending"
            )
        ).all()
        
        # DEBUG: Log requests found
        print(f"🔍 FRIEND REQUESTS DEBUG:")
        print(f"  Current User ID: {current_user.id}")
        print(f"  Raw requests found: {len(requests)}")
        for req in requests:
            print(f"    - Request ID: {req.id}, From: {req.sender_id}, Status: {req.status}")
        
        request_list = []
        for req in requests:
            sender = db.query(User).filter(User.id == req.sender_id).first()
            if sender:
                request_list.append({
                    "id": req.id,
                    "sender_id": req.sender_id,
                    "sender": sender.to_public_dict(),
                    "message": req.message,
                    "created_at": req.created_at.isoformat()
                })
                print(f"    ✅ Added request from: {sender.username}")
        
        print(f"  📤 RESPONSE: {len(request_list)} requests in final result")
        
        return {
            "success": True,
            "data": request_list,
            "message": f"Found {len(request_list)} pending requests"
        }
        
    except Exception as e:
        print(f"❌ FRIEND REQUESTS ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get friend requests: {str(e)}")

# Accept/decline friend request
@router.post("/requests/{request_id}/respond")
async def respond_to_friend_request(
    request_id: int,
    action: str = Query(..., regex="^(accept|decline)$", description="Action to take"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Accept or decline a friend request
    """
    try:
        # Get the friend request
        friend_request = db.query(FriendRequest).filter(
            and_(
                FriendRequest.id == request_id,
                FriendRequest.recipient_id == current_user.id,
                FriendRequest.status == "pending"
            )
        ).first()
        
        if not friend_request:
            raise HTTPException(status_code=404, detail="Friend request not found")
        
        if action == "accept":
            # Create friendship
            friendship = Friendship(
                user1_id=min(current_user.id, friend_request.sender_id),
                user2_id=max(current_user.id, friend_request.sender_id)
            )
            db.add(friendship)
            
            # Update request status
            friend_request.status = "accepted"
            
            db.commit()
            
            return {
                "success": True,
                "data": {
                    "friendship_id": friendship.id,
                    "friend_username": friend_request.sender.username
                },
                "message": "Friend request accepted"
            }
        
        else:  # decline
            friend_request.status = "declined"
            db.commit()
            
            return {
                "success": True,
                "message": "Friend request declined"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to respond to friend request: {str(e)}")

# Get friends list
@router.get("/list")
async def get_friends_list(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the current user's friends list
    """
    try:
        friendships = db.query(Friendship).filter(
            or_(
                Friendship.user1_id == current_user.id,
                Friendship.user2_id == current_user.id
            )
        ).all()
        
        friends_list = []
        for friendship in friendships:
            # Get the friend (the other user)
            friend_id = friendship.user2_id if friendship.user1_id == current_user.id else friendship.user1_id
            friend = db.query(User).filter(User.id == friend_id).first()
            
            if friend and friend.is_active:
                friends_list.append({
                    "friendship_id": friendship.id,
                    "friend": friend.to_public_dict(),
                    "created_at": friendship.created_at.isoformat()
                })
        
        return {
            "success": True,
            "data": friends_list,
            "message": f"Found {len(friends_list)} friends"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get friends list: {str(e)}")

# Remove friend
@router.delete("/remove/{friend_id}")
async def remove_friend(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove a friend (delete the friendship)
    """
    try:
        friendship = db.query(Friendship).filter(
            or_(
                and_(Friendship.user1_id == current_user.id, Friendship.user2_id == friend_id),
                and_(Friendship.user1_id == friend_id, Friendship.user2_id == current_user.id)
            )
        ).first()
        
        if not friendship:
            raise HTTPException(status_code=404, detail="Friendship not found")
        
        db.delete(friendship)
        db.commit()
        
        return {
            "success": True,
            "message": "Friend removed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to remove friend: {str(e)}") 