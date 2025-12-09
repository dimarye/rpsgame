import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import useMatchStore from '../store/useMatchStore';
import { WS_BASE_URL } from '../config/urls.js';

// Global socket management - prevents multiple connections
let activeSocket = null;
let currentMatchId = null;

// Fixed WebSocket URL for development
const getWebSocketUrl = () => {
  return WS_BASE_URL;
};

const useMatchWebSocket = (matchId) => {
  const ws = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeout = useRef(null);
  const heartbeatInterval = useRef(null);
  
  // Local connection state
  const [isConnected, setIsConnected] = useState(false);
  
  // Zustand store actions
  const {
    setConnectionStatus,
    setError,
    setOpponent,
    addMove,
    setResult,
    setCountdown,
    reset,
  } = useMatchStore();

  // Get auth token
  const getAuthToken = useCallback(() => {
    return localStorage.getItem('token');
  }, []);

  // Build WebSocket URL
  const buildWebSocketUrl = useCallback((matchId, token) => {
    const wsUrl = getWebSocketUrl();
    // Force strict ws://127.0.0.1:8000 format to prevent Chrome HTTP/2 conflicts
    const finalUrl = `${wsUrl}/match/${matchId}/?token=${encodeURIComponent(token)}`;
    console.log('[WebSocket] Final URL:', finalUrl);
    
    // Validate URL format
    if (!finalUrl.startsWith('ws://127.0.0.1:8000/ws/match/')) {
      console.warn('[WebSocket] URL format warning - should be ws://127.0.0.1:8000/ws/match/');
    }
    
    return finalUrl;
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[WebSocket] Cleaning up connection');
    
    // Clear heartbeat interval
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
    
    // Clear reconnect timeout
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    
    // Close WebSocket and clear global reference
    if (ws.current) {
      ws.current.onopen = null;
      ws.current.onclose = null;
      ws.current.onerror = null;
      ws.current.onmessage = null;
      
      if (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING) {
        ws.current.close();
      }
      
      // Clear global reference if this is the active socket
      if (activeSocket === ws.current) {
        activeSocket = null;
        currentMatchId = null;
      }
      
      ws.current = null;
    }
    
    setConnectionStatus(false);
  }, [setConnectionStatus]);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
    }
    
    heartbeatInterval.current = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        try {
          sendJson({ type: 'ping' });
        } catch (error) {
          console.error('[WebSocket] Heartbeat failed:', error);
          clearInterval(heartbeatInterval.current);
          heartbeatInterval.current = null;
        }
      }
    }, 25000); // 25 seconds
  }, []);

  // Handle full state synchronization
  const normalizeMoves = (moves) => {
    if (!Array.isArray(moves)) return [];
    return moves
      .map((move) => ({
        playerId: move.playerId ?? move.player_id,
        choice: move.choice,
        timestamp: move.timestamp ?? move.created_at ?? new Date().toISOString(),
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  const normalizeRounds = (rounds) => {
    if (!Array.isArray(rounds)) return [];
    return rounds.sort((a, b) => (a.round_number ?? 0) - (b.round_number ?? 0));
  };

  const handleFullStateSync = useCallback(async (stateData) => {
    console.log('[WebSocket] Handling full state sync:', stateData);
    
    try {
      // Get current store state with safety check
      const store = useMatchStore.getState();
      if (!store) {
        console.error('[WebSocket] Store not available for state sync');
        return;
      }
      
      // Update opponent info
      if (stateData.opponent) {
        setOpponent(stateData.opponent);
      }
      
      // Update moves array
      const { setMoves, setRounds, setWinsNeeded } = store;

      if (Array.isArray(stateData.moves) && typeof setMoves === 'function') {
        setMoves(normalizeMoves(stateData.moves));
      }

      if (Array.isArray(stateData.rounds) && typeof setRounds === 'function') {
        setRounds(normalizeRounds(stateData.rounds));
      }

      if (stateData.wins_needed !== undefined && typeof setWinsNeeded === 'function') {
        setWinsNeeded(stateData.wins_needed);
      }
      
      // Update countdown/timer
      if (stateData.timer) {
        if (stateData.timer.countdown !== undefined) {
          const { setCountdown } = store;
          if (setCountdown) {
            setCountdown(stateData.timer.countdown);
          }
        }
      }
      
      // Update match status
      if (stateData.status) {
        const { setMatchStatus } = store;
        if (setMatchStatus) {
          setMatchStatus(stateData.status);
        }
      }
      
      // Update current round info
      if (stateData.current_round) {
        const { setCurrentRound } = store;
        if (setCurrentRound) {
          setCurrentRound(stateData.current_round);
        }
      }
      
      // Update winner
      if (stateData.winner !== undefined) {
        const { setWinner } = store;
        if (setWinner) {
          setWinner(stateData.winner);
        }
      }
      
      console.log('[WebSocket] State sync completed successfully');
      toast.success('Game state synchronized');
      
    } catch (error) {
      console.error('[WebSocket] Error handling state sync:', error);
      setError('Failed to synchronize game state');
      toast.error('Failed to sync game state');
    }
  }, [setOpponent, setError]);

  // Handle incoming messages
  const handleMessage = useCallback((data) => {
    console.log('[WebSocket] Message received:', data);
    
    switch (data.type) {
      case 'pong':
        // Heartbeat response
        console.log('[WebSocket] Heartbeat response received');
        break;
        
      case 'join':
      case 'player_joined': {
        // Player joined the match. Backend sometimes sends `player_joined`
        // instead of `join`, so normalize both.
        const joiningPlayer =
          data.payload?.player ??
          (data.player_id && data.username
            ? { id: data.player_id, username: data.username, is_online: true }
            : null);

        if (joiningPlayer) {
          const { playerId } = useMatchStore.getState();
          // Only set opponent if this isn't the current user.
          if (!playerId || joiningPlayer.id !== playerId) {
            setOpponent({
              id: joiningPlayer.id,
              username: joiningPlayer.username,
              is_online: true,
            });
          }
          toast.success(`${joiningPlayer.username} joined the match`);
        }
        break;
      }
        
      case 'move':
        // Server acknowledgement that the current player made a move.
        // We no longer mutate local state here to avoid duplicating moves,
        // since the authoritative `move_made` broadcast keeps both players in sync.
        console.log('[WebSocket] Move acknowledgement received:', data);
        break;
        
      case 'state':
        // Full state synchronization response
        console.log('[WebSocket] Received full state:', data);
        if (data) {
          handleFullStateSync(data);
        }
        break;

      case 'match_state': {
        // Match state update from backend (includes moves, rounds, status, winner)
        console.log('[WebSocket] Received match_state:', data);
        try {
          const store = useMatchStore.getState();
          if (!store) break;

          const {
            setMoves,
            setMatchStatus,
            setWinner,
            setOpponent,
            setResult,
            setRounds,
            setWinsNeeded,
            playerId,
            matchStatus,
          } = store;

          const finishedJustNow =
            data.status === 'finished' && matchStatus !== 'finished';

          const emitMatchResult = () => {
            if (
              typeof setResult !== 'function' ||
              !playerId ||
              !finishedJustNow
            ) {
              return;
            }

            const rounds = Array.isArray(data.rounds) ? data.rounds : [];
            const summary = rounds.reduce(
              (acc, round) => {
                if (round?.is_draw || !round?.winner?.id) {
                  return acc;
                }
                if (round.winner.id === playerId) {
                  acc.playerWins += 1;
                } else {
                  acc.opponentWins += 1;
                }
                return acc;
              },
              {
                playerWins: 0,
                opponentWins: 0,
                totalRounds: rounds.length,
              }
            );

            const resultType =
              data.winner == null
                ? 'draw'
                : data.winner === playerId
                ? 'win'
                : 'lose';

            setResult({
              scope: 'match',
              winner: data.winner,
              result: resultType,
              winsNeeded: data.wins_needed,
              summary,
              timestamp: new Date().toISOString(),
            });

            if (resultType === 'draw') {
              toast("Match ends in a draw ⚖️");
            } else if (resultType === 'win') {
              toast.success('Match victory! 🏆');
            } else {
              toast.error('Match defeat 😔');
            }
          };

          // Normalize and update moves so Game History and stats reflect both players' moves
          if (Array.isArray(data.moves) && typeof setMoves === 'function') {
            setMoves(normalizeMoves(data.moves));
          }

          if (Array.isArray(data.rounds) && typeof setRounds === 'function') {
            setRounds(normalizeRounds(data.rounds));
          }

          if (data.wins_needed !== undefined && typeof setWinsNeeded === 'function') {
            setWinsNeeded(data.wins_needed);
          }

          // Update match status (e.g., active -> finished)
          if (typeof setMatchStatus === 'function' && data.status) {
            setMatchStatus(data.status);
          }

          // Update match winner id if present
          if (typeof setWinner === 'function' && data.winner !== undefined) {
            setWinner(data.winner);
          }

          // Derive opponent from players list for this client
          if (Array.isArray(data.players) && typeof setOpponent === 'function' && playerId) {
            const opponent = data.players.find((p) => p && p.id !== playerId) || null;
            if (opponent) {
              setOpponent({
                id: opponent.id,
                username: opponent.username,
                is_online: true,
              });
            }
          }

          // For matches that finish without a `round_complete` event (final round),
          // emit a celebratory overlay.
          if (finishedJustNow) {
            emitMatchResult();
          }

          // For legacy best-of-1 matches without round_complete events, also provide
          // a round-style message so the last exchange still shows in-game.
          if (
            finishedJustNow &&
            data.wins_needed &&
            data.wins_needed <= 1 &&
            typeof setResult === 'function' &&
            playerId
          ) {
            try {
              let resultType = 'draw';
              let roundWinnerId = null;
              let roundNumber = 1;

              if (Array.isArray(data.rounds) && data.rounds.length > 0) {
                const lastRound = data.rounds[data.rounds.length - 1];
                roundNumber = lastRound.round_number ?? data.rounds.length;
                if (lastRound.winner && lastRound.winner.id) {
                  roundWinnerId = lastRound.winner.id;
                }
                const isDraw = !!lastRound.is_draw;

                if (!isDraw) {
                  if (roundWinnerId && roundWinnerId === playerId) {
                    resultType = 'win';
                  } else {
                    resultType = 'lose';
                  }
                }
              } else if (data.winner !== undefined) {
                // Fallback to overall match winner if rounds are not available
                roundWinnerId = data.winner;
                if (data.winner === null) {
                  resultType = 'draw';
                } else if (data.winner === playerId) {
                  resultType = 'win';
                } else {
                  resultType = 'lose';
                }
              }

              setResult({
                scope: 'match',
                winner: roundWinnerId,
                result: resultType,
                roundNumber,
                timestamp: new Date().toISOString(),
              });

              if (resultType === 'draw') {
                toast("It's a draw! 🤝");
              } else if (resultType === 'win') {
                toast.success('You won this round! 🎉');
              } else if (resultType === 'lose') {
                toast.error('You lost this round 😔');
              }
            } catch (e) {
              console.error('[WebSocket] Error deriving round result from match_state:', e);
            }
          }
        } catch (error) {
          console.error('[WebSocket] Error handling match_state:', error);
        }
        break;
      }

      case 'move_made': {
        // Single move notification from backend; keep moves in sync between players
        console.log('[WebSocket] Move made:', data);
        try {
          const store = useMatchStore.getState();
          if (!store) break;

          const { addMove } = store;
          if (typeof addMove !== 'function') break;

          if (data.player_id && data.choice) {
            addMove({
              playerId: data.playerId ?? data.player_id,
              choice: data.choice,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error('[WebSocket] Error handling move_made:', error);
        }
        break;
      }

      case 'round_complete': {
        // Round completion notification with basic winner info
        console.log('[WebSocket] Round complete:', data);
        try {
          const store = useMatchStore.getState();
          if (!store) break;

          const { playerId, setResult } = store;
          if (typeof setResult !== 'function') break;

          const roundWinnerId = data.winner ? data.winner.id : null;

          let resultType = 'draw';
          if (!data.is_draw) {
            if (roundWinnerId && playerId && roundWinnerId === playerId) {
              resultType = 'win';
            } else {
              resultType = 'lose';
            }
          }

          setResult({
            scope: 'round',
            winner: roundWinnerId,
            result: resultType,
            roundNumber: data.round_number,
            timestamp: new Date().toISOString(),
          });

          // Show a small toast notification with the round result
          if (resultType === 'draw') {
            toast("It's a draw! 🤝");
          } else if (resultType === 'win') {
            toast.success('You won this round! 🎉');
          } else if (resultType === 'lose') {
            toast.error('You lost this round 😔');
          }
        } catch (error) {
          console.error('[WebSocket] Error handling round_complete:', error);
        }
        break;
      }

      case 'result':
        // Round result
        if (data.payload?.result) {
          setResult(data.payload.result);
          
          // Show toast notification
          const { winner, result } = data.payload.result;
          if (result === 'draw') {
            toast("It's a draw! 🤝");
          } else if (winner === 'player1' || winner === 'player2') {
            // Determine if current player won
            const { playerId } = useMatchStore.getState();
            const isWinner = (winner === 'player1' && playerId === data.payload.result.player1_id) ||
                           (winner === 'player2' && playerId === data.payload.result.player2_id);
            toast(isWinner ? 'You win! 🎉' : 'You lose 😔');
          }
        }
        break;
        
      case 'opponent_left':
        // Opponent left the match
        toast.dismiss(); // Clear any existing toasts
        toast.info('Opponent left the match', {
          duration: 4000,
          icon: '👋'
        });
        setOpponent(null);
        break;
        
      case 'error': {
        // Server error
        // Backend send_error currently sends { type: 'error', error: message }
        // but we also support a payload-based shape for future-proofing
        console.error('[WebSocket] Server error message:', data);
        const errorMessage =
          (data.payload && (data.payload.message || data.payload.error)) ||
          data.error ||
          data.message ||
          'An error occurred';

        // Treat "Game is not in progress" as a normal end-of-match, not a connection error
        if (errorMessage === 'Game is not in progress') {
          try {
            const store = useMatchStore.getState();
            if (store) {
              const { setMatchStatus, setError: setStoreError } = store;
              if (typeof setMatchStatus === 'function') {
                setMatchStatus('finished');
              }
              if (typeof setStoreError === 'function') {
                setStoreError(null);
              }
            }
          } catch (e) {
            console.error('[WebSocket] Error handling end-of-match error:', e);
          }

          toast.dismiss();
          toast.success('Match finished. Start a new game from the lobby.');
          break;
        }

        setError(errorMessage);
        toast.dismiss(); // Clear any existing toasts
        toast.error(errorMessage);
        break;
      }
        
      case 'timeout':
        // Move timeout - show timeout result and block buttons
        toast.dismiss(); // Clear any existing toasts
        toast.warning('Time\'s up! Round ended.', {
          duration: 3000,
          icon: '⏰'
        });
        
        // Set timeout state to block buttons
        const { setTimeoutOccurred } = useMatchStore.getState();
        if (setTimeoutOccurred) {
          setTimeoutOccurred(true);
        }
        break;
        
      default:
        console.warn('[WebSocket] Unknown message type:', data.type);
    }
  }, [setOpponent, addMove, setResult, setCountdown, setError, handleFullStateSync]);

  // Send JSON message
  const sendJson = useCallback((data) => {
    // Use global socket if local ref is not set, so multiple hook instances share the same connection
    const storeState = useMatchStore.getState();
    const storeConnected = storeState?.isConnected;
    const socket = ws.current || activeSocket;

    const stateNames = {
      [WebSocket.CONNECTING]: 'CONNECTING (0)',
      [WebSocket.OPEN]: 'OPEN (1)',
      [WebSocket.CLOSING]: 'CLOSING (2)',
      [WebSocket.CLOSED]: 'CLOSED (3)'
    };

    const readyState = socket?.readyState;
    console.log(
      `[WebSocket] Send attempt - ReadyState: ${stateNames[readyState] || readyState}, storeConnected: ${storeConnected}`
    );

    if (!socket || readyState !== WebSocket.OPEN || !storeConnected) {
      console.warn(
        `[WebSocket] Cannot send message - not connected. State: ${stateNames[readyState] || readyState}`
      );
      toast.error('Not connected to game server. Please wait...');
      return false;
    }

    try {
      const message = JSON.stringify(data);
      console.log('[WebSocket] Sending message:', data);
      socket.send(message);
      console.log('[WebSocket] Message sent successfully');
      return true;
    } catch (error) {
      console.error('[WebSocket] Error sending message:', error);
      setError('Failed to send message');
      toast.error('Failed to send message to server');
      return false;
    }
  }, [setError]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!matchId) {
      console.error('[WebSocket] No match ID provided');
      return;
    }

    // Prevent multiple connections to same match
    if (activeSocket && activeSocket.readyState === WebSocket.OPEN && currentMatchId === matchId) {
      console.warn('[WebSocket] Already connected to this match, reusing existing socket');
      ws.current = activeSocket;
      setConnectionStatus(true);
      return;
    }

    // Close existing socket if different match
    if (activeSocket && currentMatchId !== matchId) {
      console.log('[WebSocket] Closing previous socket for different match');
      activeSocket.close();
      activeSocket = null;
      currentMatchId = null;
    }

    // Clean up existing connection
    cleanup();

    const token = getAuthToken();
    if (!token) {
      const errorMsg = 'No authentication token found';
      setError(errorMsg);
      toast.error('Please log in to continue');
      return;
    }

    // Add small delay to prevent race conditions with token application
    setTimeout(() => {
      try {
        const wsUrl = buildWebSocketUrl(matchId, token);
        console.log('[WebSocket] Connecting to:', wsUrl);
        
        ws.current = new WebSocket(wsUrl);
        activeSocket = ws.current;
        currentMatchId = matchId;

        ws.current.onopen = () => {
          console.log('[WebSocket] Connected');
          
          // Set local connection state
          setIsConnected(true);
          
          // Check if this is a reconnect (not initial connection)
          const isReconnect = reconnectAttempts.current > 0;
          
          reconnectAttempts.current = 0;
          setConnectionStatus(true);
          setError(null);
          startHeartbeat();
          
          // Send initial message immediately after connection opens
          console.log('[WebSocket] Sending initial sync request');
          setTimeout(() => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({ type: 'sync_request' }));
              console.log('[WebSocket] Initial sync sent');
            }
          }, 100); // Small delay to ensure connection is fully established
          
          // Show reconnection success message
          if (isReconnect) {
            toast.dismiss(); // Clear any loading toast
            toast.success('Reconnected successfully!');
            console.log('[WebSocket] Requesting state sync after reconnect');
            sendJson({ type: 'sync_request' });
          }
        };

        ws.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleMessage(data);
          } catch (error) {
            console.error('[WebSocket] Error parsing message:', error);
            setError('Error parsing server message');
          }
        };

        ws.current.onclose = (event) => {
          console.log(`[WebSocket] Disconnected - Code: ${event.code}, Reason: ${event.reason}`);
          
          // Set local connection state
          setIsConnected(false);
          setConnectionStatus(false);
          
          // Clear global socket reference
          if (activeSocket === ws.current) {
            activeSocket = null;
            currentMatchId = null;
          }
          
          // Clear heartbeat
          if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current);
            heartbeatInterval.current = null;
          }

          // Don't reconnect on normal closure
          if (event.code === 1000) {
            console.log('[WebSocket] Normal closure - not reconnecting');
            return;
          }

          // Handle token expiration
          if (event.code === 4001) {
            console.log('[WebSocket] Token expired - need to re-login');
            toast.error('Session expired. Please log in again.');
            return;
          }

          // Handle unexpected disconnections
          console.log(`[WebSocket] Unexpected disconnection - Code: ${event.code}`);
          toast.error('Connection lost. Attempting to reconnect...');

          // Simple reconnect with delay
          setTimeout(() => {
            if (matchId && !ws.current) {
              console.log('[WebSocket] Attempting to reconnect...');
              connect();
            }
          }, 2000); // 2 second delay
        };

        ws.current.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          setError('Connection error');
        };

      } catch (error) {
        console.error('[WebSocket] Connection failed:', error);
        setError('Failed to connect');
      }
    }, 50); // 50ms delay to prevent race conditions
  }, [matchId, cleanup, getAuthToken, buildWebSocketUrl, setConnectionStatus, setError, startHeartbeat, handleMessage]);

  // Manual disconnect
  const disconnect = useCallback(() => {
    console.log('[WebSocket] Manual disconnect');
    cleanup();
  }, [cleanup]);

  // Force reconnect
  const forceReconnect = useCallback(() => {
    console.log('[WebSocket] Force reconnect');
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  // Manual sync request
  const requestSync = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Manual sync request');
      sendJson({ type: 'sync_request' });
      return true;
    } else {
      console.error('[WebSocket] Cannot request sync - not connected');
      setError('Not connected to server');
      toast.error('Cannot sync - connection lost');
      return false;
    }
  }, [sendJson, setError]);

  // Initialize connection - REMOVED auto-connect to prevent double connections
  // MatchPage will manually call connect() when needed
  useEffect(() => {
    // Only cleanup on unmount, don't auto-connect
    return () => {
      // Only cleanup if this is the current match
      if (currentMatchId === matchId) {
        console.log('[WebSocket] Cleaning up connection for match:', matchId);
        cleanup();
      }
    };
  }, [matchId, cleanup]);

  return {
    sendJson,
    connect, // Export connect for manual control
    disconnect,
    forceReconnect,
    requestSync,
    isConnected, // Export connection state for UI components
  };
};

export default useMatchWebSocket;
