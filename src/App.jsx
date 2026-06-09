import React, { useEffect } from 'react';
import { useGame } from './context/GameContext';
import Board from './components/Board';
import Keyboard from './components/Keyboard';

export default function App() {
  const {
    mode,
    difficulty,
    turn,
    isGameOver,
    isWin,
    guesses,
    currentGuess,
    stats,
    onInput,
    onEnter,
    onDelete,
    onModeChange,
    onDifficultyChange,
    solution,
    message,
    playAgain,
    playerId,
    playerName,
    onlinePlayers,
    incomingRequest,
    outgoingRequest,
    multiplayerMatch,
    lineTimeLeft,
    multiplayerMessage,
    multiplayerStatus,
    sendMultiplayerRequest,
    acceptMultiplayerRequest,
    declineMultiplayerRequest,
    leaveMultiplayerMatch,
    proposeRematch,
    exitMultiplayerMode,
    requestAgentLine,
    agentActive,
    agentMessage
  } = useGame();

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isGameOver && event.key === ' ') {
        event.preventDefault();
        playAgain();
      } else if (event.key === 'Enter') {
        onEnter();
      } else if (event.key === 'Backspace') {
        onDelete();
      } else if (/^[a-zA-Z]$/.test(event.key)) {
        onInput(event.key.toLowerCase());
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onInput, onEnter, onDelete, isGameOver, playAgain]);

  return (
    <div className="app-container">
      <header>
        <h1>Wordal</h1>
        <div className="mode-selector">
          <button onClick={() => onModeChange('daily')} disabled={mode === 'daily' || agentActive || multiplayerMatch?.status === 'active'}>
            Daily
          </button>
          <button onClick={() => onModeChange('unlimited')} disabled={mode === 'unlimited' || agentActive || multiplayerMatch?.status === 'active'}>
            Unlimited
          </button>
          <button type="button" onClick={requestAgentLine} disabled={agentActive} style={{ display: multiplayerMatch ? 'none' : 'block' }}>
            Computer Ji
          </button>
          <button
            type="button"
            onClick={sendMultiplayerRequest}
            disabled={multiplayerMatch?.status === 'active' || outgoingRequest || incomingRequest}
          >
            Play with random player ({onlinePlayers.length})
          </button>
          {multiplayerMatch?.status === 'active' && (
            <button type="button" onClick={leaveMultiplayerMatch}>
              Leave Match
            </button>
          )}
          {multiplayerMatch?.status === 'ended' && (
            <>
              <button type="button" onClick={proposeRematch}>
                Propose Rematch
              </button>
              <button type="button" onClick={sendMultiplayerRequest}>
                Offer to Another Random Player
              </button>
              <button type="button" onClick={exitMultiplayerMode}>
                Exit Multiplayer Mode
              </button>
            </>
          )}
        </div>
      </header>

      <div className="difficulty-selector">
        <button onClick={() => onDifficultyChange('easy')} disabled={difficulty === 'easy' || agentActive}>
          Easy
        </button>
        <button onClick={() => onDifficultyChange('hard')} disabled={difficulty === 'hard' || agentActive}>
          Hard
        </button>
      </div>

      <main>
        <div className="multiplayer-bar">
          {multiplayerMatch?.status === 'active' ? (
            <>
              <strong>Match:</strong> {playerName} vs {multiplayerMatch.names[multiplayerMatch.players.find((id) => id !== playerId)] || 'Opponent'}
              <span className="badge">
                {multiplayerMatch.currentPlayerId === playerId ? 'Your turn' : 'Opponent turn'}
              </span>
            </>
          ) : null}
        </div>
        <Board guesses={multiplayerMatch?.guesses ?? guesses} currentGuess={currentGuess} turn={turn} />
        <div className="status">
          {message && <p>{message}</p>}
          {multiplayerMessage && <p>{multiplayerMessage}</p>}
          {incomingRequest && (
            <div className="popup">
              <p>
                {incomingRequest.originName} wants to start a multiplayer match with you.
              </p>
              <button onClick={acceptMultiplayerRequest}>Accept</button>
              <button onClick={declineMultiplayerRequest}>Decline</button>
            </div>
          )}
          {multiplayerMatch?.status === 'active' && (
            <p>
              {multiplayerMatch.currentPlayerId === playerId ? 'Your turn' : `${multiplayerMatch.names[multiplayerMatch.currentPlayerId] || 'Opponent'}'s turn`} - {lineTimeLeft}s left
            </p>
          )}
          {agentMessage && <p>{agentMessage}</p>}
          {agentActive && !isGameOver && <p>Agent is playing guess {guesses.length + 1} / 6</p>}
          {isGameOver && (
            <>
              <p>
                {isWin ? 'You win! 🎉' : `Game Over. Answer: ${solution.toUpperCase()}`}
              </p>
              <button onClick={playAgain} className="play-again-btn">
                Play Again (Space)
              </button>
            </>
          )}
          {multiplayerMatch?.status === 'ended' && (
            <p>
              {multiplayerMatch.winnerId === playerId ? 'You won! 🎉' : `Match Over. Answer: ${multiplayerMatch.solution.toUpperCase()}`}
            </p>
          )}
        </div>

        <Keyboard onInput={onInput} onEnter={onEnter} onDelete={onDelete} guesses={multiplayerMatch?.guesses ?? guesses} />

        <section className="statistics">
          <h2>Stats</h2>
          <p>Wins: {stats.wins}</p>
          <p>Losses: {stats.losses}</p>
          <p>Win rate: {stats.winRate}%</p>
          <p>Current streak: {stats.currentStreak}</p>
          <p>Max streak: {stats.maxStreak}</p>
          <p>Average guesses: {stats.avgGuesses}</p>
        </section>
      </main>
    </div>
  );
}
