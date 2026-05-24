import React from 'react';

const keys = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm']
];

export default function Keyboard({ onInput, onEnter, onDelete, guesses, solution }) {
  const evaluateKey = (key) => {
    if (!guesses.length) return '';
    const states = guesses
      .map((entry) => {
        const idx = entry.guess.indexOf(key);
        if (idx === -1) return null;
        return entry.evaluation[idx];
      })
      .filter(Boolean);

    if (!states.length) return '';
    if (states.includes('correct')) return 'key-correct';
    if (states.includes('present')) return 'key-present';
    return 'key-absent';
  };

  return (
    <div className="keyboard">
      {keys.map((row, rowIndex) => (
        <div key={rowIndex} className="keyboard-row">
          {rowIndex === 2 && (
            <button type="button" className="key key-large" onClick={onEnter}>
              Enter
            </button>
          )}
          {row.map((key) => (
            <button
              key={key}
              type="button"
              className={["key", evaluateKey(key)].filter(Boolean).join(' ')}
              onClick={() => onInput(key)}
            >
              {key.toUpperCase()}
            </button>
          ))}
          {rowIndex === 2 && (
            <button type="button" className="key key-large" onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
