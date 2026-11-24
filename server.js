import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { createProxyMiddleware } from 'http-proxy-middleware';
import yts from 'yt-search';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

app.use(express.json());

function runXdo(args) {
  return new Promise((resolve) => {
    execFile('xdotool', args, { env: { ...process.env, DISPLAY: ':99' } }, () => resolve());
  });
}

// 1. Native Mobile Browser Controls (Back, Forward, Reload, URL/Search)
app.post('/api/browser/action', async (req, res) => {
  const { type, value } = req.body || {};

  if (type === 'back') {
    await runXdo(['key', 'alt+Left']);
  } else if (type === 'forward') {
    await runXdo(['key', 'alt+Right']);
  } else if (type === 'reload') {
    await runXdo(['key', 'F5']);
  } else if (type === 'goto' && typeof value === 'string' && value.trim()) {
    const raw = value.trim();
    const isUrl = /^https?:\/\//i.test(raw) || (raw.includes('.') && !raw.includes(' '));
    const target = isUrl
      ? raw.startsWith('http') ? raw : `https://${raw}`
      : `https://www.google.com/search?q=${encodeURIComponent(raw)}`;

    await runXdo(['key', 'ctrl+l']);
    await new Promise((r) => setTimeout(r, 80));
    await runXdo(['type', '--delay', '2', target]);
    await runXdo(['key', 'Return']);
  }

  res.json({ ok: true });
});

// 2. Upgraded YouTube Search API (Videos, Shorts, Channels)
app.get('/api/yt/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const filter = (req.query.filter || 'all').toString(); // 'all' | 'shorts' | 'channels'
  if (!q) return res.json({ videos: [], channels: [] });

  try {
    const searchQuery = filter === 'shorts' ? `${q} #shorts` : q;
    const result = await yts(searchQuery);

    let videos = (result.videos || []).map((v) => ({
      id: v.videoId,
      title: v.title,
      author: v.author?.name || '',
      duration: v.timestamp || '',
      seconds: v.seconds || 0,
      views: v.views || 0,
      thumbnail: v.thumbnail,
      isShort: (v.seconds > 0 && v.seconds <= 65) || v.url?.includes('/shorts/'),
    }));

    if (filter === 'shorts') {
      videos = videos.filter((v) => v.isShort || v.seconds <= 90);
    }

    const channels = (result.channels || []).slice(0, 8).map((c) => ({
      name: c.name,
      image: c.image || c.thumbnail || '',
      subs: c.subCountLabel || '',
      videoCount: c.videoCount || 0,
    }));

    res.json({
      videos: videos.slice(0, 24),
      channels,
    });
  } catch (err) {
    console.error('YT search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// 3. Proxy noVNC + WebSocket stream to TigerVNC
const vncProxy = createProxyMiddleware({
  target: 'http://127.0.0.1:6080',
  ws: true,
  changeOrigin: true,
  pathRewrite: { '^/browser-stream': '' },
});

app.use('/browser-stream', vncProxy);
server.on('upgrade', vncProxy.upgrade);

// 4. Serve the built React app
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
