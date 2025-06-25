import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Text,
  StatusBar,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import { Story } from '@/services/api';
import { apiClient } from '@/services/api';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface StoryViewerProps {
  visible: boolean;
  stories: Story[];
  initialIndex: number;
  onClose: () => void;
  onStoryChange?: (index: number) => void;
}

export default function StoryViewer({
  visible,
  stories,
  initialIndex,
  onClose,
  onStoryChange,
}: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const progressRef = useRef<any>(null);
  const videoRef = useRef<any>(null);

  const currentStory = stories[currentIndex];
  const STORY_DURATION = 5000; // 5 seconds for photos

  useEffect(() => {
    if (visible && currentStory) {
      markStoryAsViewed(currentStory.id);
      setProgress(0);
      startProgress();
    }
  }, [visible, currentIndex]);

  useEffect(() => {
    onStoryChange?.(currentIndex);
  }, [currentIndex, onStoryChange]);

  useEffect(() => {
    // Hide controls after 3 seconds
    if (showControls) {
      const timer = setTimeout(() => {
        setShowControls(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showControls]);

  const markStoryAsViewed = async (storyId: number) => {
    try {
      await apiClient.viewStory(storyId);
    } catch (error) {
      console.error('Error marking story as viewed:', error);
    }
  };

  const startProgress = () => {
    if (progressRef.current) {
      clearInterval(progressRef.current);
    }

    const duration = currentStory?.media_type === 'video' ? 10000 : STORY_DURATION;
    const increment = 100 / (duration / 100);

    progressRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          goToNextStory();
          return 0;
        }
        return prev + increment;
      });
    }, 100);
  };

  const pauseProgress = () => {
    if (progressRef.current) {
      clearInterval(progressRef.current);
    }
    setIsPlaying(false);
  };

  const resumeProgress = () => {
    if (isPlaying) {
      startProgress();
    }
    setIsPlaying(true);
  };

  const goToNextStory = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  };

  const goToPreviousStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      onClose();
    }
  };

  const handleScreenTap = (event: any) => {
    const { locationX } = event.nativeEvent;
    setShowControls(true);

    if (locationX < screenWidth / 3) {
      // Left third - previous story
      goToPreviousStory();
    } else if (locationX > (screenWidth * 2) / 3) {
      // Right third - next story
      goToNextStory();
    } else {
      // Middle third - pause/play
      if (isPlaying) {
        pauseProgress();
      } else {
        resumeProgress();
      }
    }
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return '24h';
  };

  useEffect(() => {
    return () => {
      if (progressRef.current) {
        clearInterval(progressRef.current);
      }
    };
  }, []);

  if (!visible || !currentStory) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar hidden />
        <SafeAreaView style={styles.safeArea}>
          {/* Progress bars */}
          <View style={styles.progressContainer}>
            {stories.map((_, index) => (
              <View key={index} style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      backgroundColor:
                        index < currentIndex
                          ? 'white'
                          : index === currentIndex
                          ? 'rgba(255,255,255,0.5)'
                          : 'rgba(255,255,255,0.3)',
                    },
                  ]}
                >
                  {index === currentIndex && (
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${progress}%` },
                      ]}
                    />
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Story header */}
          {showControls && (
            <View style={styles.header}>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                  <IconSymbol name="person.crop.circle" size={32} color="white" />
                </View>
                <View style={styles.userDetails}>
                  <ThemedText style={styles.username}>
                    {currentStory.user.username}
                  </ThemedText>
                  <ThemedText style={styles.timestamp}>
                    {formatTime(currentStory.created_at)}
                  </ThemedText>
                </View>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <IconSymbol name="xmark" size={24} color="white" />
              </TouchableOpacity>
            </View>
          )}

          {/* Story content */}
          <TouchableOpacity
            style={styles.contentContainer}
            activeOpacity={1}
            onPress={handleScreenTap}
          >
            {currentStory.media_type === 'photo' ? (
              <Image
                source={{ uri: currentStory.media_url }}
                style={styles.storyImage}
                resizeMode="contain"
              />
            ) : (
              <Video
                ref={videoRef}
                source={{ uri: currentStory.media_url }}
                style={styles.storyVideo}
                shouldPlay={isPlaying}
                isLooping={false}
                resizeMode={ResizeMode.CONTAIN}
                onPlaybackStatusUpdate={(status) => {
                  if (status.isLoaded && status.didJustFinish) {
                    goToNextStory();
                  }
                }}
              />
            )}
          </TouchableOpacity>

          {/* Story caption */}
          {currentStory.caption && (
            <View style={styles.captionContainer}>
              <ThemedText style={styles.caption}>
                {currentStory.caption}
              </ThemedText>
            </View>
          )}

          {/* Controls indicator */}
          {showControls && (
            <View style={styles.controlsIndicator}>
              <View style={styles.tapZone}>
                <IconSymbol name="chevron.left" size={20} color="white" />
                <ThemedText style={styles.tapText}>Previous</ThemedText>
              </View>
              <View style={styles.tapZone}>
                <IconSymbol 
                  name={isPlaying ? "pause.fill" : "play.fill"} 
                  size={20} 
                  color="white" 
                />
                <ThemedText style={styles.tapText}>
                  {isPlaying ? 'Pause' : 'Play'}
                </ThemedText>
              </View>
              <View style={styles.tapZone}>
                <IconSymbol name="chevron.right" size={20} color="white" />
                <ThemedText style={styles.tapText}>Next</ThemedText>
              </View>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  safeArea: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
  },
  progressBarContainer: {
    flex: 1,
    height: 2,
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  closeButton: {
    padding: 8,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyImage: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
  storyVideo: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
  captionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 12,
    borderRadius: 8,
  },
  caption: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  controlsIndicator: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  tapZone: {
    alignItems: 'center',
    opacity: 0.8,
  },
  tapText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
  },
}); 