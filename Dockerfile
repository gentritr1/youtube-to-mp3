FROM node:18-alpine

# Install system dependencies (Python for yt-dlp, FFmpeg for conversion)
RUN apk add --no-cache python3 py3-pip ffmpeg curl

# Install yt-dlp binary directly
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Create downloads directory (consistent with config.js defaulting to HOME/Downloads)
RUN mkdir -p /root/Downloads

# Expose port
ENV PORT=3000
EXPOSE 3000

# Start server
CMD ["node", "server/index.js"]
