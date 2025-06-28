import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl,
  FlatList
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LadColors, Colors, getLadColor } from '@/constants/Colors';
import { LadCopy } from '@/utils/LadCopy';
import { apiClient } from '@/services/api';
import ProfilePicture from '@/components/ProfilePicture';

interface SearchResult {
  id: number;
  username: string;
  bio?: string;
  interests: string[];
  is_verified: boolean;
  profile_photo_url?: string;
  friendship_status: 'none' | 'friends' | 'request_sent' | 'request_received';
}

interface FriendRecommendation {
  user_id: number;
  username: string;
  bio?: string;
  interests: string[];
  profile_photo_url?: string;
  similarity_score: number;
  mutual_friends_count: number;
  reason: string;
}

export default function SearchUsersScreen() {
  const colorScheme = useColorScheme();
  const params = useLocalSearchParams();
  const [searchQuery, setSearchQuery] = useState(params.query as string || '');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [recommendations, setRecommendations] = useState<FriendRecommendation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'recommendations'>('recommendations');

  // Load AI recommendations on screen focus
  useFocusEffect(
    useCallback(() => {
      loadRecommendations();
    }, [])
  );

  const loadRecommendations = async () => {
    setIsLoadingRecommendations(true);
    try {
      const response = await apiClient.get('/recommendations/friends', {
        params: { limit: 15 }
      });
      
      if (response.data.success && response.data.data) {
        setRecommendations(response.data.data);
      } else {
        setRecommendations([]);
      }
    } catch (error) {
      console.error('Failed to load friend recommendations:', error);
      setRecommendations([]);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await apiClient.get('/friends/search', {
        params: { q: query, limit: 20 }
      });
      
      if (response.data.success && response.data.data) {
        const actualData = response.data.data.data || response.data.data;
        setSearchResults(Array.isArray(actualData) ? actualData : []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (userId: number, username: string) => {
    try {
      const response = await apiClient.post('/friends/request', {
        recipient_id: userId,
        message: LadCopy.FRIENDS.FRIEND_REQUEST_MESSAGE(username)
      });
      
      if (response.data.success) {
        Alert.alert(LadCopy.QUICK.SUCCESS, LadCopy.FRIENDS.FRIEND_REQUEST_SENT());
        
        // Update local state
        setSearchResults(prev => prev.map(user => 
          user.id === userId 
            ? { ...user, friendship_status: 'request_sent' }
            : user
        ));
        
        // Refresh recommendations
        await loadRecommendations();
      } else {
        Alert.alert(LadCopy.QUICK.ERROR, response.data.error || 'Failed to send friend request');
      }
    } catch (error) {
      Alert.alert(LadCopy.QUICK.ERROR, 'Failed to send friend request');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'recommendations') {
      await loadRecommendations();
    } else if (searchQuery.length >= 2) {
      await searchUsers(searchQuery);
    }
    setRefreshing(false);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.length >= 2) {
      searchUsers(text);
    } else {
      setSearchResults([]);
    }
  };

  const RecommendationItem = ({ item }: { item: FriendRecommendation }) => (
    <View style={styles.recommendationCard}>
      <View style={styles.userInfo}>
        <ProfilePicture
          uri={item.profile_photo_url}
          size={60}
          showVerified={false}
          style={{ marginRight: 16 }}
        />
        
        <View style={styles.userDetails}>
          <ThemedText style={styles.username}>{item.username}</ThemedText>
          
          {item.bio && (
            <ThemedText style={styles.bio} numberOfLines={2}>
              {item.bio}
            </ThemedText>
          )}
          
          <View style={styles.matchInfo}>
            <View style={styles.matchScore}>
              <IconSymbol name="star.fill" size={12} color={LadColors.primary} />
              <ThemedText style={styles.matchText}>
                {Math.round(item.similarity_score * 100)}% match
              </ThemedText>
            </View>
            
            {item.mutual_friends_count > 0 && (
              <View style={styles.mutualFriends}>
                <IconSymbol name="person.2.fill" size={12} color={getLadColor(colorScheme, 'text', 'secondary')} />
                <ThemedText style={styles.mutualText}>
                  {item.mutual_friends_count} mutual
                </ThemedText>
              </View>
            )}
          </View>
          
          <View style={styles.interestsContainer}>
            {item.interests.slice(0, 3).map((interest, index) => (
              <View key={index} style={styles.interestTag}>
                <ThemedText style={styles.interestText}>{interest}</ThemedText>
              </View>
            ))}
          </View>
          
          <ThemedText style={styles.reason} numberOfLines={2}>
            {item.reason}
          </ThemedText>
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => sendFriendRequest(item.user_id, item.username)}
      >
        <IconSymbol name="person.badge.plus" size={18} color="white" />
        <ThemedText style={styles.addButtonText}>Add</ThemedText>
      </TouchableOpacity>
    </View>
  );

  const SearchResultItem = ({ item }: { item: SearchResult }) => (
    <View style={styles.searchResultCard}>
      <View style={styles.userInfo}>
        <ProfilePicture
          uri={item.profile_photo_url}
          size={50}
          showVerified={item.is_verified}
          style={{ marginRight: 12 }}
        />
        
        <View style={styles.userDetails}>
          <ThemedText style={styles.username}>{item.username}</ThemedText>
          
          {item.bio && (
            <ThemedText style={styles.bio} numberOfLines={1}>
              {item.bio}
            </ThemedText>
          )}
          
          <View style={styles.interestsContainer}>
            {item.interests.slice(0, 3).map((interest, index) => (
              <View key={index} style={styles.interestTag}>
                <ThemedText style={styles.interestText}>{interest}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      </View>
      
      {item.friendship_status === 'none' && (
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => sendFriendRequest(item.id, item.username)}
        >
          <IconSymbol name="person.badge.plus" size={16} color="white" />
        </TouchableOpacity>
      )}
      
      {item.friendship_status === 'request_sent' && (
        <View style={styles.pendingButton}>
          <ThemedText style={styles.pendingText}>Sent</ThemedText>
        </View>
      )}
      
      {item.friendship_status === 'friends' && (
        <View style={styles.friendsButton}>
          <IconSymbol name="checkmark" size={16} color={LadColors.success} />
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={LadColors.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.title}>Find Your People</ThemedText>
          <View style={styles.placeholder} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <IconSymbol name="magnifyingglass" size={16} color={getLadColor(colorScheme, 'text', 'tertiary')} />
            <TextInput
              style={[styles.searchInput, { color: Colors[colorScheme ?? 'light'].text }]}
              placeholder={LadCopy.FRIENDS.SEARCH_PLACEHOLDER()}
              placeholderTextColor={getLadColor(colorScheme, 'text', 'tertiary')}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <IconSymbol name="xmark.circle.fill" size={16} color={getLadColor(colorScheme, 'text', 'tertiary')} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'recommendations' && styles.activeTab]}
            onPress={() => setActiveTab('recommendations')}
          >
            <IconSymbol 
              name="sparkles" 
              size={16} 
              color={activeTab === 'recommendations' ? LadColors.primary : getLadColor(colorScheme, 'text', 'secondary')} 
            />
            <ThemedText style={[
              styles.tabText,
              activeTab === 'recommendations' && styles.activeTabText
            ]}>
              AI Picks
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'search' && styles.activeTab]}
            onPress={() => setActiveTab('search')}
          >
            <IconSymbol 
              name="magnifyingglass" 
              size={16} 
              color={activeTab === 'search' ? LadColors.primary : getLadColor(colorScheme, 'text', 'secondary')} 
            />
            <ThemedText style={[
              styles.tabText,
              activeTab === 'search' && styles.activeTabText
            ]}>
              Search ({searchResults.length})
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'recommendations' ? (
            isLoadingRecommendations ? (
              <View style={styles.loadingContainer}>
                <ThemedText style={styles.loadingText}>
                  {LadCopy.SYSTEM.LOADING()}
                </ThemedText>
              </View>
            ) : recommendations.length === 0 ? (
              <View style={styles.emptyContainer}>
                <IconSymbol 
                  name="sparkles" 
                  size={64} 
                  color={getLadColor(colorScheme, 'text', 'tertiary')} 
                />
                <ThemedText style={styles.emptyTitle}>
                  No recommendations yet
                </ThemedText>
                <ThemedText style={styles.emptySubtitle}>
                  Update your interests and turn on "Open to Friends" to get AI-powered recommendations
                </ThemedText>
                <TouchableOpacity 
                  style={styles.primaryButton}
                  onPress={() => router.push('/(tabs)/profile')}
                >
                  <ThemedText style={styles.primaryButtonText}>
                    Update Profile
                  </ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={recommendations}
                keyExtractor={(item) => item.user_id.toString()}
                renderItem={({ item }) => <RecommendationItem item={item} />}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContainer}
              />
            )
          ) : (
            searchQuery.length < 2 ? (
              <View style={styles.searchPromptContainer}>
                <IconSymbol 
                  name="magnifyingglass.circle" 
                  size={64} 
                  color={getLadColor(colorScheme, 'text', 'tertiary')} 
                />
                <ThemedText style={styles.searchPromptTitle}>
                  Search for lads
                </ThemedText>
                <ThemedText style={styles.searchPromptSubtitle}>
                  Type at least 2 characters to start searching
                </ThemedText>
              </View>
            ) : isSearching ? (
              <View style={styles.loadingContainer}>
                <ThemedText style={styles.loadingText}>
                  Searching for lads...
                </ThemedText>
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.emptyContainer}>
                <IconSymbol 
                  name="person.crop.circle.badge.questionmark" 
                  size={64} 
                  color={getLadColor(colorScheme, 'text', 'tertiary')} 
                />
                <ThemedText style={styles.emptyTitle}>
                  No lads found
                </ThemedText>
                <ThemedText style={styles.emptySubtitle}>
                  Try a different search term or check out our AI recommendations
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => <SearchResultItem item={item} />}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContainer}
              />
            )
          )}
        </View>
      </ThemedView>
    </SafeAreaView>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${LadColors.primary}15`,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: LadColors.primary,
  },
  placeholder: {
    width: 40,
  },
  
  // Search
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
  },
  
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: `${LadColors.primary}15`,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  activeTabText: {
    color: LadColors.primary,
  },
  
  // Content
  content: {
    flex: 1,
  },
  listContainer: {
    padding: 20,
  },
  
  // Recommendation Cards
  recommendationCard: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${LadColors.primary}20`,
  },
  
  // Search Result Cards
  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  
  // User Info
  userInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  
  // Match Info
  matchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchScore: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${LadColors.primary}15`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  matchText: {
    fontSize: 12,
    fontWeight: '600',
    color: LadColors.primary,
    marginLeft: 4,
  },
  mutualFriends: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mutualText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
    opacity: 0.7,
  },
  
  // Interests
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  interestTag: {
    backgroundColor: `${LadColors.primary}15`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  interestText: {
    fontSize: 12,
    color: LadColors.primary,
    fontWeight: '500',
  },
  
  // Reason
  reason: {
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.8,
    marginTop: 4,
  },
  
  // Buttons
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LadColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  pendingButton: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
  },
  friendsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${LadColors.success}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  searchPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  searchPromptTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  searchPromptSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: LadColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 