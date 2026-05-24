# Wordal

A small Wordle-style React app built with Vite.

## Quick Start

1. Install dependencies

```bash
cd "c:\Users\mahes\code\wordle\wordle-app"
npm install
```

2. Run the dev server

```bash
npm run dev
# open http://localhost:5173/
```

## Game features

- Daily and Unlimited modes.
- Difficulty selector: `Easy` (main word list) and `Hard` (uncommon words).
- Validation accepts words from both `src/data/words.json` and `src/data/words-difficult.json`.

## Files of interest

- `src/data/words.json` — main word list
- `src/data/words-difficult.json` — difficult/uncommon words used for hard mode
- `src/context/GameContext.jsx` — game logic and difficulty handling

## Git

A `.gitignore` is included; keep `node_modules/` and build outputs out of the repo.

## Contributing

Feel free to add/remove words from the data files. Run the dev server locally to test changes.

## License

Use as you like — add a license if you plan to publish publicly.
