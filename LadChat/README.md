# LadChat Frontend 📱

The React Native frontend for LadChat - a Snapchat-inspired social app for young men.

## 🚀 Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the development server**
   ```bash
   npx expo start
   ```

3. **Run on device/emulator**
   - **Development build**: Scan QR code with Expo Go
   - **Android emulator**: Press `a` in terminal
   - **iOS simulator**: Press `i` in terminal 
   - **Web browser**: Press `w` in terminal

## 📁 Project Structure

```
app/
├── (tabs)/             # Tab navigation screens
│   ├── stories.tsx     # Stories feed and creation
│   ├── friends.tsx     # Friend discovery and management
│   ├── hangouts.tsx    # Hangout planning (upcoming)
│   └── messages.tsx    # Direct messages
├── auth/               # Authentication screens
│   ├── login.tsx       # Login screen
│   ├── signup.tsx      # Registration screen
│   └── _layout.tsx     # Auth layout
├── messages/           # Message-related screens
│   ├── chat.tsx        # Individual chat screen
│   └── index.tsx       # Messages list
├── chat.tsx            # Main chat interface
└── _layout.tsx         # Root layout

components/
├── ui/                 # UI components
├── AuthGuard.tsx       # Authentication wrapper
├── StoryViewer.tsx     # Story viewing modal
└── FriendSelector.tsx  # Friend selection component

services/
├── api.ts              # API client and types
contexts/
├── AuthContext.tsx     # Authentication state
constants/
├── Colors.ts           # Theme colors
```

## 🔌 API Configuration

Update the API endpoint in `services/api.ts` to match your backend:

```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://YOUR_LOCAL_IP:8000'  // Development
  : 'https://api.ladchat.com';   // Production
```

For local development, replace `YOUR_LOCAL_IP` with your machine's IP address (not localhost) so mobile devices can connect.

## 🎨 Features

### 📸 Camera & Stories
- Camera-first interface with photo/video capture
- Story creation with caption and visibility controls
- Story viewer with progress bars and tap navigation
- View tracking and story analytics

### 👥 Friend System
- Friend search with privacy controls
- Friend request management
- Friend list with online status
- Friend selector for sharing content

### 💬 Messaging
- Direct messaging with friends
- Media messages (photos/videos)
- One-time viewable media with auto-deletion
- Conversation threading and history

### 🔐 Authentication
- Secure JWT-based authentication
- Profile creation and management
- Privacy settings and friend discovery toggle

## 🛠️ Development

### Available Scripts
- `npm start` - Start Expo development server
- `npm run android` - Run on Android emulator
- `npm run ios` - Run on iOS simulator  
- `npm run web` - Run in web browser
- `npm run reset-project` - Reset to blank project

### File-based Routing
This project uses [Expo Router](https://docs.expo.dev/router/introduction) for file-based navigation. Routes are automatically generated based on the file structure in the `app/` directory.

### Styling
- Uses React Native StyleSheet for component styling
- Themed components with light/dark mode support
- Consistent design system with the Colors constants

## 📱 Platform Support

- **iOS**: Full native support with iOS-specific UI components
- **Android**: Full native support with Material Design elements
- **Web**: Limited support for development and testing

## 🔧 Configuration Files

- `app.json` - Expo configuration
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `eslint.config.js` - Code linting rules

## 🚀 Deployment

For production deployment:
1. Update API endpoints in `services/api.ts`
2. Configure app signing certificates
3. Build with `expo build` or EAS Build
4. Deploy to App Store/Google Play

---

*Part of the LadChat project - connecting lads in the real world*
