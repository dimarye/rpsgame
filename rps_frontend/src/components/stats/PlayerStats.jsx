import React from 'react';
import { motion } from 'framer-motion';
import useMatchStore from '../../store/useMatchStore';

const PlayerStats = ({ player, isCurrentPlayer = false, showDetails = false }) => {
  const { moves, roundResult, matchStatus } = useMatchStore();
  
  // Calculate stats for current match
  const getCurrentMatchStats = () => {
    const playerMoves = moves.filter(move => move.playerId === player.id);
    const totalMoves = playerMoves.length;
    
    if (totalMoves === 0) {
      return {
        rock: 0,
        paper: 0,
        scissors: 0,
        total: 0
      };
    }
    
    const moveCounts = playerMoves.reduce((acc, move) => {
      acc[move.choice] = (acc[move.choice] || 0) + 1;
      return acc;
    }, { rock: 0, paper: 0, scissors: 0 });
    
    return {
      ...moveCounts,
      total: totalMoves
    };
  };
  
  // Simulate historical stats (in real app, this would come from API)
  const getHistoricalStats = () => {
    return {
      matchesPlayed: 42,
      matchesWon: 28,
      matchesLost: 14,
      winRate: 66.7,
      favoriteMove: 'rock',
      currentStreak: 3,
      bestStreak: 7,
      totalMoves: 186,
      rockUsage: 35.5,
      paperUsage: 32.3,
      scissorsUsage: 32.2
    };
  };
  
  const currentStats = getCurrentMatchStats();
  const historicalStats = getHistoricalStats();
  
  const getMoveIcon = (move) => {
    const icons = {
      rock: '✊',
      paper: '✋',
      scissors: '✌️'
    };
    return icons[move] || '❓';
  };
  
  const getMoveColor = (move) => {
    const colors = {
      rock: 'bg-gray-500',
      paper: 'bg-blue-500',
      scissors: 'bg-red-500'
    };
    return colors[move] || 'bg-gray-400';
  };
  
  const getWinRateColor = (rate) => {
    if (rate >= 70) return 'text-green-600';
    if (rate >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  const getStreakIcon = (streak) => {
    if (streak >= 5) return '🔥';
    if (streak >= 3) return '⚡';
    if (streak >= 1) return '✨';
    return '';
  };
  
  return (
    <motion.div
      className={`bg-white rounded-lg shadow-md p-4 ${isCurrentPlayer ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Player Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
            {player.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {player.username}
              {isCurrentPlayer && <span className="ml-2 text-xs text-blue-600">(You)</span>}
            </h3>
            <p className="text-xs text-gray-500">Player #{player.id}</p>
          </div>
        </div>
        {isCurrentPlayer && (
          <div className="flex items-center space-x-1">
            <span className="text-lg">{getStreakIcon(historicalStats.currentStreak)}</span>
            <span className="text-xs text-gray-600">{historicalStats.currentStreak} win streak</span>
          </div>
        )}
      </div>
      
      {/* Current Match Stats */}
      {showDetails && matchStatus === 'active' && (
        <motion.div
          className="mb-4 p-3 bg-gray-50 rounded-lg"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
        >
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Current Match</h4>
          <div className="grid grid-cols-3 gap-2 text-center">
            {['rock', 'paper', 'scissors'].map(move => {
              const count = currentStats[move];
              const percentage = currentStats.total > 0 ? (count / currentStats.total) * 100 : 0;
              
              return (
                <div key={move} className="flex flex-col items-center">
                  <div className={`w-8 h-8 ${getMoveColor(move)} rounded-full flex items-center justify-center text-white text-sm mb-1`}>
                    {getMoveIcon(move)}
                  </div>
                  <span className="text-xs text-gray-600">{count}</span>
                  {currentStats.total > 0 && (
                    <span className="text-xs text-gray-400">{percentage.toFixed(0)}%</span>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
      
      {/* Historical Stats */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Win Rate</span>
          <span className={`text-xs font-semibold ${getWinRateColor(historicalStats.winRate)}`}>
            {historicalStats.winRate.toFixed(1)}%
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Matches</span>
          <span className="text-xs font-semibold text-gray-900">
            {historicalStats.matchesWon}W / {historicalStats.matchesLost}L
          </span>
        </div>
        
        {showDetails && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Favorite Move</span>
              <div className="flex items-center space-x-1">
                <span className="text-sm">{getMoveIcon(historicalStats.favoriteMove)}</span>
                <span className="text-xs font-semibold text-gray-900 capitalize">
                  {historicalStats.favoriteMove}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Best Streak</span>
              <span className="text-xs font-semibold text-gray-900">
                {historicalStats.bestStreak} wins
              </span>
            </div>
          </>
        )}
      </div>
      
      {/* Move Usage Chart (when showing details) */}
      {showDetails && (
        <motion.div
          className="mt-3 pt-3 border-t border-gray-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Move Usage</h4>
          <div className="space-y-1">
            {['rock', 'paper', 'scissors'].map(move => {
              const usage = historicalStats[`${move}Usage`];
              const color = getMoveColor(move).replace('bg-', 'bg-').replace('-500', '-400');
              
              return (
                <div key={move} className="flex items-center space-x-2">
                  <span className="text-xs text-gray-600 w-12 capitalize">{move}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className={`h-full ${color} transition-all duration-500`}
                      initial={{ width: 0 }}
                      animate={{ width: `${usage}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-8 text-right">{usage.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
      
      {/* Performance Indicator */}
      <motion.div
        className="mt-3 pt-3 border-t border-gray-200"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center justify-center">
          <div className="flex items-center space-x-2">
            {historicalStats.winRate >= 70 && (
              <>
                <span className="text-lg">🏆</span>
                <span className="text-xs text-green-600 font-medium">Expert Player</span>
              </>
            )}
            {historicalStats.winRate >= 50 && historicalStats.winRate < 70 && (
              <>
                <span className="text-lg">⭐</span>
                <span className="text-xs text-yellow-600 font-medium">Skilled Player</span>
              </>
            )}
            {historicalStats.winRate < 50 && (
              <>
                <span className="text-lg">🌱</span>
                <span className="text-xs text-blue-600 font-medium">Rising Player</span>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PlayerStats;
