import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import yts from 'yt-search';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

// 1. YouTube Search API (no API key required)
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

// 2. Lightweight Contained Web Proxy
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
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    const contentType = upstream.headers.get('content-type') || 'text/html';
    res.setHeader('Content-Type', contentType);
    // Deliberately omit X-Frame-Options and CSP so it renders inside the iframe

    if (contentType.includes('text/html')) {
      let html = await upstream.text();
      const baseTag = `<base href="${parsedUrl.origin}${parsedUrl.pathname}">`;

      // Inject <base> for assets + script to keep link clicks inside /proxy
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

      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${baseTag}${navInterceptor}`);
      } else {
        html = `${baseTag}${navInterceptor}${html}`;
      }

      return res.send(html);
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    res.status(502).send(`Failed to load ${parsedUrl.hostname}: ${err.message}`);
  }
});

// 3. Serve the built React app
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
