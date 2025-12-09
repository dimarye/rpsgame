import React from 'react';
import useMatchStore from '../store/useMatchStore';

const MatchStatus = () => {
  const {
    matchId,
    playerId,
    opponent,
    moves,
    roundResult,
    isConnected,
    error,
    countdown,
    roundNumber,
    isPlayerTurn,
    getCurrentRoundMoves,
  } = useMatchStore();

  const currentRoundMoves = getCurrentRoundMoves();

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Match Status</h2>
      
      <div className="space-y-2">
        <div>
          <span className="font-semibold">Match ID:</span> {matchId || 'Not set'}
        </div>
        
        <div>
          <span className="font-semibold">Player ID:</span> {playerId || 'Not set'}
        </div>
        
        <div>
          <span className="font-semibold">Opponent:</span> {opponent?.username || 'Waiting...'}
        </div>
        
        <div>
          <span className="font-semibold">Round:</span> {roundNumber}
        </div>
        
        <div>
          <span className="font-semibold">Connection:</span> 
          <span className={`ml-2 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        {countdown !== null && (
          <div>
            <span className="font-semibold">Countdown:</span> {countdown}s
          </div>
        )}
        
        <div>
          <span className="font-semibold">Total Moves:</span> {moves.length}
        </div>
        
        <div>
          <span className="font-semibold">Current Round Moves:</span> {currentRoundMoves.length}/2
        </div>
        
        <div>
          <span className="font-semibold">Your Turn:</span> 
          <span className={`ml-2 ${isPlayerTurn() ? 'text-green-600' : 'text-red-600'}`}>
            {isPlayerTurn() ? 'Yes' : 'No'}
          </span>
        </div>
        
        {roundResult && (
          <div>
            <span className="font-semibold">Last Result:</span> 
            <span className={`ml-2 ${
              roundResult.winner === playerId ? 'text-green-600' : 
              roundResult.winner === 'draw' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {roundResult.winner === 'draw' ? 'Draw' : 
               roundResult.winner === playerId ? 'You Win' : 'You Lose'}
            </span>
          </div>
        )}
        
        {error && (
          <div className="text-red-600">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchStatus;
