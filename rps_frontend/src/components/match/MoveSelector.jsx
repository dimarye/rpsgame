import React, { useState } from 'react';
import { motion } from 'framer-motion';
import useMatchStore from '../../store/useMatchStore';
import useSketchSound from '../../hooks/useSketchSound';
import { GestureIcon } from './gestureIcons';

const MoveSelector = ({ onChoiceSelect }) => {
  const { moves, isPlayerTurn, isConnected, timeoutOccurred, playerId } = useMatchStore();
  const [loadingMove, setLoadingMove] = useState(null);
  const playSketchSound = useSketchSound();

  const choices = [
    { name: 'rock', label: 'Rock', accent: 'var(--sketch-red)' },
    { name: 'paper', label: 'Paper', accent: 'var(--sketch-blue)' },
    { name: 'scissors', label: 'Scissors', accent: 'var(--sketch-accent)' },
  ];

  // Resolve isPlayerTurn from store (it is a function in the store API)
  const isPlayerTurnValue = typeof isPlayerTurn === 'function' ? isPlayerTurn() : !!isPlayerTurn;

  // Consider only moves of the *current* round when checking if player has already moved
  // Our rounds are 2 moves each; if total moves count is odd, the last move belongs to the current round
  let currentRoundMoves = [];
  if (moves.length % 2 === 1) {
    currentRoundMoves = [moves[moves.length - 1]];
  }

  const hasCurrentPlayerMoved =
    playerId != null && currentRoundMoves.some(move => move.playerId === playerId);

  // Determine if buttons should be disabled
  // We rely on isPlayerTurnValue and timeout/connection; "already moved" is handled per-round above
  const isDisabled = !isPlayerTurnValue || !isConnected || timeoutOccurred;

  console.log('[MoveSelector Debug] isPlayerTurnValue:', isPlayerTurnValue);
  console.log('[MoveSelector Debug] hasCurrentPlayerMoved:', hasCurrentPlayerMoved);
  console.log('[MoveSelector Debug] isConnected:', isConnected);
  // Hook local connection state is intentionally not used here to avoid instance mismatch
  console.log('[MoveSelector Debug] timeoutOccurred:', timeoutOccurred);
  console.log('[MoveSelector Debug] isDisabled:', isDisabled);

  const handleMoveSelect = async (choiceName) => {
    if (isDisabled || loadingMove) {
      console.log('[MoveSelector] Move blocked - disabled:', isDisabled, 'loading:', loadingMove);
      return;
    }

    // Set loading state
    setLoadingMove(choiceName);

    try {
      console.log('[MoveSelector] Sending move:', choiceName);
      playSketchSound('scratch');
      const success = onChoiceSelect ? onChoiceSelect(choiceName) : false;

      if (success) {
        console.log('[MoveSelector] Move sent successfully');
        // Clear loading state on success so the button becomes interactive again next round
        setLoadingMove(null);
      } else {
        console.error('[MoveSelector] Failed to send move');
        throw new Error('Failed to send move');
      }
    } catch (error) {
      console.error('[MoveSelector] Error sending move:', error);
      
      // Clear loading state after error
      setTimeout(() => setLoadingMove(null), 1000);
    }
  };

  return (
    <div className="sketch-outline bg-white/90 p-6 animate-fade-in flex flex-col gap-4">
      <h3 className="text-xl font-semibold text-[var(--sketch-ink)] text-center tracking-wide">
        Sketch your next move
      </h3>
      
      {/* Connection status indicator */}
      {!isConnected && (
        <motion.div 
          className="p-3 bg-yellow-100/70 border border-yellow-300 rounded-xl flex items-center justify-center space-x-2 text-yellow-900 sketch-shadow"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <span className="text-lg animate-spin">🔄</span>
          <span className="text-sm font-medium uppercase tracking-[0.2em]">Reconnecting...</span>
        </motion.div>
      )}
      
      {/* Timeout indicator */}
      {timeoutOccurred && (
        <motion.div 
          className="p-3 bg-orange-100/80 border border-orange-300 rounded-xl flex items-center justify-center space-x-2 text-orange-900 sketch-shadow"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <span className="text-lg animate-pulse">⏰</span>
          <span className="text-sm font-medium uppercase tracking-[0.2em]">Round paused</span>
        </motion.div>
      )}
      
      <div className="grid grid-cols-3 gap-4">
        {choices.map((choice, index) => {
          const isLoading = loadingMove === choice.name;
          const isButtonDisabled = isDisabled || isLoading;
          
          return (
            <motion.button
              key={choice.name}
              onClick={() => handleMoveSelect(choice.name)}
              disabled={isButtonDisabled}
              className={`
                gesture-card sketch-wobble flex flex-col items-center text-center gap-3
                ${isButtonDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-1'}
                ${hasCurrentPlayerMoved && !timeoutOccurred ? 'ring-2 ring-[var(--sketch-accent)] ring-offset-2' : ''}
              `}
              initial={{ opacity: 0, y: 20 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                scale: isLoading ? 0.95 : 1
              }}
              transition={{ 
                delay: index * 0.1,
                duration: 0.3
              }}
              whileTap={!isButtonDisabled ? { scale: 0.95 } : {}}
              whileHover={!isButtonDisabled ? { 
                scale: 1.05,
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)"
              } : {}}
            >
              {isLoading && (
                <motion.div
                  className="absolute inset-0 bg-white/85 rounded-2xl flex items-center justify-center text-[var(--sketch-ink)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex flex-col items-center text-xs font-semibold uppercase tracking-[0.3em]">
                    <span className="w-6 h-6 border-2 border-[var(--sketch-ink)] border-t-transparent rounded-full animate-spin mb-1" />
                    Sending
                  </div>
                </motion.div>
              )}
              
              <div className="w-16 h-16 flex items-center justify-center text-[var(--sketch-ink)]">
                <GestureIcon type={choice.name} />
              </div>
              <div className="gesture-shadow" />
              <span className="text-sm font-semibold tracking-wide text-[var(--sketch-ink)]">
                {choice.label}
              </span>
            </motion.button>
          );
        })}
      </div>
      
      {/* Status message */}
      <motion.div 
        className="text-center text-sm text-[var(--sketch-ink)] transition-colors duration-300"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {!isConnected && (
          <span className="text-red-600 font-medium animate-pulse">
            🔴 Connection lost...
          </span>
        )}

        {!timeoutOccurred && isConnected && !isPlayerTurnValue && hasCurrentPlayerMoved && (
          <span className="text-blue-600">
            ⏳ Waiting for opponent...
          </span>
        )}

        {timeoutOccurred && (
          <span className="text-orange-600 font-medium">
            ⏰ Round ended due to timeout
          </span>
        )}

        {isPlayerTurnValue && !timeoutOccurred && isConnected && (
          <span className="text-green-600 font-medium">
            🎯 Your turn! Choose your move.
          </span>
        )}
      </motion.div>
    </div>
  );
};

export default MoveSelector;
