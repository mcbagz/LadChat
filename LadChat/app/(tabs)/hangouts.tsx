import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

export default function HangoutsScreen() {
  const colorScheme = useColorScheme();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Placeholder hangout data
  const placeholderHangouts = [
    {
      id: 1,
      title: 'BBQ at the Park',
      creator: 'Jake',
      time: '6:00 PM',
      date: 'Today',
      location: 'Central Park',
      attendees: 5,
      rsvp: 'yes' as const,
    },
    {
      id: 2,
      title: 'Pickup Basketball',
      creator: 'Mike',
      time: '2:00 PM',
      date: 'Tomorrow',
      location: 'Local Court',
      attendees: 8,
      rsvp: 'maybe' as const,
    },
    {
      id: 3,
      title: 'Gaming Night',
      creator: 'Alex',
      time: '8:00 PM',
      date: 'Friday',
      location: 'Alex\'s Place',
      attendees: 4,
      rsvp: null,
    },
  ];

  const createHangout = () => {
    Alert.alert(
      'Create Hangout',
      'Hangout creation flow will be implemented in later phases',
      [{ text: 'OK' }]
    );
  };

  const toggleViewMode = () => {
    setViewMode(current => current === 'list' ? 'map' : 'list');
  };

  const handleRSVP = (hangoutId: number, response: 'yes' | 'maybe' | 'no') => {
    Alert.alert('RSVP', `You responded "${response}" to this hangout`);
  };

  const getRSVPColor = (rsvp: 'yes' | 'maybe' | 'no' | null) => {
    switch (rsvp) {
      case 'yes': return '#4CAF50';
      case 'maybe': return '#FF9800';
      case 'no': return '#F44336';
      default: return Colors[colorScheme ?? 'light'].text;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <ThemedText type="title">Hangouts</ThemedText>
            <ThemedText style={styles.subtitle}>
              Plan and join meetups with your lads
            </ThemedText>
          </View>
          <TouchableOpacity style={styles.createButton} onPress={createHangout}>
            <IconSymbol name="plus" size={20} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.viewToggle}>
          <TouchableOpacity 
            style={[styles.toggleButton, viewMode === 'list' && styles.activeToggle]}
            onPress={() => setViewMode('list')}
          >
            <IconSymbol 
              name="list.bullet" 
              size={16} 
              color={viewMode === 'list' ? 'white' : Colors[colorScheme ?? 'light'].text} 
            />
            <ThemedText style={[styles.toggleText, viewMode === 'list' && styles.activeToggleText]}>
              List
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, viewMode === 'map' && styles.activeToggle]}
            onPress={() => setViewMode('map')}
          >
            <IconSymbol 
              name="map" 
              size={16} 
              color={viewMode === 'map' ? 'white' : Colors[colorScheme ?? 'light'].text} 
            />
            <ThemedText style={[styles.toggleText, viewMode === 'map' && styles.activeToggleText]}>
              Map
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {viewMode === 'list' ? (
          <View style={styles.listView}>
            {placeholderHangouts.map((hangout) => (
              <TouchableOpacity key={hangout.id} style={styles.hangoutCard}>
                <View style={styles.hangoutHeader}>
                  <ThemedText style={styles.hangoutTitle}>{hangout.title}</ThemedText>
                  <ThemedText style={styles.hangoutCreator}>by {hangout.creator}</ThemedText>
                </View>
                
                <View style={styles.hangoutDetails}>
                  <View style={styles.detailRow}>
                    <IconSymbol name="clock" size={14} color={Colors[colorScheme ?? 'light'].icon} />
                    <ThemedText style={styles.detailText}>
                      {hangout.date} at {hangout.time}
                    </ThemedText>
                  </View>
                  <View style={styles.detailRow}>
                    <IconSymbol name="location" size={14} color={Colors[colorScheme ?? 'light'].icon} />
                    <ThemedText style={styles.detailText}>{hangout.location}</ThemedText>
                  </View>
                  <View style={styles.detailRow}>
                    <IconSymbol name="person.2" size={14} color={Colors[colorScheme ?? 'light'].icon} />
                    <ThemedText style={styles.detailText}>{hangout.attendees} attending</ThemedText>
                  </View>
                </View>

                <View style={styles.rsvpSection}>
                  {hangout.rsvp ? (
                    <View style={[styles.rsvpStatus, { backgroundColor: getRSVPColor(hangout.rsvp) }]}>
                      <ThemedText style={styles.rsvpStatusText}>
                        You're {hangout.rsvp === 'yes' ? 'going' : 'maybe going'}
                      </ThemedText>
                    </View>
                  ) : (
                    <View style={styles.rsvpButtons}>
                      <TouchableOpacity 
                        style={[styles.rsvpButton, styles.yesButton]}
                        onPress={() => handleRSVP(hangout.id, 'yes')}
                      >
                        <ThemedText style={styles.rsvpButtonText}>Yes</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.rsvpButton, styles.maybeButton]}
                        onPress={() => handleRSVP(hangout.id, 'maybe')}
                      >
                        <ThemedText style={styles.rsvpButtonText}>Maybe</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.rsvpButton, styles.noButton]}
                        onPress={() => handleRSVP(hangout.id, 'no')}
                      >
                        <ThemedText style={styles.rsvpButtonText}>No</ThemedText>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <ThemedView style={styles.mapView}>
            <IconSymbol 
              name="map" 
              size={64} 
              color={Colors[colorScheme ?? 'light'].icon} 
            />
            <ThemedText style={styles.mapPlaceholder}>
              Map view will be implemented with Mapbox in Phase 5
            </ThemedText>
            <ThemedText style={styles.mapSubtext}>
              You'll see nearby hangouts and be able to create location-based events
            </ThemedText>
          </ThemedView>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  subtitle: {
    opacity: 0.7,
    marginTop: 4,
  },
  createButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 6,
  },
  activeToggle: {
    backgroundColor: '#007AFF',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeToggleText: {
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listView: {
    gap: 16,
  },
  hangoutCard: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 4,
  },
  hangoutHeader: {
    marginBottom: 12,
  },
  hangoutTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  hangoutCreator: {
    fontSize: 14,
    opacity: 0.6,
  },
  hangoutDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
  },
  rsvpSection: {
    alignItems: 'center',
  },
  rsvpStatus: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
  },
  rsvpStatusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  rsvpButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  yesButton: {
    backgroundColor: '#4CAF50',
  },
  maybeButton: {
    backgroundColor: '#FF9800',
  },
  noButton: {
    backgroundColor: '#F44336',
  },
  rsvpButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  mapView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  mapPlaceholder: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  mapSubtext: {
    textAlign: 'center',
    opacity: 0.6,
    lineHeight: 20,
    paddingHorizontal: 40,
  },
}); 