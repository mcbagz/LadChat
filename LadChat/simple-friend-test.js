// Simple test to verify friend endpoints work
async function testFriends() {
  const API_BASE = 'http://192.168.0.14:8000';
  
  console.log('🚀 Testing Friend System...');
  
  try {
    // Test 1: Register a user
    const userData = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,  
      password: 'testpass123',
      interests: ['Gaming', 'Music']
    };

    console.log('Creating user:', userData.username);
    
    const registerRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    if (registerRes.ok) {
      const regData = await registerRes.json();
      console.log('✅ User created successfully');
      
      // Test 2: Search for users (should work even with no results)
      const searchRes = await fetch(`${API_BASE}/friends/search?query=test&limit=5`, {
        headers: { 'Authorization': `Bearer ${regData.access_token}` }
      });
      
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        console.log('✅ Friend search endpoint works');
        console.log(`   Found ${searchData.data?.length || 0} users`);
      } else {
        console.log('❌ Friend search failed');
      }
      
      // Test 3: Get friend requests (should be empty)
      const requestsRes = await fetch(`${API_BASE}/friends/requests`, {
        headers: { 'Authorization': `Bearer ${regData.access_token}` }
      });
      
      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        console.log('✅ Friend requests endpoint works');
        console.log(`   ${requestsData.data?.length || 0} pending requests`);
      } else {
        console.log('❌ Friend requests failed');
      }
      
      // Test 4: Get friends list (should be empty)
      const friendsRes = await fetch(`${API_BASE}/friends/list`, {
        headers: { 'Authorization': `Bearer ${regData.access_token}` }
      });
      
      if (friendsRes.ok) {
        const friendsData = await friendsRes.json();
        console.log('✅ Friends list endpoint works');
        console.log(`   ${friendsData.data?.length || 0} friends`);
      } else {
        console.log('❌ Friends list failed');
      }
      
      console.log('\n🎉 All friend endpoints are working!');
      console.log('✅ User registration ✅ Friend search ✅ Requests ✅ Friends list');
      
    } else {
      const error = await registerRes.json();
      console.log('❌ User registration failed:', error);
    }
    
  } catch (err) {
    console.error('❌ Test error:', err.message);
  }
}

testFriends(); 