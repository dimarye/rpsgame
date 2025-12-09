import React from 'react';
import useMatchStore from '../../store/useMatchStore';

const MoveLog = () => {
  const { moves, playerId } = useMatchStore();

  const getChoiceEmoji = (choice) => {
    switch (choice) {
      case 'rock':
        return '✊';
      case 'paper':
        return '✋';
      case 'scissors':
        return '✌️';
      default:
        return '❓';
    }
  };

  const getResultEmoji = (result) => {
    switch (result) {
      case 'win':
        return '🎉';
      case 'lose':
        return '😔';
      case 'draw':
        return '🤝';
      default:
        return '⏳';
    }
  };

  const getResultColor = (result) => {
    switch (result) {
      case 'win':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'lose':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'draw':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Group moves by rounds (2 moves per round)
  const groupMovesByRounds = () => {
    const rounds = [];
    for (let i = 0; i < moves.length; i += 2) {
      const roundMoves = moves.slice(i, i + 2);
      if (roundMoves.length === 2) {
        const playerMove = roundMoves.find(m => m.playerId === playerId);
        const opponentMove = roundMoves.find(m => m.playerId !== playerId);
        
        rounds.push({
          roundNumber: Math.floor(i / 2) + 1,
          playerMove: playerMove?.choice,
          opponentMove: opponentMove?.choice,
          timestamp: playerMove?.timestamp || opponentMove?.timestamp,
          result: determineRoundResult(playerMove?.choice, opponentMove?.choice)
        });
      }
    }
    return rounds;
  };

  const determineRoundResult = (playerChoice, opponentChoice) => {
    if (!playerChoice || !opponentChoice) return 'pending';
    if (playerChoice === opponentChoice) return 'draw';
    
    const winConditions = {
      rock: 'scissors',
      paper: 'rock',
      scissors: 'paper'
    };
    
    return winConditions[playerChoice] === opponentChoice ? 'win' : 'lose';
  };

  const rounds = groupMovesByRounds();

  if (!moves || moves.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Game History</h3>
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📝</div>
          <p className="text-sm">No moves yet</p>
          <p className="text-xs mt-1">Game history will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Game History</h3>
        <span className="text-sm text-gray-500">{rounds.length} rounds</span>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {rounds.map((round) => (
          <div
            key={`round-${round.roundNumber}`}
            className="border rounded-lg p-4 transition-all duration-300 hover:shadow-md"
          >
            {/* Round Header */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">
                Round {round.roundNumber}
              </span>
              <span className="text-xs text-gray-500">
                {formatTimestamp(round.timestamp)}
              </span>
            </div>

            {/* Moves Comparison */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              {/* Player Move */}
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">You</div>
                <div className="text-2xl mb-1">{getChoiceEmoji(round.playerMove)}</div>
                <div className="text-xs font-medium capitalize text-gray-700">
                  {round.playerMove || 'Waiting...'}
                </div>
              </div>

              {/* VS Separator */}
              <div className="flex items-center justify-center">
                <div className="text-xs text-gray-400 font-medium">VS</div>
              </div>

              {/* Opponent Move */}
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Opponent</div>
                <div className="text-2xl mb-1">{getChoiceEmoji(round.opponentMove)}</div>
                <div className="text-xs font-medium capitalize text-gray-700">
                  {round.opponentMove || 'Waiting...'}
                </div>
              </div>
            </div>

            {/* Result */}
            {round.result !== 'pending' && (
              <div className="flex justify-center">
                <span className={`
                  inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium border
                  ${getResultColor(round.result)}
                `}>
                  <span>{getResultEmoji(round.result)}</span>
                  <span className="capitalize">
                    {round.result === 'win' ? 'You Won!' : 
                     round.result === 'lose' ? 'You Lost' : 'Draw'}
                  </span>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      {rounds.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-green-50 rounded-lg p-2">
              <div className="text-lg font-semibold text-green-600">
                {rounds.filter(r => r.result === 'win').length}
              </div>
              <div className="text-xs text-green-700">Wins</div>
            </div>
            <div className="bg-red-50 rounded-lg p-2">
              <div className="text-lg font-semibold text-red-600">
                {rounds.filter(r => r.result === 'lose').length}
              </div>
              <div className="text-xs text-red-700">Losses</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-2">
              <div className="text-lg font-semibold text-yellow-600">
                {rounds.filter(r => r.result === 'draw').length}
              </div>
              <div className="text-xs text-yellow-700">Draws</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoveLog;
