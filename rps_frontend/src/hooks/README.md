# WebSocket Hook Documentation

## useMatchWebSocket

A robust WebSocket hook for real-time match communication with automatic reconnection, heartbeat, and direct Zustand integration.

## Features

- **Automatic Connection**: Connects to `ws://HOST/ws/match/${matchId}/?token=JWT`
- **Heartbeat**: Sends ping every 25 seconds to maintain connection
- **Auto-Reconnect**: Exponential backoff reconnection with max 5 attempts
- **Zustand Integration**: Directly updates match store state
- **Message Handling**: Comprehensive message type processing
- **Error Handling**: Graceful error handling with toast notifications

## Usage

```javascript
import useMatchWebSocket from '../hooks/useMatchWebSocket';

const MyComponent = () => {
  const { sendJson, disconnect, forceReconnect } = useMatchWebSocket(matchId);
  
  const handleMove = (choice) => {
    sendJson({
      type: 'move',
      payload: { choice }
    });
  };
  
  return (
    <button onClick={() => handleMove('rock')}>Play Rock</button>
  );
};
```

## Message Types

### Incoming Messages

The hook automatically handles these message types and updates the Zustand store:

#### `pong`

- **Purpose**: Heartbeat response
- **Action**: Logs receipt, no state change

#### `join`

- **Purpose**: Player joined the match
- **Payload**: `{ player: { id, username } }`
- **Action**: Updates opponent in store, shows success toast

#### `move`

- **Purpose**: Player made a move
- **Payload**: `{ move: { playerId, choice, timestamp } }`
- **Action**: Adds move to store

#### `state`

- **Purpose**: Match state update
- **Payload**: `{ countdown?, opponent? }`
- **Action**: Updates countdown and opponent in store

#### `result`

- **Purpose**: Round result
- **Payload**: `{ result: { winner, result, player1_id?, player2_id? } }`
- **Action**: Updates round result in store, shows result toast

#### `opponent_left`

- **Purpose**: Opponent left the match
- **Action**: Clears opponent, shows error toast

#### `error`

- **Purpose**: Server error
- **Payload**: `{ message: string }`
- **Action**: Sets error in store, shows error toast

#### `timeout`

- **Purpose**: Move timeout
- **Action**: Shows warning toast

### Outgoing Messages

Use `sendJson()` to send these message types:

#### `move`

```javascript
sendJson({
  type: 'move',
  payload: {
    choice: 'rock' | 'paper' | 'scissors'
  }
});
```

#### `ping` (Automatic)

- Sent automatically every 25 seconds as heartbeat

## API

### Return Values

```javascript
const {
  sendJson,      // Function to send JSON messages
  disconnect,    // Function to manually disconnect
  forceReconnect // Function to force reconnection
} = useMatchWebSocket(matchId);
```

### Parameters

- **matchId** (string): The match ID to connect to

## Connection Lifecycle

1. **Initialization**: Hook connects when `matchId` is provided
2. **Authentication**: Uses JWT token from localStorage
3. **Connection**: Establishes WebSocket connection
4. **Heartbeat**: Starts 25-second ping interval
5. **Message Handling**: Processes incoming messages
6. **Reconnection**: Auto-reconnects on disconnection
7. **Cleanup**: Cleans up on unmount

## Error Handling

### Connection Errors
- Shows toast notifications
- Updates error state in store
- Attempts reconnection with exponential backoff

### Token Exiration
- Handles close code 4001
- Shows session expired toast
- Prevents reconnection attempts

### Message Parsing Errors
- Logs parsing errors
- Sets error state in store

## Integration with Zustand

The hook directly calls Zustand store methods:

```javascript
// Store methods called by hook
setConnectionStatus(true/false);
setError(message);
setOpponent(player);
addMove(move);
setResult(result);
setCountdown(seconds);
```

## Best Practices

1. **Token Management**: Ensure valid JWT token in localStorage
2. **Match ID**: Provide valid match ID as string
3. **Error Handling**: Monitor error state in store
4. **Connection Status**: Use `isConnected` from store for UI state
5. **Cleanup**: Hook automatically cleans up on unmount

## Example Implementation

See `WebSocketTest.jsx` for a complete working example.

## Troubleshooting

### Connection Issues
1. Check JWT token validity
2. Verify match ID format
3. Check WebSocket server status
4. Monitor browser console for errors

### Message Issues
1. Verify message format
2. Check payload structure
3. Monitor server logs
4. Use browser dev tools for WebSocket inspection

### Performance Issues
1. Monitor reconnection attempts
2. Check heartbeat frequency
3. Verify message processing efficiency
4. Monitor store update frequency
