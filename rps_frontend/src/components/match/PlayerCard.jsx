import React from 'react';

const PlayerCard = ({ 
  name, 
  avatar, 
  choice, 
  score, 
  isCurrentPlayer, 
  isActive, 
  status 
}) => {
  const getChoiceEmoji = (choice) => {
    switch (choice) {
      case 'rock':
        return '✊';
      case 'paper':
        return '✋';
      case 'scissors':
        return '✌️';
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ready':
        return 'text-green-600 bg-green-100';
      case 'chosen':
        return 'text-blue-600 bg-blue-100';
      case 'thinking':
        return 'text-yellow-600 bg-yellow-100';
      case 'waiting':
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'chosen':
        return 'Choice made';
      case 'thinking':
        return 'Thinking...';
      case 'waiting':
      default:
        return 'Waiting';
    }
  };

  return (
    <div className={`bg-white rounded-2xl shadow-lg p-6 transition-all duration-300 ${
      isActive ? 'ring-4 ring-indigo-500 ring-opacity-50 transform scale-105' : ''
    }`}>
      {/* Player Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {/* Avatar */}
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
            isCurrentPlayer ? 'bg-indigo-600' : 'bg-gray-600'
          }`}>
            {avatar ? (
              <img 
                src={avatar} 
                alt={name} 
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </div>
          
          {/* Name */}
          <div>
            <h3 className="font-semibold text-gray-900">{name}</h3>
            {isCurrentPlayer && (
              <span className="text-xs text-indigo-600 font-medium">You</span>
            )}
          </div>
        </div>

        {/* Score */}
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{score}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Score</div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="mb-4">
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
          {getStatusText(status)}
        </span>
      </div>

      {/* Choice Display */}
      {choice ? (
        <div className="text-center py-4 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-2">{getChoiceEmoji(choice)}</div>
          <div className="text-sm font-medium text-gray-600 capitalize">{choice}</div>
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <div className="text-gray-400">
            {status === 'thinking' ? (
              <div className="animate-pulse">
                <div className="text-4xl mb-2">🤔</div>
                <div className="text-sm">Choosing...</div>
              </div>
            ) : (
              <div>
                <div className="text-4xl mb-2">❓</div>
                <div className="text-sm">No choice yet</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Indicator */}
      {isActive && (
        <div className="mt-4 flex justify-center">
          <div className="flex items-center space-x-2 text-indigo-600">
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Your turn</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerCard;
