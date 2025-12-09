import React from 'react';
import useMatchWebSocket from '../hooks/useMatchWebSocket';
import useMatchStore from '../store/useMatchStore';

const WebSocketTest = () => {
  const { matchId, isConnected, opponent, error, moves } = useMatchStore();
  const { sendJson, disconnect, forceReconnect } = useMatchWebSocket('test-match-123');

  const handleSendMove = () => {
    const choices = ['rock', 'paper', 'scissors'];
    const randomChoice = choices[Math.floor(Math.random() * choices.length)];
    
    sendJson({
      type: 'move',
      payload: {
        choice: randomChoice,
      }
    });
  };

  const handleSendTestMessage = (messageType) => {
    sendJson({
      type: messageType,
      payload: {
        test: true,
        timestamp: new Date().toISOString(),
      }
    });
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">WebSocket Connection Test</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connection Status */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Connection Status</h3>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="font-medium">Status:</span>
              <span className={`px-2 py-1 rounded text-sm ${
                isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            <div>
              <span className="font-medium">Match ID:</span> test-match-123
            </div>
            
            <div>
              <span className="font-medium">Opponent:</span> {opponent?.username || 'None'}
            </div>
            
            <div>
              <span className="font-medium">Moves:</span> {moves.length}
            </div>
            
            {error && (
              <div className="text-red-600 text-sm">
                <span className="font-medium">Error:</span> {error}
              </div>
            )}
          </div>
          
          {/* Connection Controls */}
          <div className="space-y-2">
            <h4 className="font-medium">Connection Controls</h4>
            <div className="flex space-x-2">
              <button
                onClick={forceReconnect}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                Force Reconnect
              </button>
              <button
                onClick={disconnect}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
        
        {/* Message Sending */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Send Test Messages</h3>
          
          <div className="space-y-2">
            <button
              onClick={handleSendMove}
              disabled={!isConnected}
              className="w-full px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Send Random Move
            </button>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSendTestMessage('ping')}
                disabled={!isConnected}
                className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
              >
                Send Ping
              </button>
              
              <button
                onClick={() => handleSendTestMessage('join')}
                disabled={!isConnected}
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
              >
                Simulate Join
              </button>
              
              <button
                onClick={() => handleSendTestMessage('state')}
                disabled={!isConnected}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
              >
                Request State
              </button>
              
              <button
                onClick={() => handleSendTestMessage('leave')}
                disabled={!isConnected}
                className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
              >
                Simulate Leave
              </button>
            </div>
          </div>
          
          {/* Message Log */}
          <div>
            <h4 className="font-medium mb-2">Expected Message Types:</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>• <code className="bg-gray-100 px-1 rounded">pong</code> - Heartbeat response</div>
              <div>• <code className="bg-gray-100 px-1 rounded">join</code> - Player joined</div>
              <div>• <code className="bg-gray-100 px-1 rounded">move</code> - Move made</div>
              <div>• <code className="bg-gray-100 px-1 rounded">state</code> - State update</div>
              <div>• <code className="bg-gray-100 px-1 rounded">result</code> - Round result</div>
              <div>• <code className="bg-gray-100 px-1 rounded">opponent_left</code> - Opponent left</div>
              <div>• <code className="bg-gray-100 px-1 rounded">error</code> - Server error</div>
              <div>• <code className="bg-gray-100 px-1 rounded">timeout</code> - Move timeout</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">Usage Instructions:</h4>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Hook automatically connects when matchId is provided</li>
          <li>Sends heartbeat every 25 seconds to maintain connection</li>
          <li>Auto-reconnects with exponential backoff on disconnection</li>
          <li>Directly updates Zustand store with received data</li>
          <li>Shows toast notifications for important events</li>
        </ol>
      </div>
    </div>
  );
};

export default WebSocketTest;
