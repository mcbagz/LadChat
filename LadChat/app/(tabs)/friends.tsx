import React, { useState, useEffect, useCallback } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LadColors, Colors, getLadColor } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, Conversation, GroupChat, FriendRecommendation } from '@/services/api';
import FriendProfileModal from '@/components/FriendProfileModal';
import GroupCreationModal from '@/components/GroupCreationModal';
import ProfilePicture from '@/components/ProfilePicture';
import { LadCopy } from '@/utils/LadCopy';

type TabType = 'chats' | 'discover' | 'requests';

interface FriendRequest {
  id: number;
  requester: {
    id: number;
    username: string;
    bio?: string;
    interests: string[];
    is_verified: boolean;
    profile_photo_url?: string;
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
    bio?: string;
    interests: string[];
    is_verified: boolean;
    profile_photo_url?: string;
  };
  created_at: string;
}

export default function FriendsScreen() {
  const colorScheme = useColorScheme();
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('chats');
  const [isOpenToFriends, setIsOpenToFriends] = useState(user?.open_to_friends || false);
  
  // Chats tab state - combining messages and groups
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [allChats, setAllChats] = useState<Conversation[]>([]);
  
  // Discover tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false); // Control when to show results
  const [friends, setFriends] = useState<Friend[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<FriendRecommendation[]>([]);
  
  // Requests tab state
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  
  // Modal states
  const [showFriendProfile, setShowFriendProfile] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [showGroupCreation, setShowGroupCreation] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    // Sync the toggle with user data when it changes
    if (user) {
      setIsOpenToFriends(user.open_to_friends || false);
    }
  }, [user]);

  // Combine and sort chats when conversations or groups change
  useEffect(() => {
    const combined = [...conversations];
    setAllChats(combined.sort((a, b) => 
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    ));
  }, [conversations, groups]);

  const loadData = async () => {
    switch (activeTab) {
      case 'chats':
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
      console.log('🔍 CONVERSATIONS DEBUG - Loading all conversations and groups...');
      // Load direct conversations, group chats, and unread chat summary
      const [conversationsResponse, groupsResponse, chatSummaryResponse] = await Promise.all([
        apiClient.getConversations(),
        apiClient.getUserGroups(),
        apiClient.getChatSummary()
      ]);
      
      console.log('📥 CONVERSATIONS DEBUG - Direct conversations response:', conversationsResponse);
      console.log('📥 CONVERSATIONS DEBUG - Groups response:', groupsResponse);
      console.log('📥 CONVERSATIONS DEBUG - Chat summary response:', chatSummaryResponse);
      
      let allConversations: any[] = [];
      
      // Process direct conversations
      if (conversationsResponse.success && conversationsResponse.data) {
        const conversationsData = Array.isArray(conversationsResponse.data) ? conversationsResponse.data : (conversationsResponse.data.data || []);
        
        const transformedConversations = conversationsData.map((conv: any) => {
          const transformed = {
            ...conv,
            chat_type: 'direct',
            chat_id: conv.id,
            chat_name: conv.other_user?.username || 'Unknown User',
            last_message_at: conv.updated_at || conv.last_message?.created_at || new Date().toISOString(),
            last_message_preview: conv.last_message?.content || (conv.last_message?.message_type === 'media' ? '📷 Photo' : 'No messages yet'),
            member_count: 2
          };
          
          console.log(`📋 DIRECT CONVERSATION ${conv.id}:`, {
            username: conv.other_user?.username,
            chat_type: 'direct'
          });
          
          return transformed;
        });
        
        allConversations = [...transformedConversations];
      }
      
      // Process group chats
      if (groupsResponse.success && groupsResponse.data) {
        const groupsData = groupsResponse.data.groups || groupsResponse.data.data || groupsResponse.data;
        
        if (Array.isArray(groupsData)) {
          const transformedGroups = groupsData.map((group: any) => {
            // Better handling of last message preview for groups
            let lastMessagePreview = 'No messages yet';
            if (group.last_message) {
              if (group.last_message.content) {
                lastMessagePreview = group.last_message.content;
              } else if (group.last_message.message_type === 'media') {
                lastMessagePreview = group.last_message.media_type === 'photo' ? '📷 Photo' : '🎥 Video';
              }
            } else if (group.last_message_preview) {
              lastMessagePreview = group.last_message_preview;
            }
            
            const transformed = {
              ...group,
              chat_type: 'group',
              chat_id: group.id,
              chat_name: group.name,
              group_name: group.name,
              last_message_at: group.last_message?.created_at || group.last_message_at || group.updated_at || new Date().toISOString(),
              last_message_preview: lastMessagePreview,
              other_user: null
            };
            
            console.log(`📋 GROUP CONVERSATION ${group.id}:`, {
              name: group.name,
              chat_type: 'group',
              member_count: group.member_count,
              last_message_preview: lastMessagePreview
            });
            
            return transformed;
          });
          
          allConversations = [...allConversations, ...transformedGroups];
        }
      }
      
      console.log('📋 TOTAL CONVERSATIONS FOUND:', allConversations.length);
      
      // Merge unread counts from chat summary if available
      if (chatSummaryResponse.success && chatSummaryResponse.data) {
        const unreadData = Array.isArray(chatSummaryResponse.data) ? chatSummaryResponse.data : (chatSummaryResponse.data.data || []);
        
        const conversationsWithUnread = allConversations.map((conv: any) => {
          const unreadConv = unreadData.find((u: any) => 
            u.chat_type === conv.chat_type && u.chat_id === conv.chat_id
          );
          return {
            ...conv,
            unread_count: unreadConv?.unread_count || 0
          };
        });
        
        console.log('✅ CONVERSATIONS DEBUG - Final conversations with unread counts:', conversationsWithUnread);
        setConversations(conversationsWithUnread);
      } else {
        const conversationsWithZeroUnread = allConversations.map((conv: any) => ({
          ...conv,
          unread_count: 0
        }));
        console.log('✅ CONVERSATIONS DEBUG - Final conversations (no unread info):', conversationsWithZeroUnread);
        setConversations(conversationsWithZeroUnread);
      }
    } catch (error) {
      console.error('❌ CONVERSATIONS DEBUG - Exception:', error);
      setConversations([]);
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
        const actualData = response.data.data || response.data;
        const friendsData = Array.isArray(actualData) ? actualData : [];
        console.log('✅ FRIENDS LIST DEBUG - Processed friends data:', friendsData);
        setFriends(friendsData);
      } else {
        console.log('❌ FRIENDS LIST DEBUG - Failed to load. Success:', response.success, 'Data:', response.data, 'Error:', response.error);
        setFriends([]);
      }
    } catch (error) {
      console.error('❌ FRIENDS LIST DEBUG - Exception:', error);
      setFriends([]);
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
        const actualData = response.data.data || response.data;
        const requestsData = Array.isArray(actualData) ? actualData : [];
        console.log('✅ FRIEND REQUESTS DEBUG - Processed requests data:', requestsData);
        setFriendRequests(requestsData);
      } else {
        console.log('❌ FRIEND REQUESTS DEBUG - Failed to load. Success:', response.success, 'Data:', response.data, 'Error:', response.error);
        setFriendRequests([]);
      }
    } catch (error) {
      console.error('❌ FRIEND REQUESTS DEBUG - Exception:', error);
      setFriendRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    console.log('🔍 FRONTEND SEARCH DEBUG - Starting search for:', query);
    setIsSearching(true);
    setShowSearchResults(true); // Show results when search is performed
    try {
      const response = await apiClient.searchUsers(query, 20);
      console.log('📥 FRONTEND SEARCH DEBUG - Raw API response:', response);
      
      if (response.success && response.data) {
        const actualData = response.data.data || response.data;
        const searchData = Array.isArray(actualData) ? actualData : [];
        console.log('✅ FRONTEND SEARCH DEBUG - Processed search data:', searchData);
        setSearchResults(searchData);
      } else {
        console.log('❌ FRONTEND SEARCH DEBUG - Search failed. Success:', response.success, 'Data:', response.data, 'Error:', response.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('❌ FRONTEND SEARCH DEBUG - Exception during search:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const getAIFriendRecommendations = async () => {
    setIsLoadingAI(true);
    try {
      console.log('🤖 AI RECOMMENDATIONS - Loading friend recommendations...');
      const response = await apiClient.getFriendRecommendations(10);
      
      if (response.success && response.data) {
        // Handle direct array response from the API
        const recommendationsData = Array.isArray(response.data) ? response.data : [];
        console.log('✅ AI RECOMMENDATIONS - Got recommendations:', recommendationsData);
        setAiRecommendations(recommendationsData);
      } else {
        console.log('❌ AI RECOMMENDATIONS - Failed to load:', response.error);
        setAiRecommendations([]);
      }
    } catch (error) {
      console.error('❌ AI RECOMMENDATIONS - Exception:', error);
      setAiRecommendations([]);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const sendFriendRequest = async (userId: number, username: string) => {
    try {
      const response = await apiClient.sendFriendRequest(userId, `Hey ${username}, let's be friends!`);
      if (response.success) {
        Alert.alert(LadCopy.QUICK.SUCCESS, LadCopy.FRIENDS.FRIEND_REQUEST_SENT());
        // Don't auto-refresh search - let user manually search if needed
      } else {
        Alert.alert(LadCopy.QUICK.ERROR, response.error || 'Failed to send friend request');
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
          LadCopy.QUICK.SUCCESS, 
          action === 'accept' 
            ? LadCopy.FRIENDS.NEW_FRIEND(username)
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

  const openConversation = async (conversation: any) => {
    console.log('💬 OPENING CONVERSATION:', conversation);
    
    // Detect conversation type from actual data structure
    const isDirectChat = !!conversation.other_user;
    const chatType = isDirectChat ? 'direct' : 'group';
    const chatId = conversation.chat_id || conversation.id;
    
    console.log('🔍 CONVERSATION ANALYSIS:', {
      isDirectChat,
      chatType,
      chatId,
      hasOtherUser: !!conversation.other_user,
      otherUserName: conversation.other_user?.username,
      groupName: conversation.group_name || conversation.chat_name || conversation.name
    });
    
    try {
      // Mark chat as opened to clear unread notifications
      await apiClient.markChatAsOpened(chatType, chatId);
      console.log('✅ Marked chat as opened successfully');
    } catch (error) {
      console.error('❌ Error marking chat as opened:', error);
      // Continue with navigation even if marking as opened fails
    }
    
    try {
      if (isDirectChat && conversation.other_user) {
        console.log('🚀 Navigating to direct chat with user:', conversation.other_user.username);
        router.push({
          pathname: '/chat' as any,
          params: {
            userId: conversation.other_user.id.toString(),
            username: conversation.other_user.username,
          },
        });
      } else if (!isDirectChat) {
        const groupName = conversation.group_name || conversation.chat_name || conversation.name || `Group ${chatId}`;
        console.log('🚀 Navigating to group chat:', groupName, 'with ID:', chatId);
        router.push({
          pathname: '/messages/chat' as any,
          params: {
            groupId: chatId.toString(),
            groupName: groupName,
            isGroup: 'true',
          },
        });
      } else {
        console.error('❌ Unable to determine conversation type:', conversation);
        Alert.alert('Error', 'Unable to open this conversation');
      }
    } catch (error) {
      console.error('❌ Error navigating to conversation:', error);
      Alert.alert('Error', 'Failed to open conversation');
    }
  };

  const openDirectConversation = (userId: number, username: string) => {
    router.push({
      pathname: '/chat' as any,
      params: {
        userId: userId.toString(),
        username: username,
      },
    });
  };

  const viewFriendProfile = (friendId: number) => {
    setSelectedFriendId(friendId);
    setShowFriendProfile(true);
  };

  const handleRemoveFriend = async (friendId: number, username: string) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${username} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiClient.removeFriend(friendId);
              if (response.success) {
                Alert.alert('Success', `${username} has been removed from your friends`);
                await loadFriends();
              } else {
                Alert.alert('Error', response.error || 'Failed to remove friend');
              }
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend');
            }
          }
        }
      ]
    );
  };

  const handleGroupCreated = async (group: GroupChat) => {
    console.log('🎉 GROUP CREATED - Switching to chats tab and refreshing...');
    setActiveTab('chats');
    await new Promise(resolve => setTimeout(resolve, 500));
    await loadConversations();
    Alert.alert('Success', `Group "${group.name}" created successfully!`);
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
        console.log('Successfully updated open_to_friends to', value);
      } else {
        setIsOpenToFriends(!value);
        Alert.alert('Error', 'Failed to update setting. Please try again.');
      }
    } catch (error) {
      setIsOpenToFriends(!value);
      console.error('Error updating open_to_friends:', error);
      Alert.alert('Error', 'Failed to update setting. Please try again.');
    }
  };

  const formatLastMessageTime = (timestamp: string): string => {
    try {
    const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Recently';
      }
      
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
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Recently';
    }
  };

  const getLastMessagePreview = (conversation: Conversation): string => {
    return conversation.last_message_preview || 'No messages yet';
  };

  const renderChatsTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Create Group Button */}
      <TouchableOpacity 
        style={styles.createGroupButton}
        onPress={() => setShowGroupCreation(true)}
      >
        <View style={styles.createGroupContent}>
          <View style={styles.createGroupIcon}>
            <IconSymbol name="plus" size={20} color="white" />
          </View>
          <View style={styles.createGroupText}>
            <ThemedText style={styles.createGroupTitle}>Create New Group</ThemedText>
            <ThemedText style={styles.createGroupSubtitle}>Start a group with your friends</ThemedText>
          </View>
        </View>
      </TouchableOpacity>

      {isLoading ? (
        <ThemedView style={styles.loadingState}>
          <ThemedText>{LadCopy.SYSTEM.LOADING()}</ThemedText>
        </ThemedView>
      ) : !allChats || allChats.length === 0 ? (
        <ThemedView style={styles.emptyState}>
          <IconSymbol 
            name="message.circle" 
            size={48} 
            color={Colors[colorScheme ?? 'light'].icon} 
          />
          <ThemedText style={styles.emptyTitle}>No chats yet</ThemedText>
          <ThemedText style={styles.emptyText}>
            Start chatting with friends or create a group!
          </ThemedText>
          
          <TouchableOpacity 
            style={styles.findFriendsButton}
            onPress={() => setActiveTab('discover')}
          >
            <IconSymbol name="sparkles" size={16} color="white" />
            <ThemedText style={styles.findFriendsButtonText}>
              Find Friends
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      ) : (
        <View style={styles.conversationsList}>
          {allChats.map((conversation, index) => (
            <TouchableOpacity
              key={`${conversation.chat_type}-${conversation.chat_id}-${index}`}
              style={styles.conversationItem}
              onPress={() => openConversation(conversation)}
            >
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <IconSymbol 
                    name={conversation.chat_type === 'group' ? "person.3.fill" : "person.crop.circle"} 
                    size={48} 
                    color={Colors[colorScheme ?? 'light'].icon} 
                  />
                </View>
                {conversation.chat_type === 'direct' && conversation.other_user?.profile_photo_url && (
                  <ProfilePicture
                    uri={conversation.other_user.profile_photo_url}
                    size={48}
                    style={styles.avatar}
                  />
                )}
              </View>

              <View style={styles.conversationInfo}>
                <View style={styles.conversationHeader}>
                  <ThemedText style={styles.username}>
                    {conversation.chat_type === 'direct' 
                      ? conversation.other_user?.username || 'Unknown User'
                      : conversation.group_name || conversation.chat_name || `Group ${conversation.chat_id}`
                    }
                  </ThemedText>
                  <ThemedText style={styles.timestamp}>
                    {formatLastMessageTime(conversation.last_message_at)}
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

                {conversation.chat_type === 'group' && conversation.member_count && (
                  <ThemedText style={styles.groupMemberCount}>
                    {conversation.member_count} member{conversation.member_count !== 1 ? 's' : ''}
                  </ThemedText>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderDiscoverTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <IconSymbol name="magnifyingglass" size={16} color={getLadColor(colorScheme ?? 'light', 'text', 'tertiary')} />
          <TextInput
            style={[styles.searchInput, { color: Colors[colorScheme ?? 'light'].text }]}
            placeholder="Search for friends..."
            placeholderTextColor={getLadColor(colorScheme ?? 'light', 'text', 'tertiary')}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              // Clear search results when query is too short or when typing
              if (text.length < 2) {
                setSearchResults([]);
                setShowSearchResults(false);
              } else {
                setShowSearchResults(false); // Hide results until search button is clicked
              }
            }}
            onSubmitEditing={() => searchUsers(searchQuery)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length >= 2 && (
            <TouchableOpacity 
              style={styles.searchButton}
              onPress={() => searchUsers(searchQuery)}
              disabled={isSearching}
            >
              {isSearching ? (
                <IconSymbol name="arrow.2.circlepath" size={16} color="white" />
              ) : (
                <ThemedText style={styles.searchButtonText}>Search</ThemedText>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results - Show only when search button is clicked */}
      {showSearchResults && searchQuery.length >= 2 && (
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
                    <ThemedText style={styles.userBio} numberOfLines={2}>
                      {user.bio}
                    </ThemedText>
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
                      style={styles.addFriendButton}
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
                      onPress={() => openDirectConversation(user.id, user.username)}
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

      {/* AI Friend Suggestions Button */}
      <TouchableOpacity 
        style={styles.aiSuggestButton}
        onPress={getAIFriendRecommendations}
        disabled={isLoadingAI}
      >
        <View style={styles.aiSuggestContent}>
          <IconSymbol 
            name={isLoadingAI ? "arrow.2.circlepath" : "sparkles"} 
            size={20} 
            color={LadColors.primary} 
          />
          <ThemedText style={styles.aiSuggestText}>
            {isLoadingAI ? 'Finding suggestions...' : 'Suggest a friend with AI'}
          </ThemedText>
        </View>
      </TouchableOpacity>

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

      {/* Current Friends */}
      {friends && friends.length > 0 && (
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Your Friends ({friends.length})
          </ThemedText>
          
          <View style={styles.friendsList}>
            {friends.map((friendship) => (
              <TouchableOpacity 
                key={friendship.friendship_id} 
                style={styles.friendCard}
                onPress={() => viewFriendProfile(friendship.friend.id)}
                activeOpacity={0.7}
              >
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
                    <ThemedText style={styles.userBio} numberOfLines={2}>
                      {friendship.friend.bio}
                    </ThemedText>
                    <View style={styles.userInterests}>
                      {friendship.friend.interests?.slice(0, 3).map((interest, index) => (
                        <View key={index} style={styles.interestTag}>
                          <ThemedText style={styles.interestText}>{interest}</ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.userActions}>
                  <TouchableOpacity 
                    style={styles.messageButton}
                    onPress={(e) => {
                      e.stopPropagation(); // Prevent triggering profile view
                      openDirectConversation(friendship.friend.id, friendship.friend.username);
                    }}
                  >
                    <IconSymbol name="message" size={16} color="#007AFF" />
                    <ThemedText style={styles.messageButtonText}>Message</ThemedText>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ThemedView>
      )}

      {/* AI Recommendations */}
      {aiRecommendations.length > 0 && (
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            AI Friend Suggestions
          </ThemedText>
          
          {aiRecommendations.map((user) => (
              <View key={user.user_id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <View style={styles.avatarContainer}>
                    <View style={styles.avatar}>
                      <IconSymbol 
                        name="person.crop.circle" 
                        size={40} 
                        color={Colors[colorScheme ?? 'light'].icon} 
                      />
                    </View>
                    {user.profile_photo_url && (
                      <ProfilePicture
                        uri={user.profile_photo_url}
                        size={40}
                        style={styles.avatar}
                      />
                    )}
                  </View>
                  
                  <View style={styles.userDetails}>
                    <ThemedText style={styles.userUsername}>{user.username}</ThemedText>
                    <ThemedText style={styles.userBio} numberOfLines={2}>
                      {user.bio}
                    </ThemedText>
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
                  <TouchableOpacity 
                    style={styles.addFriendButton}
                    onPress={() => sendFriendRequest(user.user_id, user.username)}
                  >
                    <IconSymbol name="person.badge.plus" size={16} color="white" />
                    <ThemedText style={styles.addButtonText}>Add</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
          ))}
        </ThemedView>
      )}

    </ScrollView>
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
                  {request.requester.is_verified && (
                    <View style={styles.verifiedBadge}>
                      <IconSymbol name="checkmark" size={10} color="white" />
                    </View>
                  )}
                </View>
                
                <View style={styles.userDetails}>
                  <ThemedText style={styles.userUsername}>{request.requester.username}</ThemedText>
                  {request.message && (
                    <ThemedText style={styles.requestMessage} numberOfLines={2}>
                      "{request.message}"
                    </ThemedText>
                  )}
                  <View style={styles.userInterests}>
                    {request.requester.interests?.slice(0, 3).map((interest, index) => (
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
                  onPress={() => respondToRequest(request.id, 'accept', request.requester.username)}
                >
                  <IconSymbol name="checkmark" size={16} color="white" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.declineButton}
                  onPress={() => respondToRequest(request.id, 'decline', request.requester.username)}
                >
                  <IconSymbol name="xmark" size={16} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
    <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>Your Crew</ThemedText>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/search-users')}
          >
            <IconSymbol name="person.badge.plus" size={24} color={LadColors.primary} />
          </TouchableOpacity>
        </View>

      {/* Tab Selector */}
        <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chats' && styles.activeTab]}
          onPress={() => setActiveTab('chats')}
        >
          <IconSymbol 
            name="message.fill" 
            size={16} 
              color={activeTab === 'chats' ? LadColors.primary : getLadColor(colorScheme, 'text', 'secondary')} 
          />
          <ThemedText style={[
            styles.tabText,
            activeTab === 'chats' && styles.activeTabText
          ]}>
            Chats
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.activeTab]}
          onPress={() => setActiveTab('discover')}
        >
          <IconSymbol 
            name="person.2.fill" 
            size={16} 
              color={activeTab === 'discover' ? LadColors.primary : getLadColor(colorScheme, 'text', 'secondary')} 
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
              name="person.badge.plus" 
            size={16} 
              color={activeTab === 'requests' ? LadColors.primary : getLadColor(colorScheme, 'text', 'secondary')} 
          />
          <ThemedText style={[
            styles.tabText,
            activeTab === 'requests' && styles.activeTabText
          ]}>
              Requests ({friendRequests.length})
          </ThemedText>
        </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === 'chats' && renderChatsTab()}
        {activeTab === 'discover' && renderDiscoverTab()}
        {activeTab === 'requests' && renderRequestsTab()}

      {/* Friend Profile Modal */}
      <FriendProfileModal
        visible={showFriendProfile}
        onClose={() => setShowFriendProfile(false)}
        friendId={selectedFriendId}
      />

      {/* Group Creation Modal */}
      <GroupCreationModal
        visible={showGroupCreation}
        onClose={() => setShowGroupCreation(false)}
        onGroupCreated={handleGroupCreated}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: LadColors.primary,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${LadColors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Tab system
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
    position: 'relative',
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
  searchButton: {
    backgroundColor: LadColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Content
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
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
  
  // Friend items
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  friendBio: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 6,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
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
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${LadColors.error}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Request items
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  requestMessage: {
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.8,
    marginBottom: 6,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LadColors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LadColors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Find Friends Button
  findFriendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LadColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  findFriendsButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Messages tab styles
  tabContent: {
    flex: 1,
    padding: 16,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: LadColors.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
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
    fontSize: 14,
    opacity: 0.7,
    flex: 1,
  },
  unreadMessage: {
    fontWeight: '600',
    opacity: 1,
  },
  unreadBadge: {
    backgroundColor: LadColors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },

  // Additional styles for discover tab
  section: {
    backgroundColor: 'transparent',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  toggleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  toggleSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  friendsList: {
    gap: 12,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userDetails: {
    flex: 1,
    marginLeft: 12,
  },
  userUsername: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userBio: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 6,
    lineHeight: 18,
  },
  userInterests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  userActions: {
    marginLeft: 12,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  messageButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    marginBottom: 8,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  statusText: {
    fontSize: 14,
    opacity: 0.7,
  },
  addFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: LadColors.primary,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Group styles
  createGroupButton: {
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  createGroupContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: `${LadColors.primary}10`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${LadColors.primary}30`,
    borderStyle: 'dashed',
  },
  createGroupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LadColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  createGroupText: {
    flex: 1,
  },
  createGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  createGroupSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  groupMemberCount: {
    fontSize: 14,
    opacity: 0.7,
  },

  // AI Suggestions styles
  aiSuggestButton: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${LadColors.primary}30`,
    borderStyle: 'dashed',
  },
  aiSuggestContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  aiSuggestText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: LadColors.primary,
  },

  // Request styles  
  requestsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    marginBottom: 8,
  },

  // Tab badges  
  tabBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: LadColors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
}); 