import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Leaderboard = ({ showDetails = false }) => {
  const [activeTab, setActiveTab] = useState('global');
  const [leaderboardData, setLeaderboardData] = useState({
    global: [],
    weekly: [],
    friends: []
  });
  
  // Mock leaderboard data (in real app, this would come from API)
  const mockLeaderboardData = {
    global: [
      { id: 1, username: 'RockMaster', winRate: 78.5, matchesPlayed: 245, currentStreak: 12, rank: 1, change: 0 },
      { id: 2, username: 'PaperKing', winRate: 75.2, matchesPlayed: 189, currentStreak: 8, rank: 2, change: 1 },
      { id: 3, username: 'ScissorNinja', winRate: 73.1, matchesPlayed: 312, currentStreak: 5, rank: 3, change: -1 },
      { id: 4, username: 'RPSLegend', winRate: 71.8, matchesPlayed: 156, currentStreak: 3, rank: 4, change: 2 },
      { id: 5, username: 'GameMaster', winRate: 69.4, matchesPlayed: 278, currentStreak: 7, rank: 5, change: -2 },
      { id: 6, username: 'ProPlayer', winRate: 68.9, matchesPlayed: 134, currentStreak: 4, rank: 6, change: 0 },
      { id: 7, username: 'Challenger', winRate: 67.3, matchesPlayed: 198, currentStreak: 2, rank: 7, change: 3 },
      { id: 8, username: 'RookieKing', winRate: 66.7, matchesPlayed: 42, currentStreak: 3, rank: 8, change: -1 },
    ],
    weekly: [
      { id: 9, username: 'WeeklyWarrior', winRate: 85.2, matchesPlayed: 45, currentStreak: 8, rank: 1, change: 0 },
      { id: 10, username: 'SpeedDemon', winRate: 82.1, matchesPlayed: 38, currentStreak: 6, rank: 2, change: 4 },
      { id: 11, username: 'LuckyStar', winRate: 79.8, matchesPlayed: 52, currentStreak: 5, rank: 3, change: -1 },
      { id: 12, username: 'QuickDraw', winRate: 77.5, matchesPlayed: 41, currentStreak: 4, rank: 4, change: 2 },
      { id: 13, username: 'NewChamp', winRate: 75.3, matchesPlayed: 29, currentStreak: 3, rank: 5, change: -2 },
    ],
    friends: [
      { id: 14, username: 'BestBuddy', winRate: 65.4, matchesPlayed: 89, currentStreak: 2, rank: 1, change: 0 },
      { id: 15, username: 'GamePal', winRate: 62.1, matchesPlayed: 67, currentStreak: 1, rank: 2, change: 1 },
      { id: 16, username: 'RivalFriend', winRate: 58.9, matchesPlayed: 124, currentStreak: 0, rank: 3, change: -1 },
    ]
  };
  
  useEffect(() => {
    // Simulate API call
    setLeaderboardData(mockLeaderboardData);
  }, []);
  
  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };
  
  const getRankColor = (rank) => {
    if (rank === 1) return 'text-yellow-500';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-orange-600';
    return 'text-gray-600';
  };
  
  const getChangeIcon = (change) => {
    if (change > 0) return '📈';
    if (change < 0) return '📉';
    return '➖';
  };
  
  const getChangeColor = (change) => {
    if (change > 0) return 'text-green-500';
    if (change < 0) return 'text-red-500';
    return 'text-gray-400';
  };
  
  const getStreakIcon = (streak) => {
    if (streak >= 10) return '🔥';
    if (streak >= 5) return '⚡';
    if (streak >= 3) return '✨';
    if (streak >= 1) return '💫';
    return '';
  };
  
  const getWinRateColor = (rate) => {
    if (rate >= 75) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  const tabs = [
    { id: 'global', label: 'Global', icon: '🌍' },
    { id: 'weekly', label: 'Weekly', icon: '📅' },
    { id: 'friends', label: 'Friends', icon: '👥' }
  ];
  
  const currentData = leaderboardData[activeTab] || [];
  
  return (
    <motion.div
      className="bg-white rounded-lg shadow-lg p-6"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Leaderboard</h2>
        <div className="flex items-center space-x-1">
          <span className="text-xs text-gray-500">Updated: 2 min ago</span>
          <button className="text-xs text-blue-600 hover:text-blue-700">
            🔄 Refresh
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex space-x-1 mb-4 bg-gray-100 rounded-lg p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 flex items-center justify-center space-x-1 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200
              ${activeTab === tab.id 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      
      {/* Leaderboard List */}
      <div className="space-y-2">
        <AnimatePresence mode="wait">
          {currentData.map((player, index) => (
            <motion.div
              key={player.id}
              className={`
                flex items-center justify-between p-3 rounded-lg transition-all duration-200
                ${index === 0 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200' : 
                  index === 1 ? 'bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200' :
                  index === 2 ? 'bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200' :
                  'bg-gray-50 hover:bg-gray-100'}
              `}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              {/* Rank */}
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 flex items-center justify-center rounded-full ${getRankColor(player.rank)} font-bold text-sm`}>
                  {getRankIcon(player.rank)}
                </div>
                
                {/* Player Info */}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900">{player.username}</span>
                    <span className="text-sm">{getStreakIcon(player.currentStreak)}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span>{player.matchesPlayed} matches</span>
                    <span>•</span>
                    <span>{player.currentStreak} streak</span>
                  </div>
                </div>
              </div>
              
              {/* Stats */}
              <div className="flex items-center space-x-4">
                {/* Rank Change */}
                {showDetails && (
                  <div className="flex items-center space-x-1">
                    <span className={`text-xs ${getChangeColor(player.change)}`}>
                      {getChangeIcon(player.change)}
                    </span>
                    {player.change !== 0 && (
                      <span className={`text-xs font-medium ${getChangeColor(player.change)}`}>
                        {player.change > 0 ? '+' : ''}{player.change}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Win Rate */}
                <div className="text-right">
                  <div className={`text-sm font-semibold ${getWinRateColor(player.winRate)}`}>
                    {player.winRate.toFixed(1)}%
                  </div>
                  {showDetails && (
                    <div className="text-xs text-gray-500">Win Rate</div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Empty State */}
      {currentData.length === 0 && (
        <motion.div
          className="text-center py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="text-4xl mb-2">🏆</div>
          <p className="text-gray-500 text-sm">No players in this category yet</p>
          <p className="text-gray-400 text-xs mt-1">Be the first to compete!</p>
        </motion.div>
      )}
      
      {/* Footer */}
      {showDetails && currentData.length > 0 && (
        <motion.div
          className="mt-4 pt-4 border-t border-gray-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Total players: {currentData.length}</span>
            <button className="text-blue-600 hover:text-blue-700">
              View full leaderboard →
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default Leaderboard;
