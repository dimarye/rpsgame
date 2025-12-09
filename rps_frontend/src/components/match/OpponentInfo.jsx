import React from 'react';
import { UserIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import useMatchStore from '../../store/useMatchStore';

const OpponentInfo = () => {
  const { opponent, isConnected } = useMatchStore();

  const getStatusColor = () => {
    if (!opponent) return 'text-gray-500';
    if (!isConnected) return 'text-red-500';
    return 'text-green-500';
  };

  const getStatusText = () => {
    if (!opponent) return 'Waiting for opponent...';
    if (!isConnected) return 'Disconnected';
    return 'Online';
  };

  const getAvatar = () => {
    if (!opponent) return <UserCircleIcon className="w-16 h-16 text-gray-400" />;
    
    // Use first letter of username as avatar
    const firstLetter = opponent.username?.charAt(0)?.toUpperCase() || '?';
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    const colorIndex = opponent.username?.charCodeAt(0) % colors.length || 0;
    
    return (
      <div className={`w-16 h-16 ${colors[colorIndex]} rounded-full flex items-center justify-center text-white text-2xl font-bold`}>
        {firstLetter}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 text-center">
      <div className="flex justify-center mb-4">
        {getAvatar()}
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {opponent?.username || 'Opponent'}
      </h3>
      
      <div className={`flex items-center justify-center space-x-2 text-sm ${getStatusColor()}`}>
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
        <span>{getStatusText()}</span>
      </div>
      
      {opponent && (
        <div className="mt-4 text-xs text-gray-500">
          ID: {opponent.id}
        </div>
      )}
    </div>
  );
};

export default OpponentInfo;
