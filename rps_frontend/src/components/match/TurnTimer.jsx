import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useMatchStore from '../../store/useMatchStore';
import useMatchWebSocket from '../../hooks/useWebSocket';

const TurnTimer = ({ totalTime = 30 }) => {
  const { countdown, isPlayerTurn, isConnected, playerId, timeoutOccurred } = useMatchStore();
  const { sendJson } = useMatchWebSocket();
  
  const isPlayerTurnValue = typeof isPlayerTurn === 'function' ? isPlayerTurn() : !!isPlayerTurn;

  const [animatedTimeLeft, setAnimatedTimeLeft] = useState(totalTime);
  const [isWarning, setIsWarning] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [showTimeoutAnimation, setShowTimeoutAnimation] = useState(false);
  const timeoutRef = useRef(null);

  // Update timer state based on countdown from store
  useEffect(() => {
    const newTime = countdown ?? totalTime;
    setAnimatedTimeLeft(newTime);
    setIsWarning(newTime <= 10 && newTime > 5);
    setIsUrgent(newTime <= 5 && newTime > 0);

    const active = isPlayerTurnValue && isConnected && countdown !== null && !timeoutOccurred;
    setIsActive(active);
    
    // Show timeout animation when time runs out
    if (newTime <= 0 && active) {
      setShowTimeoutAnimation(true);
      setTimeout(() => setShowTimeoutAnimation(false), 2000);
    }
  }, [countdown, isPlayerTurnValue, isConnected, totalTime, timeoutOccurred]);

  // Local countdown tick: decrease animatedTimeLeft once per second while active
  useEffect(() => {
    if (!isActive || timeoutOccurred) {
      return;
    }

    const intervalId = setInterval(() => {
      setAnimatedTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isActive, timeoutOccurred]);

  // Handle timeout - send timeout message when countdown reaches 0
  useEffect(() => {
    if (animatedTimeLeft <= 0 && isActive && !timeoutRef.current) {
      timeoutRef.current = true;
      
      // Send timeout message to server
      sendJson({
        type: 'timeout',
        payload: {
          playerId: playerId,
          timestamp: new Date().toISOString()
        }
      });
      
      // Reset timeout flag after a delay
      setTimeout(() => {
        timeoutRef.current = false;
      }, 1000);
    } else if (animatedTimeLeft > 0) {
      timeoutRef.current = false;
    }
  }, [animatedTimeLeft, isActive, sendJson, playerId]);

  const percentage = totalTime > 0 ? (animatedTimeLeft / totalTime) * 100 : 0;
  
  const getTimerColor = () => {
    if (!isActive || timeoutOccurred) return 'bg-gray-300';
    if (isUrgent) return 'bg-red-500';
    if (isWarning) return 'bg-orange-500';
    if (percentage <= 25) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTextColor = () => {
    if (!isActive) return 'text-gray-500';
    if (isUrgent) return 'text-red-600';
    if (isWarning) return 'text-orange-600';
    if (percentage <= 25) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getTimerAnimation = () => {
    if (isUrgent) return 'timer-urgent';
    if (isWarning) return 'timer-warning';
    return 'timer-normal';
  };

  const formatTime = (seconds) => {
    if (seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      className="bg-white rounded-2xl shadow-lg p-6 animate-fade-in"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Timer Header */}
      <div className="text-center mb-4">
        <motion.h3 
          className="text-lg font-semibold text-gray-900"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Time Remaining
        </motion.h3>
        <motion.p 
          className="text-sm text-gray-500 mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {!isConnected ? (
            <span className="text-orange-600 animate-pulse">🔄 Reconnecting...</span>
          ) : !isPlayerTurnValue ? (
            <span className="text-blue-600">⏸️ Opponent's turn</span>
          ) : (
            <span className="text-green-600">⚡ Make your choice before time runs out!</span>
          )}
        </motion.p>
      </div>

      {/* Timer Display */}
      <div className="relative">
        {/* Circular Progress */}
        <div className="relative w-32 h-32 mx-auto mb-4">
          {/* Background Circle */}
          <svg className="transform -rotate-90 w-32 h-32">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="12"
              fill="none"
              className="text-gray-200"
            />
            {/* Progress Circle */}
            <motion.circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="12"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 56}`}
              strokeDashoffset={`${2 * Math.PI * 56 * (1 - percentage / 100)}`}
              className={`${getTimerColor().replace('bg-', 'text-')} transition-all duration-1000 ease-linear`}
              strokeLinecap="round"
              animate={{
                strokeDashoffset: `${2 * Math.PI * 56 * (1 - percentage / 100)}`
              }}
              transition={{ duration: 0.5, ease: "linear" }}
            />
          </svg>
          
          {/* Time Display in Center */}
          <motion.div 
            className="absolute inset-0 flex flex-col items-center justify-center"
            animate={{
              scale: isUrgent ? [1, 1.1, 1] : 1
            }}
            transition={{
              duration: 1,
              repeat: isUrgent ? Infinity : 0,
              repeatType: "reverse"
            }}
          >
            <div className={`text-2xl font-bold ${getTextColor()} ${getTimerAnimation()} transition-colors duration-300`}>
              {formatTime(animatedTimeLeft)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {animatedTimeLeft <= 0 ? "Time's up!" : 'seconds'}
            </div>
          </motion.div>

          {/* Timeout Animation Overlay */}
          <AnimatePresence>
            {showTimeoutAnimation && (
              <motion.div
                className="absolute inset-0 bg-red-500 bg-opacity-20 rounded-full flex items-center justify-center"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="text-4xl animate-bounce">⏰</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Linear Progress Bar */}
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <motion.div
              className={`h-full transition-all duration-1000 ease-linear ${getTimerColor()}`}
              style={{ width: `${Math.max(0, percentage)}%` }}
              animate={{
                width: `${Math.max(0, percentage)}%`
              }}
              transition={{ duration: 0.5, ease: "linear" }}
            />
          </div>
        </div>

        {/* Status Messages */}
        <motion.div 
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {animatedTimeLeft <= 0 ? (
              <motion.div
                key="timeout"
                className="text-red-600 font-medium"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <span className="animate-pulse">⏰ Time's up! Round ended...</span>
              </motion.div>
            ) : isUrgent ? (
              <motion.div
                key="urgent"
                className="text-red-600 font-medium"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                <span className="animate-pulse">⚠️ Hurry up! {animatedTimeLeft}s left</span>
              </motion.div>
            ) : isWarning ? (
              <motion.div
                key="warning"
                className="text-orange-600 font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span>⏱️ Time is running low</span>
              </motion.div>
            ) : isActive ? (
              <motion.div
                key="active"
                className="text-green-600 font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span>✅ Plenty of time</span>
              </motion.div>
            ) : (
              <motion.div
                key="paused"
                className="text-gray-500 font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span>⏸️ Timer paused</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Visual Indicators */}
        <AnimatePresence>
          {isActive && (
            <motion.div 
              className="mt-4 flex justify-center space-x-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    isUrgent
                      ? 'bg-red-400'
                      : isWarning
                      ? 'bg-orange-400'
                      : 'bg-green-400'
                  }`}
                  animate={{
                    scale: isUrgent ? [1, 1.5, 1] : 1,
                    opacity: animatedTimeLeft > 0 ? 1 : 0.3
                  }}
                  transition={{
                    duration: isUrgent ? 0.5 : 1,
                    delay: i * 0.2,
                    repeat: isUrgent ? Infinity : 0,
                    repeatType: "reverse"
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tips */}
      <motion.div 
        className="mt-4 p-3 bg-gray-50 rounded-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex items-start">
            <span className="mr-1">💡</span>
            <span><strong>Tip:</strong> Choose quickly to avoid timeout!</span>
          </div>
          <div className="flex items-start">
            <span className="mr-1">⚡</span>
            <span><strong>Strategy:</strong> Don't rush - think about your move!</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TurnTimer;
