from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Text, Float
from sqlalchemy.sql import func
from database import Base

class Venue(Base):
    """
    Venue model for the third-space directory
    """
    __tablename__ = "venues"

    id = Column(Integer, primary_key=True, index=True)
    
    # Basic information
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False, index=True)  # 'bar', 'cafe', 'park', 'gym', etc.
    
    # Location
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=False, index=True)
    state = Column(String(50), nullable=True)
    country = Column(String(50), default="US")
    latitude = Column(Float, nullable=True, index=True)
    longitude = Column(Float, nullable=True, index=True)
    geohash = Column(String(20), nullable=True, index=True)
    
    # Contact and details
    phone = Column(String(20), nullable=True)
    website = Column(String(500), nullable=True)
    hours = Column(JSON, nullable=True)  # Operating hours {day: {open, close}}
    
    # Media
    photos = Column(JSON, nullable=True)  # Array of photo URLs
    main_photo = Column(String(500), nullable=True)
    
    # Features and amenities
    features = Column(JSON, nullable=True)  # Array of feature strings
    price_range = Column(String(10), nullable=True)  # '$', '$$', '$$$', '$$$$'
    
    # Ratings and reviews
    rating = Column(Float, default=0.0)
    review_count = Column(Integer, default=0)
    
    # Lad-specific attributes
    lad_friendly_score = Column(Float, default=0.0)  # 0-10 scale
    lad_verified = Column(Boolean, default=False)  # Manually verified as lad-friendly
    
    # Sponsorship and promotion
    is_sponsored = Column(Boolean, default=False)
    sponsor_tier = Column(String(20), nullable=True)  # 'basic', 'premium', 'featured'
    sponsor_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Activity tracking
    hangout_count = Column(Integer, default=0)  # Number of hangouts hosted here
    last_hangout_at = Column(DateTime(timezone=True), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)  # Verified by LadChat team
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    added_by = Column(Integer, nullable=True)  # User ID who added this venue (for user submissions)

    def __repr__(self):
        return f"<Venue(id={self.id}, name='{self.name}', category='{self.category}')>"

    def to_dict(self, include_details=True):
        """Convert venue to dictionary"""
        data = {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "city": self.city,
            "state": self.state,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "rating": self.rating,
            "review_count": self.review_count,
            "lad_friendly_score": self.lad_friendly_score,
            "lad_verified": self.lad_verified,
            "price_range": self.price_range,
            "main_photo": self.main_photo,
            "is_sponsored": self.is_sponsored,
            "sponsor_tier": self.sponsor_tier,
            "hangout_count": self.hangout_count,
            "is_verified": self.is_verified,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
        
        if include_details:
            data.update({
                "description": self.description,
                "address": self.address,
                "phone": self.phone,
                "website": self.website,
                "hours": self.hours or {},
                "photos": self.photos or [],
                "features": self.features or [],
                "last_hangout_at": self.last_hangout_at.isoformat() if self.last_hangout_at else None
            })
        
        return data

    def to_public_dict(self):
        """Convert venue to public dictionary (minimal info for listings)"""
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "city": self.city,
            "rating": self.rating,
            "review_count": self.review_count,
            "lad_friendly_score": self.lad_friendly_score,
            "price_range": self.price_range,
            "main_photo": self.main_photo,
            "is_sponsored": self.is_sponsored,
            "sponsor_tier": self.sponsor_tier,
            "distance": None  # Will be calculated in API
        }

    def calculate_lad_score(self, features_list: list = None):
        """Calculate lad-friendly score based on features"""
        if not features_list:
            features_list = self.features or []
        
        # Scoring criteria for lad-friendly venues
        score_map = {
            'sports_tv': 2.0,
            'pool_table': 1.5,
            'outdoor_seating': 1.0,
            'happy_hour': 1.5,
            'craft_beer': 1.0,
            'live_music': 1.0,
            'games': 1.5,
            'group_friendly': 2.0,
            'casual_atmosphere': 1.0,
            'late_night': 0.5,
            'parking': 0.5
        }
        
        base_score = 5.0  # Start with neutral score
        feature_bonus = sum(score_map.get(feature.lower(), 0) for feature in features_list)
        
        # Cap at 10.0
        self.lad_friendly_score = min(10.0, base_score + feature_bonus)
        return self.lad_friendly_score

    def add_hangout(self):
        """Increment hangout count and update last hangout time"""
        self.hangout_count += 1
        self.last_hangout_at = func.now()

    def is_sponsor_active(self):
        """Check if sponsorship is currently active"""
        if not self.is_sponsored:
            return False
        
        if self.sponsor_expires_at:
            from datetime import datetime
            return datetime.utcnow() < self.sponsor_expires_at
        
        return True

class VenueReview(Base):
    """
    Reviews for venues (separate table for scalability)
    """
    __tablename__ = "venue_reviews"

    id = Column(Integer, primary_key=True, index=True)
    venue_id = Column(Integer, nullable=False, index=True)  # Foreign key to venues
    user_id = Column(Integer, nullable=False, index=True)   # Foreign key to users
    
    # Review content
    rating = Column(Integer, nullable=False)  # 1-5 stars
    title = Column(String(200), nullable=True)
    content = Column(Text, nullable=True)
    
    # Lad-specific ratings
    lad_friendly_rating = Column(Integer, nullable=True)  # 1-5 stars for lad-friendliness
    
    # Photos
    photos = Column(JSON, nullable=True)  # Array of photo URLs
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_verified = Column(Boolean, default=False)  # Verified review
    
    # Moderation
    is_flagged = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=True)

    def __repr__(self):
        return f"<VenueReview(id={self.id}, venue_id={self.venue_id}, rating={self.rating})>"

    def to_dict(self):
        """Convert review to dictionary"""
        return {
            "id": self.id,
            "venue_id": self.venue_id,
            "user_id": self.user_id,
            "rating": self.rating,
            "title": self.title,
            "content": self.content,
            "lad_friendly_rating": self.lad_friendly_rating,
            "photos": self.photos or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "is_verified": self.is_verified
        } 