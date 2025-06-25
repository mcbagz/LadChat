import requests
import json

def test_api():
    """
    Simple test script to verify FastAPI endpoints
    """
    base_url = "http://localhost:8000"
    
    print("Testing LadChat API...")
    print("=" * 40)
    
    try:
        # Test root endpoint
        print("1. Testing root endpoint...")
        response = requests.get(f"{base_url}/")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        print()
        
        # Test health endpoint
        print("2. Testing health endpoint...")
        response = requests.get(f"{base_url}/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        print()
        
        # Test docs endpoint (should return HTML)
        print("3. Testing docs endpoint...")
        response = requests.get(f"{base_url}/docs")
        print(f"Status: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type')}")
        print()
        
        print("✅ All tests passed! FastAPI server is working correctly.")
        
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to the server. Make sure it's running on port 8000.")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_api() 