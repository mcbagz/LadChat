import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, Conversation } from '@/services/api';

export default function MessagesScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await apiClient.getConversations();
      if (response.success && response.data) {
        setConversations(response.data);
      } else {
        Alert.alert('Error', response.error || 'Failed to load conversations');
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      Alert.alert('Error', 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const openConversation = (conversation: Conversation) => {
    router.push({
      pathname: '/messages/chat',
      params: {
        userId: conversation.other_user_id,
        username: conversation.other_user.username,
      },
    });
  };

  const formatLastMessageTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const getLastMessagePreview = (conversation: Conversation): string => {
    if (!conversation.last_message) return 'No messages yet';
    
    const message = conversation.last_message;
    if (message.message_type === 'media') {
      return message.media_type === 'photo' ? '📸 Photo' : '🎥 Video';
    }
    
    return message.content || 'Message';
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Messages</ThemedText>
        <ThemedText style={styles.subtitle}>
          Chat with your lads
        </ThemedText>
      </ThemedView>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading ? (
          <ThemedView style={styles.loadingState}>
            <ThemedText>Loading conversations...</ThemedText>
          </ThemedView>
        ) : conversations.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <IconSymbol 
              name="message.circle" 
              size={48} 
              color={Colors[colorScheme ?? 'light'].icon} 
            />
            <ThemedText style={styles.emptyTitle}>No conversations yet</ThemedText>
            <ThemedText style={styles.emptyText}>
              Start chatting with your friends to see conversations here
            </ThemedText>
          </ThemedView>
        ) : (
          <View style={styles.conversationsList}>
            {conversations.map((conversation) => (
              <TouchableOpacity
                key={conversation.id}
                style={styles.conversationItem}
                onPress={() => openConversation(conversation)}
              >
                <View style={styles.avatarContainer}>
                  {conversation.other_user.profile_photo_url ? (
                    <View style={styles.avatar}>
                      {/* TODO: Use actual image component */}
                      <IconSymbol 
                        name="person.crop.circle.fill" 
                        size={48} 
                        color={Colors[colorScheme ?? 'light'].icon} 
                      />
                    </View>
                  ) : (
                    <View style={styles.avatar}>
                      <IconSymbol 
                        name="person.crop.circle" 
                        size={48} 
                        color={Colors[colorScheme ?? 'light'].icon} 
                      />
                    </View>
                  )}
                  {conversation.other_user.is_verified && (
                    <View style={styles.verifiedBadge}>
                      <IconSymbol name="checkmark" size={12} color="white" />
                    </View>
                  )}
                </View>

                <View style={styles.conversationInfo}>
                  <View style={styles.conversationHeader}>
                    <ThemedText style={styles.username}>
                      {conversation.other_user.username}
                    </ThemedText>
                    <ThemedText style={styles.timestamp}>
                      {formatLastMessageTime(conversation.updated_at)}
                    </ThemedText>
                  </View>
                  
                  <View style={styles.lastMessageRow}>
                    <ThemedText 
                      style={[
                        styles.lastMessage,
                        conversation.unread_count > 0 && styles.unreadMessage
                      ]}
                      numberOfLines={1}
                    >
                      {getLastMessagePreview(conversation)}
                    </ThemedText>
                    
                    {conversation.unread_count > 0 && (
                      <View style={styles.unreadBadge}>
                        <ThemedText style={styles.unreadCount}>
                          {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>

                {conversation.is_muted && (
                  <IconSymbol 
                    name="speaker.slash" 
                    size={16} 
                    color={Colors[colorScheme ?? 'light'].icon} 
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  subtitle: {
    opacity: 0.7,
    marginTop: 4,
  },
  content: {
    flex: 1,
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
  conversationsList: {
    paddingHorizontal: 20,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.6,
  },
  lastMessageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    opacity: 0.7,
    marginRight: 8,
  },
  unreadMessage: {
    opacity: 1,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
}); 