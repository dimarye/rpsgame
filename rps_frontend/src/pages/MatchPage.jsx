import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import useMatchWebSocket from '../hooks/useWebSocket';
import useMatchStore, { useMatchActions } from '../store/useMatchStore';
import { getMatch, makeMove } from '../services/api';
import toast from 'react-hot-toast';
import MatchLayout from '../components/match/MatchLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import NetworkStatus from '../components/NetworkStatus';

const GAME_RESULT = {
  WIN: 'You Win! 🎉',
  LOSE: 'You Lose 😔',
  DRAW: 'It\'s a Draw! 🤝'
};

const CHOICES = ['rock', 'paper', 'scissors'];

const MatchPage = () => {
  const { id: matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Zustand store
  const { 
    matchId: storeMatchId, 
    playerId, 
    opponent, 
    moves, 
    roundResult, 
    isConnected, 
    error, 
    countdown,
    isPlayerTurn 
  } = useMatchStore();
  
  // Store actions
  const { 
    initMatch, 
    setOpponent, 
    addMove, 
    setResult, 
    resetRound,
    setError: setStoreError 
  } = useMatchActions();
  
  // WebSocket hook
  const { sendJson, connect, requestSync } = useMatchWebSocket(matchId);
  
  // Local state
  const [match, setMatch] = useState(null);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gameResult, setGameResult] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // Initialize match when component mounts
  useEffect(() => {
    if (matchId && user) {
      initMatch(matchId, user.id);
      // Manually connect WebSocket - prevents double connections
      setTimeout(() => {
        connect();
      }, 100); // Small delay to prevent race conditions
    }
  }, [matchId, user, initMatch, connect]);

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

  // Handle move selection
  const handleChoiceSelect = useCallback((choice) => {
    if (!isConnected || !isPlayerTurn() || gameOver) {
      return;
    }
    
    setSelectedChoice(choice);

    const success = sendJson({
      type: 'move',
      choice,
    });

    if (success) {
      toast.success(`You chose ${choice}!`);
    } else {
      toast.error('Failed to send move');
      setSelectedChoice(null);
    }
    return success;
  }, [isConnected, isPlayerTurn, gameOver, sendJson]);

  // Reset for next round
  const handleNextRound = useCallback(() => {
    resetRound();
    setSelectedChoice(null);
    setGameResult(null);
  }, [resetRound]);

  // Initialize match data
  useEffect(() => {
    if (matchId) {
      fetchMatch();
    }
  }, [matchId, fetchMatch]);

  // Handle round result from store
  useEffect(() => {
    if (roundResult) {
      const { winner, result } = roundResult;
      if (result === 'draw') {
        setGameResult(GAME_RESULT.DRAW);
      } else if (winner === user?.id) {
        setGameResult(GAME_RESULT.WIN);
      } else {
        setGameResult(GAME_RESULT.LOSE);
      }
    }
  }, [roundResult, user?.id]);

  // Handle loading and error states
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Connection Error</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Reload Page
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <NetworkStatus />
      <MatchLayout
        match={match}
        user={user}
        opponent={opponent}
        isConnected={isConnected}
        moves={moves}
        countdown={countdown}
        gameResult={gameResult}
        selectedChoice={selectedChoice}
        isPlayerTurn={isPlayerTurn()}
        onChoiceSelect={handleChoiceSelect}
        requestSync={requestSync}
        onNextRound={handleNextRound}
        gameOver={gameOver}
      />
    </ErrorBoundary>
  );
};

export default MatchPage;
