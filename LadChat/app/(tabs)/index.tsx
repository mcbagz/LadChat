import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/services/api';
import FriendSelector from '@/components/FriendSelector';

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [isCameraReady, setIsCameraReady] = useState(true);
  const [friendSelectorVisible, setFriendSelectorVisible] = useState(false);
  const [pendingMediaUri, setPendingMediaUri] = useState<string | null>(null);
  const [pendingMediaType, setPendingMediaType] = useState<'photo' | 'video' | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  
  // Check if this is for direct messaging
  const isDirectMessage = params.directMessage === 'true';
  const recipientId = params.recipientId ? parseInt(params.recipientId as string) : null;
  const recipientUsername = params.recipientUsername as string;

  // Handle tab focus to reset camera when switching tabs
  useFocusEffect(
    useCallback(() => {
      // Reset camera when tab becomes focused
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
    if (!microphonePermission?.granted) {
      requestMicrophonePermission();
    }
  }, []);

  if (!cameraPermission) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Requesting camera permission...</ThemedText>
      </ThemedView>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.message}>We need your permission to show the camera</ThemedText>
        <TouchableOpacity onPress={requestCameraPermission} style={styles.button}>
          <ThemedText style={styles.buttonText}>Grant Camera Permission</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  if (!microphonePermission?.granted) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.message}>We need your permission to record audio</ThemedText>
        <TouchableOpacity onPress={requestMicrophonePermission} style={styles.button}>
          <ThemedText style={styles.buttonText}>Grant Microphone Permission</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  const showStoryCreationOptions = (mediaUri: string, mediaType: 'photo' | 'video') => {
    // If this is for direct messaging, send directly
    if (isDirectMessage && recipientId && recipientUsername) {
      sendDirectMessage(mediaUri, mediaType);
      return;
    }

    // Otherwise show normal options
    Alert.alert(
      'Create Content',
      'What would you like to do with this ' + mediaType + '?',
      [
        {
          text: 'Add to Story',
          onPress: () => createStory(mediaUri, mediaType),
        },
        {
          text: 'Send to Friend',
          onPress: () => sendToFriend(mediaUri, mediaType),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const createStory = async (mediaUri: string, mediaType: 'photo' | 'video') => {
    try {
      console.log('Creating story with URI:', mediaUri);
      const response = await apiClient.createStory(mediaUri, undefined, 'public');
      if (response.success) {
        Alert.alert('Success', 'Story created successfully! Go to Stories tab to see it.');
        // Navigate to stories tab to show the new story
        router.push('/(tabs)/stories');
      } else {
        console.error('Story creation failed:', response.error);
        Alert.alert('Error', response.error || 'Failed to create story');
      }
    } catch (error) {
      console.error('Error creating story:', error);
      Alert.alert('Error', 'Failed to create story');
    }
  };

  const sendToFriend = (mediaUri: string, mediaType: 'photo' | 'video') => {
    setPendingMediaUri(mediaUri);
    setPendingMediaType(mediaType);
    setFriendSelectorVisible(true);
  };

  const sendDirectMessage = async (mediaUri: string, mediaType: 'photo' | 'video') => {
    if (!recipientId || !recipientUsername) {
      Alert.alert('Error', 'Invalid recipient information');
      return;
    }

    try {
      console.log('Sending direct message media to:', recipientUsername);
      const response = await apiClient.sendMediaMessage(
        recipientId,
        mediaUri,
        10, // 10 second view duration
        undefined // No caption for now
      );

      if (response.success) {
        Alert.alert('Success', `${mediaType} sent to ${recipientUsername}!`, [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to the chat
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
        console.error('Direct message sending failed:', response.error);
        Alert.alert('Error', response.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending direct message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleSendSnap = async (selectedFriendIds: number[]) => {
    if (!pendingMediaUri || !pendingMediaType) {
      Alert.alert('Error', 'No media to send');
      return;
    }

    try {
      console.log('Sending snap to friends:', selectedFriendIds);
      const response = await apiClient.sendSnap(
        selectedFriendIds,
        [], // No groups for now
        pendingMediaUri,
        10, // 10 second view duration
        undefined // No caption for now
      );

      if (response.success) {
        Alert.alert('Success', `Snap sent to ${selectedFriendIds.length} friend${selectedFriendIds.length !== 1 ? 's' : ''}!`);
        // Clear pending media
        setPendingMediaUri(null);
        setPendingMediaType(null);
      } else {
        console.error('Snap sending failed:', response.error);
        Alert.alert('Error', response.error || 'Failed to send snap');
      }
    } catch (error) {
      console.error('Error sending snap:', error);
      Alert.alert('Error', 'Failed to send snap');
    }
  };

  const closeFriendSelector = () => {
    setFriendSelectorVisible(false);
    // Clear pending media when cancelled
    setPendingMediaUri(null);
    setPendingMediaType(null);
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        
        // Show story creation options
        showStoryCreationOptions(photo.uri, 'photo');
      } catch (error) {
        console.error('Error taking photo:', error);
        Alert.alert('Error', 'Failed to take photo');
      }
    }
  };

  const startRecording = async () => {
    if (cameraRef.current && !isRecording) {
      try {
        setIsRecording(true);
        const video = await cameraRef.current.recordAsync({
          maxDuration: 60, // 60 seconds max for snaps
        });
        
        // Show story creation options
        if (video) {
          showStoryCreationOptions(video.uri, 'video');
        }
      } catch (error) {
        console.error('Error recording video:', error);
        Alert.alert('Error', 'Failed to record video');
      } finally {
        setIsRecording(false);
      }
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
      setIsRecording(false);
    }
  };

  return (
    <View style={styles.container}>
      {isCameraReady && (
        <CameraView 
          style={styles.camera} 
          facing={facing}
          ref={cameraRef}
          mode="picture"
        >
        <View style={styles.overlay}>
          {/* Direct Message Indicator */}
          {isDirectMessage && recipientUsername && (
            <View style={styles.directMessageIndicator}>
              <IconSymbol name="message.fill" size={16} color="white" />
              <ThemedText style={styles.directMessageText}>
                Sending to {recipientUsername}
              </ThemedText>
            </View>
          )}

          {/* Top Controls */}
          <View style={styles.topControls}>
            <TouchableOpacity 
              style={styles.controlButton} 
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
            <TouchableOpacity 
              style={styles.captureButton}
              onPress={takePhoto}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.videoButton, isRecording && styles.recordingButton]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
            >
              <IconSymbol 
                name={isRecording ? "stop.fill" : "video.fill"} 
                size={24} 
                color="white" 
              />
            </TouchableOpacity>
          </View>

          {/* Recording Indicator */}
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <ThemedText style={styles.recordingText}>Recording...</ThemedText>
            </View>
          )}
        </View>
      </CameraView>
      )}

      {/* Friend Selector Modal */}
      <FriendSelector
        visible={friendSelectorVisible}
        onClose={closeFriendSelector}
        onSelectFriends={handleSendSnap}
        title="Send Snap"
        subtitle={`Send ${pendingMediaType || 'media'} to your friends`}
        confirmButtonText="Send"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    paddingTop: 60,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  controlButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    padding: 10,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  captureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
  },
  videoButton: {
    backgroundColor: 'rgba(255,0,0,0.7)',
    borderRadius: 25,
    padding: 15,
  },
  recordingButton: {
    backgroundColor: 'rgba(255,0,0,1)',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 60,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 5,
  },
  recordingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  directMessageIndicator: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,122,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  directMessageText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 20,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
