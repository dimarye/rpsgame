import React, { createContext, useContext, useState, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';

// Create context for toast management
const ToastContext = createContext();

// Custom toast configurations
const toastConfig = {
  success: {
    duration: 4000,
    position: 'top-center',
    style: {
      background: '#10b981',
      color: 'white',
      padding: '12px 20px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)',
    },
    iconTheme: {
      primary: '#ffffff',
      secondary: '#10b981',
    },
  },
  error: {
    duration: 5000,
    position: 'top-center',
    style: {
      background: '#ef4444',
      color: 'white',
      padding: '12px 20px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: '0 10px 25px rgba(239, 68, 68, 0.3)',
    },
    iconTheme: {
      primary: '#ffffff',
      secondary: '#ef4444',
    },
  },
  info: {
    duration: 3000,
    position: 'top-center',
    style: {
      background: '#3b82f6',
      color: 'white',
      padding: '12px 20px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)',
    },
    iconTheme: {
      primary: '#ffffff',
      secondary: '#3b82f6',
    },
  },
  warning: {
    duration: 4000,
    position: 'top-center',
    style: {
      background: '#f59e0b',
      color: 'white',
      padding: '12px 20px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: '0 10px 25px rgba(245, 158, 11, 0.3)',
    },
    iconTheme: {
      primary: '#ffffff',
      secondary: '#f59e0b',
    },
  },
  loading: {
    duration: Infinity,
    position: 'top-center',
    style: {
      background: '#6b7280',
      color: 'white',
      padding: '12px 20px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: '0 10px 25px rgba(107, 114, 128, 0.3)',
    },
  },
};

// Toast Provider Component
export const ToastProvider = ({ children }) => {
  const [loadingToasts, setLoadingToasts] = useState(new Set());

  // Enhanced toast functions
  const showToast = useCallback((message, type = 'info', options = {}) => {
    const config = toastConfig[type] || toastConfig.info;
    return toast(message, {
      ...config,
      ...options,
    });
  }, []);

  const showSuccess = useCallback((message, options = {}) => {
    return showToast(message, 'success', options);
  }, [showToast]);

  const showError = useCallback((message, options = {}) => {
    return showToast(message, 'error', options);
  }, [showToast]);

  const showInfo = useCallback((message, options = {}) => {
    return showToast(message, 'info', options);
  }, [showToast]);

  const showWarning = useCallback((message, options = {}) => {
    return showToast(message, 'warning', options);
  }, [showToast]);

  const showLoading = useCallback((message, options = {}) => {
    const config = toastConfig.loading;
    const id = toast.loading(message, {
      ...config,
      ...options,
    });
    
    setLoadingToasts(prev => new Set(prev).add(id));
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    toast.dismiss(id);
    setLoadingToasts(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  const dismissAllToasts = useCallback(() => {
    toast.dismiss();
    setLoadingToasts(new Set());
  }, []);

  // Game-specific toast helpers
  const showGameStart = useCallback(() => {
    showSuccess('🎮 Game started! Make your choice!');
  }, [showSuccess]);

  const showMoveSuccess = useCallback((choice) => {
    showSuccess(`✅ You chose ${choice}! Waiting for opponent...`);
  }, [showSuccess]);

  const showRoundWin = useCallback(() => {
    showSuccess('🎉 You won this round!');
  }, [showSuccess]);

  const showRoundLose = useCallback(() => {
    showError('😔 You lost this round!');
  }, [showError]);

  const showRoundDraw = useCallback(() => {
    showWarning('🤝 It\'s a draw!');
  }, [showWarning]);

  const showTimeWarning = useCallback((seconds) => {
    showWarning(`⏰ Only ${seconds} seconds left!`);
  }, [showWarning]);

  const showConnectionError = useCallback(() => {
    showError('🔌 Connection lost. Trying to reconnect...');
  }, [showError]);

  const showOpponentJoined = useCallback(() => {
    showSuccess('👋 Opponent joined the game!');
  }, [showSuccess]);

  const showOpponentLeft = useCallback(() => {
    showWarning('👋 Opponent left the game');
  }, [showWarning]);

  const contextValue = {
    // Basic toast functions
    showToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showLoading,
    dismissToast,
    dismissAllToasts,
    
    // Game-specific functions
    showGameStart,
    showMoveSuccess,
    showRoundWin,
    showRoundLose,
    showRoundDraw,
    showTimeWarning,
    showConnectionError,
    showOpponentJoined,
    showOpponentLeft,
    
    // State
    loadingToasts,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      {/* Global Toaster Component */}
      <Toaster
        position="top-center"
        gutter={12}
        containerStyle={{
          top: 20,
          left: 20,
          right: 20,
        }}
        toastOptions={{
          // Default style for all toasts
          style: {
            background: '#ffffff',
            color: '#374151',
            padding: '12px 20px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
            maxWidth: '400px',
          },
          // Default icon theme
          iconTheme: {
            primary: '#3b82f6',
            secondary: '#ffffff',
          },
          // Default duration
          duration: 4000,
        }}
      />
    </ToastContext.Provider>
  );
};

// Hook to use toast context
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Export toast directly for convenience
export { toast };

export default ToastProvider;
