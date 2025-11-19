import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { login as loginApi, register as registerApi, getCurrentUser } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const userData = await getCurrentUser();
          setUser(userData);
        }
      } catch (error) {
        console.error('Auth error:', error);
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      console.log('Attempting login with:', { email });
      const result = await loginApi(email, password);
      
      if (result && result.success) {
        console.log('Login successful, result:', result);
        
        // Store tokens in localStorage
        if (result.token) {
          localStorage.setItem('token', result.token);
          if (result.refresh) {
            localStorage.setItem('refreshToken', result.refresh);
          }
          
          // Set the default authorization header for future requests
          const { default: api } = await import('../services/api');
          api.defaults.headers.common['Authorization'] = `Bearer ${result.token}`;
        }
        
        // Update the user state with the full user object
        const userData = result.user || { email, username: email.split('@')[0] };
        setUser(userData);
        toast.success('Logged in successfully');
        
        return { 
          success: true, 
          user: userData,
          token: result.token,
          refresh: result.refresh
        };
      }
      
      const errorMessage = result?.error?.message || result?.error || 'Login failed. Please check your credentials.';
      toast.error(errorMessage);
      return { 
        success: false, 
        error: errorMessage 
      };
      
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'Login failed. Please try again.';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const register = useCallback(async (username, email, password, onSuccess, onError) => {
    try {
      const { user: userData, token } = await registerApi(username, email, password);
      localStorage.setItem('token', token);
      setUser(userData);
      toast.success('Registration successful');
      onSuccess();
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Registration failed';
      toast.error(errorMessage);
      onError(errorMessage);
    }
  }, []);

  const logout = useCallback(async (onSuccess) => {
    try {
      // Remove tokens from localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      
      // Clear the authorization header
      const { default: api } = await import('../services/api');
      delete api.defaults.headers.common['Authorization'];
      
      // Clear user state
      setUser(null);
      
      toast.success('Logged out successfully');
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error during logout');
    }
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
