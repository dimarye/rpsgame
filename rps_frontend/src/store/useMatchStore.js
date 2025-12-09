import { create } from 'zustand';

const useMatchStore = create((set, get) => ({
  // State
  matchId: null,
  playerId: null,
  opponent: null,
  moves: [],
  rounds: [],
  roundResult: null,
  isConnected: false,
  error: null,
  countdown: null,
  roundNumber: 1,
  matchStatus: 'waiting', // waiting, active, completed
  currentRound: null,
  winner: null,
  winsNeeded: 3,
  timeoutOccurred: false, // Track if timeout occurred in current round

  // Actions
  initMatch: (matchId, playerId) => {
    set({
      matchId,
      playerId,
      opponent: null,
      moves: [],
      rounds: [],
      roundResult: null,
      error: null,
      countdown: null,
      roundNumber: 1,
      matchStatus: 'waiting',
      currentRound: null,
      winner: null,
      timeoutOccurred: false,
      winsNeeded: 3,
    });
  },

  setOpponent: (opponent) => {
    set({ opponent });
  },

  addMove: (move) => {
    const currentMoves = get().moves;
    set({ moves: [...currentMoves, move] });
  },

  setMoves: (moves) => {
    set({ moves });
  },

  setRounds: (rounds) => {
    set({ rounds });
  },

  setResult: (result) => {
    set({ roundResult: result });
  },

  setWinsNeeded: (winsNeeded) => {
    set({ winsNeeded });
  },

  resetRound: () => {
    set({
      moves: [],
      rounds: [],
      roundResult: null,
      countdown: null,
      timeoutOccurred: false,
    });
  },

  setConnectionStatus: (isConnected) => {
    set({ isConnected });
  },

  setError: (error) => {
    set({ error });
  },

  setCountdown: (countdown) => {
    set({ countdown });
  },

  setMatchStatus: (matchStatus) => {
    set({ matchStatus });
  },

  setCurrentRound: (currentRound) => {
    set({ currentRound });
  },

  setWinner: (winner) => {
    set({ winner });
  },

  setTimeoutOccurred: (timeoutOccurred) => {
    set({ timeoutOccurred });
  },

  incrementRound: () => {
    set(state => ({ roundNumber: state.roundNumber + 1 }));
  },

  // Computed values
  getCurrentRoundMoves: () => {
    const { moves } = get();
    // Return last 2 moves for current round
    return moves.slice(-2);
  },

  isPlayerTurn: () => {
    const { moves, playerId, timeoutOccurred, matchStatus } = get();

    const totalMoves = moves.length;

    // If match is finished, no further moves are allowed
    if (matchStatus === 'finished') {
      console.log('[Turn Debug] Match finished, cannot move');
      return false;
    }

    // If timeout happened, no one can move
    if (timeoutOccurred) {
      console.log('[Turn Debug] Timeout occurred, cannot move');
      return false;
    }

    // No moves yet in match or current round -> both players can start the round
    if (totalMoves === 0) {
      console.log('[Turn Debug] No moves yet, player can move');
      return true;
    }

    const lastMove = moves[totalMoves - 1];

    // Odd number of moves: one move in the current round
    // Only the opponent (who didn't move yet) can play
    if (totalMoves % 2 === 1) {
      const canMove = lastMove.playerId !== playerId;
      console.log('[Turn Debug] One move in current round, lastMove.playerId =', lastMove.playerId, 'playerId =', playerId, 'canMove =', canMove);
      return canMove;
    }

    // Even number of moves: last round is complete, new round not started yet
    // Either player can start the next round
    console.log('[Turn Debug] Last round complete, new round can start, player can move');
    return true;
  },

  // Reset entire store
  reset: () => {
    set({
      matchId: null,
      playerId: null,
      opponent: null,
      moves: [],
      rounds: [],
      roundResult: null,
      isConnected: false,
      error: null,
      countdown: null,
      roundNumber: 1,
      matchStatus: 'waiting',
      currentRound: null,
      winner: null,
      timeoutOccurred: false,
      winsNeeded: 3,
    });
  },
}));

// Export actions separately for convenience
export const useMatchActions = () => {
  const store = useMatchStore();
  return {
    initMatch: store.initMatch,
    setOpponent: store.setOpponent,
    addMove: store.addMove,
    setMoves: store.setMoves,
    setResult: store.setResult,
    resetRound: store.resetRound,
    setConnectionStatus: store.setConnectionStatus,
    setError: store.setError,
    setCountdown: store.setCountdown,
    setMatchStatus: store.setMatchStatus,
    setCurrentRound: store.setCurrentRound,
    setWinner: store.setWinner,
    setTimeoutOccurred: store.setTimeoutOccurred,
    incrementRound: store.incrementRound,
    reset: store.reset,
  };
};

export default useMatchStore;
