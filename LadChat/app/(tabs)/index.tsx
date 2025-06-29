import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Platform, Animated, Dimensions } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LadColors, Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/services/api';
import { LadCopy } from '@/utils/LadCopy';
import CameraPreview, { CaptionData, DrawingPath } from '@/components/CameraPreview';
import ShareToModal from '@/components/ShareToModal';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(true);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [capturedMedia, setCapturedMedia] = useState<{
    uri: string;
    type: 'photo';
  } | null>(null);
  
  const cameraRef = useRef<CameraView>(null);
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  
  // Check if this is for direct messaging or group messaging
  const isDirectMessage = params.directMessage === 'true';
  const isGroupMessage = params.groupMessage === 'true';
  const recipientId = params.recipientId ? parseInt(params.recipientId as string) : null;
  const recipientUsername = params.recipientUsername as string;
  const groupId = params.groupId ? parseInt(params.groupId as string) : null;
  const groupName = params.groupName as string;

  // Handle tab focus to reset camera when switching tabs
  useFocusEffect(
    useCallback(() => {
      setIsCameraReady(false);
      const timer = setTimeout(() => {
        setIsCameraReady(true);
      }, 100);

      return () => {
        clearTimeout(timer);
        setIsCameraReady(false);
      };
    }, [])
  );

  useEffect(() => {
    if (!cameraPermission?.granted) {
      requestCameraPermission();
    }
  }, []);

  if (!cameraPermission) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>{LadCopy.SYSTEM.LOADING()}</ThemedText>
      </ThemedView>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.message}>We need camera access to capture those epic moments</ThemedText>
        <TouchableOpacity onPress={requestCameraPermission} style={styles.permissionButton}>
          <ThemedText style={styles.buttonText}>Grant Camera Permission</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  const handleCapturedMedia = (mediaUri: string, mediaType: 'photo') => {
    setCapturedMedia({ uri: mediaUri, type: mediaType });
    setPreviewVisible(true);
  };

  const handlePreviewSave = async (
    editedMediaUri: string, 
    captions: CaptionData[], 
    drawings: DrawingPath[]
  ) => {
    if (isDirectMessage && recipientId && recipientUsername) {
      setPreviewVisible(false);
      sendDirectMessage(editedMediaUri, capturedMedia!.type);
      return;
    }

    if (isGroupMessage && groupId && groupName) {
      setPreviewVisible(false);
      sendGroupMessage(editedMediaUri, capturedMedia!.type);
      return;
    }

    // For normal camera usage, update the media URI with edited version and show share modal
    // Keep preview visible until sharing is complete
    setCapturedMedia(prev => prev ? { ...prev, uri: editedMediaUri } : null);
    setShareModalVisible(true);
  };

  const createStory = async (mediaUri: string, mediaType: 'photo' | 'video') => {
    try {
      const response = await apiClient.createStory(mediaUri, undefined, 'public');
      if (response.success) {
        Alert.alert(LadCopy.QUICK.SUCCESS, LadCopy.STORIES.STORY_POSTED(), [
          {
            text: 'View Stories',
            onPress: () => router.push('/(tabs)/stories'),
          },
          {
            text: 'Sweet!',
            style: 'default',
          },
        ]);
        setCapturedMedia(null);
      } else {
        Alert.alert(LadCopy.QUICK.ERROR, response.error || 'Failed to create story');
      }
    } catch (error) {
      Alert.alert(LadCopy.QUICK.ERROR, 'Failed to create story');
    }
  };

  const handlePreviewClose = () => {
    setPreviewVisible(false);
    setCapturedMedia(null);
  };

  const handlePreviewRetake = () => {
    setPreviewVisible(false);
    setCapturedMedia(null);
  };

  const sendDirectMessage = async (mediaUri: string, mediaType: 'photo') => {
    if (!recipientId || !recipientUsername) {
      Alert.alert(LadCopy.QUICK.ERROR, 'Invalid recipient information');
      return;
    }

    try {
      const response = await apiClient.sendMediaMessage(recipientId, mediaUri, 10, undefined);

      if (response.success) {
        Alert.alert(LadCopy.QUICK.SUCCESS, `Photo sent to ${recipientUsername}! 🔥`, [
          {
            text: 'Legendary!',
            onPress: () => {
              router.push({
                pathname: '/chat',
                params: {
                  userId: recipientId.toString(),
                  username: recipientUsername,
                },
              });
            },
          },
        ]);
      } else {
        Alert.alert(LadCopy.QUICK.ERROR, response.error || 'Failed to send message');
      }
    } catch (error) {
      Alert.alert(LadCopy.QUICK.ERROR, 'Failed to send message');
    }
  };

  const sendGroupMessage = async (mediaUri: string, mediaType: 'photo') => {
    if (!groupId || !groupName) {
      Alert.alert(LadCopy.QUICK.ERROR, 'Invalid group information');
      return;
    }

    try {
      const response = await apiClient.sendGroupMediaMessage(groupId, mediaUri, 10, undefined);

      if (response.success) {
        Alert.alert(LadCopy.QUICK.SUCCESS, `Photo sent to ${groupName}! 🚀`, [
          {
            text: 'Epic!',
            onPress: () => {
              router.push({
                pathname: '/messages/chat',
                params: {
                  groupId: groupId.toString(),
                  groupName: groupName,
                  isGroup: 'true',
                },
              });
            },
          },
        ]);
      } else {
        Alert.alert(LadCopy.QUICK.ERROR, response.error || 'Failed to send message');
      }
    } catch (error) {
      Alert.alert(LadCopy.QUICK.ERROR, 'Failed to send message');
    }
  };

  const handleShare = async (includeStory: boolean, friendIds: number[], groupIds: number[]) => {
    if (!capturedMedia) {
      Alert.alert(LadCopy.QUICK.ERROR, 'No media to share');
      return;
    }

    console.log('🚀 SHARING DEBUG - Starting share process:', {
      includeStory,
      friendIds,
      groupIds,
      mediaUri: capturedMedia.uri
    });

    setShareModalVisible(false);

    try {
      const promises: Promise<any>[] = [];

      // Add to story if selected
      if (includeStory) {
        console.log('📖 SHARING DEBUG - Adding to story');
        promises.push(apiClient.createStory(capturedMedia.uri, undefined, 'public'));
      }

      // Send to friends and groups if selected
      if (friendIds.length > 0 || groupIds.length > 0) {
        console.log('📤 SHARING DEBUG - Sending snap to:', {
          friendIds,
          groupIds,
          friendCount: friendIds.length,
          groupCount: groupIds.length
        });
        promises.push(apiClient.sendSnap(friendIds, groupIds, capturedMedia.uri, 10, undefined));
      }

      if (promises.length === 0) {
        Alert.alert('No Selection', 'Please select at least one recipient or add to your story');
        return;
      }

      console.log('⏳ SHARING DEBUG - Executing', promises.length, 'API calls');
      const results = await Promise.all(promises);
      
      console.log('📋 SHARING DEBUG - Results:', results);

      const successful = results.every(result => result.success);

      if (successful) {
        const messages = [];
        if (includeStory) messages.push('Added to your story');
        if (friendIds.length > 0 || groupIds.length > 0) {
          const totalRecipients = friendIds.length + groupIds.length;
          messages.push(`Sent to ${totalRecipients} recipient${totalRecipients !== 1 ? 's' : ''}`);
        }
        
        console.log('✅ SHARING DEBUG - All successful, closing modals');
        Alert.alert(LadCopy.QUICK.SUCCESS, messages.join(' and ') + '! 🔥');
        
        // Close both modals and clear media
        setPreviewVisible(false);
        setCapturedMedia(null);
      } else {
        console.error('❌ SHARING DEBUG - Some failures:', results.filter(r => !r.success));
        Alert.alert(LadCopy.QUICK.ERROR, 'Some sharing actions failed. Check console for details.');
      }
    } catch (error) {
      console.error('❌ SHARING DEBUG - Exception:', error);
      Alert.alert(LadCopy.QUICK.ERROR, 'Failed to share photo');
    }
  };

  const closeShareModal = () => {
    setShareModalVisible(false);
    setPreviewVisible(false);
    setCapturedMedia(null);
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        
        handleCapturedMedia(photo.uri, 'photo');
      } catch (error) {
        Alert.alert(LadCopy.QUICK.ERROR, 'Failed to take photo');
      }
    }
  };

  return (
    <View style={styles.container}>
      {isCameraReady && !previewVisible && (
        <CameraView 
          style={styles.camera} 
          facing={facing}
          ref={cameraRef}
        >
        <View style={styles.overlay}>
          {/* Direct/Group Message Indicator */}
          {isDirectMessage && recipientUsername && (
            <View style={styles.directMessageIndicator}>
              <IconSymbol name="message.fill" size={16} color="white" />
              <ThemedText style={styles.directMessageText}>
                Sending to {recipientUsername}
              </ThemedText>
            </View>
          )}
          {isGroupMessage && groupName && (
            <View style={styles.directMessageIndicator}>
              <IconSymbol name="person.3.fill" size={16} color="white" />
              <ThemedText style={styles.directMessageText}>
                Sending to {groupName}
              </ThemedText>
            </View>
          )}

          {/* Camera Controls */}
          <View style={styles.topControls}>
            <View style={styles.spacer} />
            <TouchableOpacity 
              style={styles.flipButton} 
              onPress={toggleCameraFacing}
            >
              <IconSymbol 
                name="arrow.triangle.2.circlepath.camera" 
                size={24} 
                color="white" 
              />
            </TouchableOpacity>
          </View>

          {/* Bottom Controls */}
          <View style={styles.bottomControls}>
            {/* Capture Button */}
            <TouchableOpacity 
              style={styles.captureButton}
              onPress={takePhoto}
            >
              <View style={[
                styles.captureButtonInner,
                { backgroundColor: LadColors.camera.photoButton }
              ]} />
            </TouchableOpacity>
            
            {/* Instructions */}
            <ThemedText style={styles.instructionText}>
              Tap to take photo
            </ThemedText>
          </View>
        </View>
      </CameraView>
      )}

      {/* Camera Preview Modal */}
        <CameraPreview
          visible={previewVisible}
        mediaUri={capturedMedia?.uri || ''}
        mediaType={capturedMedia?.type || 'photo'}
        onSave={handlePreviewSave}
          onClose={handlePreviewClose}
          onRetake={handlePreviewRetake}
        />

      {/* Share To Modal */}
      <ShareToModal
        visible={shareModalVisible}
        onClose={closeShareModal}
        onShare={handleShare}
        mediaType={capturedMedia?.type || null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    fontSize: 16,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: LadColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignSelf: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Top Controls
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  spacer: {
    flex: 1,
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Direct Message Indicator
  directMessageIndicator: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  directMessageText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  
  // Bottom Controls
  bottomControls: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 4,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  instructionText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
  },
});