import { vi } from 'vitest';

/**
 * WebSocket Test Utility Class
 * Provides utilities for testing WebSocket communication in integration tests
 */
export class WebSocketTestClient {
  constructor(options = {}) {
    this.matchId = options.matchId || 'test-match-id';
    this.playerId = options.playerId || 1;
    this.token = options.token || 'test-token';
    this.messages = [];
    this.eventHandlers = {};
    this.closed = false;
    
    // Create mock WebSocket
    this.ws = this.createMockWebSocket();
  }
  
  createMockWebSocket() {
    const ws = {
      close: vi.fn((code, reason) => {
        this.closed = true;
        this.triggerEvent('close', { code, reason });
      }),
      
      send: vi.fn((data) => {
        if (this.closed) {
          throw new Error('WebSocket is closed');
        }
        
        try {
          const message = JSON.parse(data);
          this.messages.push(message);
          this.onMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      }),
      
      addEventListener: vi.fn((event, handler) => {
        if (!this.eventHandlers[event]) {
          this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
      }),
      
      removeEventListener: vi.fn((event, handler) => {
        if (this.eventHandlers[event]) {
          const index = this.eventHandlers[event].indexOf(handler);
          if (index > -1) {
            this.eventHandlers[event].splice(index, 1);
          }
        }
      }),
      
      // Add event handler methods that tests expect
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      
      // Set up event handler assignment
      set onopen(handler) {
        this._onopen = handler;
        if (handler) {
          this.addEventListener('open', handler);
        }
      },
      set onclose(handler) {
        this._onclose = handler;
        if (handler) {
          this.addEventListener('close', handler);
        }
      },
      set onmessage(handler) {
        this._onmessage = handler;
        if (handler) {
          this.addEventListener('message', handler);
        }
      },
      set onerror(handler) {
        this._onerror = handler;
        if (handler) {
          this.addEventListener('error', handler);
        }
      },
      
      readyState: 1, // WebSocket.OPEN
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
      
      URL: `ws://127.0.0.1:8000/ws/match/${this.matchId}/?token=${this.token}`
    };
    
    return ws;
  }
  
  triggerEvent(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }
  
  // Helper methods for tests to get event handlers
  getEventHandler(event) {
    return this.eventHandlers[event]?.[0] || null;
  }
  
  // Get specific handlers that tests might need
  getOpenHandler() {
    return this.getEventHandler('open');
  }
  
  getCloseHandler() {
    return this.getEventHandler('close');
  }
  
  getMessageHandler() {
    return this.getEventHandler('message');
  }
  
  getErrorHandler() {
    return this.getEventHandler('error');
  }
  
  onMessage(message) {
    // Override in subclasses for specific message handling
  }
  
  // Simulate receiving a message from server
  receiveMessage(message) {
    this.triggerEvent('message', { data: JSON.stringify(message) });
  }
  
  // Simulate connection opening
  connect() {
    this.closed = false;
    this.ws.readyState = this.ws.OPEN;
    this.triggerEvent('open');
  }
  
  // Simulate connection closing
  disconnect(code = 1000, reason = '') {
    this.ws.readyState = this.ws.CLOSED;
    this.triggerEvent('close', { code, reason });
  }
  
  // Send a move
  sendMove(choice) {
    this.send({
      type: 'move',
      payload: { choice }
    });
  }
  
  // Send sync request
  sendSyncRequest() {
    this.send({ type: 'sync_request' });
  }
  
  // Send timeout notification
  sendTimeout() {
    this.send({
      type: 'timeout',
      payload: {
        playerId: this.playerId,
        timestamp: new Date().toISOString()
      }
    });
  }
  
  // Generic send method
  send(data) {
    this.ws.send(JSON.stringify(data));
  }
  
  // Get all sent messages of a specific type
  getMessages(type) {
    return this.messages.filter(msg => msg.type === type);
  }
  
  // Clear message history
  clearMessages() {
    this.messages = [];
  }
  
  // Wait for a specific message type
  waitForMessage(type, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const check = () => {
        const message = this.messages.find(msg => msg.type === type);
        if (message) {
          resolve(message);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for ${type} message`));
        } else {
          setTimeout(check, 50);
        }
      };
      
      check();
    });
  }
}

/**
 * Test Server Simulator
 * Simulates server behavior for integration tests
 */
export class TestServerSimulator {
  constructor() {
    this.clients = new Map();
    this.matches = new Map();
    this.messageHandlers = new Map();
  }
  
  // Register a client
  registerClient(clientId, wsClient) {
    this.clients.set(clientId, wsClient);
    
    // Set up message handling
    wsClient.onMessage = (message) => {
      this.handleMessage(clientId, message);
    };
  }
  
  // Handle incoming messages from clients
  handleMessage(clientId, message) {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(clientId, message);
    } else {
      console.warn(`No handler for message type: ${message.type}`);
    }
  }
  
  // Register message handlers
  onMessage(type, handler) {
    this.messageHandlers.set(type, handler);
  }
  
  // Send message to specific client
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client) {
      client.receiveMessage(message);
    }
  }
  
  // Send message to all clients in a match
  sendToMatch(matchId, message, excludeClientId = null) {
    this.clients.forEach((client, clientId) => {
      if (client.matchId === matchId && clientId !== excludeClientId) {
        client.receiveMessage(message);
      }
    });
  }
  
  // Simulate client disconnect
  disconnectClient(clientId, code = 1000, reason = '') {
    const client = this.clients.get(clientId);
    if (client) {
      client.disconnect(code, reason);
      this.clients.delete(clientId);
      
      // Notify other clients in the same match
      if (client.matchId) {
        this.sendToMatch(client.matchId, {
          type: 'opponent_left',
          payload: { playerId: clientId }
        });
      }
    }
  }
  
  // Simulate client reconnect
  reconnectClient(clientId, wsClient) {
    const oldClient = this.clients.get(clientId);
    const matchId = oldClient?.matchId;
    
    // Register new client
    this.registerClient(clientId, wsClient);
    
    if (matchId) {
      wsClient.matchId = matchId;
      
      // Send full state to reconnected client
      const match = this.matches.get(matchId);
      if (match) {
        wsClient.receiveMessage({
          type: 'state',
          ...match
        });
      }
    }
  }
  
  // Create or update a match
  setMatch(matchId, matchData) {
    this.matches.set(matchId, matchData);
  }
  
  // Get match data
  getMatch(matchId) {
    return this.matches.get(matchId);
  }
}

/**
 * Integration Test Helper
 * Provides high-level methods for testing WebSocket scenarios
 */
export class WebSocketIntegrationTester {
  constructor() {
    this.server = new TestServerSimulator();
    this.clients = new Map();
    this.setupServerHandlers();
  }
  
  setupServerHandlers() {
    // Handle move messages
    this.server.onMessage('move', (clientId, message) => {
      const move = message.payload;
      const matchId = this.clients.get(clientId).matchId;
      
      if (!matchId) return;
      
      const match = this.server.getMatch(matchId);
      if (!match) return;
      
      // Add move to match
      if (!match.moves) match.moves = [];
      match.moves.push({
        playerId: clientId,
        choice: move.choice,
        timestamp: new Date().toISOString()
      });
      
      // Broadcast move to opponent
      this.server.sendToMatch(matchId, {
        type: 'move',
        payload: {
          move: {
            playerId: clientId,
            choice: move.choice,
            timestamp: new Date().toISOString()
          }
        }
      }, clientId);
      
      // Check if both players have moved
      if (match.moves.length % 2 === 0) {
        this.determineRoundResult(matchId);
      }
    });
    
    // Handle sync requests
    this.server.onMessage('sync_request', (clientId) => {
      const client = this.clients.get(clientId);
      const matchId = client.matchId;
      
      if (matchId) {
        const match = this.server.getMatch(matchId);
        if (match) {
          client.receiveMessage({
            type: 'state',
            ...match
          });
        }
      }
    });
    
    // Handle timeout
    this.server.onMessage('timeout', (clientId) => {
      const matchId = this.clients.get(clientId).matchId;
      
      if (matchId) {
        // Add timeout move
        const match = this.server.getMatch(matchId);
        if (match) {
          if (!match.moves) match.moves = [];
          match.moves.push({
            playerId: clientId,
            choice: 'timeout',
            timestamp: new Date().toISOString()
          });
          
          // Check if round should end
          if (match.moves.length % 2 === 0) {
            this.determineRoundResult(matchId);
          }
        }
      }
    });
  }
  
  determineRoundResult(matchId) {
    const match = this.server.getMatch(matchId);
    if (!match || !match.moves || match.moves.length < 2) return;
    
    // Get last two moves
    const moves = match.moves.slice(-2);
    const [move1, move2] = moves;
    
    // Determine winner
    let result;
    let winner;
    
    if (move1.choice === 'timeout' && move2.choice === 'timeout') {
      result = 'draw';
      winner = null;
    } else if (move1.choice === 'timeout') {
      result = 'win';
      winner = move2.playerId;
    } else if (move2.choice === 'timeout') {
      result = 'win';
      winner = move1.playerId;
    } else {
      // Regular RPS logic
      const rpsLogic = {
        rock: { beats: 'scissors', loses: 'paper' },
        paper: { beats: 'rock', loses: 'scissors' },
        scissors: { beats: 'paper', loses: 'rock' }
      };
      
      if (move1.choice === move2.choice) {
        result = 'draw';
        winner = null;
      } else if (rpsLogic[move1.choice].beats === move2.choice) {
        result = 'win';
        winner = move1.playerId;
      } else {
        result = 'win';
        winner = move2.playerId;
      }
    }
    
    const roundResult = {
      winner,
      result,
      player1_id: move1.playerId,
      player2_id: move2.playerId,
      moves: [move1, move2],
      round_number: Math.ceil(match.moves.length / 2)
    };
    
    // Send result to both players
    this.server.sendToMatch(matchId, {
      type: 'result',
      payload: { result: roundResult }
    });
  }
  
  // Create a test client
  createClient(clientId, options = {}) {
    const client = new WebSocketTestClient({
      playerId: clientId,
      matchId: options.matchId,
      ...options
    });
    
    this.clients.set(clientId, client);
    this.server.registerClient(clientId, client);
    
    return client;
  }
  
  // Create a test match
  createMatch(matchId, player1Id, player2Id) {
    const match = {
      id: matchId,
      player1: { id: player1Id, username: `player${player1Id}` },
      player2: { id: player2Id, username: `player${player2Id}` },
      status: 'active',
      wins_needed: 3,
      winner: null,
      moves: [],
      current_round: {
        round_number: 1,
        is_complete: false
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    this.server.setMatch(matchId, match);
    
    // Set matchId for clients
    const client1 = this.clients.get(player1Id);
    const client2 = this.clients.get(player2Id);
    
    if (client1) client1.matchId = matchId;
    if (client2) client2.matchId = matchId;
    
    return match;
  }
  
  // Connect clients
  connectClients(...clientIds) {
    clientIds.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client) {
        client.connect();
      }
    });
  }
  
  // Disconnect client
  disconnectClient(clientId, code = 1000, reason = '') {
    this.server.disconnectClient(clientId, code, reason);
  }
  
  // Reconnect client
  reconnectClient(clientId) {
    const oldClient = this.clients.get(clientId);
    const matchId = oldClient?.matchId;
    
    const newClient = new WebSocketTestClient({
      playerId: clientId,
      matchId
    });
    
    this.server.reconnectClient(clientId, newClient);
    this.clients.set(clientId, newClient);
    
    return newClient;
  }
  
  // Get client
  getClient(clientId) {
    return this.clients.get(clientId);
  }
  
  // Wait for message on specific client
  waitForMessage(clientId, type, timeout = 5000) {
    const client = this.getClient(clientId);
    if (client) {
      return client.waitForMessage(type, timeout);
    }
    return Promise.reject(new Error(`Client ${clientId} not found`));
  }
  
  // Cleanup
  cleanup() {
    this.clients.clear();
    this.server.clients.clear();
    this.server.matches.clear();
  }
}
