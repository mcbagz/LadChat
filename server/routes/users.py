from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models.user import User
from models.friendship import Friendship
from auth import get_current_user
from schemas import UserResponse

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{user_id}/profile", response_model=UserResponse)
async def get_user_profile(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user profile by ID. Only works if the users are friends.
    """
    # Check if the requesting user is trying to get their own profile
    if user_id == current_user.id:
        return UserResponse(
            id=current_user.id,
            username=current_user.username,
            bio=current_user.bio,
            interests=current_user.interests or [],
            profile_photo_url=current_user.profile_photo_url,
            open_to_friends=current_user.open_to_friends,
            is_verified=current_user.is_verified,
            created_at=current_user.created_at
        )
    
    # Check if users are friends
    friendship = db.query(Friendship).filter(
        ((Friendship.user1_id == current_user.id) & (Friendship.user2_id == user_id)) |
        ((Friendship.user1_id == user_id) & (Friendship.user2_id == current_user.id))
    ).first()
    
    if not friendship:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view profiles of your friends"
        )
    
    # Get the target user
    target_user = db.query(User).filter(User.id == user_id).first()
    
    if not target_user or not target_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Calculate friend since date (when friendship was created)
    friend_since = friendship.created_at
    
    # Count mutual friends
    # Get all friends of current user
    current_user_friends = db.query(Friendship).filter(
        (Friendship.user1_id == current_user.id) | (Friendship.user2_id == current_user.id)
    ).all()
    
    current_user_friend_ids = set()
    for f in current_user_friends:
        if f.user1_id == current_user.id:
            current_user_friend_ids.add(f.user2_id)
        else:
            current_user_friend_ids.add(f.user1_id)
    
    # Get all friends of target user
    target_user_friends = db.query(Friendship).filter(
        (Friendship.user1_id == user_id) | (Friendship.user2_id == user_id)
    ).all()
    
    target_user_friend_ids = set()
    for f in target_user_friends:
        if f.user1_id == user_id:
            target_user_friend_ids.add(f.user2_id)
        else:
            target_user_friend_ids.add(f.user1_id)
    
    # Count mutual friends (excluding each other)
    mutual_friends_count = len(current_user_friend_ids.intersection(target_user_friend_ids))
    
    # Count total friends for target user
    friends_count = len(target_user_friend_ids)
    
    # For now, we'll use placeholder values for stories and hangouts count
    # In a real implementation, you'd query the actual stories and hangouts tables
    stories_count = 0  # TODO: Count from stories table
    hangouts_count = 0  # TODO: Count from hangouts table
    
    return {
        "id": target_user.id,
        "username": target_user.username,
        "bio": target_user.bio,
        "interests": target_user.interests or [],
        "profile_photo_url": target_user.profile_photo_url,
        "open_to_friends": target_user.open_to_friends,
        "is_verified": target_user.is_verified,
        "created_at": target_user.created_at,
        "friend_since": friend_since.isoformat() if friend_since else None,
        "mutual_friends_count": mutual_friends_count,
        "friends_count": friends_count,
        "stories_count": stories_count,
        "hangouts_count": hangouts_count
    } 