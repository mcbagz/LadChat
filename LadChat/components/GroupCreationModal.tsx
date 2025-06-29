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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, LadColors } from '@/constants/Colors';
import { apiClient } from '@/services/api';
import ProfilePicture from '@/components/ProfilePicture';

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

interface GroupCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onGroupCreated: (group: any) => void;
}

export default function GroupCreationModal({
  visible,
  onClose,
  onGroupCreated,
}: GroupCreationModalProps) {
  const colorScheme = useColorScheme();
  const [step, setStep] = useState<'info' | 'members' | 'settings'>('info');
  const [isLoading, setIsLoading] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  
  // Group Info
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  
  // Member Selection
  const [selectedMembers, setSelectedMembers] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  // Settings
  const [visibility, setVisibility] = useState<'private' | 'public' | 'invite_only'>('private');
  const [maxMembers, setMaxMembers] = useState(50);

  useEffect(() => {
    if (visible) {
      resetForm();
      loadFriends();
    }
  }, [visible]);

  const resetForm = () => {
    setStep('info');
    setGroupName('');
    setGroupDescription('');
    setSelectedMembers(new Set());
    setSearchQuery('');
    setVisibility('private');
    setMaxMembers(50);
  };

  const loadFriends = async () => {
    try {
      const response = await apiClient.getFriendsList();
      if (response.success && response.data) {
        const actualData = response.data.data || response.data;
        const friendsData = Array.isArray(actualData) ? actualData : [];
        setFriends(friendsData);
      }
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  };

  const toggleMemberSelection = (friendId: number) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(friendId)) {
      newSelected.delete(friendId);
    } else {
      newSelected.add(friendId);
    }
    setSelectedMembers(newSelected);
  };

  const handleNext = () => {
    if (step === 'info') {
      if (!groupName.trim()) {
        Alert.alert('Group Name Required', 'Please enter a name for your group.');
        return;
      }
      setStep('members');
    } else if (step === 'members') {
      setStep('settings');
    }
  };

  const handleBack = () => {
    if (step === 'members') {
      setStep('info');
    } else if (step === 'settings') {
      setStep('members');
    }
  };

  const handleCreateGroup = async () => {
    setIsLoading(true);
    try {
      const groupData = {
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        initial_member_ids: Array.from(selectedMembers),
        visibility,
        max_members: maxMembers,
      };

      console.log('Creating group with data:', groupData);

      const response = await apiClient.createGroup(groupData);
      
      if (response.success && response.data) {
        Alert.alert(
          'Group Created!',
          `"${groupName}" has been created successfully.`,
          [
            {
              text: 'OK',
              onPress: () => {
                onGroupCreated(response.data);
                onClose();
              },
            },
          ]
        );
      } else {
        throw new Error(response.error || 'Failed to create group');
      }
    } catch (error) {
      console.error('Failed to create group:', error);
      Alert.alert(
        'Error',
        'Failed to create group. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const filteredFriends = friends.filter(friendship =>
    friendship.friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canProceed = () => {
    if (step === 'info') {
      return groupName.trim().length >= 2;
    }
    return true;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
                  <View style={styles.modalHeader}>
          {step !== 'info' ? (
            <TouchableOpacity onPress={handleBack}>
              <ThemedText style={{ fontSize: 16, color: Colors.light.icon }}>Back</ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onClose}>
              <ThemedText style={{ fontSize: 16, color: Colors.light.icon }}>Cancel</ThemedText>
            </TouchableOpacity>
          )}
          
          <ThemedText style={styles.modalTitle}>
            {step === 'info' ? 'Create Group' : 
             step === 'members' ? 'Add Members' : 'Group Settings'}
          </ThemedText>
          
          {step === 'settings' ? (
            <TouchableOpacity 
              onPress={handleCreateGroup}
              disabled={isLoading}
            >
              <ThemedText style={{ fontSize: 16, fontWeight: '600', color: LadColors.primary, opacity: isLoading ? 0.5 : 1 }}>
                {isLoading ? 'Creating...' : 'Create'}
              </ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={handleNext}
              disabled={!canProceed()}
            >
              <ThemedText style={{ fontSize: 16, fontWeight: '600', color: LadColors.primary, opacity: !canProceed() ? 0.5 : 1 }}>
                Next
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>

          {/* Content */}
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {step === 'info' && (
              <>
                <View style={styles.formSection}>
                  <ThemedText style={styles.formLabel}>Group Name *</ThemedText>
                  <TextInput
                    style={[styles.formInput, { color: Colors[colorScheme ?? 'light'].text }]}
                    placeholder="Enter group name"
                    placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
                    value={groupName}
                    onChangeText={setGroupName}
                    maxLength={100}
                    autoFocus
                  />
                </View>

                <View style={styles.formSection}>
                  <ThemedText style={styles.formLabel}>Description (Optional)</ThemedText>
                  <TextInput
                    style={[styles.formTextArea, { color: Colors[colorScheme ?? 'light'].text }]}
                    placeholder="What's this group about?"
                    placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
                    value={groupDescription}
                    onChangeText={setGroupDescription}
                    maxLength={500}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </>
            )}

            {step === 'members' && (
              <>
                <View style={styles.formSection}>
                  <ThemedText style={styles.formLabel}>Add Members (Optional)</ThemedText>
                  
                  {selectedMembers.size > 0 && (
                    <View style={styles.selectedCountContainer}>
                      <ThemedText style={styles.selectedCount}>
                        {selectedMembers.size} member{selectedMembers.size !== 1 ? 's' : ''} selected
                      </ThemedText>
                    </View>
                  )}

                  {/* Search Bar */}
                  <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                      <IconSymbol name="magnifyingglass" size={16} color={Colors[colorScheme ?? 'light'].icon} />
                      <TextInput
                        style={[styles.searchInput, { color: Colors[colorScheme ?? 'light'].text }]}
                        placeholder="Search friends..."
                        placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>

                  {filteredFriends.length === 0 ? (
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
                          : 'Add friends to create groups with them!'
                        }
                      </ThemedText>
                    </View>
                  ) : (
                    filteredFriends.map((friendship) => {
                      const isSelected = selectedMembers.has(friendship.friend.id);
                      
                      return (
                        <TouchableOpacity
                          key={friendship.friendship_id}
                          style={[
                            styles.memberItem,
                            isSelected && styles.memberItemSelected,
                          ]}
                          onPress={() => toggleMemberSelection(friendship.friend.id)}
                        >
                          <View style={styles.memberInfo}>
                            <ProfilePicture
                              uri={friendship.friend.profile_photo_url}
                              size={44}
                              showVerified={friendship.friend.is_verified}
                              borderWidth={isSelected ? 2 : 0}
                              borderColor={isSelected ? LadColors.primary : 'transparent'}
                              style={{ marginRight: 12 }}
                            />
                            
                            <View style={styles.memberDetails}>
                              <ThemedText style={[
                                styles.memberName,
                                isSelected && styles.memberNameSelected,
                              ]}>
                                {friendship.friend.username}
                              </ThemedText>
                              <View style={styles.memberInterests}>
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
                    })
                  )}
                </View>
              </>
            )}

            {step === 'settings' && (
              <>
                <View style={styles.formSection}>
                  <ThemedText style={styles.formLabel}>Privacy</ThemedText>
                  <View style={styles.visibilityOptions}>
                    {[
                      { key: 'private', label: 'Private', icon: 'lock.fill' },
                      { key: 'public', label: 'Public', icon: 'globe' },
                    ].map((option) => (
                      <TouchableOpacity
                        key={option.key}
                        style={[
                          styles.visibilityOption,
                          visibility === option.key && styles.visibilityOptionSelected
                        ]}
                        onPress={() => setVisibility(option.key as any)}
                      >
                        <IconSymbol 
                          name={option.icon as any} 
                          size={20} 
                          color={visibility === option.key ? 'white' : Colors[colorScheme ?? 'light'].text} 
                        />
                        <ThemedText style={[
                          styles.visibilityOptionText,
                          visibility === option.key && styles.visibilityOptionTextSelected
                        ]}>
                          {option.label}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formSection}>
                  <ThemedText style={styles.formLabel}>Max Members</ThemedText>
                  <View style={styles.maxMembersContainer}>
                    <TouchableOpacity
                      style={styles.maxMemberButton}
                      onPress={() => setMaxMembers(Math.max(2, maxMembers - 5))}
                      disabled={maxMembers <= 2}
                    >
                      <IconSymbol name="minus" size={16} color={maxMembers <= 2 ? Colors[colorScheme ?? 'light'].icon + '40' : Colors[colorScheme ?? 'light'].icon} />
                    </TouchableOpacity>
                    
                    <View style={styles.maxMemberValue}>
                      <ThemedText style={styles.maxMemberText}>{maxMembers}</ThemedText>
                    </View>
                    
                    <TouchableOpacity
                      style={styles.maxMemberButton}
                      onPress={() => setMaxMembers(Math.min(100, maxMembers + 5))}
                      disabled={maxMembers >= 100}
                    >
                      <IconSymbol name="plus" size={16} color={maxMembers >= 100 ? Colors[colorScheme ?? 'light'].icon + '40' : Colors[colorScheme ?? 'light'].icon} />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  formTextArea: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  selectedCountContainer: {
    backgroundColor: `${LadColors.primary}15`,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  selectedCount: {
    color: LadColors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  memberItemSelected: {
    backgroundColor: `${LadColors.primary}15`,
  },
  memberInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberNameSelected: {
    color: LadColors.primary,
  },
  memberInterests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestTag: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
    marginBottom: 2,
  },
  interestText: {
    fontSize: 11,
    opacity: 0.7,
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionIndicatorSelected: {
    backgroundColor: LadColors.primary,
    borderColor: LadColors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
    paddingHorizontal: 20,
  },
  visibilityOptions: {
    gap: 8,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  visibilityOptionSelected: {
    backgroundColor: LadColors.primary,
    borderColor: LadColors.primary,
  },
  visibilityOptionText: {
    fontSize: 16,
  },
  visibilityOptionTextSelected: {
    color: 'white',
  },
  maxMembersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  maxMemberButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  maxMemberValue: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  maxMemberText: {
    fontSize: 18,
    fontWeight: '600',
  },
}); 