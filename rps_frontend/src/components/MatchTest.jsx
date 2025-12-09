import React from 'react';
import useMatchStore, { useMatchActions } from '../store/useMatchStore';
import MatchStatus from './MatchStatus';

const MatchTest = () => {
  const { matchId, playerId, opponent, moves, roundResult, isConnected } = useMatchStore();
  const {
    initMatch,
    setOpponent,
    addMove,
    setResult,
    resetRound,
    setConnectionStatus,
    setError,
    setCountdown,
    incrementRound,
    reset,
  } = useMatchActions();

  const handleInitMatch = () => {
    initMatch('match-123', 'player-456');
  };

  const handleSetOpponent = () => {
    setOpponent({ id: 'player-789', username: 'Opponent123' });
  };

  const handleAddMove = () => {
    const moves = ['rock', 'paper', 'scissors'];
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    addMove({
      playerId: playerId,
      choice: randomMove,
      timestamp: new Date().toISOString(),
    });
  };

  const handleSetResult = () => {
    setResult({
      winner: Math.random() > 0.5 ? playerId : 'draw',
      result: 'win',
      timestamp: new Date().toISOString(),
    });
  };

  const handleSetConnection = (connected) => {
    setConnectionStatus(connected);
  };

  const handleSetCountdown = () => {
    setCountdown(Math.floor(Math.random() * 30) + 1);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Match Store Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-3">Actions</h3>
          <div className="space-y-2">
            <button
              onClick={handleInitMatch}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Init Match
            </button>
            
            <button
              onClick={handleSetOpponent}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Set Opponent
            </button>
            
            <button
              onClick={handleAddMove}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Add Random Move
            </button>
            
            <button
              onClick={handleSetResult}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Set Random Result
            </button>
            
            <button
              onClick={() => handleSetConnection(true)}
              className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
            >
              Connect
            </button>
            
            <button
              onClick={() => handleSetConnection(false)}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Disconnect
            </button>
            
            <button
              onClick={handleSetCountdown}
              className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
            >
              Set Random Countdown
            </button>
            
            <button
              onClick={incrementRound}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              Next Round
            </button>
            
            <button
              onClick={resetRound}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Reset Round
            </button>
            
            <button
              onClick={reset}
              className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800"
            >
              Reset All
            </button>
          </div>
        </div>
        
        <MatchStatus />
      </div>
    </div>
  );
};

export default MatchTest;
