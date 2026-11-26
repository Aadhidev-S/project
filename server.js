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

// 2. Fallback Server Proxy (for older Android browsers without SharedWorker)
app.get('/proxy', async (req, res) => {
  const target = (req.query.url || '').toString().trim();
  if (!target) return res.status(400).send('Missing url');

  let parsedUrl;
  try {
    parsedUrl = new URL(target.startsWith('http') ? target : `https://${target}`);
  } catch {
    return res.status(400).send('Invalid URL');
  }

  try {
    const upstream = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    const contentType = upstream.headers.get('content-type') || 'text/html';
    res.setHeader('Content-Type', contentType);

    if (contentType.includes('text/html')) {
      let html = await upstream.text();
      const baseTag = `<base href="${parsedUrl.origin}${parsedUrl.pathname}">`;
      const navInterceptor = `
        <script>
          document.addEventListener('click', function(e) {
            const a = e.target.closest('a');
            if (a && a.href && a.href.startsWith('http')) {
              e.preventDefault();
              window.location.href = '/proxy?url=' + encodeURIComponent(a.href);
            }
          }, true);
        </script>
      `;
      html = html.includes('<head>')
        ? html.replace('<head>', `<head>${baseTag}${navInterceptor}`)
        : `${baseTag}${navInterceptor}${html}`;
      return res.send(html);
    }

    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    res.status(502).send(`Failed to load ${parsedUrl.hostname}: ${err.message}`);
  }
});

// 3. Serve built React app + public/ FIRST
app.use(express.static(path.join(__dirname, 'dist')));

// 4. Serve Ultraviolet, Libcurl, and Bare-Mux static bundles
app.use('/uv/', express.static(uvPath));
app.use('/libcurl/', express.static(libcurlPath));
app.use('/baremux/', express.static(baremuxPath));

// 5. Prevent /uv/service/* from falling back to the Documents React app
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

// 6. Route Wisp WebSocket connections
server.on('upgrade', (req, socket, head) => {
  if (req.url.endsWith('/wisp/')) {
    wisp.routeRequest(req, socket, head);
  } else {
    socket.end();
  }
});

// 7. Fallback to React app
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
