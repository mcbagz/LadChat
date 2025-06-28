import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  TextInput,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { apiClient } from '@/services/api';
import ProfilePicture from '@/components/ProfilePicture';
import FriendProfileModal from '@/components/FriendProfileModal';

interface Friend {
  friendship_id: number;
  friend: {
    id: number;
    username: string;
    interests: string[];
    is_verified: boolean;
    profile_photo_url?: string;
  };
  created_at: string;
}

interface GroupChat {
  id: number;
  creator_id: number;
  name: string;
  description?: string;
  avatar_url?: string;
  member_count: number;
  max_members: number;
  group_interests: string[];
  visibility: 'public' | 'private' | 'invite_only';
  join_approval_required: boolean;
  auto_suggest_members: boolean;
  auto_suggest_events: boolean;
  last_message_at?: string;
  message_count: number;
  created_at: string;
  is_active: boolean;
  user_is_member: boolean;
  user_is_admin: boolean;
}

interface FriendSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelectRecipients: (selectedFriendIds: number[], selectedGroupIds: number[]) => void;
  title?: string;
  subtitle?: string;
  confirmButtonText?: string;
}

export default function FriendSelector({
  visible,
  onClose,
  onSelectRecipients,
  title = "Send to Friends",
  subtitle = "Select friends and groups to send this snap to",
  confirmButtonText = "Send Snap",
}: FriendSelectorProps) {
  const colorScheme = useColorScheme();
  const [activeTab, setActiveTab] = useState<'friends' | 'groups'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<number>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFriendProfile, setShowFriendProfile] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      loadData();
      setSelectedFriends(new Set());
      setSelectedGroups(new Set());
      setSearchQuery('');
      setActiveTab('friends');
    }
  }, [visible]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [friendsResponse, groupsResponse] = await Promise.all([
        apiClient.getFriendsList(),
        loadGroups()
      ]);

      console.log('📥 FRIEND SELECTOR DEBUG - Raw friends response:', friendsResponse);
      
      if (friendsResponse.success && friendsResponse.data) {
        const actualData = friendsResponse.data.data || friendsResponse.data;
        const friendsData = Array.isArray(actualData) ? actualData : [];
        console.log('✅ FRIEND SELECTOR DEBUG - Setting friends count:', friendsData.length);
        setFriends(friendsData);
      } else {
        console.log('❌ FRIEND SELECTOR DEBUG - Failed to load friends');
        setFriends([]);
      }

      console.log('📥 FRIEND SELECTOR DEBUG - Raw groups response:', groupsResponse);
      
      if (groupsResponse.success && groupsResponse.data) {
        const groupsData = groupsResponse.data.groups || [];
        console.log('✅ FRIEND SELECTOR DEBUG - Setting groups count:', groupsData.length);
        setGroups(groupsData);
      } else {
        console.log('❌ FRIEND SELECTOR DEBUG - Failed to load groups');
        setGroups([]);
      }
    } catch (error) {
      console.error('❌ FRIEND SELECTOR DEBUG - Exception:', error);
      setFriends([]);
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroups = async (): Promise<any> => {
    try {
      return await apiClient.getUserGroups();
    } catch (error) {
      console.error('Failed to load groups:', error);
      return { success: false, error: 'Failed to load groups' };
    }
  };

  const toggleFriendSelection = (friendId: number) => {
    const newSelected = new Set(selectedFriends);
    if (newSelected.has(friendId)) {
      newSelected.delete(friendId);
    } else {
      newSelected.add(friendId);
    }
    setSelectedFriends(newSelected);
  };

  const toggleGroupSelection = (groupId: number) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const handleConfirm = () => {
    const totalSelected = selectedFriends.size + selectedGroups.size;
    if (totalSelected === 0) {
      Alert.alert('No Recipients Selected', 'Please select at least one friend or group to send the snap to.');
      return;
    }
    
    onSelectRecipients(Array.from(selectedFriends), Array.from(selectedGroups));
    onClose();
  };

  const filteredFriends = friends.filter(friendship =>
    friendship.friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTotalSelectedCount = () => selectedFriends.size + selectedGroups.size;

  const handleViewFriendProfile = (friendId: number) => {
    setSelectedFriendId(friendId);
    setShowFriendProfile(true);
  };

  const renderFriendItem = (friendship: Friend) => {
    const isSelected = selectedFriends.has(friendship.friend.id);
    
    return (
      <TouchableOpacity
        key={friendship.friendship_id}
        style={[
          styles.recipientItem,
          isSelected && styles.recipientItemSelected,
        ]}
        onPress={() => toggleFriendSelection(friendship.friend.id)}
      >
        <View style={styles.recipientInfo}>
          <ProfilePicture
            uri={friendship.friend.profile_photo_url}
            size={44}
            showVerified={friendship.friend.is_verified}
            borderWidth={isSelected ? 2 : 0}
            borderColor={isSelected ? '#007AFF' : 'transparent'}
            style={{ marginRight: 12 }}
          />
          
          <View style={styles.recipientDetails}>
            <ThemedText style={[
              styles.recipientName,
              isSelected && styles.recipientNameSelected,
            ]}>
              {friendship.friend.username}
            </ThemedText>
            <View style={styles.recipientInterests}>
              {friendship.friend.interests?.slice(0, 2).map((interest, index) => (
                <View key={index} style={styles.interestTag}>
                  <ThemedText style={styles.interestText}>{interest}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.recipientActions}>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => handleViewFriendProfile(friendship.friend.id)}
          >
            <IconSymbol name="info.circle" size={20} color={Colors[colorScheme ?? 'light'].icon} />
          </TouchableOpacity>
          
          <View style={[
            styles.selectionIndicator,
            isSelected && styles.selectionIndicatorSelected,
          ]}>
            {isSelected && (
              <IconSymbol name="checkmark" size={16} color="white" />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderGroupItem = (group: GroupChat) => {
    const isSelected = selectedGroups.has(group.id);
    
    return (
      <TouchableOpacity
        key={group.id}
        style={[
          styles.recipientItem,
          isSelected && styles.recipientItemSelected,
        ]}
        onPress={() => toggleGroupSelection(group.id)}
      >
        <View style={styles.recipientInfo}>
          <View style={styles.avatarContainer}>
            <ProfilePicture
              uri={group.avatar_url}
              size={44}
              borderWidth={isSelected ? 2 : 0}
              borderColor={isSelected ? '#007AFF' : 'transparent'}
            />
            {group.user_is_admin && (
              <View style={styles.adminBadge}>
                <IconSymbol name="crown.fill" size={10} color="white" />
              </View>
            )}
          </View>
          
          <View style={styles.recipientDetails}>
            <ThemedText style={[
              styles.recipientName,
              isSelected && styles.recipientNameSelected,
            ]}>
              {group.name}
            </ThemedText>
            <ThemedText style={styles.groupMeta}>
              {group.member_count} members
              {group.description && ` • ${group.description}`}
            </ThemedText>
          </View>
        </View>

        <View style={[
          styles.selectionIndicator,
          isSelected && styles.selectionIndicatorSelected,
        ]}>
          {isSelected && (
            <IconSymbol name="checkmark" size={16} color="white" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={onClose}>
            <IconSymbol name="xmark" size={20} color={Colors[colorScheme ?? 'light'].text} />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <ThemedText style={styles.title}>{title}</ThemedText>
            <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.headerButton,
              styles.confirmButton,
              getTotalSelectedCount() === 0 && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={getTotalSelectedCount() === 0}
          >
            <ThemedText style={[
              styles.confirmButtonText,
              getTotalSelectedCount() === 0 && styles.confirmButtonTextDisabled,
            ]}>
              {confirmButtonText}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'friends' && styles.activeTab
            ]}
            onPress={() => setActiveTab('friends')}
          >
            <IconSymbol 
              name="person.2" 
              size={16} 
              color={activeTab === 'friends' ? '#007AFF' : Colors[colorScheme ?? 'light'].text} 
            />
            <ThemedText style={[
              styles.tabText,
              activeTab === 'friends' && styles.activeTabText
            ]}>
              Friends
            </ThemedText>
            {selectedFriends.size > 0 && (
              <View style={styles.selectionBadge}>
                <ThemedText style={styles.selectionBadgeText}>
                  {selectedFriends.size}
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'groups' && styles.activeTab
            ]}
            onPress={() => setActiveTab('groups')}
          >
            <IconSymbol 
              name="person.2" 
              size={16} 
              color={activeTab === 'groups' ? '#007AFF' : Colors[colorScheme ?? 'light'].text} 
            />
            <ThemedText style={[
              styles.tabText,
              activeTab === 'groups' && styles.activeTabText
            ]}>
              Groups
            </ThemedText>
            {selectedGroups.size > 0 && (
              <View style={styles.selectionBadge}>
                <ThemedText style={styles.selectionBadgeText}>
                  {selectedGroups.size}
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <IconSymbol name="magnifyingglass" size={16} color={Colors[colorScheme ?? 'light'].icon} />
            <TextInput
              style={[styles.searchInput, { color: Colors[colorScheme ?? 'light'].text }]}
              placeholder={`Search ${activeTab}...`}
              placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Selected Count */}
        {getTotalSelectedCount() > 0 && (
          <View style={styles.selectedCountContainer}>
            <ThemedText style={styles.selectedCount}>
              {getTotalSelectedCount()} recipient{getTotalSelectedCount() !== 1 ? 's' : ''} selected
            </ThemedText>
          </View>
        )}

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ThemedText>Loading {activeTab}...</ThemedText>
            </View>
          ) : activeTab === 'friends' ? (
            filteredFriends.length === 0 ? (
              <View style={styles.emptyContainer}>
                <IconSymbol 
                  name="person.2.circle" 
                  size={48} 
                  color={Colors[colorScheme ?? 'light'].icon} 
                />
                <ThemedText style={styles.emptyTitle}>
                  {searchQuery ? 'No friends found' : 'No friends yet'}
                </ThemedText>
                <ThemedText style={styles.emptyText}>
                  {searchQuery 
                    ? 'Try a different search term' 
                    : 'Add friends to start sending snaps!'
                  }
                </ThemedText>
              </View>
            ) : (
              <View style={styles.recipientsList}>
                {filteredFriends.map(renderFriendItem)}
              </View>
            )
          ) : (
            filteredGroups.length === 0 ? (
              <View style={styles.emptyContainer}>
                <IconSymbol 
                  name="person.2.circle" 
                  size={48} 
                  color={Colors[colorScheme ?? 'light'].icon} 
                />
                <ThemedText style={styles.emptyTitle}>
                  {searchQuery ? 'No groups found' : 'No groups yet'}
                </ThemedText>
                <ThemedText style={styles.emptyText}>
                  {searchQuery 
                    ? 'Try a different search term' 
                    : 'Join or create groups to send group snaps!'
                  }
                </ThemedText>
              </View>
            ) : (
              <View style={styles.recipientsList}>
                {filteredGroups.map(renderGroupItem)}
              </View>
            )
          )}
        </ScrollView>
      </SafeAreaView>
      
      {/* Friend Profile Modal */}
      <FriendProfileModal
        visible={showFriendProfile}
        onClose={() => setShowFriendProfile(false)}
        friendId={selectedFriendId}
      />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  confirmButtonDisabled: {
    backgroundColor: 'rgba(0,122,255,0.3)',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButtonTextDisabled: {
    opacity: 0.6,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    position: 'relative',
  },
  activeTab: {
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  selectionBadge: {
    position: 'absolute',
    top: 4,
    right: 8,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  selectionBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  selectedCountContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  selectedCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
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
  recipientsList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  recipientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  recipientItemSelected: {
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSelected: {
    backgroundColor: 'rgba(0,122,255,0.2)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
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
  adminBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipientDetails: {
    flex: 1,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  recipientNameSelected: {
    color: '#007AFF',
  },
  recipientInterests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  groupMeta: {
    fontSize: 12,
    opacity: 0.6,
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
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionIndicatorSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  recipientActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
}); 