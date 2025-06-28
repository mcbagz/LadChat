import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LadColors, Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, GroupMessage, GroupChat, DirectMessage } from '@/services/api';
import ProfilePicture from '@/components/ProfilePicture';
import GroupSettingsModal from '@/components/GroupSettingsModal';

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  
  // Handle both individual and group chats
  const isGroup = params.isGroup === 'true';
  const userId = params.userId ? parseInt(params.userId as string) : null;
  const username = params.username as string;
  const groupId = params.groupId ? parseInt(params.groupId as string) : null;
  const groupName = params.groupName as string;
  
  const scrollViewRef = useRef<ScrollView>(null);

  // State
  const [messages, setMessages] = useState<(DirectMessage | GroupMessage)[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupChat | null>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]); // Store group members for username mapping
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [eventRSVPs, setEventRSVPs] = useState<{[eventId: number]: 'yes' | 'no'}>({});

  useEffect(() => {
    if (isGroup && groupId) {
      loadGroupInfo();
      loadGroupMessages();
    } else if (!isGroup && userId) {
      loadDirectMessages();
    }
  }, [isGroup, groupId, userId]);

  const loadGroupInfo = async () => {
    if (!groupId) return;
    
    try {
      const [groupResponse, membersResponse] = await Promise.all([
        apiClient.getGroupInfo(groupId),
        apiClient.getGroupMembers(groupId)
      ]);
      
      if (groupResponse.success && groupResponse.data) {
        setGroupInfo(groupResponse.data);
      }
      
      if (membersResponse.success && membersResponse.data) {
        setGroupMembers(membersResponse.data);
        console.log('👥 GROUP MEMBERS LOADED:', membersResponse.data);
      }
    } catch (error) {
      console.error('Failed to load group info:', error);
    }
  };

  const loadGroupMessages = async () => {
    if (!groupId) return;
    
    setIsLoading(true);
    try {
      const response = await apiClient.getGroupMessages(groupId, 50);
      if (response.success && response.data) {
        setMessages(response.data.reverse()); // Reverse to show newest at bottom
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (error) {
      console.error('Failed to load group messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDirectMessages = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const response = await apiClient.getConversationMessages(userId);
      if (response.success && response.data) {
        setMessages(response.data.reverse()); // Reverse to show newest at bottom
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
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
      let response;
      if (isGroup && groupId) {
        response = await apiClient.sendGroupMessage(groupId, tempMessage);
      } else if (!isGroup && userId) {
        response = await apiClient.sendMessage(userId, tempMessage);
      }

      if (response?.success && response.data) {
        setMessages(prev => [...prev, response.data]);
        setTimeout(() => scrollToBottom(), 100);
      } else {
        // Restore message on failure
        setMessageText(tempMessage);
        Alert.alert('Error', 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessageText(tempMessage);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const handleGroupUpdated = async () => {
    // Refresh group info and messages after updates
    if (isGroup && groupId) {
      await loadGroupInfo();
      await loadGroupMessages();
    }
  };

  const openGroupSettings = () => {
    if (isGroup && groupInfo) {
      setShowGroupSettings(true);
    }
  };

  const formatMessageTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    
    return date.toLocaleDateString();
  };

  const openCamera = () => {
    if (isGroup) {
      // Navigate to camera for group media
      router.push({
        pathname: '/(tabs)/' as any,
        params: {
          groupMessage: 'true',
          groupId: groupId?.toString(),
          groupName: groupName,
        },
      });
    } else {
      // Navigate to camera for direct message
      router.push({
        pathname: '/(tabs)/' as any,
        params: {
          directMessage: 'true',
          recipientId: userId?.toString(),
          recipientUsername: username,
        },
      });
    }
  };

  // Helper function to get username from sender ID
  const getSenderName = (senderId: number): string => {
    const member = groupMembers.find(m => m.user_id === senderId || m.user?.id === senderId);
    const username = member?.user?.username || member?.username;
    return username || `User ${senderId}`;
  };

  const renderMessage = (message: DirectMessage | GroupMessage, index: number) => {
    const isOwnMessage = message.sender_id === user?.id;
    const isGroupMessage = 'group_id' in message;
    const isMediaMessage = message.message_type === 'media';
    
    // Check if this is an event share message
    let eventData = null;
    try {
      if (message.content && message.content.trim().startsWith('{')) {
        const parsed = JSON.parse(message.content.trim());
        if (parsed && parsed.type === 'event_share') {
          eventData = parsed;
        }
      }
    } catch (error) {
      // Not a JSON message, continue with regular rendering
    }
    
    // Get sender info - use our member mapping for group messages
    let senderInfo = null;
    let senderName = `User ${message.sender_id}`;
    
    if (isGroupMessage) {
      senderName = getSenderName(message.sender_id);
      // Try to find profile picture from group members
      const member = groupMembers.find(m => m.user_id === message.sender_id || m.user?.id === message.sender_id);
      senderInfo = member?.user || member;
    }

    // Handle event RSVP
    const handleEventRSVP = async (eventId: number, status: 'yes' | 'no') => {
      try {
        const response = await apiClient.rsvpToEvent(eventId, { status });
        if (response.success) {
          // Store the RSVP status locally
          setEventRSVPs(prev => ({ ...prev, [eventId]: status }));
          Alert.alert('RSVP Updated!', `You've RSVP'd "${status === 'yes' ? 'Going' : 'Not Going'}" to this event.`);
        } else {
          Alert.alert('Error', 'Failed to update RSVP');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to update RSVP');
      }
    };

    // If this is an event message, render special event card
    if (eventData) {
      // Check if user has RSVP'd to this event
      const userRSVPStatus = eventRSVPs[eventData.event_id];
      return (
        <View key={message.id} style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
        ]}>
          {!isOwnMessage && isGroup && (
            <View style={styles.messageAvatarContainer}>
              <ProfilePicture
                uri={senderInfo?.profile_photo_url}
                size={32}
                style={styles.messageAvatar}
              />
            </View>
          )}
          
          <View style={[styles.eventMessageBubble]}>
            {!isOwnMessage && isGroup && (
              <ThemedText style={styles.senderName}>
                {senderName}
              </ThemedText>
            )}
            
            <View style={styles.eventHeader}>
              <IconSymbol name="calendar" size={16} color={LadColors.primary} />
              <ThemedText style={styles.eventTag}>Event</ThemedText>
            </View>
            
            <ThemedText style={styles.eventTitle}>{eventData.event_title}</ThemedText>
            
            <View style={styles.eventDetails}>
              <View style={styles.eventDetailRow}>
                <IconSymbol name="clock" size={14} color={Colors[colorScheme ?? 'light'].icon} />
                <ThemedText style={styles.eventDetailText}>{eventData.event_time}</ThemedText>
              </View>
              
              <View style={styles.eventDetailRow}>
                <IconSymbol name="location" size={14} color={Colors[colorScheme ?? 'light'].icon} />
                <ThemedText style={styles.eventDetailText}>{eventData.event_location}</ThemedText>
              </View>
            </View>
            
            {eventData.event_description && (
              <ThemedText style={styles.eventDescription} numberOfLines={2}>
                {eventData.event_description}
              </ThemedText>
            )}
            
            <View style={styles.eventActions}>
              {userRSVPStatus ? (
                // Show current RSVP status with option to change
                <View style={styles.rsvpStatusContainer}>
                  <View style={[
                    styles.rsvpStatusBadge, 
                    userRSVPStatus === 'yes' ? styles.goingBadge : styles.notGoingBadge
                  ]}>
                    <IconSymbol 
                      name={userRSVPStatus === 'yes' ? "checkmark" : "xmark"} 
                      size={12} 
                      color="white" 
                    />
                    <ThemedText style={styles.rsvpStatusText}>
                      {userRSVPStatus === 'yes' ? 'Going' : 'Not Going'}
                    </ThemedText>
                  </View>
                  <TouchableOpacity 
                    style={styles.changeRSVPButton}
                    onPress={() => {
                      Alert.alert(
                        'Change RSVP',
                        'Update your response to this event:',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { 
                            text: 'Going', 
                            onPress: () => handleEventRSVP(eventData.event_id, 'yes')
                          },
                          { 
                            text: 'Not Going', 
                            onPress: () => handleEventRSVP(eventData.event_id, 'no')
                          },
                        ]
                      );
                    }}
                  >
                    <ThemedText style={styles.changeRSVPText}>Change</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                // Show RSVP buttons if user hasn't responded yet
                <>
                  <TouchableOpacity 
                    style={[styles.rsvpButton, styles.yesButton]}
                    onPress={() => handleEventRSVP(eventData.event_id, 'yes')}
                  >
                    <IconSymbol name="checkmark" size={14} color="white" />
                    <ThemedText style={styles.rsvpButtonText}>Going</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.rsvpButton, styles.noButton]}
                    onPress={() => handleEventRSVP(eventData.event_id, 'no')}
                  >
                    <IconSymbol name="xmark" size={14} color="white" />
                    <ThemedText style={styles.rsvpButtonText}>Not Going</ThemedText>
                  </TouchableOpacity>
                </>
              )}
            </View>
            
            <View style={styles.messageFooter}>
              <ThemedText style={[
                styles.messageTime,
                isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
              ]}>
                {formatMessageTime(message.created_at)}
              </ThemedText>
            </View>
          </View>
        </View>
      );
    }
    
    // Regular message rendering
    return (
      <View key={message.id} style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
      ]}>
        {!isOwnMessage && isGroup && (
          <View style={styles.messageAvatarContainer}>
            <ProfilePicture
              uri={senderInfo?.profile_photo_url}
              size={32}
              style={styles.messageAvatar}
            />
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
          isMediaMessage && styles.mediaBubble,
        ]}>
          {!isOwnMessage && isGroup && (
            <ThemedText style={styles.senderName}>
              {senderName}
            </ThemedText>
          )}
          
          {isMediaMessage && message.media_url ? (
            <View style={styles.mediaContainer}>
              <Image 
                source={{ uri: message.media_url }} 
                style={styles.mediaImage}
                resizeMode="cover"
              />
              {message.content && (
                <ThemedText style={[
                  styles.messageText,
                  styles.mediaCaption,
                  isOwnMessage ? styles.ownMessageText : styles.otherMessageText
                ]}>
                  {message.content}
                </ThemedText>
              )}
            </View>
          ) : (
            <ThemedText style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}>
              {message.content}
            </ThemedText>
          )}
          
          <View style={[
            styles.messageFooter,
            isOwnMessage && styles.ownMessageFooter
          ]}>
            <ThemedText style={[
              styles.messageTime,
              isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
            ]}>
              {formatMessageTime(message.created_at)}
            </ThemedText>
            
            {isOwnMessage && isGroupMessage && 'read_count' in message && (
              <View style={styles.readStatus}>
                <ThemedText style={styles.readCount}>
                  {message.read_count > 0 ? `Read by ${message.read_count}` : 'Sent'}
                </ThemedText>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  if ((isGroup && !groupId) || (!isGroup && !userId)) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.errorContainer}>
          <ThemedText>Invalid chat parameters</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <ThemedView style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color={LadColors.primary} />
          </TouchableOpacity>
          
          <View style={styles.chatInfoContainer}>
            <View style={styles.avatarContainer}>
              <ProfilePicture
                uri={isGroup ? groupInfo?.avatar_url : undefined}
                size={40}
                style={styles.chatAvatar}
                borderWidth={2}
                borderColor={`${LadColors.primary}30`}
              />
              {isGroup && groupInfo?.user_is_admin && (
                <View style={styles.adminIndicator}>
                  <IconSymbol name="crown.fill" size={12} color="white" />
                </View>
              )}
            </View>
            
            <View style={styles.titleContainer}>
              <TouchableOpacity 
                style={styles.titleTouchable}
                onPress={isGroup ? openGroupSettings : undefined}
                disabled={!isGroup}
              >
                <ThemedText style={styles.chatTitle}>
                  {isGroup ? groupName : username}
                </ThemedText>
                {isGroup && (
                  <View style={styles.titleRow}>
                    <ThemedText style={styles.memberCount}>
                      {groupInfo?.member_count || 0} member{groupInfo?.member_count !== 1 ? 's' : ''}
                    </ThemedText>
                    <IconSymbol name="chevron.right" size={12} color={LadColors.primary} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.headerButton}
            onPress={openCamera}
          >
            <IconSymbol name="camera" size={22} color={LadColors.primary} />
          </TouchableOpacity>
        </ThemedView>

        {/* Messages */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ThemedText>Loading messages...</ThemedText>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol 
                name="message.circle" 
                size={48} 
                color={Colors[colorScheme ?? 'light'].icon} 
              />
              <ThemedText style={styles.emptyTitle}>No messages yet</ThemedText>
              <ThemedText style={styles.emptyText}>
                {isGroup 
                  ? 'Be the first to send a message in this group!'
                  : 'Start the conversation!'
                }
              </ThemedText>
            </View>
          ) : (
            messages.map((message, index) => renderMessage(message, index))
          )}
        </ScrollView>

        {/* Message Input */}
        <ThemedView style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TouchableOpacity 
              style={styles.cameraButton}
              onPress={openCamera}
            >
              <IconSymbol name="camera.fill" size={20} color={LadColors.primary} />
            </TouchableOpacity>
            
            <TextInput
              style={[styles.messageInput, { color: Colors[colorScheme ?? 'light'].text }]}
              placeholder="Send a message..."
              placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={1000}
              editable={!isSending}
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
                name={isSending ? "arrow.2.circlepath" : "arrow.up"} 
                size={18} 
                color="white" 
              />
            </TouchableOpacity>
          </View>
        </ThemedView>
      </KeyboardAvoidingView>
      
      {/* Group Settings Modal */}
      {isGroup && groupInfo && (
        <GroupSettingsModal
          visible={showGroupSettings}
          onClose={() => setShowGroupSettings(false)}
          group={groupInfo}
          onGroupUpdated={handleGroupUpdated}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: `${LadColors.primary}20`,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderRadius: 22,
    backgroundColor: `${LadColors.primary}15`,
  },
  chatInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  chatAvatar: {
    borderRadius: 20,
  },
  adminIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  titleContainer: {
    flex: 1,
  },
  titleTouchable: {
    flex: 1,
  },
  chatTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: LadColors.primary,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberCount: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 2,
    fontWeight: '500',
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: `${LadColors.primary}15`,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  messagesContent: {
    padding: 20,
    paddingBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
    color: LadColors.primary,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  messageContainer: {
    marginBottom: 20,
    flexDirection: 'row',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatarContainer: {
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  messageAvatar: {
    borderRadius: 16,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  ownMessageBubble: {
    backgroundColor: LadColors.primary,
    borderBottomRightRadius: 6,
  },
  otherMessageBubble: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 6,
  },
  mediaBubble: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    color: LadColors.primary,
    opacity: 0.8,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
  },
  ownMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: '#000',
  },
  mediaContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  mediaImage: {
    width: 200,
    height: 200,
    borderRadius: 16,
  },
  mediaCaption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  ownMessageFooter: {
    justifyContent: 'space-between',
  },
  messageTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.8)',
  },
  otherMessageTime: {
    color: 'rgba(0,0,0,0.6)',
  },
  readStatus: {
    marginLeft: 8,
  },
  readCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: `${LadColors.primary}20`,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  cameraButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${LadColors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: `${LadColors.primary}30`,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: LadColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: LadColors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: `${LadColors.primary}60`,
    shadowOpacity: 0.1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  eventMessageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventTag: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    color: LadColors.primary,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    color: LadColors.primary,
  },
  eventDetails: {
    marginBottom: 8,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventDetailText: {
    fontSize: 12,
    marginLeft: 4,
    color: LadColors.primary,
  },
  eventDescription: {
    marginBottom: 8,
  },
  eventActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rsvpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: LadColors.primary,
    marginRight: 8,
  },
  yesButton: {
    backgroundColor: '#4CAF50',
  },
  noButton: {
    backgroundColor: '#F44336',
  },
  rsvpButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    marginLeft: 4,
  },
  rsvpStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rsvpStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: LadColors.primary,
  },
  goingBadge: {
    backgroundColor: '#4CAF50',
  },
  notGoingBadge: {
    backgroundColor: '#F44336',
  },
  rsvpStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    marginLeft: 4,
  },
  changeRSVPButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: LadColors.primary,
    opacity: 0.8,
  },
  changeRSVPText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
}); 