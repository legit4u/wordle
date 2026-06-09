# Wordle Clone Application

## 🎯 Overview
This project is a clone of the popular word puzzle game **Wordle**.  
Players attempt to guess a hidden word within a limited number of tries, receiving feedback on each guess to guide them toward the solution.

---

## ✨ Features
- **Daily Puzzle Mode**: A new word every day for all players.
- **Unlimited Mode**: Play as many rounds as you want.
- **Color Feedback**:
  - 🟩 Green: Correct letter in the correct position
  - 🟨 Yellow: Correct letter in the wrong position
  - ⬜ Gray: Letter not in the word
- **Keyboard Input**: On-screen and physical keyboard support.
- **Statistics Dashboard**: Track win streaks, average guesses, and success rate.
- **Responsive Design**: Works seamlessly on desktop and mobile.

---

## 🛠️ Tech Stack
- **Frontend**: React (with hooks and context for state management)
- **Styling**: Tailwind CSS / CSS Modules
- **Backend (optional)**: Node.js + Express (for daily word distribution)
- **Word List**: Predefined dictionary JSON file (downloaded from https://gist.github.com/shmookey/b28e342e1b1756c4700f42f17102c2ff, then separated into two files words.json and words-difficult.json for easy and hard modes)
- **Deployment**: Vercel / Netlify

---

## 📂 Project Structure
wordle-app/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Board.jsx
│   │   ├── Keyboard.jsx
│   │   └── Tile.jsx
│   ├── context/
│   │   └── GameContext.jsx
│   ├── utils/
│   │   └── wordUtils.js
│   ├── App.jsx
│   └── index.js
├── package.json
└── README.md
└── WORDLE.md

---

## Analytics and Ads
Added GA4 analytics and AdSense - yet to test.

## Installation and running
Hosted in 3 ways:
1. npm run dev - runs in [localhost:](http://localhost:5173/)
2. Host in github pages:
  npm install --save-dev gh-pages (first time only)
  npm run build (creates the dist folder)
  npx gh-pages -d dist 
  Load from here: https://legit4u.github.io/wordle/
  (had to add . before the paths referencing the js files, in index.html before pushing)
3. Netlify!
Just deploy from there.


