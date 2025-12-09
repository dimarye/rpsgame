import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MoveSelector } from './MoveSelector.jsx';

// Mock WebSocket hook
vi.mock('../../hooks/useWebSocket', () => ({
  useMatchWebSocket: () => ({
    sendJson: vi.fn(),
    isConnected: true,
  }),
}));

// Mock match store
vi.mock('../../store/matchStore', () => ({
  useMatchStore: () => ({
    currentMatch: {
      id: 1,
      player1: { id: 1, username: 'Player1' },
      player2: { id: 2, username: 'Player2' },
      status: 'active',
      rounds: [],
    },
    isPlayerTurn: true,
    hasCurrentPlayerMoved: false,
    currentRound: null,
    timeoutOccurred: false,
  }),
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('MoveSelector Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders move buttons when connected', () => {
    renderWithRouter(<MoveSelector />);
    
    expect(screen.getByText('Rock')).toBeInTheDocument();
    expect(screen.getByText('Paper')).toBeInTheDocument();
    expect(screen.getByText('Scissors')).toBeInTheDocument();
  });

  it('shows connecting message when not connected', () => {
    vi.mocked(require('../../hooks/useWebSocket').useMatchWebSocket).mockReturnValue({
      sendJson: vi.fn(),
      isConnected: false,
    });

    renderWithRouter(<MoveSelector />);
    
    expect(screen.getByText('Connecting to game server...')).toBeInTheDocument();
  });

  it('disables buttons when not player turn', () => {
    vi.mocked(require('../../store/matchStore').useMatchStore).mockReturnValue({
      currentMatch: {
        id: 1,
        player1: { id: 1, username: 'Player1' },
        player2: { id: 2, username: 'Player2' },
        status: 'active',
        rounds: [],
      },
      isPlayerTurn: false,
      hasCurrentPlayerMoved: false,
      currentRound: null,
      timeoutOccurred: false,
    });

    renderWithRouter(<MoveSelector />);
    
    const rockButton = screen.getByText('Rock');
    expect(rockButton).toBeDisabled();
  });

  it('disables buttons when player already moved', () => {
    vi.mocked(require('../../store/matchStore').useMatchStore).mockReturnValue({
      currentMatch: {
        id: 1,
        player1: { id: 1, username: 'Player1' },
        player2: { id: 2, username: 'Player2' },
        status: 'active',
        rounds: [],
      },
      isPlayerTurn: true,
      hasCurrentPlayerMoved: true,
      currentRound: null,
      timeoutOccurred: false,
    });

    renderWithRouter(<MoveSelector />);
    
    const rockButton = screen.getByText('Rock');
    expect(rockButton).toBeDisabled();
  });

  it('calls sendJson when move is selected', async () => {
    const mockSendJson = vi.fn();
    vi.mocked(require('../../hooks/useWebSocket').useMatchWebSocket).mockReturnValue({
      sendJson: mockSendJson,
      isConnected: true,
    });

    renderWithRouter(<MoveSelector />);
    
    const rockButton = screen.getByText('Rock');
    fireEvent.click(rockButton);
    
    await waitFor(() => {
      expect(mockSendJson).toHaveBeenCalledWith({
        type: 'move',
        payload: { choice: 'rock' }
      });
    });
  });

  it('shows loading state when move is being sent', async () => {
    const mockSendJson = vi.fn();
    vi.mocked(require('../../hooks/useWebSocket').useMatchWebSocket).mockReturnValue({
      sendJson: mockSendJson,
      isConnected: true,
    });

    renderWithRouter(<MoveSelector />);
    
    const rockButton = screen.getByText('Rock');
    fireEvent.click(rockButton);
    
    // Check for loading spinner
    await waitFor(() => {
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  it('displays move choices with correct styling', () => {
    renderWithRouter(<MoveSelector />);
    
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    
    buttons.forEach(button => {
      expect(button).toHaveClass('bg-gray-100', 'hover:bg-gray-200');
    });
  });
});
