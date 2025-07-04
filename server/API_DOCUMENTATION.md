# LadChat API Documentation

## Base URL
```
http://localhost:8000
```

## Authentication
Most endpoints require JWT authentication in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

---

## 🔐 Authentication Endpoints

### Register User
**POST** `/auth/register`

**Request Body:**
```json
{
    "username": "string",
    "email": "string", 
    "password": "string",
    "bio": "string (optional)",
    "interests": ["string"] // optional array
}
```

**Response:**
```json
{
    "access_token": "jwt_token_here",
    "refresh_token": "refresh_token_here",
    "expires_in": 86400
}
```

### Login
**POST** `/auth/login`

**Request Body:**
```json
{
    "username": "string", // or email
    "password": "string"
}
```

**Response:**
```json
{
    "access_token": "jwt_token_here",
    "refresh_token": "refresh_token_here",
    "expires_in": 86400
}
```

### Refresh Token
**POST** `/auth/refresh`

**Request Body:**
```json
{
    "refresh_token": "string"
}
```

### Get Current User Profile
**GET** `/auth/me` (requires auth)

**Response:**
```json
{
    "id": 1,
    "username": "johndoe",
    "bio": "Hey there!",
    "interests": ["soccer", "gaming"],
    "profile_photo_url": "string",
    "open_to_friends": true,
    "is_verified": false,
    "created_at": "2023-01-01T00:00:00Z"
}
```

### Update Current User Profile
**PUT** `/auth/me` (requires auth)

**Request Body:**
```json
{
    "bio": "string (optional)",
    "interests": ["string"], // optional
    "open_to_friends": true, // optional
    "location_radius": 5 // optional
}
```

### Change Password
**POST** `/auth/change-password` (requires auth)

**Request Body:**
```json
{
    "current_password": "string",
    "new_password": "string"
}
```

### Upload Profile Picture
**POST** `/auth/profile-picture` (requires auth)

**Request Body (multipart/form-data):**
- `media_file`: file (required, JPEG/PNG, max 5MB)

### Delete Account
**DELETE** `/auth/me` (requires auth)

### Logout
**POST** `/auth/logout` (requires auth)

---

## 🤖 AI Recommendations

### Get Friend Recommendations
**GET** `/recommendations/friends` (requires auth)

**Query Parameters:**
- `limit`: integer (1-20, default: 10) - Number of recommendations

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "user_id": 3,
            "username": "mike_jones",
            "bio": "Love soccer and gaming",
            "interests": ["soccer", "gaming"],
            "profile_photo_url": "string",
            "similarity_score": 0.85,
            "mutual_friends_count": 2,
            "reason": "You both love soccer and gaming"
        }
    ],
    "message": "Found 5 friend recommendations"
}
```

### Get Event Recommendations
**GET** `/recommendations/events` (requires auth)

**Query Parameters:**
- `latitude`: float (required) - User's current latitude
- `longitude`: float (required) - User's current longitude   
- `limit`: integer (1-20, default: 10) - Number of recommendations

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "event_id": 5,
            "title": "Soccer Pickup Game",
            "description": "Casual game at the park",
            "location_name": "Central Park",
            "start_time": "2023-12-01T18:00:00Z",
            "end_time": "2023-12-01T20:00:00Z",
            "attendee_count": 8,
            "distance_miles": 2.3,
            "similarity_score": 0.78,
            "can_rsvp": true,
            "reason": "Popular event with 8 people attending"
        }
    ],
    "message": "Found 3 event recommendations within 5 miles"
}
```

### Get Group Event Recommendations (Admin Only)
**GET** `/recommendations/groups/{group_id}/events` (requires auth, admin only)

**Query Parameters:**
- `admin_latitude`: float (required)
- `admin_longitude`: float (required)
- `limit`: integer (1-10, default: 5)

---

## 🔔 Notifications

### Get Chat Summary (Unread Messages)
**GET** `/notifications/chat-summary` (requires auth)

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "chat_type": "direct",
            "chat_id": 1,
            "other_user": {
                "id": 2,
                "username": "jane_doe",
                "profile_photo_url": "string"
            },
            "unread_count": 3,
            "last_message_preview": "Hey, are you coming to the game?",
            "last_message_at": "2023-12-01T15:30:00Z"
        },
        {
            "chat_type": "group",
            "chat_id": 5,
            "group_name": "Soccer Squad",
            "group_avatar_url": "string",
            "member_count": 12,
            "unread_count": 7,
            "last_message_preview": "Game starts in 30 minutes!",
            "last_message_at": "2023-12-01T16:00:00Z"
        }
    ],
    "total_unread_chats": 2,
    "message": "Found 2 chats with unread messages"
}
```

### Mark Chat as Opened
**POST** `/notifications/mark-chat-opened` (requires auth)

**Request Body:**
```json
{
    "chat_type": "direct", // or "group"
    "chat_id": 1
}
```

### Get Total Unread Count
**GET** `/notifications/unread-count` (requires auth)

**Response:**
```json
{
    "success": true,
    "data": {
        "total_unread_messages": 10,
        "unread_chats_count": 3
    },
    "message": "Total: 10 unread messages in 3 chats"
}
```

---

## 🏢 Venues (Third Space Directory)

### Search Venues
**GET** `/venues` (requires auth)

**Query Parameters:**
- `latitude`: float (optional) - For distance calculation
- `longitude`: float (optional) - For distance calculation
- `radius_miles`: float (0.1-50.0, default: 10.0) - Search radius
- `category`: string (optional) - Filter by venue type
- `city`: string (optional) - Filter by city
- `search`: string (optional) - Search in name/description
- `limit`: integer (1-50, default: 20)
- `offset`: integer (default: 0) - For pagination
- `sort_by`: string (distance|rating|lad_friendly_score|hangout_count|created_at)

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "name": "The Lad Tavern",
            "category": "bar",
            "city": "New York",
            "rating": 4.2,
            "review_count": 28,
            "lad_friendly_score": 8.5,
            "price_range": "$$",
            "main_photo": "string",
            "distance_miles": 2.1,
            "hangout_count": 15,
            "is_verified": true
        }
    ],
    "total_count": 25,
    "has_more": true,
    "message": "Found 20 venues"
}
```

### Create Venue
**POST** `/venues` (requires auth)

### Get Venue Details
**GET** `/venues/{venue_id}` (requires auth)

**Query Parameters:**
- `latitude`: float (optional)
- `longitude`: float (optional)

### Update Venue
**PUT** `/venues/{venue_id}` (requires auth)

### Delete Venue
**DELETE** `/venues/{venue_id}` (requires auth)

### Get My Venue
**GET** `/venues/my/venue` (requires auth)

### Get Venue Categories
**GET** `/venues/categories/list`

**Response:**
```json
{
    "success": true,
    "data": [
        "bar", "restaurant", "cafe", "park", "gym", 
        "club", "recreation", "sports_bar", "brewery", 
        "arcade", "bowling", "other"
    ],
    "message": "Available venue categories"
}
```

### Create Venue Review
**POST** `/venues/{venue_id}/reviews` (requires auth)

**Request Body:**
```json
{
    "rating": 5, // 1-5 stars (required)
    "lad_friendly_rating": 4, // 1-5 stars (optional)
    "title": "Great place!", // optional
    "content": "Awesome atmosphere for watching games" // optional
}
```

### Get Venue Reviews
**GET** `/venues/{venue_id}/reviews` (requires auth)

**Query Parameters:**
- `limit`: integer (1-50, default: 20)
- `offset`: integer (default: 0)

### Report Hangout at Venue
**POST** `/venues/{venue_id}/hangout-planned` (requires auth)

---

## 👤 User Endpoints

### Get User Profile by ID
**GET** `/users/{user_id}/profile` (requires auth)

**Response:** Returns detailed user profile with friendship info, mutual friends count, etc.

---

## 👥 Friends Endpoints

### Search Users
**GET** `/friends/search` (requires auth)

### Send Friend Request
**POST** `/friends/request` (requires auth)

**Request Body:**
```json
{
    "recipient_id": 2,
    "message": "Hey, let's be friends!" // optional
}
```

### Get Friend Requests
**GET** `/friends/requests` (requires auth)

**Query Parameters:**
- `type`: "sent" | "received" (optional, defaults to "received")

### Respond to Friend Request
**POST** `/friends/requests/{request_id}/respond` (requires auth)

**Query Parameters:**
- `action`: string ("accept" | "decline") - Action to take on the friend request

**Response:**
```json
{
    "success": true,
    "data": {
        "friendship_id": 123,
        "friend_username": "jane_doe"
    },
    "message": "Friend request accepted"
}
```

### Get Friends List
**GET** `/friends/list` (requires auth)

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "friend_id": 2,
            "username": "jane_doe",
            "profile_photo_url": "string",
            "friendship_since": "2023-01-01T00:00:00Z",
            "is_verified": false
        }
    ],
    "total_friends": 1
}
```

### Remove Friend
**DELETE** `/friends/remove/{friend_id}` (requires auth)

---

## 📚 Stories Endpoints

### Upload Story
**POST** `/stories/upload` (requires auth)

**Request Body (multipart/form-data):**
- `media_file`: file (required)
- `caption`: string (optional)
- `visibility`: string ("public" | "friends" | "private", default: "friends")

### Get Stories Feed
**GET** `/stories/feed` (requires auth)

**Query Parameters:**
- `limit`: integer (default: 20)
- `offset`: integer (default: 0)

### Get My Stories
**GET** `/stories/my-stories` (requires auth)

### Get User's Stories
**GET** `/stories/user/{user_id}` (requires auth)

### View Story
**POST** `/stories/{story_id}/view` (requires auth)

### Delete Story
**DELETE** `/stories/{story_id}` (requires auth)

### Get Story Viewers
**GET** `/stories/{story_id}/viewers` (requires auth)

---

## 💬 Direct Messages Endpoints

### Send Direct Message
**POST** `/messages/send` (requires auth)

**Request Body:**
```json
{
    "recipient_user_id": 2,
    "content": "Hey there!", // optional if media_url provided
    "media_url": "string" // optional
}
```

### Send Media Message
**POST** `/messages/send-media` (requires auth)

### Get Conversations
**GET** `/messages/conversations` (requires auth)

### Get Messages with User
**GET** `/messages/{user_id}` (requires auth)

**Query Parameters:**
- `limit`: integer (default: 50)
- `offset`: integer (default: 0)

### Mark Messages as Read
**POST** `/messages/read` (requires auth)

### Mark Message as Viewed
**POST** `/messages/view` (requires auth)

### Delete Message
**DELETE** `/messages/{message_id}` (requires auth)

---

## 👥 Group Chat Endpoints

### Create Group
**POST** `/groups` (requires auth)

**Request Body:**
```json
{
    "name": "Soccer Squad",
    "description": "Weekend soccer games", // optional
    "visibility": "private", // "public" | "private" | "invite_only"
    "member_ids": [2, 3] // optional initial members
}
```

### Get User's Groups
**GET** `/groups` (requires auth)

### Get Group Members
**GET** `/groups/{group_id}/members` (requires auth)

### Add Group Member
**POST** `/groups/{group_id}/members` (requires auth)

### Remove Group Member
**DELETE** `/groups/{group_id}/members/{user_id}` (requires auth)

### Update Member Role
**PUT** `/groups/{group_id}/members/{user_id}` (requires auth)

### Update Group
**PUT** `/groups/{group_id}` (requires auth)

### Send Group Message
**POST** `/groups/{group_id}/messages` (requires auth)

**Request Body:**
```json
{
    "content": "Let's meet at the field!", // optional if media_url provided
    "media_url": "string" // optional
}
```

### Send Group Media Message
**POST** `/groups/{group_id}/messages/media` (requires auth)

### Get Group Messages
**GET** `/groups/{group_id}/messages` (requires auth)

**Query Parameters:**
- `limit`: integer (default: 50)
- `offset`: integer (default: 0)

### Mark Group Messages as Read
**POST** `/groups/{group_id}/messages/read` (requires auth)

### Mark Group Message as Viewed
**POST** `/groups/{group_id}/messages/{message_id}/view` (requires auth)

### Delete Group Message
**DELETE** `/groups/{group_id}/messages/{message_id}` (requires auth)

### Get Group Info
**GET** `/groups/{group_id}/info` (requires auth)

### Join Group
**POST** `/groups/{group_id}/join` (requires auth)

### Leave Group
**POST** `/groups/{group_id}/leave` (requires auth)

---

## 🎉 Events Endpoints

### Create Event
**POST** `/events` (requires auth)

**Request Body:**
```json
{
    "title": "Soccer Pickup Game",
    "description": "Casual game at the park", // optional
    "story": "Join us for an epic game!", // optional
    "location_name": "Central Park",
    "latitude": 40.7829,
    "longitude": -73.9654,
    "creator_latitude": 40.7829, // REQUIRED: Creator's current location
    "creator_longitude": -73.9654, // REQUIRED: Creator's current location
    "start_time": "2023-12-01T18:00:00Z",
    "end_time": "2023-12-01T20:00:00Z",
    "rsvp_deadline": "2023-12-01T17:00:00Z", // optional
    "visibility": "friends", // "public" | "friends" | "private" | "groups"
    "shared_with_friends": [2, 3], // optional array of friend IDs
    "shared_with_groups": [1], // optional array of group IDs
    "max_attendees": 20, // optional
    "is_premium": false, // optional, requires payment if true
    "location_privacy": "approximate" // "exact" | "approximate" | "hidden"
}
```

**Important Notes:**
- `creator_latitude` and `creator_longitude` are **REQUIRED** - the system validates that the creator is actually at the event location (within 100 meters)
- Users can only create up to **3 active events** at a time
- Events cannot be created more than **1 week in advance**
- Premium events (`is_premium: true`) must be public and require payment

### Get Events
**GET** `/events` (requires auth)

**Query Parameters:**
- `latitude`: float (optional) - Your current location for distance calculation
- `longitude`: float (optional) - Your current location for distance calculation
- `radius_miles`: float (default: 10.0, max: 50.0)
- `visibility`: string ("public" | "friends" | "all") - Filter by visibility
- `include_past`: boolean (default: false) - Include past events
- `sort_by`: string ("distance" | "start_time" | "created_at") - Sort order
- `limit`: integer (default: 20, max: 100)
- `offset`: integer (default: 0)

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 5,
            "title": "Soccer Pickup Game",
            "description": "Casual game at the park",
            "story": "Join us for an epic game!",
            "location_name": "Central Park",
            "latitude": 40.7829,
            "longitude": -73.9654,
            "start_time": "2023-12-01T18:00:00Z",
            "end_time": "2023-12-01T20:00:00Z",
            "visibility": "friends",
            "max_attendees": 20,
            "creator": {
                "id": 1,
                "username": "john_doe",
                "profile_photo_url": "string"
            },
            "attendee_count": 8,
            "rsvp_yes_count": 6,
            "rsvp_maybe_count": 2,
            "distance_miles": 2.3,
            "user_rsvp_status": "yes", // "yes" | "maybe" | "no" | null
            "can_rsvp": true,
            "is_creator": false,
            "created_at": "2023-11-25T10:00:00Z",
            "updated_at": "2023-11-25T15:30:00Z"
        }
    ],
    "total_count": 25,
    "has_more": true,
    "message": "Found 20 events within 10 miles"
}
```

### Get Event Details
**GET** `/events/{event_id}` (requires auth)

### Update Event
**PUT** `/events/{event_id}` (requires auth)

### Delete Event
**DELETE** `/events/{event_id}` (requires auth)

### RSVP to Event
**POST** `/events/{event_id}/rsvp` (requires auth)

**Request Body:**
```json
{
    "status": "yes", // "yes" | "maybe" | "no"
    "comment": "Looking forward to it!" // optional
}
```

### Get Event RSVPs
**GET** `/events/{event_id}/rsvps` (requires auth)

**Response:**
```json
{
    "success": true,
    "data": {
        "rsvp_yes": [
            {
                "user_id": 2,
                "username": "jane_doe",
                "profile_photo_url": "string",
                "comment": "Looking forward to it!",
                "rsvp_time": "2023-11-26T14:30:00Z",
                "is_friend": true
            }
        ],
        "rsvp_maybe": [
            {
                "user_id": 3,
                "username": "mike_jones",
                "profile_photo_url": "string",
                "comment": "Might be late",
                "rsvp_time": "2023-11-26T16:00:00Z",
                "is_friend": false
            }
        ],
        "rsvp_no": [
            {
                "user_id": 4,
                "username": "sarah_wilson",
                "profile_photo_url": "string",
                "comment": "Can't make it this time",
                "rsvp_time": "2023-11-26T10:15:00Z",
                "is_friend": true
            }
        ],
        "counts": {
            "yes": 6,
            "maybe": 2,
            "no": 1,
            "total": 9
        }
    },
    "message": "Event RSVPs retrieved successfully"
}
```

**Important Notes:**
- Only event creators see detailed RSVP information (usernames, comments)
- Non-creators only see aggregate counts for privacy
- Friends are marked with `is_friend: true` for easy identification

### Upload Event Media
**POST** `/events/{event_id}/media` (requires auth)

### Get Event Stats
**GET** `/events/{event_id}/stats` (requires auth)

### Get My Active Events
**GET** `/events/my/active` (requires auth)

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 5,
            "title": "Soccer Pickup Game",
            "description": "Casual game at the park",
            "location_name": "Central Park",
            "start_time": "2023-12-01T18:00:00Z",
            "end_time": "2023-12-01T20:00:00Z",
            "attendee_count": 8,
            "rsvp_counts": {
                "yes": 6,
                "maybe": 2,
                "no": 1
            },
            "status": "active",
            "created_at": "2023-11-25T10:00:00Z"
        }
    ],
    "message": "Found 3 active events"
}
```

### Get Events I'm Attending
**GET** `/events/attending/upcoming` (requires auth)

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 7,
            "title": "Basketball Tournament",
            "description": "Friendly competition",
            "location_name": "Sports Center",
            "start_time": "2023-12-02T14:00:00Z",
            "end_time": "2023-12-02T18:00:00Z",
            "creator": {
                "id": 3,
                "username": "mike_jones",
                "profile_photo_url": "string"
            },
            "distance_miles": 1.5,
            "user_rsvp_status": "yes",
            "rsvp_comment": "Can't wait!",
            "attendee_count": 12
        }
    ],
    "message": "Found 2 upcoming events you're attending"
}
```

---

## 📸 Snaps Endpoints

### Send Snap
**POST** `/snaps/send` (requires auth)

**Request Body (multipart/form-data):**
- `media_file`: file (required)
- `recipient_ids`: string (comma-separated user IDs, optional)
- `group_ids`: string (comma-separated group IDs, optional)
- `caption`: string (optional)
- `view_duration`: integer (1-60 seconds, default: 10)

### Get Received Snaps
**GET** `/snaps/received` (requires auth)

### Get Sent Snaps
**GET** `/snaps/sent` (requires auth)

### Get Snap
**GET** `/snaps/{snap_id}` (requires auth)

### View Snap
**POST** `/snaps/{snap_id}/view` (requires auth)

**Request Body:**
```json
{
    "screenshot_taken": false // optional, default: false
}
```

### Delete Snap
**DELETE** `/snaps/{snap_id}` (requires auth)

### Get Snap Views
**GET** `/snaps/{snap_id}/views` (requires auth)

---

## 📁 Media Endpoints

### Upload Media
**POST** `/media/upload` (requires auth)

**Request Body (multipart/form-data):**
- `file`: file (required)
- `type`: string ("profile" | "story" | "snap" | "event" | "venue", default: "general")

**Response:**
```json
{
    "success": true,
    "data": {
        "url": "string",
        "filename": "string",
        "size": 1024000,
        "mime_type": "image/jpeg"
    },
    "message": "File uploaded successfully"
}
```

### Get Media File
**GET** `/media/{file_path:path}` (requires auth)

### Delete Media File
**DELETE** `/media/{file_path:path}` (requires auth)

### Get Media Info
**GET** `/media/info/{file_path:path}` (requires auth)

### Get Storage Stats
**GET** `/media/storage/stats` (requires auth)

### Cleanup Unused Media
**POST** `/media/cleanup` (requires auth)

---

## 🏥 Health Check

### Server Health
**GET** `/health`

**Response:**
```json
{
    "status": "healthy",
    "message": "LadChat API is running",
    "version": "1.0.0",
    "timestamp": "2023-12-01T12:00:00Z",
    "services": {
        "database": "healthy",
        "media_storage": "healthy",
        "background_tasks": "healthy"
    }
}
```

---

## ⚠️ Error Responses

### 400 Bad Request
```json
{
    "success": false,
    "detail": "Invalid input data"
}
```

### 401 Unauthorized
```json
{
    "success": false,
    "detail": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
    "success": false,
    "detail": "You don't have permission to access this resource"
}
```

### 404 Not Found
```json
{
    "success": false,
    "detail": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
    "success": false,
    "detail": "Internal server error"
}
```

---

## 📋 Important Notes for App Developer

### Authentication
- Most endpoints require JWT authentication
- Include `Authorization: Bearer <token>` header
- Tokens expire after 24 hours - use refresh endpoint
- Store refresh token securely for automatic token renewal

### Location Data
- Use decimal degrees for latitude/longitude
- Distance calculations are in miles
- Location is optional for most endpoints but improves recommendations

### Media Files
- Supported formats: JPEG, PNG, MP4, MOV
- Max file size: 10MB for photos, 50MB for videos
- Files are automatically optimized and compressed

### Pagination
- Most list endpoints support `limit` and `offset`
- Default limit is usually 20, max varies by endpoint
- Use `has_more` field to check if more data available

### Real-time Features
- Use the notifications endpoints to check for unread messages
- Call `/notifications/chat-summary` when app becomes active
- Call `/notifications/mark-chat-opened` when user opens a chat

### AI Recommendations
- Friend recommendations require `open_to_friends` setting enabled
- Event recommendations need user location for distance filtering
- Recommendations update automatically based on user activity

### Error Handling
- Always check the `success` field in responses
- Handle authentication errors by redirecting to login
- Show user-friendly messages for validation errors

## 🧪 Testing Guide for App Developers

### Test Users Available
For testing the friend system and event RSVPs, these users are pre-created in the database:
- **Username:** `mcbagz` | **Password:** `Simius66` (User ID: 1)
- **Username:** `mattyb` | **Password:** `Simius66` (User ID: 2)

These users are already friends, so you can test friend-related features and event RSVPs immediately.

### Event Creation Testing
When creating events, remember:
1. **Location Validation:** You must provide both event location AND creator's current location (`creator_latitude`, `creator_longitude`)
2. **3 Event Limit:** Users can only have 3 active events at a time - delete old events if needed
3. **Distance Check:** The system validates that creators are within 100 meters of the event location
4. **Premium Events:** Set `is_premium: true` for paid events (must be public visibility)

### RSVP Testing
- Both test users are friends, so RSVPs will work immediately
- Event creators see detailed RSVP info (names, comments)
- Non-creators only see aggregate counts for privacy

### API Testing Interface
A complete HTML testing interface is available at: `server/test_interface.html`
- Opens directly in your browser
- Pre-configured with test user credentials
- Covers all major endpoints including events, friends, and RSVPs

---

This documentation covers all API endpoints needed for the LadChat mobile app, including the new RAG-powered recommendations, notifications, and venue directory features.
