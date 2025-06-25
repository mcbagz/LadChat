import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  ScrollView, 
  View, 
  TouchableOpacity, 
  Alert, 
  Switch, 
  RefreshControl,
  TextInput,
  Modal 
} from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, Conversation } from '@/services/api';

type TabType = 'messages' | 'discover' | 'requests';

interface FriendRequest {
  id: number;
  sender_id: number;
  sender: {
    id: number;
    username: string;
    interests: string[];
    is_verified: boolean;
  };
  message?: string;
  created_at: string;
}

interface UserSearchResult {
  id: number;
  username: string;
  interests: string[];
  is_verified: boolean;
  friendship_status: 'none' | 'friends' | 'request_sent' | 'request_received';
}

interface Friend {
  friendship_id: number;
  friend: {
    id: number;
    username: string;
    interests: string[];
    is_verified: boolean;
  };
  created_at: string;
}

export default function FriendsScreen() {
  const colorScheme = useColorScheme();
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('messages');
  const [isOpenToFriends, setIsOpenToFriends] = useState(user?.open_to_friends || false);
  
  // Messages tab state - Initialize as empty arrays
  const [conversations, setConversations] = useState<Conversation[]>([]);
  
  // Discover tab state - Initialize as empty arrays
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  
  // Requests tab state - Initialize as empty arrays
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    // Sync the toggle with user data when it changes
    if (user) {
      setIsOpenToFriends(user.open_to_friends || false);
    }
  }, [user]);

  const loadData = async () => {
    switch (activeTab) {
      case 'messages':
        await loadConversations();
        break;
      case 'discover':
        await loadFriends();
        break;
      case 'requests':
        await loadFriendRequests();
        break;
    }
  };

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getConversations();
      if (response.success && response.data) {
        // Ensure data is always an array
        const conversationsData = Array.isArray(response.data) ? response.data : [];
        setConversations(conversationsData);
      } else {
        console.log('Failed to load conversations:', response.error);
        setConversations([]); // Reset to empty array on error
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      setConversations([]); // Reset to empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  const loadFriends = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getFriendsList();
      console.log('📥 FRIENDS LIST DEBUG - Raw API response:', response);
      
      if (response.success && response.data) {
        // Fix double nesting: response.data.data contains the actual friends array
        const actualData = response.data.data || response.data;
        const friendsData = Array.isArray(actualData) ? actualData : [];
        console.log('✅ FRIENDS LIST DEBUG - Processed friends data:', friendsData);
        console.log('✅ FRIENDS LIST DEBUG - Setting friends count:', friendsData.length);
        setFriends(friendsData);
      } else {
        console.log('❌ FRIENDS LIST DEBUG - Failed to load. Success:', response.success, 'Data:', response.data, 'Error:', response.error);
        setFriends([]); // Reset to empty array on error
      }
    } catch (error) {
      console.error('❌ FRIENDS LIST DEBUG - Exception:', error);
      setFriends([]); // Reset to empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  const loadFriendRequests = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getFriendRequests();
      console.log('📥 FRIEND REQUESTS DEBUG - Raw API response:', response);
      
      if (response.success && response.data) {
        // Fix double nesting: response.data.data contains the actual requests array
        const actualData = response.data.data || response.data;
        const requestsData = Array.isArray(actualData) ? actualData : [];
        console.log('✅ FRIEND REQUESTS DEBUG - Processed requests data:', requestsData);
        console.log('✅ FRIEND REQUESTS DEBUG - Setting requests count:', requestsData.length);
        setFriendRequests(requestsData);
      } else {
        console.log('❌ FRIEND REQUESTS DEBUG - Failed to load. Success:', response.success, 'Data:', response.data, 'Error:', response.error);
        setFriendRequests([]); // Reset to empty array on error
      }
    } catch (error) {
      console.error('❌ FRIEND REQUESTS DEBUG - Exception:', error);
      setFriendRequests([]); // Reset to empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    console.log('🔍 FRONTEND SEARCH DEBUG - Starting search for:', query);
    setIsSearching(true);
    try {
      const response = await apiClient.searchUsers(query, 20);
      console.log('📥 FRONTEND SEARCH DEBUG - Raw API response:', response);
      
      if (response.success && response.data) {
        // Fix double nesting: response.data.data contains the actual user array
        const actualData = response.data.data || response.data;
        const searchData = Array.isArray(actualData) ? actualData : [];
        console.log('✅ FRONTEND SEARCH DEBUG - Processed search data:', searchData);
        console.log('✅ FRONTEND SEARCH DEBUG - Setting search results count:', searchData.length);
        setSearchResults(searchData);
      } else {
        console.log('❌ FRONTEND SEARCH DEBUG - Search failed. Success:', response.success, 'Data:', response.data, 'Error:', response.error);
        setSearchResults([]); // Reset to empty array on error
      }
    } catch (error) {
      console.error('❌ FRONTEND SEARCH DEBUG - Exception during search:', error);
      setSearchResults([]); // Reset to empty array on error
    } finally {
      setIsSearching(false);
      console.log('🏁 FRONTEND SEARCH DEBUG - Search completed. Final searchResults state will be updated.');
    }
  };

  const sendFriendRequest = async (userId: number, username: string) => {
    try {
      const response = await apiClient.sendFriendRequest(userId, `Hey ${username}, let's be friends!`);
      if (response.success) {
        Alert.alert('Success', `Friend request sent to ${username}`);
        // Refresh search results to update status
        if (searchQuery.length >= 2) {
          await searchUsers(searchQuery);
        }
      } else {
        Alert.alert('Error', response.error || 'Failed to send friend request');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request');
    }
  };

  const respondToRequest = async (requestId: number, action: 'accept' | 'decline', username: string) => {
    try {
      const response = await apiClient.respondToFriendRequest(requestId, action);
      if (response.success) {
        Alert.alert(
          'Success', 
          action === 'accept' 
            ? `You are now friends with ${username}!` 
            : `Friend request from ${username} declined`
        );
        await loadFriendRequests();
        if (action === 'accept') {
          await loadFriends();
        }
      } else {
        Alert.alert('Error', response.error || `Failed to ${action} friend request`);
      }
    } catch (error) {
      console.error('Error responding to friend request:', error);
      Alert.alert('Error', `Failed to ${action} friend request`);
    }
  };

  const openConversation = (userId: number, username: string) => {
    // Navigate to chat screen
    router.push({
      pathname: '/chat' as any,
      params: {
        userId: userId.toString(),
        username: username,
      },
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const toggleOpenToFriends = async (value: boolean) => {
    setIsOpenToFriends(value);
    try {
      const success = await updateProfile({ open_to_friends: value });
      if (success) {
        // Success - the user context and state are already updated
        console.log('Successfully updated open_to_friends to', value);
      } else {
        // Revert the toggle if the API call failed
        setIsOpenToFriends(!value);
        Alert.alert('Error', 'Failed to update setting. Please try again.');
      }
    } catch (error) {
      // Revert the toggle if there was an error
      setIsOpenToFriends(!value);
      console.error('Error updating open_to_friends:', error);
      Alert.alert('Error', 'Failed to update setting. Please try again.');
    }
  };

  const formatLastMessageTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const getLastMessagePreview = (conversation: Conversation): string => {
    if (!conversation.last_message) return 'No messages yet';
    
    const message = conversation.last_message;
    if (message.message_type === 'media') {
      return message.media_type === 'photo' ? '📸 Photo' : '🎥 Video';
    }
    
    return message.content || 'Message';
  };

  const renderMessagesTab = () => (
    <View style={styles.tabContent}>
      {isLoading ? (
        <ThemedView style={styles.loadingState}>
          <ThemedText>Loading conversations...</ThemedText>
        </ThemedView>
      ) : !conversations || conversations.length === 0 ? (
        <ThemedView style={styles.emptyState}>
          <IconSymbol 
            name="message.circle" 
            size={48} 
            color={Colors[colorScheme ?? 'light'].icon} 
          />
          <ThemedText style={styles.emptyTitle}>No conversations yet</ThemedText>
          <ThemedText style={styles.emptyText}>
            Add friends to start chatting!
          </ThemedText>
        </ThemedView>
      ) : (
        <View style={styles.conversationsList}>
          {conversations?.map((conversation) => (
            <TouchableOpacity
              key={conversation.id}
              style={styles.conversationItem}
              onPress={() => openConversation(conversation.other_user_id, conversation.other_user.username)}
            >
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <IconSymbol 
                    name="person.crop.circle" 
                    size={48} 
                    color={Colors[colorScheme ?? 'light'].icon} 
                  />
                </View>
                {conversation.other_user.is_verified && (
                  <View style={styles.verifiedBadge}>
                    <IconSymbol name="checkmark" size={12} color="white" />
                  </View>
                )}
              </View>

              <View style={styles.conversationInfo}>
                <View style={styles.conversationHeader}>
                  <ThemedText style={styles.username}>
                    {conversation.other_user.username}
                  </ThemedText>
                  <ThemedText style={styles.timestamp}>
                    {formatLastMessageTime(conversation.updated_at)}
                  </ThemedText>
                </View>
                
                <View style={styles.lastMessageRow}>
                  <ThemedText 
                    style={[
                      styles.lastMessage,
                      conversation.unread_count > 0 && styles.unreadMessage
                    ]}
                    numberOfLines={1}
                  >
                    {getLastMessagePreview(conversation)}
                  </ThemedText>
                  
                  {conversation.unread_count > 0 && (
                    <View style={styles.unreadBadge}>
                      <ThemedText style={styles.unreadCount}>
                        {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>

              {conversation.is_muted && (
                <IconSymbol 
                  name="speaker.slash" 
                  size={16} 
                  color={Colors[colorScheme ?? 'light'].icon} 
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderDiscoverTab = () => (
    <View style={styles.tabContent}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <IconSymbol name="magnifyingglass" size={16} color={Colors[colorScheme ?? 'light'].icon} />
          <TextInput
            style={[styles.searchInput, { color: Colors[colorScheme ?? 'light'].text }]}
            placeholder="Search for friends..."
            placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              searchUsers(text);
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {isSearching && (
            <IconSymbol name="arrow.2.circlepath" size={16} color={Colors[colorScheme ?? 'light'].icon} />
          )}
        </View>
      </View>

      {/* Open to Friends Toggle */}
      <ThemedView style={styles.section}>
        <View style={styles.toggleSection}>
          <View style={styles.toggleInfo}>
            <ThemedText style={styles.toggleTitle}>Open to Friends</ThemedText>
            <ThemedText style={styles.toggleSubtitle}>
              Allow others to find and send you friend requests
            </ThemedText>
          </View>
          <Switch
            value={isOpenToFriends}
            onValueChange={toggleOpenToFriends}
            trackColor={{ false: '#767577', true: '#007AFF' }}
          />
        </View>
      </ThemedView>

      {/* Search Results */}
      {searchQuery.length >= 2 && (
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Search Results
          </ThemedText>
          
          {!searchResults || searchResults.length === 0 ? (
            <ThemedView style={styles.emptyState}>
              <IconSymbol 
                name="person.crop.circle.badge.questionmark" 
                size={48} 
                color={Colors[colorScheme ?? 'light'].icon} 
              />
              <ThemedText style={styles.emptyTitle}>No users found</ThemedText>
              <ThemedText style={styles.emptyText}>
                Try a different search term
              </ThemedText>
            </ThemedView>
          ) : (
            searchResults?.map((user) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <View style={styles.avatarContainer}>
                    <View style={styles.avatar}>
                      <IconSymbol 
                        name="person.crop.circle" 
                        size={40} 
                        color={Colors[colorScheme ?? 'light'].icon} 
                      />
                    </View>
                    {user.is_verified && (
                      <View style={styles.verifiedBadge}>
                        <IconSymbol name="checkmark" size={10} color="white" />
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.userDetails}>
                    <ThemedText style={styles.userUsername}>{user.username}</ThemedText>
                    <View style={styles.userInterests}>
                      {user.interests?.slice(0, 3).map((interest, index) => (
                        <View key={index} style={styles.interestTag}>
                          <ThemedText style={styles.interestText}>{interest}</ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.userActions}>
                  {user.friendship_status === 'none' && (
                    <TouchableOpacity 
                      style={styles.addButton}
                      onPress={() => sendFriendRequest(user.id, user.username)}
                    >
                      <IconSymbol name="person.badge.plus" size={16} color="white" />
                      <ThemedText style={styles.addButtonText}>Add</ThemedText>
                    </TouchableOpacity>
                  )}
                  {user.friendship_status === 'request_sent' && (
                    <View style={styles.statusButton}>
                      <ThemedText style={styles.statusText}>Requested</ThemedText>
                    </View>
                  )}
                  {user.friendship_status === 'friends' && (
                    <TouchableOpacity 
                      style={styles.messageButton}
                      onPress={() => openConversation(user.id, user.username)}
                    >
                      <IconSymbol name="message" size={16} color="#007AFF" />
                      <ThemedText style={styles.messageButtonText}>Message</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </ThemedView>
      )}

      {/* Current Friends */}
      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Your Friends ({friends?.length || 0})
        </ThemedText>
        
        {!friends || friends.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <IconSymbol 
              name="person.2.circle" 
              size={48} 
              color={Colors[colorScheme ?? 'light'].icon} 
            />
            <ThemedText style={styles.emptyTitle}>No friends yet</ThemedText>
            <ThemedText style={styles.emptyText}>
              Search for friends above to get started
            </ThemedText>
          </ThemedView>
        ) : (
          friends?.map((friendship) => (
            <View key={friendship.friendship_id} style={styles.friendCard}>
              <View style={styles.userInfo}>
                <View style={styles.avatarContainer}>
                  <View style={styles.avatar}>
                    <IconSymbol 
                      name="person.crop.circle" 
                      size={40} 
                      color={Colors[colorScheme ?? 'light'].icon} 
                    />
                  </View>
                  {friendship.friend.is_verified && (
                    <View style={styles.verifiedBadge}>
                      <IconSymbol name="checkmark" size={10} color="white" />
                    </View>
                  )}
                </View>
                
                <View style={styles.userDetails}>
                  <ThemedText style={styles.userUsername}>{friendship.friend.username}</ThemedText>
                  <View style={styles.userInterests}>
                    {friendship.friend.interests?.slice(0, 3).map((interest, index) => (
                      <View key={index} style={styles.interestTag}>
                        <ThemedText style={styles.interestText}>{interest}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.messageButton}
                onPress={() => openConversation(friendship.friend.id, friendship.friend.username)}
              >
                <IconSymbol name="message" size={16} color="#007AFF" />
                <ThemedText style={styles.messageButtonText}>Message</ThemedText>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ThemedView>
    </View>
  );

  const renderRequestsTab = () => (
    <View style={styles.tabContent}>
      {isLoading ? (
        <ThemedView style={styles.loadingState}>
          <ThemedText>Loading friend requests...</ThemedText>
        </ThemedView>
      ) : !friendRequests || friendRequests.length === 0 ? (
        <ThemedView style={styles.emptyState}>
          <IconSymbol 
            name="person.crop.circle.badge.plus" 
            size={48} 
            color={Colors[colorScheme ?? 'light'].icon} 
          />
          <ThemedText style={styles.emptyTitle}>No friend requests</ThemedText>
          <ThemedText style={styles.emptyText}>
            When someone sends you a friend request, it will appear here
          </ThemedText>
        </ThemedView>
      ) : (
        <View style={styles.requestsList}>
          {friendRequests?.map((request) => (
            <View key={request.id} style={styles.requestCard}>
              <View style={styles.userInfo}>
                <View style={styles.avatarContainer}>
                  <View style={styles.avatar}>
                    <IconSymbol 
                      name="person.crop.circle" 
                      size={40} 
                      color={Colors[colorScheme ?? 'light'].icon} 
                    />
                  </View>
                  {request.sender.is_verified && (
                    <View style={styles.verifiedBadge}>
                      <IconSymbol name="checkmark" size={10} color="white" />
                    </View>
                  )}
                </View>
                
                <View style={styles.userDetails}>
                  <ThemedText style={styles.userUsername}>{request.sender.username}</ThemedText>
                  {request.message && (
                    <ThemedText style={styles.requestMessage} numberOfLines={2}>
                      "{request.message}"
                    </ThemedText>
                  )}
                  <View style={styles.userInterests}>
                    {request.sender.interests?.slice(0, 3).map((interest, index) => (
                      <View key={index} style={styles.interestTag}>
                        <ThemedText style={styles.interestText}>{interest}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.requestActions}>
                <TouchableOpacity 
                  style={styles.acceptButton}
                  onPress={() => respondToRequest(request.id, 'accept', request.sender.username)}
                >
                  <IconSymbol name="checkmark" size={16} color="white" />
                  <ThemedText style={styles.acceptButtonText}>Accept</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.declineButton}
                  onPress={() => respondToRequest(request.id, 'decline', request.sender.username)}
                >
                  <IconSymbol name="xmark" size={16} color="white" />
                  <ThemedText style={styles.declineButtonText}>Decline</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Friends</ThemedText>
        <ThemedText style={styles.subtitle}>
          {activeTab === 'messages' && 'Chat with your lads'}
          {activeTab === 'discover' && 'Find and connect with friends'}
          {activeTab === 'requests' && 'Manage friend requests'}
        </ThemedText>
      </ThemedView>

      {/* Tab Selector */}
      <ThemedView style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
          onPress={() => setActiveTab('messages')}
        >
          <IconSymbol 
            name="message.fill" 
            size={16} 
            color={activeTab === 'messages' ? Colors[colorScheme ?? 'light'].tint : Colors[colorScheme ?? 'light'].icon} 
          />
          <ThemedText style={[
            styles.tabText,
            activeTab === 'messages' && styles.activeTabText
          ]}>
            Messages
          </ThemedText>
          {conversations && conversations.filter(c => c.unread_count > 0).length > 0 && (
            <View style={styles.tabBadge}>
              <ThemedText style={styles.tabBadgeText}>
                {conversations.filter(c => c.unread_count > 0).length}
              </ThemedText>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.activeTab]}
          onPress={() => setActiveTab('discover')}
        >
          <IconSymbol 
            name="person.2.fill" 
            size={16} 
            color={activeTab === 'discover' ? Colors[colorScheme ?? 'light'].tint : Colors[colorScheme ?? 'light'].icon} 
          />
          <ThemedText style={[
            styles.tabText,
            activeTab === 'discover' && styles.activeTabText
          ]}>
            Discover
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <IconSymbol 
            name="person.crop.circle.badge.plus" 
            size={16} 
            color={activeTab === 'requests' ? Colors[colorScheme ?? 'light'].tint : Colors[colorScheme ?? 'light'].icon} 
          />
          <ThemedText style={[
            styles.tabText,
            activeTab === 'requests' && styles.activeTabText
          ]}>
            Requests
          </ThemedText>
          {friendRequests && friendRequests.length > 0 && (
            <View style={styles.tabBadge}>
              <ThemedText style={styles.tabBadgeText}>
                {friendRequests.length}
              </ThemedText>
            </View>
          )}
        </TouchableOpacity>
      </ThemedView>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'messages' && renderMessagesTab()}
        {activeTab === 'discover' && renderDiscoverTab()}
        {activeTab === 'requests' && renderRequestsTab()}
      </ScrollView>
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
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 2,
    gap: 6,
    position: 'relative',
  },
  activeTab: {
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  tabBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    paddingHorizontal: 20,
  },
  // Search functionality
  searchContainer: {
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  // Messages styles
  loadingState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    lineHeight: 20,
  },
  conversationsList: {
    paddingVertical: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.6,
  },
  lastMessageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    opacity: 0.7,
    marginRight: 8,
  },
  unreadMessage: {
    opacity: 1,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  // Discover styles
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  toggleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  toggleSubtitle: {
    fontSize: 14,
    opacity: 0.6,
    lineHeight: 18,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    marginBottom: 8,
  },
  friendCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userDetails: {
    flex: 1,
  },
  userUsername: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userInterests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  interestTag: {
    backgroundColor: 'rgba(0,122,255,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  interestText: {
    fontSize: 10,
    color: '#007AFF',
    fontWeight: '500',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 4,
  },
  addButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,122,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 4,
  },
  messageButtonText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statusButton: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
  },
  // Requests styles
  requestsList: {
    paddingVertical: 8,
  },
  requestCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    marginBottom: 12,
  },
  requestMessage: {
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.8,
    marginBottom: 4,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 4,
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  declineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 4,
  },
  declineButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
}); 