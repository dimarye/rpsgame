import React, { createContext, useContext } from 'react';
import useWebSocket from '../hooks/useWebSocket';

const WebSocketContext = createContext();

export const useWebSocketContext = () => {
  return useContext(WebSocketContext);
};

export const WebSocketProvider = ({ children }) => {
  // Use the real useWebSocket hook
  const webSocketState = useWebSocket(null, null);
  
  return (
    <WebSocketContext.Provider value={webSocketState}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketContext;
