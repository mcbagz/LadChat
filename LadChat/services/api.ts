import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
const API_BASE_URL = 'https://ladchat.bagztech.com'; /*__DEV__ 
  ? 'http://192.168.0.14:8000'  // Development
  : 'https://api.ladchat.com'; // Production*/

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: '@ladchat:access_token',
  REFRESH_TOKEN: '@ladchat:refresh_token',
};

// Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DirectMessage {
  id: number;
  sender_id: number;
  recipient_id: number;
  content?: string;
  message_type: 'text' | 'media';
  media_url?: string;
  media_type?: string;
  view_duration?: number;
  is_read: boolean;
  is_opened: boolean;
  screenshot_taken: boolean;
  created_at: string;
  expires_at: string;
}

export interface GroupMessage {
  id: number;
  group_id: number;
  sender_id: number;
  sender: {
    id: number;
    username: string;
    profile_photo_url?: string;
    is_verified: boolean;
  };
  content?: string;
  message_type: 'text' | 'media';
  media_url?: string;
  media_type?: string;
  view_duration?: number;
  read_count: number;
  view_count: number;
  is_read_by_user: boolean;
  created_at: string;
  expires_at: string;
}

export interface Story {
  id: number;
  user_id: number;
  user: {
    id: number;
    username: string;
    profile_photo_url?: string;
    is_verified: boolean;
  };
  media_url: string;
  media_type: 'photo' | 'video';
  caption?: string;
  visibility: 'public' | 'friends' | 'private';
  view_count: number;
  has_viewed: boolean;
  created_at: string;
  expires_at: string;
}

export interface Snap {
  id: number;
  sender: {
    id: number;
    username: string;
    profile_photo_url?: string;
  };
  media_url: string;
  media_type: 'photo' | 'video';
  caption?: string;
  view_duration: number;
  total_views: number;
  total_screenshots: number;
  is_opened: boolean;
  created_at: string;
  expires_at: string;
  recipients?: Array<{
    type: 'user' | 'group';
    id: number;
    username?: string;
    name?: string;
  }>;
}

export interface Conversation {
  chat_type: 'direct' | 'group';
  chat_id: number;
  other_user?: {
    id: number;
    username: string;
    profile_photo_url?: string;
  };
  group_name?: string;
  group_avatar_url?: string;
  member_count?: number;
  unread_count: number;
  last_message_preview: string;
  last_message_at: string;
}

export interface GroupChat {
  id: number;
  creator_id: number;
  name: string;
  description?: string;
  avatar_url?: string;
  member_count: number;
  max_members: number;
  group_interests: string[];
  visibility: 'public' | 'private' | 'invite_only';
  join_approval_required: boolean;
  auto_suggest_members: boolean;
  auto_suggest_events: boolean;
  last_message_at?: string;
  message_count: number;
  created_at: string;
  is_active: boolean;
  user_is_member: boolean;
  user_is_admin: boolean;
}

export interface GroupMember {
  user_id: number;
  user: {
    id: number;
    username: string;
    bio?: string;
    interests: string[];
    profile_photo_url?: string;
    is_verified: boolean;
    created_at: string;
  };
  is_admin: boolean;
  joined_at: string;
}

// Event interfaces for Phase 5
export interface Event {
  id: number;
  creator_id: number;
  title: string;
  description?: string;
  story?: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  start_time: string;
  end_time: string;
  rsvp_deadline?: string;
  expires_at: string;
  visibility: string;
  max_attendees?: number;
  attendee_count: number;
  maybe_count: number;
  declined_count: number;
  friend_attendee_count?: number;
  is_premium: boolean;
  is_featured: boolean;
  is_ongoing: boolean;
  is_active: boolean;
  view_count?: number;
  story_media: Array<{
    url: string;
    type: string;
    caption?: string;
    timestamp: string;
  }>;
  media_url?: string;
  media_type?: string;
  can_rsvp: boolean;
  user_rsvp?: {
    status: string;
    comment?: string;
    timestamp: string;
  };
  created_at: string;
  updated_at: string;
}

export interface EventCreateData {
  title: string;
  description?: string;
  story?: string;
  location_name: string;
  latitude: number;
  longitude: number;
  creator_latitude: number;
  creator_longitude: number;
  start_time: string;
  end_time: string;
  rsvp_deadline?: string;
  max_attendees?: number;
  visibility?: 'public' | 'friends' | 'private' | 'groups';
  shared_with_friends?: number[];
  shared_with_groups?: number[];
  is_premium?: boolean;
  location_privacy?: 'exact' | 'approximate' | 'hidden';
}

export interface EventFilters {
  limit?: number;
  offset?: number;
  filter_type?: 'all' | 'friends' | 'public' | 'ongoing' | 'upcoming' | 'my_events';
  sort_by?: 'start_time' | 'distance' | 'created_at';
  latitude?: number;
  longitude?: number;
  radius_km?: number;
}

export interface EventRSVP {
  status: 'yes' | 'maybe' | 'no';
  comment?: string;
}

export interface EventRecommendation {
  event_id: number;
  title: string;
  description: string;
  location_name: string;
  start_time: string;
  end_time: string;
  attendee_count: number;
  distance_miles: number;
  similarity_score: number;
  can_rsvp: boolean;
  reason: string;
}

export interface FriendRecommendation {
  user_id: number;
  username: string;
  bio?: string;
  interests: string[];
  profile_photo_url?: string;
  similarity_score: number;
  mutual_friends_count: number;
  reason: string;
}

class ApiClient {
  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = await this.getAuthToken();
      
      const defaultHeaders: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        defaultHeaders.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          data,
        };
      } else {
        return {
          success: false,
          error: data.error?.message || data.detail || 'Request failed',
        };
      }
    } catch (error) {
      console.error('API request error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  private async uploadFile(
    endpoint: string,
    fileUri: string,
    formData: Record<string, string>
  ): Promise<ApiResponse> {
    try {
      console.log('Uploading file:', { endpoint, fileUri, formData });
      const token = await this.getAuthToken();
      
      const formDataObj = new FormData();
      
      // Determine file type from URI
      const fileExtension = fileUri.split('.').pop()?.toLowerCase();
      let mimeType = 'image/jpeg';
      let fileName = 'upload.jpg';
      
      if (fileExtension) {
        switch (fileExtension) {
          case 'png':
            mimeType = 'image/png';
            fileName = 'upload.png';
            break;
          case 'jpg':
          case 'jpeg':
            mimeType = 'image/jpeg';
            fileName = 'upload.jpg';
            break;
          case 'mp4':
            mimeType = 'video/mp4';
            fileName = 'upload.mp4';
            break;
          case 'mov':
            mimeType = 'video/quicktime';
            fileName = 'upload.mov';
            break;
          default:
            // Try to determine from URI pattern
            if (fileUri.includes('video') || fileUri.includes('.mp4') || fileUri.includes('.mov')) {
              mimeType = 'video/mp4';
              fileName = 'upload.mp4';
            }
        }
      }

      // Add file
      formDataObj.append('media_file', {
        uri: fileUri,
        type: mimeType,
        name: fileName,
      } as any);

      // Add other form fields
      Object.entries(formData).forEach(([key, value]) => {
        formDataObj.append(key, value);
      });

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formDataObj,
      });

      const data = await response.json();
      console.log('Upload response:', { status: response.status, data });

      if (response.ok) {
        return {
          success: true,
          data,
        };
      } else {
        return {
          success: false,
          error: data.error?.message || data.detail || 'Upload failed',
        };
      }
    } catch (error) {
      console.error('File upload error:', error);
      return {
        success: false,
        error: 'Upload failed',
      };
    }
  }

  // Health Check
  async healthCheck(): Promise<ApiResponse> {
    return this.makeRequest('/health');
  }

  // Direct Messages
  async sendMessage(recipientId: number, content: string): Promise<ApiResponse<DirectMessage>> {
    return this.makeRequest('/messages/send', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: recipientId,
        content,
        message_type: 'text',
      }),
    });
  }

  async sendMediaMessage(
    recipientId: number,
    mediaUri: string,
    viewDuration: number = 10,
    caption?: string
  ): Promise<ApiResponse<DirectMessage>> {
    return this.uploadFile('/messages/send-media', mediaUri, {
      recipient_id: recipientId.toString(),
      view_duration: viewDuration.toString(),
      ...(caption && { caption }),
    });
  }

  async getConversations(): Promise<ApiResponse<Conversation[]>> {
    return this.makeRequest('/messages/conversations');
  }

  async getChatSummary(): Promise<ApiResponse<Conversation[]>> {
    return this.makeRequest('/notifications/chat-summary');
  }

  async markChatAsOpened(chatType: 'direct' | 'group', chatId: number): Promise<ApiResponse> {
    return this.makeRequest('/notifications/mark-chat-opened', {
      method: 'POST',
      body: JSON.stringify({
        chat_type: chatType,
        chat_id: chatId,
      }),
    });
  }

  async getConversationMessages(userId: number, beforeId?: number): Promise<ApiResponse<DirectMessage[]>> {
    const params = new URLSearchParams();
    if (beforeId) params.append('before_id', beforeId.toString());
    
    return this.makeRequest(`/messages/${userId}?${params.toString()}`);
  }

  async markMessagesAsRead(messageIds: number[]): Promise<ApiResponse> {
    return this.makeRequest('/messages/read', {
      method: 'POST',
      body: JSON.stringify({ message_ids: messageIds }),
    });
  }

  async markMediaAsViewed(messageId: number, screenshotTaken = false): Promise<ApiResponse> {
    return this.makeRequest('/messages/view', {
      method: 'POST',
      body: JSON.stringify({
        message_id: messageId,
        screenshot_taken: screenshotTaken,
      }),
    });
  }

  // Group Messages
  async sendGroupMessage(groupId: number, content: string): Promise<ApiResponse<GroupMessage>> {
    return this.makeRequest(`/groups/${groupId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        group_id: groupId,
        content,
        message_type: 'text',
      }),
    });
  }

  async sendGroupMediaMessage(
    groupId: number,
    mediaUri: string,
    viewDuration: number = 10,
    caption?: string
  ): Promise<ApiResponse<GroupMessage>> {
    return this.uploadFile(`/groups/${groupId}/messages/media`, mediaUri, {
      view_duration: viewDuration.toString(),
      ...(caption && { caption }),
    });
  }

  async getGroupMessages(groupId: number, limit: number = 50, beforeId?: number): Promise<ApiResponse<GroupMessage[]>> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (beforeId) params.append('before_id', beforeId.toString());
    
    return this.makeRequest(`/groups/${groupId}/messages?${params.toString()}`);
  }

  async markGroupMessagesAsRead(groupId: number, messageIds: number[]): Promise<ApiResponse<any>> {
    return this.makeRequest(`/groups/${groupId}/messages/read`, {
      method: 'POST',
      body: JSON.stringify({ message_ids: messageIds }),
    });
  }

  // Stories
  async createStory(
    mediaUri: string,
    caption?: string,
    visibility: string = 'public',
    circles?: number[]
  ): Promise<ApiResponse<Story>> {
    return this.uploadFile('/stories/upload', mediaUri, {
      ...(caption && { caption }),
      visibility,
      ...(circles && { circles: JSON.stringify(circles) }),
    });
  }

  async getStoryFeed(limit = 20, offset = 0): Promise<ApiResponse<Story[]>> {
    return this.makeRequest(`/stories/feed?limit=${limit}&offset=${offset}`);
  }

  async getMyStories(): Promise<ApiResponse<Story[]>> {
    return this.makeRequest('/stories/my-stories');
  }

  async getUserStories(userId: number): Promise<ApiResponse<Story[]>> {
    return this.makeRequest(`/stories/user/${userId}`);
  }

  async viewStory(storyId: number): Promise<ApiResponse> {
    return this.makeRequest(`/stories/${storyId}/view`, {
      method: 'POST',
    });
  }

  async deleteStory(storyId: number): Promise<ApiResponse> {
    return this.makeRequest(`/stories/${storyId}`, {
      method: 'DELETE',
    });
  }

  // Snaps
  async sendSnap(
    recipientIds: number[],
    groupIds: number[],
    mediaUri: string,
    viewDuration: number = 10,
    caption?: string
  ): Promise<ApiResponse> {
    return this.uploadFile('/snaps/send', mediaUri, {
      recipient_ids: JSON.stringify(recipientIds),
      group_ids: JSON.stringify(groupIds),
      view_duration: viewDuration.toString(),
      ...(caption && { caption }),
    });
  }

  async getReceivedSnaps(unreadOnly = false): Promise<ApiResponse<Snap[]>> {
    return this.makeRequest(`/snaps/received?unread_only=${unreadOnly}`);
  }

  async getSentSnaps(): Promise<ApiResponse<Snap[]>> {
    return this.makeRequest('/snaps/sent');
  }

  async getSnap(snapId: number): Promise<ApiResponse<Snap>> {
    return this.makeRequest(`/snaps/${snapId}`);
  }

  async viewSnap(snapId: number, screenshotTaken = false): Promise<ApiResponse> {
    return this.makeRequest(`/snaps/${snapId}/view`, {
      method: 'POST',
      body: JSON.stringify({
        message_id: snapId,
        screenshot_taken: screenshotTaken,
      }),
    });
  }

  // Media Upload
  async uploadMedia(mediaUri: string, category: string): Promise<ApiResponse> {
    return this.uploadFile('/media/upload', mediaUri, {
      category,
    });
  }

  // Friends API
  async searchUsers(query: string, limit = 20): Promise<ApiResponse> {
    return this.makeRequest(`/friends/search?query=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async sendFriendRequest(recipientId: number, message?: string): Promise<ApiResponse> {
    return this.makeRequest('/friends/request', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: recipientId,
        message,
      }),
    });
  }

  async getFriendRequests(): Promise<ApiResponse> {
    return this.makeRequest('/friends/requests');
  }

  async respondToFriendRequest(requestId: number, action: 'accept' | 'decline'): Promise<ApiResponse> {
    return this.makeRequest(`/friends/requests/${requestId}/respond?action=${action}`, {
      method: 'POST',
    });
  }

  async getFriendsList(): Promise<ApiResponse> {
    return this.makeRequest('/friends/list');
  }

  async removeFriend(friendId: number): Promise<ApiResponse> {
    return this.makeRequest(`/friends/remove/${friendId}`, {
      method: 'DELETE',
    });
  }

  // User Profile API
  async updateUserProfile(updateData: {
    bio?: string;
    interests?: string[];
    open_to_friends?: boolean;
    location_radius?: number;
  }): Promise<ApiResponse> {
    return this.makeRequest('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  async getCurrentUser(): Promise<ApiResponse> {
    return this.makeRequest('/auth/me');
  }

  async getUserProfile(userId: number): Promise<ApiResponse> {
    return this.makeRequest(`/users/${userId}/profile`);
  }

  async uploadProfilePicture(imageUri: string): Promise<ApiResponse> {
    return this.uploadFile('/auth/profile-picture', imageUri, {});
  }

  // Group Management
  async createGroup(groupData: {
    name: string;
    description?: string;
    initial_member_ids?: number[];
    visibility?: 'public' | 'private' | 'invite_only';
    max_members?: number;
  }): Promise<ApiResponse<GroupChat>> {
    return this.makeRequest('/groups', {
      method: 'POST',
      body: JSON.stringify(groupData),
    });
  }

  async getUserGroups(): Promise<ApiResponse<{ groups: GroupChat[]; total_count: number }>> {
    return this.makeRequest('/groups');
  }

  async getGroupInfo(groupId: number): Promise<ApiResponse<GroupChat>> {
    return this.makeRequest(`/groups/${groupId}/info`);
  }

  async getGroupMembers(groupId: number): Promise<ApiResponse<GroupMember[]>> {
    return this.makeRequest(`/groups/${groupId}/members`);
  }

  async addGroupMembers(groupId: number, userIds: number[], makeAdmin: boolean = false): Promise<ApiResponse<any>> {
    return this.makeRequest(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({
        user_ids: userIds,
        make_admin: makeAdmin,
      }),
    });
  }

  async removeGroupMember(groupId: number, userId: number): Promise<ApiResponse<any>> {
    return this.makeRequest(`/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  async updateGroupMember(groupId: number, userId: number, isAdmin: boolean): Promise<ApiResponse<any>> {
    return this.makeRequest(`/groups/${groupId}/members/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ is_admin: isAdmin }),
    });
  }

  async updateGroup(groupId: number, updates: {
    name?: string;
    description?: string;
    visibility?: 'public' | 'private' | 'invite_only';
    max_members?: number;
    auto_suggest_members?: boolean;
    auto_suggest_events?: boolean;
    join_approval_required?: boolean;
  }): Promise<ApiResponse<GroupChat>> {
    return this.makeRequest(`/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async joinGroup(groupId: number): Promise<ApiResponse<any>> {
    return this.makeRequest(`/groups/${groupId}/join`, {
      method: 'POST',
    });
  }

  async leaveGroup(groupId: number): Promise<ApiResponse<any>> {
    return this.makeRequest(`/groups/${groupId}/leave`, {
      method: 'POST',
    });
  }

  // Events API (Phase 5)
  async createEvent(eventData: {
    title: string;
    description?: string;
    story?: string;
    location_name: string;
    latitude: number;
    longitude: number;
    creator_latitude: number;
    creator_longitude: number;
    start_time: string;
    end_time: string;
    rsvp_deadline?: string;
    max_attendees?: number;
    visibility?: string;
    shared_with_friends?: number[];
    shared_with_groups?: number[];
    is_premium?: boolean;
    location_privacy?: string;
  }): Promise<ApiResponse<{ event: Event }>> {
    return this.makeRequest('/events', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }

  async getEvents(params: {
    limit?: number;
    offset?: number;
    filter_type?: 'all' | 'friends' | 'public' | 'ongoing' | 'upcoming' | 'my_events';
    sort_by?: 'start_time' | 'distance' | 'created_at';
    latitude?: number;
    longitude?: number;
    radius_km?: number;
  } = {}): Promise<ApiResponse> {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    return this.makeRequest(`/events/?${searchParams.toString()}`);
  }

  async getEvent(eventId: number): Promise<ApiResponse> {
    return this.makeRequest(`/events/${eventId}`);
  }

  async updateEvent(eventId: number, updates: {
    title?: string;
    description?: string;
    story?: string;
    end_time?: string;
    rsvp_deadline?: string;
    max_attendees?: number;
    location_privacy?: string;
  }): Promise<ApiResponse> {
    return this.makeRequest(`/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteEvent(eventId: number): Promise<ApiResponse> {
    return this.makeRequest(`/events/${eventId}`, {
      method: 'DELETE',
    });
  }

  async rsvpToEvent(eventId: number, rsvpData: {
    status: 'yes' | 'maybe' | 'no';
    comment?: string;
  }): Promise<ApiResponse> {
    return this.makeRequest(`/events/${eventId}/rsvp`, {
      method: 'POST',
      body: JSON.stringify(rsvpData),
    });
  }

  async getEventRSVPs(eventId: number): Promise<ApiResponse> {
    return this.makeRequest(`/events/${eventId}/rsvps`);
  }

  async addEventMedia(eventId: number, mediaUri: string, caption?: string): Promise<ApiResponse> {
    return this.uploadFile(`/events/${eventId}/media`, mediaUri, {
      ...(caption && { caption }),
    });
  }

  async getEventStats(eventId: number): Promise<ApiResponse> {
    return this.makeRequest(`/events/${eventId}/stats`);
  }

  async getMyActiveEvents(): Promise<ApiResponse> {
    return this.makeRequest('/events/my/active');
  }

  async getAttendingEvents(): Promise<ApiResponse> {
    return this.makeRequest('/events/attending/upcoming');
  }

  // Recommendations
  async getFriendRecommendations(limit: number = 10): Promise<ApiResponse<FriendRecommendation[]>> {
    const params = new URLSearchParams({
      limit: limit.toString(),
    });
    return this.makeRequest(`/recommendations/friends?${params.toString()}`);
  }

  async getEventRecommendations(latitude: number, longitude: number, limit: number = 10): Promise<ApiResponse<{ recommendations: EventRecommendation[] }>> {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      limit: limit.toString(),
    });
    return this.makeRequest(`/recommendations/events?${params.toString()}`);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient; 