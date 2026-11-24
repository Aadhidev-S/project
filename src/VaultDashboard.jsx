import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Globe,
  RotateCw,
  Search,
  Youtube,
} from 'lucide-react';

function buildTargetUrl(rawInput) {
  const raw = rawInput.trim();
  if (!raw) return 'https://duckduckgo.com';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.includes('.') && !raw.includes(' ')) return `https://${raw}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(raw)}`;
}

function waitForSwActivation(reg) {
  return new Promise((resolve, reject) => {
    if (reg.active) return resolve();
    const sw = reg.installing || reg.waiting;
    if (!sw) return resolve();
    sw.addEventListener('statechange', () => {
      if (sw.state === 'activated') resolve();
      if (sw.state === 'redundant') reject(new Error('Service worker failed to activate.'));
    });
  });
}

export default function VaultDashboard({ onQuickSwitch }) {
  const [activeApp, setActiveApp] = useState('youtube'); // 'youtube' | 'browser'

  // YouTube state
  const [ytQuery, setYtQuery] = useState('');
  const [ytFilter, setYtFilter] = useState('all');
  const [ytVideos, setYtVideos] = useState([]);
  const [ytChannels, setYtChannels] = useState([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);

  // Ultraviolet Browser state
  const iframeRef = useRef(null);
  const [navInput, setNavInput] = useState('https://duckduckgo.com');
  const [proxyReady, setProxyReady] = useState(false);
  const [proxyError, setProxyError] = useState('');
  const [frameSrc, setFrameSrc] = useState('');

  // Initialize Ultraviolet Service Worker + Wisp transport when Browser tab opens
  useEffect(() => {
    if (activeApp !== 'browser' || proxyReady) return;
    let cancelled = false;

    async function initProxy() {
      try {
        if (!('serviceWorker' in navigator)) {
          throw new Error('Service workers require HTTPS.');
        }
        if (!window.BareMux || !window.__uv$config) {
          throw new Error('Proxy scripts failed to load. Hard-refresh the page.');
        }

        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/uv/service/',
        });
        await waitForSwActivation(reg);

        const wispUrl =
          (window.location.protocol === 'https:' ? 'wss://' : 'ws://') +
          window.location.host +
          '/wisp/';

        const connection = new window.BareMux.BareMuxConnection('/baremux/worker.js');
        if ((await connection.getTransport()) !== '/epoxy/index.mjs') {
          await connection.setTransport('/epoxy/index.mjs', [{ wisp: wispUrl }]);
        }

        if (cancelled) return;
        setProxyReady(true);
        const startUrl =
          window.__uv$config.prefix +
          window.__uv$config.encodeUrl('https://duckduckgo.com');
        setFrameSrc(startUrl);
      } catch (err) {
        if (!cancelled) setProxyError(err?.message || 'Failed to start browser proxy.');
      }
    }

    initProxy();
    return () => {
      cancelled = true;
    };
  }, [activeApp, proxyReady]);

  async function runYtSearch(queryText, filterType = ytFilter) {
    if (!queryText.trim()) return;
    setYtLoading(true);
    try {
      const res = await fetch(
        `/api/yt/search?q=${encodeURIComponent(queryText.trim())}&filter=${filterType}`
      );
      const data = await res.json();
      setYtVideos(data.videos || []);
      setYtChannels(data.channels || []);
    } catch {
      setYtVideos([]);
      setYtChannels([]);
    }
    setYtLoading(false);
  }

  function handleYtSubmit(e) {
    e.preventDefault();
    runYtSearch(ytQuery, ytFilter);
  }

  function handleFilterChange(nextFilter) {
    setYtFilter(nextFilter);
    if (ytQuery.trim()) runYtSearch(ytQuery, nextFilter);
  }

  function handleBrowserGo(e) {
    e.preventDefault();
    if (!proxyReady || !window.__uv$config) return;
    const target = buildTargetUrl(navInput);
    const encoded = window.__uv$config.prefix + window.__uv$config.encodeUrl(target);
    setFrameSrc(encoded);
  }

  function handleNavHistory(action) {
    try {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      if (action === 'back') win.history.back();
      if (action === 'forward') win.history.forward();
      if (action === 'reload') win.location.reload();
    } catch {
      // Ignore cross-origin frame exceptions
    }
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#050505', overflow: 'hidden' }}>
      {/* Top Bar with Quick-Switch */}
      <header style={styles.header}>
        <button onClick={onQuickSwitch} style={styles.quickSwitch}>
          <ArrowLeft size={16} /> Docs
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActiveApp('youtube')}
            style={{ ...styles.tabBtn, background: activeApp === 'youtube' ? '#222' : 'transparent' }}
          >
            <Youtube size={16} /> YouTube
          </button>
          <button
            onClick={() => setActiveApp('browser')}
            style={{ ...styles.tabBtn, background: activeApp === 'browser' ? '#222' : 'transparent' }}
          >
            <Globe size={16} /> Browser
          </button>
        </div>
      </header>

      {/* YouTube Container */}
      {activeApp === 'youtube' && (
        <main style={styles.ytMain}>
          <form onSubmit={handleYtSubmit} style={styles.searchBar}>
            <Search size={16} color="#888" />
            <input
              type="text"
              placeholder="Search videos, shorts, channels..."
              value={ytQuery}
              onChange={(e) => setYtQuery(e.target.value)}
              style={styles.input}
            />
            <button type="submit" style={styles.quickSwitch}>
              {ytLoading ? '...' : 'Go'}
            </button>
          </form>

          <div style={{ display: 'flex', gap: 8 }}>
            {['all', 'shorts', 'channels'].map((f) => (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                style={{
                  ...styles.filterPill,
                  background: ytFilter === f ? '#fff' : '#141414',
                  color: ytFilter === f ? '#000' : '#ccc',
                }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {activeVideo && (
            <div style={activeVideo.isShort ? styles.shortPlayerWrap : styles.playerWrap}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${activeVideo.id}?autoplay=1&rel=0&modestbranding=1`}
                title="Player"
                style={{ width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {ytChannels.length > 0 && (ytFilter === 'all' || ytFilter === 'channels') && (
            <div style={styles.channelRow}>
              {ytChannels.map((c) => (
                <button
                  key={c.name}
                  onClick={() => {
                    setYtQuery(c.name);
                    setYtFilter('all');
                    runYtSearch(c.name, 'all');
                  }}
                  style={styles.channelCard}
                >
                  {c.image && <img src={c.image} alt="" style={styles.avatar} />}
                  <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                    <div style={styles.channelName}>{c.name}</div>
                    <div style={styles.videoMeta}>{c.subs || 'Channel'}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {ytFilter !== 'channels' && (
            <div style={styles.grid}>
              {ytVideos.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setActiveVideo({ id: v.id, isShort: v.isShort })}
                  style={{
                    ...styles.videoCard,
                    borderColor: activeVideo?.id === v.id ? '#fff' : '#222',
                  }}
                >
                  <div style={{ position: 'relative', width: '100%' }}>
                    <img src={v.thumbnail} alt="" style={styles.thumb} />
                    {v.isShort && <span style={styles.shortBadge}>SHORT</span>}
                  </div>
                  <div style={{ padding: 10, textAlign: 'left' }}>
                    <div style={styles.videoTitle}>{v.title}</div>
                    <div style={styles.videoMeta}>
                      {v.author} {v.duration ? `• ${v.duration}` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>
      )}

      {/* Mobile-First Ultraviolet Browser */}
      {activeApp === 'browser' && (
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={styles.browserNav}>
            <button onClick={() => handleNavHistory('back')} style={styles.navIcon} title="Back">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => handleNavHistory('forward')} style={styles.navIcon} title="Forward">
              <ChevronRight size={18} />
            </button>
            <button onClick={() => handleNavHistory('reload')} style={styles.navIcon} title="Reload">
              <RotateCw size={16} />
            </button>

            <form onSubmit={handleBrowserGo} style={styles.navForm}>
              <input
                type="text"
                placeholder="Search or enter URL..."
                value={navInput}
                onChange={(e) => setNavInput(e.target.value)}
                style={styles.input}
              />
              <button type="submit" style={styles.navGo}>Go</button>
            </form>
          </div>

          <div style={{ flex: 1, background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
            {proxyError ? (
              <div style={styles.statusMsg}>{proxyError}</div>
            ) : !proxyReady ? (
              <div style={styles.statusMsg}>Starting private browser...</div>
            ) : (
              <iframe
                ref={iframeRef}
                src={frameSrc}
                title="Private Browser"
                style={{ width: '100%', height: '100%', border: 'none', background: '#fff', display: 'block' }}
              />
            )}
          </div>
        </main>
      )}
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#0e0e0e', borderBottom: '1px solid #222', flexShrink: 0 },
  quickSwitch: { display: 'flex', alignItems: 'center', gap: 6, background: '#000', color: '#fff', border: '1px solid #333', borderRadius: 999, padding: '6px 14px', cursor: 'pointer', fontSize: 13 },
  tabBtn: { display: 'flex', alignItems: 'center', gap: 6, color: '#fff', border: '1px solid #2a2a2a', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 },
  ytMain: { flex: 1, display: 'flex', flexDirection: 'column', padding: 14, gap: 14, overflowY: 'auto' },
  searchBar: { display: 'flex', alignItems: 'center', gap: 8, background: '#141414', border: '1px solid #2a2a2a', borderRadius: 999, padding: '4px 6px 4px 14px', maxWidth: 700, width: '100%' },
  input: { flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: 14, minWidth: 0 },
  filterPill: { border: '1px solid #2a2a2a', borderRadius: 999, padding: '5px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  playerWrap: { width: '100%', aspectRatio: '16 / 9', maxHeight: '55vh', borderRadius: 12, overflow: 'hidden', border: '1px solid #222', background: '#000', flexShrink: 0 },
  shortPlayerWrap: { width: '100%', maxWidth: 340, aspectRatio: '9 / 16', maxHeight: '68vh', margin: '0 auto', borderRadius: 12, overflow: 'hidden', border: '1px solid #222', background: '#000', flexShrink: 0 },
  channelRow: { display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, flexShrink: 0 },
  channelCard: { display: 'flex', alignItems: 'center', gap: 10, background: '#121212', border: '1px solid #262626', borderRadius: 999, padding: '6px 14px 6px 8px', color: '#fff', cursor: 'pointer', flexShrink: 0, maxWidth: 220 },
  avatar: { width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  channelName: { fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 },
  videoCard: { background: '#111', border: '1px solid #222', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', padding: 0, color: '#fff', display: 'flex', flexDirection: 'column' },
  thumb: { width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' },
  shortBadge: { position: 'absolute', bottom: 6, right: 6, background: '#e00', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 },
  videoTitle: { fontSize: 13, fontWeight: 500, lineHeight: 1.35, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  videoMeta: { fontSize: 11, color: '#888' },
  browserNav: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#111', borderBottom: '1px solid #222', flexShrink: 0 },
  navIcon: { background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  navForm: { flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 999, padding: '3px 4px 3px 12px', minWidth: 0 },
  navGo: { background: '#000', color: '#fff', border: '1px solid #333', borderRadius: 999, padding: '4px 12px', fontSize: 12, cursor: 'pointer', flexShrink: 0 },
  statusMsg: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 14, padding: 20, textAlign: 'center' },
};
