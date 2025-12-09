import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketIntegrationTester } from '../websocket-utils.js';

describe('WebSocket Match Integration Tests', () => {
  let tester;
  let playerA, playerB;
  
  beforeEach(() => {
    tester = new WebSocketIntegrationTester();
    playerA = tester.createClient(1, { username: 'PlayerA' });
    playerB = tester.createClient(2, { username: 'PlayerB' });
  });
  
  afterEach(() => {
    tester.cleanup();
  });
  
  describe('Basic Move Communication', () => {
    it('Player A makes move → Player B sees instantly', async () => {
      // Arrange
      const matchId = 'test-match-1';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Act
      playerA.sendMove('rock');
      
      // Assert
      const moveMessage = await tester.waitForMessage(2, 'move');
      expect(moveMessage.payload.move).toEqual({
        playerId: 1,
        choice: 'rock',
        timestamp: expect.any(String)
      });
      
      // Verify Player B received the move
      const playerBMoves = playerB.getMessages('move');
      expect(playerBMoves).toHaveLength(1);
      expect(playerBMoves[0].payload.move.choice).toBe('rock');
    });
    
    it('Player B makes move → server determines result → both see result', async () => {
      // Arrange
      const matchId = 'test-match-2';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Act - Player A makes first move
      playerA.sendMove('rock');
      
      // Wait for Player B to receive the move
      await tester.waitForMessage(2, 'move');
      
      // Clear messages to focus on result
      playerA.clearMessages();
      playerB.clearMessages();
      
      // Player B makes second move
      playerB.sendMove('paper');
      
      // Assert - Both players should receive result
      const [resultA, resultB] = await Promise.all([
        tester.waitForMessage(1, 'result'),
        tester.waitForMessage(2, 'result')
      ]);
      
      // Verify result structure
      expect(resultA.payload.result).toEqual({
        winner: 2, // Paper beats rock
        result: 'win',
        player1_id: 1,
        player2_id: 2,
        moves: [
          { playerId: 1, choice: 'rock', timestamp: expect.any(String) },
          { playerId: 2, choice: 'paper', timestamp: expect.any(String) }
        ],
        round_number: 1
      });
      
      // Both players should receive the same result
      expect(resultA).toEqual(resultB);
    });
    
    it('Draw scenario works correctly', async () => {
      // Arrange
      const matchId = 'test-match-3';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Act
      playerA.sendMove('rock');
      await tester.waitForMessage(2, 'move');
      
      playerB.sendMove('rock');
      
      // Assert
      const [resultA, resultB] = await Promise.all([
        tester.waitForMessage(1, 'result'),
        tester.waitForMessage(2, 'result')
      ]);
      
      expect(resultA.payload.result.winner).toBeNull();
      expect(resultA.payload.result.result).toBe('draw');
      expect(resultA).toEqual(resultB);
    });
  });
  
  describe('Disconnect/Reconnect Scenarios', () => {
    it('Disconnect A → B receives opponent_left', async () => {
      // Arrange
      const matchId = 'test-match-4';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Clear initial connection messages
      playerB.clearMessages();
      
      // Act - Disconnect Player A
      tester.disconnectClient(1);
      
      // Assert - Player B should receive opponent_left message
      const opponentLeftMessage = await tester.waitForMessage(2, 'opponent_left');
      expect(opponentLeftMessage.payload).toEqual({ playerId: 1 });
    });
    
    it('Reconnect A → state is restored', async () => {
      // Arrange
      const matchId = 'test-match-5';
      const match = tester.createMatch(matchId, 1, 2);
      
      // Add some moves to the match
      match.moves = [
        { playerId: 1, choice: 'rock', timestamp: new Date().toISOString() },
        { playerId: 2, choice: 'paper', timestamp: new Date().toISOString() }
      ];
      match.current_round = {
        round_number: 2,
        is_complete: false
      };
      
      tester.connectClients(1, 2);
      
      // Act - Disconnect and reconnect Player A
      tester.disconnectClient(1);
      const reconnectedPlayerA = tester.reconnectClient(1);
      
      // Assert - Reconnected player should receive full state
      const stateMessage = await tester.waitForMessage(1, 'state');
      
      expect(stateMessage.type).toBe('state');
      expect(stateMessage.id).toBe(matchId);
      expect(stateMessage.moves).toHaveLength(2);
      expect(stateMessage.current_round.round_number).toBe(2);
      expect(stateMessage.status).toBe('active');
      
      // Verify opponent info is included
      expect(stateMessage.opponent).toEqual({
        id: 2,
        username: 'player2',
        is_online: true
      });
    });
    
    it('Reconnect during active game preserves gameplay', async () => {
      // Arrange
      const matchId = 'test-match-6';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Player A makes a move
      playerA.sendMove('scissors');
      await tester.waitForMessage(2, 'move');
      
      // Disconnect Player A
      tester.disconnectClient(1);
      
      // Act - Reconnect Player A
      const reconnectedPlayerA = tester.reconnectClient(1);
      
      // Assert - State should show the previous move
      const stateMessage = await tester.waitForMessage(1, 'state');
      expect(stateMessage.moves).toHaveLength(1);
      expect(stateMessage.moves[0].choice).toBe('scissors');
      
      // Gameplay should continue normally
      reconnectedPlayerA.sendMove('paper');
      const result = await tester.waitForMessage(2, 'result');
      expect(result.payload.result.winner).toBe(1); // Scissors beats paper
    });
  });
  
  describe('Timeout Scenarios', () => {
    it('Timeout → server sends result', async () => {
      // Arrange
      const matchId = 'test-match-7';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Player A makes a move
      playerA.sendMove('rock');
      await tester.waitForMessage(2, 'move');
      
      // Act - Player B times out
      playerB.sendTimeout();
      
      // Assert - Both players should receive result
      const [resultA, resultB] = await Promise.all([
        tester.waitForMessage(1, 'result'),
        tester.waitForMessage(2, 'result')
      ]);
      
      expect(resultA.payload.result.winner).toBe(1); // Player A wins by timeout
      expect(resultA.payload.result.result).toBe('win');
      
      // Verify timeout move is recorded
      expect(resultA.payload.result.moves[1].choice).toBe('timeout');
      expect(resultA).toEqual(resultB);
    });
    
    it('Both players timeout → draw result', async () => {
      // Arrange
      const matchId = 'test-match-8';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Act - Both players timeout
      playerA.sendTimeout();
      playerB.sendTimeout();
      
      // Assert - Draw result
      const [resultA, resultB] = await Promise.all([
        tester.waitForMessage(1, 'result'),
        tester.waitForMessage(2, 'result')
      ]);
      
      expect(resultA.payload.result.winner).toBeNull();
      expect(resultA.payload.result.result).toBe('draw');
      expect(resultA.payload.result.moves[0].choice).toBe('timeout');
      expect(resultA.payload.result.moves[1].choice).toBe('timeout');
    });
    
    it('Timeout after normal move works correctly', async () => {
      // Arrange
      const matchId = 'test-match-9';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Player A makes normal move
      playerA.sendMove('paper');
      await tester.waitForMessage(2, 'move');
      
      // Player B times out
      playerB.sendTimeout();
      
      // Assert
      const result = await tester.waitForMessage(1, 'result');
      expect(result.payload.result.winner).toBe(1); // Paper beats timeout
      expect(result.payload.result.moves[0].choice).toBe('paper');
      expect(result.payload.result.moves[1].choice).toBe('timeout');
    });
  });
  
  describe('Synchronization Scenarios', () => {
    it('Sync request returns current match state', async () => {
      // Arrange
      const matchId = 'test-match-10';
      const match = tester.createMatch(matchId, 1, 2);
      
      // Add some match data
      match.moves = [
        { playerId: 1, choice: 'rock', timestamp: new Date().toISOString() },
        { playerId: 2, choice: 'scissors', timestamp: new Date().toISOString() }
      ];
      match.current_round = {
        round_number: 2,
        is_complete: false
      };
      match.wins_needed = 3;
      
      tester.connectClients(1, 2);
      
      // Act - Player A requests sync
      playerA.clearMessages(); // Clear connection messages
      playerA.sendSyncRequest();
      
      // Assert
      const stateMessage = await tester.waitForMessage(1, 'state');
      
      expect(stateMessage.type).toBe('state');
      expect(stateMessage.id).toBe(matchId);
      expect(stateMessage.status).toBe('active');
      expect(stateMessage.moves).toHaveLength(2);
      expect(stateMessage.wins_needed).toBe(3);
      expect(stateMessage.current_round.round_number).toBe(2);
      expect(stateMessage.opponent.id).toBe(2);
    });
    
    it('Multiple rounds state sync works correctly', async () => {
      // Arrange
      const matchId = 'test-match-11';
      const match = tester.createMatch(matchId, 1, 2);
      
      // Simulate multiple rounds
      match.moves = [
        { playerId: 1, choice: 'rock', timestamp: new Date().toISOString() },
        { playerId: 2, choice: 'paper', timestamp: new Date().toISOString() },
        { playerId: 1, choice: 'scissors', timestamp: new Date().toISOString() },
        { playerId: 2, choice: 'rock', timestamp: new Date().toISOString() }
      ];
      match.current_round = {
        round_number: 3,
        is_complete: false
      };
      
      tester.connectClients(1, 2);
      
      // Act
      playerA.clearMessages();
      playerA.sendSyncRequest();
      
      // Assert
      const stateMessage = await tester.waitForMessage(1, 'state');
      expect(stateMessage.moves).toHaveLength(4);
      expect(stateMessage.current_round.round_number).toBe(3);
    });
  });
  
  describe('Error Scenarios', () => {
    it('Invalid message type is handled gracefully', async () => {
      // Arrange
      const matchId = 'test-match-12';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Act - Send invalid message
      playerA.send({ type: 'invalid_type', payload: {} });
      
      // Assert - Should not crash and clients should remain connected
      expect(playerA.ws.readyState).toBe(playerA.ws.OPEN);
      expect(playerB.ws.readyState).toBe(playerB.ws.OPEN);
      
      // Normal gameplay should still work
      playerA.sendMove('rock');
      const moveMessage = await tester.waitForMessage(2, 'move');
      expect(moveMessage.payload.move.choice).toBe('rock');
    });
    
    it('Malformed JSON is handled gracefully', async () => {
      // Arrange
      const matchId = 'test-match-13';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Act - Send malformed JSON
      expect(() => {
        playerA.ws.send('invalid json {');
      }).not.toThrow();
      
      // Assert - Connection remains stable
      expect(playerA.ws.readyState).toBe(playerA.ws.OPEN);
    });
    
    it('Move without match is ignored', async () => {
      // Arrange - Create clients without match
      const playerC = tester.createClient(3);
      tester.connectClients(3);
      
      // Act - Send move without being in a match
      playerC.sendMove('rock');
      
      // Assert - Should be ignored, no crash
      expect(playerC.ws.readyState).toBe(playerC.ws.OPEN);
      
      // Other clients should not receive anything
      expect(playerB.getMessages('move')).toHaveLength(0);
    });
  });
  
  describe('Concurrent Operations', () => {
    it('Multiple simultaneous moves are handled correctly', async () => {
      // Arrange
      const matchId = 'test-match-14';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Act - Send moves simultaneously
      const promises = [
        playerA.sendMove('rock'),
        playerB.sendMove('paper')
      ];
      
      // Assert - Both moves should be processed and result sent
      await Promise.all(promises);
      
      const [resultA, resultB] = await Promise.all([
        tester.waitForMessage(1, 'result'),
        tester.waitForMessage(2, 'result')
      ]);
      
      expect(resultA.payload.result.winner).toBe(2);
      expect(resultA.payload.result.moves).toHaveLength(2);
    });
    
    it('Rapid reconnect/disconnect works correctly', async () => {
      // Arrange
      const matchId = 'test-match-15';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Act - Rapid disconnect/reconnect
      for (let i = 0; i < 3; i++) {
        tester.disconnectClient(1);
        const reconnected = tester.reconnectClient(1);
        
        // Should receive state sync
        const stateMessage = await tester.waitForMessage(1, 'state');
        expect(stateMessage.type).toBe('state');
      }
      
      // Assert - Final gameplay should work
      playerA.sendMove('rock');
      const moveMessage = await tester.waitForMessage(2, 'move');
      expect(moveMessage.payload.move.choice).toBe('rock');
    });
  });
});
