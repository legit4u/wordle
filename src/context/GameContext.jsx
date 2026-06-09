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
  const [agentActive, setAgentActive] = useState(false);
  const [agentTargetGuess, setAgentTargetGuess] = useState('');
  const [agentMessage, setAgentMessage] = useState('');
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
  const AGENT_LETTER_DELAY_MS = 250;
  const AGENT_LINE_PAUSE_MS = 1000;

  const guessedWords = useMemo(
    () => new Set(guesses.map((entry) => entry.guess.toLowerCase())),
    [guesses]
  );

  const possibleSolutions = useMemo(() => {
    let candidates = activeWords.map((word) => word.toLowerCase());

    candidates = candidates.filter((candidate) => !guessedWords.has(candidate));

    return guesses.reduce((filtered, entry) => {
      return filtered.filter((candidate) => {
        const evalResult = evaluateGuess(entry.guess, candidate);
        return evalResult.every((status, idx) => status === entry.evaluation[idx]);
      });
    }, candidates);
  }, [guesses, activeWords, guessedWords]);

  const getAgentGuess = () => {
    const firstGuess = 'raise';
    if (guesses.length === 0 && wordSet.has(firstGuess)) {
      return firstGuess;
    }
    return possibleSolutions[0] || activeWords[0].toLowerCase();
  };

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
    setAgentTargetGuess('');
    setAgentMessage('');
    setAgentActive(false);
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

  const submitGuess = (guessWord, { fromAgent = false } = {}) => {
    if (isGameOver) return;

    const inputWord = guessWord.toLowerCase();

    if (!isValidWord(inputWord, wordSet)) {
      if (!fromAgent) setMessage('Not in word list.');
      return;
    }

    const evaluation = evaluateGuess(inputWord, solution);
    const nextGuess = { guess: inputWord, evaluation };
    const nextGuesses = [...guesses, nextGuess];

    setGuesses(nextGuesses);
    setCurrentGuess('');
    setTurn((prev) => prev + 1);
    setMessage(fromAgent ? `Agent guessed ${inputWord.toUpperCase()}` : '');

    if (inputWord === solution) {
      setIsGameOver(true);
      setIsWin(true);
      setAgentActive(false);
      setAgentMessage('Agent finished the game.');
      updateStats(true, nextGuesses.length);
      setMessage('Congratulations!');
      sendEvent('game_end', { result: 'win', guesses: nextGuesses.length, difficulty, mode });
      return;
    }

    if (nextGuesses.length >= MAX_TURNS) {
      setIsGameOver(true);
      setIsWin(false);
      setAgentActive(false);
      setAgentMessage('Agent finished the game.');
      updateStats(false, MAX_TURNS);
      setMessage('Game over, good effort.');
      sendEvent('game_end', { result: 'loss', guesses: MAX_TURNS, difficulty, mode });
    }
  };

  const onInput = (letter) => {
    if (isGameOver || agentActive) return;
    if (currentGuess.length >= WORD_LENGTH) return;
    setCurrentGuess((prev) => (prev + letter).slice(0, WORD_LENGTH));
  };

  const onDelete = () => {
    if (isGameOver || agentActive) return;
    setCurrentGuess((prev) => prev.slice(0, -1));
  };

  const onEnter = () => {
    if (isGameOver || agentActive) return;
    if (currentGuess.length !== WORD_LENGTH) {
      setMessage('Enter a 5-letter word.');
      return;
    }

    submitGuess(currentGuess);
  };

  const requestAgentLine = () => {
    if (isGameOver || agentActive) return;
    const nextGuess = getAgentGuess();
    setAgentTargetGuess(nextGuess);
    setAgentActive(true);
    setCurrentGuess('');
    setAgentMessage(`Computer Ji is thinking about ${nextGuess.toUpperCase()}`);
  };

  useEffect(() => {
    if (!agentActive || isGameOver) return undefined;
    if (!agentTargetGuess) {
      setAgentActive(false);
      setAgentMessage('');
      return undefined;
    }

    if (currentGuess.length < agentTargetGuess.length) {
      const timer = setTimeout(() => {
        const nextText = agentTargetGuess.slice(0, currentGuess.length + 1);
        setCurrentGuess(nextText);
        setAgentMessage(`Computer Ji is typing: ${nextText.toUpperCase()}`);
      }, AGENT_LETTER_DELAY_MS);

      return () => clearTimeout(timer);
    }

    if (currentGuess.length === WORD_LENGTH) {
      const timer = setTimeout(() => {
        submitGuess(currentGuess, { fromAgent: true });
        setAgentTargetGuess('');
        setAgentActive(false);
        setAgentMessage('Computer Ji completed the line. Click again for the next one.');
      }, AGENT_LINE_PAUSE_MS);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [agentActive, isGameOver, currentGuess, agentTargetGuess, submitGuess]);

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
        agentActive,
        agentMessage,
        message,
        stats: derivedStats,
        onInput,
        onEnter,
        onDelete,
        onModeChange,
        onDifficultyChange,
        playAgain,
        requestAgentLine
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
