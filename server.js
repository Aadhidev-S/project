import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import wisp from 'wisp-server-node';
import yts from 'yt-search';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

// 1. Upgraded YouTube Search API (Videos, Shorts, Channels)
app.get('/api/yt/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const filter = (req.query.filter || 'all').toString();
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
    }));

    res.json({ videos: videos.slice(0, 24), channels });
  } catch (err) {
    console.error('YT search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// 2. Serve built React app + public/ FIRST (so public/uv/uv.config.js overrides default)
app.use(express.static(path.join(__dirname, 'dist')));

// 3. Serve Ultraviolet, Libcurl, and Bare-Mux static bundles
app.use('/uv/', express.static(uvPath));
app.use('/libcurl/', express.static(libcurlPath));
app.use('/baremux/', express.static(baremuxPath));

// 4. Prevent /uv/service/* from ever falling back to the Documents React app
app.all('/uv/service/*', (_req, res) => {
  res.status(503).send(`
    <html>
      <body style="background:#0a0a0a;color:#ccc;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;">
        <div>
          <p>Proxy worker is waking up...</p>
          <script>setTimeout(() => location.reload(), 800);</script>
        </div>
      </body>
    </html>
  `);
});

// 5. Route Wisp WebSocket connections
server.on('upgrade', (req, socket, head) => {
  if (req.url.endsWith('/wisp/')) {
    wisp.routeRequest(req, socket, head);
  } else {
    socket.end();
  }
});

// 6. Fallback to React app
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
