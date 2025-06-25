import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
const API_BASE_URL = __DEV__ 
  ? 'http://192.168.0.14:8000'  // Development
  : 'https://api.ladchat.com'; // Production

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
  id: number;
  other_user_id: number;
  other_user: {
    id: number;
    username: string;
    profile_photo_url?: string;
    is_verified: boolean;
  };
  last_message?: DirectMessage;
  unread_count: number;
  is_archived: boolean;
  is_muted: boolean;
  updated_at: string;
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

  async getGroupMessages(groupId: number, beforeId?: number): Promise<ApiResponse<GroupMessage[]>> {
    const params = new URLSearchParams();
    if (beforeId) params.append('before_id', beforeId.toString());
    
    return this.makeRequest(`/groups/${groupId}/messages?${params.toString()}`);
  }

  async markGroupMessagesAsRead(groupId: number, messageIds: number[]): Promise<ApiResponse> {
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
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient; 