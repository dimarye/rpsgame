# Error Handling & Edge Cases

This document describes the comprehensive error handling and edge case management implemented for the Rock Paper Scissors game.

## Overview

The error handling system provides a robust user experience by gracefully handling all types of errors, timeouts, and edge cases that can occur during gameplay.

## Error Handling Architecture

### Component Structure

```
ErrorBoundary (React Error Boundary)
├── NetworkStatus (Network Monitoring)
├── MatchPage (Main Game Logic)
│   ├── WebSocket Hook (Connection Management)
│   ├── Zustand Store (State Management)
│   └── MatchLayout (UI Components)
└── Toast Notifications (User Feedback)
```

## 1. Connection Management

### Disconnect Handling

**Scenario**: WebSocket connection is lost

**User Experience**:
- Immediate toast notification: `"Connection lost... reconnecting"`
- Loading toast with reconnection attempts: `"Reconnecting... (1/5)"`
- Automatic reconnection with exponential backoff
- Success notification on reconnect: `"Reconnected successfully!"`
- Full state synchronization after reconnect

**Implementation**:
```javascript
ws.current.onclose = (event) => {
  toast.dismiss(); // Clear existing toasts
  toast.error('Connection lost... reconnecting');
  
  // Attempt reconnection with exponential backoff
  if (reconnectAttempts.current < maxReconnectAttempts) {
    toast.loading(`Reconnecting... (${reconnectAttempts.current + 1}/${maxReconnectAttempts})`, {
      id: 'reconnect-toast'
    });
  }
};
```

### Reconnect Success

**Scenario**: WebSocket successfully reconnects

**User Experience**:
- Clear loading toast
- Success notification: `"Reconnected successfully!"`
- Automatic state synchronization
- Seamless gameplay continuation

**Implementation**:
```javascript
ws.current.onopen = () => {
  if (isReconnect) {
    toast.dismiss(); // Clear loading toast
    toast.success('Reconnected successfully!');
    sendJson({ type: 'sync_request' }); // Sync state
  }
};
```

## 2. Server Error Handling

### Server Errors

**Scenario**: Server returns an error message

**User Experience**:
- Clear error toast with server message
- Error state stored in store
- UI reflects error state appropriately

**Implementation**:
```javascript
case 'error':
  const errorMessage = data.payload?.message || 'An error occurred';
  setError(errorMessage);
  toast.dismiss();
  toast.error(errorMessage);
  break;
```

### Authentication Errors

**Scenario**: JWT token expired or invalid

**User Experience**:
- Specific error message: `"Session expired. Please log in again."`
- No reconnection attempts (requires user action)
- Redirect to login page

**Implementation**:
```javascript
if (event.code === 4001) {
  toast.error('Session expired. Please log in again.');
  return; // Don't attempt reconnection
}
```

## 3. Timeout Management

### Move Timeout

**Scenario**: Player doesn't make a move within time limit

**User Experience**:
- Warning toast: `"Time's up! Round ended."` with ⏰ icon
- Move buttons immediately disabled
- Visual timeout indicator on buttons
- Clear status message: `"Round ended due to timeout"`
- Server notification of timeout

**Implementation**:
```javascript
case 'timeout':
  toast.warning('Time\'s up! Round ended.', {
    duration: 3000,
    icon: '⏰'
  });
  
  // Block buttons via store state
  const { setTimeoutOccurred } = useMatchStore.getState();
  setTimeoutOccurred(true);
  break;
```

### Button Blocking

**MoveSelector Component Updates**:
- Added `timeoutOccurred` to disabled conditions
- Visual timeout overlay on buttons
- Status message updates
- Timeout indicator banner

**Implementation**:
```javascript
const isDisabled = !isPlayerTurn || hasCurrentPlayerMoved || !isConnected || timeoutOccurred;

// Timeout overlay
{timeoutOccurred && !hasCurrentPlayerMoved && (
  <motion.div className="absolute inset-0 bg-gray-900 bg-opacity-60 rounded-xl">
    <span className="text-white font-semibold">Timeout</span>
  </motion.div>
)}
```

## 4. Opponent Management

### Opponent Left

**Scenario**: Opponent disconnects from match

**User Experience**:
- Info toast with 👋 icon: `"Opponent left the match"`
- Opponent info cleared from UI
- Game state updated appropriately
- 4-second duration for visibility

**Implementation**:
```javascript
case 'opponent_left':
  toast.info('Opponent left the match', {
    duration: 4000,
    icon: '👋'
  });
  setOpponent(null);
  break;
```

## 5. Network Monitoring

### Internet Connection

**NetworkStatus Component**:
- Monitors online/offline status
- Shows appropriate warnings
- Updates store error state
- Handles connection changes

**Offline Warning**:
```javascript
{showOfflineWarning && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <h3>No Internet Connection</h3>
    <p>Please check your internet connection.</p>
  </div>
)}
```

**Connection Unstable**:
```javascript
{!isOnline && !showOfflineWarning && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg">
    <h3>Connection Unstable</h3>
    <p>Your internet connection is unstable.</p>
  </div>
)}
```

## 6. React Error Boundaries

### ErrorBoundary Component

**Purpose**: Catch React component errors and provide graceful fallback

**Features**:
- User-friendly error interface
- Try again functionality
- Page refresh option
- Development mode error details
- Automatic error logging

**Implementation**:
```javascript
componentDidCatch(error, errorInfo) {
  console.error('Error Boundary caught an error:', error, errorInfo);
  toast.error('Something went wrong. Please refresh the page.');
}
```

## 7. Store State Management

### Error State

**Zustand Store Enhancements**:
- `error` field for general errors
- `timeoutOccurred` for timeout tracking
- `isConnected` for connection status
- `matchStatus` for game state

**Timeout Integration**:
```javascript
isPlayerTurn: () => {
  const { moves, playerId, timeoutOccurred } = get();
  return currentRoundMoves.length < 2 && 
         !currentRoundMoves.some(move => move.playerId === playerId) &&
         !timeoutOccurred; // Block turns after timeout
}
```

## 8. Toast Notification System

### Toast Types and Usage

**Success Messages**:
- `"Reconnected successfully!"` - Connection restored
- `"Game state synchronized"` - Manual sync success

**Error Messages**:
- `"Connection lost... reconnecting"` - Disconnect
- Server errors with specific messages
- `"Session expired. Please log in again."` - Auth errors

**Warning Messages**:
- `"Time's up! Round ended."` - Timeout
- Network instability warnings

**Info Messages**:
- `"Opponent left the match"` - Opponent disconnect

### Toast Configuration

**Standard Settings**:
- Auto-dismiss after appropriate duration
- Icons for visual context
- Dismissible for user control
- Non-intrusive positioning

## 9. Edge Cases Handled

### Connection Scenarios

1. **Initial Connection Failure**
   - Error toast with authentication message
   - Redirect to login if needed

2. **Mid-Game Disconnect**
   - Auto-reconnection with backoff
   - State sync on reconnect
   - Seamless gameplay resume

3. **Network Fluctuation**
   - Real-time network monitoring
   - Visual status indicators
   - Graceful degradation

### Game State Scenarios

1. **Timeout During Turn**
   - Immediate button blocking
   - Clear timeout notification
   - Server synchronization

2. **Opponent Disconnect**
   - Clear opponent info
   - Info notification
   - Game state cleanup

3. **Server Errors**
   - Clear error messages
   - State consistency
   - User guidance

### Browser Scenarios

1. **Page Refresh**
   - Automatic state recovery
   - WebSocket reconnection
   - Full game state restoration

2. **Browser Close/Tab Close**
   - Clean connection closure
   - Server notification
   - State preservation

3. **React Component Errors**
   - Error boundary catches
   - User-friendly fallback
   - Recovery options

## 10. Testing Scenarios

### Manual Testing Checklist

**Connection Testing**:
- [ ] Disconnect network during game
- [ ] Verify reconnection flow
- [ ] Test state synchronization
- [ ] Verify toast notifications

**Timeout Testing**:
- [ ] Wait for timeout during turn
- [ ] Verify button blocking
- [ ] Check timeout notification
- [ ] Test next round functionality

**Error Testing**:
- [ ] Trigger server errors
- [ ] Test authentication failures
- [ ] Verify error boundary
- [ ] Check error recovery

**Network Testing**:
- [ ] Test offline mode
- [ ] Simulate unstable connection
- [ ] Verify network status UI
- [ ] Test reconnection scenarios

### Automated Testing

**Error Boundary Tests**:
```javascript
// Test error boundary functionality
const ErrorBoundary = require('../components/ErrorBoundary');
// Simulate component errors
// Verify fallback UI
// Test recovery mechanisms
```

**Toast Notification Tests**:
```javascript
// Test toast appearance/dismissal
// Verify toast content
// Test toast duration
// Check toast interactions
```

## 11. Performance Considerations

### Memory Management

- Clean up WebSocket connections on unmount
- Remove event listeners properly
- Clear timeouts and intervals
- Reset state appropriately

### Network Efficiency

- Debounce reconnection attempts
- Batch state updates
- Optimize toast notifications
- Minimize unnecessary renders

### User Experience

- Fast error feedback
- Clear recovery paths
- Minimal disruption
- Consistent behavior

## 12. Future Enhancements

### Advanced Error Recovery

- Automatic retry with exponential backoff
- Smart reconnection strategies
- Predictive error handling
- Graceful degradation modes

### Enhanced Monitoring

- Error analytics and reporting
- Performance metrics
- User behavior tracking
- Proactive error detection

### Improved UX

- Progressive loading states
- Animated error transitions
- Contextual help messages
- Smart error suggestions

## 13. Troubleshooting

### Common Issues

**Reconnection Not Working**:
- Check WebSocket URL configuration
- Verify authentication tokens
- Test network connectivity
- Check server availability

**Timeout Not Triggering**:
- Verify countdown logic
- Check timer state management
- Test timeout message sending
- Verify button blocking logic

**Toast Not Showing**:
- Check toast configuration
- Verify toast import
- Test toast positioning
- Check for toast conflicts

### Debug Tools

**Browser Console**:
- WebSocket connection logs
- Error boundary logs
- Network status logs
- State management logs

**React DevTools**:
- Component state inspection
- Error boundary testing
- Props debugging
- Store state verification

## 14. Best Practices

### Error Handling Principles

1. **Fail Gracefully**: Never crash the application
2. **Inform Users**: Always provide clear feedback
3. **Provide Recovery**: Offer ways to continue
4. **Log Everything**: Track errors for debugging
5. **Test Thoroughly**: Cover all edge cases

### Code Organization

- Separate error handling logic
- Centralize error state management
- Use consistent error patterns
- Document error scenarios
- Maintain error handling tests

### User Experience

- Fast error detection
- Clear error messages
- Consistent error UI
- Minimal disruption
- Easy recovery paths

This comprehensive error handling system ensures a robust, user-friendly experience that gracefully handles all types of errors, timeouts, and edge cases during gameplay.
