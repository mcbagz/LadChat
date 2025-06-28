# LadChat RAG System Implementation

## Overview
Complete implementation of RAG system with AI-powered recommendations, notifications, and venue directory.

## 🚀 What's Implemented

### 1. RAG System Core
- **ChromaDB** for vector storage and similarity search
- **OpenAI embeddings** (text-embedding-3-large) for user/event/group profiles
- **Image processing** with gpt-4o-mini for snap descriptions
- **Background tasks** for 24-hour embedding updates

### 2. AI Features
- **Friend recommendations** based on interests and communication style
- **Event recommendations** with 5-mile location filtering  
- **Group event suggestions** for admins
- **Smart exclusions** (declined events, existing friends)

### 3. In-App Notifications
- **Chat summaries** with unread message counts
- **Activity tracking** per chat to determine unread status
- **Total unread badges** for app notifications

### 4. Third Space Directory
- **Location-based venue search** with distance calculation
- **Category filtering** and lad-friendly scoring
- **Review system** with venue ratings
- **Hangout tracking** integration

## 📁 Files Added

### AI System
- `ai/__init__.py` - AI package initialization
- `ai/chroma_client.py` - Vector database client
- `ai/embedding_service.py` - OpenAI embedding generation
- `ai/rag_engine.py` - Recommendation engine
- `ai/embedding_tasks.py` - Background update tasks

### Database Models
- `models/embeddings.py` - New embedding and activity models

### API Routes
- `routes/recommendations.py` - Friend and event recommendations
- `routes/notifications.py` - In-app notification system
- `routes/venues.py` - Venue directory endpoints

### Testing
- `test_rag_system.py` - System verification script

## 🔧 Setup

### 1. Environment
```bash
export OPENAI_API_KEY="your-api-key"
```

### 2. Install Dependencies
```bash
pip install chromadb>=0.4.18 openai>=1.12.0 numpy>=1.24.0 Pillow>=10.0.0
```

### 3. Test Installation
```bash
python test_rag_system.py
```

## 📱 Key Endpoints

### Recommendations
- `GET /recommendations/friends` - AI friend suggestions
- `GET /recommendations/events?lat=40.7&lng=-74.0` - Location-based events

### Notifications  
- `GET /notifications/chat-summary` - Unread chat overview
- `POST /notifications/mark-chat-opened` - Reset unread count

### Venues
- `GET /venues?lat=40.7&lng=-74.0&category=bar` - Search venues
- `POST /venues/{id}/reviews` - Add venue review

## 🎯 Features

### Smart Recommendations
- Combines profile interests with messaging patterns
- 5-mile radius for event suggestions
- Excludes previously declined content
- Provides contextual reasons for matches

### Privacy-First Design
- Stores only vector embeddings, not raw content
- User-controlled friend matching (`open_to_friends`)
- Automatic cleanup of inactive data
- Location approximation for privacy

### Performance Optimized
- Background embedding updates (24h cycle)
- Efficient vector similarity search
- Paginated results with smart sorting
- Async operations for AI calls

## 🔄 How It Works

### User Embeddings
1. **Profile embedding**: bio + interests → vector
2. **Message embedding**: recent 25 messages + 10 snaps → vector
3. **Combined**: concatenated for friend matching
4. **Updated**: every 24 hours automatically

### Event Recommendations
1. Find events within 5 miles of user
2. Generate query embedding from user profile
3. Search similar events in vector space
4. Filter out declined events
5. Return ranked list with reasons

### Notifications
1. Track when user last opened each chat
2. Count new messages since last opened
3. Return only chats with unread content
4. Reset count when chat is opened

This system provides intelligent, privacy-respecting recommendations while maintaining high performance and user control. 