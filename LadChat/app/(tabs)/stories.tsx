import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LadColors, Colors } from '@/constants/Colors';
import { LadCopy } from '@/utils/LadCopy';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, Story } from '@/services/api';
import StoryViewer from '@/components/StoryViewer';
import ProfilePicture from '@/components/ProfilePicture';

export default function StoriesScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [storyFeed, setStoryFeed] = useState<Story[]>([]);
  const [myStories, setMyStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerStories, setViewerStories] = useState<Story[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  useEffect(() => {
    loadStories();
  }, []);

  // Refresh stories when tab comes into focus (e.g., after creating a story)
  useFocusEffect(
    useCallback(() => {
      loadStories();
    }, [])
  );

  const loadStories = async () => {
    try {
      const [feedResponse, myStoriesResponse] = await Promise.all([
        apiClient.getStoryFeed(20, 0),
        apiClient.getMyStories(),
      ]);

      console.log('📥 STORY FEED DEBUG - Raw feed response:', feedResponse);
      console.log('📥 MY STORIES DEBUG - Raw my stories response:', myStoriesResponse);

      if (feedResponse.success && feedResponse.data) {
        console.log('✅ STORY FEED DEBUG - Setting feed count:', feedResponse.data.length);
        setStoryFeed(feedResponse.data);
      }

      if (myStoriesResponse.success && myStoriesResponse.data) {
        console.log('✅ MY STORIES DEBUG - Setting my stories count:', myStoriesResponse.data.length);
        setMyStories(myStoriesResponse.data);
      }
    } catch (error) {
      console.error('❌ STORIES DEBUG - Exception loading stories:', error);
      Alert.alert('Error', 'Failed to load stories');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStories();
    setRefreshing(false);
  };

  const formatStoryTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return '24h';
  };

  const openStoryViewer = (story: Story) => {
    // Get all stories from the same user
    const userStories = [...myStories, ...storyFeed].filter(s => s.user_id === story.user_id);
    const initialIndex = userStories.findIndex(s => s.id === story.id);
    
    if (userStories.length > 0 && initialIndex >= 0) {
      setViewerStories(userStories);
      setViewerInitialIndex(initialIndex);
      setViewerVisible(true);
    } else {
      // Fallback to just the single story
      setViewerStories([story]);
      setViewerInitialIndex(0);
      setViewerVisible(true);
    }
  };

  const openFriendStories = (userId: number) => {
    // Get all stories from this friend
    const friendStories = storyFeed.filter(s => s.user_id === userId);
    if (friendStories.length > 0) {
      setViewerStories(friendStories);
      setViewerInitialIndex(0);
      setViewerVisible(true);
    }
  };

  const getGroupedFriendStories = () => {
    // Group stories by user
    const grouped = storyFeed.reduce((acc, story) => {
      const userId = story.user_id;
      if (!acc[userId]) {
        acc[userId] = {
          user: story.user,
          stories: [],
          latestStory: story
        };
      }
      acc[userId].stories.push(story);
      
      // Keep the latest story as the representative
      if (new Date(story.created_at) > new Date(acc[userId].latestStory.created_at)) {
        acc[userId].latestStory = story;
      }
      
      return acc;
    }, {} as Record<number, { user: any, stories: Story[], latestStory: Story }>);

    return Object.values(grouped);
  };

  const closeStoryViewer = () => {
    setViewerVisible(false);
  };

  const createStory = () => {
    // Navigate to camera for story creation
    router.push('/');
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={{ color: LadColors.primary }}>The Timeline</ThemedText>
        <ThemedText style={styles.subtitle}>
          {LadCopy.STORIES.TIMELINE_SUBTITLE()}
        </ThemedText>
      </ThemedView>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* My Story Section */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Your Timeline
          </ThemedText>
          {myStories.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {myStories.map((story) => (
                <TouchableOpacity 
                  key={story.id} 
                  style={styles.myStoryItem}
                  onPress={() => openStoryViewer(story)}
                >
                                      <View style={styles.myStoryPreview}>
                     <ProfilePicture 
                       size={48}
                       uri={story.user.profile_photo_url}
                       showVerified={story.user.is_verified}
                     />
                  </View>
                  <ThemedText style={styles.myStoryTime} numberOfLines={1}>
                    {formatStoryTime(story.created_at)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.addStoryButton} onPress={createStory}>
                <View style={styles.addStoryCircle}>
                  <IconSymbol name="plus" size={20} color={Colors[colorScheme ?? 'light'].text} />
                </View>
                <ThemedText style={styles.addStoryText}>Add</ThemedText>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <TouchableOpacity style={styles.myStoryCard} onPress={createStory}>
              <View style={styles.addStoryCircle}>
                <IconSymbol name="plus" size={24} color={Colors[colorScheme ?? 'light'].text} />
              </View>
              <ThemedText style={styles.addStoryText}>{LadCopy.STORIES.ADD_STORY()}</ThemedText>
            </TouchableOpacity>
          )}
        </ThemedView>

        {/* Friends Stories */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            The Crew's Latest
          </ThemedText>
          
          {storyFeed.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.friendStoriesScroll}>
              {getGroupedFriendStories().map((friendGroup) => (
                <TouchableOpacity 
                  key={friendGroup.user.id} 
                  style={styles.friendStoryCircle}
                  onPress={() => openFriendStories(friendGroup.user.id)}
                >
                  <View style={[
                    styles.storyCircle,
                    friendGroup.stories.some(s => !s.has_viewed) && styles.unviewedStoryCircle
                  ]}>
                                          <View style={styles.storyCircleInner}>
                       <ProfilePicture 
                         size={48}
                         uri={friendGroup.latestStory.user.profile_photo_url}
                         showVerified={friendGroup.latestStory.user.is_verified}
                       />
                    </View>
                  </View>
                  <ThemedText style={styles.friendStoryUsername} numberOfLines={1}>
                    {friendGroup.user.username}
                  </ThemedText>
                  {friendGroup.stories.length > 1 && (
                    <View style={styles.storyCountBadge}>
                      <ThemedText style={styles.storyCountText}>
                        {friendGroup.stories.length}
                      </ThemedText>
                    </View>
                  )}
                  {friendGroup.user.is_verified && (
                    <View style={styles.friendVerifiedBadge}>
                      <IconSymbol name="checkmark" size={8} color="white" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <ThemedView style={styles.emptyState}>
              <IconSymbol 
                name="camera.circle" 
                size={48} 
                color={Colors[colorScheme ?? 'light'].icon} 
              />
              <ThemedText style={styles.emptyText}>
                {LadCopy.STORIES.NO_STORIES()}
              </ThemedText>
              <ThemedText style={styles.emptySubtext}>
                When the crew drops content, you'll see it here
              </ThemedText>
            </ThemedView>
          )}
        </ThemedView>

        {/* Circles Section */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Your Circles
          </ThemedText>
          <TouchableOpacity style={styles.createCircleCard}>
            <IconSymbol 
              name="person.2.circle" 
              size={24} 
              color={Colors[colorScheme ?? 'light'].tint} 
            />
            <ThemedText style={styles.createCircleText}>
              Create a Circle
            </ThemedText>
            <ThemedText style={styles.createCircleSubtext}>
              Share stories with specific groups of friends
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>

      {/* Story Viewer Modal */}
      <StoryViewer
        visible={viewerVisible}
        stories={viewerStories}
        initialIndex={viewerInitialIndex}
        onClose={closeStoryViewer}
        onStoryChange={(index) => {
          // Optional: Update analytics or tracking
          console.log('Viewing story at index:', index);
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  subtitle: {
    opacity: 0.7,
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  myStoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderStyle: 'dashed',
  },
  addStoryCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addStoryText: {
    fontSize: 16,
  },
  storiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  storyCard: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  storyPreview: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  storyEmoji: {
    fontSize: 24,
  },
  storyUsername: {
    fontWeight: '600',
    marginBottom: 2,
  },
  storyTime: {
    fontSize: 12,
    opacity: 0.6,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    textAlign: 'center',
    opacity: 0.6,
    lineHeight: 20,
  },
  createCircleCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  createCircleText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  createCircleSubtext: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 14,
  },
  myStoryItem: {
    alignItems: 'center',
    marginRight: 12,
  },
  myStoryPreview: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  myStoryTime: {
    fontSize: 12,
    opacity: 0.6,
  },
  addStoryButton: {
    alignItems: 'center',
    marginLeft: 8,
  },
  friendStoriesScroll: {
    marginHorizontal: -8,
  },
  friendStoryCircle: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 70,
  },
  storyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginBottom: 8,
  },
  unviewedStoryCircle: {
    backgroundColor: '#007AFF',
  },
  storyCircleInner: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendStoryUsername: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  storyCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  storyCountText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  friendVerifiedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 