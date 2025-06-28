import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Event } from '@/services/api';

interface EventCardProps {
  event: Event;
  onRSVP: (eventId: number, status: 'yes' | 'maybe' | 'no') => void;
  onPress: () => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, onRSVP, onPress }) => {
  const colorScheme = useColorScheme();

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
          {event.is_ongoing && (
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
              style={[styles.rsvpButton, styles.yesButton]}
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

export default EventCard;


const styles = StyleSheet.create({
    eventCard: {
      backgroundColor: 'rgba(0,0,0,0.02)',
      borderRadius: 16,
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
    cannotRsvpText: {
      fontSize: 14,
      opacity: 0.5,
      fontStyle: 'italic',
    },
  }); 