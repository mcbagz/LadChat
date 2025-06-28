import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Dimensions,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

const { width: screenWidth } = Dimensions.get('window');

interface ProfilePictureSelectorProps {
  visible: boolean;
  onClose: () => void;
  onImageSelected: (imageUri: string) => void;
  currentImageUri?: string | null;
}

export default function ProfilePictureSelector({
  visible,
  onClose,
  onImageSelected,
  currentImageUri,
}: ProfilePictureSelectorProps) {
  const colorScheme = useColorScheme();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'We need camera and photo library permissions to set your profile picture.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const processImage = async (imageUri: string): Promise<string> => {
    try {
      setIsProcessing(true);
      
      // Crop to square and resize for profile picture
      const manipResult = await manipulateAsync(
        imageUri,
        [
          { resize: { width: 400, height: 400 } }, // Resize to 400x400
        ],
        {
          compress: 0.8,
          format: SaveFormat.JPEG,
        }
      );
      
      return manipResult.uri;
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error('Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCamera = async () => {
    try {
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) return;

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const processedUri = await processImage(result.assets[0].uri);
        setSelectedImage(processedUri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleGallery = async () => {
    try {
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const processedUri = await processImage(result.assets[0].uri);
        setSelectedImage(processedUri);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  };

  const handleSave = () => {
    if (selectedImage) {
      onImageSelected(selectedImage);
      handleClose();
    }
  };

  const handleRemove = () => {
    Alert.alert(
      'Remove Profile Picture',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            onImageSelected('');
            handleClose();
          },
        },
      ]
    );
  };

  const handleClose = () => {
    setSelectedImage(null);
    onClose();
  };

  const displayImage = selectedImage || currentImageUri;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
            <IconSymbol name="xmark" size={20} color={Colors[colorScheme ?? 'light'].text} />
          </TouchableOpacity>
          
          <ThemedText style={styles.title}>Profile Picture</ThemedText>
          
          {selectedImage && (
            <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
              <ThemedText style={styles.saveButtonText}>Save</ThemedText>
            </TouchableOpacity>
          )}
          
          {!selectedImage && (
            <View style={styles.headerButton} />
          )}
        </View>

        {/* Preview */}
        <View style={styles.previewContainer}>
          <View style={styles.preview}>
            {displayImage ? (
              <Image source={{ uri: displayImage }} style={styles.previewImage} />
            ) : (
              <View style={styles.previewPlaceholder}>
                <IconSymbol
                  name="person.crop.circle.fill"
                  size={100}
                  color={Colors[colorScheme ?? 'light'].icon}
                />
                <ThemedText style={styles.placeholderText}>No profile picture</ThemedText>
              </View>
            )}
          </View>
          
          {selectedImage && (
            <ThemedText style={styles.previewLabel}>New Profile Picture</ThemedText>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cameraButton]}
            onPress={handleCamera}
            disabled={isProcessing}
          >
            <IconSymbol name="camera.fill" size={24} color="white" />
            <ThemedText style={styles.actionButtonText}>Take Photo</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.galleryButton]}
            onPress={handleGallery}
            disabled={isProcessing}
          >
            <IconSymbol name="photo.fill" size={24} color="white" />
            <ThemedText style={styles.actionButtonText}>Choose Photo</ThemedText>
          </TouchableOpacity>

          {currentImageUri && (
            <TouchableOpacity
              style={[styles.actionButton, styles.removeButton]}
              onPress={handleRemove}
              disabled={isProcessing}
            >
              <IconSymbol name="trash.fill" size={24} color="white" />
              <ThemedText style={styles.actionButtonText}>Remove</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Processing Indicator */}
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <View style={styles.processingIndicator}>
              <ThemedText style={styles.processingText}>Processing image...</ThemedText>
            </View>
          </View>
        )}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  preview: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.6,
  },
  previewLabel: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.8,
  },
  actions: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
  },
  cameraButton: {
    backgroundColor: '#007AFF',
  },
  galleryButton: {
    backgroundColor: '#34C759',
  },
  removeButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingIndicator: {
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '500',
  },
}); 