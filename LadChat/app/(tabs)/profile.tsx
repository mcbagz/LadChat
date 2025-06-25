import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Alert, TextInput } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const { user, updateProfile, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Use real user data from context
  const [editingProfile, setEditingProfile] = useState({
    bio: user?.bio || '',
    interests: user?.interests || [],
    open_to_friends: user?.open_to_friends || false,
  });

  // Update editing profile when user data changes
  useEffect(() => {
    if (user) {
      setEditingProfile({
        bio: user.bio || '',
        interests: user.interests || [],
        open_to_friends: user.open_to_friends || false,
      });
    }
  }, [user]);

  const availableInterests = [
    'Soccer', 'Basketball', 'Gaming', 'BBQ', 'Hiking', 'Photography',
    'Music', 'Movies', 'Coffee', 'Fitness', 'Tech', 'Art', 'Cooking',
    'Travel', 'Reading', 'Cycling', 'Skateboarding', 'Surfing'
  ];

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

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Profile</ThemedText>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
        >
          <IconSymbol 
            name={isEditing ? "checkmark" : "pencil"} 
            size={20} 
            color={Colors[colorScheme ?? 'light'].tint} 
          />
        </TouchableOpacity>
      </ThemedView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Info */}
        <ThemedView style={styles.profileSection}>
          <View style={styles.profilePicture}>
            <IconSymbol 
              name="person.crop.circle.fill" 
              size={80} 
              color={Colors[colorScheme ?? 'light'].icon} 
            />
            {isEditing && (
              <TouchableOpacity style={styles.editPictureButton}>
                <IconSymbol name="camera.fill" size={16} color="white" />
              </TouchableOpacity>
            )}
          </View>

          {isEditing ? (
            <View style={styles.editingContainer}>
              <View style={[styles.input, styles.usernameInput]}>
                <ThemedText style={styles.username}>{user?.username || 'Username'}</ThemedText>
              </View>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={editingProfile.bio}
                onChangeText={(text) => setEditingProfile(prev => ({ ...prev, bio: text }))}
                placeholder="Bio (optional)"
                maxLength={100}
                multiline
              />
            </View>
          ) : (
            <View style={styles.profileInfo}>
              <ThemedText style={styles.username}>{user?.username || 'Username'}</ThemedText>
              <ThemedText style={styles.bio}>{user?.bio || 'No bio yet'}</ThemedText>
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
              {(user?.interests || []).map((interest: string, index: number) => (
                <View key={index} style={styles.interestTag}>
                  <ThemedText style={styles.interestTagText}>{interest}</ThemedText>
                </View>
              ))}
            </View>
          )}
        </ThemedView>

        {isEditing && (
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
              <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.saveButton, isUpdating && styles.disabledButton]} 
              onPress={handleSaveProfile}
              disabled={isUpdating}
            >
              <ThemedText style={styles.saveButtonText}>
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {!isEditing && (
          <>
            {/* Settings */}
            <ThemedView style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Settings
              </ThemedText>
              
              <TouchableOpacity style={styles.settingItem}>
                <IconSymbol name="bell" size={20} color={Colors[colorScheme ?? 'light'].icon} />
                <ThemedText style={styles.settingText}>Notifications</ThemedText>
                <IconSymbol name="chevron.right" size={16} color={Colors[colorScheme ?? 'light'].icon} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.settingItem}>
                <IconSymbol name="lock" size={20} color={Colors[colorScheme ?? 'light'].icon} />
                <ThemedText style={styles.settingText}>Privacy</ThemedText>
                <IconSymbol name="chevron.right" size={16} color={Colors[colorScheme ?? 'light'].icon} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.settingItem}>
                <IconSymbol name="questionmark.circle" size={20} color={Colors[colorScheme ?? 'light'].icon} />
                <ThemedText style={styles.settingText}>Help & Support</ThemedText>
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  profilePicture: {
    position: 'relative',
    marginBottom: 16,
  },
  editPictureButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editingContainer: {
    width: '100%',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  usernameInput: {
    width: '80%',
    textAlign: 'center',
    fontWeight: '600',
  },
  bioInput: {
    width: '100%',
    minHeight: 60,
    textAlign: 'center',
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
    paddingVertical: 8,
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
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestTagText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
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
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
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