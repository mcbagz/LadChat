import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, Alert, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

const AVAILABLE_INTERESTS = [
  'Soccer', 'Basketball', 'Gaming', 'BBQ', 'Hiking', 'Photography',
  'Music', 'Movies', 'Coffee', 'Fitness', 'Tech', 'Art', 'Cooking',
  'Travel', 'Reading', 'Cycling', 'Skateboarding', 'Surfing'
];

export default function SignupScreen() {
  const colorScheme = useColorScheme();
  const { register } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    bio: '',
    interests: [] as string[],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: Basic Info, 2: Interests

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleInterest = (interest: string) => {
    setFormData(prev => {
      const newInterests = prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : prev.interests.length < 3
          ? [...prev.interests, interest]
          : prev.interests;
      
      if (prev.interests.length >= 3 && !prev.interests.includes(interest)) {
        Alert.alert('Limit Reached', 'You can select up to 3 interests');
      }
      
      return { ...prev, interests: newInterests };
    });
  };

  const validateStep1 = () => {
    if (!formData.username.trim()) {
      Alert.alert('Missing Information', 'Please enter a username');
      return false;
    }
    if (formData.username.length < 3) {
      Alert.alert('Invalid Username', 'Username must be at least 3 characters long');
      return false;
    }
    if (!formData.email.trim()) {
      Alert.alert('Missing Information', 'Please enter an email address');
      return false;
    }
    if (!formData.email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return false;
    }
    if (!formData.password.trim()) {
      Alert.alert('Missing Information', 'Please enter a password');
      return false;
    }
    if (formData.password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleSignup = async () => {
    if (!validateStep1()) return;

    setIsLoading(true);
    try {
      const userData = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        bio: formData.bio.trim() || undefined,
        interests: formData.interests,
      };

      const success = await register(userData);
      
      if (success) {
        router.replace('/(tabs)');
      } else {
        Alert.alert(
          'Registration Failed',
          'This username or email is already taken. Please try different ones.',
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
    if (currentStep === 2) {
      setCurrentStep(1);
    } else {
      router.back();
    }
  };

  const handleLogin = () => {
    router.push('./login');
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
              <ThemedText style={styles.title}>
                {currentStep === 1 ? 'Join LadChat' : 'Tell Us About You'}
              </ThemedText>
              <ThemedText style={styles.subtitle}>
                {currentStep === 1 
                  ? 'Create your account to start connecting' 
                  : 'Pick up to 3 interests to help us find your tribe'
                }
              </ThemedText>
            </View>

            {/* Progress Indicator */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${(currentStep / 2) * 100}%`,
                      backgroundColor: Colors[colorScheme ?? 'light'].tint 
                    }
                  ]} 
                />
              </View>
              <ThemedText style={styles.progressText}>{currentStep} of 2</ThemedText>
            </View>
          </View>

          {currentStep === 1 ? (
            // Step 1: Basic Information
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Username</ThemedText>
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
                    placeholder="Choose a username"
                    placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Email</ThemedText>
                <View style={styles.inputContainer}>
                  <IconSymbol 
                    name="envelope" 
                    size={20} 
                    color={Colors[colorScheme ?? 'light'].icon} 
                  />
                  <TextInput
                    style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                    value={formData.email}
                    onChangeText={(value) => handleInputChange('email', value)}
                    placeholder="Enter your email"
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
                    placeholder="Create a password"
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

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Confirm Password</ThemedText>
                <View style={styles.inputContainer}>
                  <IconSymbol 
                    name="lock" 
                    size={20} 
                    color={Colors[colorScheme ?? 'light'].icon} 
                  />
                  <TextInput
                    style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                    value={formData.confirmPassword}
                    onChangeText={(value) => handleInputChange('confirmPassword', value)}
                    placeholder="Confirm your password"
                    placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity 
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.passwordToggle}
                  >
                    <IconSymbol 
                      name={showConfirmPassword ? "eye.slash" : "eye"} 
                      size={20} 
                      color={Colors[colorScheme ?? 'light'].icon} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Bio (Optional)</ThemedText>
                <View style={styles.inputContainer}>
                  <IconSymbol 
                    name="text.alignleft" 
                    size={20} 
                    color={Colors[colorScheme ?? 'light'].icon} 
                  />
                  <TextInput
                    style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                    value={formData.bio}
                    onChangeText={(value) => handleInputChange('bio', value)}
                    placeholder="Tell us about yourself"
                    placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
                    maxLength={100}
                    multiline
                  />
                </View>
                <ThemedText style={styles.characterCount}>
                  {formData.bio.length}/100
                </ThemedText>
              </View>

              <TouchableOpacity 
                style={[styles.nextButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
                onPress={handleNext}
              >
                <ThemedText style={styles.nextButtonText}>Next</ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            // Step 2: Interests Selection
            <View style={styles.form}>
              <View style={styles.interestsSection}>
                <ThemedText style={styles.interestsTitle}>
                  Pick Your Interests ({formData.interests.length}/3)
                </ThemedText>
                <ThemedText style={styles.interestsSubtitle}>
                  This helps us find friends with similar vibes
                </ThemedText>

                <View style={styles.interestsGrid}>
                  {AVAILABLE_INTERESTS.map((interest) => (
                    <TouchableOpacity
                      key={interest}
                      style={[
                        styles.interestChip,
                        formData.interests.includes(interest) && {
                          backgroundColor: Colors[colorScheme ?? 'light'].tint
                        }
                      ]}
                      onPress={() => toggleInterest(interest)}
                    >
                      <ThemedText style={[
                        styles.interestText,
                        formData.interests.includes(interest) && styles.selectedInterestText
                      ]}>
                        {interest}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity 
                style={[
                  styles.signupButton, 
                  { backgroundColor: Colors[colorScheme ?? 'light'].tint },
                  isLoading && styles.disabledButton
                ]}
                onPress={handleSignup}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ThemedText style={styles.signupButtonText}>Creating Account...</ThemedText>
                ) : (
                  <ThemedText style={styles.signupButtonText}>Create Account</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.bottomSection}>
            <TouchableOpacity style={styles.loginLink} onPress={handleLogin}>
              <ThemedText style={styles.loginLinkText}>
                Already have an account?{' '}
                <ThemedText style={[styles.loginLinkTextBold, { color: Colors[colorScheme ?? 'light'].tint }]}>
                  Sign In
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
    marginBottom: 32,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 16,
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 22,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    opacity: 0.6,
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
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
  characterCount: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
    textAlign: 'right',
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  interestsSection: {
    flex: 1,
  },
  interestsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  interestsSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 24,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  interestChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  interestText: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectedInterestText: {
    color: 'white',
  },
  signupButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
  },
  disabledButton: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  bottomSection: {
    marginTop: 16,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loginLinkText: {
    fontSize: 16,
  },
  loginLinkTextBold: {
    fontWeight: '600',
  },
}); 