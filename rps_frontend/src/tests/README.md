# WebSocket Integration Tests

This directory contains comprehensive integration tests for the Rock Paper Scissors WebSocket communication and match functionality.

## Test Structure

```
src/tests/
├── setup.js                    # Test setup and global utilities
├── websocket-utils.js          # WebSocket testing utilities
├── integration/
│   ├── websocket-match.test.js # Core WebSocket communication tests
│   ├── useWebSocket.test.js    # WebSocket hook integration tests
│   └── match-scenarios.test.js # End-to-end match scenario tests
└── README.md                   # This file
```

## Running Tests

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Integration Tests Only
```bash
npm run test:integration
```

### Run Tests with UI
```bash
npm run test:ui
```

### Watch Mode
```bash
npm run test:watch
```

## Test Coverage

### 1. WebSocket Communication Tests (`websocket-match.test.js`)

**Basic Move Communication:**
- ✅ Player A makes move → Player B sees instantly
- ✅ Player B makes move → server determines result → both see result
- ✅ Draw scenario works correctly

**Disconnect/Reconnect Scenarios:**
- ✅ Disconnect A → B receives opponent_left
- ✅ Reconnect A → state is restored
- ✅ Reconnect during active game preserves gameplay

**Timeout Scenarios:**
- ✅ Timeout → server sends result
- ✅ Both players timeout → draw result
- ✅ Timeout after normal move works correctly

**Synchronization Scenarios:**
- ✅ Sync request returns current match state
- ✅ Multiple rounds state sync works correctly

**Error Scenarios:**
- ✅ Invalid message type is handled gracefully
- ✅ Malformed JSON is handled gracefully
- ✅ Move without match is ignored

**Concurrent Operations:**
- ✅ Multiple simultaneous moves are handled correctly
- ✅ Rapid reconnect/disconnect works correctly

### 2. WebSocket Hook Tests (`useWebSocket.test.js`)

**Connection Management:**
- ✅ Connects successfully with valid match ID
- ✅ Handles connection success
- ✅ Handles connection loss
- ✅ Attempts reconnection on disconnect

**Message Handling:**
- ✅ Handles move messages correctly
- ✅ Handles result messages correctly
- ✅ Handles opponent_left messages correctly
- ✅ Handles timeout messages correctly
- ✅ Handles error messages correctly
- ✅ Handles state synchronization correctly

**Message Sending:**
- ✅ Sends move messages correctly
- ✅ Sends sync request correctly
- ✅ Handles sending when disconnected

**Reconnection Behavior:**
- ✅ Requests sync on reconnect
- ✅ Does not request sync on initial connection

**Error Handling:**
- ✅ Handles malformed messages gracefully
- ✅ Handles unknown message types gracefully
- ✅ Handles WebSocket errors gracefully

**Cleanup:**
- ✅ Cleans up connection on unmount
- ✅ Clears timeouts on unmount

### 3. Match Scenario Tests (`match-scenarios.test.js`)

**Complete Match Flow:**
- ✅ Complete match from start to finish
- ✅ Match with timeout scenarios

**Real-world Scenarios:**
- ✅ Player disconnects during match and reconnects
- ✅ Multiple rapid disconnections and reconnections
- ✅ Network instability simulation

**Edge Cases:**
- ✅ Both players disconnect simultaneously
- ✅ Player disconnects while opponent is making move
- ✅ Match with all possible move combinations

**Performance and Stress Tests:**
- ✅ Rapid successive moves
- ✅ Large number of sync requests

**Concurrent Operations:**
- ✅ Multiple matches running simultaneously

## Test Utilities

### WebSocketTestClient
Mock WebSocket client for testing:
```javascript
const client = new WebSocketTestClient({
  playerId: 1,
  matchId: 'test-match',
  token: 'test-token'
});
```

### TestServerSimulator
Simulates server behavior:
```javascript
const server = new TestServerSimulator();
server.registerClient(clientId, wsClient);
server.sendToClient(clientId, message);
```

### WebSocketIntegrationTester
High-level integration testing:
```javascript
const tester = new WebSocketIntegrationTester();
const playerA = tester.createClient(1);
const playerB = tester.createClient(2);
tester.createMatch('match-1', 1, 2);
tester.connectClients(1, 2);
```

## Test Scenarios

### Required Test Scenarios

All the required test scenarios from the task are covered:

1. **Player A makes ход → Player B видит мгновенно**
   - Test: `Player A makes move → Player B sees instantly`
   - Location: `websocket-match.test.js`

2. **Player B makes ход → сервер определяет результат → оба видят**
   - Test: `Player B makes move → server determines result → both see result`
   - Location: `websocket-match.test.js`

3. **Disconnect A → B получает opponent_left**
   - Test: `Disconnect A → B receives opponent_left`
   - Location: `websocket-match.test.js`

4. **Reconnect A → состояние восстанавливается**
   - Test: `Reconnect A → state is restored`
   - Location: `websocket-match.test.js`

5. **Таймаут → сервер присылает result**
   - Test: `Timeout → server sends result`
   - Location: `websocket-match.test.js`

## Mock Implementation

### WebSocket Mock
```javascript
global.WebSocket = vi.fn(() => ({
  close: vi.fn(),
  send: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: WebSocket.OPEN
}));
```

### Toast Mock
```javascript
vi.mock('react-hot-toast', () => ({
  default: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn()
}));
```

### React Router Mock
```javascript
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'test-match-id' }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>
}));
```

## Testing Best Practices

### 1. Isolation
Each test runs in isolation with proper cleanup:
```javascript
beforeEach(() => {
  tester = new WebSocketIntegrationTester();
});

afterEach(() => {
  tester.cleanup();
});
```

### 2. Async Handling
Proper async/await for WebSocket operations:
```javascript
const moveMessage = await tester.waitForMessage(2, 'move');
expect(moveMessage.payload.move.choice).toBe('rock');
```

### 3. Message Verification
Verify message structure and content:
```javascript
expect(result.payload.result).toEqual({
  winner: 2,
  result: 'win',
  player1_id: 1,
  player2_id: 2,
  moves: [/* ... */],
  round_number: 1
});
```

### 4. State Verification
Verify store state changes:
```javascript
const { moves, isConnected } = useMatchStore.getState();
expect(moves).toHaveLength(1);
expect(isConnected).toBe(true);
```

## Performance Considerations

### 1. Test Execution Time
- Use proper timeouts for async operations
- Avoid unnecessary delays
- Run tests in parallel where possible

### 2. Memory Management
- Clean up WebSocket connections
- Clear message history between tests
- Reset store state

### 3. Mock Efficiency
- Use lightweight mocks
- Avoid unnecessary DOM operations
- Minimize setup overhead

## Troubleshooting

### Common Issues

**Tests timing out:**
- Check WebSocket mock implementation
- Verify message handler setup
- Ensure proper async/await usage

**State not updating:**
- Verify store mock setup
- Check state update timing
- Ensure proper React testing utilities usage

**WebSocket connection issues:**
- Verify WebSocket mock
- Check event handler registration
- Ensure proper connection simulation

### Debug Tools

**Console logging:**
```javascript
console.log('WebSocket message:', message);
console.log('Store state:', useMatchStore.getState());
```

**Test debugging:**
```javascript
// Add debugging to test utilities
global.debugWebSocket = (client) => {
  console.log('Client messages:', client.messages);
  console.log('Client state:', client.ws.readyState);
};
```

## Continuous Integration

### GitHub Actions Example
```yaml
- name: Run Integration Tests
  run: |
    npm run test:integration
    npm run test:coverage
```

### Coverage Requirements
- Minimum 90% coverage for WebSocket code
- All critical paths tested
- Error scenarios covered

## Future Enhancements

### 1. Browser Integration Tests
- Add Playwright or Cypress tests
- Test real WebSocket connections
- Verify UI integration

### 2. Load Testing
- Test with many concurrent clients
- Measure performance under load
- Test server scalability

### 3. Network Simulation
- Test with real network conditions
- Simulate latency and packet loss
- Test mobile network scenarios

### 4. Cross-browser Testing
- Test WebSocket compatibility
- Verify behavior across browsers
- Test mobile browsers

## Conclusion

This comprehensive test suite ensures that all WebSocket communication and match functionality works correctly across all scenarios. The tests cover:

- ✅ All required scenarios from the task
- ✅ Edge cases and error conditions
- ✅ Performance and stress scenarios
- ✅ Real-world usage patterns
- ✅ Proper cleanup and isolation

The test framework provides a solid foundation for maintaining and extending the WebSocket functionality while ensuring reliability and correctness.
