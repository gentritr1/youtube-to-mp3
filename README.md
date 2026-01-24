# YT Converter | YouTube to MP3/MP4

A clean, modern, and minimal YouTube media converter built with Node.js and Vanilla JavaScript. Features a sleek "Zen" atmosphere and a built-in game to keep you entertained during conversions.

## 🚀 Key Features

- **Zen Atmosphere**: Ambient pulsing background gradients (Emerald & Violet), subtle noise textures, and fluid fade-in animations for a premium user experience.
- **Optimized Workflow**: Real-time conversion feedback (Progress Bar) and instant download notifications prioritized above the game for zero friction.
- **Mobile Support**: Fully responsive design with touch controls for the game (Swipe to move, Double-tap to switch).
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

The application is built with a focus on **modularity**, **high cohesion**, and **low coupling**:

### Backend (Express & Node.js)
```
/server
├── index.js              # Entry point: Express app setup
├── config.js             # Centralized constants (paths, timeouts)
├── routes/
│   ├── index.js          # Route aggregator
│   ├── info.js           # GET /api/info
│   ├── convert.js        # POST /api/convert (with idempotency)
│   ├── progress.js       # GET /api/progress/:taskId
│   └── download.js       # GET /api/download/:taskId/:filename
├── services/
│   ├── ytdlp.js          # yt-dlp wrapper (getVideoInfo, convertVideo)
│   └── taskManager.js    # Task CRUD, persistence, idempotency
├── utils/
│   ├── parseProgress.js  # Parse yt-dlp output
│   ├── sanitize.js       # Filename sanitization
│   └── formatDuration.js # Duration formatting
└── middleware/
    └── errorHandler.js   # Centralized error handling
```

### Frontend
- **Vanilla JS & ES6+**: High performance with zero heavy framework overhead.
- **Modular Game Engine**: The Snake Game is self-contained in `js/snake-game.js`.
- **Polling System**: Async task-based polling for progress without layout shifts.
- **Input Locking**: Prevents state conflicts during conversion (idempotency on UI).

### Key Features
- **Idempotency**: Same video + format = reuse existing task (no duplicate processing).
- **Persistence**: Tasks survive server restarts via `tasks.json`.
- **Testability**: Utilities and services are unit-testable in isolation.

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Watch mode for development:
```bash
npm run test:watch
```

## 📁 File Structure

- `/server/` - Modular backend (routes, services, utils, middleware)
- `/index.html` - Optimized semantic layout with prioritized download area
- `/app.js` - Frontend service layer handling API calls and game lifecycle
- `/style.css` - Core design system, "Zen" background animations
- `/game.css` - Snake game canvas and HUD styles
- `/js/snake-game.js` - Encapsulated Snake Game logic
- `/tests/` - Vitest unit tests

## 📄 License
MIT
