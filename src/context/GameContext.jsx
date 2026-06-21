import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
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
  const [playerId] = useState(() => `p-${Math.random().toString(36).slice(2, 10)}`);
  const [playerName, setPlayerNameState] = useState(() => {
    try {
      const saved = localStorage.getItem('wordle-player-name');
      return saved || `Player-${Math.random().toString(36).slice(2, 6)}`;
    } catch {
      return `Player-${Math.random().toString(36).slice(2, 6)}`;
    }
  });
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [outgoingRequest, setOutgoingRequest] = useState(null);
  const [multiplayerMatch, setMultiplayerMatch] = useState(null);
  const [lineTimeLeft, setLineTimeLeft] = useState(30);
  const [multiplayerMessage, setMultiplayerMessage] = useState('');
  const [multiplayerStatus, setMultiplayerStatus] = useState('idle');

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
  const PRESENCE_TTL = 15000;
  const PRESENCE_UPDATE_MS = 5000;
  const LINE_TIME_SECONDS = 30;

  const presenceKey = `wordal-player-${playerId}`;
  const matchRequestKeyFor = (targetId) => `wordal-match-request-${targetId}`;
  const matchResponseKeyFor = (requestId) => `wordal-match-response-${requestId}`;
  const matchStateKey = (matchId) => `wordal-match-${matchId}`;

  const computeTimeLeft = (session) => {
    if (!session || session.status !== 'active' || !session.lineTimerStart) return LINE_TIME_SECONDS;
    const elapsed = Math.floor((Date.now() - session.lineTimerStart) / 1000);
    return Math.max(0, LINE_TIME_SECONDS - elapsed);
  };

  const updatePresence = () => {
    try {
      localStorage.setItem(presenceKey, JSON.stringify({ id: playerId, name: playerName, lastSeen: Date.now() }));
    } catch {
      // ignore storage errors
    }
  };

  const readOnlinePlayers = () => {
    const now = Date.now();
    const players = [];

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('wordal-player-')) continue;
      const raw = localStorage.getItem(key);
      try {
        const info = raw ? JSON.parse(raw) : null;
        if (!info || !info.id || info.id === playerId) continue;
        if (now - info.lastSeen > PRESENCE_TTL) continue;
        players.push(info);
      } catch {
        continue;
      }
    }

    setOnlinePlayers(players);
  };

  const clearOldPresence = () => {
    const now = Date.now();
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('wordal-player-')) continue;
      const raw = localStorage.getItem(key);
      try {
        const info = raw ? JSON.parse(raw) : null;
        if (!info || !info.lastSeen || now - info.lastSeen <= PRESENCE_TTL) continue;
        localStorage.removeItem(key);
      } catch {
        continue;
      }
    }
  };

  useEffect(() => {
    updatePresence();
    readOnlinePlayers();
    const presenceInterval = setInterval(() => {
      updatePresence();
      clearOldPresence();
      readOnlinePlayers();
    }, PRESENCE_UPDATE_MS);

    return () => {
      clearInterval(presenceInterval);
      try {
        localStorage.removeItem(presenceKey);
      } catch {
        // ignore
      }
    };
  }, [playerId, playerName]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (!event.key) return;

      if (event.key.startsWith('wordal-player-')) {
        readOnlinePlayers();
      }

      if (event.key === matchRequestKeyFor(playerId)) {
        if (event.newValue) {
          try {
            const request = JSON.parse(event.newValue);
            setIncomingRequest(request);
            setMultiplayerStatus('requestReceived');
            setMultiplayerMessage(`${request.originName} wants to play a multiplayer match.`);
          } catch {
            setIncomingRequest(null);
          }
        } else {
          setIncomingRequest(null);
          if (multiplayerStatus === 'requestReceived') {
            setMultiplayerStatus('idle');
            setMultiplayerMessage('The multiplayer request was canceled.');
          }
        }
      }

      if (outgoingRequest && event.key === matchResponseKeyFor(outgoingRequest.requestId)) {
        if (!event.newValue) return;
        try {
          const response = JSON.parse(event.newValue);
          if (!response.accepted) {
            setMultiplayerStatus('idle');
            setMultiplayerMessage(`${response.responderName} declined your multiplayer request.`);
            setOutgoingRequest(null);
            localStorage.removeItem(matchRequestKeyFor(response.originId));
            return;
          }
          const matchKey = matchStateKey(response.matchId);
          const rawSession = localStorage.getItem(matchKey);
          if (rawSession) {
            const session = JSON.parse(rawSession);
            setMultiplayerMatch(session);
            setMultiplayerStatus('active');
            setMultiplayerMessage('Multiplayer match started!');
          }
        } catch {
          // ignore malformed response
        }
      }

      if (event.key.startsWith('wordal-match-')) {
        if (!event.newValue) return;
        try {
          const session = JSON.parse(event.newValue);
          if (session.players?.includes(playerId)) {
            setMultiplayerMatch(session);
            if (session.status === 'active') {
              setMultiplayerStatus('active');
            } else {
              setMultiplayerStatus('idle');
            }
          }
        } catch {
          // ignore invalid session updates
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [playerId, outgoingRequest, multiplayerStatus]);

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
    setIncomingRequest(null);
    setOutgoingRequest(null);
    setMultiplayerMatch(null);
    setLineTimeLeft(LINE_TIME_SECONDS);
    setMultiplayerMessage('');
    setMultiplayerStatus('idle');
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

  const setPlayerName = (name) => {
    const trimmedName = name.trim();
    if (trimmedName) {
      setPlayerNameState(trimmedName);
      try {
        localStorage.setItem('wordle-player-name', trimmedName);
      } catch {
        // ignore storage errors
      }
    }
  };

  const writeMatchSession = (session) => {
    try {
      localStorage.setItem(matchStateKey(session.matchId), JSON.stringify(session));
    } catch {
      // ignore storage errors
    }
  };

  const submitGuess = useCallback((guessWord, { fromAgent = false } = {}) => {
    if (isGameOver) return;

    const inputWord = guessWord.toLowerCase();

    if (!isValidWord(inputWord, wordSet)) {
      if (!fromAgent) setMessage('Not in word list.');
      return;
    }

    if (multiplayerMatch && multiplayerMatch.status === 'active') {
      if (multiplayerMatch.currentPlayerId !== playerId) {
        setMessage('Wait for your turn.');
        return;
      }

      const evaluation = evaluateGuess(inputWord, multiplayerMatch.solution);
      const nextGuess = { guess: inputWord, evaluation, playerId };
      const nextGuesses = [...multiplayerMatch.guesses, nextGuess];
      const nextPlayerId = multiplayerMatch.players.find((id) => id !== playerId);

      const nextSession = {
        ...multiplayerMatch,
        guesses: nextGuesses,
        currentPlayerId: nextPlayerId,
        lastUpdated: Date.now(),
        lineTimerStart: Date.now(),
      };

      if (inputWord === multiplayerMatch.solution) {
        nextSession.status = 'ended';
        nextSession.winnerId = playerId;
      } else if (nextGuesses.length >= MAX_TURNS) {
        nextSession.status = 'ended';
        nextSession.winnerId = null;
      }

      writeMatchSession(nextSession);
      setMultiplayerMatch(nextSession);
      setLineTimeLeft(LINE_TIME_SECONDS);
      setCurrentGuess('');
      setMessage('');
      setMultiplayerMessage(nextSession.status === 'ended' ? 'Match complete.' : '');
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
  }, [isGameOver, wordSet, multiplayerMatch, playerId, solution, guesses, difficulty, mode]);

  const onInput = (letter) => {
    if (isGameOver || agentActive) return;
    if (multiplayerMatch && multiplayerMatch.status === 'active' && multiplayerMatch.currentPlayerId !== playerId) return;
    if (currentGuess.length >= WORD_LENGTH) return;
    setCurrentGuess((prev) => (prev + letter).slice(0, WORD_LENGTH));
  };

  const onDelete = () => {
    if (isGameOver || agentActive) return;
    if (multiplayerMatch && multiplayerMatch.status === 'active' && multiplayerMatch.currentPlayerId !== playerId) return;
    setCurrentGuess((prev) => prev.slice(0, -1));
  };

  const onEnter = () => {
    if (isGameOver || agentActive) return;
    if (multiplayerMatch && multiplayerMatch.status === 'active' && multiplayerMatch.currentPlayerId !== playerId) {
      setMessage('Wait for your turn.');
      return;
    }
    if (currentGuess.length !== WORD_LENGTH) {
      setMessage('Enter a 5-letter word.');
      return;
    }

    submitGuess(currentGuess);
  };

  const sendMultiplayerRequest = (customName) => {
    if (multiplayerMatch && multiplayerMatch.status === 'active') {
      setMultiplayerMessage('A multiplayer match is already in progress.');
      return;
    }

    const others = onlinePlayers.filter((player) => player.id !== playerId);
    if (!others.length) {
      setMultiplayerMessage('No other players are currently online.');
      return;
    }

    const nameToUse = customName || playerName;
    const randomPlayer = others[Math.floor(Math.random() * others.length)];
    const requestId = `req-${Math.random().toString(36).slice(2, 10)}`;
    const request = {
      requestId,
      originId: playerId,
      originName: nameToUse,
      targetId: randomPlayer.id,
      targetName: randomPlayer.name,
      timestamp: Date.now(),
      mode,
      difficulty,
      solution,
    };

    try {
      localStorage.setItem(matchRequestKeyFor(randomPlayer.id), JSON.stringify(request));
      setOutgoingRequest(request);
      setMultiplayerStatus('waiting');
      setMultiplayerMessage(`Multiplayer request sent to ${randomPlayer.name}. Waiting for acceptance...`);
      // Clear previous game state
      setMessage('');
      setAgentMessage('');
      setAgentActive(false);
      setAgentTargetGuess('');
      setIsGameOver(false);
      setIsWin(false);
    } catch {
      setMultiplayerMessage('Unable to send multiplayer request.');
    }
  };

  const acceptMultiplayerRequest = () => {
    if (!incomingRequest) return;

    const matchId = `match-${Math.random().toString(36).slice(2, 10)}`;
    const session = {
      matchId,
      players: [incomingRequest.originId, playerId],
      names: {
        [incomingRequest.originId]: incomingRequest.originName,
        [playerId]: playerName,
      },
      currentPlayerId: incomingRequest.originId,
      status: 'active',
      guesses: [],
      solution: incomingRequest.solution,
      lastUpdated: Date.now(),
      lineTimerStart: Date.now(),
      winnerId: null,
    };

    writeMatchSession(session);
    setMultiplayerMatch(session);
    setLineTimeLeft(LINE_TIME_SECONDS);
    setMultiplayerStatus('active');
    setMultiplayerMessage('Multiplayer match started! Waiting for your opponent.');
    setIncomingRequest(null);
    // Clear previous game state
    setMessage('');
    setAgentMessage('');
    setAgentActive(false);
    setAgentTargetGuess('');
    setIsGameOver(false);
    setIsWin(false);

    try {
      localStorage.setItem(
        matchResponseKeyFor(incomingRequest.requestId),
        JSON.stringify({
          requestId: incomingRequest.requestId,
          accepted: true,
          matchId,
          responderId: playerId,
          responderName: playerName,
          originId: incomingRequest.originId,
        })
      );
      localStorage.removeItem(matchRequestKeyFor(playerId));
    } catch {
      setMultiplayerMessage('Failed to accept multiplayer request.');
    }
  };

  const declineMultiplayerRequest = () => {
    if (!incomingRequest) return;

    try {
      localStorage.setItem(
        matchResponseKeyFor(incomingRequest.requestId),
        JSON.stringify({
          requestId: incomingRequest.requestId,
          accepted: false,
          responderId: playerId,
          responderName: playerName,
          originId: incomingRequest.originId,
        })
      );
      localStorage.removeItem(matchRequestKeyFor(playerId));
    } catch {
      // ignore
    }

    setIncomingRequest(null);
    setMultiplayerStatus('idle');
    setMultiplayerMessage('Multiplayer request declined.');
  };

  const leaveMultiplayerMatch = () => {
    if (!multiplayerMatch) return;

    const otherPlayerId = multiplayerMatch.players.find((id) => id !== playerId);
    const nextSession = {
      ...multiplayerMatch,
      status: 'ended',
      winnerId: otherPlayerId,
      lastUpdated: Date.now(),
    };

    writeMatchSession(nextSession);
    setMultiplayerMatch(null);
    setMultiplayerStatus('idle');
    setMultiplayerMessage('You left the multiplayer match.');
  };

  const proposeRematch = () => {
    if (!multiplayerMatch || multiplayerMatch.status !== 'ended') return;
    const otherPlayerId = multiplayerMatch.players.find((id) => id !== playerId);
    if (!otherPlayerId) return;

    const matchId = `match-${Math.random().toString(36).slice(2, 10)}`;
    const nextSolution = getRandomSolution(activeWords);
    const session = {
      matchId,
      players: [playerId, otherPlayerId],
      names: multiplayerMatch.names,
      currentPlayerId: otherPlayerId,
      status: 'active',
      guesses: [],
      solution: nextSolution,
      lastUpdated: Date.now(),
      lineTimerStart: Date.now(),
      winnerId: null,
    };

    writeMatchSession(session);
    setMultiplayerMatch(session);
    setLineTimeLeft(LINE_TIME_SECONDS);
    setMultiplayerStatus('active');
    setMultiplayerMessage('Rematch started!');
    // Clear previous game state
    setMessage('');
    setAgentMessage('');
    setAgentActive(false);
    setAgentTargetGuess('');
    setIsGameOver(false);
    setIsWin(false);
  };

  const exitMultiplayerMode = () => {
    setMultiplayerMatch(null);
    setMultiplayerStatus('idle');
    setIncomingRequest(null);
    setOutgoingRequest(null);
    setMultiplayerMessage('Exited multiplayer mode.');
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
    if (!multiplayerMatch || multiplayerMatch.status !== 'active') return undefined;

    const nextTimeLeft = computeTimeLeft(multiplayerMatch);
    setLineTimeLeft(nextTimeLeft);

    if (nextTimeLeft <= 0) {
      const nextPlayerId = multiplayerMatch.players.find((id) => id !== multiplayerMatch.currentPlayerId);
      if (nextPlayerId) {
        const updatedSession = {
          ...multiplayerMatch,
          currentPlayerId: nextPlayerId,
          lastUpdated: Date.now(),
          lineTimerStart: Date.now(),
        };
        writeMatchSession(updatedSession);
        setMultiplayerMatch(updatedSession);
        setMultiplayerMessage('Time expired.');
      }
      return undefined;
    }

    const timer = setInterval(() => {
      const updatedLeft = computeTimeLeft(multiplayerMatch);
      setLineTimeLeft(updatedLeft);
      if (updatedLeft <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [multiplayerMatch]);

  useEffect(() => {
    if (!multiplayerMatch) return undefined;
    if (multiplayerMatch.status === 'ended') {
      setMultiplayerMessage('Match complete.');
    }
    return undefined;
  }, [multiplayerMatch?.status]);

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
        playerId,
        playerName,
        onlinePlayers,
        incomingRequest,
        outgoingRequest,
        multiplayerMatch,
        lineTimeLeft,
        multiplayerMessage,
        multiplayerStatus,
        message,
        stats: derivedStats,
        onInput,
        onEnter,
        onDelete,
        onModeChange,
        onDifficultyChange,
        playAgain,
        sendMultiplayerRequest,
        acceptMultiplayerRequest,
        declineMultiplayerRequest,
        leaveMultiplayerMatch,
        proposeRematch,
        exitMultiplayerMode,
        requestAgentLine,
        agentActive,
        agentMessage,
        setPlayerName,
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
