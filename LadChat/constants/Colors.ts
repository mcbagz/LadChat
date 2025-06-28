/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    card: '#f0f0f0',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    card: '#1C1E1F',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// Extended LadChat color palette for enhanced theming
export const LadColors = {
  // Primary brand colors
  primary: '#FFA500',        // Bold orange - energy and excitement
  primaryDark: '#E55A2B',    // Darker orange for hover states
  primaryLight: '#FF8C65',   // Lighter orange for accents
  
  // Secondary colors
  secondary: '#1E90FF',      // Deep blue - trust and reliability
  secondaryDark: '#003A6B',  // Darker blue
  secondaryLight: '#1A6BAA', // Lighter blue
  
  // Status colors
  success: '#00C851',        // Victory green - achievements
  successDark: '#00A843',    // Darker green
  warning: '#FFB84D',        // Caution amber - notifications
  warningDark: '#E6A043',    // Darker amber
  error: '#FF4444',          // Alert red - errors
  errorDark: '#E63939',      // Darker red
  
  // Background system
  background: {
    primary: '#FFFFFF',      // Light mode primary background
    secondary: '#F8F9FA',    // Light mode secondary background
    tertiary: '#F1F3F4',     // Light mode tertiary background
    
    primaryDark: '#121212',  // Dark mode primary background
    secondaryDark: '#1E1E1E', // Dark mode secondary background  
    tertiaryDark: '#2A2A2A', // Dark mode tertiary background
  },
  
  // Text system
  text: {
    primary: '#1A1A1A',      // Primary text (light mode)
    secondary: '#666666',     // Secondary text (light mode)
    tertiary: '#999999',      // Tertiary text (light mode)
    
    primaryDark: '#FFFFFF',   // Primary text (dark mode)
    secondaryDark: '#CCCCCC', // Secondary text (dark mode)
    tertiaryDark: '#999999',  // Tertiary text (dark mode)
  },
  
  // Gaming/Sports inspired accents
  accent: {
    purple: '#BB86FC',       // Gaming purple
    cyan: '#00E5FF',         // Cyberpunk cyan
    lime: '#76FF03',         // Achievement lime
    gold: '#FFD700',         // Victory gold
  },
  
  // Social interaction colors
  social: {
    online: '#00C851',       // Friend online
    away: '#FFB84D',         // Friend away
    busy: '#FF4444',         // Friend busy
    offline: '#999999',      // Friend offline
    
    messageReceived: '#E3F2FD', // Received message background
    messageSent: '#FF6B35',      // Sent message background
    otherPersonMessage: '#E5E5EA', // Other person's message background (adjustable)
    
    storyRing: '#FF6B35',        // Unviewed story ring
    storyRingViewed: '#999999',  // Viewed story ring
  },
  
  // Event/Activity colors
  activity: {
    live: '#FF4444',         // Live event indicator
    upcoming: '#FFB84D',     // Upcoming event
    past: '#999999',         // Past event
    featured: '#BB86FC',     // Featured event
  },
  
  // Utility colors
  overlay: {
    light: 'rgba(0, 0, 0, 0.1)',     // Light overlay
    medium: 'rgba(0, 0, 0, 0.3)',    // Medium overlay
    heavy: 'rgba(0, 0, 0, 0.7)',     // Heavy overlay
    
    lightDark: 'rgba(255, 255, 255, 0.1)', // Light overlay for dark mode
    mediumDark: 'rgba(255, 255, 255, 0.2)', // Medium overlay for dark mode
    heavyDark: 'rgba(255, 255, 255, 0.3)',  // Heavy overlay for dark mode
  },
  
  // Border colors
  border: {
    light: '#E1E5E9',        // Light border
    medium: '#C4CDD5',       // Medium border
    heavy: '#919EAB',        // Heavy border
    
    lightDark: '#2A2A2A',    // Light border (dark mode)
    mediumDark: '#404040',   // Medium border (dark mode)
    heavyDark: '#666666',    // Heavy border (dark mode)
  },
  
  // Camera/Media specific colors
  camera: {
    recordButton: '#FF4444',     // Record button
    recordButtonActive: '#E63939', // Active recording
    photoButton: '#FFFFFF',       // Photo button
    switchButton: 'rgba(255, 255, 255, 0.8)', // Camera switch
    
    modeActive: '#FF6B35',        // Active camera mode
    modeInactive: 'rgba(255, 255, 255, 0.5)', // Inactive mode
    
    timerText: '#FFD700',         // Recording timer
    flashlight: '#FFD700',        // Flash indicator
  },
};

// Helper function to get color based on theme
export const getThemeColor = (colorScheme: 'light' | 'dark' | null, colorKey: keyof typeof Colors.light) => {
  return Colors[colorScheme ?? 'light'][colorKey];
};

// Helper function to get lad-specific colors based on theme
export const getLadColor = (colorScheme: 'light' | 'dark' | null, category: keyof typeof LadColors, key: string) => {
  const isDark = colorScheme === 'dark';
  const categoryColors = LadColors[category] as any;
  
  if (typeof categoryColors === 'string') {
    return categoryColors;
  }
  
  // Handle theme-specific colors
  if (category === 'background') {
    return isDark ? categoryColors[key + 'Dark'] || categoryColors[key] : categoryColors[key];
  }
  
  if (category === 'text') {
    return isDark ? categoryColors[key + 'Dark'] || categoryColors[key] : categoryColors[key];
  }
  
  if (category === 'border') {
    return isDark ? categoryColors[key + 'Dark'] || categoryColors[key] : categoryColors[key];
  }
  
  if (category === 'overlay') {
    return isDark ? categoryColors[key + 'Dark'] || categoryColors[key] : categoryColors[key];
  }
  
  return categoryColors[key] || LadColors.primary;
};
