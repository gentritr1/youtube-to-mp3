FROM node:18-alpine

# Install system dependencies (Python for yt-dlp, FFmpeg for conversion)
RUN apk add --no-cache python3 py3-pip ffmpeg curl build-base

# Install yt-dlp via pip for easy updates
RUN pip3 install --break-system-packages yt-dlp

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Create downloads directory
RUN mkdir -p /app/downloads && chmod 777 /app/downloads

# Expose port
ENV PORT=3000
EXPOSE 3000

# Update yt-dlp and start server
CMD yt-dlp -U && node dist/index.js
