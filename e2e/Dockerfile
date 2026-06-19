# E2E Test Environment Dockerfile
# Runs Obsidian with CLI in a headless environment using Xvfb

FROM node:20-slim

# Install dependencies for Obsidian and Xvfb
RUN apt-get update && apt-get install -y \
    # Xvfb for virtual display
    xvfb \
    x11-utils \
    # Required for Electron/Obsidian
    libgtk-3-0 \
    libnotify-dev \
    libnss3 \
    libxss1 \
    libasound2 \
    libxtst6 \
    # Utilities
    wget \
    curl \
    jq \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Obsidian CLI (headless version)
RUN npm install -g obsidian-headless

# Create workspace
WORKDIR /workspace

# Copy test scripts
COPY scripts/ /workspace/scripts/
RUN chmod +x /workspace/scripts/*.sh

# Copy plugin assets (will be provided during build)
COPY assets/ /workspace/assets/

# Create vault directory
RUN mkdir -p /workspace/vault/.obsidian/plugins

# Set environment variables
ENV DISPLAY=:99
ENV SCREEN_WIDTH=1280
ENV SCREEN_HEIGHT=720
ENV SCREEN_DEPTH=24

# Expose port for potential VNC access (debugging)
EXPOSE 5900

# Default command
CMD ["/workspace/scripts/start.sh"]
