import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import wisp from 'wisp-server-node';
import yts from 'yt-search';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function sanitizePath(rawPath) {
  const cleaned = (rawPath || '').toString().replace(/^\/+|\/+$/g, '');
  if (cleaned.includes('..')) return null;
  return cleaned;
}

// 1. Private Folder & PDF List (supports nested folders via ?path=)
app.get('/api/docs', async (req, res) => {
  const folderPath = sanitizePath(req.query.path);
  if (folderPath === null) {
    return res.status(400).json({ folders: [], files: [] });
  }

  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .list(folderPath, { sortBy: { column: 'name', order: 'asc' } });

    if (error || !data) {
      return res.status(500).json({ folders: [], files: [] });
    }

    const folders = data
      .filter((item) => !item.id && item.name !== '.emptyFolderPlaceholder')
      .map((item) => ({
        name: item.name,
        path: folderPath ? `${folderPath}/${item.name}` : item.name,
      }));

    const files = data
      .filter((item) => item.id && item.name.toLowerCase().endsWith('.pdf'))
      .map((item) => {
        const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name;
        return {
          name: item.name,
          path: fullPath,
          size: item.metadata?.size || 0,
          updatedAt: item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '',
          url: `/api/docs/file?path=${encodeURIComponent(fullPath)}`,
        };
      });

    res.json({ folders, files });
  } catch (err) {
    console.error('Docs list error:', err);
    res.status(500).json({ folders: [], files: [] });
  }
});

// 2. Private PDF Stream (supports nested folder paths)
app.get('/api/docs/file', async (req, res) => {
  const filePath = sanitizePath(req.query.path);
  if (!filePath) return res.status(400).send('Invalid file path');

  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (error || !data) return res.status(404).send('Document not found');

    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  } catch (err) {
    console.error('Doc stream error:', err);
    res.status(500).send('Failed to load document');
  }
});

// 3. Server-Side Secret Code Verification
app.post('/api/verify', async (req, res) => {
  const code = (req.body?.code || '').toString().trim();
  if (!code) return res.json({ ok: false });

  try {
    const { data, error } = await supabase.rpc('verify_vault_code', {
      input_code: code,
    });
    res.json({ ok: !error && data === true });
  } catch {
    res.json({ ok: false });
  }
});

// 4. Upgraded YouTube Search API (Videos, Shorts, Channels)
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

// 5. Local Start Page for Fallback Mode (never blocked)
app.get('/proxy-home', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { margin: 0; background: #0a0a0a; color: #f5f5f5; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; box-sizing: border-box; }
          .box { width: 100%; max-width: 460px; text-align: center; }
          h2 { font-weight: 500; font-size: 18px; margin-bottom: 16px; color: #ccc; }
          form { display: flex; gap: 8px; }
          input { flex: 1; background: #161616; border: 1px solid #333; border-radius: 999px; padding: 10px 16px; color: #fff; font-size: 15px; outline: none; }
          button { background: #fff; color: #000; border: none; border-radius: 999px; padding: 10px 18px; font-weight: 600; cursor: pointer; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>Private Search</h2>
          <form onsubmit="go(event)">
            <input id="q" type="text" placeholder="Search or enter URL..." autofocus />
            <button type="submit">Go</button>
          </form>
        </div>
        <script>
          function go(e) {
            e.preventDefault();
            var v = document.getElementById('q').value.trim();
            if (!v) return;
            var isUrl = /^https?:\\/\\//i.test(v) || (v.indexOf('.') !== -1 && v.indexOf(' ') === -1);
            var target = isUrl
              ? (v.indexOf('http') === 0 ? v : 'https://' + v)
              : 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(v) + '&kl=us-en';
            window.location.href = '/proxy?url=' + encodeURIComponent(target);
          }
        </script>
      </body>
    </html>
  `);
});

// 6. Fallback Server Proxy (for older Android browsers without SharedWorker)
app.get('/proxy', async (req, res) => {
  const target = (req.query.url || '').toString().trim();
  if (!target) return res.redirect('/proxy-home');

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

    const finalUrl = new URL(upstream.url || parsedUrl.toString());
    const contentType = upstream.headers.get('content-type') || 'text/html';
    res.setHeader('Content-Type', contentType);
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    if (contentType.includes('text/html')) {
      let html = await upstream.text();

      // Strip meta CSP and meta refresh redirects that break out of /proxy
      html = html.replace(/<meta[^>]+http-equiv=["']?(?:Content-Security-Policy|refresh)["']?[^>]*>/gi, '');

      // Rewrite href="https://..." links server-side so they never escape the iframe
      html = html.replace(
        /(<a\b[^>]*?\bhref=)(["'])(https?:\/\/[^"']+)\2/gi,
        (_m, prefix, quote, url) => `${prefix}${quote}/proxy?url=${encodeURIComponent(url)}${quote}`
      );

      const baseTag = `<base href="${finalUrl.origin}${finalUrl.pathname}">`;
      const navInterceptor = `
        <script>
          document.addEventListener('click', function(e) {
            const a = e.target.closest('a');
            if (!a) return;
            const raw = a.getAttribute('href') || '';
            if (raw.startsWith('/proxy?url=') || raw.startsWith('#') || raw.startsWith('javascript:')) return;
            if (a.href && a.href.startsWith('http')) {
              e.preventDefault();
              window.location.href = '/proxy?url=' + encodeURIComponent(a.href);
            }
          }, true);
          document.addEventListener('submit', function(e) {
            const form = e.target;
            if (!form) return;
            e.preventDefault();
            try {
              const targetUrl = new URL(form.getAttribute('action') || '', '${finalUrl.href}');
              const data = new FormData(form);
              for (const [k, v] of data.entries()) {
                targetUrl.searchParams.set(k, v.toString());
              }
              window.location.href = '/proxy?url=' + encodeURIComponent(targetUrl.toString());
            } catch {}
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

// 7. Serve built React app + public/ FIRST
app.use(express.static(path.join(__dirname, 'dist')));

// 8. Serve Ultraviolet, Libcurl, and Bare-Mux static bundles
app.use('/uv/', express.static(uvPath));
app.use('/libcurl/', express.static(libcurlPath));
app.use('/baremux/', express.static(baremuxPath));

// 9. Prevent /uv/service/* from falling back to the Documents React app
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

// 10. Route Wisp WebSocket connections
server.on('upgrade', (req, socket, head) => {
  if (req.url.endsWith('/wisp/')) {
    wisp.routeRequest(req, socket, head);
  } else {
    socket.end();
  }
});

// 11. Fallback to React app
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
