import React, { useState, useEffect } from 'react';
import useMatchStore from '../store/useMatchStore';
import { toast } from 'react-hot-toast';

const NetworkStatus = () => {
  const { isConnected, setError } = useMatchStore();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineWarning, setShowOfflineWarning] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineWarning(false);
      toast.success('Internet connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineWarning(true);
      setError('No internet connection');
      toast.error('No internet connection');
    };

    const handleConnectionChange = () => {
      setIsOnline(navigator.onLine);
      
      if (!navigator.onLine) {
        setShowOfflineWarning(true);
        setError('No internet connection');
      } else {
        setShowOfflineWarning(false);
        setError(null);
      }
    };

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Listen for connection change events (more detailed)
    if ('connection' in navigator) {
      navigator.connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if ('connection' in navigator) {
        navigator.connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [setError]);

  // Don't render if everything is fine
  if (isOnline && isConnected) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      {showOfflineWarning && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                No Internet Connection
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  Please check your internet connection. Some features may not work properly.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isOnline && !showOfflineWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Connection Unstable
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Your internet connection is unstable. Game functionality may be affected.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isOnline && !isConnected && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 shadow-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-orange-800">
                Game Server Disconnected
              </h3>
              <div className="mt-2 text-sm text-orange-700">
                <p>
                  Attempting to reconnect to the game server...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkStatus;
