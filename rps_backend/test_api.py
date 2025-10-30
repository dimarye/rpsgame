import requests
import json

BASE_URL = 'http://127.0.0.1:8000/api/'

def test_register():
    url = f"{BASE_URL}auth/register/"
    data = {
        'username': 'testuser',
        'email': 'test@example.com',
        'password': 'StrongPass123',
        'display_name': 'Test User',
        'avatar': 'https://example.com/avatar.png'
    }
    response = requests.post(url, json=data)
    print("Test Register:")
    print(f"Status Code: {response.status_code}")
    print("Response:", json.dumps(response.json(), indent=2))
    return response.json()

def test_token():
    url = f"{BASE_URL}auth/token/"
    data = {
        'username': 'testuser',
        'password': 'StrongPass123'
    }
    response = requests.post(url, json=data)
    print("\nTest Token:")
    print(f"Status Code: {response.status_code}")
    print("Response:", json.dumps(response.json(), indent=2))
    return response.json()

def test_user_me(token):
    url = f"{BASE_URL}users/me/"
    headers = {
        'Authorization': f'Bearer {token}'
    }
    response = requests.get(url, headers=headers)
    print("\nTest User Me:")
    print(f"Status Code: {response.status_code}")
    print("Response:", json.dumps(response.json(), indent=2))

if __name__ == "__main__":
    # Test registration
    user_data = test_register()
    
    # Test token
    token_data = test_token()
    
    # Test authenticated endpoint
    if 'access' in token_data:
        test_user_me(token_data['access'])
    else:
        print("\nFailed to get access token, skipping user/me test")
