#!/usr/bin/env python3
"""
Comprehensive test for LadChat events and RSVP functionality
Tests both mcbagz and mattyb with proper event limits and friendship RSVP
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

def get_all_events(token, user_key):
    """Get all visible events for a user"""
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{API_BASE}/events", headers=headers)
    if response.status_code == 200:
        data = response.json()
        events = data.get('events', [])
        print(f"📅 {user_key} can see {len(events)} total events")
        return events
    else:
        print(f"❌ {user_key} failed to get events: {response.text}")
        return []

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
        print(f"   Counts: Attending: {counts.get('attendee_count', 0)}, Maybe: {counts.get('maybe_count', 0)}")
        return rsvps, counts
    else:
        print(f"❌ {user_key} failed to get RSVPs for event {event_id}: {response.text}")
        return [], {}

def main():
    """Main test function"""
    print("🔥 LadChat Events & RSVP Testing")
    print("=" * 60)
    
    # Login both users
    print("\n1. 🔐 User Login")
    tokens = {}
    for user_key in USERS.keys():
        tokens[user_key] = login_user(user_key)
        if not tokens[user_key]:
            print(f"❌ Cannot proceed without {user_key} token")
            return
    
    # Check current event status
    print("\n2. 📋 Current Event Status")
    user_events = {}
    for user_key, token in tokens.items():
        my_events, can_create = get_my_active_events(token, user_key)
        user_events[user_key] = my_events
        
        # If mcbagz has too many events, delete one to make room for testing
        if user_key == "mcbagz" and not can_create and len(my_events) >= 3:
            print(f"🗑️ {user_key} has max events, deleting one for testing...")
            oldest_event = min(my_events, key=lambda x: x.get('created_at', ''))
            delete_event(token, user_key, oldest_event['id'])
    
    # Get all visible events before testing
    print("\n3. 📅 Event Visibility Before RSVP")
    for user_key, token in tokens.items():
        events = get_all_events(token, user_key)
    
    # Test RSVP functionality
    print("\n4. 🎪 RSVP Testing")
    
    # Find an event that mcbagz created and mattyb can RSVP to
    mcbagz_events = user_events.get("mcbagz", [])
    if mcbagz_events:
        test_event = mcbagz_events[0]  # Use first event
        event_id = test_event['id']
        event_title = test_event['title']
        
        print(f"Testing RSVP on mcbagz's event: {event_title} (ID: {event_id})")
        
        # mattyb RSVPs to mcbagz's event
        success = rsvp_to_event(tokens["mattyb"], "mattyb", event_id, "yes", "Excited to attend!")
        
        if success:
            # Check RSVPs from creator's perspective (mcbagz)
            print(f"\n📊 Checking RSVPs as event creator (mcbagz):")
            rsvps, counts = get_event_rsvps(tokens["mcbagz"], "mcbagz", event_id)
            
            if rsvps:
                for rsvp in rsvps:
                    username = rsvp.get('username', 'Unknown')
                    status = rsvp.get('status', 'no status')
                    comment = rsvp.get('comment', 'no comment')
                    is_friend = rsvp.get('is_friend', False)
                    print(f"   - {username}: {status} (friend: {is_friend}) - {comment}")
            
            # Check RSVPs from non-creator's perspective (mattyb)
            print(f"\n📊 Checking RSVPs as non-creator (mattyb):")
            rsvps_mattyb, counts_mattyb = get_event_rsvps(tokens["mattyb"], "mattyb", event_id)
            print(f"   mattyb sees {len(rsvps_mattyb)} detailed RSVPs (should be 0 - only counts)")
        
        # Test different RSVP statuses
        print(f"\n🔄 Testing RSVP status changes...")
        rsvp_to_event(tokens["mattyb"], "mattyb", event_id, "maybe", "Actually not sure now...")
        rsvp_to_event(tokens["mattyb"], "mattyb", event_id, "no", "Can't make it after all")
        rsvp_to_event(tokens["mattyb"], "mattyb", event_id, "yes", "Changed my mind - I'll be there!")
        
        # Final RSVP check
        print(f"\n📊 Final RSVP status:")
        rsvps, counts = get_event_rsvps(tokens["mcbagz"], "mcbagz", event_id)
    else:
        print("❌ No events from mcbagz to test RSVP")
    
    # Test event creation (should work now)
    print("\n5. 🎉 Event Creation Test")
    new_event = create_event(tokens["mcbagz"], "mcbagz", " - After Cleanup")
    if new_event:
        print("✅ Event creation works after cleanup!")
    
    print("\n🎊 Testing completed!")

if __name__ == "__main__":
    main() 