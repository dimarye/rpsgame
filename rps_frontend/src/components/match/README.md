# Match UX Components

Complete set of UX components for the Rock Paper Scissors game interface with real-time updates and animations.

## Components Overview

### 1. OpponentInfo

**Purpose**: Displays opponent information with status indicators.

**Features**:

- Dynamic avatar generation (first letter + color)
- Real-time connection status with pulse animation
- Username display and player ID
- Status indicators (Waiting, Online, Disconnected)

**Props**: None (uses Zustand store)

**Store Integration**:

```javascript
const { opponent, isConnected } = useMatchStore();
```

### 2. MoveSelector

**Purpose**: Interactive move selection buttons with real-time feedback.

**Features**:

- Three choice buttons (Rock, Paper, Scissors)
- Gradient backgrounds and hover effects
- Button locking after move submission
- Real-time turn status display
- Framer Motion animations
- WebSocket integration for move sending

**Props**: None (uses Zustand store and WebSocket hook)

**Behavior**:

- Blocks buttons after sending move
- Sends `sendJson({type: "move", choice})`
- Shows "Sent!" overlay after move
- Disabled when not player's turn

### 3. MoveLog

**Purpose**: Displays complete game history with round-by-round results.

**Features**:

- Groups moves into rounds (2 moves per round)
- Shows player vs opponent choices
- Displays round results with color coding
- Win/loss/draw statistics
- Scrollable history with timestamps
- Real-time updates from store

**Props**: None (uses Zustand store)

**Store Integration**:

```javascript
const { moves, playerId } = useMatchStore();
```

**Round Logic**:

- Automatically groups moves by pairs
- Determines round results (win/lose/draw)
- Shows "Waiting..." for incomplete rounds

### 4. RoundResult

**Purpose**: Animated overlay for round results.

**Features**:

- Framer Motion animations (spring, rotate, scale)
- Color-coded results:
  - Win → Green flash
  - Lose → Red flash
  - Draw → Yellow flash
- Auto-dismiss after delay
- Move details display
- Glow effects and animations

**Props**: None (uses Zustand store)

**Animation Sequence**:

1. Scale in with spring animation
2. Rotate flip effect
3. Background flash
4. Glow pulse effect
5. Auto-dismiss

### 5. TurnTimer

**Purpose**: Countdown timer with automatic timeout handling.

**Features**:

- Circular and linear progress indicators
- Color-coded warnings (green → orange → red)
- Automatic timeout message sending
- Real-time connection status
- Pause/resume based on turn state
- Visual pulse indicators

**Props**:

- `totalTime` (default: 30 seconds)

**Timeout Behavior**:

- Sends `sendJson({type: "timeout", payload: {playerId, timestamp}})`
- Prevents duplicate timeout sends
- Shows "Time's up! Round ended..." message

## Integration Architecture

### Store Dependencies

All components integrate directly with the Zustand match store:

```javascript
// Common store usage
const {
  opponent,           // OpponentInfo
  isConnected,        // OpponentInfo, TurnTimer
  moves,             // MoveLog
  playerId,          // MoveLog, TurnTimer
  isPlayerTurn,      // MoveSelector, TurnTimer
  countdown,         // TurnTimer
  roundResult        // RoundResult
} = useMatchStore();
```

### WebSocket Integration

Components that send messages use the WebSocket hook:

```javascript
const { sendJson } = useMatchWebSocket(matchId);
```

**Message Types**:

- `move` - MoveSelector
- `timeout` - TurnTimer

### Animation Framework

All animations use Framer Motion:

```javascript
import { motion } from 'framer-motion';

// Example animation
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
```

## Layout Integration

### MatchLayout Component

The main layout component orchestrates all UX components:

```javascript
<MatchLayout match={match} user={user}>
  {/* OpponentInfo */}
  {/* MoveSelector */}
  {/* TurnTimer */}
  {/* MoveLog */}
  {/* RoundResult */}
</MatchLayout>
```

**Layout Structure**:

- Header with game status and connection info
- Left column: OpponentInfo, MoveSelector, TurnTimer
- Right column: MoveLog
- Overlay: RoundResult
- Footer: Game statistics

## Real-time Updates

### Store-Driven Updates

All components automatically update when store state changes:

- **Opponent joins** → OpponentInfo updates
- **Moves made** → MoveSelector locks, MoveLog updates
- **Round completes** → RoundResult shows, MoveLog updates
- **Countdown changes** → TurnTimer updates
- **Connection changes** → All components update status

### WebSocket Message Flow

```text
Server Message → WebSocket Hook → Zustand Store → Component Update
```

**Example Flow**:

1. Player makes move → MoveSelector sends `move`
2. Server processes → WebSocket receives `result`
3. Hook updates store → `setResult(result)`
4. RoundResult displays → Animated overlay shows
5. MoveLog updates → History shows new round

## Styling System

### Color Scheme

- **Primary**: Indigo/Purple gradients
- **Success**: Green (wins, connection)
- **Warning**: Yellow/Orange (draws, low time)
- **Error**: Red (losses, disconnection)
- **Neutral**: Gray (waiting states)

### Responsive Design

- Mobile-first approach
- Grid layouts adapt to screen size
- Touch-friendly button sizes
- Readable typography scales

### Animation Timing

- **Fast**: 0.2-0.3s (button interactions)
- **Medium**: 0.5s (component entrances)
- **Slow**: 0.6-1.0s (result overlays)
- **Continuous**: 2s+ (pulse effects)

## Usage Examples

### Basic Implementation

```javascript
import MatchLayout from '../components/match/MatchLayout';

const MatchPage = () => {
  const { match, user } = useMatchStore();
  
  return <MatchLayout match={match} user={user} />;
};
```

### Custom Component Usage

```javascript
import OpponentInfo from '../components/match/OpponentInfo';

const CustomGameUI = () => {
  return (
    <div>
      <OpponentInfo />
      {/* Other game components */}
    </div>
  );
};
```

## Performance Considerations

### Optimization

- Components use React.memo where appropriate
- Store subscriptions are minimal
- Animations use GPU acceleration
- WebSocket messages are debounced

### Memory Management

- Cleanup on unmount
- Timer clearing
- WebSocket disconnection
- Animation cancellation

## Troubleshooting

### Common Issues

**Components not updating**:

- Check store integration
- Verify WebSocket connection
- Check component prop dependencies

**Animations not working**:

- Verify Framer Motion import
- Check animation props
- Ensure parent container allows transforms

**Timer not counting down**:

- Check countdown value in store
- Verify isPlayerTurn calculation
- Check WebSocket message handling

**Move not sending**:

- Verify WebSocket connection
- Check sendJson function
- Verify move payload format

### Debug Tips

```javascript
// Enable store logging
console.log('Store state:', useMatchStore.getState());

// Monitor WebSocket messages
console.log('WebSocket message:', data);

// Check component props
console.log('Component props:', { opponent, isConnected });
```

## Future Enhancements

### Planned Features

- Sound effects integration
- Custom avatar uploads
- Game replay system
- Tournament mode
- Spectator mode
- Chat functionality

### Extensibility

- Plugin architecture for custom components
- Theme system for different visual styles
- Animation presets library
- Internationalization support
