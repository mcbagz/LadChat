import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  State,
} from 'react-native';
import { ThemedText } from './ThemedText';
import { IconSymbol } from './ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LadColors, getLadColor } from '@/constants/Colors';
import { LadCopy } from '@/utils/LadCopy';
import ProfilePicture from './ProfilePicture';

interface Friend {
  id: number;
  username: string;
  profile_photo_url?: string;
  is_verified: boolean;
  is_online: boolean;
  last_active?: string;
}

interface QuickSendOverlayProps {
  visible: boolean;
  friends: Friend[];
  onSendToFriend: (friendId: number, friendUsername: string) => void;
  onAddFriends: () => void;
  mediaType: 'photo' | 'video' | null;
}

export default function QuickSendOverlay({
  visible,
  friends,
  onSendToFriend,
  onAddFriends,
  mediaType,
}: QuickSendOverlayProps) {
  const colorScheme = useColorScheme();
  const [draggedFriendId, setDraggedFriendId] = useState<number | null>(null);
  const [hoveredFriendId, setHoveredFriendId] = useState<number | null>(null);
  
  // Limit to 6 most recent friends for UI purposes
  const recentFriends = friends.slice(0, 6);

  if (!visible) return null;

  const getStatusColor = (friend: Friend): string => {
    if (friend.is_online) return LadColors.social.online;
    
    // Check if active in last hour
    if (friend.last_active) {
      const lastActive = new Date(friend.last_active);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (lastActive > oneHourAgo) return LadColors.social.away;
    }
    
    return LadColors.social.offline;
  };

  const handleFriendPress = (friendId: number, friendUsername: string) => {
    setDraggedFriendId(friendId);
    setTimeout(() => {
      onSendToFriend(friendId, friendUsername);
      setDraggedFriendId(null);
    }, 150); // Short animation delay
  };

  const FriendBubble = ({ friend, index }: { friend: Friend; index: number }) => {
    const isHovered = hoveredFriendId === friend.id;
    const isDragged = draggedFriendId === friend.id;
    
    return (
      <TouchableOpacity
        key={friend.id}
        style={[
          styles.friendBubble,
          { 
            transform: [
              { scale: isDragged ? 1.2 : isHovered ? 1.1 : 1 },
              { translateY: index * -8 }, // Slight stagger effect
            ],
            zIndex: isDragged ? 1000 : 10 - index,
          }
        ]}
        onPress={() => handleFriendPress(friend.id, friend.username)}
        activeOpacity={0.8}
      >
        <View style={styles.friendAvatarContainer}>
          <ProfilePicture
            size={48}
            uri={friend.profile_photo_url}
            showVerified={friend.is_verified}
          />
          
          {/* Online status indicator */}
          <View 
            style={[
              styles.statusIndicator,
              { backgroundColor: getStatusColor(friend) }
            ]} 
          />
          
          {/* Send animation overlay */}
          {isDragged && (
            <View style={styles.sendOverlay}>
              <IconSymbol 
                name="paperplane.fill" 
                size={20} 
                color="white" 
              />
            </View>
          )}
        </View>
        
        <ThemedText style={styles.friendUsername} numberOfLines={1}>
          {friend.username}
        </ThemedText>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Main friend bubbles */}
      <View style={styles.friendsList}>
        {recentFriends.map((friend, index) => (
          <FriendBubble key={friend.id} friend={friend} index={index} />
        ))}
        
        {/* Add friends button if less than 6 friends */}
        {recentFriends.length < 6 && (
          <TouchableOpacity 
            style={styles.addFriendsButton}
            onPress={onAddFriends}
          >
            <View style={styles.addFriendsIcon}>
              <IconSymbol 
                name="plus" 
                size={20} 
                color={LadColors.primary} 
              />
            </View>
            <ThemedText style={styles.addFriendsText}>
              Add lads
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick send hint */}
      {mediaType && (
        <View style={styles.hintContainer}>
          <View style={styles.hintBubble}>
            <ThemedText style={styles.hintText}>
              {mediaType === 'photo' ? 
                LadCopy.CAMERA.SNAP_MODE() : 
                'Tap a lad to send this epic video! 🎥'
              }
            </ThemedText>
          </View>
        </View>
      )}

      {/* Visual feedback for dragging */}
      {draggedFriendId && (
        <View style={styles.dragFeedback}>
          <View style={styles.dragFeedbackCircle}>
            <IconSymbol 
              name="checkmark" 
              size={24} 
              color="white" 
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    top: 100,
    bottom: 200,
    width: 80,
    justifyContent: 'flex-start',
    zIndex: 100,
  },
  
  friendsList: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 16,
  },
  
  friendBubble: {
    alignItems: 'center',
    width: 64,
  },
  
  friendAvatarContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  
  statusIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  
  sendOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    backgroundColor: LadColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.9,
  },
  
  friendUsername: {
    fontSize: 10,
    fontWeight: '500',
    color: 'white',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  addFriendsButton: {
    alignItems: 'center',
    width: 64,
    opacity: 0.8,
  },
  
  addFriendsIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  
  addFriendsText: {
    fontSize: 10,
    fontWeight: '500',
    color: 'white',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  hintContainer: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    right: -16,
    alignItems: 'center',
  },
  
  hintBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: LadColors.primary,
  },
  
  hintText: {
    fontSize: 11,
    color: 'white',
    textAlign: 'center',
    lineHeight: 14,
  },
  
  dragFeedback: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -32 }, { translateY: -32 }],
    zIndex: 1000,
  },
  
  dragFeedbackCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: LadColors.success,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
}); 