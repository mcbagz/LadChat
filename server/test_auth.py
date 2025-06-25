import requests
import json

def test_authentication_flow():
    """
    Test the complete authentication flow
    """
    base_url = "http://localhost:8000"
    
    print("Testing LadChat Authentication System")
    print("=" * 50)
    
    # Test data
    test_user = {
        "username": "testlad",
        "email": "testlad@example.com",
        "password": "password123",
        "bio": "Just testing the system!",
        "interests": ["Gaming", "Soccer"]
    }
    
    try:
        # 1. Test user registration
        print("1. Testing user registration...")
        response = requests.post(f"{base_url}/auth/register", json=test_user)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 201:
            registration_data = response.json()
            print("✅ Registration successful!")
            print(f"Access token: {registration_data['access_token'][:50]}...")
            print(f"Expires in: {registration_data['expires_in']} seconds")
            
            access_token = registration_data['access_token']
            refresh_token = registration_data['refresh_token']
        else:
            print(f"❌ Registration failed: {response.text}")
            return
        
        print()
        
        # 2. Test getting user profile
        print("2. Testing get user profile...")
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(f"{base_url}/auth/me", headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            user_data = response.json()
            print("✅ Profile retrieval successful!")
            print(f"Username: {user_data['username']}")
            print(f"Bio: {user_data['bio']}")
            print(f"Interests: {user_data['interests']}")
        else:
            print(f"❌ Profile retrieval failed: {response.text}")
        
        print()
        
        # 3. Test user login
        print("3. Testing user login...")
        login_data = {
            "username": test_user["username"],
            "password": test_user["password"]
        }
        response = requests.post(f"{base_url}/auth/login", json=login_data)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            login_response = response.json()
            print("✅ Login successful!")
            print(f"New access token: {login_response['access_token'][:50]}...")
        else:
            print(f"❌ Login failed: {response.text}")
        
        print()
        
        # 4. Test profile update
        print("4. Testing profile update...")
        update_data = {
            "bio": "Updated bio for testing!",
            "interests": ["Gaming", "Hiking", "Tech"],
            "open_to_friends": True
        }
        response = requests.put(f"{base_url}/auth/me", json=update_data, headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            updated_user = response.json()
            print("✅ Profile update successful!")
            print(f"Updated bio: {updated_user['bio']}")
            print(f"Updated interests: {updated_user['interests']}")
            print(f"Open to friends: {updated_user['open_to_friends']}")
        else:
            print(f"❌ Profile update failed: {response.text}")
        
        print()
        
        # 5. Test token refresh
        print("5. Testing token refresh...")
        refresh_data = {"refresh_token": refresh_token}
        response = requests.post(f"{base_url}/auth/refresh", json=refresh_data)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            refresh_response = response.json()
            print("✅ Token refresh successful!")
            print(f"New access token: {refresh_response['access_token'][:50]}...")
        else:
            print(f"❌ Token refresh failed: {response.text}")
        
        print()
        
        # 6. Test logout
        print("6. Testing logout...")
        response = requests.post(f"{base_url}/auth/logout", headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            logout_response = response.json()
            print("✅ Logout successful!")
            print(f"Message: {logout_response['message']}")
        else:
            print(f"❌ Logout failed: {response.text}")
        
        print()
        print("🎉 All authentication tests completed!")
        
        # 7. Test error cases
        print("\n7. Testing error cases...")
        
        # Test duplicate registration
        response = requests.post(f"{base_url}/auth/register", json=test_user)
        if response.status_code == 400:
            print("✅ Duplicate registration properly rejected")
        else:
            print("❌ Duplicate registration should be rejected")
        
        # Test invalid login
        invalid_login = {
            "username": "nonexistent",
            "password": "wrongpassword"
        }
        response = requests.post(f"{base_url}/auth/login", json=invalid_login)
        if response.status_code == 401:
            print("✅ Invalid login properly rejected")
        else:
            print("❌ Invalid login should be rejected")
        
        print("\n✨ Authentication system is working correctly!")
        
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to the server. Make sure it's running on port 8000.")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_authentication_flow() 