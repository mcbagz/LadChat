# LadChat 🚀

A Snapchat-inspired social app designed for young men to connect, share ephemeral content, and plan real-world hangouts. Built with React Native (Expo) and FastAPI.

## 🎯 Project Overview

LadChat is currently in **Phase 3-4** of a 9-phase development plan, focusing on:
- ✅ **Ephemeral Content**: Stories and snaps with auto-deletion
- ✅ **Friend Discovery**: AI-powered friend matching with privacy controls  
- ✅ **Direct Messaging**: One-time viewable media messages
- ✅ **Story Grouping**: Organized friend stories with view tracking
- 🚧 **Hangout Planning**: Real-world meetup coordination (upcoming)

## 🏗️ Architecture

- **Frontend**: React Native with Expo (TypeScript)
- **Backend**: FastAPI (Python) with SQLite
- **Media Storage**: Local file system with auto-cleanup
- **Authentication**: JWT tokens with refresh mechanism
- **Real-time**: WebSocket support for messaging

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+ and pip
- Expo CLI (`npm install -g @expo/cli`)

### 1. Backend Setup

```bash
# Navigate to server directory
cd server

# Create virtual environment
python -m venv ladchat_env

# Activate virtual environment
# Windows:
ladchat_env\Scripts\activate
# macOS/Linux:
source ladchat_env/bin/activate

# Install dependencies
pip install fastapi uvicorn sqlalchemy pydantic python-jose bcrypt python-multipart

# Start the server
python app.py
```

Server runs on `http://localhost:8000` (or your local IP for mobile testing)

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd LadChat

# Install dependencies
npm install

# Start the development server
npx expo start
```

Use Expo Go app or iOS Simulator/Android Emulator to run the app.

### 3. Configuration

Update the API endpoint in `LadChat/services/api.ts`:
```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://YOUR_LOCAL_IP:8000'  // Replace with your machine's IP
  : 'https://api.ladchat.com';
```

## 📱 Current Features

### 🔐 Authentication
- Secure registration/login with JWT tokens
- Profile creation with interests and bio
- "Open to Friends" toggle for discoverability

### 📸 Ephemeral Content
- **Stories**: 24-hour auto-deleting content with visibility controls
- **Snaps**: Direct photo/video messages with custom view durations
- **View Tracking**: See who viewed your stories
- **Screenshot Detection**: Alerts for screenshot attempts

### 👥 Friend System
- **Smart Search**: Find friends by username with privacy controls
- **Friend Requests**: Send/receive/manage friend requests
- **Friend Management**: View friends list and remove connections

### 💬 Messaging
- **Direct Messages**: Text and media messaging between friends
- **One-Time Media**: Photos disappear after viewing
- **Conversation Threading**: Organized message history
- **Camera Integration**: Send photos directly from chat

### 📰 Story Feed
- **Grouped Stories**: One circle per friend with story count badges
- **Unviewed Indicators**: Blue circles for unseen content
- **Sequential Viewing**: Tap to view all friend's stories in order

## 🛠️ Development

### Project Structure
```
LadChat/
├── app/                 # React Native screens and navigation
├── components/          # Reusable UI components  
├── services/           # API client and utilities
├── contexts/           # React contexts (Auth, etc.)
└── constants/          # App configuration

server/
├── models/             # SQLAlchemy database models
├── routes/             # FastAPI route handlers
├── utils/              # Helper functions and utilities
├── media/              # User-uploaded content storage
└── logs/               # Application logs
```

### Available Scripts

**Frontend:**
- `npm start` - Start Expo development server
- `npm run android` - Run on Android emulator
- `npm run ios` - Run on iOS simulator
- `npm run web` - Run in web browser

**Backend:**
- `python app.py` - Start FastAPI server with auto-reload
- `python -m pytest` - Run test suite (when implemented)

## 🗄️ Database Schema

Key models:
- **Users**: Authentication, profiles, and preferences
- **Stories**: Ephemeral content with expiration
- **DirectMessages**: Private messaging with media support
- **Friendships**: User connections and requests
- **Snaps**: Direct media messages with view tracking

## 🔒 Security Features

- JWT authentication with refresh tokens
- Password hashing with bcrypt
- Input validation with Pydantic
- File upload validation and sanitization
- Rate limiting on sensitive endpoints
- Privacy controls for friend discovery

## 📋 Upcoming Features (Phases 5-9)

- **Hangout Planning**: Map-based event creation and RSVPs
- **AI Friend Matching**: RAG-powered intelligent recommendations  
- **Group Chats**: Multi-user conversations with smart suggestions
- **Venue Directory**: Curated third-space locations
- **End-to-End Encryption**: Signal Protocol implementation

## 🤝 Contributing

This is currently a private development project. Features are implemented following the 9-phase development plan outlined in `Phases.txt`.

## 📄 License

Private project - All rights reserved.

---

*Built with ❤️ for connecting lads in the real world*
