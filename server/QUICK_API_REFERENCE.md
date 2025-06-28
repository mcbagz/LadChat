# LadChat API Quick Reference

**Base URL:** `http://localhost:8000`  
**Auth Header:** `Authorization: Bearer <jwt_token>`

## 🔐 Authentication
```
POST /auth/register          - Register new user
POST /auth/login             - Login user  
POST /auth/refresh           - Refresh token
POST /auth/logout            - Logout (auth required)
```

## 🤖 AI Recommendations (NEW)
```
GET /recommendations/friends                      - Get friend suggestions (auth)
GET /recommendations/events?lat=X&lng=Y          - Get event suggestions (auth)
GET /recommendations/groups/{id}/events?lat=X&lng=Y - Group event suggestions (auth, admin)
```

## 🔔 Notifications (NEW)
```
GET /notifications/chat-summary                  - Get chats with unread messages (auth)
POST /notifications/mark-chat-opened             - Reset unread count (auth)
GET /notifications/unread-count                  - Total unread count (auth)
```

## 📍 Venues (NEW - Third Space Directory)
```
GET /venues?lat=X&lng=Y&category=bar            - Search venues (auth)
GET /venues/{id}?lat=X&lng=Y                    - Venue details (auth)
GET /venues/categories/list                     - Available categories
POST /venues/{id}/reviews                       - Create review (auth)
GET /venues/{id}/reviews                        - Get reviews (auth)
```

## 👤 Users
```
GET /users/me                - Current user profile (auth)
PUT /users/me                - Update profile (auth)
GET /users/{id}              - Get user by ID (auth)
```

## 👥 Friends
```
GET /friends                 - Friends list (auth)
POST /friends/request        - Send friend request (auth)
GET /friends/requests        - Get friend requests (auth)
POST /friends/request/{id}/respond - Accept/decline request (auth)
```

## 📱 Stories
```
GET /stories                 - Stories feed (auth)
POST /stories                - Create story (auth, multipart)
POST /stories/{id}/view      - View story (auth)
```

## 📨 Messages
```
GET /messages/conversations          - Conversation list (auth)
GET /messages/conversation/{id}      - Messages in conversation (auth)
POST /messages/send                  - Send direct message (auth)
```

## 👥 Groups
```
GET /groups                  - User's groups (auth)
POST /groups                 - Create group (auth)
GET /groups/{id}/messages    - Group messages (auth)
POST /groups/{id}/messages   - Send group message (auth)
```

## 🎯 Events
```
GET /events?lat=X&lng=Y      - Events near user (auth)
POST /events                 - Create event (auth)
POST /events/{id}/rsvp       - RSVP to event (auth)
```

## 📷 Snaps
```
POST /snaps/send             - Send snap (auth, multipart)
GET /snaps/received          - Received snaps (auth)
POST /snaps/{id}/view        - View snap (auth)
```

## 📂 Media
```
POST /media/upload           - Upload file (auth, multipart)
```

## 🏥 Health
```
GET /health                  - Server health check
```

---

## Key Response Fields

### Authentication Success
```json
{
  "success": true,
  "access_token": "jwt_token",
  "refresh_token": "refresh_token", 
  "user": { /* user object */ }
}
```

### Friend Recommendations
```json
{
  "success": true,
  "data": [
    {
      "user_id": 3,
      "username": "mike_jones",
      "similarity_score": 0.85,
      "mutual_friends_count": 2,
      "reason": "You both love soccer"
    }
  ]
}
```

### Event Recommendations  
```json
{
  "success": true,
  "data": [
    {
      "event_id": 5,
      "title": "Soccer Game",
      "distance_miles": 2.3,
      "similarity_score": 0.78,
      "can_rsvp": true
    }
  ]
}
```

### Chat Summary
```json
{
  "success": true,
  "data": [
    {
      "chat_type": "direct",
      "chat_id": 1,
      "unread_count": 3,
      "other_user": { /* user object */ }
    }
  ],
  "total_unread_chats": 2
}
```

### Venues Search
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "The Lad Tavern",
      "category": "bar",
      "rating": 4.2,
      "lad_friendly_score": 8.5,
      "distance_miles": 2.1
    }
  ],
  "total_count": 25,
  "has_more": true
}
```

## Common Query Parameters
- `lat` / `latitude`: Decimal degrees (required for distance-based features)
- `lng` / `longitude`: Decimal degrees (required for distance-based features)
- `limit`: Number of results (default: 10-20, max: varies)
- `offset`: Pagination offset (default: 0)
- `radius_miles`: Search radius (default: 10.0, max: 50.0)

## Important Notes
- **All authenticated endpoints** require `Authorization: Bearer <token>` header
- **Tokens expire** after 24 hours - use `/auth/refresh` 
- **Location data** improves recommendations significantly
- **Media uploads** use `multipart/form-data`
- **Always check** `success` field in responses
- **Error responses** include `detail` field with error message

See `API_DOCUMENTATION.md` for complete details and examples. 