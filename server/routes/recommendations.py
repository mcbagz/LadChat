"""
Recommendations API routes for LadChat
Provides AI-powered friend and event recommendations using RAG
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from database import get_db
from models import User, GroupChat
from auth import get_current_user
from ai.rag_engine import rag_engine
from utils.logging_config import log_api_request

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

@router.get("/friends")
async def get_friend_recommendations(
    limit: int = Query(10, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get AI-powered friend recommendations"""
    if not current_user.open_to_friends:
        return {"success": False, "message": "User not open to friends", "data": []}
    
    try:
        recommendations = await rag_engine.recommend_friends(current_user.id, limit)
        return {
            "success": True,
            "data": recommendations,
            "message": f"Found {len(recommendations)} recommendations"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/events")
async def get_event_recommendations(
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    limit: int = Query(10, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get AI-powered event recommendations (location optional for testing)"""
    try:
        # For testing: location is optional, will be used for distance calculation only
        recommendations = await rag_engine.recommend_events_to_user(
            current_user.id, latitude or 0.0, longitude or 0.0, limit
        )
        return {
            "success": True,
            "data": recommendations,
            "message": f"Found {len(recommendations)} event recommendations"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/groups/{group_id}/events")
async def get_group_event_recommendations(
    group_id: int,
    admin_latitude: Optional[float] = Query(None),
    admin_longitude: Optional[float] = Query(None),
    limit: int = Query(5, ge=1, le=10),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get event recommendations for group admins (location optional for testing)"""
    group = db.query(GroupChat).filter(GroupChat.id == group_id).first()
    if not group or not group.is_admin(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        # For testing: location is optional, will be used for distance calculation only
        recommendations = await rag_engine.recommend_events_to_group(
            group_id, admin_latitude or 0.0, admin_longitude or 0.0, limit
        )
        return {
            "success": True,
            "data": recommendations,
            "message": f"Found {len(recommendations)} events for group"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

 