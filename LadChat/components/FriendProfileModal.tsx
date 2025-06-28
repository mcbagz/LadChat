import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LadColors, Colors } from '@/constants/Colors';
import ProfilePicture from '@/components/ProfilePicture';
import { apiClient } from '@/services/api';

interface Friend {
  id: number;
  username: string;
  bio?: string;
  interests: string[];
  profile_photo_url?: string;
  is_verified: boolean;
  friend_since?: string;
  mutual_friends_count?: number;
  stats?: {
    friends_count: number;
    stories_count: number;
    hangouts_count: number;
  };
}

interface FriendProfileModalProps {
  visible: boolean;
  onClose: () => void;
  friendId: number | null;
}

export default function FriendProfileModal({
  visible,
  onClose,
  friendId,
}: FriendProfileModalProps) {
  const colorScheme = useColorScheme();
  const [friend, setFriend] = useState<Friend | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible && friendId) {
      loadFriendProfile();
    }
  }, [visible, friendId]);

  const loadFriendProfile = async () => {
    if (!friendId) return;
    
    setIsLoading(true);
    try {
      // Try to get friend profile from API
      const response = await apiClient.getUserProfile(friendId);
      
      if (response.success && response.data) {
        const profileData = response.data;
        
        const friendProfile: Friend = {
          id: profileData.id,
          username: profileData.username,
          bio: profileData.bio || 'No bio yet',
          interests: profileData.interests || [],
          profile_photo_url: profileData.profile_photo_url,
          is_verified: profileData.is_verified || false,
          friend_since: profileData.friend_since || '2024-01-01',
          mutual_friends_count: profileData.mutual_friends_count || 0,
          stats: {
            friends_count: profileData.friends_count || 0,
            stories_count: profileData.stories_count || 0,
            hangouts_count: profileData.hangouts_count || 0,
          },
        };
        
        setFriend(friendProfile);
      } else {
        // Fallback to basic friend data if profile API fails
        console.log('Profile API failed, using basic friend data');
        const basicFriend: Friend = {
          id: friendId,
          username: `Friend ${friendId}`,
          bio: 'Profile information not available',
          interests: [],
          profile_photo_url: undefined,
          is_verified: false,
          friend_since: '2024-01-01',
          mutual_friends_count: 0,
          stats: {
            friends_count: 0,
            stories_count: 0,
            hangouts_count: 0,
          },
        };
        setFriend(basicFriend);
      }
    } catch (error) {
      console.error('Error loading friend profile:', error);
      
      // Fallback to basic friend data on error
      const basicFriend: Friend = {
        id: friendId,
        username: `Friend ${friendId}`,
        bio: 'Unable to load profile information',
        interests: [],
        profile_photo_url: undefined,
        is_verified: false,
        friend_since: '2024-01-01',
        mutual_friends_count: 0,
        stats: {
          friends_count: 0,
          stories_count: 0,
          hangouts_count: 0,
        },
      };
      setFriend(basicFriend);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = () => {
    Alert.alert('Send Message', 'Message functionality coming soon!');
    onClose();
  };

  const handlePlanHangout = () => {
    Alert.alert('Plan Hangout', 'Hangout planning coming soon!');
    onClose();
  };

  const handleRemoveFriend = () => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend?.username} as a friend?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Removed', `${friend?.username} has been removed from your friends`);
            onClose();
          },
        },
      ]
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <IconSymbol name="xmark" size={24} color={LadColors.primary} />
            </TouchableOpacity>
            
            <ThemedText style={styles.headerTitle}>Friend Profile</ThemedText>
            
            <TouchableOpacity onPress={handleRemoveFriend} style={styles.moreButton}>
              <IconSymbol name="ellipsis" size={24} color={Colors[colorScheme ?? 'light'].text} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ThemedView style={styles.loadingContainer}>
              <ThemedText style={styles.loadingText}>Loading profile...</ThemedText>
            </ThemedView>
          ) : friend ? (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Profile Header */}
              <ThemedView style={styles.profileSection}>
                <ProfilePicture
                  uri={friend.profile_photo_url}
                  size={120}
                  showVerified={friend.is_verified}
                  borderWidth={4}
                  borderColor={`${LadColors.primary}30`}
                />
                
                <ThemedText style={styles.username}>{friend.username}</ThemedText>
                
                {friend.friend_since && (
                  <ThemedText style={styles.friendSince}>
                    <ThemedText>Friends since </ThemedText>
                    <ThemedText style={styles.friendSinceDate}>
                      {new Date(friend.friend_since).toLocaleDateString('en-US', { 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </ThemedText>
                  </ThemedText>
                )}
                
                {friend.mutual_friends_count && friend.mutual_friends_count > 0 && (
                  <ThemedText style={styles.mutualFriends}>
                    <ThemedText>{friend.mutual_friends_count} mutual friend{friend.mutual_friends_count !== 1 ? 's' : ''}</ThemedText>
                  </ThemedText>
                )}
              </ThemedView>

              {/* Stats */}
              {friend.stats && (
                <ThemedView style={styles.statsSection}>
                  <View style={styles.statItem}>
                    <ThemedText style={styles.statNumber}>{friend.stats.friends_count}</ThemedText>
                    <ThemedText style={styles.statLabel}>Friends</ThemedText>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <ThemedText style={styles.statNumber}>{friend.stats.hangouts_count}</ThemedText>
                    <ThemedText style={styles.statLabel}>Hangouts</ThemedText>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <ThemedText style={styles.statNumber}>{friend.stats.stories_count}</ThemedText>
                    <ThemedText style={styles.statLabel}>Stories</ThemedText>
                  </View>
                </ThemedView>
              )}

              {/* Bio */}
              {friend.bio && (
                <ThemedView style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>About</ThemedText>
                  <ThemedText style={styles.bio}>{friend.bio}</ThemedText>
                </ThemedView>
              )}

              {/* Interests */}
              {friend.interests && friend.interests.length > 0 && (
                <ThemedView style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Interests</ThemedText>
                  <View style={styles.interestsRow}>
                    {friend.interests.map((interest, index) => (
                      <View key={index} style={styles.interestTag}>
                        <ThemedText style={styles.interestTagText}>{interest}</ThemedText>
                      </View>
                    ))}
                  </View>
                </ThemedView>
              )}

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.primaryButton} onPress={handleSendMessage}>
                  <IconSymbol name="message.fill" size={20} color="white" />
                  <ThemedText style={styles.primaryButtonText}>Send Message</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.secondaryButton} onPress={handlePlanHangout}>
                  <IconSymbol name="calendar.badge.plus" size={20} color={LadColors.primary} />
                  <ThemedText style={styles.secondaryButtonText}>Plan Hangout</ThemedText>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <ThemedView style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>Failed to load friend profile</ThemedText>
            </ThemedView>
          )}
        </ThemedView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: `${LadColors.primary}15`,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: LadColors.primary,
  },
  moreButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.7,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.7,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 32,
  },
  username: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
    color: LadColors.primary,
  },
  friendSince: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
    textAlign: 'center',
  },
  friendSinceDate: {
    fontSize: 14,
    fontWeight: '600',
    color: LadColors.primary,
  },
  mutualFriends: {
    fontSize: 14,
    color: LadColors.primary,
    fontWeight: '600',
    backgroundColor: `${LadColors.primary}15`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statsSection: {
    flexDirection: 'row',
    backgroundColor: `${LadColors.primary}08`,
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: `${LadColors.primary}20`,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: `${LadColors.primary}30`,
    marginHorizontal: 20,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
    color: LadColors.primary,
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.7,
    fontWeight: '500',
  },
  section: {
    marginBottom: 32,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: LadColors.primary,
  },
  bio: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
    fontWeight: '400',
  },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  interestTag: {
    backgroundColor: `${LadColors.primary}15`,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${LadColors.primary}30`,
  },
  interestTagText: {
    fontSize: 14,
    color: LadColors.primary,
    fontWeight: '600',
  },
  actionButtons: {
    gap: 16,
    paddingBottom: 40,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LadColors.primary,
    paddingVertical: 18,
    borderRadius: 14,
    gap: 10,
    shadowColor: LadColors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${LadColors.primary}15`,
    paddingVertical: 18,
    borderRadius: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: `${LadColors.primary}30`,
  },
  secondaryButtonText: {
    color: LadColors.primary,
    fontSize: 17,
    fontWeight: '700',
  },
}); 