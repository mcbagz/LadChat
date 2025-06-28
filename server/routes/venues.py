"""
Venue routes for LadChat Third Space Directory
Handles venue creation, management, and discovery with one venue per user limit
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Optional, Dict, Any
import math

from database import get_db
from models import User, Venue, VenueReview
from auth import get_current_user
from schemas import SuccessResponse
from utils.logging_config import log_api_request
from utils.media_storage import save_uploaded_file

router = APIRouter(prefix="/venues", tags=["venues"])

# Venue creation and management

@router.post("/", response_model=Dict[str, Any])
async def create_venue(
    name: str,
    description: str,
    venue_type: str,
    address: str,
    latitude: float,
    longitude: float,
    phone: Optional[str] = None,
    website: Optional[str] = None,
    hours: Optional[str] = None,
    price_range: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a venue (one per user limit)
    Users can only create one venue to prevent spam
    """
    # Check if user already has a venue
    existing = db.query(Venue).filter(
        Venue.creator_id == current_user.id,
        Venue.is_active == True
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can only create one venue. Update your existing venue instead."
        )
    
    # Validate venue type
    valid_types = ['bar', 'restaurant', 'cafe', 'park', 'gym', 'club', 'recreation', 'other']
    if venue_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid venue type. Must be one of: {', '.join(valid_types)}"
        )
    
    try:
        venue = Venue(
            creator_id=current_user.id,
            name=name,
            description=description,
            venue_type=venue_type,
            address=address,
            latitude=latitude,
            longitude=longitude,
            phone=phone,
            website=website,
            hours=hours,
            price_range=price_range
        )
        
        db.add(venue)
        db.commit()
        db.refresh(venue)
        
        log_api_request("POST", "/venues", current_user.id)
        
        return {
            "success": True,
            "data": venue.to_dict(),
            "message": "Venue created successfully"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create venue: {str(e)}"
        )

@router.get("/", response_model=List[Dict[str, Any]])
async def get_venues(
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    radius_miles: float = Query(10.0, ge=0.1, le=50.0),
    category: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("lad_friendly_score", regex="^(distance|rating|lad_friendly_score|hangout_count|created_at)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get venues with filtering and location-based search"""
    try:
        # Build base query
        query = db.query(Venue).filter(Venue.is_active == True)
        
        # Apply filters
        if category:
            query = query.filter(Venue.category == category)
        
        if city:
            query = query.filter(Venue.city.ilike(f"%{city}%"))
        
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Venue.name.ilike(search_pattern),
                    Venue.description.ilike(search_pattern),
                    Venue.city.ilike(search_pattern)
                )
            )
        
        # Get venues within radius if location provided
        venues = query.all()
        
        venue_results = []
        for venue in venues:
            venue_dict = venue.to_dict(include_details=False)
            
            # Calculate distance if user location provided
            if latitude and longitude and venue.latitude and venue.longitude:
                distance = _calculate_distance(latitude, longitude, venue.latitude, venue.longitude)
                if distance <= radius_miles:
                    venue_dict['distance_miles'] = round(distance, 2)
                    venue_results.append(venue_dict)
            else:
                venue_results.append(venue_dict)
        
        # Sort results
        if sort_by == "distance" and latitude and longitude:
            venue_results.sort(key=lambda x: x.get('distance_miles', float('inf')))
        elif sort_by == "rating":
            venue_results.sort(key=lambda x: x.get('rating', 0), reverse=True)
        elif sort_by == "lad_friendly_score":
            venue_results.sort(key=lambda x: x.get('lad_friendly_score', 0), reverse=True)
        elif sort_by == "hangout_count":
            venue_results.sort(key=lambda x: x.get('hangout_count', 0), reverse=True)
        elif sort_by == "created_at":
            venue_results.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        # Apply pagination
        total_count = len(venue_results)
        paginated_results = venue_results[offset:offset + limit]
        
        log_api_request("GET", "/venues", current_user.id)
        
        return {
            "success": True,
            "data": paginated_results,
            "total_count": total_count,
            "has_more": (offset + limit) < total_count,
            "message": f"Found {len(paginated_results)} venues"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{venue_id}", response_model=Dict[str, Any])
async def get_venue_details(
    venue_id: int,
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed venue information"""
    venue = db.query(Venue).filter(
        Venue.id == venue_id,
        Venue.is_active == True
    ).first()
    
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    venue_dict = venue.to_dict(include_details=True)
    
    # Add distance if user location provided
    if latitude and longitude and venue.latitude and venue.longitude:
        distance = _calculate_distance(latitude, longitude, venue.latitude, venue.longitude)
        venue_dict['distance_miles'] = round(distance, 2)
    
    # Get recent reviews
    reviews = db.query(VenueReview).filter(
        VenueReview.venue_id == venue_id,
        VenueReview.is_approved == True
    ).order_by(VenueReview.created_at.desc()).limit(5).all()
    
    venue_dict['recent_reviews'] = [review.to_dict() for review in reviews]
    
    log_api_request("GET", f"/venues/{venue_id}", current_user.id)
    
    return {
        "success": True,
        "data": venue_dict,
        "message": "Venue details retrieved"
    }

@router.put("/{venue_id}", response_model=Dict[str, Any])
async def update_venue(
    venue_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    venue_type: Optional[str] = None,
    address: Optional[str] = None,
    phone: Optional[str] = None,
    website: Optional[str] = None,
    hours: Optional[str] = None,
    price_range: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update venue (creator only)"""
    venue = db.query(Venue).filter(
        Venue.id == venue_id,
        Venue.creator_id == current_user.id
    ).first()
    
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found or you don't have permission to edit it"
        )
    
    try:
        # Update provided fields
        if name is not None:
            venue.name = name
        if description is not None:
            venue.description = description
        if venue_type is not None:
            valid_types = ['bar', 'restaurant', 'cafe', 'park', 'gym', 'club', 'recreation', 'other']
            if venue_type not in valid_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid venue type. Must be one of: {', '.join(valid_types)}"
                )
            venue.venue_type = venue_type
        if address is not None:
            venue.address = address
        if phone is not None:
            venue.phone = phone
        if website is not None:
            venue.website = website
        if hours is not None:
            venue.hours = hours
        if price_range is not None:
            venue.price_range = price_range
        
        venue.updated_at = func.now()
        db.commit()
        db.refresh(venue)
        
        return {
            "success": True,
            "data": venue.to_dict(),
            "message": "Venue updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update venue: {str(e)}"
        )

@router.delete("/{venue_id}", response_model=SuccessResponse)
async def delete_venue(
    venue_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete venue (creator only)"""
    venue = db.query(Venue).filter(
        Venue.id == venue_id,
        Venue.creator_id == current_user.id
    ).first()
    
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found or you don't have permission to delete it"
        )
    
    try:
        # Soft delete
        venue.is_active = False
        venue.updated_at = func.now()
        db.commit()
        
        return SuccessResponse(message="Venue deleted successfully")
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete venue: {str(e)}"
        )

# Venue reviews

@router.post("/{venue_id}/reviews", response_model=Dict[str, Any])
async def create_venue_review(
    venue_id: int,
    rating: int,
    lad_friendly_rating: Optional[int] = None,
    title: Optional[str] = None,
    content: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a review for a venue"""
    # Validate ratings
    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    if lad_friendly_rating and (lad_friendly_rating < 1 or lad_friendly_rating > 5):
        raise HTTPException(status_code=400, detail="Lad friendly rating must be between 1 and 5")
    
    # Check if venue exists
    venue = db.query(Venue).filter(
        Venue.id == venue_id,
        Venue.is_active == True
    ).first()
    
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    # Check if user already reviewed this venue
    existing_review = db.query(VenueReview).filter(
        VenueReview.venue_id == venue_id,
        VenueReview.user_id == current_user.id
    ).first()
    
    if existing_review:
        raise HTTPException(status_code=400, detail="You have already reviewed this venue")
    
    try:
        review = VenueReview(
            venue_id=venue_id,
            user_id=current_user.id,
            rating=rating,
            lad_friendly_rating=lad_friendly_rating,
            title=title,
            content=content
        )
        
        db.add(review)
        db.commit()
        db.refresh(review)
        
        # Update venue rating (simplified - in production you'd recalculate from all reviews)
        venue.rating = (venue.rating * venue.review_count + rating) / (venue.review_count + 1)
        venue.review_count += 1
        db.commit()
        
        return {
            "success": True,
            "data": review.to_dict(),
            "message": "Review created successfully"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{venue_id}/reviews", response_model=List[Dict[str, Any]])
async def get_venue_reviews(
    venue_id: int,
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get reviews for a venue"""
    venue = db.query(Venue).filter(
        Venue.id == venue_id,
        Venue.is_active == True
    ).first()
    
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    reviews = db.query(VenueReview).filter(
        VenueReview.venue_id == venue_id,
        VenueReview.is_approved == True
    ).order_by(VenueReview.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "success": True,
        "data": [review.to_dict() for review in reviews],
        "total_reviews": venue.review_count,
        "message": f"Found {len(reviews)} reviews"
    }

# Utility endpoints

@router.get("/my/venue", response_model=Dict[str, Any])
async def get_my_venue(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's venue if they have one"""
    venue = db.query(Venue).filter(
        Venue.creator_id == current_user.id,
        Venue.is_active == True
    ).first()
    
    if not venue:
        return {
            "success": True,
            "data": None,
            "message": "You haven't created a venue yet"
        }
    
    return {
        "success": True,
        "data": venue.to_dict(),
        "message": "Your venue details"
    }

@router.get("/categories/list")
async def get_venue_categories():
    """Get list of available venue categories"""
    return {
        "success": True,
        "data": [
            "bar",
            "restaurant", 
            "cafe",
            "park",
            "gym",
            "club",
            "recreation",
            "sports_bar",
            "brewery",
            "arcade",
            "bowling",
            "other"
        ],
        "message": "Available venue categories"
    }

@router.post("/{venue_id}/hangout-planned")
async def venue_hangout_planned(
    venue_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Notify venue that a hangout is being planned there"""
    venue = db.query(Venue).filter(
        Venue.id == venue_id,
        Venue.is_active == True
    ).first()
    
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    try:
        venue.add_hangout()
        db.commit()
        
        return {
            "success": True,
            "message": f"Hangout registered for {venue.name}"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# Helper functions

def _calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in miles using Haversine formula"""
    lat1, lng1, lat2, lng2 = map(math.radians, [lat1, lng1, lat2, lng2])
    
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    r = 3956  # Earth's radius in miles
    return c * r 