import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import wordList from '../data/words.json';
import difficultWords from '../data/words-difficult.json';
import { getDailySolution, getRandomSolution, evaluateGuess, isValidWord } from '../utils/wordUtils';
import { sendEvent } from '../utils/analytics';

const GameContext = createContext(null);
const WORD_LENGTH = 5;
const MAX_TURNS = 6;

const difficultWordsSet = new Set(difficultWords.map((word) => word.toLowerCase()));
const easyWords = wordList.filter((word) => !difficultWordsSet.has(word.toLowerCase()));

function readStats() {
  try {
    const raw = localStorage.getItem('wordle-clone-stats');
    if (!raw) return { wins: 0, losses: 0, currentStreak: 0, maxStreak: 0, totalGuesses: 0, gamesPlayed: 0 };
    return JSON.parse(raw);
  } catch (error) {
    return { wins: 0, losses: 0, currentStreak: 0, maxStreak: 0, totalGuesses: 0, gamesPlayed: 0 };
  }
}

function writeStats(stats) {
  localStorage.setItem('wordle-clone-stats', JSON.stringify(stats));
}

export function GameProvider({ children }) {
  const [mode, setMode] = useState('unlimited');
  const [solution, setSolution] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [turn, setTurn] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWin, setIsWin] = useState(false);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState(readStats());
  const [difficulty, setDifficulty] = useState('easy');

  const activeWords = useMemo(
    () => (difficulty === 'hard' ? difficultWords : easyWords),
    [difficulty]
  );

  const combinedWordSet = useMemo(
    () => new Set([...wordList, ...difficultWords].map((word) => word.toLowerCase())),
    []
  );

  const wordSet = combinedWordSet;

  const resetGame = (newMode, newDifficulty = difficulty) => {
    const words = newDifficulty === 'hard' ? difficultWords : easyWords;
    const chosen = newMode === 'daily' ? getDailySolution(words) : getRandomSolution(words);
    setMode(newMode);
    setDifficulty(newDifficulty);
    setSolution(chosen);
    setGuesses([]);
    setCurrentGuess('');
    setTurn(0);
    setIsGameOver(false);
    setIsWin(false);
    setMessage('');
    // Analytics: record a new game start (no PII)
    sendEvent('game_start', { mode: newMode, difficulty: newDifficulty });
  };

  useEffect(() => {
    resetGame(mode);
  }, []);

  const updateStats = (win, guessCount) => {
    const next = { ...stats };
    next.gamesPlayed += 1;
    if (win) {
      next.wins += 1;
      next.currentStreak += 1;
      next.maxStreak = Math.max(next.maxStreak, next.currentStreak);
      next.totalGuesses += guessCount;
    } else {
      next.losses += 1;
      next.currentStreak = 0;
    }
    writeStats(next);
    setStats(next);
  };

  const onModeChange = (newMode) => {
    if (newMode === mode) return;
    resetGame(newMode);
  };


  const onDifficultyChange = (newDifficulty) => {
    if (newDifficulty === difficulty) return;
    resetGame(mode, newDifficulty);
    // Analytics: record difficulty change
    sendEvent('change_difficulty', { difficulty: newDifficulty, mode });
  };

  const playAgain = () => {
    resetGame(mode, difficulty);
  };

  const onInput = (letter) => {
    if (isGameOver) return;
    if (currentGuess.length >= WORD_LENGTH) return;
    setCurrentGuess((prev) => (prev + letter).slice(0, WORD_LENGTH));
  };

  const onDelete = () => {
    if (isGameOver) return;
    setCurrentGuess((prev) => prev.slice(0, -1));
  };

  const onEnter = () => {
    if (isGameOver) return;
    if (currentGuess.length !== WORD_LENGTH) {
      setMessage('Enter a 5-letter word.');
      return;
    }

    const inputWord = currentGuess.toLowerCase();

    if (!isValidWord(inputWord, wordSet)) {
      setMessage('Not in word list.');
      return;
    }

    const evaluation = evaluateGuess(inputWord, solution);
    const nextGuess = { guess: inputWord, evaluation };
    const nextGuesses = [...guesses, nextGuess];

    setGuesses(nextGuesses);
    setCurrentGuess('');
    setTurn((prev) => prev + 1);
    setMessage('');

    if (inputWord === solution) {
      setIsGameOver(true);
      setIsWin(true);
      updateStats(true, nextGuesses.length);
      setMessage('Congratulations!');
      // Analytics: game finished - win
      sendEvent('game_end', { result: 'win', guesses: nextGuesses.length, difficulty, mode });
      return;
    }

    if (nextGuesses.length >= MAX_TURNS) {
      setIsGameOver(true);
      setIsWin(false);
      updateStats(false, MAX_TURNS);
      setMessage('Game over, good effort.');
      // Analytics: game finished - loss
      sendEvent('game_end', { result: 'loss', guesses: MAX_TURNS, difficulty, mode });
    }
  };

  const derivedStats = useMemo(() => {
    const winRate = stats.gamesPlayed ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
    const avgGuesses = stats.wins ? (stats.totalGuesses / stats.wins).toFixed(2) : 0;
    return { ...stats, winRate, avgGuesses };
  }, [stats]);

  return (
    <GameContext.Provider
      value={{
        mode,
        difficulty,
        solution,
        guesses,
        currentGuess,
        turn,
        isGameOver,
        isWin,
        message,
        stats: derivedStats,
        onInput,
        onEnter,
        onDelete,
        onModeChange,
        onDifficultyChange,
        playAgain
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
};
