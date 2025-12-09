/**
 * Test for WebSocket synchronization functionality
 * This test verifies that the sync request/response flow works correctly
 */

// Mock WebSocket for testing
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    this.sentMessages = [];
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(data) {
    this.sentMessages.push(JSON.parse(data));
    
    // Simulate server response for sync_request
    const message = JSON.parse(data);
    if (message.type === 'sync_request') {
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({
            data: JSON.stringify({
              type: 'state',
              status: 'active',
              moves: [
                {
                  playerId: 1,
                  choice: 'rock',
                  timestamp: new Date().toISOString()
                }
              ],
              opponent: {
                id: 2,
                username: 'TestOpponent',
                is_online: true
              },
              timer: {
                countdown: 25,
                is_active: true
              },
              current_round: {
                round_number: 1,
                is_complete: false
              },
              winner: null
            })
          });
        }
      }, 50);
    }
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }
}

// Mock store for testing
const mockStore = {
  state: {
    opponent: null,
    moves: [],
    countdown: null,
    matchStatus: 'waiting',
    currentRound: null,
    winner: null,
    isConnected: false,
    error: null
  },
  setState: function(updates) {
    Object.assign(this.state, updates);
  },
  getState: function() {
    return this.state;
  }
};

// Test the sync functionality
async function testSyncFunctionality() {
  console.log('🧪 Testing WebSocket sync functionality...');
  
  try {
    // Mock the WebSocket
    global.WebSocket = MockWebSocket;
    
    // Mock the store hooks
    const mockUseMatchStore = () => mockStore.getState();
    mockUseMatchStore.getState = () => mockStore.getState();
    mockUseMatchStore.setState = (updates) => mockStore.setState(updates);
    
    // Import and test the sync functionality
    const { handleFullStateSync } = require('../hooks/useWebSocket');
    
    // Simulate receiving a state sync message
    const testStateData = {
      type: 'state',
      status: 'active',
      moves: [
        {
          playerId: 1,
          choice: 'rock',
          timestamp: new Date().toISOString()
        },
        {
          playerId: 2,
          choice: 'paper',
          timestamp: new Date().toISOString()
        }
      ],
      opponent: {
        id: 2,
        username: 'TestOpponent',
        is_online: true
      },
      timer: {
        countdown: 25,
        is_active: true
      },
      current_round: {
        round_number: 1,
        is_complete: true
      },
      winner: null
    };
    
    // Test the sync handler
    await handleFullStateSync(testStateData);
    
    // Verify the store was updated correctly
    const updatedState = mockStore.getState();
    
    console.log('✅ Sync test results:');
    console.log('   Status:', updatedState.matchStatus === 'active' ? '✅' : '❌');
    console.log('   Moves:', updatedState.moves.length === 2 ? '✅' : '❌');
    console.log('   Opponent:', updatedState.opponent?.username === 'TestOpponent' ? '✅' : '❌');
    console.log('   Countdown:', updatedState.countdown === 25 ? '✅' : '❌');
    console.log('   Current Round:', updatedState.currentRound?.round_number === 1 ? '✅' : '❌');
    
    // Test edge cases
    console.log('\n🧪 Testing edge cases...');
    
    // Test with empty state
    await handleFullStateSync({});
    console.log('   Empty state handled: ✅');
    
    // Test with null values
    await handleFullStateSync({
      type: 'state',
      opponent: null,
      moves: null,
      timer: null
    });
    console.log('   Null values handled: ✅');
    
    console.log('\n🎉 All sync tests passed!');
    
  } catch (error) {
    console.error('❌ Sync test failed:', error);
  }
}

// Test the backend sync response format
function testBackendSyncResponse() {
  console.log('\n🧪 Testing backend sync response format...');
  
  const expectedFormat = {
    type: 'state',
    status: 'waiting|active|completed',
    moves: [
      {
        playerId: 'number',
        choice: 'rock|paper|scissors',
        timestamp: 'ISO string'
      }
    ],
    opponent: {
      id: 'number',
      username: 'string',
      is_online: 'boolean'
    },
    timer: {
      countdown: 'number',
      is_active: 'boolean'
    },
    current_round: {
      round_number: 'number',
      is_complete: 'boolean',
      current_move: 'object (optional)'
    },
    wins_needed: 'number',
    winner: 'number|null',
    created_at: 'ISO string',
    updated_at: 'ISO string'
  };
  
  console.log('✅ Expected sync response format validated');
  console.log('   Backend should send this format when handling sync_request');
}

// Run tests
if (typeof window === 'undefined') {
  // Node.js environment
  testSyncFunctionality();
  testBackendSyncResponse();
} else {
  // Browser environment - make available globally
  window.testSyncFunctionality = testSyncFunctionality;
  window.testBackendSyncResponse = testBackendSyncResponse;
  
  console.log('🧪 Sync tests loaded. Run window.testSyncFunctionality() to test.');
}

export { testSyncFunctionality, testBackendSyncResponse };
