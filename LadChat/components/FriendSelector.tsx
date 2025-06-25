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

interface FriendSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelectFriends: (selectedFriendIds: number[]) => void;
  title?: string;
  subtitle?: string;
  confirmButtonText?: string;
}

export default function FriendSelector({
  visible,
  onClose,
  onSelectFriends,
  title = "Send to Friends",
  subtitle = "Select friends to send this snap to",
  confirmButtonText = "Send Snap",
}: FriendSelectorProps) {
  const colorScheme = useColorScheme();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      loadFriends();
      setSelectedFriends(new Set());
      setSearchQuery('');
    }
  }, [visible]);

  const loadFriends = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getFriendsList();
      console.log('📥 FRIEND SELECTOR DEBUG - Raw API response:', response);
      
      if (response.success && response.data) {
        // Fix double nesting: response.data.data contains the actual friends array
        const actualData = response.data.data || response.data;
        const friendsData = Array.isArray(actualData) ? actualData : [];
        console.log('✅ FRIEND SELECTOR DEBUG - Processed friends data:', friendsData);
        console.log('✅ FRIEND SELECTOR DEBUG - Setting friends count:', friendsData.length);
        setFriends(friendsData);
      } else {
        console.log('❌ FRIEND SELECTOR DEBUG - Failed to load. Success:', response.success, 'Data:', response.data, 'Error:', response.error);
        setFriends([]);
      }
    } catch (error) {
      console.error('❌ FRIEND SELECTOR DEBUG - Exception:', error);
      setFriends([]);
    } finally {
      setIsLoading(false);
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

  const handleConfirm = () => {
    if (selectedFriends.size === 0) {
      Alert.alert('No Friends Selected', 'Please select at least one friend to send the snap to.');
      return;
    }
    
    onSelectFriends(Array.from(selectedFriends));
    onClose();
  };

  const filteredFriends = friends.filter(friendship =>
    friendship.friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <View style={styles.avatarContainer}>
            <View style={[
              styles.avatar,
              isSelected && styles.avatarSelected,
            ]}>
              <IconSymbol 
                name="person.crop.circle" 
                size={40} 
                color={isSelected ? '#007AFF' : Colors[colorScheme ?? 'light'].icon}
              />
            </View>
            {friendship.friend.is_verified && (
              <View style={styles.verifiedBadge}>
                <IconSymbol name="checkmark" size={10} color="white" />
              </View>
            )}
          </View>
          
          <View style={styles.friendDetails}>
            <ThemedText style={[
              styles.friendUsername,
              isSelected && styles.friendUsernameSelected,
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
            <ThemedText style={styles.title}>{title}</ThemedText>
            <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.headerButton,
              styles.confirmButton,
              selectedFriends.size === 0 && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={selectedFriends.size === 0}
          >
            <ThemedText style={[
              styles.confirmButtonText,
              selectedFriends.size === 0 && styles.confirmButtonTextDisabled,
            ]}>
              {confirmButtonText}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <IconSymbol name="magnifyingglass" size={16} color={Colors[colorScheme ?? 'light'].icon} />
            <TextInput
              style={[styles.searchInput, { color: Colors[colorScheme ?? 'light'].text }]}
              placeholder="Search friends..."
              placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Selected Count */}
        {selectedFriends.size > 0 && (
          <View style={styles.selectedCountContainer}>
            <ThemedText style={styles.selectedCount}>
              {selectedFriends.size} friend{selectedFriends.size !== 1 ? 's' : ''} selected
            </ThemedText>
          </View>
        )}

        {/* Friends List */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ThemedText>Loading friends...</ThemedText>
            </View>
          ) : filteredFriends.length === 0 ? (
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
            <View style={styles.friendsList}>
              {filteredFriends.map(renderFriendItem)}
            </View>
          )}
        </ScrollView>
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
  friendsList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  friendItemSelected: {
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  friendInfo: {
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
  friendDetails: {
    flex: 1,
  },
  friendUsername: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  friendUsernameSelected: {
    color: '#007AFF',
  },
  friendInterests: {
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
}); 