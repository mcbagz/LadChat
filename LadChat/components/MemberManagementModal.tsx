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
  RefreshControl,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { apiClient, GroupChat, GroupMember } from '@/services/api';
import ProfilePicture from '@/components/ProfilePicture';
import { LadCopy } from '@/utils/LadCopy';
import { LadColors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';

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

interface MemberManagementModalProps {
  visible: boolean;
  onClose: () => void;
  group: GroupChat;
  onMembersUpdated: () => void;
}

export default function MemberManagementModal({
  visible,
  onClose,
  group,
  onMembersUpdated,
}: MemberManagementModalProps) {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'members' | 'add'>('members');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      loadMembers();
      if (activeTab === 'add') {
        loadFriends();
      }
      setSelectedFriends(new Set());
      setSearchQuery('');
    }
  }, [visible, activeTab]);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getGroupMembers(group.id);
      if (response.success && response.data) {
        setMembers(response.data);
      }
    } catch (error) {
      console.error('Failed to load group members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      const response = await apiClient.getFriendsList();
      if (response.success && response.data) {
        const actualData = response.data.data || response.data;
        const friendsData = Array.isArray(actualData) ? actualData : [];
        
        // Filter out friends who are already group members
        const memberIds = new Set(members.map(m => m.user_id));
        const availableFriends = friendsData.filter(
          (friendship: Friend) => !memberIds.has(friendship.friend.id)
        );
        
        setFriends(availableFriends);
      }
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMembers();
    if (activeTab === 'add') {
      await loadFriends();
    }
    setRefreshing(false);
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

  const handleAddMembers = async () => {
    if (selectedFriends.size === 0) {
      Alert.alert('No Members Selected', 'Please select at least one friend to add.');
      return;
    }

    try {
      const response = await apiClient.addGroupMembers(
        group.id,
        Array.from(selectedFriends),
        false // Don't make them admin by default
      );
      
      if (response.success) {
        Alert.alert(
          'Success',
          `Added ${selectedFriends.size} member${selectedFriends.size !== 1 ? 's' : ''} to the group!`,
          [
            {
              text: 'OK',
              onPress: () => {
                setSelectedFriends(new Set());
                onMembersUpdated();
                loadMembers();
                loadFriends();
              },
            },
          ]
        );
      } else {
        throw new Error(response.error || 'Failed to add members');
      }
    } catch (error) {
      console.error('Failed to add members:', error);
      Alert.alert('Error', 'Failed to add members. Please try again.');
    }
  };

  const handleRemoveMember = (member: GroupMember) => {
    if (member.user_id === group.creator_id) {
      Alert.alert('Cannot Remove Creator', 'The group creator cannot be removed from the group.');
      return;
    }

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.user.username} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiClient.removeGroupMember(group.id, member.user_id);
              if (response.success) {
                Alert.alert('Success', `${member.user.username} has been removed from the group.`);
                onMembersUpdated();
                loadMembers();
              } else {
                throw new Error(response.error || 'Failed to remove member');
              }
            } catch (error) {
              console.error('Failed to remove member:', error);
              Alert.alert('Error', 'Failed to remove member. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleToggleAdmin = (member: GroupMember) => {
    if (member.user_id === group.creator_id) {
      Alert.alert('Cannot Change Creator', 'The group creator\'s admin status cannot be changed.');
      return;
    }

    const action = member.is_admin ? 'demote from admin' : 'promote to admin';
    Alert.alert(
      `${member.is_admin ? 'Remove Admin' : 'Make Admin'}`,
      `Are you sure you want to ${action} ${member.user.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: member.is_admin ? 'Remove Admin' : 'Make Admin',
          onPress: async () => {
            try {
              const response = await apiClient.updateGroupMember(
                group.id,
                member.user_id,
                !member.is_admin
              );
              if (response.success) {
                Alert.alert(
                  'Success',
                  `${member.user.username} has been ${member.is_admin ? 'removed from admin' : 'promoted to admin'}.`
                );
                onMembersUpdated();
                loadMembers();
              } else {
                throw new Error(response.error || 'Failed to update member');
              }
            } catch (error) {
              console.error('Failed to update member:', error);
              Alert.alert('Error', 'Failed to update member. Please try again.');
            }
          },
        },
      ]
    );
  };

  const filteredMembers = members.filter(member =>
    member.user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFriends = friends.filter(friendship =>
    friendship.friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderMemberItem = (member: GroupMember) => {
    const isCreator = member.user_id === group.creator_id;
    // Check if current user has permission to manage members (creator or admin)
    const currentUserMember = members.find(m => m.user_id === user?.id);
    const canManageMembers = currentUserMember && (
      currentUserMember.user_id === group.creator_id || 
      currentUserMember.is_admin
    );
    
    return (
      <View key={member.user_id} style={styles.memberItem}>
        <View style={styles.memberInfo}>
          <View style={styles.memberAvatarContainer}>
            <ProfilePicture
              uri={member.user.profile_photo_url}
              size={48}
              showVerified={member.user.is_verified}
              style={{ marginRight: 12 }}
            />
            {isCreator && (
              <View style={styles.creatorBadge}>
                <IconSymbol name="crown.fill" size={10} color="white" />
              </View>
            )}
          </View>
          
          <View style={styles.memberDetails}>
            <View style={styles.memberHeader}>
              <ThemedText style={styles.memberName}>
                {member.user.username}
              </ThemedText>
              {member.is_admin && (
                <View style={styles.adminTag}>
                  <ThemedText style={styles.adminTagText}>Admin</ThemedText>
                </View>
              )}
            </View>
            
            <View style={styles.memberInterests}>
              {member.user.interests?.slice(0, 2).map((interest, index) => (
                <View key={index} style={styles.interestTag}>
                  <ThemedText style={styles.interestText}>{interest}</ThemedText>
                </View>
              ))}
            </View>
            
            <ThemedText style={styles.joinedDate}>
              Joined {new Date(member.joined_at).toLocaleDateString()}
            </ThemedText>
          </View>
        </View>

        <View style={styles.memberActions}>
          {!isCreator && canManageMembers && (
            <>
              <TouchableOpacity 
                style={[
                  styles.actionButton,
                  member.is_admin ? styles.demoteButton : styles.promoteButton
                ]}
                onPress={() => handleToggleAdmin(member)}
              >
                <IconSymbol 
                  name={member.is_admin ? "arrow.down.circle" : "arrow.up.circle"} 
                  size={16} 
                  color="white" 
                />
                <ThemedText style={styles.actionButtonText}>
                  {member.is_admin ? 'Demote' : 'Promote'}
                </ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => handleRemoveMember(member)}
              >
                <IconSymbol name="minus.circle" size={16} color="white" />
                <ThemedText style={styles.removeButtonText}>Remove</ThemedText>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderFriendItem = (friendship: Friend) => {
    const isSelected = selectedFriends.has(friendship.friend.id);
    
    return (
      <TouchableOpacity
        key={friendship.friendship_id}
        style={[
          styles.friendItem,
          isSelected && styles.friendItemSelected,
        ]}
        onPress={() => toggleFriendSelection(friendship.friend.id)}
      >
        <View style={styles.friendInfo}>
          <ProfilePicture
            uri={friendship.friend.profile_photo_url}
            size={44}
            showVerified={friendship.friend.is_verified}
            borderWidth={isSelected ? 2 : 0}
            borderColor={isSelected ? '#007AFF' : 'transparent'}
            style={{ marginRight: 12 }}
          />
          
          <View style={styles.friendDetails}>
            <ThemedText style={[
              styles.friendName,
              isSelected && styles.friendNameSelected,
            ]}>
              {friendship.friend.username}
            </ThemedText>
            <View style={styles.friendInterests}>
              {friendship.friend.interests?.slice(0, 2).map((interest, index) => (
                <View key={index} style={styles.interestTag}>
                  <ThemedText style={styles.interestText}>{interest}</ThemedText>
                </View>
              ))}
            </View>
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
            <ThemedText style={styles.title}>Manage Members</ThemedText>
            <ThemedText style={styles.subtitle}>{group.name}</ThemedText>
          </View>
          
          {activeTab === 'add' && (
            <TouchableOpacity 
              style={[
                styles.headerButton,
                styles.addButton,
                selectedFriends.size === 0 && styles.addButtonDisabled,
              ]}
              onPress={handleAddMembers}
              disabled={selectedFriends.size === 0}
            >
              <ThemedText style={[
                styles.addButtonText,
                selectedFriends.size === 0 && styles.addButtonTextDisabled,
              ]}>
                Add ({selectedFriends.size})
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'members' && styles.activeTab
            ]}
            onPress={() => setActiveTab('members')}
          >
            <IconSymbol 
              name="person.2.fill" 
              size={16} 
              color={activeTab === 'members' ? '#007AFF' : Colors[colorScheme ?? 'light'].text} 
            />
            <ThemedText style={[
              styles.tabText,
              activeTab === 'members' && styles.activeTabText
            ]}>
              Members ({members.length})
            </ThemedText>
          </TouchableOpacity>

          {/* Check if current user can manage members (add friends) */}
          {(() => {
            const currentUserMember = members.find(m => m.user_id === user?.id);
            const canManageMembers = currentUserMember && (
              currentUserMember.user_id === group.creator_id || 
              currentUserMember.is_admin
            );
            return canManageMembers ? (
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'add' && styles.activeTab
                ]}
                onPress={() => setActiveTab('add')}
              >
                <IconSymbol 
                  name="person.badge.plus" 
                  size={16} 
                  color={activeTab === 'add' ? '#007AFF' : Colors[colorScheme ?? 'light'].text} 
                />
                <ThemedText style={[
                  styles.tabText,
                  activeTab === 'add' && styles.activeTabText
                ]}>
                  Add Members
                </ThemedText>
                {selectedFriends.size > 0 && (
                  <View style={styles.selectionBadge}>
                    <ThemedText style={styles.selectionBadgeText}>
                      {selectedFriends.size}
                    </ThemedText>
                  </View>
                )}
              </TouchableOpacity>
            ) : null;
          })()}
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <IconSymbol name="magnifyingglass" size={16} color={Colors[colorScheme ?? 'light'].icon} />
            <TextInput
              style={[styles.searchInput, { color: Colors[colorScheme ?? 'light'].text }]}
              placeholder={`Search ${activeTab === 'members' ? 'members' : 'friends'}...`}
              placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ThemedText>Loading {activeTab}...</ThemedText>
            </View>
          ) : activeTab === 'members' ? (
            filteredMembers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <IconSymbol 
                  name="person.2.circle" 
                  size={48} 
                  color={Colors[colorScheme ?? 'light'].icon} 
                />
                <ThemedText style={styles.emptyTitle}>
                  {searchQuery ? 'No members found' : 'No members'}
                </ThemedText>
                <ThemedText style={styles.emptyText}>
                  {searchQuery 
                    ? 'Try a different search term' 
                    : 'This group has no members'
                  }
                </ThemedText>
              </View>
            ) : (
              <View style={styles.membersList}>
                {filteredMembers.map(renderMemberItem)}
              </View>
            )
          ) : (
            filteredFriends.length === 0 ? (
              <View style={styles.emptyContainer}>
                <IconSymbol 
                  name="person.badge.plus" 
                  size={48} 
                  color={Colors[colorScheme ?? 'light'].icon} 
                />
                <ThemedText style={styles.emptyTitle}>
                  {searchQuery ? 'No friends found' : 'No friends to add'}
                </ThemedText>
                <ThemedText style={styles.emptyText}>
                  {searchQuery 
                    ? 'Try a different search term' 
                    : 'All your friends are already in this group!'
                  }
                </ThemedText>
              </View>
            ) : (
              <View style={styles.friendsList}>
                {filteredFriends.map(renderFriendItem)}
              </View>
            )
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    backgroundColor: Colors.light.background,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 36,
  },
  addButtonDisabled: {
    backgroundColor: '#007AFF40',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  addButtonTextDisabled: {
    color: 'white60',
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
  selectionBadge: {
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
  selectionBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  membersList: {
    paddingHorizontal: 20,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
    marginBottom: 12,
  },
  memberInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatarContainer: {
    position: 'relative',
  },
  creatorBadge: {
    position: 'absolute',
    bottom: -2,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  memberDetails: {
    flex: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  adminTag: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  adminTagText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  memberInterests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  interestTag: {
    backgroundColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
    marginBottom: 2,
  },
  interestText: {
    fontSize: 11,
    color: '#8E8E93',
  },
  joinedDate: {
    fontSize: 12,
    opacity: 0.6,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  promoteButton: {
    backgroundColor: '#34C759',
  },
  demoteButton: {
    backgroundColor: '#FF9500',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  removeButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  friendsList: {
    paddingHorizontal: 20,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  friendItemSelected: {
    backgroundColor: '#007AFF10',
  },
  friendInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  friendNameSelected: {
    color: '#007AFF',
  },
  friendInterests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionIndicatorSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
}); 