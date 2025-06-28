#!/usr/bin/env python3
"""
Comprehensive test script for LadChat events and RSVP functionality
Tests with two users: mcbagz and mattyb
"""

import requests
import json
from datetime import datetime, timedelta, timezone

# API Configuration
API_BASE = "http://localhost:8000"
USERS = {
    "mcbagz": {"username": "mcbagz", "password": "Simius66"},
    "mattyb": {"username": "mattyb", "password": "Simius66"}
}
LATITUDE = 42.3542
LONGITUDE = -83.3571

def login_user(user_key):
    """Login a user and return auth token"""
    user_data = USERS[user_key]
    
    response = requests.post(f"{API_BASE}/auth/login", json=user_data)
    if response.status_code == 200:
        token = response.json().get('access_token')
        print(f"✅ {user_key} logged in successfully")
        return token
    else:
        print(f"❌ {user_key} login failed: {response.text}")
        return None

def get_user_events(token, user_key, filter_type="all"):
    """Get events for a user"""
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "filter_type": filter_type,
        "latitude": LATITUDE,
        "longitude": LONGITUDE
    }
    
    response = requests.get(f"{API_BASE}/events", headers=headers, params=params)
    if response.status_code == 200:
        data = response.json()
        events = data.get('events', [])
        print(f"📅 {user_key} can see {len(events)} events ({filter_type})")
        return events
    else:
        print(f"❌ {user_key} failed to get events: {response.text}")
        return []

def get_my_active_events(token, user_key):
    """Get user's own active events"""
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{API_BASE}/events/my/active", headers=headers)
    if response.status_code == 200:
        data = response.json()
        events = data.get('events', [])
        can_create_more = data.get('can_create_more', False)
        print(f"🏠 {user_key} has {len(events)} active events (can create more: {can_create_more})")
        return events, can_create_more
    else:
        print(f"❌ {user_key} failed to get own events: {response.text}")
        return [], False

def delete_event(token, user_key, event_id):
    """Delete an event"""
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.delete(f"{API_BASE}/events/{event_id}", headers=headers)
    if response.status_code == 200:
        print(f"🗑️ {user_key} deleted event {event_id}")
        return True
    else:
        print(f"❌ {user_key} failed to delete event {event_id}: {response.text}")
        return False

def create_event(token, user_key, title_suffix=""):
    """Create a test event"""
    headers = {"Authorization": f"Bearer {token}"}
    
    now = datetime.now(timezone.utc)
    start_time = now + timedelta(hours=2)
    end_time = start_time + timedelta(hours=2)
    
    event_data = {
        "title": f"Test Event by {user_key}{title_suffix}",
        "description": f"Test event created by {user_key} for testing purposes",
        "location_name": f"Test Location at {LATITUDE}, {LONGITUDE}",
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "creator_latitude": LATITUDE,
        "creator_longitude": LONGITUDE,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "visibility": "friends"
    }
    
    response = requests.post(f"{API_BASE}/events", headers=headers, json=event_data)
    if response.status_code == 200:
        event = response.json()
        print(f"🎉 {user_key} created event: {event.get('title')} (ID: {event.get('id')})")
        return event
    else:
        print(f"❌ {user_key} failed to create event: {response.text}")
        return None

def rsvp_to_event(token, user_key, event_id, status="yes", comment=None):
    """RSVP to an event"""
    headers = {"Authorization": f"Bearer {token}"}
    
    rsvp_data = {
        "status": status,
        "comment": comment
    }
    
    response = requests.post(f"{API_BASE}/events/{event_id}/rsvp", headers=headers, json=rsvp_data)
    if response.status_code == 200:
        print(f"✅ {user_key} RSVP'd '{status}' to event {event_id}" + (f" with comment: '{comment}'" if comment else ""))
        return True
    else:
        print(f"❌ {user_key} failed to RSVP to event {event_id}: {response.text}")
        return False

def get_event_rsvps(token, user_key, event_id):
    """Get event RSVPs"""
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{API_BASE}/events/{event_id}/rsvps", headers=headers)
    if response.status_code == 200:
        data = response.json()
        rsvps = data.get('rsvps', [])
        counts = data.get('counts', {})
        print(f"📊 {user_key} sees {len(rsvps)} detailed RSVPs for event {event_id}")
        print(f"   Counts: {counts}")
        return rsvps, counts
    else:
        print(f"❌ {user_key} failed to get RSVPs for event {event_id}: {response.text}")
        return [], {}

def test_friendship_creation(token1, user1_key, token2, user2_key):
    """Test creating friendship between users"""
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}
    
    # User1 sends friend request to User2
    friend_request = {"recipient_username": USERS[user2_key]["username"]}
    response = requests.post(f"{API_BASE}/friends/request", headers=headers1, json=friend_request)
    
    if response.status_code == 200:
        print(f"✅ {user1_key} sent friend request to {user2_key}")
        
        # User2 accepts the request
        # First get pending requests
        response = requests.get(f"{API_BASE}/friends/requests/received", headers=headers2)
        if response.status_code == 200:
            requests_data = response.json()
            pending_requests = requests_data.get('requests', [])
            
            for req in pending_requests:
                if req.get('sender', {}).get('username') == USERS[user1_key]["username"]:
                    # Accept this request
                    accept_data = {"action": "accept"}
                    response = requests.put(f"{API_BASE}/friends/requests/{req['id']}", headers=headers2, json=accept_data)
                    if response.status_code == 200:
                        print(f"✅ {user2_key} accepted friend request from {user1_key}")
                        return True
                    else:
                        print(f"❌ {user2_key} failed to accept friend request: {response.text}")
                        return False
        
        print(f"⚠️ No pending friend request found from {user1_key} to {user2_key}")
        return False
    else:
        print(f"❌ {user1_key} failed to send friend request: {response.text}")
        return False

def main():
    """Main test function"""
    print("🔥 LadChat Events & RSVP Comprehensive Test")
    print("=" * 60)
    
    # Login both users
    print("\n1. 🔐 User Login")
    tokens = {}
    for user_key in USERS.keys():
        tokens[user_key] = login_user(user_key)
        if not tokens[user_key]:
            print(f"❌ Cannot proceed without {user_key} token")
            return
    
    # Check friendship status and create if needed
    print("\n2. 👥 Friendship Setup")
    test_friendship_creation(tokens["mcbagz"], "mcbagz", tokens["mattyb"], "mattyb")
    
    # Check existing events and active event limits
    print("\n3. 📋 Current Event Status")
    for user_key, token in tokens.items():
        my_events, can_create = get_my_active_events(token, user_key)
        
        # If user has max events, delete one to make room for testing
        if not can_create and len(my_events) >= 3:
            print(f"🗑️ {user_key} has max events, deleting oldest for testing...")
            oldest_event = min(my_events, key=lambda x: x.get('created_at', ''))
            delete_event(token, user_key, oldest_event['id'])
    
    # Create test events
    print("\n4. 🎉 Event Creation")
    created_events = {}
    for user_key, token in tokens.items():
        event = create_event(token, user_key, f" #{len(created_events)+1}")
        if event:
            created_events[user_key] = event
    
    # Test event visibility
    print("\n5. 👀 Event Visibility")
    for user_key, token in tokens.items():
        visible_events = get_user_events(token, user_key, "friends")
        print(f"   {user_key} can see events from: {[e.get('creator_id') for e in visible_events]}")
    
    # Test RSVP functionality
    print("\n6. 🎪 RSVP Testing")
    if len(created_events) >= 2:
        # Each user RSVPs to the other's event
        user_keys = list(created_events.keys())
        for i, user_key in enumerate(user_keys):
            other_user = user_keys[1-i]  # Get the other user
            other_event = created_events[other_user]
            
            # RSVP with different statuses
            rsvp_status = ["yes", "maybe"][i]
            comment = f"RSVP from {user_key} - looking forward to it!"
            
            success = rsvp_to_event(tokens[user_key], user_key, other_event['id'], rsvp_status, comment)
            
            if success:
                # Check RSVPs from event creator's perspective
                rsvps, counts = get_event_rsvps(tokens[other_user], other_user, other_event['id'])
    
    # Test event details
    print("\n7. 📊 Event Details & RSVPs")
    for user_key, event in created_events.items():
        print(f"\n📅 Event by {user_key}: {event.get('title')}")
        rsvps, counts = get_event_rsvps(tokens[user_key], user_key, event['id'])
        
        for rsvp in rsvps:
            print(f"   - {rsvp.get('username', 'Unknown')}: {rsvp.get('status')} ({rsvp.get('comment', 'no comment')})")
    
    print("\n🎊 Test completed!")
    print(f"Created {len(created_events)} events, tested visibility and RSVP functionality")

if __name__ == "__main__":
    main() 