#!/usr/bin/env python3
"""
Simple API endpoint tests for LadChat
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_endpoint(method, endpoint, data=None, headers=None):
    """Test an API endpoint"""
    url = f"{BASE_URL}{endpoint}"
    
    if headers is None:
        headers = {}
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, params=data)
        elif method == "POST":
            headers["Content-Type"] = "application/json"
            response = requests.post(url, headers=headers, json=data)
        
        return {
            "status_code": response.status_code,
            "success": response.status_code < 400,
            "response": response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text[:200]
        }
        
    except requests.exceptions.ConnectionError:
        return {"error": "Connection failed - is the server running?"}
    except Exception as e:
        return {"error": str(e)}

def get_auth_token():
    """Get authentication token"""
    result = test_endpoint("POST", "/auth/login", {
        "username": "testuser",
        "password": "testpass"
    })
    
    if result.get("success") and isinstance(result.get("response"), dict):
        return result["response"].get("access_token")
    return None

def main():
    """Run API endpoint tests"""
    print("🧪 Testing API Endpoints")
    print("Health:", test_endpoint("GET", "/health"))
    print("Events:", test_endpoint("GET", "/events/"))
    print("Done!")

if __name__ == "__main__":
    main() 