import React from 'react';
import Tile from './Tile';

const WORD_LENGTH = 5;
const MAX_TURNS = 6;

export default function Board({ guesses, currentGuess, turn }) {
  const rows = Array.from({ length: MAX_TURNS }).map((_, rowIndex) => {
    let cells;

    if (rowIndex < guesses.length) {
      const { guess, evaluation } = guesses[rowIndex];
      cells = Array.from({ length: WORD_LENGTH }).map((__, idx) => (
        <Tile key={`${rowIndex}-${idx}`} letter={guess[idx]} status={evaluation[idx]} />
      ));
    } else if (rowIndex === guesses.length) {
      cells = Array.from({ length: WORD_LENGTH }).map((__, idx) => (
        <Tile key={`${rowIndex}-${idx}`} letter={currentGuess[idx] || ''} status={currentGuess[idx] ? 'pending' : ''} />
      ));
    } else {
      cells = Array.from({ length: WORD_LENGTH }).map((__, idx) => <Tile key={`${rowIndex}-${idx}`} />);
    }

    return (
      <div key={`row-${rowIndex}`} className="board-row">
        {cells}
      </div>
    );
  });

  return <div className="board">{rows}</div>;
}
