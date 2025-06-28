import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
interface User {
  id: number;
  username: string;
  bio?: string;
  interests: string[];
  profile_photo_url?: string;
  open_to_friends: boolean;
  is_verified: boolean;
  created_at: string;
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface AuthContextType {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (userData: RegisterData) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<boolean>;
  refreshToken: () => Promise<boolean>;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  bio?: string;
  interests?: string[];
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: '@ladchat:access_token',
  REFRESH_TOKEN: '@ladchat:refresh_token',
  USER_DATA: '@ladchat:user_data',
  TOKEN_EXPIRY: '@ladchat:token_expiry',
};

// API Configuration
const API_BASE_URL = 'https://ladchat.bagztech.com'; /*__DEV__ 
  ? 'http://192.168.0.14:8000'  // Development - will work for both iOS simulator and web
  : 'https://api.ladchat.com'; // Production*/

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!(user && tokens);

  // Load stored auth data on app start
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [accessToken, refreshToken, userData, expiryTime] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.USER_DATA),
        AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY),
      ]);

      if (accessToken && refreshToken && userData) {
        const parsedUser = JSON.parse(userData);
        const expiry = expiryTime ? parseInt(expiryTime) : 0;
        const now = Date.now();

        // Check if token is expired
        if (expiry > now) {
          setUser(parsedUser);
          setTokens({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: Math.floor((expiry - now) / 1000),
          });
        } else {
          // Try to refresh token
          const refreshSuccess = await refreshTokenInternal(refreshToken);
          if (!refreshSuccess) {
            await clearStoredAuth();
          }
        }
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
      await clearStoredAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const storeAuthData = async (authTokens: AuthTokens, userData: User) => {
    try {
      const expiryTime = Date.now() + (authTokens.expires_in * 1000);
      
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, authTokens.access_token),
        AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, authTokens.refresh_token),
        AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData)),
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString()),
      ]);

      setTokens(authTokens);
      setUser(userData);
    } catch (error) {
      console.error('Error storing auth data:', error);
      throw error;
    }
  };

  const clearStoredAuth = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
        AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
        AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA),
        AsyncStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY),
      ]);

      setUser(null);
      setTokens(null);
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  };

  const register = async (userData: RegisterData): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        const tokenData = await response.json();
        
        // Get user profile
        const userResponse = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenData.access_token}`,
          },
        });

        if (userResponse.ok) {
          const userProfileData = await userResponse.json();
          await storeAuthData(tokenData, userProfileData);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const tokenData = await response.json();
        
        // Get user profile
        const userResponse = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenData.access_token}`,
          },
        });

        if (userResponse.ok) {
          const userProfileData = await userResponse.json();
          await storeAuthData(tokenData, userProfileData);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    await clearStoredAuth();
  };

  const updateProfile = async (data: Partial<User>): Promise<boolean> => {
    try {
      if (!tokens) return false;

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.access_token}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUser));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Update profile error:', error);
      return false;
    }
  };

  const refreshTokenInternal = async (refreshTokenValue: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshTokenValue }),
      });

      if (response.ok) {
        const { access_token, refresh_token, expires_in } = await response.json();
        
        if (user) {
          await storeAuthData(
            { access_token, refresh_token, expires_in },
            user
          );
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    if (!tokens) return false;
    return refreshTokenInternal(tokens.refresh_token);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tokens,
        isLoading,
        isAuthenticated,
        login,
        register,
        logout,
        updateProfile,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
