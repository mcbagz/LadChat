import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Alert, TextInput } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import ProfilePicture from '@/components/ProfilePicture';
import ProfilePictureSelector from '@/components/ProfilePictureSelector';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const { user, updateProfile, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPictureSelector, setShowPictureSelector] = useState(false);
  
  // Use real user data from context
  const [editingProfile, setEditingProfile] = useState({
    bio: user?.bio || '',
    interests: user?.interests || [],
    open_to_friends: user?.open_to_friends || false,
    profile_photo_url: user?.profile_photo_url || undefined,
  });

  // Update editing profile when user data changes
  useEffect(() => {
    if (user) {
      setEditingProfile({
        bio: user.bio || '',
        interests: user.interests || [],
        open_to_friends: user.open_to_friends || false,
        profile_photo_url: user.profile_photo_url || undefined,
      });
    }
  }, [user]);

  const availableInterests = [
    'Soccer', 'Basketball', 'Gaming', 'BBQ', 'Hiking', 'Photography',
    'Music', 'Movies', 'Coffee', 'Fitness', 'Tech', 'Art', 'Cooking',
    'Travel', 'Reading', 'Cycling', 'Skateboarding', 'Surfing', 'Beach',
    'Climbing', 'Running', 'Swimming', 'Yoga', 'Comedy', 'Outdoors'
  ];

  const getProfileCompletionPercentage = () => {
    let completed = 0;
    const total = 4; // Username (always exists), bio, interests, profile picture
    
    if (editingProfile.bio && editingProfile.bio.trim()) completed += 1;
    if (editingProfile.interests.length > 0) completed += 1;
    if (editingProfile.profile_photo_url) completed += 1;
    completed += 1; // Username always exists
    
    return Math.round((completed / total) * 100);
  };

  const handleSaveProfile = async () => {
    setIsUpdating(true);
    try {
      const success = await updateProfile(editingProfile);
      if (success) {
        setIsEditing(false);
        Alert.alert('Profile Updated', 'Your profile has been saved successfully!');
      } else {
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    if (user) {
      setEditingProfile({
        bio: user.bio || '',
        interests: user.interests || [],
        open_to_friends: user.open_to_friends || false,
        profile_photo_url: user.profile_photo_url || undefined,
      });
    }
    setIsEditing(false);
  };

  const toggleInterest = (interest: string) => {
    if (editingProfile.interests.includes(interest)) {
      setEditingProfile(prev => ({
        ...prev,
        interests: prev.interests.filter(i => i !== interest)
      }));
    } else if (editingProfile.interests.length < 3) {
      setEditingProfile(prev => ({
        ...prev,
        interests: [...prev.interests, interest]
      }));
    } else {
      Alert.alert('Limit Reached', 'You can select up to 3 interests');
    }
  };

  const handleProfilePictureSelected = async (imageUri: string) => {
    if (!imageUri) {
      // Handle profile picture removal
      const newProfileData = {
        ...editingProfile,
        profile_photo_url: undefined,
      };
      
      setEditingProfile(newProfileData);
      
      if (!isEditing) {
        setIsUpdating(true);
        try {
          const success = await updateProfile(newProfileData);
          if (success) {
            Alert.alert('Success', 'Profile picture removed successfully!');
          } else {
            Alert.alert('Error', 'Failed to remove profile picture. Please try again.');
            // Revert on failure
            setEditingProfile(prev => ({
              ...prev,
              profile_photo_url: user?.profile_photo_url || undefined,
            }));
          }
        } catch (error) {
          Alert.alert('Error', 'Something went wrong. Please try again.');
          // Revert on failure
          setEditingProfile(prev => ({
            ...prev,
            profile_photo_url: user?.profile_photo_url || undefined,
          }));
        } finally {
          setIsUpdating(false);
        }
      }
      return;
    }

    // Upload image to backend first
    setIsUpdating(true);
    try {
      // Import the apiClient
      const { apiClient } = await import('@/services/api');
      
      // Upload the image to get a backend URL
      const uploadResponse = await apiClient.uploadProfilePicture(imageUri);
      
      if (uploadResponse.success && uploadResponse.data?.profile_photo_url) {
        const backendImageUrl = uploadResponse.data.profile_photo_url;
        
        const newProfileData = {
          ...editingProfile,
          profile_photo_url: backendImageUrl,
        };
        
        setEditingProfile(newProfileData);
        
        // Always save immediately when not in edit mode for profile pictures
        const success = await updateProfile(newProfileData);
        if (success) {
          Alert.alert('Success', 'Profile picture updated successfully!');
        } else {
          Alert.alert('Error', 'Failed to update profile. Please try again.');
          // Revert on failure
          setEditingProfile(prev => ({
            ...prev,
            profile_photo_url: user?.profile_photo_url || undefined,
          }));
        }
      } else {
        Alert.alert('Error', 'Failed to upload image. Please try again.');
        console.error('Upload failed:', uploadResponse.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong uploading your image. Please try again.');
      console.error('Profile picture upload error:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleOpenToFriends = () => {
    setEditingProfile(prev => ({
      ...prev,
      open_to_friends: !prev.open_to_friends,
    }));
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: async () => {
          await logout();
          router.replace('/auth/welcome');
        }}
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          Alert.alert('Account Deleted', 'Your account has been deleted');
        }}
      ]
    );
  };

  const completionPercentage = getProfileCompletionPercentage();

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Profile</ThemedText>
        {!isEditing ? (
          <TouchableOpacity 
            style={styles.editProfileButton}
            onPress={() => setIsEditing(true)}
          >
            <IconSymbol name="pencil" size={16} color="white" />
            <ThemedText style={styles.editProfileButtonText}>Edit Profile</ThemedText>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerEditActions}>
            <TouchableOpacity 
              style={styles.cancelEditButton}
              onPress={handleCancelEdit}
            >
              <ThemedText style={styles.cancelEditButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.saveEditButton, isUpdating && styles.disabledButton]}
              onPress={handleSaveProfile}
              disabled={isUpdating}
            >
              <IconSymbol name="checkmark" size={16} color="white" />
              <ThemedText style={styles.saveEditButtonText}>
                {isUpdating ? 'Saving...' : 'Save'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ThemedView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Completion Banner */}
        {completionPercentage < 100 && (
          <ThemedView style={styles.completionBanner}>
            <View style={styles.completionHeader}>
              <IconSymbol name="chart.pie.fill" size={20} color="#007AFF" />
              <ThemedText style={styles.completionTitle}>
                Profile {completionPercentage}% Complete
              </ThemedText>
            </View>
            <ThemedText style={styles.completionText}>
              Complete your profile to get better friend recommendations!
            </ThemedText>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${completionPercentage}%` }
                ]} 
              />
            </View>
          </ThemedView>
        )}

        {/* Profile Info */}
        <ThemedView style={styles.profileSection}>
          <View style={styles.profilePictureContainer}>
            <ProfilePicture
              uri={editingProfile.profile_photo_url}
              size={100}
              showVerified={user?.is_verified}
              onPress={() => setShowPictureSelector(true)}
              borderWidth={3}
              borderColor={isEditing ? '#007AFF' : 'rgba(0,0,0,0.1)'}
            />
            <TouchableOpacity 
              style={styles.editPictureButton}
              onPress={() => setShowPictureSelector(true)}
            >
              <IconSymbol name="camera.fill" size={16} color="white" />
            </TouchableOpacity>
          </View>

          {isEditing ? (
            <View style={styles.editingContainer}>
              <View style={[styles.input, styles.usernameInput]}>
                <ThemedText style={styles.username}>{user?.username || 'Username'}</ThemedText>
              </View>
              <TextInput
                style={[
                  styles.input, 
                  styles.bioInput,
                  { color: Colors[colorScheme ?? 'light'].text }
                ]}
                value={editingProfile.bio}
                onChangeText={(text) => setEditingProfile(prev => ({ ...prev, bio: text }))}
                placeholder="Bio (optional)"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                maxLength={100}
                multiline
              />
              <ThemedText style={styles.characterCount}>
                {editingProfile.bio.length}/100 characters
              </ThemedText>
            </View>
          ) : (
            <View style={styles.profileInfo}>
              <ThemedText style={styles.username}>{user?.username || 'Username'}</ThemedText>
              <ThemedText style={styles.bio}>
                {editingProfile.bio || 'No bio yet'}
              </ThemedText>
            </View>
          )}
        </ThemedView>

        {/* Stats */}
        <ThemedView style={styles.statsSection}>
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>0</ThemedText>
            <ThemedText style={styles.statLabel}>Friends</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>0</ThemedText>
            <ThemedText style={styles.statLabel}>Hangouts</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>0</ThemedText>
            <ThemedText style={styles.statLabel}>Stories</ThemedText>
          </View>
        </ThemedView>

        {/* Interests */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Interests {isEditing && `(${editingProfile.interests.length}/3)`}
          </ThemedText>
          
          {isEditing ? (
            <View style={styles.interestsGrid}>
              {availableInterests.map((interest) => (
                <TouchableOpacity
                  key={interest}
                  style={[
                    styles.interestChip,
                    editingProfile.interests.includes(interest) && styles.selectedInterest
                  ]}
                  onPress={() => toggleInterest(interest)}
                >
                  <ThemedText style={[
                    styles.interestText,
                    editingProfile.interests.includes(interest) && styles.selectedInterestText
                  ]}>
                    {interest}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.interestsRow}>
              {editingProfile.interests.length > 0 ? (
                editingProfile.interests.map((interest: string, index: number) => (
                  <View key={index} style={styles.interestTag}>
                    <ThemedText style={styles.interestTagText}>{interest}</ThemedText>
                  </View>
                ))
              ) : (
                <ThemedText style={styles.noInterests}>
                  No interests selected yet
                </ThemedText>
              )}
            </View>
          )}
        </ThemedView>

        {/* Friend Discovery Settings */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Friend Discovery
          </ThemedText>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={toggleOpenToFriends}
            disabled={!isEditing}
          >
            <View style={styles.settingContent}>
              <IconSymbol name="person.2.circle" size={20} color={Colors[colorScheme ?? 'light'].icon} />
              <View style={styles.settingTextContainer}>
                <ThemedText style={styles.settingText}>Open to Friends</ThemedText>
                <ThemedText style={styles.settingSubtext}>
                  Allow others to find and add you as a friend
                </ThemedText>
              </View>
            </View>
            <View style={[
              styles.toggle,
              editingProfile.open_to_friends && styles.toggleActive
            ]}>
              <View style={[
                styles.toggleThumb,
                editingProfile.open_to_friends && styles.toggleThumbActive
              ]} />
            </View>
          </TouchableOpacity>
        </ThemedView>



        {!isEditing && (
          <>
            {/* Settings */}
            <ThemedView style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Settings
              </ThemedText>
              
              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingContent}>
                  <IconSymbol name="bell" size={20} color={Colors[colorScheme ?? 'light'].icon} />
                  <ThemedText style={styles.settingText}>Notifications</ThemedText>
                </View>
                <IconSymbol name="chevron.right" size={16} color={Colors[colorScheme ?? 'light'].icon} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingContent}>
                  <IconSymbol name="lock" size={20} color={Colors[colorScheme ?? 'light'].icon} />
                  <ThemedText style={styles.settingText}>Privacy</ThemedText>
                </View>
                <IconSymbol name="chevron.right" size={16} color={Colors[colorScheme ?? 'light'].icon} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingContent}>
                  <IconSymbol name="questionmark.circle" size={20} color={Colors[colorScheme ?? 'light'].icon} />
                  <ThemedText style={styles.settingText}>Help & Support</ThemedText>
                </View>
                <IconSymbol name="chevron.right" size={16} color={Colors[colorScheme ?? 'light'].icon} />
              </TouchableOpacity>
            </ThemedView>

            {/* Account Actions */}
            <ThemedView style={styles.section}>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <IconSymbol name="arrow.right.square" size={20} color="#007AFF" />
                <ThemedText style={styles.logoutText}>Log Out</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
                <IconSymbol name="trash" size={20} color="#FF3B30" />
                <ThemedText style={styles.deleteText}>Delete Account</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </>
        )}
      </ScrollView>

      {/* Profile Picture Selector Modal */}
      <ProfilePictureSelector
        visible={showPictureSelector}
        onClose={() => setShowPictureSelector(false)}
        onImageSelected={handleProfilePictureSelected}
        currentImageUri={editingProfile.profile_photo_url}
      />
    </ThemedView>
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
    paddingTop: 60,
    paddingBottom: 20,
  },
  editButton: {
    padding: 8,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  editProfileButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelEditButton: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  cancelEditButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  saveEditButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  headerEditActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  completionBanner: {
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  completionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  completionText: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(0,122,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  profilePictureContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  editPictureButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#007AFF',
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  editingContainer: {
    width: '100%',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  usernameInput: {
    width: '80%',
    textAlign: 'center',
    fontWeight: '600',
  },
  bioInput: {
    width: '100%',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 12,
  },
  profileInfo: {
    alignItems: 'center',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  statsSection: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 20,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.6,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    marginBottom: 16,
    fontSize: 18,
    fontWeight: '600',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedInterest: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  interestText: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectedInterestText: {
    color: 'white',
  },
  interestTag: {
    backgroundColor: 'rgba(0,122,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  interestTagText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  noInterests: {
    fontSize: 14,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    marginBottom: 2,
  },
  settingSubtext: {
    fontSize: 12,
    opacity: 0.6,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#007AFF',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  disabledButton: {
    opacity: 0.6,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  logoutText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#007AFF',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  deleteText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#FF3B30',
  },
}); 