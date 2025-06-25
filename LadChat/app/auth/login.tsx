import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, Alert, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogin = async () => {
    if (!formData.username.trim() || !formData.password.trim()) {
      Alert.alert('Missing Information', 'Please enter both username and password');
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(formData.username.trim(), formData.password);
      
      if (success) {
        router.replace('/(tabs)');
      } else {
        Alert.alert(
          'Login Failed',
          'Invalid username or password. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Something went wrong. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleSignup = () => {
    router.push('./signup');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <IconSymbol 
                name="chevron.left" 
                size={24} 
                color={Colors[colorScheme ?? 'light'].text} 
              />
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              <ThemedText style={styles.title}>Welcome Back</ThemedText>
              <ThemedText style={styles.subtitle}>
                Sign in to continue your journey
              </ThemedText>
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Username or Email</ThemedText>
              <View style={styles.inputContainer}>
                <IconSymbol 
                  name="person" 
                  size={20} 
                  color={Colors[colorScheme ?? 'light'].icon} 
                />
                <TextInput
                  style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                  value={formData.username}
                  onChangeText={(value) => handleInputChange('username', value)}
                  placeholder="Enter your username or email"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Password</ThemedText>
              <View style={styles.inputContainer}>
                <IconSymbol 
                  name="lock" 
                  size={20} 
                  color={Colors[colorScheme ?? 'light'].icon} 
                />
                <TextInput
                  style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                  value={formData.password}
                  onChangeText={(value) => handleInputChange('password', value)}
                  placeholder="Enter your password"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.passwordToggle}
                >
                  <IconSymbol 
                    name={showPassword ? "eye.slash" : "eye"} 
                    size={20} 
                    color={Colors[colorScheme ?? 'light'].icon} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={[
                styles.loginButton, 
                { backgroundColor: Colors[colorScheme ?? 'light'].tint },
                isLoading && styles.disabledButton
              ]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ThemedText style={styles.loginButtonText}>Signing In...</ThemedText>
              ) : (
                <ThemedText style={styles.loginButtonText}>Sign In</ThemedText>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotPassword}>
              <ThemedText style={[styles.forgotPasswordText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                Forgot Password?
              </ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSection}>
            <TouchableOpacity style={styles.signupLink} onPress={handleSignup}>
              <ThemedText style={styles.signupLinkText}>
                Don't have an account?{' '}
                <ThemedText style={[styles.signupLinkTextBold, { color: Colors[colorScheme ?? 'light'].tint }]}>
                  Sign Up
                </ThemedText>
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 24,
  },
  headerContent: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  passwordToggle: {
    padding: 4,
  },
  loginButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  forgotPassword: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  forgotPasswordText: {
    fontSize: 16,
    fontWeight: '500',
  },
  bottomSection: {
    marginTop: 'auto',
  },
  signupLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  signupLinkText: {
    fontSize: 16,
  },
  signupLinkTextBold: {
    fontWeight: '600',
  },
}); 