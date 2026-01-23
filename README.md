# YouTube to MP3/MP4 Converter

A clean, modern, and minimal YouTube media converter built with Node.js and Vanilla JavaScript. Download your favorite YouTube videos as high-quality MP3 or MP4 files directly from your browser.

## 🚀 Features

- **Modern UI**: Sleek, responsive design inspired by Shadcn UI.
- **Fast Conversion**: High-performance downloading and conversion.
- **Multiple Formats**: Support for both MP3 (Audio) and MP4 (Video).
- **Dark Mode**: Beautiful dark aesthetic with glassmorphism effects.

## 🛠 Prerequisites

Before running this application, you need to have the following installed on your system:

### 1. Node.js
Make sure you have Node.js installed to run the server.

### 2. yt-dlp
The core engine for downloading YouTube media.
```bash
brew install yt-dlp
```

### 3. ffmpeg
Required for converting and merging audio/video streams.
```bash
brew install ffmpeg
```

## 📦 Installation

1. **Navigate to the project directory**:
   ```bash
   cd ~/Desktop/youtube-to-mp3
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

## 🏁 How to Run

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Open the App**:
   Visit [http://localhost:3000](http://localhost:3000) in your web browser.

## 📁 Project Structure

- `server.js`: Node.js Express server handling the download logic.
- `index.html`: The frontend structure.
- `app.js`: Frontend logic and API interaction.
- `style.css`: Modern styling and animations.
- `downloads/`: Directory where temporary files are processed.

## 📄 License
MIT
