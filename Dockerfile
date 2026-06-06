FROM node:22-alpine

# Install system dependencies (Python for yt-dlp, FFmpeg for conversion)
RUN apk add --no-cache python3 py3-pip ffmpeg curl build-base

# Install yt-dlp via pip for easy updates
RUN pip3 install --break-system-packages --root-user-action=ignore yt-dlp

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

# Start server. Update yt-dlp during image builds, not at container startup, so
# runtime behavior does not change because of network/PyPI state.
CMD ["node", "dist/index.js"]
