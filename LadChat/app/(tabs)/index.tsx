import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Platform, Animated, Dimensions } from 'react-native';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LadColors, Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/services/api';
import { LadCopy } from '@/utils/LadCopy';
import FriendSelector from '@/components/FriendSelector';
import CameraPreview, { CaptionData, DrawingPath } from '@/components/CameraPreview';
import QuickSendOverlay from '@/components/QuickSendOverlay';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Camera mode types
type CameraMode = 'story' | 'snap';

// Mock friends data - replace with real data from API
const mockFriends = [
  { id: 1, username: 'jake_the_lad', profile_photo_url: undefined, is_verified: false, is_online: true },
  { id: 2, username: 'mike_legend', profile_photo_url: undefined, is_verified: true, is_online: false, last_active: new Date().toISOString() },
  { id: 3, username: 'tommy_bro', profile_photo_url: undefined, is_verified: false, is_online: true },
];

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isRecordingInProgress, setIsRecordingInProgress] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [isCameraReady, setIsCameraReady] = useState(true);
  const [friendSelectorVisible, setFriendSelectorVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [capturedMedia, setCapturedMedia] = useState<{
    uri: string;
    type: 'photo' | 'video';
  } | null>(null);
  
  // New camera mode state
  const [cameraMode, setCameraMode] = useState<CameraMode>('story');
  const [showQuickSend, setShowQuickSend] = useState(false);
  const [modeHintVisible, setModeHintVisible] = useState(true);
  
  // Animation values
  const recordButtonScale = useRef(new Animated.Value(1)).current;
  const modeIndicatorOpacity = useRef(new Animated.Value(1)).current;
  const hintOpacity = useRef(new Animated.Value(1)).current;
  
  const cameraRef = useRef<CameraView>(null);
  const recordingTimerRef = useRef<any>(null);
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

  // Hide mode hint after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(hintOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setModeHintVisible(false));
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

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
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
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

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
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

  if (!microphonePermission?.granted) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.message}>We need mic access for those legendary videos</ThemedText>
        <TouchableOpacity onPress={requestMicrophonePermission} style={styles.permissionButton}>
          <ThemedText style={styles.buttonText}>Grant Microphone Permission</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  const switchCameraMode = (mode: CameraMode) => {
    setCameraMode(mode);
    setShowQuickSend(mode === 'snap');
    
    // Animate mode indicator
    Animated.sequence([
      Animated.timing(modeIndicatorOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(modeIndicatorOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleCapturedMedia = (mediaUri: string, mediaType: 'photo' | 'video') => {
    setCapturedMedia({ uri: mediaUri, type: mediaType });
    setPreviewVisible(true);
  };

  const handlePreviewSave = async (
    editedMediaUri: string, 
    captions: CaptionData[], 
    drawings: DrawingPath[]
  ) => {
    setPreviewVisible(false);
    
    if (isDirectMessage && recipientId && recipientUsername) {
      sendDirectMessage(editedMediaUri, capturedMedia!.type);
      return;
    }

    if (isGroupMessage && groupId && groupName) {
      sendGroupMessage(editedMediaUri, capturedMedia!.type);
      return;
    }

    if (cameraMode === 'story') {
      createStory(editedMediaUri, capturedMedia!.type);
    } else {
      setFriendSelectorVisible(true);
    }
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

  const sendDirectMessage = async (mediaUri: string, mediaType: 'photo' | 'video') => {
    if (!recipientId || !recipientUsername) {
      Alert.alert(LadCopy.QUICK.ERROR, 'Invalid recipient information');
      return;
    }

    try {
      const response = await apiClient.sendMediaMessage(recipientId, mediaUri, 10, undefined);

      if (response.success) {
        Alert.alert(LadCopy.QUICK.SUCCESS, `${mediaType} sent to ${recipientUsername}! 🔥`, [
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

  const sendGroupMessage = async (mediaUri: string, mediaType: 'photo' | 'video') => {
    if (!groupId || !groupName) {
      Alert.alert(LadCopy.QUICK.ERROR, 'Invalid group information');
      return;
    }

    try {
      const response = await apiClient.sendGroupMediaMessage(groupId, mediaUri, 10, undefined);

      if (response.success) {
        Alert.alert(LadCopy.QUICK.SUCCESS, `${mediaType} sent to ${groupName}! 🚀`, [
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

  const handleSendToRecipients = async (selectedFriendIds: number[], selectedGroupIds: number[]) => {
    if (!capturedMedia) {
      Alert.alert(LadCopy.QUICK.ERROR, 'No media to send');
      return;
    }

    try {
      const response = await apiClient.sendSnap(selectedFriendIds, selectedGroupIds, capturedMedia.uri, 10, undefined);

      if (response.success) {
        const totalRecipients = selectedFriendIds.length + selectedGroupIds.length;
        Alert.alert(LadCopy.QUICK.SUCCESS, `Snap sent to ${totalRecipients} lad${totalRecipients !== 1 ? 's' : ''}! 🔥`);
        setCapturedMedia(null);
      } else {
        Alert.alert(LadCopy.QUICK.ERROR, response.error || 'Failed to send snap');
      }
    } catch (error) {
      Alert.alert(LadCopy.QUICK.ERROR, 'Failed to send snap');
    }
  };

  const closeFriendSelector = () => {
    setFriendSelectorVisible(false);
    setCapturedMedia(null);
  };

  const handleQuickSendToFriend = (friendId: number, friendUsername: string) => {
    if (!capturedMedia) {
      Alert.alert(LadCopy.QUICK.ERROR, 'No media to send');
      return;
    }

    handleSendToRecipients([friendId], []);
    setShowQuickSend(false);
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        
        handleCapturedMedia(photo.uri, 'photo');
        
        // Show quick send overlay for snap mode
        if (cameraMode === 'snap') {
          setShowQuickSend(true);
        }
      } catch (error) {
        Alert.alert(LadCopy.QUICK.ERROR, 'Failed to take photo');
      }
    }
  };

  const startRecording = async () => {
    if (cameraRef.current && !isRecording && !isRecordingInProgress) {
      try {
        console.log('🎥 === VIDEO RECORDING DEBUG START ===');
        console.log('🎥 Camera permissions:', cameraPermission);
        console.log('🎥 Microphone permissions:', microphonePermission);
        console.log('🎥 Camera facing:', facing);
        console.log('🎥 Camera ready state:', isCameraReady);
        
        setIsRecording(true);
        setIsRecordingInProgress(true);
        setRecordingDuration(0);
        
        console.log('🎥 State updated - isRecording: true, isRecordingInProgress: true');
        
        // Animate record button
        Animated.timing(recordButtonScale, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true,
        }).start();
        
        // Start recording timer
        console.log('🎥 Starting recording timer...');
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration(prev => {
            const newDuration = prev + 1;
            console.log(`🎥 Recording duration: ${newDuration}s`);
            if (newDuration >= 20) {
              console.log('🎥 Recording reached 20 second limit, will auto-stop...');
              return 20;
            }
            return newDuration;
          });
        }, 1000);

        // Check camera ref before recording
        console.log('🎥 Camera ref exists:', !!cameraRef.current);
        console.log('🎥 About to call recordAsync...');
        
        // Start recording with minimal options
        const recordingOptions = {
          maxDuration: 20000, // 20 seconds max
        };
        console.log('🎥 Recording options:', recordingOptions);
        
        const videoPromise = cameraRef.current.recordAsync(recordingOptions);
        console.log('🎥 RecordAsync called, promise created');
        
        // Add timeout to catch hanging promises
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Recording timeout after 25 seconds')), 25000);
        });
        
        console.log('🎥 Waiting for recording completion...');
        const video = await Promise.race([videoPromise, timeoutPromise]) as any;
        
        console.log('🎥 Recording completed successfully!');
        console.log('🎥 Video result:', video);
        console.log('🎥 Video URI:', video?.uri);
        console.log('🎥 Video type:', typeof video);
        
        // Clean up recording state
        setIsRecordingInProgress(false);
        
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
          console.log('🎥 Recording timer cleared');
        }
        
        setIsRecording(false);
        setRecordingDuration(0);
        
        // Reset record button animation
        Animated.timing(recordButtonScale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
        
        // Validate video result
        if (video && video.uri) {
          console.log('🎥 Video validation passed - proceeding with captured media');
          handleCapturedMedia(video.uri, 'video');
          
          // Show quick send overlay for snap mode
          if (cameraMode === 'snap') {
            setShowQuickSend(true);
          }
        } else {
          console.error('🎥 Video validation failed:');
          console.error('🎥 video object:', video);
          console.error('🎥 video.uri:', video?.uri);
          Alert.alert(
            LadCopy.QUICK.ERROR, 
            'Video recording failed - no video was captured. Please try again.'
          );
        }
        
        console.log('🎥 === VIDEO RECORDING DEBUG END ===');
        
      } catch (error) {
        console.error('🎥 === VIDEO RECORDING ERROR ===');
        console.error('🎥 Error type:', typeof error);
        console.error('🎥 Error object:', error);
        console.error('🎥 Error message:', error instanceof Error ? error.message : 'Unknown error');
        console.error('🎥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        
        // Clean up on error
        setIsRecordingInProgress(false);
        
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        
        setIsRecording(false);
        setRecordingDuration(0);
        
        // Reset record button animation
        Animated.timing(recordButtonScale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
        
        // Enhanced error message
        let errorMessage = 'Failed to record video. ';
        if (error instanceof Error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('permission')) {
            errorMessage += 'Permission issue detected. Please check camera and microphone permissions in device settings.';
          } else if (msg.includes('storage') || msg.includes('space')) {
            errorMessage += 'Not enough storage space available.';
          } else if (msg.includes('stopped before any data')) {
            errorMessage += 'Recording was interrupted immediately. This may be a device or lighting issue.';
          } else if (msg.includes('timeout')) {
            errorMessage += 'Recording timed out. Please try again with better lighting.';
          } else if (msg.includes('not available') || msg.includes('unsupported')) {
            errorMessage += 'Video recording may not be supported on this device/browser.';
          } else {
            errorMessage += `Technical error: ${error.message}`;
          }
        } else {
          errorMessage += 'Please try again in a well-lit area.';
        }
        
        Alert.alert(LadCopy.QUICK.ERROR, errorMessage);
        console.error('🎥 === VIDEO RECORDING ERROR END ===');
      }
    } else {
      console.log('🎥 Recording not started - conditions not met:');
      console.log('🎥 Camera ref exists:', !!cameraRef.current);
      console.log('🎥 isRecording:', isRecording);
      console.log('🎥 isRecordingInProgress:', isRecordingInProgress);
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && isRecording && recordingDuration >= 2) {
      try {
        console.log('🎥 User manually stopping video recording...');
        cameraRef.current.stopRecording();
      } catch (error) {
        console.error('🎥 Error stopping recording:', error);
      }
    } else if (isRecording && recordingDuration < 2) {
      console.log('🎥 Recording too short, ignoring stop request');
    }
  };

  const formatRecordingTime = (seconds: number): string => {
    return `${seconds}s / 20s`;
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

            {/* Camera Mode Switcher */}
          <View style={styles.topControls}>
              <Animated.View style={[styles.modeContainer, { opacity: modeIndicatorOpacity }]}>
                <TouchableOpacity 
                  style={[styles.modeButton, cameraMode === 'story' && styles.modeButtonActive]}
                  onPress={() => switchCameraMode('story')}
                >
                  <ThemedText style={[styles.modeText, cameraMode === 'story' && styles.modeTextActive]}>
                    Story
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modeButton, cameraMode === 'snap' && styles.modeButtonActive]}
                  onPress={() => switchCameraMode('snap')}
                >
                  <ThemedText style={[styles.modeText, cameraMode === 'snap' && styles.modeTextActive]}>
                    Snap
                  </ThemedText>
                </TouchableOpacity>
              </Animated.View>

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

            {/* Mode Hint */}
            {modeHintVisible && (
              <Animated.View style={[styles.modeHint, { opacity: hintOpacity }]}>
                <View style={styles.modeHintBubble}>
                  <ThemedText style={styles.modeHintText}>
                    {cameraMode === 'story' ? 
                      LadCopy.CAMERA.STORY_MODE() : 
                      LadCopy.CAMERA.SNAP_MODE()
                    }
                  </ThemedText>
                </View>
              </Animated.View>
            )}

          {/* Bottom Controls */}
          <View style={styles.bottomControls}>
              {/* Capture Button */}
              <Animated.View style={{ transform: [{ scale: recordButtonScale }] }}>
            <TouchableOpacity 
                  style={[
                    styles.captureButton,
                    isRecording && styles.captureButtonRecording
                  ]}
                  onPress={!isRecording ? takePhoto : undefined} // Only allow photo when not recording
                  onLongPress={!isRecording ? startRecording : undefined} // Only start recording when not already recording
                  onPressOut={() => {
                    // Only attempt to stop if recording has been going for sufficient time
                    if (isRecording && recordingDuration >= 3) {
                      console.log('🎥 User released button, attempting to stop recording...');
                      stopRecording();
                    } else if (isRecording) {
                      console.log(`🎥 Recording only ${recordingDuration}s, continuing...`);
                    }
                  }}
                  delayLongPress={300} // 300ms to start video recording
                  disabled={isRecordingInProgress && !isRecording} // Prevent multiple recordings
            >
              <View style={[
                styles.captureButtonInner,
                    isRecording && styles.captureButtonInnerRecording,
                    { backgroundColor: isRecording ? LadColors.camera.recordButtonActive : LadColors.camera.photoButton }
              ]} />
                  
                  {/* Recording indicator on button */}
                  {isRecording && (
                    <View style={styles.recordingButtonDot} />
                  )}
            </TouchableOpacity>
              </Animated.View>
              
              {/* Instructions */}
              {!isRecording && (
                <ThemedText style={styles.instructionText}>
                  Tap for photo • Hold for video
                </ThemedText>
              )}
          </View>

          {/* Recording Indicator */}
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <ThemedText style={styles.recordingText}>
                  {formatRecordingTime(recordingDuration)}
              </ThemedText>
            </View>
          )}

          {/* Recording Progress Bar */}
          {isRecording && (
            <View style={styles.recordingProgressContainer}>
              <View style={styles.recordingProgressBar}>
                <View 
                  style={[
                    styles.recordingProgress,
                    { width: `${(recordingDuration / 20) * 100}%` }
                  ]}
                />
              </View>
            </View>
          )}

            {/* Quick Send Overlay */}
            <QuickSendOverlay
              visible={showQuickSend && capturedMedia !== null}
              friends={mockFriends}
              onSendToFriend={handleQuickSendToFriend}
              onAddFriends={() => router.push('/(tabs)/friends')}
              mediaType={capturedMedia?.type || null}
            />
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

      {/* Friend Selector Modal */}
      <FriendSelector
        visible={friendSelectorVisible}
        onClose={closeFriendSelector}
        onSelectRecipients={handleSendToRecipients}
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
  modeContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 4,
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  modeButtonActive: {
    backgroundColor: LadColors.primary,
  },
  modeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  modeTextActive: {
    color: 'white',
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Mode Hint
  modeHint: {
    position: 'absolute',
    top: 140,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  modeHintBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: LadColors.primary,
  },
  modeHintText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
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
  captureButtonRecording: {
    borderColor: LadColors.camera.recordButtonActive,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  captureButtonInnerRecording: {
    borderRadius: 8,
    width: 40,
    height: 40,
  },
  
  // Recording UI
  recordingIndicator: {
    position: 'absolute',
    top: 200,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LadColors.camera.recordButtonActive,
    marginRight: 8,
  },
  recordingText: {
    color: LadColors.camera.timerText,
    fontSize: 16,
    fontWeight: '600',
  },
  recordingProgressContainer: {
    position: 'absolute',
    top: 240,
    left: 20,
    right: 20,
  },
  recordingProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  recordingProgress: {
    height: '100%',
    backgroundColor: LadColors.camera.recordButtonActive,
  },
  recordingButtonDot: {
    position: 'absolute',
    top: 40,
    right: 40,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LadColors.camera.recordButtonActive,
  },
  instructionText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
  },
});