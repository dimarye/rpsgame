import { vi } from 'vitest';

// Mock WebSocket for testing
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

// Mock toast notifications
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn()
};

vi.mock('react-hot-toast', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    toast: mockToast,
    ...mockToast
  };
});

// Make toast available globally for tests
global.toast = mockToast;

// Mock React Router
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useParams: () => ({ id: 'test-match-id' }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, ...props }) => ({ type: 'a', href: to, children, ...props }),
  BrowserRouter: ({ children }) => ({ type: 'div', children })
}));

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser' },
    token: 'test-token',
    login: vi.fn(),
    logout: vi.fn(),
    loading: false
  })
}));

// Setup and cleanup
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset localStorage
  localStorage.clear();
  
  // Reset sessionStorage
  sessionStorage.clear();
});

afterEach(() => {
  // Cleanup handled by individual tests
});

// Global test utilities
global.createMockWebSocket = (options = {}) => {
  const mockWs = {
    close: vi.fn(),
    send: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: WebSocket.OPEN,
    CONNECTING: WebSocket.CONNECTING,
    OPEN: WebSocket.OPEN,
    CLOSING: WebSocket.CLOSING,
    CLOSED: WebSocket.CLOSED,
    ...options
  };
  
  // Mock the WebSocket constructor
  global.WebSocket.mockImplementation(() => mockWs);
  
  return mockWs;
};

global.createMockStore = (initialState = {}) => {
  const state = {
    matchId: null,
    playerId: 1,
    opponent: null,
    moves: [],
    roundResult: null,
    isConnected: false,
    error: null,
    countdown: null,
    roundNumber: 1,
    matchStatus: 'waiting',
    currentRound: null,
    winner: null,
    timeoutOccurred: false,
    ...initialState
  };
  
  const store = {
    getState: () => state,
    setState: (updates) => Object.assign(state, updates),
    subscribe: vi.fn(),
    destroy: vi.fn()
  };
  
  return store;
};

// Helper function to wait for async operations
global.waitFor = (condition, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(check, 50);
      }
    };
    
    check();
  });
};

// Helper to simulate WebSocket messages
global.simulateWebSocketMessage = (ws, message) => {
  const event = {
    data: JSON.stringify(message)
  };
  
  // Find and call the message event handler
  const messageHandler = ws.addEventListener.mock.calls.find(call => call[0] === 'message')?.[1];
  if (messageHandler) {
    messageHandler(event);
  }
};

// Helper to simulate WebSocket close
global.simulateWebSocketClose = (ws, code = 1000, reason = '') => {
  const event = { code, reason };
  
  // Find and call the close event handler
  const closeHandler = ws.addEventListener.mock.calls.find(call => call[0] === 'close')?.[1];
  if (closeHandler) {
    closeHandler(event);
  }
};

// Helper to simulate WebSocket open
global.simulateWebSocketOpen = (ws) => {
  // Find and call the open event handler
  const openHandler = ws.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
  if (openHandler) {
    openHandler();
  }
};

// Mock match data for testing
global.createMockMatch = (overrides = {}) => ({
  id: 'test-match-id',
  player1: { id: 1, username: 'player1' },
  player2: { id: 2, username: 'player2' },
  status: 'active',
  wins_needed: 3,
  winner: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

// Mock move data for testing
global.createMockMove = (playerId, choice, overrides = {}) => ({
  playerId,
  choice,
  timestamp: new Date().toISOString(),
  ...overrides
});

// Mock round result for testing
global.createMockResult = (winner, result, overrides = {}) => ({
  winner,
  result,
  player1_id: 1,
  player2_id: 2,
  moves: [
    createMockMove(1, 'rock'),
    createMockMove(2, 'paper')
  ],
  ...overrides
});
