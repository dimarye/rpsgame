import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useMatchStore from '../../store/useMatchStore';

const RoundResult = () => {
  const { roundResult, playerId, setResult } = useMatchStore();

  const getResultConfig = (result) => {
    if (!result) return null;

    const isMatchResult = result.scope === 'match';
    const isWinner = result.winner === playerId;
    const isDraw = result.result === 'draw';

    if (isDraw) {
      return {
        emoji: isMatchResult ? '⚖️' : '🤝',
        text: isMatchResult ? "Match Draw!" : "It's a Draw!",
        color: 'from-yellow-400 to-orange-400',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-300',
        textColor: 'text-yellow-800',
        flashColor: 'bg-yellow-400',
        headline: isMatchResult ? 'Match Complete' : 'Round Complete',
        subline: isMatchResult ? 'No one reached the winning streak' : 'Play continues...',
        accent: 'from-amber-200/40 to-orange-200/5'
      };
    } else if (isWinner) {
      return {
        emoji: isMatchResult ? '🏆' : '🎉',
        text: isMatchResult ? 'Match Victory!' : 'You Win!',
        color: 'from-green-400 to-emerald-400',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-300',
        textColor: 'text-green-800',
        flashColor: 'bg-green-400',
        headline: isMatchResult ? 'Champion!' : 'Round Won',
        subline: isMatchResult ? 'First to the winning streak!' : 'Keep the momentum going',
        accent: 'from-emerald-200/40 to-green-200/5'
      };
    } else {
      return {
        emoji: isMatchResult ? '💔' : '😔',
        text: isMatchResult ? 'Match Defeat' : 'You Lose',
        color: 'from-red-400 to-pink-400',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-300',
        textColor: 'text-red-800',
        flashColor: 'bg-red-400',
        headline: isMatchResult ? 'Match Over' : 'Round Lost',
        subline: isMatchResult ? 'Opponent reached the victory streak' : 'Shake it off for the next round',
        accent: 'from-rose-200/40 to-red-200/5'
      };
    }
  };

  const config = getResultConfig(roundResult);

  // Auto-dismiss the result overlay after a short delay
  useEffect(() => {
    if (!roundResult) return;

    const timeout = setTimeout(() => {
      if (setResult) {
        setResult(null);
      }
    }, 2500);

    return () => clearTimeout(timeout);
  }, [roundResult, setResult]);

  const confettiPieces = useMemo(() => {
    return Array.from({ length: 14 }).map((_, index) => ({
      id: index,
      delay: 0.2 + index * 0.08,
      x: (index % 2 === 0 ? -1 : 1) * (40 + index * 5),
      y: -10 - index * 5,
      rotation: index * 18,
      color:
        config?.flashColor.replace('bg-', '').replace('-400', '') ||
        'emerald',
    }));
  }, [config]);

  if (!config || !roundResult) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      {roundResult && (
        <motion.div
          key={roundResult.timestamp || Date.now()}
          initial={{ opacity: 0, scale: 0.5, y: -50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 50 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 25,
            duration: 0.6
          }}
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
        >
          {/* Flash Background */}
          <motion.div
            className={`absolute inset-0 ${config.flashColor} opacity-20`}
            initial={{ scale: 0 }}
            animate={{ scale: 2 }}
            exit={{ scale: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />

          {/* Light streaks */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              className="absolute inset-y-0 left-0 w-full"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              <div
                className={`h-full w-56 blur-3xl opacity-40 bg-gradient-to-r ${config.accent}`}
              />
            </motion.div>
          </div>

          {/* Confetti */}
          {roundResult.result !== 'draw' && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {confettiPieces.map((piece) => (
                <motion.span
                  key={piece.id}
                  className="absolute w-3 h-8 rounded-full"
                  style={{
                    left: '50%',
                    top: '20%',
                    background:
                      piece.color.includes('emerald')
                        ? 'linear-gradient(180deg,#34d399,#10b981)'
                        : piece.color.includes('rose')
                        ? 'linear-gradient(180deg,#fb7185,#f43f5e)'
                        : 'linear-gradient(180deg,#fbbf24,#f97316)',
                  }}
                  initial={{ opacity: 0, x: 0, y: 0, rotate: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    x: piece.x,
                    y: piece.y - 60,
                    rotate: piece.rotation,
                    scale: [0.6, 1, 0.6],
                  }}
                  transition={{
                    delay: piece.delay,
                    duration: 1.2,
                    repeat: Infinity,
                    repeatDelay: 1.8,
                    ease: 'easeOut',
                  }}
                />
              ))}
            </div>
          )}

          {/* Result Card */}
          <motion.div
            className={`
              relative bg-white rounded-2xl shadow-2xl p-8 mx-4
              border-2 ${config.borderColor}
              backdrop-blur-sm bg-opacity-95
            `}
            initial={{ rotateY: -90 }}
            animate={{ rotateY: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {/* Glow Effect */}
            <motion.div
              className={`absolute inset-0 ${config.flashColor} opacity-10 rounded-2xl blur-xl`}
              animate={{
                opacity: [0.1, 0.3, 0.1],
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            <div className="relative text-center">
              {/* Emoji Animation */}
              <motion.div
                className="text-6xl mb-4"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 20,
                  delay: 0.2
                }}
              >
                {config.emoji}
              </motion.div>
              
              {/* Match/Round Headline */}
              <motion.h2
                className={`
                  text-xl font-semibold tracking-wide uppercase mb-2
                  ${config.textColor}
                `}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {config.headline}
              </motion.h2>

              {/* Result Text */}
              <motion.h3
                className={`
                  text-3xl font-bold mb-2
                  bg-gradient-to-r ${config.color}
                  bg-clip-text text-transparent
                `}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {config.text}
              </motion.h3>
              
              <motion.p
                className="text-sm text-gray-500 mb-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {config.subline}
              </motion.p>

              {/* Move Details */}
              {roundResult.moves && (
                <motion.div
                  className="mt-4 flex justify-center items-center space-x-4 text-sm text-gray-600"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <span className="font-medium">{roundResult.scope === 'match' ? 'Final Move' : 'You'}: {roundResult.moves.player}</span>
                  <span className="text-gray-400">vs</span>
                  <span className="font-medium">Opponent: {roundResult.moves.opponent}</span>
                </motion.div>
              )}

              {roundResult.scope === 'match' && roundResult.summary && (
                <motion.div
                  className="mt-4 grid grid-cols-3 gap-3 text-center text-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.65 }}
                >
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs uppercase text-gray-500">Your Wins</div>
                    <div className="text-xl font-bold text-green-600">{roundResult.summary.playerWins}</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs uppercase text-gray-500">Opponent</div>
                    <div className="text-xl font-bold text-indigo-500">{roundResult.summary.opponentWins}</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs uppercase text-gray-500">Rounds</div>
                    <div className="text-xl font-bold text-gray-700">{roundResult.summary.totalRounds}</div>
                  </div>
                </motion.div>
              )}

              {roundResult.scope === 'round' && (
                <motion.div
                  className="mt-6 flex items-center justify-center space-x-6 text-xs uppercase tracking-widest text-gray-400"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                >
                  <div className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                    <span>Best of {roundResult.winsNeeded || 3}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                    <span>First to {roundResult.winsNeeded || 3}</span>
                  </div>
                </motion.div>
              )}

              {/* Auto-dismiss indicator */}
              <motion.div
                className="mt-6 text-xs text-gray-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                {roundResult.scope === 'match'
                  ? 'Returning to the lobby...'
                  : 'Next round starting soon...'}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RoundResult;
