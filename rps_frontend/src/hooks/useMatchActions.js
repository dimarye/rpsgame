import { useCallback } from 'react';
import useMatchStore from '../store/useMatchStore';

export const useMatchActions = () => {
  const {
    initMatch,
    setOpponent,
    addMove,
    setResult,
    resetRound,
    setConnectionStatus,
    setError,
    setCountdown,
    incrementRound,
    reset,
  } = useMatchStore();

  const handleInitMatch = useCallback((matchId, playerId) => {
    initMatch(matchId, playerId);
  }, [initMatch]);

  const handleSetOpponent = useCallback((opponent) => {
    setOpponent(opponent);
  }, [setOpponent]);

  const handleAddMove = useCallback((move) => {
    addMove(move);
  }, [addMove]);

  const handleSetResult = useCallback((result) => {
    setResult(result);
  }, [setResult]);

  const handleResetRound = useCallback(() => {
    resetRound();
  }, [resetRound]);

  const handleSetConnectionStatus = useCallback((isConnected) => {
    setConnectionStatus(isConnected);
  }, [setConnectionStatus]);

  const handleSetError = useCallback((error) => {
    setError(error);
  }, [setError]);

  const handleSetCountdown = useCallback((countdown) => {
    setCountdown(countdown);
  }, [setCountdown]);

  const handleIncrementRound = useCallback(() => {
    incrementRound();
  }, [incrementRound]);

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  return {
    initMatch: handleInitMatch,
    setOpponent: handleSetOpponent,
    addMove: handleAddMove,
    setResult: handleSetResult,
    resetRound: handleResetRound,
    setConnectionStatus: handleSetConnectionStatus,
    setError: handleSetError,
    setCountdown: handleSetCountdown,
    incrementRound: handleIncrementRound,
    reset: handleReset,
  };
};

export default useMatchActions;
