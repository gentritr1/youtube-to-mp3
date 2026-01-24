# YT Converter | YouTube to MP3/MP4

A clean, modern, and minimal YouTube media converter built with Node.js and Vanilla JavaScript. Features a sleek "Zen" atmosphere and a built-in game to keep you entertained during conversions.

## 🚀 Key Features

- **Zen Atmosphere**: Ambient pulsing background gradients (Emerald & Violet), subtle noise textures, and fluid fade-in animations for a premium user experience.
- **Optimized Workflow**: Real-time conversion feedback (Progress Bar) and instant download notifications prioritized above the game for zero friction.
- **Snake Game (Enhanced Edition)**: A modular, feature-rich snake game with:
  - **Dynamic Power-ups**: Golden (3x growth), Speed, Ghost (no collision), and Split.
  - **Snake Splitting**: Ability to cut your snake in half and switch between them with `X`.
  - **Combo System**: Stack points by eating food in quick succession.
  - **Responsive Stats**: Flex-wrapping indicators that adapt to any screen size.
- **Dark Mode**: Sleek dark aesthetic with Shadcn-inspired design tokens.
- **Dual Formats**: High-quality MP3 (Audio) or MP4 (Video).

## 🛠 Prerequisites

Ensure you have the following installed on your system:

### 1. Node.js
Required to run the Express backend.

### 2. yt-dlp & ffmpeg
The core engine for media extraction and conversion.
```bash
brew install yt-dlp ffmpeg
```

## 📦 Installation & Setup

1. **Clone & Navigate**:
   ```bash
   cd ~/Desktop/youtube-to-mp3
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Application**:
   ```bash
   npm start
   ```
   Visit [http://localhost:3000](http://localhost:3000)

## 🏗 Architecture & Technical Details

The application is built with a focus on modularity and stability:

### Frontend
- **Vanilla JS & ES6+**: High performance with zero heavy framework overhead.
- **Modular Game Engine**: The Snake Game is self-contained in `js/snake-game.js`, exposing a clean API for the main `app.js` to control.
- **Polling System**: Uses an asynchronous task-based polling architecture to track conversion progress without refreshing or moving the layout.
- **Layout Stability**: Status cards (Preview, Progress, Download) use a fixed-height card system to ensure the Game container doesn't "jump" during conversion state changes.

### Backend (Express & Node.js)
- **Task Queue**: Each conversion is assigned a unique `taskId`.
- **Progress Tracking**: Standard output from `yt-dlp` is parsed to provide accurate percentage-based progress to the frontend via `/api/progress/:taskId`.
- **Automatic Cleanup**: Temporary files are managed to keep the server lightweight.

## 📁 File Structure

- `/server.js`: Express server with API endpoints for info, conversion, and progress.
- `/index.html`: Optimized semantic layout with prioritized download area.
- `/app.js`: Service layer handling API calls, clipboard access, and game lifecycle.
- `/style.css`: Core design system, "Zen" background animations, and UI transitions.
- `/game.css`: Specialized styles for the canvas and game HUD components.
- `/js/snake-game.js`: Encapsulated Snake Game logic (Classes for Snake, Food, Particles).

## 📄 License
MIT
