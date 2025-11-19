import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
  });
  const [recentMatches, setRecentMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // In a real app, you would fetch these from your API
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock data - replace with actual API calls
        setStats({
          totalGames: 12,
          wins: 7,
          losses: 4,
          draws: 1,
          winRate: 58.3,
        });
        
        setRecentMatches([
          { id: 1, opponent: 'Player2', result: 'Win', choice: 'rock', opponentChoice: 'scissors', date: '2023-11-12T15:30:00Z' },
          { id: 2, opponent: 'Player3', result: 'Loss', choice: 'scissors', opponentChoice: 'rock', date: '2023-11-11T14:20:00Z' },
          { id: 3, opponent: 'Player4', result: 'Draw', choice: 'paper', opponentChoice: 'paper', date: '2023-11-10T10:15:00Z' },
        ]);
        
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Please log in to view your profile</h2>
          <p className="text-gray-600 mb-6">You need to be logged in to access this page.</p>
          <a
            href="/login"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {user.username}'s Profile
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Member since {new Date(user.date_joined).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Sign Out
              </button>
            </div>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl className="sm:divide-y sm:divide-gray-200">
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {user.email}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Username</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {user.username}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Game Statistics</h3>
          </div>
          <div className="border-t border-gray-200">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-5 p-6">
              <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6 text-center">
                <dt className="text-sm font-medium text-gray-500 truncate">Total Games</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalGames}</dd>
              </div>
              <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6 text-center">
                <dt className="text-sm font-medium text-gray-500 truncate">Wins</dt>
                <dd className="mt-1 text-3xl font-semibold text-green-600">{stats.wins}</dd>
              </div>
              <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6 text-center">
                <dt className="text-sm font-medium text-gray-500 truncate">Losses</dt>
                <dd className="mt-1 text-3xl font-semibold text-red-600">{stats.losses}</dd>
              </div>
              <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6 text-center">
                <dt className="text-sm font-medium text-gray-500 truncate">Draws</dt>
                <dd className="mt-1 text-3xl font-semibold text-yellow-600">{stats.draws}</dd>
              </div>
              <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6 text-center">
                <dt className="text-sm font-medium text-gray-500 truncate">Win Rate</dt>
                <dd className="mt-1 text-3xl font-semibold text-indigo-600">{stats.winRate}%</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Recent Matches */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Matches</h3>
          </div>
          <div className="border-t border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Opponent
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Your Choice
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Opponent's Choice
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Result
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentMatches.length > 0 ? (
                    recentMatches.map((match) => (
                      <tr key={match.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {match.opponent}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                          {match.choice}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                          {match.opponentChoice}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              match.result === 'Win'
                                ? 'bg-green-100 text-green-800'
                                : match.result === 'Loss'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {match.result}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(match.date).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                        No recent matches found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
