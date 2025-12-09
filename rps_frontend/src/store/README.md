# Match State Store (Zustand)

This directory contains the centralized state management for match functionality using Zustand.

## Files

- `useMatchStore.js` - Main Zustand store for match state
- `README.md` - This documentation

## Store Structure

### State Properties

```javascript
{
  matchId: null,           // Current match ID
  playerId: null,          // Current player ID
  opponent: null,          // Opponent info {id, username}
  moves: [],              // All moves in current round
  roundResult: null,      // Current round result
  isConnected: false,      // WebSocket connection status
  error: null,           // Current error message
  countdown: null,        // Countdown timer value
  roundNumber: 1,         // Current round number
}
```

### Store Methods

#### Core Actions

- `initMatch(matchId, playerId)` - Initialize a new match
- `setOpponent(opponent)` - Set opponent information
- `addMove(move)` - Add a move to current round
- `setResult(result)` - Set round result
- `resetRound()` - Reset current round state
- `setConnectionStatus(isConnected)` - Update WebSocket connection status
- `setError(error)` - Set error message
- `setCountdown(countdown)` - Set countdown timer
- `incrementRound()` - Move to next round
- `reset()` - Reset entire store

#### Computed Values

- `getCurrentRoundMoves()` - Get last 2 moves for current round
- `isPlayerTurn()` - Check if it's current player's turn

## Usage Examples

### Basic Usage in Components

```javascript
import useMatchStore from '../store/useMatchStore';

const MyComponent = () => {
  const { matchId, opponent, isConnected } = useMatchStore();
  
  return (
    <div>
      <p>Match: {matchId}</p>
      <p>Opponent: {opponent?.username}</p>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
    </div>
  );
};
```

### Using Actions

```javascript
import { useMatchActions } from '../hooks/useMatchActions';

const MyComponent = () => {
  const { initMatch, setOpponent, addMove } = useMatchActions();
  
  const handleStartMatch = () => {
    initMatch('match-123', 'player-456');
    setOpponent({ id: 'player-789', username: 'Opponent123' });
  };
  
  const handleMakeMove = (choice) => {
    addMove({
      playerId: 'player-456',
      choice,
      timestamp: new Date().toISOString(),
    });
  };
  
  return <button onClick={handleStartMatch}>Start Match</button>;
};
```

### Integration with WebSocket

```javascript
import useMatchStore from '../store/useMatchStore';
import useWebSocket from '../hooks/useWebSocket';

const MatchComponent = () => {
  const { setConnectionStatus, addMove, setResult } = useMatchStore();
  
  const onMessage = (data) => {
    switch (data.type) {
      case 'move':
        addMove(data.payload);
        break;
      case 'round_result':
        setResult(data.payload);
        break;
      case 'connection':
        setConnectionStatus(data.payload.connected);
        break;
    }
  };
  
  useWebSocket(matchId, onMessage);
  
  // ... rest of component
};
```

## Data Flow

1. **Match Initialization**: Call `initMatch(matchId, playerId)` when entering a match
2. **Opponent Join**: Call `setOpponent(opponentInfo)` when opponent joins
3. **Game Play**: Call `addMove(move)` for each player move
4. **Round Results**: Call `setResult(result)` when round completes
5. **Connection**: Call `setConnectionStatus(true/false)` for WebSocket status
6. **Next Round**: Call `resetRound()` then `incrementRound()` for new round

## Best Practices

1. **Use the hook wrapper**: Prefer `useMatchActions()` for actions to get memoized functions
2. **Computed values**: Use computed values like `isPlayerTurn()` instead of manual calculations
3. **Error handling**: Always set error messages via `setError()` for consistent error state
4. **Connection status**: Keep connection status in sync with WebSocket state
5. **Round management**: Use `resetRound()` and `incrementRound()` together for proper round transitions

## Integration Points

### MatchPage Integration

```javascript
// In MatchPage.jsx
import useMatchStore from '../store/useMatchStore';

const MatchPage = () => {
  const { matchId, playerId, opponent, moves, roundResult } = useMatchStore();
  const { initMatch, setOpponent, addMove, setResult } = useMatchActions();
  
  useEffect(() => {
    // Initialize match when component mounts
    if (matchId && user) {
      initMatch(matchId, user.id);
    }
  }, [matchId, user]);
  
  // WebSocket message handling
  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'opponent_joined':
        setOpponent(data.payload);
        break;
      case 'move_made':
        addMove(data.payload);
        break;
      case 'round_complete':
        setResult(data.payload);
        break;
    }
  };
  
  // ... rest of component
};
```

### Game Component Integration

```javascript
// In GameBoard component
import useMatchStore from '../store/useMatchStore';

const GameBoard = () => {
  const { moves, isPlayerTurn } = useMatchStore();
  const { addMove } = useMatchActions();
  
  const handleChoiceSelect = (choice) => {
    if (isPlayerTurn()) {
      addMove({
        playerId: currentPlayerId,
        choice,
        timestamp: new Date().toISOString(),
      });
    }
  };
  
  return (
    <div>
      {choices.map(choice => (
        <button 
          key={choice}
          onClick={() => handleChoiceSelect(choice)}
          disabled={!isPlayerTurn()}
        >
          {choice}
        </button>
      ))}
    </div>
  );
};
```

## Testing

Use the `MatchTest.jsx` component to test store functionality:

```javascript
import MatchTest from '../components/MatchTest';

// Add to your routes for testing
<Route path="/test-match" element={<MatchTest />} />
```

This provides a complete UI for testing all store methods and state changes.
