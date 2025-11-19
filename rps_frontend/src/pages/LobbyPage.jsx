import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { createMatch, getMatches, joinMatch } from '../services/api';

const LobbyPage = () => {
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchMatches = async () => {
    try {
      const data = await getMatches();
      setMatches(data);
    } catch (error) {
      console.error('Error fetching matches:', error);
      toast.error('Failed to load matches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleCreateMatch = async () => {
    if (!user) {
      toast.error('You must be logged in to create a match');
      navigate('/login');
      return;
    }

    setIsCreating(true);
    try {
      const newMatch = await createMatch();
      toast.success('Match created!');
      navigate(`/match/${newMatch.id}`);
    } catch (error) {
      console.error('Error creating match:', error);
      toast.error(error.message || 'Failed to create match');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinMatch = async (matchId) => {
    try {
      // Verify authentication first
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('You must be logged in to join a match');
        navigate('/login', { state: { from: `/match/${matchId}` } });
        return;
      }

      // Verify user data
      const currentUser = JSON.parse(localStorage.getItem('user'));
      if (!currentUser || !currentUser.id) {
        toast.error('User information is missing. Please log in again.');
        navigate('/login', { state: { from: `/match/${matchId}` } });
        return;
      }

      // Try to join the match
      const match = await joinMatch(matchId);
      
      // If we get here, join was successful
      toast.success('Joined match!');
      navigate(`/match/${match.id}`);
      
    } catch (error) {
      console.error('Error joining match:', error);
      
      // Handle specific error cases
      if (error.message === 'No authentication token found' || 
          error.message === 'User information not available') {
        toast.error('Session expired. Please log in again.');
        navigate('/login', { state: { from: window.location.pathname } });
      } else if (error.response?.data?.detail) {
        // Show server error message
        toast.error(error.response.data.detail);
      } else {
        // Fallback error message
        toast.error(error.message || 'Failed to join match');
      }
    }
  };

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
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">Game Lobby</h1>
          <p className="mt-2 text-sm text-gray-600">
            Join an existing match or create a new one
          </p>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <h2 className="text-lg leading-6 font-medium text-gray-900">Available Matches</h2>
            <button
              onClick={handleCreateMatch}
              disabled={isCreating}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating...' : 'Create New Match'}
            </button>
          </div>
          
          <div className="border-t border-gray-200">
            {matches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No matches available. Create a new one to start playing!
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {matches.map((match) => (
                  <li key={match.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-indigo-600">
                          Match #{match.id}
                        </div>
                        <div className="ml-2 flex-shrink-0 flex">
                          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {match.players?.length || 0}/2 Players
                          </p>
                        </div>
                        <div className="ml-2 text-sm text-gray-500">
                          Created {new Date(match.created_at).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleJoinMatch(match.id)}
                        disabled={match.players?.length >= 2}
                        className="ml-4 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {match.players?.length >= 2 ? 'Full' : 'Join Match'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LobbyPage;
