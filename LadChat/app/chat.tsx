import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View,
  ScrollView, 
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
  FlatList
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LadColors, Colors, getLadColor } from '@/constants/Colors';
import { LadCopy } from '@/utils/LadCopy';
import { apiClient } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import ProfilePicture from '@/components/ProfilePicture';

interface Message {
  id: number;
  sender_id: number;
  content?: string;
  message_type: 'text' | 'media';
  media_type?: 'photo' | 'video';
  media_url?: string;
  timestamp: string;
  is_deleted: boolean;
  read_by_recipient: boolean;
}

interface ChatUser {
  id: number;
  username: string;
  profile_photo_url?: string;
  is_verified: boolean;
  is_online: boolean;
  last_seen?: string;
}

interface PersonalityInsight {
  trait: string;
  description: string;
  compatibility_score: number;
  conversation_tip: string;
}

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth(); // Get current user
  const params = useLocalSearchParams();
  const { userId, username, groupId, groupName, isGroup } = params;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatUser, setChatUser] = useState<ChatUser | null>(null);
  const [personalityInsights, setPersonalityInsights] = useState<PersonalityInsight[]>([]);
  const [showInsights, setShowInsights] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const typingTimeout = useRef<NodeJS.Timeout>();
  const insightsPulse = useRef(new Animated.Value(1)).current;

  const chatId = isGroup === 'true' ? parseInt(groupId as string) : parseInt(userId as string);
  const chatTitle = isGroup === 'true' ? groupName : username;

  useFocusEffect(
    useCallback(() => {
    loadMessages();
      if (!isGroup) {
        loadChatUser();
        loadPersonalityInsights();
      }
      generateQuickReplies();
      markMessagesAsRead();
      
      // Start insights animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(insightsPulse, {
            toValue: 1.2,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(insightsPulse, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      return () => {
        if (typingTimeout.current) {
          clearTimeout(typingTimeout.current);
        }
      };
    }, [])
  );

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = isGroup === 'true' 
        ? await apiClient.getGroupMessages(chatId, 50, 0)
        : await apiClient.getConversationMessages(chatId, 50, 0);
      
      if (response.success && response.data) {
        const messagesData = response.data.messages || response.data;
        setMessages(Array.isArray(messagesData) ? messagesData.reverse() : []);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const loadChatUser = async () => {
    try {
      const response = await apiClient.getUserProfile(parseInt(userId as string));
      if (response.success && response.data) {
        setChatUser({
          id: response.data.id,
          username: response.data.username,
          profile_photo_url: response.data.profile_photo_url,
          is_verified: response.data.is_verified,
          is_online: response.data.is_online || false,
          last_seen: response.data.last_seen
        });
      }
    } catch (error) {
      console.error('Failed to load chat user:', error);
    }
  };

  const loadPersonalityInsights = async () => {
    try {
      // Mock AI personality insights for now
      const mockInsights: PersonalityInsight[] = [
        {
          trait: "Gaming Enthusiast",
          description: "Loves competitive gaming and esports",
          compatibility_score: 92,
          conversation_tip: "Ask about their favorite games or recent matches"
        },
        {
          trait: "Fitness Focused",
          description: "Regular gym-goer, health conscious",
          compatibility_score: 78,
          conversation_tip: "Share workout tips or fitness goals"
        },
        {
          trait: "Social Organizer",
          description: "Enjoys planning group activities",
          compatibility_score: 85,
          conversation_tip: "Suggest group hangouts or events"
        }
      ];
      setPersonalityInsights(mockInsights);
    } catch (error) {
      console.error('Failed to load personality insights:', error);
    }
  };

  const generateQuickReplies = () => {
    const replies = [
      LadCopy.QUICK.YES,
      LadCopy.QUICK.NO,
      LadCopy.QUICK.MAYBE,
      "That's sick! 🔥",
      "Let's gooo! 🚀",
      "Absolute legend!",
      "I'm down",
      "Count me in",
      "Nah I'm good",
      "Maybe later"
    ];
    setQuickReplies(replies.slice(0, 6));
  };

  const sendMessage = async (messageContent?: string) => {
    const content = messageContent || messageText.trim();
    if (!content) return;

    setSending(true);
    try {
      const response = isGroup === 'true'
        ? await apiClient.sendGroupMessage(chatId, content)
        : await apiClient.sendMessage(chatId, content);
      
      if (response.success) {
        setMessageText('');
        await loadMessages(); // Refresh messages
        scrollToBottom();
        
        // Generate new quick replies based on context
        setTimeout(generateQuickReplies, 1000);
      } else {
        Alert.alert('Error', response.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
      setShowQuickReplies(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      if (!isGroup) {
        await apiClient.markMessagesAsRead(chatId);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleTyping = (text: string) => {
    setMessageText(text);
    setIsTyping(true);
    
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const formatMessageTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return date.toLocaleDateString();
  };

  const getOnlineStatus = () => {
    if (!chatUser || isGroup) return '';
    if (chatUser.is_online) return 'Active now';
    if (chatUser.last_seen) {
      return `Active ${formatMessageTime(chatUser.last_seen)} ago`;
    }
    return '';
  };

  const renderMessage = (message: Message, index: number) => {
    const isFromMe = message.sender_id === user?.id;
    const showTimestamp = index === 0 || 
      (new Date(message.timestamp).getTime() - new Date(messages[index - 1]?.timestamp).getTime()) > 300000; // 5 minutes

        return (
      <View key={message.id} style={styles.messageContainer}>
        {showTimestamp && (
          <View style={styles.timestampContainer}>
            <ThemedText style={styles.timestampText}>
              {formatMessageTime(message.timestamp)}
            </ThemedText>
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isFromMe ? styles.myMessage : styles.theirMessage
          ]}>
          {message.message_type === 'text' ? (
            <ThemedText style={[
              styles.messageText,
              isFromMe ? styles.myMessageText : styles.theirMessageText
            ]}>
              {message.content}
            </ThemedText>
          ) : (
            <View style={styles.mediaMessage}>
              <IconSymbol 
                name={message.media_type === 'photo' ? 'photo' : 'video'} 
                size={24} 
                color={isFromMe ? 'white' : LadColors.primary} 
              />
              <ThemedText style={[
                styles.mediaText,
                isFromMe ? styles.myMessageText : styles.theirMessageText
              ]}>
                {message.media_type === 'photo' ? '📸 Photo' : '🎥 Video'}
              </ThemedText>
            </View>
          )}
          
          {isFromMe && (
            <View style={styles.messageStatus}>
              <IconSymbol 
                name={message.read_by_recipient ? 'checkmark.circle.fill' : 'checkmark.circle'} 
                size={12} 
                color="rgba(255, 255, 255, 0.8)" 
              />
            </View>
          )}
        </View>
      </View>
      );
  };

  const renderPersonalityInsights = () => (
    <Modal
      visible={showInsights}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowInsights(false)}>
            <ThemedText style={styles.modalCancel}>Close</ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.modalTitle}>AI Personality Insights</ThemedText>
          <View style={{ width: 50 }} />
        </View>
        
        <ScrollView style={styles.modalContent}>
          <View style={styles.insightsHeader}>
            <IconSymbol name="brain.head.profile" size={32} color={LadColors.primary} />
            <ThemedText style={styles.insightsTitle}>
              Understanding {username}
            </ThemedText>
            <ThemedText style={styles.insightsSubtitle}>
              AI-powered insights to help you connect better
            </ThemedText>
          </View>
          
          {personalityInsights.map((insight, index) => (
            <View key={index} style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <ThemedText style={styles.insightTrait}>{insight.trait}</ThemedText>
                <View style={styles.compatibilityScore}>
                  <ThemedText style={styles.scoreText}>
                    {insight.compatibility_score}%
                  </ThemedText>
                </View>
              </View>
              
              <ThemedText style={styles.insightDescription}>
                {insight.description}
              </ThemedText>
              
              <View style={styles.conversationTip}>
                <IconSymbol name="lightbulb" size={16} color={LadColors.warning} />
                <ThemedText style={styles.tipText}>
                  {insight.conversation_tip}
                </ThemedText>
              </View>
            </View>
          ))}
          
          <View style={styles.aiDisclaimer}>
            <IconSymbol name="info.circle" size={16} color={getLadColor(colorScheme, 'text', 'secondary')} />
            <ThemedText style={styles.disclaimerText}>
              These insights are AI-generated based on public profile data and mutual interactions. 
              Use them as conversation starters, not absolute truths!
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={20} color={LadColors.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          {!isGroup && chatUser && (
            <ProfilePicture
              uri={chatUser.profile_photo_url}
              size={32}
              showVerified={chatUser.is_verified}
              style={{ marginRight: 8 }}
            />
          )}
          
          <View style={styles.headerText}>
            <ThemedText style={styles.headerTitle}>{chatTitle}</ThemedText>
            {!isGroup && (
              <ThemedText style={styles.headerSubtitle}>
                {getOnlineStatus()}
              </ThemedText>
            )}
          </View>
        </View>
        
        <View style={styles.headerActions}>
          {!isGroup && personalityInsights.length > 0 && (
            <Animated.View style={{ transform: [{ scale: insightsPulse }] }}>
              <TouchableOpacity 
                style={styles.insightsButton}
                onPress={() => setShowInsights(true)}
              >
                <IconSymbol name="brain.head.profile" size={18} color={LadColors.primary} />
              </TouchableOpacity>
            </Animated.View>
          )}
          
          <TouchableOpacity style={styles.menuButton}>
            <IconSymbol name="ellipsis" size={18} color={getLadColor(colorScheme, 'text', 'primary')} />
          </TouchableOpacity>
        </View>
      </ThemedView>

      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        onContentSizeChange={scrollToBottom}
      >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ThemedText style={styles.loadingText}>
                {LadCopy.SYSTEM.LOADING()}
              </ThemedText>
            </View>
        ) : messages.length === 0 ? (
            <View style={styles.emptyContainer}>
            <IconSymbol 
              name="message.circle" 
                size={64} 
                color={getLadColor(colorScheme, 'text', 'tertiary')} 
            />
              <ThemedText style={styles.emptyTitle}>
                Start the conversation!
              </ThemedText>
              <ThemedText style={styles.emptySubtitle}>
                {LadCopy.MESSAGES.MESSAGE_PLACEHOLDER()}
            </ThemedText>
            </View>
        ) : (
            messages.map(renderMessage)
          )}
        </ScrollView>

        {/* Quick Replies */}
        {showQuickReplies && quickReplies.length > 0 && (
          <View style={styles.quickRepliesContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {quickReplies.map((reply, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickReplyBubble}
                  onPress={() => sendMessage(reply)}
                >
                  <ThemedText style={styles.quickReplyText}>{reply}</ThemedText>
                </TouchableOpacity>
            ))}
            </ScrollView>
          </View>
        )}

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity 
            style={styles.quickRepliesToggle}
            onPress={() => setShowQuickReplies(!showQuickReplies)}
          >
          <IconSymbol 
              name="sparkles" 
              size={16} 
              color={showQuickReplies ? LadColors.primary : getLadColor(colorScheme, 'text', 'secondary')} 
          />
        </TouchableOpacity>
        
          <View style={styles.messageInputContainer}>
        <TextInput
              style={[styles.messageInput, { color: Colors[colorScheme ?? 'light'].text }]}
              placeholder={LadCopy.MESSAGES.MESSAGE_PLACEHOLDER()}
              placeholderTextColor={getLadColor(colorScheme, 'text', 'tertiary')}
          value={messageText}
              onChangeText={handleTyping}
          multiline
          maxLength={500}
        />
          </View>
        
        <TouchableOpacity 
          style={[
            styles.sendButton,
              (!messageText.trim() || sending) && styles.sendButtonDisabled
          ]}
            onPress={() => sendMessage()}
            disabled={!messageText.trim() || sending}
        >
          <IconSymbol 
              name={sending ? 'arrow.2.circlepath' : 'arrow.up.circle.fill'} 
              size={24} 
            color="white"
          />
        </TouchableOpacity>
                </View>
    </KeyboardAvoidingView>

      {renderPersonalityInsights()}
    </SafeAreaView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${LadColors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  insightsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${LadColors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Chat Container
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 22,
  },
  
  // Messages
  messageContainer: {
    marginBottom: 12,
  },
  timestampContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  timestampText: {
    fontSize: 12,
    opacity: 0.6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    position: 'relative',
  },
  myMessage: {
    backgroundColor: LadColors.primary,
    alignSelf: 'flex-end',
    marginLeft: 48,
  },
  theirMessage: {
    backgroundColor: LadColors.social.otherPersonMessage,
    alignSelf: 'flex-start',
    marginRight: 48,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: 'white',
  },
  theirMessageText: {
    color: '#000000',
  },
  mediaMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaText: {
    fontSize: 14,
    fontWeight: '500',
  },
  messageStatus: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
  
  // Quick Replies
  quickRepliesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickReplyBubble: {
    backgroundColor: `${LadColors.primary}15`,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  quickReplyText: {
    color: LadColors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  quickRepliesToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageInputContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
  },
  messageInput: {
    fontSize: 16,
    maxHeight: 80,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LadColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  
  // Modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalCancel: {
    fontSize: 16,
    color: LadColors.primary,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  // Insights
  insightsHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  insightsTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  insightsSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
  },
  insightCard: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightTrait: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  compatibilityScore: {
    backgroundColor: LadColors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  insightDescription: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 20,
    marginBottom: 12,
  },
  conversationTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${LadColors.warning}15`,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  tipText: {
    fontSize: 14,
    flex: 1,
    fontStyle: 'italic',
  },
  aiDisclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
    gap: 8,
  },
  disclaimerText: {
    fontSize: 12,
    opacity: 0.7,
    flex: 1,
    lineHeight: 16,
  },
}); 