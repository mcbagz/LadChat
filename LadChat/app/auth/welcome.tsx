import React from 'react';
import { StyleSheet, View, TouchableOpacity, Image, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { router } from 'expo-router';

export default function WelcomeScreen() {
  const colorScheme = useColorScheme();

  const handleLogin = () => {
    router.push('./login');
  };

  const handleSignup = () => {
    router.push('./signup');
  };

  return (
    <ThemedView style={styles.container}>
      {/* Logo and Branding */}
      <View style={styles.heroSection}>
        <View style={styles.logoContainer}>
          <IconSymbol 
            name="person.2.wave.2" 
            size={80} 
            color={Colors[colorScheme ?? 'light'].tint} 
          />
        </View>
        
        <ThemedText style={styles.appName}>LadChat</ThemedText>
        <ThemedText style={styles.tagline}>
          Connect with your lads, create real memories
        </ThemedText>
      </View>

      {/* Feature Highlights */}
      <View style={styles.featuresSection}>
        <View style={styles.featureItem}>
          <IconSymbol 
            name="camera.circle" 
            size={32} 
            color={Colors[colorScheme ?? 'light'].tint} 
          />
          <View style={styles.featureText}>
            <ThemedText style={styles.featureTitle}>Ephemeral Stories</ThemedText>
            <ThemedText style={styles.featureDescription}>
              Share authentic moments that disappear
            </ThemedText>
          </View>
        </View>

        <View style={styles.featureItem}>
          <IconSymbol 
            name="calendar.badge.plus" 
            size={32} 
            color={Colors[colorScheme ?? 'light'].tint} 
          />
          <View style={styles.featureText}>
            <ThemedText style={styles.featureTitle}>Plan Hangouts</ThemedText>
            <ThemedText style={styles.featureDescription}>
              Organize meetups and events with friends
            </ThemedText>
          </View>
        </View>

        <View style={styles.featureItem}>
          <IconSymbol 
            name="person.2.badge.plus" 
            size={32} 
            color={Colors[colorScheme ?? 'light'].tint} 
          />
          <View style={styles.featureText}>
            <ThemedText style={styles.featureTitle}>Find Friends</ThemedText>
            <ThemedText style={styles.featureDescription}>
              AI-powered recommendations for new connections
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <TouchableOpacity 
          style={[styles.primaryButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
          onPress={handleSignup}
        >
          <ThemedText style={styles.primaryButtonText}>
            Get Started
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={handleLogin}
        >
          <ThemedText style={[styles.secondaryButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>
            Already have an account? Sign In
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Privacy Notice */}
      <View style={styles.privacySection}>
        <IconSymbol 
          name="lock.shield" 
          size={16} 
          color={Colors[colorScheme ?? 'light'].icon} 
        />
        <ThemedText style={styles.privacyText}>
          Your privacy matters. We don't store your data forever.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0,122,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresSection: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
  },
  featureText: {
    flex: 1,
    marginLeft: 16,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
  },
  actionSection: {
    gap: 16,
    marginBottom: 24,
  },
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  privacySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
  },
  privacyText: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
  },
}); 