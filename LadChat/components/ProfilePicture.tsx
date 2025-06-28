import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface ProfilePictureProps {
  uri?: string | null;
  size?: number;
  showVerified?: boolean;
  showOnline?: boolean;
  onPress?: () => void;
  style?: any;
  borderColor?: string;
  borderWidth?: number;
}

export default function ProfilePicture({
  uri,
  size = 50,
  showVerified = false,
  showOnline = false,
  onPress,
  style,
  borderColor,
  borderWidth = 0,
}: ProfilePictureProps) {
  const colorScheme = useColorScheme();
  
  const containerStyle = [
    styles.container,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth,
      borderColor: borderColor || 'transparent',
    },
    style,
  ];

  const imageStyle = [
    styles.image,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
    },
  ];

  const fallbackStyle = [
    styles.fallback,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: Colors[colorScheme ?? 'light'].icon + '20',
    },
  ];

  const renderContent = () => {
    if (uri) {
      // Handle backend URLs - convert relative paths to full URLs
      let imageUri = uri;
      if (uri.startsWith('/media/')) {
        // Convert relative backend URL to full URL
        const API_BASE_URL = 'https://ladchat.bagztech.com'; /*__DEV__ 
          ? 'http://192.168.0.14:8000'  // Development
          : 'https://api.ladchat.com'; // Production*/
        imageUri = `${API_BASE_URL}${uri}`;
      }
      
      return (
        <Image
          source={{ uri: imageUri }}
          style={imageStyle}
          defaultSource={require('@/assets/images/icon.png')}
          onError={(e) => {
            console.log('Profile picture failed to load:', imageUri, e.nativeEvent.error);
          }}
        />
      );
    }

    // Fallback icon
    return (
      <View style={fallbackStyle}>
        <IconSymbol
          name="person.crop.circle.fill"
          size={size * 0.7}
          color={Colors[colorScheme ?? 'light'].icon}
        />
      </View>
    );
  };

  const content = (
    <View style={containerStyle}>
      {renderContent()}
      
      {/* Verification Badge */}
      {showVerified && (
        <View style={[
          styles.verifiedBadge,
          {
            width: size * 0.3,
            height: size * 0.3,
            right: -2,
            bottom: -2,
          }
        ]}>
          <IconSymbol
            name="checkmark"
            size={size * 0.15}
            color="white"
          />
        </View>
      )}

      {/* Online Status */}
      {showOnline && (
        <View style={[
          styles.onlineIndicator,
          {
            width: size * 0.25,
            height: size * 0.25,
            right: size * 0.05,
            bottom: size * 0.05,
            borderRadius: size * 0.125,
          }
        ]} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'visible',
  },
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  verifiedBadge: {
    position: 'absolute',
    backgroundColor: '#007AFF',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  onlineIndicator: {
    position: 'absolute',
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: 'white',
  },
}); 