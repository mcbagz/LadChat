import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, ScrollView, View, TouchableOpacity, Alert, RefreshControl,
  Modal, TextInput, Switch, ActivityIndicator, Platform,
  FlatList, SafeAreaView, Animated
} from 'react-native';
// Simple date/time picker using dropdowns
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LadColors, Colors, getLadColor } from '@/constants/Colors';
import { LadCopy } from '@/utils/LadCopy';
import * as Location from 'expo-location';
import { Event, EventCreateData, EventFilters, GroupChat } from '@/services/api';
import apiClient from '@/services/api';

interface CreateEventModalProps {
  visible: boolean;
  onClose: () => void;
  onEventCreated: () => void;
}

const CreateEventModal: React.FC<CreateEventModalProps> = ({ visible, onClose, onEventCreated }) => {
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  // Form state
  const [formData, setFormData] = useState<EventCreateData>({
    title: '',
    description: '',
    story: '',
    location_name: '',
    latitude: 0,
    longitude: 0,
    creator_latitude: 0,
    creator_longitude: 0,
    start_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    end_time: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
    visibility: 'friends',
    location_privacy: 'approximate',  
    is_premium: false,
  });

  // Simple date/time picker state
  const [selectedDay, setSelectedDay] = useState<'today' | 'tomorrow' | 'day_after'>('today');
  const [selectedHour, setSelectedHour] = useState<string>('5'); // 12-hour format
  const [selectedMinute, setSelectedMinute] = useState<string>('00');
  const [selectedAmPm, setSelectedAmPm] = useState<'AM' | 'PM'>('PM');
  const [duration, setDuration] = useState<number>(2); // Default 2 hours

  useEffect(() => {
    if (visible) {
      getCurrentLocation();
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required to create events');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      
      setUserLocation({ latitude, longitude });
      setFormData(prev => ({
        ...prev,
        latitude,
        longitude,
        creator_latitude: latitude,
        creator_longitude: longitude,
      }));

      // Get location name
      try {
        const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (reverseGeocode.length > 0) {
          const place = reverseGeocode[0];
          const locationName = `${place.name || place.street || ''} ${place.city || ''}`.trim();
          setFormData(prev => ({ ...prev, location_name: locationName }));
        }
      } catch (error) {
        console.log('Reverse geocoding failed:', error);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location');
    }
  };

  const updateDateTime = () => {
    const now = new Date();
    let baseDate: Date;
    
    switch (selectedDay) {
      case 'today':
        baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'tomorrow':
        baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'day_after':
        baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
        break;
    }
    
    // Convert 12-hour format to 24-hour format
    const hour12 = parseInt(selectedHour) || 5; // Default to 5 if empty
    const minute = parseInt(selectedMinute) || 0; // Default to 0 if empty
    
    let hour24 = hour12;
    if (selectedAmPm === 'PM' && hour12 !== 12) {
      hour24 += 12;
    } else if (selectedAmPm === 'AM' && hour12 === 12) {
      hour24 = 0;
    }
    
    const startTime = new Date(baseDate.getTime());
    startTime.setHours(hour24, minute, 0, 0);
    
    const endTime = new Date(startTime.getTime() + (duration * 3600000)); // duration in hours
    
    setFormData(prev => ({
      ...prev,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
    }));
  };

  useEffect(() => {
    updateDateTime();
  }, [selectedDay, selectedHour, selectedMinute, selectedAmPm, duration]);

  const formatDisplayTime = () => {
    const dayLabels = {
      today: 'Today',
      tomorrow: 'Tomorrow', 
      day_after: 'Day After Tomorrow'
    };
    
    return `${dayLabels[selectedDay]} at ${selectedHour}:${selectedMinute} ${selectedAmPm} for ${duration} hour${duration !== 1 ? 's' : ''}`;
  };

  const handleCreateEvent = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Event title is required');
      return;
    }

    if (!formData.location_name.trim()) {
      Alert.alert('Error', 'Location name is required');
      return;
    }

    if (!userLocation) {
      Alert.alert('Error', 'Current location is required to create events');
      return;
    }

    const startDate = new Date(Date.parse(formData.start_time));
    const endDate = new Date(Date.parse(formData.end_time));

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      Alert.alert('Error', 'Please enter a valid date format (e.g., YYYY-MM-DD HH:MM)');
      return;
    }

    const now = new Date();

    if (startDate <= now) {
      Alert.alert('Error', 'Start time must be in the future');
      return;
    }

    if (endDate <= startDate) {
      Alert.alert('Error', 'End time must be after start time');
      return;
    }

    setLoading(true);
    try {
      console.log('Creating event with data:', {
        ...formData,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      });

      const response = await apiClient.createEvent({
        ...formData,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      });

      console.log('Event creation response:', response);

      // Handle different response structures
      if (response.success) {
        const responseData = response.data;
        // Handle nested event structure or direct event data
        const newEvent = responseData?.event || responseData;
        const eventId = newEvent?.id;
        
        if (eventId) {
          Alert.alert('Success', 'Event created successfully!');
          
          // Automatically RSVP 'yes' for the creator
          try {
            await apiClient.rsvpToEvent(eventId, { status: 'yes' });
          } catch (rsvpError) {
            console.error('Auto-RSVP failed:', rsvpError);
            // Don't show an error to the user, as the event was created.
          }

          onEventCreated();
          onClose();
          resetForm();
        } else {
          console.warn('Event created but no event data returned:', response);
          Alert.alert('Success', 'Event created successfully!');
          onEventCreated();
          onClose();
          resetForm();
        }
      } else {
        console.error('Event creation failed:', response);
        Alert.alert('Error', response.error || response.message || 'Failed to create event');
      }
    } catch (error) {
      console.error('Event creation error:', error);
      Alert.alert('Error', 'Failed to create event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      story: '',
      location_name: '',
      latitude: 0,
      longitude: 0,
      creator_latitude: 0,
      creator_longitude: 0,
      start_time: new Date(Date.now() + 3600000).toISOString(),
      end_time: new Date(Date.now() + 7200000).toISOString(),
      visibility: 'friends',
      location_privacy: 'approximate',
      is_premium: false,
    });
    setUserLocation(null);
    // Reset dropdown time picker state
    setSelectedDay('today');
    setSelectedHour('5');
    setSelectedMinute('00');
    setSelectedAmPm('PM');
    setDuration(2);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <ThemedText style={{ fontSize: 16, color: Colors.light.icon }}>Cancel</ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.modalTitle}>Create Event</ThemedText>
          <TouchableOpacity onPress={handleCreateEvent} disabled={loading}>
            <ThemedText style={{ fontSize: 16, fontWeight: '600', color: LadColors.primary, opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Creating...' : 'Create'}
            </ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.formSection}>
            <ThemedText style={styles.formLabel}>Event Title *</ThemedText>
            <TextInput
              style={[styles.formInput, { color: Colors[colorScheme ?? 'light'].text }]}
              placeholder="What's happening?"
              placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
              maxLength={100}
            />
          </View>

          <View style={styles.formSection}>
            <ThemedText style={styles.formLabel}>Description</ThemedText>
            <TextInput
              style={[styles.formTextArea, { color: Colors[colorScheme ?? 'light'].text }]}
              placeholder="Tell people what to expect..."
              placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          <View style={styles.formSection}>
            <ThemedText style={styles.formLabel}>Location *</ThemedText>
            <TextInput
              style={[styles.formInput, { color: Colors[colorScheme ?? 'light'].text }]}
              placeholder="Where is this happening?"
              placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              value={formData.location_name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, location_name: text }))}
            />
            {userLocation && (
              <ThemedText style={styles.locationNote}>
                📍 You must be at the event location to create it
              </ThemedText>
            )}
          </View>

          <View style={styles.formSection}>
            <ThemedText style={styles.formLabel}>When & Duration *</ThemedText>
            <View style={styles.timePickerContainer}>
              {/* Day Selector */}
              <View style={styles.dropdownRow}>
                <ThemedText style={styles.dropdownLabel}>Day</ThemedText>
                <View style={styles.dropdownButtonContainer}>
                  {[
                    { key: 'today', label: 'Today' },
                    { key: 'tomorrow', label: 'Tomorrow' },
                    { key: 'day_after', label: 'Day After' },
                  ].map((day) => (
                    <TouchableOpacity
                      key={day.key}
                      style={[
                        styles.dropdownButton,
                        selectedDay === day.key && styles.dropdownButtonActive
                      ]}
                      onPress={() => setSelectedDay(day.key as any)}
                    >
                      <ThemedText style={[
                        styles.dropdownButtonText,
                        selectedDay === day.key && styles.dropdownButtonTextActive
                      ]}>
                        {day.label}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Time Selector */}
              <View style={styles.dropdownRow}>
                <ThemedText style={styles.dropdownLabel}>Time</ThemedText>
                <View style={styles.timeInputRow}>
                  {/* Hour input */}
                  <View style={styles.timeInputSection}>
                    <ThemedText style={styles.timePickerLabel}>Hour (1-12)</ThemedText>
                    <TextInput
                      style={[styles.timeTextInput, { color: Colors[colorScheme ?? 'light'].text }]}
                      placeholder="5"
                      placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
                      value={selectedHour}
                      onChangeText={(text) => {
                        const hour = parseInt(text);
                        if (text === '' || (!isNaN(hour) && hour >= 1 && hour <= 12)) {
                          setSelectedHour(text);
                        }
                      }}
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  </View>
                  
                  <ThemedText style={styles.timeSeparator}>:</ThemedText>
                  
                  {/* Minute input */}
                  <View style={styles.timeInputSection}>
                    <ThemedText style={styles.timePickerLabel}>Min (00-59)</ThemedText>
                    <TextInput
                      style={[styles.timeTextInput, { color: Colors[colorScheme ?? 'light'].text }]}
                      placeholder="00"
                      placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
                      value={selectedMinute}
                      onChangeText={(text) => {
                        const minute = parseInt(text);
                        if (text === '' || (!isNaN(minute) && minute >= 0 && minute <= 59)) {
                          setSelectedMinute(text.padStart(2, '0'));
                        }
                      }}
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  </View>
                  
                  {/* AM/PM Selector */}
                  <View style={styles.timeInputSection}>
                    <ThemedText style={styles.timePickerLabel}>Period</ThemedText>
                    <View style={styles.ampmContainer}>
                      <TouchableOpacity
                        style={[
                          styles.ampmButton,
                          selectedAmPm === 'AM' && styles.ampmButtonActive
                        ]}
                        onPress={() => setSelectedAmPm('AM')}
                      >
                        <ThemedText style={[
                          styles.ampmButtonText,
                          selectedAmPm === 'AM' && styles.ampmButtonTextActive
                        ]}>
                          AM
                        </ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.ampmButton,
                          selectedAmPm === 'PM' && styles.ampmButtonActive
                        ]}
                        onPress={() => setSelectedAmPm('PM')}
                      >
                        <ThemedText style={[
                          styles.ampmButtonText,
                          selectedAmPm === 'PM' && styles.ampmButtonTextActive
                        ]}>
                          PM
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              {/* Duration Selector */}
              <View style={styles.dropdownRow}>
                <ThemedText style={styles.dropdownLabel}>Duration</ThemedText>
                <View style={styles.dropdownButtonContainer}>
                  {[1, 2, 3, 4, 5, 6, 8].map((hours) => (
                    <TouchableOpacity
                      key={hours}
                      style={[
                        styles.durationButton,
                        duration === hours && styles.dropdownButtonActive
                      ]}
                      onPress={() => setDuration(hours)}
                    >
                      <ThemedText style={[
                        styles.dropdownButtonText,
                        duration === hours && styles.dropdownButtonTextActive
                      ]}>
                        {hours}h
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Display Summary */}
              <View style={styles.timeSummary}>
                <IconSymbol name="clock" size={16} color={LadColors.primary} />
                <ThemedText style={styles.timeSummaryText}>{formatDisplayTime()}</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.formSection}>
            <ThemedText style={styles.formLabel}>Visibility</ThemedText>
            <View style={styles.visibilityOptions}>
              {[
                { key: 'friends', label: 'Friends Only', icon: 'person.2.fill' },
                { key: 'private', label: 'Private', icon: 'lock.fill' },
                { key: 'public', label: 'Public ($50)', icon: 'globe' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.visibilityOption,
                    formData.visibility === option.key && styles.visibilityOptionSelected
                  ]}
                  onPress={() => {
                    setFormData(prev => ({ 
                      ...prev, 
                      visibility: option.key as any,
                      is_premium: option.key === 'public'
                    }));
                  }}
                >
                  <IconSymbol 
                    name={option.icon as any} 
                    size={20} 
                    color={formData.visibility === option.key ? 'white' : Colors[colorScheme ?? 'light'].text} 
                  />
                  <ThemedText style={[
                    styles.visibilityOptionText,
                    formData.visibility === option.key && styles.visibilityOptionTextSelected
                  ]}>
                    {option.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formSection}>
            <View style={styles.switchRow}>
              <View>
                <ThemedText style={styles.formLabel}>Location Privacy</ThemedText>
                <ThemedText style={styles.formSubtext}>
                  {formData.location_privacy === 'exact' ? 'Show exact location' : 'Show approximate location'}
                </ThemedText>
              </View>
              <Switch
                value={formData.location_privacy === 'exact'}
                onValueChange={(value) => 
                  setFormData(prev => ({ ...prev, location_privacy: value ? 'exact' : 'approximate' }))
                }
                trackColor={{ false: Colors[colorScheme ?? 'light'].tabIconDefault, true: '#007AFF' }}
              />
            </View>
          </View>

          {formData.is_premium && (
            <View style={styles.premiumNotice}>
              <IconSymbol name="star.fill" size={20} color="#FFD700" />
              <ThemedText style={styles.premiumText}>
                Premium public events cost $50 and appear in public discovery within 5 miles
              </ThemedText>
            </View>
          )}
        </ScrollView>


      </SafeAreaView>
    </Modal>
  );
};

interface EventCardProps {
  event: Event;
  onRSVP: (eventId: number, status: 'yes' | 'maybe' | 'no') => void;
  onPress: () => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, onRSVP, onPress }) => {
  const colorScheme = useColorScheme();

  // Helper function to check if event is currently live (local timezone)
  const isEventLive = (event: Event): boolean => {
    const now = new Date();
    const startTime = new Date(event.start_time);
    const endTime = new Date(event.end_time);
    return now >= startTime && now <= endTime;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (eventDate.getTime() === today.getTime()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (eventDate.getTime() === today.getTime() + 86400000) {
      return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const getRSVPColor = (status: string) => {
    switch (status) {
      case 'yes': return '#4CAF50';
      case 'maybe': return '#FF9800';
      case 'no': return '#F44336';
      default: return Colors[colorScheme ?? 'light'].text;
    }
  };

  return (
    <TouchableOpacity style={styles.eventCard} onPress={onPress}>
      <View style={styles.eventHeader}>
        <View style={styles.eventTitleRow}>
          <ThemedText style={styles.eventTitle}>{event.title}</ThemedText>
          {event.is_premium && (
            <IconSymbol name="star.fill" size={16} color="#FFD700" />
          )}
          {isEventLive(event) && (
            <View style={styles.liveIndicator}>
              <ThemedText style={styles.liveText}>LIVE</ThemedText>
            </View>
          )}
        </View>
        {event.description && (
          <ThemedText style={styles.eventDescription} numberOfLines={2}>
            {event.description}
          </ThemedText>
        )}
      </View>

      <View style={styles.eventDetails}>
        <View style={styles.eventDetailRow}>
          <IconSymbol name="clock" size={14} color={Colors[colorScheme ?? 'light'].icon} />
          <ThemedText style={styles.eventDetailText}>
            {formatDate(event.start_time)}
          </ThemedText>
        </View>
        
        {event.location_name && (
          <View style={styles.eventDetailRow}>
            <IconSymbol name="location" size={14} color={Colors[colorScheme ?? 'light'].icon} />
            <ThemedText style={styles.eventDetailText} numberOfLines={1}>
              {event.location_name}
            </ThemedText>
          </View>
        )}

        <View style={styles.eventDetailRow}>
          <IconSymbol name="person.2" size={14} color={Colors[colorScheme ?? 'light'].icon} />
          <ThemedText style={styles.eventDetailText}>
            {event.attendee_count} going
            {event.maybe_count > 0 && `, ${event.maybe_count} maybe`}
            {event.friend_attendee_count !== undefined && event.friend_attendee_count > 0 && 
              ` (${event.friend_attendee_count} friends)`}
          </ThemedText>
        </View>
      </View>

      <View style={styles.eventActions}>
        {event.user_rsvp ? (
          <View style={[styles.rsvpStatus, { backgroundColor: getRSVPColor(event.user_rsvp.status) }]}>
            <ThemedText style={styles.rsvpStatusText}>
              You're {event.user_rsvp.status === 'yes' ? 'going' : 
                      event.user_rsvp.status === 'maybe' ? 'maybe going' : 'not going'}
            </ThemedText>
          </View>
        ) : event.can_rsvp ? (
          <View style={styles.rsvpButtons}>
            <TouchableOpacity 
              style={[styles.rsvpButton, { backgroundColor: '#4CAF50' }]}
              onPress={() => onRSVP(event.id, 'yes')}
            >
              <ThemedText style={styles.rsvpButtonText}>Yes</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.rsvpButton, styles.maybeButton]}
              onPress={() => onRSVP(event.id, 'maybe')}
            >
              <ThemedText style={styles.rsvpButtonText}>Maybe</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.rsvpButton, styles.noButton]}
              onPress={() => onRSVP(event.id, 'no')}
            >
              <ThemedText style={styles.rsvpButtonText}>No</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <ThemedText style={styles.cannotRsvpText}>RSVP closed</ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );
};

const EventDetailModal: React.FC<{ event: Event | null; visible: boolean; onClose: () => void; onRSVP: (eventId: number, status: 'yes' | 'maybe' | 'no') => void }> = ({ event, visible, onClose, onRSVP }) => {
  const colorScheme = useColorScheme();
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  
  if (!event) return null;

  // Helper function to check if event is currently live (local timezone)
  const isEventLive = (event: Event): boolean => {
    const now = new Date();
    const startTime = new Date(event.start_time);
    const endTime = new Date(event.end_time);
    return now >= startTime && now <= endTime;
  };

  const formatModalDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    let dateFormat = '';
    if (eventDate.getTime() === today.getTime()) {
      dateFormat = 'Today';
    } else if (eventDate.getTime() === today.getTime() + 86400000) {
      dateFormat = 'Tomorrow';
    } else {
      dateFormat = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    const timeFormat = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateFormat} at ${timeFormat}`;
  };

  const shareEvent = () => {
    Alert.alert(
      'Share Event',
      'How would you like to share this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Copy Link', 
          onPress: () => {
            // In a real app, you'd copy a shareable link
            Alert.alert('Copied!', 'Event link copied to clipboard');
          }
        },
        { 
          text: 'Share to Group', 
          onPress: () => {
            setShowGroupSelector(true);
          }
        },
      ]
    );
  };

  const getRSVPColor = (status: string) => {
    switch (status) {
      case 'yes': return '#4CAF50';
      case 'maybe': return '#FF9800'; 
      case 'no': return '#F44336';
      default: return Colors[colorScheme ?? 'light'].text;
    }
  };

  const GroupSelectorModal = () => {
    const [groups, setGroups] = useState<GroupChat[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (showGroupSelector) {
        loadGroups();
      }
    }, [showGroupSelector]);

    const loadGroups = async () => {
      setLoading(true);
      try {
        const response = await apiClient.getUserGroups();
        if (response.success && response.data?.groups) {
          setGroups(response.data.groups);
        }
      } catch (error) {
        console.error('Failed to load groups:', error);
      } finally {
        setLoading(false);
      }
    };

    const shareToGroup = async (group: GroupChat) => {
      try {
        // Create a special event message with RSVP functionality
        const eventMessage = {
          type: 'event_share',
          event_id: event.id,
          event_title: event.title,
          event_time: formatModalDateTime(event.start_time),
          event_location: event.location_name || 'Location TBD',
          event_description: event.description || 'Join us for an awesome time!',
          shared_by: 'current_user' // This would be the current user's name
        };
        
        const response = await apiClient.sendGroupMessage(group.id, JSON.stringify(eventMessage));
        if (response.success) {
          Alert.alert('Shared!', `Event shared to ${group.name}`);
          setShowGroupSelector(false);
        } else {
          Alert.alert('Error', 'Failed to share event to group');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to share event to group');
      }
    };

    return (
      <Modal
        visible={showGroupSelector}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowGroupSelector(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity 
            style={styles.modalBackdropTouchable} 
            onPress={() => setShowGroupSelector(false)}
            activeOpacity={1}
          />
          
          <View style={[styles.groupSelectorSheet, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
            <View style={styles.bottomSheetHandle} />
            
            <View style={styles.bottomSheetHeader}>
              <ThemedText style={styles.eventModalTitle}>Share to Group</ThemedText>
              <TouchableOpacity onPress={() => setShowGroupSelector(false)} style={styles.closeButton}>
                <IconSymbol name="xmark" size={20} color={Colors[colorScheme ?? 'light'].icon} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.groupSelectorContent} showsVerticalScrollIndicator={false}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={LadColors.primary} />
                  <ThemedText style={styles.loadingText}>Loading groups...</ThemedText>
                </View>
              ) : groups.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <IconSymbol name="person.3" size={64} color={Colors[colorScheme ?? 'light'].icon} />
                  <ThemedText style={styles.emptyTitle}>No Groups</ThemedText>
                  <ThemedText style={styles.emptySubtitle}>
                    You're not in any groups yet. Join or create a group to share events!
                  </ThemedText>
                </View>
              ) : (
                groups.map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    style={styles.groupItem}
                    onPress={() => shareToGroup(group)}
                  >
                    <View style={styles.groupItemLeft}>
                      <View style={styles.groupAvatar}>
                        <IconSymbol name="person.3.fill" size={20} color={LadColors.primary} />
                      </View>
                      <View style={styles.groupItemText}>
                        <ThemedText style={styles.groupName}>{group.name}</ThemedText>
                        <ThemedText style={styles.groupMemberCount}>
                          {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                        </ThemedText>
                      </View>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={Colors[colorScheme ?? 'light'].icon} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <TouchableOpacity 
          style={styles.modalBackdropTouchable} 
          onPress={onClose}
          activeOpacity={1}
        />
        
        <View style={[styles.bottomSheet, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
          {/* Handle bar */}
          <View style={styles.bottomSheetHandle} />
          
          {/* Header with title and close */}
          <View style={styles.bottomSheetHeader}>
            <View style={styles.eventModalTitleContainer}>
              <ThemedText style={styles.eventModalTitle} numberOfLines={2}>{event.title}</ThemedText>
              {event.is_premium && (
                <IconSymbol name="star.fill" size={20} color="#FFD700" />
              )}
              {isEventLive(event) && (
                <View style={styles.liveIndicator}>
                  <ThemedText style={styles.liveText}>LIVE</ThemedText>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <IconSymbol name="xmark" size={20} color={Colors[colorScheme ?? 'light'].icon} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bottomSheetContent} showsVerticalScrollIndicator={false}>
            {event.description && (
              <View style={styles.eventDescriptionContainer}>
                <ThemedText style={styles.eventModalDescription}>{event.description}</ThemedText>
              </View>
            )}
            
            {/* Time and Location Info */}
            <View style={styles.eventInfoGrid}>
              <View style={styles.eventInfoItem}>
                <View style={styles.eventInfoIconContainer}>
                  <IconSymbol name="clock" size={20} color={LadColors.primary} />
                </View>
                <View style={styles.eventInfoTextContainer}>
                  <ThemedText style={styles.eventInfoLabel}>When</ThemedText>
                  <ThemedText style={styles.eventInfoValue}>{formatModalDateTime(event.start_time)}</ThemedText>
                  <ThemedText style={styles.eventInfoSubtext}>Ends {formatModalDateTime(event.end_time)}</ThemedText>
                </View>
              </View>

              {event.location_name && (
                <View style={styles.eventInfoItem}>
                  <View style={styles.eventInfoIconContainer}>
                    <IconSymbol name="location" size={20} color={LadColors.primary} />
                  </View>
                  <View style={styles.eventInfoTextContainer}>
                    <ThemedText style={styles.eventInfoLabel}>Where</ThemedText>
                    <ThemedText style={styles.eventInfoValue}>{event.location_name}</ThemedText>
                  </View>
                </View>
              )}

              <View style={styles.eventInfoItem}>
                <View style={styles.eventInfoIconContainer}>
                  <IconSymbol name="person.2" size={20} color={LadColors.primary} />
                </View>
                <View style={styles.eventInfoTextContainer}>
                  <ThemedText style={styles.eventInfoLabel}>Who's Going</ThemedText>
                  <ThemedText style={styles.eventInfoValue}>
                    {event.attendee_count} confirmed
                    {event.maybe_count > 0 && `, ${event.maybe_count} maybe`}
                  </ThemedText>
                  {event.friend_attendee_count !== undefined && event.friend_attendee_count > 0 && (
                    <ThemedText style={styles.eventInfoSubtext}>
                      {event.friend_attendee_count} of your friends are going
                    </ThemedText>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.bottomSheetActions}>
            <TouchableOpacity 
              style={styles.shareButton}
              onPress={shareEvent}
            >
              <IconSymbol name="square.and.arrow.up" size={16} color={Colors[colorScheme ?? 'light'].text} />
              <ThemedText style={styles.shareButtonText}>Share</ThemedText>
            </TouchableOpacity>

            {/* RSVP Actions */}
            {event.user_rsvp ? (
              <View style={[styles.rsvpStatusLarge, { backgroundColor: getRSVPColor(event.user_rsvp.status) }]}>
                <ThemedText style={styles.rsvpStatusLargeText}>
                  You're {event.user_rsvp.status === 'yes' ? 'Going' : 
                          event.user_rsvp.status === 'maybe' ? 'Maybe Going' : 'Not Going'}
                </ThemedText>
              </View>
            ) : event.can_rsvp ? (
              <View style={styles.rsvpButtonsLarge}>
                <TouchableOpacity 
                  style={[styles.rsvpButtonLarge, styles.yesButtonLarge]}
                  onPress={() => {
                    onRSVP(event.id, 'yes');
                    onClose();
                  }}
                >
                  <IconSymbol name="checkmark" size={16} color="white" />
                  <ThemedText style={styles.rsvpButtonLargeText}>Going</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.rsvpButtonLarge, styles.maybeButtonLarge]}
                  onPress={() => {
                    onRSVP(event.id, 'maybe');
                    onClose();
                  }}
                >
                  <IconSymbol name="questionmark" size={16} color="white" />
                  <ThemedText style={styles.rsvpButtonLargeText}>Maybe</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.rsvpButtonLarge, styles.noButtonLarge]}
                  onPress={() => {
                    onRSVP(event.id, 'no');
                    onClose();
                  }}
                >
                  <IconSymbol name="xmark" size={16} color="white" />
                  <ThemedText style={styles.rsvpButtonLargeText}>Can't Go</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <ThemedText style={styles.cannotRsvpTextLarge}>RSVP is closed for this event</ThemedText>
            )}
          </View>
        </View>
      </View>
       
      <GroupSelectorModal />
    </Modal>
  );
};

export default function EventsScreen() {
  const colorScheme = useColorScheme();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [events, setEvents] = useState<Event[]>([]);
  const [eventRecommendations, setEventRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'friends' | 'public' | 'ongoing' | 'upcoming' | 'my_events'>('all');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Helper function to check if event is currently live (local timezone)
  const isEventLive = (event: Event): boolean => {
    const now = new Date();
    const startTime = new Date(event.start_time);
    const endTime = new Date(event.end_time);
    return now >= startTime && now <= endTime;
  };

  useEffect(() => {
    loadEvents();
    getCurrentLocation();
  }, [activeFilter]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.log('Location error:', error);
    }
  };

  const loadEvents = async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const filters: EventFilters = {
        filter_type: activeFilter,
        sort_by: 'start_time',
        limit: 50,
        offset: 0,
      };

      if (userLocation && (activeFilter === 'public' || activeFilter === 'all')) {
        filters.latitude = userLocation.latitude;
        filters.longitude = userLocation.longitude;
        filters.radius_km = 25; // 25km radius
      }

      const response = await apiClient.getEvents(filters);
      if (response.success && response.data) {
        // Filter out events where user RSVP'd "no"
        const filteredEvents = (response.data.events || []).filter(event => 
          event.user_rsvp?.status !== 'no'
        );
        setEvents(filteredEvents);
      }
    } catch (error) {
      console.error('Failed to load events:', error);
      Alert.alert('Error', 'Failed to load events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRSVP = async (eventId: number, status: 'yes' | 'maybe' | 'no') => {
    try {
      const response = await apiClient.rsvpToEvent(eventId, { status });
      if (response.success) {
        // Update the event in the list
        setEvents(prev => prev.map(event => 
          event.id === eventId 
            ? { 
                ...event, 
                user_rsvp: { status, timestamp: new Date().toISOString() },
                attendee_count: status === 'yes' 
                  ? event.attendee_count + (event.user_rsvp?.status === 'yes' ? 0 : 1)
                  : event.user_rsvp?.status === 'yes' ? event.attendee_count - 1 : event.attendee_count,
                maybe_count: status === 'maybe' 
                  ? event.maybe_count + (event.user_rsvp?.status === 'maybe' ? 0 : 1)
                  : event.user_rsvp?.status === 'maybe' ? event.maybe_count - 1 : event.maybe_count,
              }
            : event
        ));
      } else {
        Alert.alert('Error', response.error || 'Failed to update RSVP');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update RSVP');
    }
  };

  const handleEventPress = (event: Event) => {
    setSelectedEvent(event);
  };

  const generateRecommendations = async () => {
    if (!userLocation) {
      Alert.alert('Location Required', 'Please enable location services to get event recommendations.');
      return;
    }
    setLoadingRecommendations(true);
    try {
      const response = await apiClient.getEventRecommendations(userLocation.latitude, userLocation.longitude);
      if (response.success && response.data?.recommendations) {
        setEventRecommendations(response.data.recommendations);
        if (response.data.recommendations.length === 0) {
          Alert.alert('No Recommendations', 'We couldn\'t find any event recommendations nearby. Try again later!');
        }
      } else {
        Alert.alert('Error', response.error || 'Failed to get recommendations.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred while fetching recommendations.');
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const createEventFromRecommendation = (rec: any) => {
    // TODO: Pre-fill create event modal with recommendation data
    Alert.alert('Create Event', `This will pre-fill the event creation form for: ${rec.title}`);
  };

  const renderFilterTabs = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false} 
      style={styles.filterTabs}
      contentContainerStyle={styles.filterTabsContent}
    >
      {[
        { key: 'all', label: 'All', icon: 'calendar' },
        { key: 'friends', label: 'Friends', icon: 'person.2' },
        { key: 'public', label: 'Public', icon: 'globe' },
        { key: 'ongoing', label: 'Live', icon: 'dot.radiowaves.left.and.right' },
        { key: 'upcoming', label: 'Soon', icon: 'clock' },
        { key: 'my_events', label: 'Mine', icon: 'person.circle' },
      ].map((filter) => (
        <TouchableOpacity
          key={filter.key}
          style={[
            styles.filterTab,
            activeFilter === filter.key && styles.filterTabActive
          ]}
          onPress={() => setActiveFilter(filter.key as any)}
        >
          <IconSymbol 
            name={filter.icon as any} 
            size={12} 
            color={activeFilter === filter.key ? 'white' : Colors[colorScheme ?? 'light'].icon} 
          />
          <ThemedText style={[
            styles.filterTabText,
            activeFilter === filter.key && styles.filterTabTextActive
          ]}>
            {filter.label}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <ThemedText type="title" style={{ color: LadColors.primary }}>Hangouts</ThemedText>
            <ThemedText style={styles.subtitle}>
              Discover and create amazing experiences
            </ThemedText>
          </View>
          <TouchableOpacity 
            style={styles.createButton} 
            onPress={() => setShowCreateModal(true)}
          >
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

      {/* AI Recommendations Section */}
      <View style={styles.recommendationsSection}>
        <View style={styles.recommendationsHeader}>
          <View style={styles.recommendationsTitle}>
            <IconSymbol name="sparkles" size={16} color={LadColors.primary} />
            <ThemedText style={styles.recommendationsText}>
              {LadCopy.HANGOUTS.AI_RECOMMENDATIONS()}
            </ThemedText>
          </View>
          <TouchableOpacity 
            style={styles.generateButton}
            onPress={generateRecommendations}
            disabled={loadingRecommendations}
          >
            {loadingRecommendations ? (
              <ActivityIndicator size="small" color={LadColors.primary} />
            ) : (
              <ThemedText style={styles.generateButtonText}>
                {LadCopy.HANGOUTS.GENERATE()}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
        
        {eventRecommendations.length > 0 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.recommendationsScroll}
          >
            {eventRecommendations.map((rec, index) => (
              <TouchableOpacity
                key={index}
                style={styles.recommendationCard}
                onPress={() => createEventFromRecommendation(rec)}
              >
                <IconSymbol name={rec.icon} size={20} color={LadColors.primary} />
                <ThemedText style={styles.recommendationTitle}>{rec.title}</ThemedText>
                <ThemedText style={styles.recommendationSubtitle}>{rec.description}</ThemedText>
                <View style={styles.recommendationTags}>
                  {rec.tags?.slice(0, 2).map((tag: string, i: number) => (
                    <View key={i} style={styles.recommendationTag}>
                      <ThemedText style={styles.recommendationTagText}>{tag}</ThemedText>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {renderFilterTabs()}

      <View style={styles.content}>
        {viewMode === 'list' ? (
          <FlatList
            data={events}
            renderItem={({ item }) => (
              <EventCard
                event={item}
                onRSVP={handleRSVP}
                onPress={() => handleEventPress(item)}
              />
            )}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadEvents(true)}
                tintColor={Colors[colorScheme ?? 'light'].tint}
              />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.eventsList}
            ListEmptyComponent={
              loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
                  <ThemedText style={styles.loadingText}>Loading events...</ThemedText>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <IconSymbol 
                    name="calendar" 
                    size={64} 
                    color={Colors[colorScheme ?? 'light'].icon} 
                  />
                  <ThemedText style={styles.emptyTitle}>No events found</ThemedText>
                  <ThemedText style={styles.emptySubtitle}>
                    {activeFilter === 'my_events' 
                      ? 'Create your first event to get started!'
                      : 'Try changing your filters or create an event'
                    }
                  </ThemedText>
                </View>
              )
            }
          />
        ) : (
          <ThemedView style={styles.mapView}>
            <IconSymbol 
              name="map" 
              size={64} 
              color={Colors[colorScheme ?? 'light'].icon} 
            />
            <ThemedText style={styles.mapPlaceholder}>
              Map view coming soon!
            </ThemedText>
            <ThemedText style={styles.mapSubtext}>
              Interactive map with event pins and location-based discovery
            </ThemedText>
          </ThemedView>
        )}
      </View>

      <CreateEventModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onEventCreated={() => loadEvents(true)}
      />
      <EventDetailModal
        event={selectedEvent}
        visible={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onRSVP={handleRSVP}
      />
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
    paddingBottom: 15,
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
    backgroundColor: LadColors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 22,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
    gap: 6,
  },
  activeToggle: {
    backgroundColor: LadColors.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeToggleText: {
    color: 'white',
  },
  filterTabs: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    maxHeight: 40,
  },
  filterTabsContent: {
    gap: 6,
    paddingVertical: 4,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    gap: 3,
    minWidth: 45,
    justifyContent: 'center',
    height: 28,
  },
  filterTabActive: {
    backgroundColor: LadColors.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
  },
  eventsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  eventCard: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  eventHeader: {
    marginBottom: 12,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  liveIndicator: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  eventDescription: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
  },
  eventDetails: {
    gap: 8,
    marginBottom: 16,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventDetailText: {
    fontSize: 14,
    flex: 1,
  },
  eventActions: {
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
    borderRadius: 18,
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
  cannotRsvpText: {
    fontSize: 14,
    opacity: 0.5,
    fontStyle: 'italic',
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.7,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    opacity: 0.6,
    lineHeight: 20,
    paddingHorizontal: 40,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailModalContainer: {
    width: '90%',
    maxHeight: '60%',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  detailModalContent: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalCancel: {
    fontSize: 16,
    color: Colors.light.icon,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
    textAlign: 'center',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: LadColors.primary,
  },
  modalSaveDisabled: {
    opacity: 0.5,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalDescription: {
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 24,
  },
  modalSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
    gap: 12,
  },
  modalDetailTextContainer: {
    flex: 1,
  },
  modalDetailLabel: {
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.8,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  formSubtext: {
    fontSize: 14,
    opacity: 0.6,
  },
  formInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  formTextArea: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  locationNote: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
    fontStyle: 'italic',
  },
  visibilityOptions: {
    gap: 8,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  visibilityOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  visibilityOptionText: {
    fontSize: 16,
  },
  visibilityOptionTextSelected: {
    color: 'white',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  premiumNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  premiumText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  recommendationsSection: {
    paddingBottom: 15,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  recommendationsTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recommendationsText: {
    fontSize: 16,
    fontWeight: '600',
  },
  generateButton: {
    // Add styles if needed
  },
  generateButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  recommendationsScroll: {
    paddingLeft: 20,
  },
  recommendationCard: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    padding: 12,
    width: 150,
    marginRight: 12,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  recommendationSubtitle: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
    height: 30,
  },
  recommendationTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  recommendationTag: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recommendationTagText: {
    fontSize: 10,
  },
  // New dropdown time picker styles
  timePickerContainer: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  dropdownRow: {
    gap: 8,
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.8,
  },
  dropdownButtonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dropdownButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    minWidth: 60,
    alignItems: 'center',
  },
  dropdownButtonActive: {
    backgroundColor: LadColors.primary,
  },
  dropdownButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownButtonTextActive: {
    color: 'white',
  },
  durationButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    minWidth: 40,
    alignItems: 'center',
  },
  timeInputRow: {
    flexDirection: 'row',
    gap: 16,
  },
  timeInputSection: {
    flex: 1,
  },
  timePickerLabel: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
    marginBottom: 8,
  },
  timeTextInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 16,
  },
  timeSeparator: {
    fontSize: 16,
    fontWeight: '500',
    marginHorizontal: 8,
  },
  ampmContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  ampmButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    minWidth: 40,
    alignItems: 'center',
  },
  ampmButtonActive: {
    backgroundColor: LadColors.primary,
  },
  ampmButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  ampmButtonTextActive: {
    color: 'white',
  },
  timeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  timeSummaryText: {
    fontSize: 14,
    fontWeight: '500',
    color: LadColors.primary,
  },
  // Bottom sheet modal styles
  modalBackdropTouchable: {
    flex: 1,
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    maxHeight: '80%',
    minHeight: '50%',
  },
  bottomSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  eventModalTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 16,
  },
  eventModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    flex: 1,
    lineHeight: 28,
  },
  closeButton: {
    padding: 4,
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  eventDescriptionContainer: {
    marginBottom: 24,
  },
  eventModalDescription: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
  eventInfoGrid: {
    gap: 20,
  },
  eventInfoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  eventInfoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventInfoTextContainer: {
    flex: 1,
  },
  eventInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.7,
  },
  eventInfoValue: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  eventInfoSubtext: {
    fontSize: 14,
    opacity: 0.6,
  },
  bottomSheetActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    minWidth: 80,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  rsvpStatusLarge: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rsvpStatusLargeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  rsvpButtonsLarge: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  rsvpButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  yesButtonLarge: {
    backgroundColor: '#4CAF50',
  },
  maybeButtonLarge: {
    backgroundColor: '#FF9800',
  },
  noButtonLarge: {
    backgroundColor: '#F44336',
  },
  rsvpButtonLargeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  cannotRsvpTextLarge: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.6,
    fontStyle: 'italic',
    paddingVertical: 16,
  },
  // Group selector styles
  groupSelectorSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    maxHeight: '85%',
    minHeight: '60%',
    width: '100%',
  },
  groupSelectorContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    marginBottom: 8,
  },
  groupItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupItemText: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  groupMemberCount: {
    fontSize: 13,
    opacity: 0.7,
  },
}); 