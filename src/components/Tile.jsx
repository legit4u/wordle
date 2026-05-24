import React from 'react';

export default function Tile({ letter = '', status = '' }) {
  const classes = ['tile'];
  if (status === 'correct') classes.push('tile-correct');
  if (status === 'present') classes.push('tile-present');
  if (status === 'absent') classes.push('tile-absent');
  if (!status && letter) classes.push('tile-filled');

  return <div className={classes.join(' ')}>{letter.toUpperCase()}</div>;
}
