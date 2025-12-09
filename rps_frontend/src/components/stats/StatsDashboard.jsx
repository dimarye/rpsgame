import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PlayerStats from './PlayerStats.jsx';
import Leaderboard from './Leaderboard.jsx';

const StatsDashboard = ({ currentUser, opponent, showDetails = false }) => {
  const [activeView, setActiveView] = useState('overview');
  
  const views = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'players', label: 'Players', icon: '👥' },
    { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' }
  ];
  
  const renderOverview = () => (
    <div className="space-y-4">
      {/* Match Summary */}
      <motion.div
        className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <h3 className="text-lg font-semibold mb-2">Match Overview</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-blue-100">Total Matches</div>
            <div className="text-2xl font-bold">42</div>
          </div>
          <div>
            <div className="text-blue-100">Global Rank</div>
            <div className="text-2xl font-bold">#8</div>
          </div>
          <div>
            <div className="text-blue-100">Win Rate</div>
            <div className="text-2xl font-bold">66.7%</div>
          </div>
          <div>
            <div className="text-blue-100">Current Streak</div>
            <div className="text-2xl font-bold">3 🔥</div>
          </div>
        </div>
      </motion.div>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {currentUser && (
          <PlayerStats 
            player={currentUser} 
            isCurrentPlayer={true} 
            showDetails={showDetails}
          />
        )}
        {opponent && (
          <PlayerStats 
            player={opponent} 
            isCurrentPlayer={false} 
            showDetails={showDetails}
          />
        )}
      </div>
      
      {/* Performance Trends */}
      {showDetails && (
        <motion.div
          className="bg-white rounded-lg shadow-md p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Performance Trends</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last 10 matches</span>
              <div className="flex space-x-1">
                {[1, 1, 0, 1, 1, 1, 0, 1, 1, 1].map((result, i) => (
                  <div
                    key={i}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      result === 1 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}
                  >
                    {result === 1 ? 'W' : 'L'}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Recent Win Rate</span>
              <span className="text-sm font-semibold text-green-600">80%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Improvement</span>
              <span className="text-sm font-semibold text-blue-600">+5.2%</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
  
  const renderPlayers = () => (
    <div className="space-y-4">
      {currentUser && (
        <PlayerStats 
          player={currentUser} 
          isCurrentPlayer={true} 
          showDetails={true}
        />
      )}
      {opponent && (
        <PlayerStats 
          player={opponent} 
          isCurrentPlayer={false} 
          showDetails={true}
        />
      )}
      
      {/* Head-to-Head Stats */}
      {showDetails && currentUser && opponent && (
        <motion.div
          className="bg-white rounded-lg shadow-md p-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Head-to-Head</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">7</div>
              <div className="text-xs text-gray-600">Your Wins</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">3</div>
              <div className="text-xs text-gray-600">Their Wins</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">2</div>
              <div className="text-xs text-gray-600">Draws</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Your Win Rate</span>
              <span className="text-sm font-semibold text-green-600">70%</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
  
  const renderLeaderboard = () => (
    <Leaderboard showDetails={showDetails} />
  );
  
  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Statistics Dashboard</h1>
        <p className="text-gray-600">Track your performance and climb the rankings</p>
      </motion.div>
      
      {/* View Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-100 rounded-lg p-1 max-w-md">
        {views.map(view => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            className={`
              flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
              ${activeView === view.id 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            <span>{view.icon}</span>
            <span>{view.label}</span>
          </button>
        ))}
      </div>
      
      {/* Content */}
      <motion.div
        key={activeView}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
      >
        {activeView === 'overview' && renderOverview()}
        {activeView === 'players' && renderPlayers()}
        {activeView === 'leaderboard' && renderLeaderboard()}
      </motion.div>
      
      {/* Quick Actions */}
      {showDetails && (
        <motion.div
          className="mt-6 flex justify-center space-x-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-sm">
            📈 View Detailed Stats
          </button>
          <button className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors duration-200 text-sm">
            🎯 Set Goals
          </button>
          <button className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 text-sm">
            🔔 Enable Notifications
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default StatsDashboard;
