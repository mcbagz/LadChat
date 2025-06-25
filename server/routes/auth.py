from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import timedelta

from database import get_db
from models.user import User
from schemas import (
    UserRegistration, UserLogin, TokenResponse, TokenRefresh,
    UserResponse, UserUpdate, PasswordChange, SuccessResponse
)
from auth import AuthManager, get_current_user
from config import settings

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserRegistration, db: Session = Depends(get_db)):
    """
    Register a new user and return JWT tokens
    """
    try:
        # Check if username or email already exists
        existing_user = db.query(User).filter(
            (User.username == user_data.username.lower()) | 
            (User.email == user_data.email)
        ).first()
        
        if existing_user:
            if existing_user.username == user_data.username.lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already registered"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
        
        # Hash the password
        hashed_password = AuthManager.get_password_hash(user_data.password)
        
        # Create new user
        new_user = User(
            username=user_data.username.lower(),
            email=user_data.email,
            hashed_password=hashed_password,
            bio=user_data.bio,
            interests=user_data.interests or []
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Create JWT tokens
        token_data = {"sub": str(new_user.id), "username": new_user.username}
        access_token = AuthManager.create_access_token(token_data)
        refresh_token = AuthManager.create_refresh_token(token_data)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already exists"
        )

@router.post("/login", response_model=TokenResponse)
async def login_user(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate user and return JWT tokens
    """
    user = AuthManager.authenticate_user(
        db, user_credentials.username, user_credentials.password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account"
        )
    
    # Update last active timestamp
    from sqlalchemy import func
    user.last_active = func.now()
    db.commit()
    
    # Create JWT tokens
    token_data = {"sub": str(user.id), "username": user.username}
    access_token = AuthManager.create_access_token(token_data)
    refresh_token = AuthManager.create_refresh_token(token_data)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(token_data: TokenRefresh, db: Session = Depends(get_db)):
    """
    Refresh JWT access token using refresh token
    """
    payload = AuthManager.verify_token(token_data.refresh_token, "refresh")
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user"
        )
    
    # Create new access token
    token_data = {"sub": str(user.id), "username": user.username}
    access_token = AuthManager.create_access_token(token_data)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=token_data.refresh_token,  # Keep the same refresh token
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current user's profile information
    """
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

@router.put("/me", response_model=UserResponse)
async def update_user_profile(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's profile
    """
    # Update only provided fields
    if update_data.bio is not None:
        current_user.bio = update_data.bio
    
    if update_data.interests is not None:
        current_user.interests = update_data.interests
    
    if update_data.open_to_friends is not None:
        current_user.open_to_friends = update_data.open_to_friends
    
    if update_data.location_radius is not None:
        current_user.location_radius = update_data.location_radius
    
    # Update timestamp
    from sqlalchemy import func
    current_user.updated_at = func.now()
    
    db.commit()
    db.refresh(current_user)
    
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

@router.post("/change-password", response_model=SuccessResponse)
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change user's password
    """
    # Verify current password
    if not AuthManager.verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
    
    # Hash new password
    new_hashed_password = AuthManager.get_password_hash(password_data.new_password)
    current_user.hashed_password = new_hashed_password
    
    # Update timestamp
    from sqlalchemy import func
    current_user.updated_at = func.now()
    
    db.commit()
    
    return SuccessResponse(message="Password changed successfully")

@router.delete("/me", response_model=SuccessResponse)
async def delete_user_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete current user's account (GDPR compliance)
    """
    # For now, we'll just deactivate the account
    # In a production environment, you might want to:
    # 1. Remove all user data
    # 2. Anonymize data that needs to be kept for business reasons
    # 3. Send confirmation email
    
    current_user.is_active = False
    current_user.email = f"deleted_{current_user.id}@deleted.local"
    current_user.username = f"deleted_{current_user.id}"
    
    db.commit()
    
    return SuccessResponse(message="Account deleted successfully")

@router.post("/logout", response_model=SuccessResponse)
async def logout_user(current_user: User = Depends(get_current_user)):
    """
    Logout user (token will be invalidated client-side)
    """
    # In a production environment, you might want to:
    # 1. Add the token to a blacklist
    # 2. Store blacklisted tokens in Redis with expiration
    # For now, we'll just return success and let the client handle token removal
    
    return SuccessResponse(message="Logged out successfully") 