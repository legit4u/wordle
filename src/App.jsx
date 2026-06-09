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
    agentActive,
    agentMessage,
    requestAgentLine
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
          <button onClick={() => onModeChange('daily')} disabled={mode === 'daily' || agentActive}>
            Daily
          </button>
          <button onClick={() => onModeChange('unlimited')} disabled={mode === 'unlimited' || agentActive}>
            Unlimited
          </button>
          <button type="button" onClick={requestAgentLine} disabled={agentActive || isGameOver}>
            Computer Ji
          </button>
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
        <Board guesses={guesses} currentGuess={currentGuess} turn={turn} />
        <div className="status">
          {message && <p>{message}</p>}
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
        </div>

        <Keyboard onInput={onInput} onEnter={onEnter} onDelete={onDelete} guesses={guesses} />

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
