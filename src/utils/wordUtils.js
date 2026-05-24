export function getDailySolution(wordList) {
  const startDate = new Date('2022-01-01T00:00:00Z');
  const today = new Date();
  const deltaDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
  const idx = deltaDays % wordList.length;
  return wordList[idx];
}

export function getRandomSolution(wordList) {
  return wordList[Math.floor(Math.random() * wordList.length)];
}

export function evaluateGuess(guess, solution) {
  const result = Array.from({ length: solution.length }, () => 'absent');
  const solutionChars = solution.split('');

  // First pass for correct positions
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === solution[i]) {
      result[i] = 'correct';
      solutionChars[i] = null;
    }
  }

  // Second pass for present letters
  for (let i = 0; i < guess.length; i++) {
    if (result[i] === 'correct') continue;
    const index = solutionChars.indexOf(guess[i]);
    if (index !== -1) {
      result[i] = 'present';
      solutionChars[index] = null;
    }
  }

  return result;
}

export function keyColorFromResult({ key, guesses, solution }) {
  const status = { green: 'correct', yellow: 'present', gray: 'absent' };
  let best = 'absent';

  guesses.forEach((guess) => {
    const result = evaluateGuess(guess, solution);
    guess.split('').forEach((letter, index) => {
      if (letter !== key) return;
      if (result[index] === 'correct') {
        best = 'correct';
      } else if (result[index] === 'present' && best !== 'correct') {
        best = 'present';
      }
    });
  });

  return best;
}

export function isValidWord(word, wordSet) {
  return wordSet.has(word.toLowerCase());
}
