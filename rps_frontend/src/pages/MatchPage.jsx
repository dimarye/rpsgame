import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import useWebSocket from '../hooks/useWebSocket';
import { getMatch, makeMove } from '../services/api';

const CHOICES = ['rock', 'paper', 'scissors'];
const GAME_RESULT = {
  WIN: 'You win!',
  LOSE: 'You lose!',
  DRAW: 'It\'s a draw!',
};

const MatchPage = () => {
  const { id: matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [match, setMatch] = useState(null);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gameResult, setGameResult] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // Fetch match data
  const fetchMatch = useCallback(async () => {
    try {
      const matchData = await getMatch(matchId);
      setMatch(matchData);
      
      // Check if game is already over
      if (matchData.status === 'finished') {
        setGameOver(true);
        setGameResult(
          matchData.winner?.id === user?.id 
            ? GAME_RESULT.WIN 
            : matchData.winner ? GAME_RESULT.LOSE : GAME_RESULT.DRAW
        );
      }
      
      // Check if game has started (both players joined)
      if (matchData.players?.length === 2) {
        setGameStarted(true);
      }
      
    } catch (error) {
      console.error('Error fetching match:', error);
      toast.error('Failed to load match');
      navigate('/lobby');
    } finally {
      setIsLoading(false);
    }
  }, [matchId, user?.id, navigate]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message) => {
    if (!message || typeof message !== 'object') {
      console.error('Invalid WebSocket message format:', message);
      return;
    }
    
    console.log('Received WebSocket message:', message);
    
    try {
      if (message.type === 'match_state') {
        setMatch(prev => ({
          ...prev,
          ...message,
          players: Array.isArray(message.players) ? message.players : (prev?.players || [])
        }));

        // Check if both players have joined and game is starting
        if (message.players?.length === 2 && message.status === 'in_progress') {
          console.log('Both players joined, starting game...');
          setGameStarted(true);
          startCountdown();
        }

        // Check if game is over
        if (message.status === 'finished') {
          console.log('Game over:', message);
          setGameOver(true);
          setGameResult(
            message.winner?.id === user?.id 
              ? GAME_RESULT.WIN 
              : message.winner ? GAME_RESULT.LOSE : GAME_RESULT.DRAW
          );
        }
      } else if (message.type === 'player_joined') {
        const username = message.username || 'Opponent';
        console.log('Player joined:', username);
        toast.success(`${username} has joined the match!`);
        
        // If this is the second player, update the match status
        if (match?.players?.length === 1) {
          console.log('Second player joined, updating match status...');
          try {
            // Send a message to start the game
            sendMessage({
              type: 'start_game',
              match_id: matchId
            });
          } catch (err) {
            console.error('Error sending start_game message:', err);
            toast.error('Failed to start the game. Please try again.');
          }
        }
      } else if (message.type === 'move_made') {
        console.log('Move made:', message);
        if (message.player_id !== user?.id && message.choice) {
          setOpponentChoice(message.choice);
        }
      } else if (message.type === 'error') {
        const errorMsg = message.error || 'An error occurred';
        console.error('WebSocket error:', errorMsg);
        toast.error(errorMsg);
      } else {
        console.log('Unhandled WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error, message);
    }
  }, [user?.id]);

  // State to track if we've sent the join message
  const [hasSentJoinMessage, setHasSentJoinMessage] = useState(false);
  
  // Get authentication state
  const { isAuthenticated } = useAuth();
  
  // Initialize WebSocket connection with error handling
  // Only initialize WebSocket when we have a match ID and user is authenticated
  const { sendMessage, isConnected, error } = useWebSocket(
    (matchId && user) ? `/match/${matchId}/` : null,
    handleWebSocketMessage
  );

  // Send join message when all conditions are met
  useEffect(() => {
    const joinMatch = async () => {
      // Only proceed if we have all required data and haven't sent the message yet
      if (isConnected && match && user?.id && !hasSentJoinMessage) {
        console.log('[MatchPage] Ready to send join message');
        
        try {
          // Create the join message
          const joinMessage = {
            type: 'join_match',
            match_id: matchId.toString(),
            player_id: user.id.toString(),
            username: user.username || `user_${user.id}`
          };
          
          console.log('[MatchPage] Sending join message:', joinMessage);
          
          // Send the message
          sendMessage(joinMessage);
          
          // Mark that we've sent the join message
          setHasSentJoinMessage(true);
          
        } catch (err) {
          console.error('[MatchPage] Error sending join message:', err);
          toast.error('Failed to join match. Please try again.');
          
          // Reset the flag to allow retry
          setHasSentJoinMessage(false);
        }
      } else if (!hasSentJoinMessage) {
        // Log why we're not sending the message yet
        console.log('[MatchPage] Not ready to send join message yet:', {
          isConnected,
          hasMatch: !!match,
          hasUser: !!user,
          userId: user?.id,
          matchId,
          hasSentJoinMessage
        });
      }
    };
    
    joinMatch();
    
    // Set up a retry mechanism in case the first attempt fails
    const retryTimer = setTimeout(() => {
      if (isConnected && match && user?.id && !hasSentJoinMessage) {
        console.log('[MatchPage] Retrying join message...');
        joinMatch();
      }
    }, 2000);
    
    return () => clearTimeout(retryTimer);
    
  }, [isConnected, match, user, matchId, sendMessage, hasSentJoinMessage]);
  
  // Handle WebSocket connection status changes
  useEffect(() => {
    console.log('[MatchPage] WebSocket status:', {
      isConnected,
      error,
      hasMatch: !!match,
      hasUser: !!user,
      userId: user?.id,
      matchId
    });
    
    if (error) {
      console.error('[MatchPage] WebSocket error:', error);
      toast.error('Connection error. Please refresh the page.');
    }
    
    // Reset join message flag if connection is lost
    if (!isConnected) {
      setHasSentJoinMessage(false);
    }
    
  }, [isConnected, error, match, user, matchId]);

  // Start countdown when both players are ready
  const startCountdown = () => {
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Handle player's move
  const handleMove = async (choice) => {
    if (!gameStarted || gameOver) return;
    
    try {
      setSelectedChoice(choice);
      await makeMove(matchId, choice);
      sendMessage({ type: 'move', choice });
    } catch (error) {
      console.error('Error making move:', error);
      toast.error('Failed to make move');
      setSelectedChoice(null);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchMatch();
  }, [fetchMatch]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Match not found or you don't have permission to view it.</p>
        <button 
          onClick={() => navigate('/lobby')} 
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  const player = match.players?.find(p => p.id === user?.id);
  const opponent = match.players?.find(p => p.id !== user?.id);

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Match #{matchId}</h1>
            <div className="text-sm text-gray-500">
              Status: <span className="font-medium">{match.status}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="font-medium">You</div>
              <div className="text-lg">{player?.username || 'Waiting...'}</div>
              {selectedChoice && (
                <div className="mt-2 text-indigo-600 font-semibold">
                  You chose: {selectedChoice}
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="font-medium">Opponent</div>
              <div className="text-lg">
                {opponent ? opponent.username : 'Waiting for opponent...'}
              </div>
              {opponentChoice && (
                <div className="mt-2 text-indigo-600 font-semibold">
                  Opponent chose: {opponentChoice}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className="bg-white shadow rounded-lg p-6">
          {!gameStarted ? (
            <div className="text-center py-8">
              <p className="text-lg text-gray-600">
                {!opponent ? 'Waiting for opponent to join...' : 'Ready to start the game!'}
              </p>
              {!opponent ? (
                <div className="mt-4 text-sm text-gray-500">
                  Share this match ID with a friend: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{matchId}</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    sendMessage({
                      type: 'start_game',
                      match_id: matchId
                    });
                    setGameStarted(true);
                    startCountdown();
                  }}
                  className="mt-4 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Start Game
                </button>
              )}
            </div>
          ) : countdown > 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl font-bold text-indigo-600">{countdown}</div>
              <p className="mt-4 text-gray-600">Get ready to play!</p>
            </div>
          ) : gameOver ? (
            <div className="text-center py-12">
              <div className={`text-3xl font-bold ${
                gameResult === GAME_RESULT.WIN ? 'text-green-600' : 
                gameResult === GAME_RESULT.LOSE ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {gameResult}
              </div>
              <button
                onClick={() => navigate('/lobby')}
                className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Back to Lobby
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 mt-4">
              {CHOICES.map((choice) => (
                <button
                  key={choice}
                  onClick={() => handleMove(choice)}
                  disabled={!!selectedChoice}
                  className={`p-6 rounded-lg border-2 border-indigo-200 flex flex-col items-center justify-center transition-all ${
                    selectedChoice === choice
                      ? 'bg-indigo-100 border-indigo-500'
                      : 'hover:bg-indigo-50 hover:border-indigo-300'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="text-4xl mb-2">
                    {choice === 'rock' ? '✊' : choice === 'paper' ? '✋' : '✌️'}
                  </div>
                  <span className="text-lg font-medium capitalize">{choice}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Game Log */}
        {match.moves?.length > 0 && (
          <div className="mt-8 bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Game Log</h2>
            <div className="space-y-2">
              {match.moves.map((move, index) => (
                <div key={index} className="flex justify-between py-2 border-b">
                  <span className="font-medium">
                    {move.player_id === user?.id ? 'You' : opponent?.username || 'Opponent'}
                  </span>
                  <span className="capitalize">chose {move.choice}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchPage;
