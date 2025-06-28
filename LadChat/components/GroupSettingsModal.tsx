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
import { apiClient, GroupChat } from '@/services/api';
import ProfilePicture from '@/components/ProfilePicture';
import MemberManagementModal from '@/components/MemberManagementModal';

interface GroupSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  group: GroupChat;
  onGroupUpdated: () => void;
}

export default function GroupSettingsModal({
  visible,
  onClose,
  group,
  onGroupUpdated,
}: GroupSettingsModalProps) {
  const colorScheme = useColorScheme();
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [groupName, setGroupName] = useState(group.name);
  const [groupDescription, setGroupDescription] = useState(group.description || '');
  const [visibility, setVisibility] = useState<'public' | 'private'>(group.visibility as 'public' | 'private');
  const [maxMembers, setMaxMembers] = useState(group.max_members);
  const [autoSuggestMembers, setAutoSuggestMembers] = useState(group.auto_suggest_members);
  const [autoSuggestEvents, setAutoSuggestEvents] = useState(group.auto_suggest_events);
  const [showMemberManagement, setShowMemberManagement] = useState(false);

  useEffect(() => {
    if (visible) {
      // Reset form when modal opens
      setGroupName(group.name);
      setGroupDescription(group.description || '');
      setVisibility(group.visibility as 'public' | 'private');
      setMaxMembers(group.max_members);
      setAutoSuggestMembers(group.auto_suggest_members);
      setAutoSuggestEvents(group.auto_suggest_events);
    }
  }, [visible, group]);

  const handleSaveSettings = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Group name cannot be empty');
      return;
    }

    setIsLoading(true);
    try {
      const updates = {
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        visibility,
        max_members: maxMembers,
        auto_suggest_members: autoSuggestMembers,
        auto_suggest_events: autoSuggestEvents,
      };

      const response = await apiClient.updateGroup(group.id, updates);
      
      if (response.success) {
        Alert.alert('Success', 'Group settings updated successfully!', [
          {
            text: 'OK',
            onPress: () => {
              onGroupUpdated();
              onClose();
            },
          },
        ]);
      } else {
        throw new Error(response.error || 'Failed to update group settings');
      }
    } catch (error) {
      console.error('Failed to update group settings:', error);
      Alert.alert('Error', 'Failed to update group settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${group.name}"? You'll need to be re-added to rejoin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiClient.leaveGroup(group.id);
              if (response.success) {
                Alert.alert('Left Group', `You have left "${group.name}".`, [
                  {
                    text: 'OK',
                    onPress: () => {
                      onGroupUpdated();
                      onClose();
                    },
                  },
                ]);
              } else {
                throw new Error(response.error || 'Failed to leave group');
              }
            } catch (error) {
              console.error('Failed to leave group:', error);
              Alert.alert('Error', 'Failed to leave group. Please try again.');
            }
          },
        },
      ]
    );
  };

  const canEdit = group.user_is_admin;

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
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <IconSymbol name="xmark" size={20} color={Colors[colorScheme ?? 'light'].text} />
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              <ThemedText style={styles.title}>Group Settings</ThemedText>
            </View>
            
            {canEdit && (
              <TouchableOpacity 
                style={[
                  styles.headerButton,
                  styles.saveButton,
                  isLoading && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveSettings}
                disabled={isLoading}
              >
                <ThemedText style={[
                  styles.saveButtonText,
                  isLoading && styles.saveButtonTextDisabled,
                ]}>
                  {isLoading ? 'Saving...' : 'Save'}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Group Info Section */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Group Information</ThemedText>
              
              <View style={styles.groupHeader}>
                <View style={styles.groupAvatarContainer}>
                  <ProfilePicture
                    uri={group.avatar_url}
                    size={60}
                    style={styles.groupAvatar}
                  />
                  {group.user_is_admin && (
                    <View style={styles.adminBadge}>
                      <IconSymbol name="crown.fill" size={12} color="white" />
                    </View>
                  )}
                </View>
                
                <View style={styles.groupBasicInfo}>
                  <ThemedText style={styles.memberCount}>
                    {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                  </ThemedText>
                  <ThemedText style={styles.createdDate}>
                    Created {new Date(group.created_at).toLocaleDateString()}
                  </ThemedText>
                </View>
              </View>

              {/* Members Section */}
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Members</ThemedText>
                
                <TouchableOpacity 
                  style={styles.membersButton}
                  onPress={() => setShowMemberManagement(true)}
                >
                  <View style={styles.membersButtonContent}>
                    <View style={styles.membersInfo}>
                      <View style={styles.membersIconContainer}>
                        <IconSymbol name="person.2.fill" size={24} color={LadColors.primary} />
                      </View>
                      <View style={styles.membersTextContainer}>
                        <ThemedText style={styles.membersButtonTitle}>
                          View Members
                        </ThemedText>
                        <ThemedText style={styles.membersButtonSubtitle}>
                          {group.member_count} member{group.member_count !== 1 ? 's' : ''} 
                          {canEdit && ' • Tap to manage'}
                        </ThemedText>
                      </View>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={Colors[colorScheme ?? 'light'].icon} />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>Group Name</ThemedText>
                <TextInput
                  style={[
                    styles.textInput,
                    { color: Colors[colorScheme ?? 'light'].text },
                    !canEdit && styles.disabledInput
                  ]}
                  placeholder="Enter group name"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                  value={groupName}
                  onChangeText={setGroupName}
                  maxLength={100}
                  editable={canEdit}
                />
                <ThemedText style={styles.inputHelper}>
                  {groupName.length}/100 characters
                </ThemedText>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>Description</ThemedText>
                <TextInput
                  style={[
                    styles.textArea,
                    { color: Colors[colorScheme ?? 'light'].text },
                    !canEdit && styles.disabledInput
                  ]}
                  placeholder="What's this group about?"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                  value={groupDescription}
                  onChangeText={setGroupDescription}
                  maxLength={500}
                  multiline
                  numberOfLines={3}
                  editable={canEdit}
                />
                <ThemedText style={styles.inputHelper}>
                  {groupDescription.length}/500 characters
                </ThemedText>
              </View>
            </View>

            {canEdit && (
              <>
                {/* Privacy Settings */}
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Privacy Settings</ThemedText>
                  
                  <View style={styles.settingContainer}>
                    <ThemedText style={styles.settingLabel}>Group Visibility</ThemedText>
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
                        onPress={() => setMaxMembers(Math.max(group.member_count, maxMembers - 5))}
                        disabled={maxMembers <= group.member_count}
                      >
                        <IconSymbol 
                          name="minus" 
                          size={16} 
                          color={maxMembers <= group.member_count ? Colors[colorScheme ?? 'light'].icon + '40' : Colors[colorScheme ?? 'light'].icon} 
                        />
                      </TouchableOpacity>
                      
                      <View style={styles.maxMemberValue}>
                        <ThemedText style={styles.maxMemberText}>{maxMembers}</ThemedText>
                      </View>
                      
                      <TouchableOpacity
                        style={styles.maxMemberButton}
                        onPress={() => setMaxMembers(Math.min(100, maxMembers + 5))}
                        disabled={maxMembers >= 100}
                      >
                        <IconSymbol 
                          name="plus" 
                          size={16} 
                          color={maxMembers >= 100 ? Colors[colorScheme ?? 'light'].icon + '40' : Colors[colorScheme ?? 'light'].icon} 
                        />
                      </TouchableOpacity>
                    </View>
                    <ThemedText style={styles.settingHelper}>
                      Cannot be less than current member count ({group.member_count})
                    </ThemedText>
                  </View>
                </View>

                {/* AI Settings */}
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>AI Features</ThemedText>
                  
                  <TouchableOpacity
                    style={styles.toggleContainer}
                    onPress={() => setAutoSuggestMembers(!autoSuggestMembers)}
                  >
                    <View style={styles.toggleInfo}>
                      <ThemedText style={styles.settingLabel}>Auto-Suggest Members</ThemedText>
                      <ThemedText style={styles.settingHelper}>
                        AI suggests new members based on group interests
                      </ThemedText>
                    </View>
                    <View style={[
                      styles.toggle,
                      autoSuggestMembers && styles.toggleActive,
                    ]}>
                      <View style={[
                        styles.toggleThumb,
                        autoSuggestMembers && styles.toggleThumbActive,
                      ]} />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.toggleContainer}
                    onPress={() => setAutoSuggestEvents(!autoSuggestEvents)}
                  >
                    <View style={styles.toggleInfo}>
                      <ThemedText style={styles.settingLabel}>Auto-Suggest Events</ThemedText>
                      <ThemedText style={styles.settingHelper}>
                        AI suggests relevant events based on group activity
                      </ThemedText>
                    </View>
                    <View style={[
                      styles.toggle,
                      autoSuggestEvents && styles.toggleActive,
                    ]}>
                      <View style={[
                        styles.toggleThumb,
                        autoSuggestEvents && styles.toggleThumbActive,
                      ]} />
                    </View>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Group Interests */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Group Interests</ThemedText>
              {group.group_interests.length > 0 ? (
                <View style={styles.interestsContainer}>
                  {group.group_interests.map((interest, index) => (
                    <View key={index} style={styles.interestTag}>
                      <ThemedText style={styles.interestText}>{interest}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : (
                <ThemedText style={styles.noInterests}>
                  No group interests detected yet. Interests are automatically generated based on member activity.
                </ThemedText>
              )}
            </View>

            {/* Danger Zone */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Danger Zone</ThemedText>
              
              <TouchableOpacity 
                style={styles.dangerButton}
                onPress={handleLeaveGroup}
              >
                <IconSymbol name="arrow.right.square" size={16} color="#FF3B30" />
                <ThemedText style={styles.dangerButtonText}>Leave Group</ThemedText>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      
      {/* Member Management Modal */}
      <MemberManagementModal
        visible={showMemberManagement}
        onClose={() => setShowMemberManagement(false)}
        group={group}
        onMembersUpdated={() => {
          onGroupUpdated();
          setShowMemberManagement(false);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
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
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 36,
  },
  saveButtonDisabled: {
    backgroundColor: '#007AFF40',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: 'white60',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  groupAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  groupAvatar: {
    borderRadius: 30,
  },
  adminBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  groupBasicInfo: {
    flex: 1,
  },
  memberCount: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  createdDate: {
    fontSize: 14,
    opacity: 0.7,
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
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: Colors.light.card,
  },
  textArea: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: Colors.light.card,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  disabledInput: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    opacity: 0.7,
  },
  inputHelper: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
    textAlign: 'right',
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
    backgroundColor: Colors.light.card,
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
    backgroundColor: LadColors.primary,
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
    color: 'white',
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
    backgroundColor: Colors.light.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maxMemberValue: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginHorizontal: 16,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  maxMemberText: {
    fontSize: 18,
    fontWeight: '600',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 16,
  },
  toggleInfo: {
    flex: 1,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5E5EA',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#34C759',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: 'rgba(0,122,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  noInterests: {
    fontSize: 14,
    opacity: 0.7,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,59,48,0.1)',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  dangerButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  membersButton: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  membersButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  membersInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  membersIconContainer: {
    marginRight: 16,
  },
  membersTextContainer: {
    flex: 1,
  },
  membersButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  membersButtonSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
}); 