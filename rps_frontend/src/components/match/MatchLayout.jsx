import React, { useMemo, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import MoveSelector from './MoveSelector';
import MoveLog from './MoveLog';
import RoundResult from './RoundResult';
import TurnTimer from './TurnTimer';
import { GestureIcon } from './gestureIcons';
import useSketchSound from '../../hooks/useSketchSound';
import useMatchStore from '../../store/useMatchStore';

const determineWinner = (playerChoice, botChoice) => {
  if (!playerChoice || !botChoice) return null;
  if (playerChoice === botChoice) return 'draw';

  const wins = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper',
  };

  return wins[playerChoice] === botChoice ? 'player' : 'bot';
};

const AvatarCard = ({ label, name, accent, hpPercent, align = 'left' }) => (
  <div className={`flex flex-col gap-3 ${align === 'right' ? 'items-end text-right' : ''}`}>
    <div className="flex items-center gap-3">
      {align === 'right' && (
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--sketch-ink)] opacity-70">{label}</p>
          <p className="text-lg font-bold" style={{ color: accent }}>{name}</p>
        </div>
      )}
      <div className="relative w-16 h-16">
        <div
          className="absolute inset-0 rounded-full border-2 border-[var(--sketch-ink)]"
          style={{ backgroundColor: `${accent}22` }}
        />
        <div className="absolute inset-2 rounded-full border border-dashed border-[var(--sketch-ink)] opacity-70" />
        <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-[var(--sketch-ink)]">
          {name ? name.slice(0, 2).toUpperCase() : '??'}
        </div>
      </div>
      {align === 'left' && (
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--sketch-ink)] opacity-70">{label}</p>
          <p className="text-lg font-bold" style={{ color: accent }}>{name}</p>
        </div>
      )}
    </div>
    <div className="hp-bar w-full max-w-sm">
      <div
        className={`hp-fill ${label === 'Player' ? 'player' : 'bot'}`}
        style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }}
      />
    </div>
  </div>
);

const MatchLayout = ({ match, user, onChoiceSelect, requestSync }) => {
  const {
    opponent,
    isConnected,
    moves,
    countdown,
    isPlayerTurn,
    roundResult,
    error,
    rounds,
    winsNeeded,
    playerId,
  } = useMatchStore();

  const [clashActive, setClashActive] = useState(false);
  const [clashResult, setClashResult] = useState(null);
  const [clashKey, setClashKey] = useState(null);
  const clashTimeoutRef = useRef(null);
  const playSketchSound = useSketchSound();

  const recentMoves = useMemo(() => {
    const slice = moves.slice(-2);
    const playerMove = slice.find((m) => m.playerId === playerId) || null;
    const botMove = slice.find((m) => m.playerId !== playerId) || null;
    return { playerMove, botMove };
  }, [moves, playerId]);

  const roundIdentifier =
    recentMoves.playerMove && recentMoves.botMove
      ? `${recentMoves.playerMove.timestamp}-${recentMoves.botMove.timestamp}`
      : null;

  const playerWins = useMemo(
    () => rounds.filter((round) => !round.is_draw && round.winner?.id === playerId).length,
    [rounds, playerId]
  );
  const opponentWins = useMemo(
    () =>
      rounds.filter(
        (round) => !round.is_draw && round.winner && round.winner.id !== playerId
      ).length,
    [rounds, playerId]
  );

  const hpTarget = Math.max(1, winsNeeded || 3);
  const playerHpPercent = ((hpTarget - opponentWins) / hpTarget) * 100;
  const botHpPercent = ((hpTarget - playerWins) / hpTarget) * 100;

  useEffect(() => {
    return () => {
      if (clashTimeoutRef.current) {
        clearTimeout(clashTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!roundIdentifier || clashKey === roundIdentifier) return;
    setClashKey(roundIdentifier);
    const result = determineWinner(recentMoves.playerMove?.choice, recentMoves.botMove?.choice);
    setClashResult(result);
    setClashActive(true);
    playSketchSound('impact');
    if (result === 'player') {
      setTimeout(() => playSketchSound('victory'), 280);
    }

    if (clashTimeoutRef.current) clearTimeout(clashTimeoutRef.current);
    clashTimeoutRef.current = setTimeout(() => {
      setClashActive(false);
    }, 600);
  }, [roundIdentifier, clashKey, recentMoves, playSketchSound]);

  const statusText = () => {
    if (error) return 'Error';
    if (!isConnected) return 'Reconnecting';
    if (!opponent) return 'Waiting opponent';
    return isPlayerTurn() ? 'Your turn' : "Opponent's turn";
  };

  const statusColor = () => {
    if (error) return 'bg-red-200 text-red-800';
    if (!isConnected) return 'bg-yellow-200 text-yellow-800';
    if (!opponent) return 'bg-gray-200 text-gray-700';
    return isPlayerTurn() ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800';
  };

  const playerChoice = recentMoves.playerMove?.choice || null;
  const botChoice = recentMoves.botMove?.choice || null;

  const playerHasMoved = Boolean(recentMoves.playerMove);
  const opponentHasMoved = Boolean(recentMoves.botMove);
  const choicesRevealed = playerHasMoved && opponentHasMoved;

  const shouldClash = clashActive && choicesRevealed;

  const renderGestureToken = ({ owner, choice, reveal = false, status }) => (
    <motion.div
      key={owner}
      className="relative w-20 h-20 rounded-full border-2 border-[var(--sketch-ink)] bg-white flex items-center justify-center overflow-hidden"
      animate={
        shouldClash
          ? { x: owner === 'player' ? 60 : -60, rotate: owner === 'player' ? -6 : 6 }
          : { x: 0, rotate: 0 }
      }
      transition={{ type: 'spring', stiffness: 140, damping: 14 }}
    >
      {choice && reveal ? (
        <GestureIcon type={choice} />
      ) : (
        <span className="text-xs uppercase tracking-[0.3em] text-[var(--sketch-ink)] opacity-60 text-center">
          {status || 'Ready'}
        </span>
      )}
      <span className="absolute -bottom-4 text-[10px] uppercase tracking-[0.4em] text-[var(--sketch-ink)]">
        {owner}
      </span>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[var(--sketch-paper)] py-6 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="sketch-outline bg-white/90 p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-[var(--sketch-ink)] opacity-60">
              Sketch Arena
            </p>
            <h1 className="text-2xl font-bold text-[var(--sketch-ink)]">
              Match #{match?.id ?? '—'}
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-[0.4em] ${statusColor()}`}>
              {statusText()}
            </span>
            <button
              onClick={requestSync}
              disabled={!isConnected}
              className={`px-3 py-1 rounded-lg text-sm font-medium border-2 border-[var(--sketch-ink)] bg-white transition-all ${
                isConnected ? 'hover:-translate-y-0.5' : 'opacity-40 cursor-not-allowed'
              }`}
            >
              🔄 Sync
            </button>
            <div className="text-right">
              <p className="text-sm font-semibold text-[var(--sketch-ink)]">{user?.username || 'You'}</p>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--sketch-ink)] opacity-70">
                {isConnected ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="sketch-outline bg-red-50/90 p-4 text-red-700 font-medium">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="sketch-outline bg-white/90 p-6">
              <div className="grid md:grid-cols-3 items-center gap-6">
                <AvatarCard
                  label="Player"
                  name={user?.username || 'You'}
                  accent="var(--sketch-red)"
                  hpPercent={playerHpPercent}
                />

                <div className="flex flex-col items-center gap-4 relative">
                  <span className="vs-doodle">VS</span>
                  <div className="flex items-center justify-between w-full gap-6">
                    {renderGestureToken({
                      owner: 'player',
                      choice: playerChoice,
                      reveal: playerHasMoved,
                      status: playerHasMoved ? 'Locked' : 'Ready',
                    })}
                    <div className="relative flex-1 h-20 flex items-center justify-center">
                      {shouldClash && <div className="impact-burst" />}
                      {clashResult && !shouldClash && choicesRevealed && (
                        <span className="text-sm font-bold uppercase tracking-[0.4em] text-[var(--sketch-ink)]">
                          {clashResult === 'draw' ? 'Draw' : clashResult === 'player' ? 'Win' : 'Lose'}
                        </span>
                      )}
                    </div>
                    {renderGestureToken({
                      owner: 'bot',
                      choice: botChoice,
                      reveal: choicesRevealed,
                      status: opponentHasMoved ? 'Hidden' : 'Waiting',
                    })}
                  </div>
                </div>

                <AvatarCard
                  label="Bot"
                  name={opponent?.username || 'Sketch Bot'}
                  accent="var(--sketch-blue)"
                  hpPercent={botHpPercent}
                  align="right"
                />
              </div>
            </div>

            <MoveSelector onChoiceSelect={onChoiceSelect} />

            {(countdown || countdown === 0) && (
              <div className="sketch-outline bg-white/90 p-4">
                <TurnTimer totalTime={30} />
              </div>
            )}
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="sketch-outline bg-white/90 p-4 h-full"
            >
              <MoveLog />
            </motion.div>
          </div>
        </div>
      </div>

      <RoundResult />
    </div>
  );
};

export default MatchLayout;
