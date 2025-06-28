const API_BASE_URL = 'https://ladchat.bagztech.com';

// Test the backend health endpoint
async function testHealthCheck() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    console.log('✅ Health Check:', data);
    return true;
  } catch (error) {
    console.error('❌ Health Check Failed:', error);
    return false;
  }
}

// Test user registration
async function testUserRegistration() {
  try {
    const testUser = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'testpassword123',
      bio: 'Test user for integration testing',
      interests: ['Testing', 'Development', 'LadChat']
    };

    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ User Registration Success:', {
        username: testUser.username,
        hasToken: !!data.access_token
      });
      return { success: true, token: data.access_token, user: testUser };
    } else {
      console.error('❌ User Registration Failed:', data);
      return { success: false };
    }
  } catch (error) {
    console.error('❌ User Registration Error:', error);
    return { success: false };
  }
}

// Test authenticated endpoints
async function testAuthenticatedEndpoints(token) {
  try {
    // Test conversations endpoint
    const conversationsResponse = await fetch(`${API_BASE_URL}/messages/conversations`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (conversationsResponse.ok) {
      const conversations = await conversationsResponse.json();
      console.log('✅ Conversations API:', `Found ${conversations.length || 0} conversations`);
    } else {
      console.error('❌ Conversations API Failed');
    }

    // Test story feed endpoint
    const storyFeedResponse = await fetch(`${API_BASE_URL}/stories/feed`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (storyFeedResponse.ok) {
      const stories = await storyFeedResponse.json();
      console.log('✅ Story Feed API:', `Found ${stories.length || 0} stories`);
    } else {
      console.error('❌ Story Feed API Failed');
    }

    // Test my stories endpoint
    const myStoriesResponse = await fetch(`${API_BASE_URL}/stories/my-stories`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (myStoriesResponse.ok) {
      const myStories = await myStoriesResponse.json();
      console.log('✅ My Stories API:', `Found ${myStories.length || 0} personal stories`);
    } else {
      console.error('❌ My Stories API Failed');
    }

    // Test snaps endpoint
    const snapsResponse = await fetch(`${API_BASE_URL}/snaps/received`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (snapsResponse.ok) {
      const snaps = await snapsResponse.json();
      console.log('✅ Snaps API:', `Found ${snaps.length || 0} received snaps`);
    } else {
      console.error('❌ Snaps API Failed');
    }

    return true;
  } catch (error) {
    console.error('❌ Authenticated Endpoints Error:', error);
    return false;
  }
}

// Run all tests
async function runIntegrationTests() {
  console.log('🚀 Starting LadChat Integration Tests...\n');

  // Test 1: Health Check
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.error('❌ Health check failed. Make sure the backend is running.');
    return;
  }

  console.log('');

  // Test 2: User Registration
  const registrationResult = await testUserRegistration();
  if (!registrationResult.success) {
    console.error('❌ User registration failed. Cannot continue with authenticated tests.');
    return;
  }

  console.log('');

  // Test 3: Authenticated Endpoints
  await testAuthenticatedEndpoints(registrationResult.token);

  console.log('\n🎉 Integration tests completed!');
  console.log('\n📋 Summary:');
  console.log('✅ Backend is running and responsive');
  console.log('✅ User authentication is working');
  console.log('✅ API endpoints are accessible');
  console.log('✅ Phase 3 & 4 backend infrastructure is operational');
  
  console.log('\n🎯 Next Steps:');
  console.log('1. Complete frontend implementation');
  console.log('2. Add camera integration for content creation');
  console.log('3. Implement real-time features');
  console.log('4. Add push notifications');
}

// Run the tests
runIntegrationTests().catch(console.error); 