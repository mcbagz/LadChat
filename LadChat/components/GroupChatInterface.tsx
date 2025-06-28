import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  RefreshControl,
  FlatList,
  Animated,
  Modal
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, GroupMessage, GroupChat } from '@/services/api';
import ProfilePicture from '@/components/ProfilePicture';
import GroupSettingsModal from '@/components/GroupSettingsModal';
import MemberManagementModal from '@/components/MemberManagementModal';
import { LadColors, getLadColor } from '@/constants/Colors';
import { LadCopy } from '@/utils/LadCopy';

interface Message {
  id: number;
  content?: string;
  media_url?: string;
  media_type?: 'photo' | 'video';
  sender: {
    id: number;
    username: string;
    profile_photo_url?: string;
    is_verified: boolean;
  };
  created_at: string;
  is_read: boolean;
  has_viewed?: boolean;
}

interface GroupMember {
  user_id: number;
  username: string;
  profile_photo_url?: string;
  is_verified: boolean;
  role: 'admin' | 'member';
  joined_at: string;
  is_online?: boolean;
  last_active?: string;
}

interface GroupInfo {
  id: number;
  name: string;
  description?: string;
  member_count: number;
  user_is_member: boolean;
  user_is_admin: boolean;
  visibility: 'public' | 'private' | 'invite_only';
  created_at: string;
  group_vibe?: string;
}

interface EventRecommendation {
  event_id: number;
  title: string;
  description: string;
  location_name: string;
  start_time: string;
  attendee_count: number;
  distance_miles: number;
  similarity_score: number;
  reason: string;
  can_rsvp: boolean;
}

interface MemberRecommendation {
  user_id: number;
  username: string;
  bio?: string;
  interests: string[];
  profile_photo_url?: string;
  similarity_score: number;
  mutual_friends_count: number;
  reason: string;
}

interface GroupChatInterfaceProps {
  groupId: number;
  groupName: string;
  isVisible: boolean;
  onClose: () => void;
}

export default function GroupChatInterface({ 
  groupId, 
  groupName, 
  isVisible,
  onClose
}: GroupChatInterfaceProps) {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const groupIdFromParams = params.groupId ? parseInt(params.groupId as string) : null;
  const groupNameFromParams = params.groupName as string;
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [eventRecommendations, setEventRecommendations] = useState<EventRecommendation[]>([]);
  const [memberRecommendations, setMemberRecommendations] = useState<MemberRecommendation[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showMemberManagement, setShowMemberManagement] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendationType, setRecommendationType] = useState<'events' | 'members'>('events');
  const recommendationsPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isVisible && groupIdFromParams) {
      loadGroupData();
      loadMessages();
      loadRecommendations();
    }
  }, [isVisible, groupIdFromParams]);

  useEffect(() => {
    if (eventRecommendations.length > 0 || memberRecommendations.length > 0) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(recommendationsPulse, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(recommendationsPulse, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [eventRecommendations, memberRecommendations]);

  const loadGroupData = async () => {
    try {
      const [groupResponse, membersResponse] = await Promise.all([
        apiClient.get(`/groups/${groupIdFromParams}/info`),
        apiClient.get(`/groups/${groupIdFromParams}/members`)
      ]);
      
      if (groupResponse.data.success) {
        setGroupInfo(groupResponse.data.data);
      }
      
      if (membersResponse.data.success) {
        setMembers(membersResponse.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load group data:', error);
    }
  };

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get(`/groups/${groupIdFromParams}/messages`, {
        params: { limit: 50 }
      });
      
      if (response.data.success && response.data.data) {
        setMessages(response.data.data.reverse()); // Show newest at bottom
        markMessagesAsRead();
        scrollToBottom();
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecommendations = async () => {
    if (!groupInfo?.user_is_admin) return; // Only admins see recommendations
    
    setLoadingRecommendations(true);
    try {
      // Get user location for event recommendations
      const location = await getCurrentLocation();
      
      const [eventRecs, memberRecs] = await Promise.all([
        apiClient.get(`/recommendations/groups/${groupIdFromParams}/events`, {
          params: {
            admin_latitude: location?.latitude,
            admin_longitude: location?.longitude,
            limit: 5
          }
        }),
        // Member recommendations would be a custom endpoint we'd need to create
        Promise.resolve({ data: { success: true, data: [] } }) // Placeholder
      ]);
      
      if (eventRecs.data.success) {
        setEventRecommendations(eventRecs.data.data || []);
      }
      
      if (memberRecs.data.success) {
        setMemberRecommendations(memberRecs.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const getCurrentLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      // In a real app, you'd request location permissions and get coordinates
      // For now, return mock coordinates
      return { latitude: 40.7829, longitude: -73.9654 };
    } catch (error) {
      return null;
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await apiClient.post(`/groups/${groupIdFromParams}/messages/read`);
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const sendMessage = async () => {
    if (!messageText.trim() || isSending) return;

    const tempMessage: Message = {
      id: Date.now(),
      content: messageText.trim(),
      sender: {
        id: 0, // Current user
        username: 'You',
        is_verified: false
      },
      created_at: new Date().toISOString(),
      is_read: true
    };

    setMessages(prev => [...prev, tempMessage]);
    setMessageText('');
    scrollToBottom();
    setIsSending(true);

    try {
      const response = await apiClient.post(`/groups/${groupIdFromParams}/messages`, {
        content: messageText.trim()
      });
      
      if (response.data.success) {
        // Replace temp message with real one
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id ? response.data.data : msg
        ));
      } else {
        // Remove temp message on failure
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
        Alert.alert(LadCopy.QUICK.ERROR, 'Failed to send message');
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      Alert.alert(LadCopy.QUICK.ERROR, 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleEventRecommendation = (event: EventRecommendation) => {
    Alert.alert(
      'Share Event?',
      `Share "${event.title}" with the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share',
          onPress: async () => {
            try {
              await apiClient.post(`/groups/${groupIdFromParams}/messages`, {
                content: `🎉 Check out this event: ${event.title} at ${event.location_name}!\n\n${event.reason}`
              });
              loadMessages();
            } catch (error) {
              Alert.alert(LadCopy.QUICK.ERROR, 'Failed to share event');
            }
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadGroupData(),
      loadMessages(),
      loadRecommendations()
    ]);
    setRefreshing(false);
  };

  const formatMessageTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return date.toLocaleDateString();
  };

  const MessageItem = ({ message }: { message: Message }) => {
    // Check if this is an event share message
    let eventData = null;
    
    console.log('Processing message:', message.content); // Debug log
    
    try {
      if (message.content) {
        // Try to parse as JSON
        const parsed = JSON.parse(message.content.trim());
        console.log('Parsed JSON:', parsed); // Debug log
        
        if (parsed && parsed.type === 'event_share') {
          eventData = parsed;
          console.log('Event data detected:', eventData); // Debug log
        }
      }
    } catch (error) {
      console.log('Not a JSON message:', error); // Debug log
      // Not a JSON message, continue with regular rendering
    }

    const handleEventRSVP = async (eventId: number, status: 'yes' | 'no') => {
      try {
        const response = await apiClient.rsvpToEvent(eventId, { status });
        if (response.success) {
          Alert.alert('RSVP Updated!', `You've RSVP'd "${status}" to this event.`);
          loadMessages(); // Refresh to show updated RSVP status
        } else {
          Alert.alert('Error', 'Failed to update RSVP');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to update RSVP');
      }
    };

    // If we have event data, render the event card
    if (eventData) {
      console.log('Rendering event card for:', eventData.event_title); // Debug log
      return (
        <View style={styles.messageContainer}>
          {message.sender.username !== 'You' && (
            <View style={styles.messageHeader}>
              <ProfilePicture
                uri={message.sender.profile_photo_url}
                size={24}
                showVerified={message.sender.is_verified}
                style={{ marginRight: 8 }}
              />
              <ThemedText style={styles.senderName}>
                {message.sender.username}
              </ThemedText>
              <ThemedText style={styles.messageTime}>
                {formatMessageTime(message.created_at)}
              </ThemedText>
            </View>
          )}
          
          <View style={styles.eventMessageBubble}>
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
                <ThemedText style={styles.rsvpButtonText}>Can't Go</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // Regular message rendering
    return (
      <View style={[
          styles.messageContainer,
        message.sender.username === 'You' && styles.ownMessage
        ]}>
        {message.sender.username !== 'You' && (
          <View style={styles.messageHeader}>
              <ProfilePicture
              uri={message.sender.profile_photo_url}
              size={24}
              showVerified={message.sender.is_verified}
              style={{ marginRight: 8 }}
            />
            <ThemedText style={styles.senderName}>
              {message.sender.username}
            </ThemedText>
            <ThemedText style={styles.messageTime}>
              {formatMessageTime(message.created_at)}
            </ThemedText>
            </View>
          )}
          
          <View style={[
            styles.messageBubble,
          message.sender.username === 'You' ? styles.ownMessageBubble : styles.otherMessageBubble
        ]}>
          {message.media_url ? (
            <View style={styles.mediaMessage}>
              <IconSymbol 
                name={message.media_type === 'video' ? 'play.circle' : 'camera'} 
                size={20} 
                color="white" 
              />
              <ThemedText style={styles.mediaText}>
                {message.media_type === 'video' ? 'Video' : 'Photo'}
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={[
              styles.messageText,
              message.sender.username === 'You' && styles.ownMessageText
            ]}>
              {message.content}
            </ThemedText>
          )}
          </View>
        </View>
      );
  };

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={LadColors.primary} />
          </TouchableOpacity>
          
          <View style={styles.headerInfo}>
            <ThemedText style={styles.groupName} numberOfLines={1}>
              {groupNameFromParams}
            </ThemedText>
              <ThemedText style={styles.memberCount}>
              {members.length} {members.length === 1 ? 'member' : 'lads'}
              {groupInfo?.group_vibe && ` • ${groupInfo.group_vibe}`}
              </ThemedText>
            </View>

          <View style={styles.headerActions}>
            {/* AI Recommendations Badge */}
            {(eventRecommendations.length > 0 || memberRecommendations.length > 0) && groupInfo?.user_is_admin && (
              <Animated.View style={{ transform: [{ scale: recommendationsPulse }] }}>
              <TouchableOpacity 
                  style={styles.aiButton}
                  onPress={() => setShowRecommendations(true)}
                >
                  <IconSymbol name="sparkles" size={16} color="white" />
                  <View style={styles.recommendationBadge}>
                    <ThemedText style={styles.badgeText}>
                      {eventRecommendations.length + memberRecommendations.length}
                    </ThemedText>
                  </View>
              </TouchableOpacity>
              </Animated.View>
            )}
            
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => setShowGroupSettings(true)}
            >
              <IconSymbol name="gear" size={20} color={LadColors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        >
          {isLoading ? (
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
                Start the conversation
              </ThemedText>
              <ThemedText style={styles.emptySubtitle}>
                Be the first to drop a message in the group
              </ThemedText>
            </View>
          ) : (
            messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))
          )}
        </ScrollView>

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              ref={textInputRef}
              style={[styles.textInput, { color: Colors[colorScheme ?? 'light'].text }]}
              placeholder={LadCopy.MESSAGES.MESSAGE_PLACEHOLDER()}
              placeholderTextColor={getLadColor(colorScheme, 'text', 'tertiary')}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={500}
              onSubmitEditing={sendMessage}
              blurOnSubmit={false}
            />
            
            <TouchableOpacity 
              style={[
                styles.sendButton,
                { backgroundColor: messageText.trim() ? LadColors.primary : 'transparent' }
              ]}
              onPress={sendMessage}
              disabled={!messageText.trim() || isSending}
            >
              <IconSymbol 
                name="arrow.up.circle.fill" 
                size={32} 
                color={messageText.trim() ? 'white' : getLadColor(colorScheme, 'text', 'tertiary')} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Modals */}
        <GroupSettingsModal
          visible={showGroupSettings}
          onClose={() => setShowGroupSettings(false)}
          groupInfo={groupInfo}
          onGroupUpdated={loadGroupData}
          onMemberManagement={() => {
            setShowGroupSettings(false);
            setShowMemberManagement(true);
          }}
        />

        <MemberManagementModal
          visible={showMemberManagement}
          onClose={() => setShowMemberManagement(false)}
          groupId={groupIdFromParams}
          members={members}
          isUserAdmin={groupInfo?.user_is_admin || false}
          onMembersUpdated={loadGroupData}
        />

        {/* AI Recommendations Modal */}
        <Modal
          visible={showRecommendations}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowRecommendations(false)}
        >
          <View style={[styles.recommendationsModal, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowRecommendations(false)}>
                <ThemedText style={styles.modalCancel}>Close</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.modalTitle}>AI Suggestions</ThemedText>
              <View style={styles.placeholder} />
            </View>

            <View style={styles.recommendationTabs}>
              <TouchableOpacity
                style={[styles.recTab, recommendationType === 'events' && styles.activeRecTab]}
                onPress={() => setRecommendationType('events')}
              >
                <IconSymbol 
                  name="calendar" 
                  size={16} 
                  color={recommendationType === 'events' ? LadColors.primary : getLadColor(colorScheme, 'text', 'secondary')} 
                />
                <ThemedText style={[
                  styles.recTabText,
                  recommendationType === 'events' && styles.activeRecTabText
                ]}>
                  Events ({eventRecommendations.length})
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.recTab, recommendationType === 'members' && styles.activeRecTab]}
                onPress={() => setRecommendationType('members')}
              >
                <IconSymbol 
                  name="person.badge.plus" 
                  size={16} 
                  color={recommendationType === 'members' ? LadColors.primary : getLadColor(colorScheme, 'text', 'secondary')} 
                />
                <ThemedText style={[
                  styles.recTabText,
                  recommendationType === 'members' && styles.activeRecTabText
                ]}>
                  New Members ({memberRecommendations.length})
                </ThemedText>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.recommendationsContent}>
              {recommendationType === 'events' ? (
                eventRecommendations.length === 0 ? (
                  <View style={styles.emptyRecommendations}>
                    <IconSymbol name="calendar.badge.exclamationmark" size={48} color={getLadColor(colorScheme, 'text', 'tertiary')} />
                    <ThemedText style={styles.emptyRecTitle}>No event suggestions</ThemedText>
                    <ThemedText style={styles.emptyRecSubtitle}>
                      AI couldn't find events that match your group's vibe right now
                    </ThemedText>
                  </View>
                ) : (
                  eventRecommendations.map((event) => (
                    <TouchableOpacity 
                      key={event.event_id}
                      style={styles.recommendationCard}
                      onPress={() => handleEventRecommendation(event)}
                    >
                      <View style={styles.recCardHeader}>
                        <ThemedText style={styles.recCardTitle}>{event.title}</ThemedText>
                        <View style={styles.matchScore}>
                          <IconSymbol name="star.fill" size={12} color={LadColors.primary} />
                          <ThemedText style={styles.matchText}>
                            {Math.round(event.similarity_score * 100)}% match
                          </ThemedText>
                        </View>
                      </View>
                      
                      <ThemedText style={styles.recCardSubtitle}>
                        {event.location_name} • {event.distance_miles.toFixed(1)} miles
                      </ThemedText>
                      
                      <ThemedText style={styles.recCardReason}>
                        {event.reason}
                      </ThemedText>
                      
                      <View style={styles.recCardFooter}>
                        <ThemedText style={styles.attendeeCount}>
                          {event.attendee_count} attending
                        </ThemedText>
                        <TouchableOpacity style={styles.shareButton}>
                          <IconSymbol name="square.and.arrow.up" size={16} color={LadColors.primary} />
                          <ThemedText style={styles.shareButtonText}>Share</ThemedText>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))
                )
              ) : (
                <View style={styles.emptyRecommendations}>
                  <IconSymbol name="person.badge.plus" size={48} color={getLadColor(colorScheme, 'text', 'tertiary')} />
                  <ThemedText style={styles.emptyRecTitle}>Member suggestions coming soon</ThemedText>
                  <ThemedText style={styles.emptyRecSubtitle}>
                    AI-powered member recommendations will help grow your crew
                  </ThemedText>
                </View>
              )}
            </ScrollView>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${LadColors.primary}15`,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '700',
    color: LadColors.primary,
  },
  memberCount: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiButton: {
    backgroundColor: LadColors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  recommendationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: LadColors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${LadColors.primary}15`,
  },
  
  // Messages
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageContainer: {
    marginVertical: 4,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  messageTime: {
    fontSize: 12,
    opacity: 0.6,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  ownMessageBubble: {
    backgroundColor: LadColors.primary,
  },
  otherMessageBubble: {
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: 'white',
  },
  mediaMessage: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 8,
  },
  
  // Input
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // States
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
  
  // Recommendations Modal
  recommendationsModal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
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
  placeholder: {
    width: 60,
  },
  recommendationTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  recTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  activeRecTab: {
    backgroundColor: `${LadColors.primary}15`,
  },
  recTabText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  activeRecTabText: {
    color: LadColors.primary,
  },
  recommendationsContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  // Recommendation Cards
  recommendationCard: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: `${LadColors.primary}20`,
  },
  recCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  matchScore: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${LadColors.primary}15`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  matchText: {
    fontSize: 12,
    fontWeight: '600',
    color: LadColors.primary,
    marginLeft: 4,
  },
  recCardSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  recCardReason: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  recCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendeeCount: {
    fontSize: 14,
    opacity: 0.7,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${LadColors.primary}15`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: LadColors.primary,
    marginLeft: 4,
  },
  
  // Empty states
  emptyRecommendations: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyRecTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyRecSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Event message styles
  eventMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventMessageBubble: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: `${LadColors.primary}20`,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventTag: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  eventDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  eventDetailText: {
    fontSize: 14,
    opacity: 0.7,
  },
  eventDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 12,
  },
  eventActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rsvpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  yesButton: {
    backgroundColor: '#4CAF50',
  },
  noButton: {
    backgroundColor: '#F44336',
  },
  rsvpButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    marginLeft: 4,
  },
}); 