import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  SafeAreaView,
  Alert,
  TextInput,
  PanResponder,
  Animated,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { manipulateAsync, SaveFormat, FlipType } from 'expo-image-manipulator';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export interface CaptionData {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  hasBackground: boolean;
  animatedPosition?: Animated.ValueXY;
}

export interface DrawingPath {
  id: string;
  path: string;
  color: string;
  strokeWidth: number;
}

interface CameraPreviewProps {
  visible: boolean;
  mediaUri: string;
  mediaType: 'photo' | 'video';
  onClose: () => void;
  onSave: (editedMediaUri: string, captions: CaptionData[], drawings: DrawingPath[]) => void;
  onRetake: () => void;
}

const COLORS = ['#000000', '#FFFFFF', '#FF3B30', '#FF9500', '#FFCC02', '#34C759', '#007AFF', '#5856D6', '#FF2D92'];

export default function CameraPreview({
  visible,
  mediaUri,
  mediaType,
  onClose,
  onSave,
  onRetake,
}: CameraPreviewProps) {
  const colorScheme = useColorScheme();
  const [editMode, setEditMode] = useState<'none' | 'caption' | 'draw' | 'filter'>('none');
  const [captions, setCaptions] = useState<CaptionData[]>([]);
  const [drawings, setDrawings] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [captionColor, setCaptionColor] = useState('#FFFFFF'); // White default for better visibility
  const [captionHasBackground, setCaptionHasBackground] = useState(true);
  const [drawingColor, setDrawingColor] = useState('#FFFFFF'); // White default
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Refs for view capture and pan handling
  const previewRef = useRef<View>(null);
  const videoRef = useRef<any>(null);
  const panStartPosition = useRef({ x: 0, y: 0 });

  const addCaption = () => {
    if (!captionText.trim()) return;
    
    const initialX = screenWidth / 2;
    const initialY = screenHeight * 0.4;
    
    const newCaption: CaptionData = {
      id: Date.now().toString(),
      text: captionText,
      x: initialX,
      y: initialY,
      fontSize: 24,
      color: captionColor,
      fontFamily: 'System',
      hasBackground: captionHasBackground,
      animatedPosition: new Animated.ValueXY({ x: initialX, y: initialY }),
    };
    
    setCaptions(prev => [...prev, newCaption]);
    setCaptionText('');
    setEditMode('none');
  };

  const createCaptionPanResponder = (caption: CaptionData) => {
    if (!caption.animatedPosition) return null;
    
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only start moving if the gesture is significant enough
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: (evt, gestureState) => {
        console.log(`🎯 Starting smooth drag for caption ${caption.id}`);
        // Store current position for smooth tracking
        panStartPosition.current = { x: caption.x, y: caption.y };
        caption.animatedPosition!.setOffset({
          x: caption.x,
          y: caption.y,
        });
        caption.animatedPosition!.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gestureState) => {
        // Update animated value directly - no React state updates!
        caption.animatedPosition!.setValue({
          x: gestureState.dx,
          y: gestureState.dy,
        });
      },
      onPanResponderRelease: (evt, gestureState) => {
        console.log(`🎯 Finished smooth drag for caption ${caption.id}`);
        
        // Calculate final position
        const finalX = panStartPosition.current.x + gestureState.dx;
        const finalY = panStartPosition.current.y + gestureState.dy;
        
        // Apply boundaries
        const boundedX = Math.max(60, Math.min(screenWidth - 60, finalX));
        const boundedY = Math.max(60, Math.min(screenHeight * 0.7 - 60, finalY));
        
        // Update animated value to final bounded position
        caption.animatedPosition!.setValue({ x: boundedX, y: boundedY });
        caption.animatedPosition!.setOffset({ x: 0, y: 0 });
        
        // Update the state value for view capture
        setCaptions(prev => prev.map(c => 
          c.id === caption.id 
            ? { ...c, x: boundedX, y: boundedY }
            : c
        ));
      },
      onPanResponderTerminate: () => {
        // Clean up on termination
        caption.animatedPosition!.flattenOffset();
      },
    });
  };

  const handleDrawStart = (event: any) => {
    if (editMode !== 'draw') return;
    
    const { locationX = 0, locationY = 0 } = event.nativeEvent || {};
    setCurrentPath(`M${locationX},${locationY}`);
    setIsDrawing(true);
  };

  const handleDrawMove = (event: any) => {
    if (editMode !== 'draw' || !isDrawing) return;
    
    const { locationX = 0, locationY = 0 } = event.nativeEvent || {};
    setCurrentPath(prev => `${prev} L${locationX},${locationY}`);
  };

  const handleDrawEnd = () => {
    if (editMode !== 'draw' || !isDrawing || !currentPath) return;
    
    const newDrawing: DrawingPath = {
      id: Date.now().toString(),
      path: currentPath,
      color: drawingColor,
      strokeWidth: 5,
    };
    
    setDrawings(prev => [...prev, newDrawing]);
    setCurrentPath('');
    setIsDrawing(false);
  };

  const undoLastDrawing = () => {
    setDrawings(prev => prev.slice(0, -1));
  };

  const clearAllDrawings = () => {
    setDrawings([]);
  };

  const applyFilter = async (filterType: string) => {
    try {
      if (mediaType !== 'photo') {
        Alert.alert('Filters', 'Filters are only available for photos');
        return;
      }
      
      if (filterType === 'none') {
        setSelectedFilter(null);
        return;
      }
      
      // Set the filter - we'll apply it via SVG overlay
      setSelectedFilter(filterType);
      
    } catch (error) {
      console.error('Filter application failed:', error);
      Alert.alert('Error', 'Failed to apply filter');
      setSelectedFilter(null);
    }
  };

  const compositeImageWithEdits = async (): Promise<string> => {
    try {
      setIsSaving(true);
      
      // If no edits were made, return the base image
      if (captions.length === 0 && drawings.length === 0 && !selectedFilter) {
        return mediaUri;
      }
      
      // For videos, we can't composite, so return original
      if (mediaType === 'video') {
        console.log('Video compositing not supported, returning original');
        return mediaUri;
      }
      
      // Capture the entire preview view with all overlays
      if (previewRef.current) {
        console.log('Capturing preview with overlays...');
        
        const captureUri = await captureRef(previewRef.current, {
          format: 'jpg',
          quality: 0.9,
          result: 'tmpfile',
        });
        
        console.log('Successfully captured composited image:', captureUri);
        return captureUri;
      }
      
      // Fallback to original
      return mediaUri;
      
    } catch (error) {
      console.error('Image compositing failed:', error);
      Alert.alert('Warning', 'Some edits may not be saved. Continuing with original image.');
      return mediaUri;
    } finally {
      setIsSaving(false);
    }
  };

  const getFilterStyle = (filterType: string) => {
    switch (filterType) {
      case 'bw':
        return {
          backgroundColor: 'rgba(128, 128, 128, 0.3)',
          mixBlendMode: 'color' as const,
        };
      case 'sepia':
        return {
          backgroundColor: 'rgba(218, 165, 32, 0.25)',
          mixBlendMode: 'multiply' as const,
        };
      case 'bright':
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          mixBlendMode: 'screen' as const,
        };
      case 'vintage':
        return {
          backgroundColor: 'rgba(139, 69, 19, 0.2)',
          mixBlendMode: 'overlay' as const,
        };
      case 'negative':
        return {
          backgroundColor: 'rgba(255, 255, 255, 1)',
          mixBlendMode: 'difference' as const,
        };
      case 'saturated':
        return {
          backgroundColor: 'rgba(255, 100, 150, 0.3)',
          mixBlendMode: 'color' as const,
        };
      case 'cool':
        return {
          backgroundColor: 'rgba(100, 150, 255, 0.2)',
          mixBlendMode: 'overlay' as const,
        };
      case 'warm':
        return {
          backgroundColor: 'rgba(255, 180, 100, 0.25)',
          mixBlendMode: 'multiply' as const,
        };
      default:
        return {};
    }
  };

  const handleSave = async () => {
    try {
      const finalMediaUri = await compositeImageWithEdits();
      onSave(finalMediaUri, captions, drawings);
    } catch (error) {
      console.error('Save failed:', error);
      Alert.alert('Error', 'Failed to save edited media');
    }
  };

  const removeCaption = (id: string) => {
    setCaptions(prev => prev.filter(caption => caption.id !== id));
  };

  const clearAll = () => {
    Alert.alert(
      'Clear All',
      'Remove all captions, drawings, and filters?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => {
            setCaptions([]);
            setDrawings([]);
            setSelectedFilter(null);
          }
        }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <IconSymbol name="xmark" size={20} color="white" />
            </TouchableOpacity>
            
            <View style={styles.headerButtons}>
              <TouchableOpacity style={styles.headerButton} onPress={clearAll}>
                <IconSymbol name="trash" size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton} onPress={onRetake}>
                <IconSymbol name="camera.rotate" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Media Display with Overlays - This is what gets captured */}
          <View style={styles.mediaContainer}>
            <View 
              ref={previewRef}
              style={styles.mediaWrapper}
              onTouchStart={handleDrawStart}
              onTouchMove={handleDrawMove}
              onTouchEnd={handleDrawEnd}
            >
              {mediaType === 'photo' ? (
                <Image
                  source={{ uri: mediaUri }}
                  style={styles.media}
                  resizeMode="contain"
                />
              ) : (
                <Video
                  ref={videoRef}
                  source={{ uri: mediaUri }}
                  style={styles.media}
                  shouldPlay={true}
                  isLooping={true}
                  isMuted={true}
                  resizeMode={ResizeMode.CONTAIN}
                />
              )}

              {/* Filter Overlay */}
              {selectedFilter && mediaType === 'photo' && (
                <View style={[StyleSheet.absoluteFill, getFilterStyle(selectedFilter)]} 
                      pointerEvents="none" />
              )}

              {/* Drawing Layer - Under captions */}
              <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                {drawings.map((drawing) => (
                  <Path
                    key={drawing.id}
                    d={drawing.path}
                    stroke={drawing.color}
                    strokeWidth={drawing.strokeWidth}
                    fill="transparent"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {currentPath && isDrawing && (
                  <Path
                    d={currentPath}
                    stroke={drawingColor}
                    strokeWidth={5}
                    fill="transparent"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </Svg>

              {/* Captions Layer - Above drawings */}
              {captions.map((caption) => {
                const panResponder = createCaptionPanResponder(caption);
                
                // Use Animated.View for smooth movement if animatedPosition exists
                if (caption.animatedPosition) {
                  return (
                    <Animated.View
                      key={caption.id}
                      {...panResponder?.panHandlers}
                      style={[
                        styles.captionOverlay,
                        {
                          backgroundColor: caption.hasBackground 
                            ? 'rgba(0,0,0,0.4)' 
                            : 'transparent',
                          transform: caption.animatedPosition.getTranslateTransform(),
                        }
                      ]}
                    >
                      <TouchableOpacity 
                        onLongPress={() => removeCaption(caption.id)}
                        activeOpacity={0.8}
                      >
                        <ThemedText
                          style={[
                            styles.captionText,
                            {
                              color: caption.color,
                              fontSize: caption.fontSize,
                              fontFamily: caption.fontFamily,
                            }
                          ]}
                        >
                          {caption.text}
                        </ThemedText>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                }
                
                // Fallback to regular View for captions without animatedPosition
                return (
                  <View
                    key={caption.id}
                    {...panResponder?.panHandlers}
                    style={[
                      styles.captionOverlay,
                      { 
                        left: caption.x - 50, 
                        top: caption.y - 20,
                        backgroundColor: caption.hasBackground 
                          ? 'rgba(0,0,0,0.4)' 
                          : 'transparent',
                      }
                    ]}
                  >
                    <TouchableOpacity 
                      onLongPress={() => removeCaption(caption.id)}
                      activeOpacity={0.8}
                    >
                      <ThemedText
                        style={[
                          styles.captionText,
                          {
                            color: caption.color,
                            fontSize: caption.fontSize,
                            fontFamily: caption.fontFamily,
                          }
                        ]}
                      >
                        {caption.text}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Bottom Controls */}
          <View style={styles.bottomControls}>
            {editMode === 'none' && (
              <View style={styles.mainControls}>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => setEditMode('caption')}
                >
                  <IconSymbol name="textformat" size={24} color="white" />
                  <ThemedText style={styles.controlLabel}>Caption</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => setEditMode('draw')}
                >
                  <IconSymbol name="pencil" size={24} color="white" />
                  <ThemedText style={styles.controlLabel}>Draw</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => setEditMode('filter')}
                >
                  <IconSymbol name="camera.filters" size={24} color="white" />
                  <ThemedText style={styles.controlLabel}>Filter</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.controlButton, styles.saveButton]}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  <IconSymbol 
                    name={isSaving ? "clock" : "checkmark"} 
                    size={24} 
                    color="white" 
                  />
                  <ThemedText style={styles.controlLabel}>
                    {isSaving ? 'Saving...' : 'Save'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}

            {/* Caption Controls */}
            {editMode === 'caption' && (
              <View style={styles.editControls}>
                <View style={styles.captionInputContainer}>
                  <TextInput
                    style={styles.captionInput}
                    value={captionText}
                    onChangeText={setCaptionText}
                    placeholder="Add caption..."
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    multiline
                    maxLength={100}
                    autoFocus
                  />
                  <TouchableOpacity 
                    style={[styles.addButton, !captionText.trim() && styles.disabledButton]} 
                    onPress={addCaption}
                    disabled={!captionText.trim()}
                  >
                    <IconSymbol name="plus" size={20} color="white" />
                  </TouchableOpacity>
                </View>

                {/* Background Toggle */}
                <TouchableOpacity 
                  style={styles.backgroundToggle}
                  onPress={() => setCaptionHasBackground(!captionHasBackground)}
                >
                  <IconSymbol 
                    name={captionHasBackground ? "rectangle.fill" : "rectangle"} 
                    size={20} 
                    color="white" 
                  />
                  <ThemedText style={styles.toggleText}>
                    {captionHasBackground ? 'Remove Background' : 'Add Background'}
                  </ThemedText>
                </TouchableOpacity>
                
                <View style={styles.colorPalette}>
                  {COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorButton,
                        { backgroundColor: color },
                        color === '#000000' && { borderColor: 'white', borderWidth: 1 },
                        captionColor === color && styles.selectedColor
                      ]}
                      onPress={() => setCaptionColor(color)}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => setEditMode('none')}
                >
                  <ThemedText style={styles.doneText}>Done</ThemedText>
                </TouchableOpacity>
              </View>
            )}

            {/* Drawing Controls */}
            {editMode === 'draw' && (
              <View style={styles.editControls}>
                <View style={styles.drawingControls}>
                  <View style={styles.colorPalette}>
                    {COLORS.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorButton,
                          { backgroundColor: color },
                          color === '#000000' && { borderColor: 'white', borderWidth: 1 },
                          drawingColor === color && styles.selectedColor
                        ]}
                        onPress={() => setDrawingColor(color)}
                      />
                    ))}
                  </View>

                  <View style={styles.drawingActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, drawings.length === 0 && styles.disabledButton]}
                      onPress={undoLastDrawing}
                      disabled={drawings.length === 0}
                    >
                      <IconSymbol name="arrow.uturn.backward" size={20} color="white" />
                      <ThemedText style={styles.actionText}>Undo</ThemedText>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.actionButton, drawings.length === 0 && styles.disabledButton]}
                      onPress={clearAllDrawings}
                      disabled={drawings.length === 0}
                    >
                      <IconSymbol name="trash" size={20} color="white" />
                      <ThemedText style={styles.actionText}>Clear</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => setEditMode('none')}
                >
                  <ThemedText style={styles.doneText}>Done</ThemedText>
                </TouchableOpacity>
              </View>
            )}

            {/* Filter Controls */}
            {editMode === 'filter' && (
              <View style={styles.editControls}>
                <View style={styles.filterControls}>
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      !selectedFilter && styles.selectedFilter
                    ]}
                    onPress={() => applyFilter('none')}
                  >
                    <ThemedText style={styles.filterText}>Original</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      selectedFilter === 'bw' && styles.selectedFilter
                    ]}
                    onPress={() => applyFilter('bw')}
                  >
                    <ThemedText style={styles.filterText}>B&W</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      selectedFilter === 'sepia' && styles.selectedFilter
                    ]}
                    onPress={() => applyFilter('sepia')}
                  >
                    <ThemedText style={styles.filterText}>Sepia</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      selectedFilter === 'bright' && styles.selectedFilter
                    ]}
                    onPress={() => applyFilter('bright')}
                  >
                    <ThemedText style={styles.filterText}>Bright</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      selectedFilter === 'vintage' && styles.selectedFilter
                    ]}
                    onPress={() => applyFilter('vintage')}
                  >
                    <ThemedText style={styles.filterText}>Vintage</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      selectedFilter === 'negative' && styles.selectedFilter
                    ]}
                    onPress={() => applyFilter('negative')}
                  >
                    <ThemedText style={styles.filterText}>Negative</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      selectedFilter === 'saturated' && styles.selectedFilter
                    ]}
                    onPress={() => applyFilter('saturated')}
                  >
                    <ThemedText style={styles.filterText}>Saturated</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      selectedFilter === 'cool' && styles.selectedFilter
                    ]}
                    onPress={() => applyFilter('cool')}
                  >
                    <ThemedText style={styles.filterText}>Cool</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      selectedFilter === 'warm' && styles.selectedFilter
                    ]}
                    onPress={() => applyFilter('warm')}
                  >
                    <ThemedText style={styles.filterText}>Warm</ThemedText>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => setEditMode('none')}
                >
                  <ThemedText style={styles.doneText}>Done</ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    padding: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaWrapper: {
    width: screenWidth,
    height: screenHeight * 0.7,
    position: 'relative',
    backgroundColor: 'black',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  captionOverlay: {
    position: 'absolute',
    minWidth: 100,
    padding: 8,
    borderRadius: 8,
    zIndex: 1000,
    left: -50,
    top: -20,
  },
  captionText: {
    textAlign: 'center',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  bottomControls: {
    padding: 16,
    paddingBottom: 32,
  },
  mainControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    minWidth: 70,
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  controlLabel: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  editControls: {
    gap: 16,
  },
  captionInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  captionInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    paddingVertical: 12,
    maxHeight: 100,
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  backgroundToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  toggleText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  colorPalette: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
  },
  colorButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: 'white',
    borderWidth: 3,
  },
  drawingControls: {
    gap: 16,
  },
  drawingActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  actionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  filterControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedFilter: {
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0,122,255,0.2)',
  },
  filterText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  doneButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 