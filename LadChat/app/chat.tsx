import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  ScrollView, 
  View, 
  TouchableOpacity, 
  Alert, 
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, DirectMessage } from '@/services/api';

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const userId = parseInt(params.userId as string);
  const username = params.username as string;
  
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<DirectMessage | null>(null);
  const [viewedMessages, setViewedMessages] = useState<Set<number>>(new Set());
  
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadMessages();
  }, [userId]);

  const loadMessages = async () => {
    try {
      const response = await apiClient.getConversationMessages(userId);
      if (response.success && response.data) {
        setMessages(response.data.reverse());
      } else {
        Alert.alert('Error', response.error || 'Failed to load messages');
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || isSending) return;

    const tempMessage = messageText.trim();
    setMessageText('');
    setIsSending(true);

    try {
      const response = await apiClient.sendMessage(userId, tempMessage);
      if (response.success && response.data) {
        setMessages(prev => [...prev, response.data!]);
        scrollToBottom();
      } else {
        Alert.alert('Error', response.error || 'Failed to send message');
        setMessageText(tempMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      setMessageText(tempMessage);
    } finally {
      setIsSending(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatMessageTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isMyMessage = (message: DirectMessage): boolean => {
    return message.sender_id === user?.id;
  };

  const openCamera = () => {
    router.push({
      pathname: '/',
      params: {
        directMessage: 'true',
        recipientId: userId.toString(),
        recipientUsername: username,
      },
    });
  };

  const viewMediaMessage = async (message: DirectMessage) => {
    if (viewedMessages.has(message.id)) {
      Alert.alert('Media Expired', 'This media has already been viewed and is no longer available.');
      return;
    }

    // Mark as viewed locally
    setViewedMessages(prev => new Set([...prev, message.id]));
    
    // Show the media
    setViewingMedia(message);

    // Mark as viewed on backend if this is a received message
    if (message.recipient_id === user?.id) {
      try {
        await apiClient.markMediaAsViewed(message.id, false);
      } catch (error) {
        console.error('Error marking media as viewed:', error);
      }
    }

    // Auto close after view duration
    setTimeout(() => {
      setViewingMedia(null);
    }, (message.view_duration || 10) * 1000);
  };

  const closeMediaViewer = () => {
    setViewingMedia(null);
  };

  const renderMessageContent = (message: DirectMessage) => {
    if (message.message_type === 'media') {
      // Check if message has been viewed
      const hasBeenViewed = viewedMessages.has(message.id) || 
                           (message.recipient_id === user?.id && message.is_opened);
      
      if (hasBeenViewed) {
        return (
          <View style={styles.expiredMedia}>
            <IconSymbol name="eye.slash" size={16} color={Colors[colorScheme ?? 'light'].text + '60'} />
            <ThemedText style={styles.expiredMediaText}>Media expired</ThemedText>
          </View>
        );
      }

      return (
        <TouchableOpacity onPress={() => viewMediaMessage(message)} style={styles.mediaMessage}>
          <IconSymbol 
            name={message.media_type === 'photo' ? 'photo.fill' : 'video.fill'}
            size={20} 
            color={isMyMessage(message) ? 'white' : Colors[colorScheme ?? 'light'].tint}
          />
          <ThemedText style={[
            styles.mediaText,
            isMyMessage(message) ? styles.myMessageText : styles.theirMessageText,
          ]}>
            {message.media_type === 'photo' ? 'Photo' : 'Video'}
          </ThemedText>
          {message.content && (
            <ThemedText style={[
              styles.mediaCaptionText,
              isMyMessage(message) ? styles.myMessageText : styles.theirMessageText,
            ]}>
              {message.content}
            </ThemedText>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <ThemedText style={[
        styles.messageText,
        isMyMessage(message) ? styles.myMessageText : styles.theirMessageText,
      ]}>
        {message.content}
      </ThemedText>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ThemedView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={Colors[colorScheme ?? 'light'].text} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>{username}</ThemedText>
        <View style={styles.headerRight} />
      </ThemedView>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
      >
        {isLoading ? (
          <ThemedView style={styles.loadingState}>
            <ThemedText>Loading messages...</ThemedText>
          </ThemedView>
        ) : messages.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <IconSymbol 
              name="message.circle" 
              size={48} 
              color={Colors[colorScheme ?? 'light'].icon} 
            />
            <ThemedText style={styles.emptyTitle}>Start a conversation</ThemedText>
            <ThemedText style={styles.emptyText}>
              Send a message to {username}
            </ThemedText>
          </ThemedView>
        ) : (
          <View style={styles.messagesList}>
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageContainer,
                  isMyMessage(message) ? styles.myMessageContainer : styles.theirMessageContainer,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    isMyMessage(message) ? styles.myMessageBubble : styles.theirMessageBubble,
                  ]}
                >
                  {renderMessageContent(message)}
                </View>
                
                <ThemedText style={[
                  styles.messageTime,
                  isMyMessage(message) ? styles.myMessageTime : styles.theirMessageTime,
                ]}>
                  {formatMessageTime(message.created_at)}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <ThemedView style={styles.inputContainer}>
        <TouchableOpacity style={styles.cameraButton} onPress={openCamera}>
          <IconSymbol 
            name="camera.fill"
            size={20}
            color={Colors[colorScheme ?? 'light'].tint}
          />
        </TouchableOpacity>
        
        <TextInput
          style={[
            styles.messageInput,
            { color: Colors[colorScheme ?? 'light'].text }
          ]}
          placeholder="Message..."
          placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={500}
        />
        
        <TouchableOpacity 
          style={[
            styles.sendButton,
            (!messageText.trim() || isSending) && styles.sendButtonDisabled
          ]}
          onPress={sendMessage}
          disabled={!messageText.trim() || isSending}
        >
          <IconSymbol 
            name="arrow.up"
            size={20}
            color="white"
          />
        </TouchableOpacity>
      </ThemedView>

      {/* Media Viewer Modal */}
      <Modal
        visible={viewingMedia !== null}
        animationType="fade"
        onRequestClose={closeMediaViewer}
        statusBarTranslucent={true}
      >
        {viewingMedia && (
          <View style={styles.mediaViewerContainer}>
            <TouchableOpacity 
              style={styles.mediaViewerCloseButton}
              onPress={closeMediaViewer}
            >
              <IconSymbol name="xmark" size={24} color="white" />
            </TouchableOpacity>
            
            <View style={styles.mediaViewerContent}>
              {viewingMedia.media_type === 'photo' ? (
                <Image 
                  source={{ uri: viewingMedia.media_url }}
                  style={styles.mediaViewerImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.videoPlaceholder}>
                  <IconSymbol name="video.fill" size={64} color="white" />
                  <ThemedText style={styles.videoPlaceholderText}>
                    Video playback coming soon
                  </ThemedText>
                </View>
              )}
              
              {viewingMedia.content && (
                <View style={styles.mediaViewerCaption}>
                  <ThemedText style={styles.mediaCaptionText}>
                    {viewingMedia.content}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        )}
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    lineHeight: 20,
  },
  messagesList: {
    paddingVertical: 20,
  },
  messageContainer: {
    marginBottom: 16,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  theirMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: '80%',
  },
  myMessageBubble: {
    backgroundColor: '#007AFF',
  },
  theirMessageBubble: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: 'white',
  },
  theirMessageText: {
    color: Colors.light.text,
  },
  messageTime: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  myMessageTime: {
    textAlign: 'right',
  },
  theirMessageTime: {
    textAlign: 'left',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  cameraButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  mediaMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaText: {
    fontSize: 16,
    fontWeight: '500',
  },
  mediaCaptionText: {
    fontSize: 14,
    marginTop: 4,
    fontStyle: 'italic',
  },
  expiredMedia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.6,
  },
  expiredMediaText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  mediaViewerContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaViewerCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaViewerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  mediaViewerImage: {
    width: '100%',
    height: '70%',
  },
  mediaViewerCaption: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 16,
    borderRadius: 8,
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  videoPlaceholderText: {
    color: 'white',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
}); 