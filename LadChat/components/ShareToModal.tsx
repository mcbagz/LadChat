import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LadColors, Colors } from '@/constants/Colors';
import { apiClient, GroupChat } from '@/services/api';
import ProfilePicture from './ProfilePicture';

interface ShareToModalProps {
  visible: boolean;
  onClose: () => void;
  onShare: (includeStory: boolean, friendIds: number[], groupIds: number[]) => void;
  mediaType: 'photo' | null;
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

interface ShareRecipient {
  id: number;
  name: string;
  type: 'friend' | 'group';
  profile_photo_url?: string;
  is_verified?: boolean;
  member_count?: number;
}

const ShareToModal: React.FC<ShareToModalProps> = ({ visible, onClose, onShare, mediaType }) => {
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [recipients, setRecipients] = useState<ShareRecipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [includeStory, setIncludeStory] = useState(false);

  useEffect(() => {
    if (visible) {
      loadData();
      // Reset selections when modal opens
      setSelectedRecipients(new Set());
      setIncludeStory(false);
      setSearchQuery('');
    }
  }, [visible]);

  useEffect(() => {
    // Combine and filter recipients based on search
    const combinedRecipients: ShareRecipient[] = [
      ...friends.map(friendship => ({
        id: friendship.friend.id,
        name: friendship.friend.username,
        type: 'friend' as const,
        profile_photo_url: friendship.friend.profile_photo_url,
        is_verified: friendship.friend.is_verified,
      })),
      ...groups.map(group => ({
        id: group.id,
        name: group.name,
        type: 'group' as const,
        member_count: group.member_count,
      })),
    ];

    const filtered = searchQuery.length > 0
      ? combinedRecipients.filter(recipient =>
          recipient.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : combinedRecipients;

    // Sort: friends first, then groups, both alphabetically
    const sorted = filtered.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'friend' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    console.log('🔄 SHARETOMODAL DEBUG - Final recipients list:', {
      totalCombined: combinedRecipients.length,
      totalFiltered: filtered.length,
      totalSorted: sorted.length,
      friends: combinedRecipients.filter(r => r.type === 'friend').length,
      groups: combinedRecipients.filter(r => r.type === 'group').length,
      searchQuery: searchQuery
    });

    setRecipients(sorted);
  }, [friends, groups, searchQuery]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('📥 SHARETOMODAL DEBUG - Loading friends and groups...');
      
      const [friendsResponse, groupsResponse] = await Promise.all([
        apiClient.getFriendsList(),
        apiClient.getUserGroups(),
      ]);

      console.log('🤝 SHARETOMODAL DEBUG - Friends response:', friendsResponse);
      console.log('👥 SHARETOMODAL DEBUG - Groups response:', groupsResponse);

      if (friendsResponse.success && friendsResponse.data) {
        const friendsData = friendsResponse.data.data || friendsResponse.data;
        console.log('✅ SHARETOMODAL DEBUG - Processed friends data:', friendsData);
        setFriends(Array.isArray(friendsData) ? friendsData : []);
      }

      if (groupsResponse.success && groupsResponse.data) {
        const groupsData = (groupsResponse.data as any).groups || 
                          (groupsResponse.data as any).data || 
                          groupsResponse.data;
        console.log('✅ SHARETOMODAL DEBUG - Processed groups data:', groupsData);
        setGroups(Array.isArray(groupsData) ? groupsData : []);
      }
    } catch (error) {
      console.error('❌ SHARETOMODAL DEBUG - Error loading share recipients:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRecipient = (recipientKey: string) => {
    const newSelected = new Set(selectedRecipients);
    if (newSelected.has(recipientKey)) {
      newSelected.delete(recipientKey);
    } else {
      newSelected.add(recipientKey);
    }
    setSelectedRecipients(newSelected);
  };

  const handleShare = () => {
    const friendIds: number[] = [];
    const groupIds: number[] = [];

    console.log('📋 SHARETOMODAL DEBUG - Selected recipients:', Array.from(selectedRecipients));

    selectedRecipients.forEach(key => {
      const [type, id] = key.split('-');
      const numId = parseInt(id);
      console.log('🔍 SHARETOMODAL DEBUG - Processing recipient:', { key, type, id, numId });
      
      if (type === 'friend') {
        friendIds.push(numId);
      } else if (type === 'group') {
        groupIds.push(numId);
      }
    });

    console.log('📤 SHARETOMODAL DEBUG - Final arrays:', {
      includeStory,
      friendIds,
      groupIds,
      selectedRecipientsCount: selectedRecipients.size
    });

    if (!includeStory && friendIds.length === 0 && groupIds.length === 0) {
      Alert.alert('No Selection', 'Please select at least one recipient or add to your story');
      return;
    }

    onShare(includeStory, friendIds, groupIds);
  };

  const getSelectionCount = () => {
    return selectedRecipients.size + (includeStory ? 1 : 0);
  };

  const getRecipientKey = (recipient: ShareRecipient) => {
    return `${recipient.type}-${recipient.id}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <TouchableOpacity 
          style={styles.modalBackdropTouchable} 
          onPress={onClose}
          activeOpacity={1}
        />
        
        <SafeAreaView style={[styles.bottomSheet, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
          {/* Handle bar */}
          <View style={styles.bottomSheetHandle} />
          
          {/* Header */}
          <View style={styles.bottomSheetHeader}>
            <ThemedText style={styles.modalTitle}>Share {mediaType}</ThemedText>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <IconSymbol name="xmark" size={20} color={Colors[colorScheme ?? 'light'].icon} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <IconSymbol name="magnifyingglass" size={16} color={Colors[colorScheme ?? 'light'].tabIconDefault} />
              <TextInput
                style={[styles.searchInput, { color: Colors[colorScheme ?? 'light'].text }]}
                placeholder="Search friends and groups..."
                placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Add to Story Option */}
            <TouchableOpacity
              style={[styles.storyOption, includeStory && styles.selectedItem]}
              onPress={() => setIncludeStory(!includeStory)}
            >
              <View style={styles.storyIconContainer}>
                <IconSymbol name="plus.circle.fill" size={24} color={LadColors.primary} />
              </View>
              <View style={styles.recipientInfo}>
                <ThemedText style={styles.recipientName}>Add to My Story</ThemedText>
                <ThemedText style={styles.recipientSubtext}>Share with all your friends</ThemedText>
              </View>
              <View style={[styles.checkbox, includeStory && styles.checkboxSelected]}>
                {includeStory && (
                  <IconSymbol name="checkmark" size={12} color="white" />
                )}
              </View>
            </TouchableOpacity>

            {/* Recipients List */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={LadColors.primary} />
                <ThemedText style={styles.loadingText}>Loading...</ThemedText>
              </View>
            ) : recipients.length === 0 ? (
              <View style={styles.emptyContainer}>
                <IconSymbol name="person.2" size={48} color={Colors[colorScheme ?? 'light'].icon} />
                <ThemedText style={styles.emptyTitle}>
                  {searchQuery ? 'No results found' : 'No friends or groups'}
                </ThemedText>
                <ThemedText style={styles.emptySubtext}>
                  {searchQuery ? 'Try a different search term' : 'Add friends or create groups to share your photos'}
                </ThemedText>
              </View>
            ) : (
              recipients.map((recipient) => {
                const recipientKey = getRecipientKey(recipient);
                const isSelected = selectedRecipients.has(recipientKey);
                
                return (
                  <TouchableOpacity
                    key={recipientKey}
                    style={[styles.recipientItem, isSelected && styles.selectedItem]}
                    onPress={() => toggleRecipient(recipientKey)}
                  >
                    <View style={styles.avatarContainer}>
                      {recipient.type === 'friend' && recipient.profile_photo_url ? (
                        <ProfilePicture
                          uri={recipient.profile_photo_url}
                          size={40}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={styles.avatar}>
                          <IconSymbol 
                            name={recipient.type === 'group' ? "person.3.fill" : "person.crop.circle"} 
                            size={24} 
                            color={Colors[colorScheme ?? 'light'].icon} 
                          />
                        </View>
                      )}
                      {recipient.type === 'friend' && recipient.is_verified && (
                        <View style={styles.verifiedBadge}>
                          <IconSymbol name="checkmark" size={8} color="white" />
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.recipientInfo}>
                      <ThemedText style={styles.recipientName}>{recipient.name}</ThemedText>
                      {recipient.type === 'group' && recipient.member_count && (
                        <ThemedText style={styles.recipientSubtext}>
                          {recipient.member_count} member{recipient.member_count !== 1 ? 's' : ''}
                        </ThemedText>
                      )}
                    </View>

                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && (
                        <IconSymbol name="checkmark" size={12} color="white" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Share Button */}
          <View style={styles.shareButtonContainer}>
            <TouchableOpacity
              style={[styles.shareButton, getSelectionCount() === 0 && styles.shareButtonDisabled]}
              onPress={handleShare}
              disabled={getSelectionCount() === 0}
            >
              <ThemedText style={[styles.shareButtonText, getSelectionCount() === 0 && styles.shareButtonTextDisabled]}>
                Share{getSelectionCount() > 0 ? ` (${getSelectionCount()})` : ''}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdropTouchable: {
    flex: 1,
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    maxHeight: '85%',
    minHeight: '60%',
    width: '100%',
  },
  bottomSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  storyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  storyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${LadColors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recipientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedItem: {
    backgroundColor: `${LadColors.primary}10`,
    borderColor: `${LadColors.primary}40`,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  recipientSubtext: {
    fontSize: 14,
    opacity: 0.7,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: LadColors.primary,
    borderColor: LadColors.primary,
  },
  shareButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  shareButton: {
    backgroundColor: LadColors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  shareButtonDisabled: {
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  shareButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  shareButtonTextDisabled: {
    color: 'rgba(0,0,0,0.4)',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.7,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ShareToModal; 