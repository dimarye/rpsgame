import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';

// Determine WebSocket protocol (ws:// or wss://) based on the current protocol
const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws`;
};

const WS_URL = import.meta.env.VITE_WS_URL || getWebSocketUrl();

const useWebSocket = (urlSuffix, onMessage) => {
  const ws = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds
  const reconnectTimeout = useRef(null);
  const pingInterval = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  
  // Store the latest onMessage callback
  const onMessageRef = useRef(onMessage);
  
  // Update the ref when onMessage changes
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // Function to refresh the token
  const refreshToken = useCallback(async () => {
    try {
      console.log('[WebSocket] Attempting to refresh token...');
      const response = await fetch('/api/auth/token/refresh/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh: localStorage.getItem('refreshToken')
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      localStorage.setItem('token', data.access);
      if (data.refresh) {
        localStorage.setItem('refreshToken', data.refresh);
      }
      console.log('[WebSocket] Token refreshed successfully');
      return data.access;
    } catch (error) {
      console.error('[WebSocket] Error refreshing token:', error);
      // Clear invalid tokens
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      throw error;
    }
  }, []);

  // Cleanup function for WebSocket and intervals
  const cleanup = useCallback(() => {
    // Clear ping interval
    if (pingInterval.current) {
      clearInterval(pingInterval.current);
      pingInterval.current = null;
    }
    
    // Clear reconnect timeout
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    
    // Close WebSocket connection if it exists
    if (ws.current) {
      // Remove all event listeners
      ws.current.onopen = null;
      ws.current.onclose = null;
      ws.current.onerror = null;
      ws.current.onmessage = null;
      
      // Close connection if it's still open
      if (ws.current.readyState === WebSocket.OPEN || 
          ws.current.readyState === WebSocket.CONNECTING) {
        ws.current.close(1000, 'Cleanup');
      }
      ws.current = null;
    }
    
    setIsConnected(false);
  }, []);

  const connect = useCallback(async () => {
    // If no URL is provided, don't connect
    if (!urlSuffix) {
      console.log('[WebSocket] No URL provided, skipping connection');
      return;
    }

    // Clean up any existing connection
    cleanup();

    // Get the authentication token
    let token = localStorage.getItem('token');
    if (!token) {
      const errorMsg = 'No authentication token found';
      console.error('[WebSocket]', errorMsg);
      setError(errorMsg);
      return;
    }

    try {
      // Create WebSocket URL with token
      const wsUrl = `${WS_URL}${urlSuffix}?token=${encodeURIComponent(token)}`;
      console.log('[WebSocket] Connecting to:', wsUrl);
      
      // Create a new WebSocket connection
      ws.current = new WebSocket(wsUrl);

      // Setup WebSocket event handlers
      ws.current.onopen = () => {
        console.log('[WebSocket] Connection established');
        reconnectAttempts.current = 0;
        setIsConnected(true);
        setError(null);
        
        // Setup ping interval to keep connection alive
        pingInterval.current = setInterval(() => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            try {
              ws.current.send(JSON.stringify({ type: 'ping' }));
            } catch (error) {
              console.error('[WebSocket] Error sending ping:', error);
              clearInterval(pingInterval.current);
              pingInterval.current = null;
            }
          } else {
            clearInterval(pingInterval.current);
            pingInterval.current = null;
          }
        }, 30000); // Send ping every 30 seconds
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', data);
          if (onMessageRef.current) {
            onMessageRef.current(data);
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error, 'Raw data:', event.data);
          setError('Error parsing WebSocket message');
        }
      };

      ws.current.onclose = async (event) => {
        console.log(`[WebSocket] Connection closed - Code: ${event.code}, Reason: ${event.reason}`);
        setIsConnected(false);
        
        // Clear ping interval on close
        if (pingInterval.current) {
          clearInterval(pingInterval.current);
          pingInterval.current = null;
        }
        
        // Handle specific close codes
        if (event.code === 1000) {
          console.log('[WebSocket] Connection closed normally');
          return;
        }
        
        // Handle token expiration (code 4001)
        if (event.code === 4001 && localStorage.getItem('refreshToken')) {
          console.log('[WebSocket] Token expired, attempting to refresh...');
          try {
            const newToken = await refreshToken();
            if (newToken) {
              console.log('[WebSocket] Token refreshed, reconnecting...');
              reconnectAttempts.current = 0;
              connect();
              return;
            }
          } catch (error) {
            console.error('[WebSocket] Failed to refresh token:', error);
            toast.error('Session expired. Please log in again.');
            return;
          }
        }
        
        // Handle reconnection with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`[WebSocket] Will attempt to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeout.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          const errorMsg = `Failed to connect after ${maxReconnectAttempts} attempts`;
          console.error('[WebSocket]', errorMsg);
          setError(errorMsg);
          toast.error('Connection lost. Please refresh the page to try again.');
        }
      };

      ws.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        setError('WebSocket error');
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      setError('Failed to connect to WebSocket');
      
      // Attempt to reconnect
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        console.log(`[WebSocket] Will retry connection in ${delay}ms... (${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
        
        reconnectTimeout.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      } else {
        const errorMsg = 'Max reconnection attempts reached';
        console.error('[WebSocket]', errorMsg);
        setError(errorMsg);
        toast.error('Connection lost. Please refresh the page to try again.');
      }
    }
  }, [urlSuffix, refreshToken, cleanup]);

  // Function to send messages through WebSocket
  const sendMessage = useCallback((message) => {
    if (!ws.current) {
      console.error('[WebSocket] Cannot send message - WebSocket not initialized');
      setError('WebSocket not initialized');
      return false;
    }
    
    if (ws.current.readyState === WebSocket.OPEN) {
      try {
        const messageStr = JSON.stringify(message);
        console.log('[WebSocket] Sending message:', message);
        ws.current.send(messageStr);
        return true;
      } catch (error) {
        console.error('[WebSocket] Error sending message:', error);
        setError('Failed to send message');
        return false;
      }
    } else {
      console.error('[WebSocket] Cannot send message - WebSocket is not connected. State:', ws.current.readyState);
      setError('WebSocket is not connected');
      return false;
    }
  }, []);

  // Initialize WebSocket connection when the component mounts or urlSuffix changes
  useEffect(() => {
    console.log('[WebSocket] Effect running, URL suffix:', urlSuffix);
    
    // Only connect if we have a URL suffix
    if (urlSuffix) {
      console.log('[WebSocket] Initializing connection...');
      connect();
    } else {
      console.log('[WebSocket] No URL suffix provided, skipping connection');
    }

    // Cleanup on unmount or when urlSuffix changes
    return () => {
      console.log('[WebSocket] Cleaning up...');
      cleanup();
    };
  }, [urlSuffix, connect, cleanup]);

  return { sendMessage, isConnected, error };
};

export default useWebSocket;
