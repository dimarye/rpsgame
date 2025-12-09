import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useMatchWebSocket from '../../hooks/useWebSocket.js';
import useMatchStore from '../../store/useMatchStore.js';

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
  close: vi.fn(),
  send: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: WebSocket.OPEN,
  CONNECTING: WebSocket.CONNECTING,
  OPEN: WebSocket.OPEN,
  CLOSING: WebSocket.CLOSING,
  CLOSED: WebSocket.CLOSED
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn()
}));

describe('useWebSocket Integration Tests', () => {
  let mockWs;
  let store;
  
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Create mock WebSocket
    mockWs = {
      close: vi.fn(),
      send: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      readyState: WebSocket.OPEN,
      CONNECTING: WebSocket.CONNECTING,
      OPEN: WebSocket.OPEN,
      CLOSING: WebSocket.CLOSING,
      CLOSED: WebSocket.CLOSED
    };
    
    global.WebSocket.mockImplementation(() => mockWs);
    
    // Reset store
    store = useMatchStore.getState();
    store.reset();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('Connection Management', () => {
    it('connects successfully with valid match ID', async () => {
      // Arrange
      const matchId = 'test-match-1';
      
      // Act
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Assert
      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining(matchId)
      );
      expect(mockWs.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWs.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.addEventListener).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    });
    
    it('handles connection success', async () => {
      // Arrange
      const matchId = 'test-match-2';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Find the open event handler
      const openHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      
      // Act
      act(() => {
        openHandler();
      });
      
      // Assert
      const { isConnected } = useMatchStore.getState();
      expect(isConnected).toBe(true);
    });
    
    it('handles connection loss', async () => {
      // Arrange
      const matchId = 'test-match-3';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // First establish connection
      const openHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      act(() => {
        openHandler();
      });
      
      // Find the close event handler
      const closeHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'close')?.[1];
      
      // Act
      act(() => {
        closeHandler({ code: 1006, reason: 'Connection lost' });
      });
      
      // Assert
      const { isConnected } = useMatchStore.getState();
      expect(isConnected).toBe(false);
    });
    
    it('attempts reconnection on disconnect', async () => {
      // Arrange
      const matchId = 'test-match-4';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Find the close event handler
      const closeHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'close')?.[1];
      
      // Act
      act(() => {
        closeHandler({ code: 1006, reason: 'Connection lost' });
      });
      
      // Assert - Should attempt reconnection
      expect(setTimeout).toHaveBeenCalled();
      expect(global.WebSocket).toHaveBeenCalledTimes(2); // Initial + reconnect
    });
  });
  
  describe('Message Handling', () => {
    it('handles move messages correctly', async () => {
      // Arrange
      const matchId = 'test-match-5';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Establish connection
      const openHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      act(() => {
        openHandler();
      });
      
      // Find message handler
      const messageHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'message')?.[1];
      
      const moveMessage = {
        type: 'move',
        payload: {
          move: {
            playerId: 2,
            choice: 'rock',
            timestamp: new Date().toISOString()
          }
        }
      };
      
      // Act
      act(() => {
        messageHandler({ data: JSON.stringify(moveMessage) });
      });
      
      // Assert
      const { moves } = useMatchStore.getState();
      expect(moves).toHaveLength(1);
      expect(moves[0]).toEqual(moveMessage.payload.move);
    });
    
    it('handles result messages correctly', async () => {
      // Arrange
      const matchId = 'test-match-6';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Establish connection
      const openHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      act(() => {
        openHandler();
      });
      
      // Find message handler
      const messageHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'message')?.[1];
      
      const resultMessage = {
        type: 'result',
        payload: {
          result: {
            winner: 1,
            result: 'win',
            player1_id: 1,
            player2_id: 2,
            moves: [
              { playerId: 1, choice: 'rock', timestamp: new Date().toISOString() },
              { playerId: 2, choice: 'scissors', timestamp: new Date().toISOString() }
            ],
            round_number: 1
          }
        }
      };
      
      // Act
      act(() => {
        messageHandler({ data: JSON.stringify(resultMessage) });
      });
      
      // Assert
      const { roundResult } = useMatchStore.getState();
      expect(roundResult).toEqual(resultMessage.payload.result);
    });
    
    it('handles opponent_left messages correctly', async () => {
      // Arrange
      const matchId = 'test-match-7';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Set initial opponent
      useMatchStore.getState().setOpponent({ id: 2, username: 'player2' });
      
      // Establish connection
      const openHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      act(() => {
        openHandler();
      });
      
      // Find message handler
      const messageHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'message')?.[1];
      
      const opponentLeftMessage = {
        type: 'opponent_left'
      };
      
      // Act
      act(() => {
        messageHandler({ data: JSON.stringify(opponentLeftMessage) });
      });
      
      // Assert
      const { opponent } = useMatchStore.getState();
      expect(opponent).toBeNull();
    });
    
    it('handles timeout messages correctly', async () => {
      // Arrange
      const matchId = 'test-match-8';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Establish connection
      const openHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      act(() => {
        openHandler();
      });
      
      // Find message handler
      const messageHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'message')?.[1];
      
      const timeoutMessage = {
        type: 'timeout'
      };
      
      // Act
      act(() => {
        messageHandler({ data: JSON.stringify(timeoutMessage) });
      });
      
      // Assert
      const { timeoutOccurred } = useMatchStore.getState();
      expect(timeoutOccurred).toBe(true);
    });
    
    it('handles error messages correctly', async () => {
      // Arrange
      const matchId = 'test-match-9';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Establish connection
      const openHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      act(() => {
        openHandler();
      });
      
      // Find message handler
      const messageHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'message')?.[1];
      
      const errorMessage = {
        type: 'error',
        payload: { message: 'Test error message' }
      };
      
      // Act
      act(() => {
        messageHandler({ data: JSON.stringify(errorMessage) });
      });
      
      // Assert
      const { error } = useMatchStore.getState();
      expect(error).toBe('Test error message');
    });
    
    it('handles state synchronization correctly', async () => {
      // Arrange
      const matchId = 'test-match-10';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Establish connection
      const openHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      act(() => {
        openHandler();
      });
      
      // Find message handler
      const messageHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'message')?.[1];
      
      const stateMessage = {
        type: 'state',
        status: 'active',
        moves: [
          { playerId: 1, choice: 'rock', timestamp: new Date().toISOString() },
          { playerId: 2, choice: 'paper', timestamp: new Date().toISOString() }
        ],
        opponent: {
          id: 2,
          username: 'player2',
          is_online: true
        },
        timer: {
          countdown: 30,
          is_active: true
        },
        current_round: {
          round_number: 2,
          is_complete: false
        },
        wins_needed: 3,
        winner: null
      };
      
      // Act
      act(() => {
        messageHandler({ data: JSON.stringify(stateMessage) });
      });
      
      // Assert
      const state = useMatchStore.getState();
      expect(state.matchStatus).toBe('active');
      expect(state.moves).toHaveLength(2);
      expect(state.opponent).toEqual(stateMessage.opponent);
      expect(state.countdown).toBe(30);
      expect(state.currentRound).toEqual(stateMessage.current_round);
      expect(state.winner).toBeNull();
    });
  });
  
  describe('Message Sending', () => {
    it('sends move messages correctly', async () => {
      // Arrange
      const matchId = 'test-match-11';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Establish connection
      const openHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      act(() => {
        openHandler();
      });
      
      // Act
      act(() => {
        result.current.sendJson({
          type: 'move',
          payload: { choice: 'rock' }
        });
      });
      
      // Assert
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'move',
        payload: { choice: 'rock' }
      }));
    });
    
    it('sends sync request correctly', async () => {
      // Arrange
      const matchId = 'test-match-12';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Establish connection
      const openHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      act(() => {
        openHandler();
      });
      
      // Act
      act(() => {
        result.current.requestSync();
      });
      
      // Assert
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'sync_request'
      }));
    });
    
    it('handles sending when disconnected', async () => {
      // Arrange
      const matchId = 'test-match-13';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Don't establish connection - WebSocket stays in CONNECTING state
      mockWs.readyState = WebSocket.CONNECTING;
      
      // Act
      let sendResult;
      act(() => {
        sendResult = result.current.sendJson({
          type: 'move',
          payload: { choice: 'rock' }
        });
      });
      
      // Assert
      expect(sendResult).toBe(false);
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });
  
  describe('Reconnection Behavior', () => {
    it('requests sync on reconnect', async () => {
      // Arrange
      const matchId = 'test-match-14';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Find the open event handler
      const openHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      
      // Find the close event handler
      const closeHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'close')?.[1];
      
      // Act - Simulate disconnect and reconnect
      act(() => {
        closeHandler({ code: 1006, reason: 'Connection lost' });
      });
      
      // Simulate reconnection by creating new WebSocket
      const newMockWs = { ...mockWs, send: vi.fn() };
      global.WebSocket.mockImplementation(() => newMockWs);
      
      const newOpenHandler = newMockWs.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      
      act(() => {
        newOpenHandler();
      });
      
      // Assert - Should send sync request on reconnect
      expect(newMockWs.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'sync_request'
      }));
    });
    
    it('does not request sync on initial connection', async () => {
      // Arrange
      const matchId = 'test-match-15';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Find the open event handler
      const openHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      
      // Act
      act(() => {
        openHandler();
      });
      
      // Assert - Should not send sync request on initial connection
      expect(mockWs.send).not.toHaveBeenCalledWith(JSON.stringify({
        type: 'sync_request'
      }));
    });
  });
  
  describe('Error Handling', () => {
    it('handles malformed messages gracefully', async () => {
      // Arrange
      const matchId = 'test-match-16';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Establish connection
      const openHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      act(() => {
        openHandler();
      });
      
      // Find message handler
      const messageHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'message')?.[1];
      
      // Act - Send malformed JSON
      expect(() => {
        act(() => {
          messageHandler({ data: 'invalid json {' });
        });
      }).not.toThrow();
      
      // Assert - Connection should remain stable
      const { isConnected } = useMatchStore.getState();
      expect(isConnected).toBe(true);
    });
    
    it('handles unknown message types gracefully', async () => {
      // Arrange
      const matchId = 'test-match-17';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Establish connection
      const openHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      act(() => {
        openHandler();
      });
      
      // Find message handler
      const messageHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'message')?.[1];
      
      // Act - Send unknown message type
      act(() => {
        messageHandler({ data: JSON.stringify({ type: 'unknown_type', payload: {} }) });
      });
      
      // Assert - Should not crash
      const { isConnected } = useMatchStore.getState();
      expect(isConnected).toBe(true);
    });
    
    it('handles WebSocket errors gracefully', async () => {
      // Arrange
      const matchId = 'test-match-18';
      const { result } = renderHook(() => useMatchWebSocket(matchId));
      
      // Find the error event handler
      const errorHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'error')?.[1];
      
      // Act
      act(() => {
        errorHandler(new Error('WebSocket error'));
      });
      
      // Assert - Should set error state
      const { error, isConnected } = useMatchStore.getState();
      expect(error).toBeTruthy();
      expect(isConnected).toBe(false);
    });
  });
  
  describe('Cleanup', () => {
    it('cleans up connection on unmount', async () => {
      // Arrange
      const matchId = 'test-match-19';
      const { result, unmount } = renderHook(() => useMatchWebSocket(matchId));
      
      // Establish connection
      const openHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      act(() => {
        openHandler();
      });
      
      // Act
      act(() => {
        unmount();
      });
      
      // Assert - Should close WebSocket
      expect(mockWs.close).toHaveBeenCalled();
    });
    
    it('clears timeouts on unmount', async () => {
      // Arrange
      const matchId = 'test-match-20';
      const { result, unmount } = renderHook(() => useMatchWebSocket(matchId));
      
      // Find the close event handler
      const closeHandler = mockWs.addEventListener.mock.calls.find(call => call[0] === 'close')?.[1];
      
      // Trigger reconnection to set timeout
      act(() => {
        closeHandler({ code: 1006, reason: 'Connection lost' });
      });
      
      // Act
      act(() => {
        unmount();
      });
      
      // Assert - Should clear timeout
      expect(clearTimeout).toHaveBeenCalled();
    });
  });
});
