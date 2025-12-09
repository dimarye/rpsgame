import React from 'react';

const ChoiceButtons = ({ onSelect, disabled }) => {
  const choices = [
    { 
      name: 'rock', 
      emoji: '✊', 
      label: 'Rock',
      description: 'Crushes scissors'
    },
    { 
      name: 'paper', 
      emoji: '✋', 
      label: 'Paper',
      description: 'Covers rock'
    },
    { 
      name: 'scissors', 
      emoji: '✌️', 
      label: 'Scissors',
      description: 'Cuts paper'
    }
  ];

  const handleChoice = (choice) => {
    if (!disabled) {
      onSelect(choice);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {choices.map((choice) => (
        <button
          key={choice.name}
          onClick={() => handleChoice(choice.name)}
          disabled={disabled}
          className={`
            relative group p-6 rounded-2xl border-2 transition-all duration-300 transform
            ${disabled 
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
              : 'border-gray-300 bg-white hover:border-indigo-400 hover:shadow-lg hover:scale-105 cursor-pointer'
            }
            focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-25
          `}
          aria-label={`Choose ${choice.label}`}
        >
          {/* Choice Content */}
          <div className="flex flex-col items-center space-y-3">
            {/* Emoji */}
            <div className={`
              text-6xl transition-transform duration-300
              ${disabled ? 'scale-90' : 'group-hover:scale-110'}
            `}>
              {choice.emoji}
            </div>
            
            {/* Label */}
            <div className="text-lg font-semibold text-gray-900 capitalize">
              {choice.label}
            </div>
            
            {/* Description */}
            <div className="text-sm text-gray-500 text-center">
              {choice.description}
            </div>
          </div>

          {/* Hover Effect Overlay */}
          {!disabled && (
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none" />
          )}

          {/* Disabled State Indicator */}
          {disabled && (
            <div className="absolute inset-0 rounded-2xl bg-gray-100 opacity-50 pointer-events-none flex items-center justify-center">
              <div className="text-gray-400 text-sm font-medium">Waiting...</div>
            </div>
          )}

          {/* Selection Animation */}
          <div className="absolute inset-0 rounded-2xl border-2 border-indigo-500 opacity-0 group-active:opacity-100 transition-opacity duration-200 pointer-events-none" />
        </button>
      ))}
    </div>
  );
};

export default ChoiceButtons;
