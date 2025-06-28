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
import { Colors } from '@/constants/Colors';
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
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            {step !== 'info' ? (
              <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
                <IconSymbol name="chevron.left" size={20} color={Colors[colorScheme ?? 'light'].text} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.headerButton} onPress={onClose}>
                <IconSymbol name="xmark" size={20} color={Colors[colorScheme ?? 'light'].text} />
              </TouchableOpacity>
            )}
            
            <View style={styles.headerContent}>
              <ThemedText style={styles.title}>
                {step === 'info' ? 'Create Group' : 
                 step === 'members' ? 'Add Members' : 'Group Settings'}
              </ThemedText>
            </View>
            
            {step === 'settings' ? (
              <TouchableOpacity 
                style={[
                  styles.headerButton,
                  styles.createButton,
                  isLoading && styles.createButtonDisabled,
                ]}
                onPress={handleCreateGroup}
                disabled={isLoading}
              >
                <ThemedText style={[
                  styles.createButtonText,
                  isLoading && styles.createButtonTextDisabled,
                ]}>
                  {isLoading ? 'Creating...' : 'Create'}
                </ThemedText>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[
                  styles.headerButton,
                  styles.nextButton,
                  !canProceed() && styles.nextButtonDisabled,
                ]}
                onPress={handleNext}
                disabled={!canProceed()}
              >
                <ThemedText style={[
                  styles.nextButtonText,
                  !canProceed() && styles.nextButtonTextDisabled,
                ]}>
                  Next
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {step === 'info' && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Group Information</ThemedText>
                
                <View style={styles.inputContainer}>
                  <ThemedText style={styles.inputLabel}>Group Name *</ThemedText>
                  <TextInput
                    style={[styles.textInput, { color: Colors[colorScheme ?? 'light'].text }]}
                    placeholder="Enter group name"
                    placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                    value={groupName}
                    onChangeText={setGroupName}
                    maxLength={100}
                    autoFocus
                  />
                  <ThemedText style={styles.inputHelper}>
                    {groupName.length}/100 characters
                  </ThemedText>
                </View>

                <View style={styles.inputContainer}>
                  <ThemedText style={styles.inputLabel}>Description (Optional)</ThemedText>
                  <TextInput
                    style={[styles.textArea, { color: Colors[colorScheme ?? 'light'].text }]}
                    placeholder="What's this group about?"
                    placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                    value={groupDescription}
                    onChangeText={setGroupDescription}
                    maxLength={500}
                    multiline
                    numberOfLines={3}
                  />
                  <ThemedText style={styles.inputHelper}>
                    {groupDescription.length}/500 characters
                  </ThemedText>
                </View>
              </View>
            )}

            {step === 'members' && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Add Members</ThemedText>
                <ThemedText style={styles.sectionSubtitle}>
                  Select friends to add to your group (optional)
                </ThemedText>
                
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
                      placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
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
                            borderColor={isSelected ? '#007AFF' : 'transparent'}
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
            )}

            {step === 'settings' && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Group Settings</ThemedText>
                
                <View style={styles.settingContainer}>
                  <ThemedText style={styles.settingLabel}>Privacy</ThemedText>
                  <View style={styles.segmentedControl}>
                    {(['private', 'public'] as const).map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.segmentedOption,
                          visibility === option && styles.segmentedOptionSelected,
                        ]}
                        onPress={() => setVisibility(option)}
                      >
                        <ThemedText style={[
                          styles.segmentedOptionText,
                          visibility === option && styles.segmentedOptionTextSelected,
                        ]}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <ThemedText style={styles.settingHelper}>
                    Private groups are only visible to members
                  </ThemedText>
                </View>

                <View style={styles.settingContainer}>
                  <ThemedText style={styles.settingLabel}>Max Members</ThemedText>
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
              </View>
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
  nextButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 36,
  },
  nextButtonDisabled: {
    backgroundColor: '#007AFF40',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButtonTextDisabled: {
    color: 'white60',
  },
  createButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 36,
  },
  createButtonDisabled: {
    backgroundColor: '#34C75940',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  createButtonTextDisabled: {
    color: 'white60',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputHelper: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
    textAlign: 'right',
  },
  selectedCountContainer: {
    backgroundColor: '#007AFF10',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  selectedCount: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
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
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  memberItemSelected: {
    backgroundColor: '#007AFF10',
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
    color: '#007AFF',
  },
  memberInterests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  settingContainer: {
    marginBottom: 24,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  settingHelper: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 4,
  },
  segmentedOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentedOptionSelected: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentedOptionText: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },
  segmentedOptionTextSelected: {
    opacity: 1,
    fontWeight: '600',
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
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  maxMemberValue: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  maxMemberText: {
    fontSize: 18,
    fontWeight: '600',
  },
}); 