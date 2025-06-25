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
  RefreshControl 
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
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadMessages();
  }, [userId]);

  const loadMessages = async () => {
    try {
      const response = await apiClient.getConversationMessages(userId);
      if (response.success && response.data) {
        setMessages(response.data.reverse()); // Reverse to show newest at bottom
        markMessagesAsRead(response.data);
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

  const markMessagesAsRead = async (messagesToMark: DirectMessage[]) => {
    const unreadMessages = messagesToMark.filter(
      m => !m.is_read && m.recipient_id === user?.id
    );
    
    if (unreadMessages.length > 0) {
      const messageIds = unreadMessages.map(m => m.id);
      await apiClient.markMessagesAsRead(messageIds);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  };

  const sendMessage = async () => {
    if (!messageText.trim() || isSending) return;

    const tempMessage = messageText.trim();
    setMessageText('');
    setIsSending(true);

    try {
      const response = await apiClient.sendMessage(userId, tempMessage);
      if (response.success && response.data) {
        setMessages(prev => [...prev, response.data]);
        scrollToBottom();
      } else {
        Alert.alert('Error', response.error || 'Failed to send message');
        setMessageText(tempMessage); // Restore message text on error
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

  const openMediaViewer = (message: DirectMessage) => {
    if (message.message_type === 'media' && message.media_url) {
      router.push({
        pathname: '/messages/media-viewer',
        params: {
          mediaUrl: message.media_url,
          mediaType: message.media_type,
          messageId: message.id,
          viewDuration: message.view_duration || 10,
        },
      });
    }
  };

  const openCamera = () => {
    router.push({
      pathname: '/camera/message',
      params: {
        recipientId: userId,
        recipientUsername: username,
      },
    });
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
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={openCamera} style={styles.headerButton}>
            <IconSymbol name="camera" size={20} color={Colors[colorScheme ?? 'light'].text} />
          </TouchableOpacity>
        </View>
      </ThemedView>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
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
                <TouchableOpacity
                  style={[
                    styles.messageBubble,
                    isMyMessage(message) ? styles.myMessageBubble : styles.theirMessageBubble,
                  ]}
                  onPress={() => message.message_type === 'media' && openMediaViewer(message)}
                  disabled={message.message_type !== 'media'}
                >
                  {message.message_type === 'text' ? (
                    <ThemedText style={[
                      styles.messageText,
                      isMyMessage(message) ? styles.myMessageText : styles.theirMessageText,
                    ]}>
                      {message.content}
                    </ThemedText>
                  ) : (
                    <View style={styles.mediaMessage}>
                      <IconSymbol 
                        name={message.media_type === 'photo' ? 'photo' : 'video'}
                        size={24}
                        color="white"
                      />
                      <ThemedText style={styles.mediaText}>
                        {message.media_type === 'photo' ? 'Photo' : 'Video'}
                      </ThemedText>
                      {message.view_duration && (
                        <ThemedText style={styles.mediaDuration}>
                          {message.view_duration}s
                        </ThemedText>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
                
                <ThemedText style={[
                  styles.messageTime,
                  isMyMessage(message) ? styles.myMessageTime : styles.theirMessageTime,
                ]}>
                  {formatMessageTime(message.created_at)}
                  {isMyMessage(message) && (
                    <IconSymbol 
                      name={message.is_read ? "checkmark.circle.fill" : "checkmark.circle"}
                      size={12}
                      color={message.is_read ? Colors[colorScheme ?? 'light'].tint : 'gray'}
                    />
                  )}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <ThemedView style={styles.inputContainer}>
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
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
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
  mediaMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  mediaDuration: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  messageTime: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
}); 