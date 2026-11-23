import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import yts from 'yt-search';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

// 1. YouTube Search API
app.get('/api/yt/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.json({ videos: [] });

  try {
    const result = await yts(q);
    const videos = result.videos.slice(0, 12).map((v) => ({
      id: v.videoId,
      title: v.title,
      author: v.author?.name || '',
      duration: v.timestamp || '',
      thumbnail: v.thumbnail,
    }));
    res.json({ videos });
  } catch (err) {
    console.error('YT search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// 2. Proxy noVNC + WebSocket stream to internal Chromium
const vncProxy = createProxyMiddleware({
  target: 'http://127.0.0.1:6080',
  ws: true,
  changeOrigin: true,
  pathRewrite: { '^/browser-stream': '' },
});

app.use('/browser-stream', vncProxy);
server.on('upgrade', vncProxy.upgrade);

// 3. Serve the built React app
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
