import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext';
import { useAuth } from './useAuth';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch
global.fetch = vi.fn();

// Mock toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

const wrapper = ({ children }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('useAuth Hook', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with null user and not authenticated', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(true);
    });

    it('should load user from localStorage on mount', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        rating: 1000,
      };
      
      localStorageMock.setItem('user', JSON.stringify(mockUser));
      localStorageMock.setItem('token', 'mock-token');
      
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('Login Function', () => {
    it('should login successfully with valid credentials', async () => {
      const mockResponse = {
        access: 'access-token',
        refresh: 'refresh-token',
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          rating: 1000,
        },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      expect(result.current.user).toEqual(mockResponse.user);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', mockResponse.access);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockResponse.user));
    });

    it('should handle login failure with invalid credentials', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid credentials' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('testuser', 'wrongpassword');
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle network errors during login', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Register Function', () => {
    it('should register successfully with valid data', async () => {
      const mockResponse = {
        id: 1,
        username: 'newuser',
        email: 'new@example.com',
        rating: 1000,
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      const userData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        password_confirm: 'password123',
        first_name: 'New',
        last_name: 'User',
      };

      await act(async () => {
        await result.current.register(userData);
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/register/'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData),
        })
      );
    });

    it('should handle registration failure with duplicate username', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ username: ['Username already exists'] }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      const userData = {
        username: 'existinguser',
        email: 'new@example.com',
        password: 'password123',
        password_confirm: 'password123',
      };

      await act(async () => {
        await result.current.register(userData);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Logout Function', () => {
    it('should logout successfully', async () => {
      // First login
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        rating: 1000,
      };

      localStorageMock.setItem('user', JSON.stringify(mockUser));
      localStorageMock.setItem('token', 'mock-token');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Then logout
      await act(async () => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh token automatically', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        rating: 1000,
      };

      localStorageMock.setItem('user', JSON.stringify(mockUser));
      localStorageMock.setItem('token', 'old-token');
      localStorageMock.setItem('refresh_token', 'refresh-token');

      // Mock successful token refresh
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access: 'new-access-token',
          refresh: 'new-refresh-token',
        }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Simulate token refresh (this would be triggered by API calls)
      await act(async () => {
        await result.current.refreshToken();
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'new-access-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('refresh_token', 'new-refresh-token');
    });

    it('should handle token refresh failure', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        rating: 1000,
      };

      localStorageMock.setItem('user', JSON.stringify(mockUser));
      localStorageMock.setItem('token', 'expired-token');
      localStorageMock.setItem('refresh_token', 'expired-refresh');

      // Mock failed token refresh
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Token expired' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.refreshToken();
      });

      // Should logout on refresh failure
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('API Request Helper', () => {
    it('should make authenticated API requests', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        rating: 1000,
      };

      localStorageMock.setItem('user', JSON.stringify(mockUser));
      localStorageMock.setItem('token', 'auth-token');

      const mockResponse = { data: 'test data' };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      const response = await result.current.apiRequest('/api/test/');

      expect(response).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        '/api/test/',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer auth-token',
          }),
        })
      );
    });

    it('should handle API request errors', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        rating: 1000,
      };

      localStorageMock.setItem('user', JSON.stringify(mockUser));
      localStorageMock.setItem('token', 'auth-token');

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await expect(result.current.apiRequest('/api/notfound/')).rejects.toThrow();
    });
  });

  describe('User Update', () => {
    it('should update user profile successfully', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        rating: 1000,
      };

      localStorageMock.setItem('user', JSON.stringify(mockUser));
      localStorageMock.setItem('token', 'auth-token');

      const updatedUser = {
        ...mockUser,
        display_name: 'Updated Name',
        avatar: 'https://example.com/avatar.jpg',
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedUser,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.updateProfile({
          display_name: 'Updated Name',
          avatar: 'https://example.com/avatar.jpg',
        });
      });

      expect(result.current.user).toEqual(updatedUser);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('user', JSON.stringify(updatedUser));
    });
  });

  describe('Loading States', () => {
    it('should show loading state during login', async () => {
      fetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => 
          resolve({
            ok: true,
            json: async () => ({
              access: 'access-token',
              refresh: 'refresh-token',
              user: { id: 1, username: 'testuser' },
            })
          }), 100)
        )
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.isLoading).toBe(false); // After initial load

      await act(async () => {
        const loginPromise = result.current.login('testuser', 'password');
        expect(result.current.isLoading).toBe(true);
        await loginPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should show loading state during registration', async () => {
      fetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => 
          resolve({
            ok: true,
            json: async () => ({ id: 1, username: 'newuser' }),
          }), 100)
        )
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        const registerPromise = result.current.register({
          username: 'newuser',
          email: 'new@example.com',
          password: 'password123',
          password_confirm: 'password123',
        });
        expect(result.current.isLoading).toBe(true);
        await registerPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
