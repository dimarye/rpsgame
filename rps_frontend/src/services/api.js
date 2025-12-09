import axios from 'axios';
import { API_BASE_URL } from '../config/urls.js';

// Helper function to get cookie by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// API Configuration
export const WS_BASE_URL = "ws://localhost:8000/ws";

const API_URL = API_BASE_URL;

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,  // Important for sending cookies with CORS
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Set the initial token if it exists
const token = localStorage.getItem('token');
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Add a request interceptor to include the auth token
api.interceptors.request.use(
  (config) => {
    // Add token to headers if it exists
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Ensure withCredentials is set for all requests
    config.withCredentials = true;
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response error:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });
      
      // Handle 401 Unauthorized
      if (error.response.status === 401) {
        console.error('Authentication required - redirecting to login');
        localStorage.removeItem('token');
        // Only redirect if not already on login page to prevent infinite redirects
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request setup error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const login = async (email, password) => {
  try {
    console.log('Attempting to login with:', { email });
    
    // The backend expects 'email' and 'password' in JSON format
    const payload = {
      email: email,
      password: password
    };
    
    console.log('Sending login request with payload:', payload);
    
    // Send the login request with JSON content type
    const response = await axios.post(`${API_URL}/auth/token/`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      withCredentials: true
    });

    console.log('Login successful, response:', response.data);

    if (!response.data.access) {
      throw new Error('No access token received');
    }

    // Store the token
    localStorage.setItem('token', response.data.access);
    if (response.data.refresh) {
      localStorage.setItem('refreshToken', response.data.refresh);
    }

    // The backend now returns user data with the token
    const userData = response.data;
    console.log('User data from token:', userData);
    
    return {
      success: true,
      token: userData.access,
      refresh: userData.refresh,
      user: {
        id: userData.user_id,
        email: userData.email,
        username: userData.email.split('@')[0] // Use part of email as username if needed
      }
    };
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.detail || 
             error.response?.data?.message || 
             error.message || 
             'Login failed. Please check your credentials and try again.'
    };
  }
};

export const register = async (username, email, password) => {
  try {
    console.log('Attempting to register user:', { username, email });
    
    const response = await axios.post(
      `${API_URL}/auth/register/`, 
      { username, email, password },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        withCredentials: true
      }
    );

    console.log('Registration successful, response:', response.data);
    
    // The backend already returns tokens in the response, so we can use them directly
    if (response.data.access) {
      // Store the tokens
      localStorage.setItem('token', response.data.access);
      if (response.data.refresh) {
        localStorage.setItem('refreshToken', response.data.refresh);
      }
      
      return {
        success: true,
        user: response.data.user || { username, email },
        token: response.data.access,
        refresh: response.data.refresh
      };
    }
    
    // If we don't have tokens, try to log in
    console.log('No tokens in registration response, attempting to log in...');
    return await login(email, password);
    
  } catch (error) {
    console.error('Registration error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.detail || 
             error.response?.data?.message || 
             error.message || 
             'Registration failed. Please try again.'
    };
  }
};

export const getCurrentUser = async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token found in localStorage');
      return { success: false, error: 'No authentication token found' };
    }

    // Ensure the token is set in the headers
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    const response = await api.get('/users/me/', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });

    // If we get here, the request was successful
    const userData = response.data;
    const user = {
      id: userData.id,
      email: userData.email,
      username: userData.username || userData.email.split('@')[0]
    };
    
    // Update the user in localStorage
    localStorage.setItem('user', JSON.stringify(user));
    
    return {
      success: true,
      user
    };
    
  } catch (error) {
    console.error('Error fetching current user:', error);
    // If we get a 401, clear the token
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    }
    return {
      success: false,
      error: error.response?.data?.detail || 
             error.response?.data?.message || 
             error.message || 
             'Failed to fetch user data. Please log in again.'
    };
  }
};

// Matches API
export const createMatch = async (winsNeeded = 3) => {
  const payload = winsNeeded ? { wins_needed: winsNeeded } : {};
  const response = await api.post('/matches/', payload);
  return response.data;
};

export const getMatches = async () => {
  const response = await api.get('/matches/');
  return response.data;
};

export const getMatch = async (matchId) => {
  const response = await api.get(`/matches/${matchId}/`);
  return response.data;
};

export const joinMatch = async (matchId) => {
  try {
    // First, verify we have a token
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    // Get the current match details
    const match = await getMatch(matchId);
    
    // Check if current user is already in the match
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser || !currentUser.id) {
      throw new Error('User information not available');
    }
    
    const currentUserId = currentUser.id;
    const isPlayer1 = match.player1 && match.player1.id === currentUserId;
    const isPlayer2 = match.player2 && match.player2.id === currentUserId;
    
    if (isPlayer1 || isPlayer2) {
      console.log('User is already in this match');
      return match;
    }

    // If not in the match, try to join
    const response = await api.post(
      `/matches/${matchId}/join/`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),
          'Authorization': `Bearer ${token}`
        },
        withCredentials: true
      }
    );
    
    return response.data;
    
  } catch (error) {
    console.error('Error in joinMatch:', error);
    
    // If the error is because user is already in the match, return the match data
    if (error.response?.data?.detail === 'You are already in this match') {
      console.log('User is already in this match (from error)');
      return await getMatch(matchId);
    }
    
    // For other errors, log and rethrow
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    
    throw error;
  }
};

export const quickMatch = async ({ opponentType = 'any', difficulty = 'medium' } = {}) => {
  const payload = {
    opponent_type: opponentType,
    difficulty,
  };
  const response = await api.post('/matchmaking/quick/', payload);
  return response.data;
};

// Game API
export const makeMove = async (matchId, choice) => {
  const response = await api.post(`/matches/${matchId}/move/`, { choice });
  return response.data;
};

export default api;
