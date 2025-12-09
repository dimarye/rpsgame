import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketIntegrationTester } from '../websocket-utils.js';

describe('Match Scenario Integration Tests', () => {
  let tester;
  
  beforeEach(() => {
    tester = new WebSocketIntegrationTester();
  });
  
  afterEach(() => {
    tester.cleanup();
  });
  
  describe('Complete Match Flow', () => {
    it('Complete match from start to finish', async () => {
      // Arrange
      const matchId = 'complete-match-1';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Round 1: Player A wins
      playerA.sendMove('rock');
      await tester.waitForMessage(2, 'move');
      
      playerB.sendMove('scissors');
      const round1Result = await tester.waitForMessage(1, 'result');
      expect(round1Result.payload.result.winner).toBe(1);
      
      // Round 2: Player B wins
      playerA.clearMessages();
      playerB.clearMessages();
      
      playerA.sendMove('paper');
      await tester.waitForMessage(2, 'move');
      
      playerB.sendMove('scissors');
      const round2Result = await tester.waitForMessage(1, 'result');
      expect(round2Result.payload.result.winner).toBe(2);
      
      // Round 3: Draw
      playerA.clearMessages();
      playerB.clearMessages();
      
      playerA.sendMove('rock');
      await tester.waitForMessage(2, 'move');
      
      playerB.sendMove('rock');
      const round3Result = await tester.waitForMessage(1, 'result');
      expect(round3Result.payload.result.winner).toBeNull();
      expect(round3Result.payload.result.result).toBe('draw');
      
      // Verify all rounds completed successfully
      expect(round1Result.payload.result.round_number).toBe(1);
      expect(round2Result.payload.result.round_number).toBe(2);
      expect(round3Result.payload.result.round_number).toBe(3);
    });
    
    it('Match with timeout scenarios', async () => {
      // Arrange
      const matchId = 'timeout-match-1';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Round 1: Player A wins by timeout
      playerA.sendMove('rock');
      await tester.waitForMessage(2, 'move');
      
      playerB.sendTimeout();
      const round1Result = await tester.waitForMessage(1, 'result');
      expect(round1Result.payload.result.winner).toBe(1);
      expect(round1Result.payload.result.moves[1].choice).toBe('timeout');
      
      // Round 2: Both timeout (draw)
      playerA.clearMessages();
      playerB.clearMessages();
      
      playerA.sendTimeout();
      playerB.sendTimeout();
      
      const round2Result = await tester.waitForMessage(1, 'result');
      expect(round2Result.payload.result.winner).toBeNull();
      expect(round2Result.payload.result.result).toBe('draw');
      expect(round2Result.payload.result.moves[0].choice).toBe('timeout');
      expect(round2Result.payload.result.moves[1].choice).toBe('timeout');
    });
  });
  
  describe('Real-world Scenarios', () => {
    it('Player disconnects during match and reconnects', async () => {
      // Arrange
      const matchId = 'disconnect-scenario-1';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Player A makes first move
      playerA.sendMove('paper');
      await tester.waitForMessage(2, 'move');
      
      // Player A disconnects
      tester.disconnectClient(1);
      
      // Player B should receive opponent_left notification
      const opponentLeftMessage = await tester.waitForMessage(2, 'opponent_left');
      expect(opponentLeftMessage.type).toBe('opponent_left');
      
      // Player A reconnects
      const reconnectedPlayerA = tester.reconnectClient(1);
      
      // Should receive full state sync
      const stateMessage = await tester.waitForMessage(1, 'state');
      expect(stateMessage.type).toBe('state');
      expect(stateMessage.moves).toHaveLength(1);
      expect(stateMessage.moves[0].choice).toBe('paper');
      
      // Gameplay should continue
      reconnectedPlayerA.sendMove('rock');
      const moveMessage = await tester.waitForMessage(2, 'move');
      expect(moveMessage.payload.move.choice).toBe('rock');
    });
    
    it('Multiple rapid disconnections and reconnections', async () => {
      // Arrange
      const matchId = 'rapid-reconnect-1';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Add some game state
      playerA.sendMove('rock');
      await tester.waitForMessage(2, 'move');
      
      // Act - Rapid disconnect/reconnect cycles
      for (let i = 0; i < 3; i++) {
        tester.disconnectClient(1);
        const reconnected = tester.reconnectClient(1);
        
        // Should receive state sync each time
        const stateMessage = await tester.waitForMessage(1, 'state');
        expect(stateMessage.type).toBe('state');
        expect(stateMessage.moves).toHaveLength(1);
      }
      
      // Final gameplay should work
      const finalPlayerA = tester.getClient(1);
      finalPlayerA.sendMove('paper');
      const result = await tester.waitForMessage(2, 'result');
      expect(result.payload.result.winner).toBe(1);
    });
    
    it('Network instability simulation', async () => {
      // Arrange
      const matchId = 'network-instability-1';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Simulate intermittent connection issues
      playerA.sendMove('rock');
      await tester.waitForMessage(2, 'move');
      
      // Simulate brief disconnection
      tester.disconnectClient(1, 1006, 'Temporary network issue');
      
      // Quick reconnection
      const reconnected = tester.reconnectClient(1);
      const stateMessage = await tester.waitForMessage(1, 'state');
      expect(stateMessage.moves).toHaveLength(1);
      
      // Continue gameplay
      reconnected.sendMove('paper');
      const result = await tester.waitForMessage(2, 'result');
      expect(result.payload.result.winner).toBe(2);
    });
  });
  
  describe('Edge Cases', () => {
    it('Both players disconnect simultaneously', async () => {
      // Arrange
      const matchId = 'simultaneous-disconnect-1';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Add some game state
      playerA.sendMove('rock');
      await tester.waitForMessage(2, 'move');
      
      // Act - Both disconnect
      tester.disconnectClient(1);
      tester.disconnectClient(2);
      
      // Both reconnect
      const reconnectedA = tester.reconnectClient(1);
      const reconnectedB = tester.reconnectClient(2);
      
      // Both should receive state sync
      const [stateA, stateB] = await Promise.all([
        tester.waitForMessage(1, 'state'),
        tester.waitForMessage(2, 'state')
      ]);
      
      expect(stateA.moves).toHaveLength(1);
      expect(stateB.moves).toHaveLength(1);
      expect(stateA.moves[0].choice).toBe('rock');
      expect(stateB.moves[0].choice).toBe('rock');
      
      // Gameplay should continue normally
      reconnectedA.sendMove('paper');
      const moveMessage = await tester.waitForMessage(2, 'move');
      expect(moveMessage.payload.move.choice).toBe('paper');
    });
    
    it('Player disconnects while opponent is making move', async () => {
      // Arrange
      const matchId = 'disconnect-during-move-1';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Player A makes move
      playerA.sendMove('scissors');
      await tester.waitForMessage(2, 'move');
      
      // Player A disconnects before Player B responds
      tester.disconnectClient(1);
      
      // Player B makes move
      playerB.sendMove('paper');
      
      // Player B should still receive result
      const result = await tester.waitForMessage(2, 'result');
      expect(result.payload.result.winner).toBe(1); // Scissors beats paper
      
      // Player A reconnects
      const reconnectedA = tester.reconnectClient(1);
      
      // Should receive updated state with result
      const stateMessage = await tester.waitForMessage(1, 'state');
      expect(stateMessage.moves).toHaveLength(2);
      expect(stateMessage.moves[0].choice).toBe('scissors');
      expect(stateMessage.moves[1].choice).toBe('paper');
    });
    
    it('Match with all possible move combinations', async () => {
      // Arrange
      const matchId = 'all-combinations-1';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      const combinations = [
        ['rock', 'rock'], // draw
        ['rock', 'paper'], // paper wins
        ['rock', 'scissors'], // rock wins
        ['paper', 'paper'], // draw
        ['paper', 'scissors'], // scissors wins
        ['paper', 'rock'], // paper wins
        ['scissors', 'scissors'], // draw
        ['scissors', 'rock'], // rock wins
        ['scissors', 'paper'] // scissors wins
      ];
      
      const expectedWinners = [null, 2, 1, null, 2, 1, null, 2, 1];
      
      // Test each combination
      for (let i = 0; i < combinations.length; i++) {
        const [move1, move2] = combinations[i];
        const expectedWinner = expectedWinners[i];
        
        // Clear messages
        playerA.clearMessages();
        playerB.clearMessages();
        
        // Make moves
        playerA.sendMove(move1);
        await tester.waitForMessage(2, 'move');
        
        playerB.sendMove(move2);
        
        // Check result
        const result = await tester.waitForMessage(1, 'result');
        expect(result.payload.result.winner).toBe(expectedWinner);
        expect(result.payload.result.moves[0].choice).toBe(move1);
        expect(result.payload.result.moves[1].choice).toBe(move2);
      }
    });
  });
  
  describe('Performance and Stress Tests', () => {
    it('Rapid successive moves', async () => {
      // Arrange
      const matchId = 'rapid-moves-1';
      tester.createMatch(matchId, 1, 2);
      tester.connectClients(1, 2);
      
      // Act - Send multiple rounds rapidly
      const rounds = 5;
      const results = [];
      
      for (let i = 0; i < rounds; i++) {
        playerA.clearMessages();
        playerB.clearMessages();
        
        playerA.sendMove('rock');
        await tester.waitForMessage(2, 'move');
        
        playerB.sendMove('paper');
        
        const result = await tester.waitForMessage(1, 'result');
        results.push(result.payload.result);
      }
      
      // Assert - All rounds should complete successfully
      expect(results).toHaveLength(rounds);
      results.forEach((result, index) => {
        expect(result.winner).toBe(2); // Paper beats rock
        expect(result.round_number).toBe(index + 1);
      });
    });
    
    it('Large number of sync requests', async () => {
      // Arrange
      const matchId = 'many-syncs-1';
      const match = tester.createMatch(matchId, 1, 2);
      
      // Add substantial match data
      match.moves = Array.from({ length: 20 }, (_, i) => ({
        playerId: i % 2 === 0 ? 1 : 2,
        choice: ['rock', 'paper', 'scissors'][i % 3],
        timestamp: new Date().toISOString()
      }));
      
      tester.connectClients(1, 2);
      
      // Act - Send multiple sync requests
      const syncRequests = 10;
      const syncPromises = [];
      
      for (let i = 0; i < syncRequests; i++) {
        playerA.sendSyncRequest();
        syncPromises.push(tester.waitForMessage(1, 'state'));
      }
      
      // Assert - All sync requests should complete
      const syncResponses = await Promise.all(syncPromises);
      expect(syncResponses).toHaveLength(syncRequests);
      
      syncResponses.forEach(response => {
        expect(response.type).toBe('state');
        expect(response.moves).toHaveLength(20);
      });
    });
  });
  
  describe('Concurrent Operations', () => {
    it('Multiple matches running simultaneously', async () => {
      // Arrange - Create multiple matches
      const match1Id = 'concurrent-match-1';
      const match2Id = 'concurrent-match-2';
      
      const player1A = tester.createClient(1, { username: 'P1A' });
      const player1B = tester.createClient(2, { username: 'P1B' });
      const player2A = tester.createClient(3, { username: 'P2A' });
      const player2B = tester.createClient(4, { username: 'P2B' });
      
      tester.createMatch(match1Id, 1, 2);
      tester.createMatch(match2Id, 3, 4);
      
      tester.connectClients(1, 2, 3, 4);
      
      // Act - Play both matches simultaneously
      const match1Promise = (async () => {
        player1A.sendMove('rock');
        await tester.waitForMessage(2, 'move');
        player1B.sendMove('paper');
        return tester.waitForMessage(1, 'result');
      })();
      
      const match2Promise = (async () => {
        player2A.sendMove('scissors');
        await tester.waitForMessage(4, 'move');
        player2B.sendMove('paper');
        return tester.waitForMessage(3, 'result');
      })();
      
      // Assert - Both matches should complete independently
      const [result1, result2] = await Promise.all([match1Promise, match2Promise]);
      
      expect(result1.payload.result.winner).toBe(2); // Paper beats rock
      expect(result2.payload.result.winner).toBe(3); // Scissors beats paper
      
      // Verify matches are independent
      expect(result1.payload.result.player1_id).toBe(1);
      expect(result1.payload.result.player2_id).toBe(2);
      expect(result2.payload.result.player1_id).toBe(3);
      expect(result2.payload.result.player2_id).toBe(4);
    });
  });
});
