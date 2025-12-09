# Client-Server State Synchronization

This document describes the implementation of client-server state synchronization for the Rock Paper Scissors game.

## Overview

The synchronization feature ensures that clients can recover the complete game state after reconnection, page refresh, or connection loss. This provides a seamless experience and maintains game continuity.

## Architecture

### Flow Diagram

```text
Client (reconnect) → Server → Client (state rebuild)
     │                     │
 sync_request          │
     │                     ▼
     │              handle_sync_request()
     │                     │
     │              send_full_state()
     │                     │
     │                     ▼
     │              { type: "state", ... }
     │                     │
     └─────────────────────┘
               │
               ▼
        handleFullStateSync()
               │
               ▼
        Zustand store update
               │
               ▼
           UI rebuild
```

## Implementation Details

### 1. Backend Changes

#### New Message Type: `sync_request`

```javascript
// Client sends
{
  "type": "sync_request"
}
```

#### New Handler: `handle_sync_request`

Located in `game/consumers.py`, this handler:

- Validates the match exists
- Gathers comprehensive game state
- Sends complete state response

#### New Response: `state`

```javascript
// Server responds with
{
  "type": "state",
  "status": "waiting|active|completed",
  "moves": [
    {
      "playerId": 123,
      "choice": "rock",
      "timestamp": "2023-12-01T10:30:00Z"
    }
  ],
  "opponent": {
    "id": 456,
    "username": "OpponentName",
    "is_online": true
  },
  "timer": {
    "countdown": 30,
    "is_active": true
  },
  "current_round": {
    "round_number": 1,
    "is_complete": false,
    "current_move": {
      "playerId": 123,
      "choice": "rock",
      "timestamp": "2023-12-01T10:30:00Z"
    }
  },
  "wins_needed": 3,
  "winner": null,
  "created_at": "2023-12-01T10:00:00Z",
  "updated_at": "2023-12-01T10:30:00Z"
}
```

### 2. Frontend Changes

#### WebSocket Hook Updates

**Automatic Sync on Reconnect:**

```javascript
ws.current.onopen = () => {
  const isReconnect = reconnectAttempts.current > 0;
  
  // Request full state sync on reconnect (but not initial connect)
  if (isReconnect) {
    sendJson({ type: 'sync_request' });
  }
};
```

**New Message Handler:**

```javascript
case 'state':
  // Full state synchronization response
  await handleFullStateSync(data);
  break;
```

**State Sync Handler:**

```javascript
const handleFullStateSync = async (stateData) => {
  // Update all store properties from server state
  if (stateData.opponent) setOpponent(stateData.opponent);
  if (stateData.moves) setMoves(stateData.moves);
  if (stateData.timer?.countdown) setCountdown(stateData.timer.countdown);
  if (stateData.status) setMatchStatus(stateData.status);
  if (stateData.current_round) setCurrentRound(stateData.current_round);
  if (stateData.winner !== undefined) setWinner(stateData.winner);
};
```

#### Zustand Store Enhancements

**New State Properties:**

```javascript
matchStatus: 'waiting', // waiting, active, completed
currentRound: null,
winner: null,
```

**New Actions:**

```javascript
setMoves: (moves) => set({ moves }),
setMatchStatus: (matchStatus) => set({ matchStatus }),
setCurrentRound: (currentRound) => set({ currentRound }),
setWinner: (winner) => set({ winner }),
```

#### UI Components

**Sync Button:**

Added manual sync button in MatchLayout header:

```javascript
<button onClick={requestSync} disabled={!isConnected}>
  🔄 Sync
</button>
```

## Usage Scenarios

### 1. Page Refresh

1. User refreshes page
2. WebSocket connects (initial connection)
3. MatchPage initializes with matchId
4. Server sends initial state via `send_match_state()`
5. Client rebuilds UI from received state

### 2. Connection Loss & Reconnect

1. WebSocket disconnects
2. Client attempts reconnection with exponential backoff
3. On successful reconnect:
   - Client detects this is a reconnect (not initial)
   - Automatically sends `sync_request`
   - Server responds with full state
   - Client rebuilds UI from received state

### 3. Manual Sync

1. User clicks "🔄 Sync" button
2. Client sends `sync_request`
3. Server responds with current state
4. Client updates UI

## Error Handling

### Client Side

- **Connection Error**: Shows toast "Cannot sync - connection lost"
- **Parse Error**: Logs error and shows "Failed to sync game state"
- **Invalid State**: Gracefully handles missing/invalid fields

### Server Side

- **Match Not Found**: Sends error message to client
- **Database Errors**: Logs error and sends error response
- **Permission Issues**: Validates user belongs to match

## Testing

### Automated Tests

Located in `src/__tests__/sync.test.js`:

```javascript
// Test sync functionality
testSyncFunctionality();

// Test backend response format
testBackendSyncResponse();
```

### Manual Testing

1. **Reconnect Test**:
   - Start a match
   - Make some moves
   - Disconnect network
   - Reconnect - should restore full state

2. **Page Refresh Test**:
   - Start a match
   - Make some moves
   - Refresh page
   - Should see complete game state

3. **Manual Sync Test**:
   - Click sync button
   - Should see "Game state synchronized" toast

## Performance Considerations

### State Size

- Full state includes all moves history
- For long matches, consider pagination or limiting move history
- Current implementation suitable for typical match lengths (10-20 rounds)

### Network Efficiency

- Sync only sent on reconnect, not continuously
- State is sent as single JSON message
- Consider compression for large move histories

### Memory Usage

- Client stores complete move history in Zustand
- Consider cleanup for very long matches
- Monitor memory usage in production

## Security Considerations

### Data Validation

- Server validates all data before sending
- Client validates received state structure
- Sanitize any user-generated content

### Access Control

- Users can only sync matches they belong to
- JWT authentication required for sync requests
- Server validates user permissions

## Future Enhancements

### Optimistic Sync

- Send incremental updates instead of full state
- Include version numbers for conflict detection
- Implement delta synchronization

### Sync Persistence

- Store last sync timestamp
- Resume from last known good state
- Handle partial sync failures

### Real-time Indicators

- Show sync progress indicator
- Display last sync time
- Highlight sync conflicts

## Troubleshooting

### Common Issues

**Sync not working after reconnect:**

- Check WebSocket connection status
- Verify server is handling `sync_request`
- Check browser console for errors

**Missing moves in history:**

- Verify server is sending complete moves array
- Check client `setMoves` function
- Validate move data format

**Opponent not showing:**

- Check opponent data structure
- Verify `setOpponent` is called
- Check UI component rendering

### Debug Logging

Enable debug logging:

```javascript
// Client side
console.log('[WebSocket] Sync request sent');
console.log('[WebSocket] State received:', data);

// Server side
print(f"[WebSocket] Sync request for match {match.id}")
print(f"[WebSocket] Full state: {state}")
```

### Monitoring

Monitor sync success rates:

- Track sync request/response pairs
- Measure sync latency
- Monitor error rates by type

## API Reference

### Client Messages

#### sync_request

```javascript
{
  "type": "sync_request"
}
```

### Server Responses

#### state

```javascript
{
  "type": "state",
  "status": "waiting|active|completed",
  "moves": Move[],
  "opponent": Opponent|null,
  "timer": Timer,
  "current_round": CurrentRound|null,
  "wins_needed": number,
  "winner": number|null,
  "created_at": string,
  "updated_at": string
}
```

#### error

```javascript
{
  "type": "error",
  "message": "Error description"
}
```

### Type Definitions

```typescript
interface Move {
  playerId: number;
  choice: 'rock' | 'paper' | 'scissors';
  timestamp: string; // ISO 8601
}

interface Opponent {
  id: number;
  username: string;
  is_online: boolean;
}

interface Timer {
  countdown: number;
  is_active: boolean;
}

interface CurrentRound {
  round_number: number;
  is_complete: boolean;
  current_move?: Move;
}
```
