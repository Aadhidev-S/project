FROM node:20-bookworm-slim
WORKDIR /app

# Install Chromium + virtual display + noVNC
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    xvfb \
    fluxbox \
    x11vnc \
    novnc \
    websockify \
    fonts-liberation \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY . .
RUN chmod +x start.sh

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

EXPOSE 8080
CMD ["./start.sh"]
