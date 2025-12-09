import React, { useEffect, useState } from 'react';

const ResultOverlay = ({ result, playerChoice, opponentChoice, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setIsVisible(true);
    setTimeout(() => setShowContent(true), 100);

    // Auto-close after 3 seconds
    const timer = setTimeout(() => {
      handleClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setShowContent(false);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
  };

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

  const getResultConfig = (result) => {
    switch (result) {
      case 'win':
        return {
          title: 'Victory!',
          subtitle: 'You won this round!',
          emoji: '🎉',
          bgColor: 'bg-gradient-to-br from-green-500 to-emerald-600',
          textColor: 'text-green-600',
          borderColor: 'border-green-500',
          confetti: true
        };
      case 'lose':
        return {
          title: 'Defeat!',
          subtitle: 'Better luck next time!',
          emoji: '😔',
          bgColor: 'bg-gradient-to-br from-red-500 to-pink-600',
          textColor: 'text-red-600',
          borderColor: 'border-red-500',
          confetti: false
        };
      case 'draw':
        return {
          title: 'Draw!',
          subtitle: 'Great minds think alike!',
          emoji: '🤝',
          bgColor: 'bg-gradient-to-br from-yellow-500 to-orange-600',
          textColor: 'text-yellow-600',
          borderColor: 'border-yellow-500',
          confetti: false
        };
      default:
        return {
          title: 'Round Complete',
          subtitle: 'Let\'s see the result!',
          emoji: '⏳',
          bgColor: 'bg-gradient-to-br from-gray-500 to-gray-600',
          textColor: 'text-gray-600',
          borderColor: 'border-gray-500',
          confetti: false
        };
    }
  };

  const config = getResultConfig(result);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          showContent ? 'bg-opacity-75' : 'bg-opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Overlay Content */}
      <div
        className={`relative max-w-md w-full transform transition-all duration-300 ${
          showContent ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Main Card */}
        <div className={`${config.bgColor} rounded-3xl shadow-2xl p-8 text-white relative overflow-hidden`}>
          
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-16 -translate-y-16" />
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-white rounded-full translate-x-12 translate-y-12" />
            <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-white rounded-full -translate-x-20 -translate-y-20" />
          </div>

          {/* Result Header */}
          <div className="relative text-center mb-6">
            <div className="text-6xl mb-4 animate-bounce">{config.emoji}</div>
            <h2 className="text-3xl font-bold mb-2">{config.title}</h2>
            <p className="text-lg opacity-90">{config.subtitle}</p>
          </div>

          {/* Choices Comparison */}
          <div className="relative bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl p-6 mb-6">
            <div className="grid grid-cols-3 gap-4 items-center">
              {/* Player Choice */}
              <div className="text-center">
                <div className="text-sm font-medium mb-2 opacity-75">You</div>
                <div className="text-4xl mb-1">{getChoiceEmoji(playerChoice)}</div>
                <div className="text-sm font-medium capitalize">{playerChoice}</div>
              </div>

              {/* VS */}
              <div className="text-center">
                <div className="text-2xl font-bold opacity-75">VS</div>
              </div>

              {/* Opponent Choice */}
              <div className="text-center">
                <div className="text-sm font-medium mb-2 opacity-75">Opponent</div>
                <div className="text-4xl mb-1">{getChoiceEmoji(opponentChoice)}</div>
                <div className="text-sm font-medium capitalize">{opponentChoice}</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="relative flex justify-center space-x-4">
            <button
              onClick={handleClose}
              className="px-6 py-3 bg-white bg-opacity-20 backdrop-blur-sm rounded-xl font-medium hover:bg-opacity-30 transition-all duration-200 transform hover:scale-105"
            >
              Continue
            </button>
          </div>

          {/* Confetti Effect for Wins */}
          {config.confetti && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-yellow-300 rounded-full animate-pulse"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${2 + Math.random() * 2}s`
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-4 bg-white bg-opacity-20 backdrop-blur-sm rounded-full h-2 overflow-hidden">
          <div 
            className="h-full bg-white transition-all duration-3000 ease-linear"
            style={{
              animation: 'shrink 3s linear forwards'
            }}
          />
        </div>

        {/* Auto-close Timer */}
        <div className="mt-2 text-center text-white text-sm opacity-75">
          Auto-closing in <span className="font-medium">3</span> seconds...
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default ResultOverlay;
