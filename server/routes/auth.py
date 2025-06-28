from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import timedelta
import os
import uuid
from pathlib import Path

from database import get_db
from models.user import User
from models.embeddings import UserEmbedding
from schemas import (
    UserRegistration, UserLogin, TokenResponse, TokenRefresh,
    UserResponse, UserUpdate, PasswordChange, SuccessResponse
)
from auth import AuthManager, get_current_user
from config import settings
from ai.embedding_service import embedding_service
from ai.chroma_client import chroma_client
import logging

logger = logging.getLogger(__name__)

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
        
        # Create user embedding immediately for testing
        try:
            profile_embedding = await embedding_service.generate_user_profile_embedding(new_user)
            if profile_embedding:
                # Store in database
                user_embedding = UserEmbedding(
                    user_id=new_user.id,
                    profile_embedding=profile_embedding,
                    message_embedding=None  # Not using message embeddings for testing
                )
                db.add(user_embedding)
                db.commit()
                
                # Store in ChromaDB with single embedding
                chroma_client.add_user_embedding(
                    new_user.id, 
                    profile_embedding, 
                    [],  # Empty message embedding for testing
                    metadata={
                        "username": new_user.username
                    }
                )
                logger.info(f"Created embedding for new user {new_user.id}")
            else:
                logger.warning(f"Failed to create embedding for new user {new_user.id}")
        except Exception as e:
            logger.error(f"Error creating embedding for new user {new_user.id}: {e}")
            # Don't fail registration if embedding creation fails
        
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
    # Track if profile data changed to update embeddings
    profile_changed = False
    
    # Update only provided fields
    if update_data.bio is not None:
        current_user.bio = update_data.bio
        profile_changed = True
    
    if update_data.interests is not None:
        current_user.interests = update_data.interests
        profile_changed = True
    
    if update_data.open_to_friends is not None:
        current_user.open_to_friends = update_data.open_to_friends
    
    if update_data.location_radius is not None:
        current_user.location_radius = update_data.location_radius
    
    if hasattr(update_data, 'profile_photo_url') and update_data.profile_photo_url is not None:
        current_user.profile_photo_url = update_data.profile_photo_url
    
    # Update timestamp
    from sqlalchemy import func
    current_user.updated_at = func.now()
    
    db.commit()
    db.refresh(current_user)
    
    # Update embeddings immediately if profile data changed
    if profile_changed:
        try:
            profile_embedding = await embedding_service.generate_user_profile_embedding(current_user)
            if profile_embedding:
                # Update database
                user_embedding = db.query(UserEmbedding).filter(UserEmbedding.user_id == current_user.id).first()
                if user_embedding:
                    user_embedding.profile_embedding = profile_embedding
                    user_embedding.last_updated = func.now()
                else:
                    user_embedding = UserEmbedding(
                        user_id=current_user.id,
                        profile_embedding=profile_embedding,
                        message_embedding=None
                    )
                    db.add(user_embedding)
                db.commit()
                
                # Update ChromaDB
                chroma_client.add_user_embedding(
                    current_user.id,
                    profile_embedding,
                    [],  # Empty message embedding for testing
                    metadata={
                        "username": current_user.username
                    }
                )
                logger.info(f"Updated embedding for user {current_user.id}")
            else:
                logger.warning(f"Failed to update embedding for user {current_user.id}")
        except Exception as e:
            logger.error(f"Error updating embedding for user {current_user.id}: {e}")
            # Don't fail profile update if embedding update fails
    
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

@router.post("/profile-picture")
async def upload_profile_picture(
    media_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload profile picture for current user
    """
    # Validate file type
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png']
    if media_file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG and PNG images are allowed"
        )
    
    # Validate file size (max 5MB)
    max_size = 5 * 1024 * 1024  # 5MB
    media_file.file.seek(0, 2)  # Seek to end
    file_size = media_file.file.tell()
    media_file.file.seek(0)  # Seek back to beginning
    
    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size too large. Maximum 5MB allowed"
        )
    
    try:
        # Create media directory if it doesn't exist
        media_dir = Path("media/profile_pictures")
        media_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        file_extension = Path(media_file.filename).suffix.lower()
        if not file_extension:
            file_extension = '.jpg'
        
        unique_filename = f"{current_user.id}_{uuid.uuid4().hex}{file_extension}"
        file_path = media_dir / unique_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            content = await media_file.read()
            buffer.write(content)
        
        # Update user's profile photo URL
        profile_photo_url = f"/media/profile_pictures/{unique_filename}"
        current_user.profile_photo_url = profile_photo_url
        
        # Update timestamp
        from sqlalchemy import func
        current_user.updated_at = func.now()
        
        db.commit()
        db.refresh(current_user)
        
        return {
            "success": True,
            "message": "Profile picture uploaded successfully",
            "profile_photo_url": profile_photo_url
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload profile picture: {str(e)}"
        ) 