import React, { useState } from 'react';
import { ArrowLeft, Globe, Search, Youtube } from 'lucide-react';

export default function VaultDashboard({ onQuickSwitch }) {
  const [activeApp, setActiveApp] = useState('youtube'); // 'youtube' | 'browser'

  // YouTube state
  const [ytQuery, setYtQuery] = useState('');
  const [ytResults, setYtResults] = useState([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState(null);

  async function handleYtSearch(e) {
    e.preventDefault();
    if (!ytQuery.trim()) return;
    setYtLoading(true);
    try {
      const res = await fetch(`/api/yt/search?q=${encodeURIComponent(ytQuery.trim())}`);
      const data = await res.json();
      setYtResults(data.videos || []);
    } catch {
      setYtResults([]);
    }
    setYtLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#050505' }}>
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
        <main style={styles.main}>
          <form onSubmit={handleYtSearch} style={styles.searchBar}>
            <Search size={16} color="#888" />
            <input
              type="text"
              placeholder="Search YouTube..."
              value={ytQuery}
              onChange={(e) => setYtQuery(e.target.value)}
              style={styles.input}
            />
            <button type="submit" style={styles.quickSwitch}>
              {ytLoading ? '...' : 'Search'}
            </button>
          </form>

          {activeVideoId && (
            <div style={styles.playerWrap}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${activeVideoId}?autoplay=1&rel=0&modestbranding=1`}
                title="Player"
                style={{ width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          <div style={styles.grid}>
            {ytResults.map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveVideoId(v.id)}
                style={{
                  ...styles.videoCard,
                  borderColor: activeVideoId === v.id ? '#fff' : '#222',
                }}
              >
                <img src={v.thumbnail} alt="" style={styles.thumb} />
                <div style={{ padding: 10, textAlign: 'left' }}>
                  <div style={styles.videoTitle}>{v.title}</div>
                  <div style={styles.videoMeta}>
                    {v.author} {v.duration ? `• ${v.duration}` : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </main>
      )}

      {/* Remote Chromium Browser */}
      {activeApp === 'browser' && (
        <main style={{ flex: 1, display: 'flex', padding: 8 }}>
          <div style={styles.browserWrap}>
            <iframe
              src="/browser-stream/vnc.html?autoconnect=true&resize=scale&path=browser-stream/websockify"
              title="Remote Browser"
              style={{ width: '100%', height: '100%', border: 'none', background: '#000' }}
            />
          </div>
        </main>
      )}
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#0e0e0e', borderBottom: '1px solid #222' },
  quickSwitch: { display: 'flex', alignItems: 'center', gap: 6, background: '#000', color: '#fff', border: '1px solid #333', borderRadius: 999, padding: '6px 14px', cursor: 'pointer', fontSize: 13 },
  tabBtn: { display: 'flex', alignItems: 'center', gap: 6, color: '#fff', border: '1px solid #2a2a2a', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 16 },
  searchBar: { display: 'flex', alignItems: 'center', gap: 8, background: '#141414', border: '1px solid #2a2a2a', borderRadius: 999, padding: '4px 6px 4px 14px', maxWidth: 700, width: '100%' },
  input: { flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: 14 },
  playerWrap: { width: '100%', aspectRatio: '16 / 9', maxHeight: '62vh', borderRadius: 12, overflow: 'hidden', border: '1px solid #222', background: '#000' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 },
  videoCard: { background: '#111', border: '1px solid #222', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', padding: 0, color: '#fff', display: 'flex', flexDirection: 'column' },
  thumb: { width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' },
  videoTitle: { fontSize: 13, fontWeight: 500, lineHeight: 1.35, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  videoMeta: { fontSize: 11, color: '#888' },
  browserWrap: { flex: 1, minHeight: '85vh', borderRadius: 10, overflow: 'hidden', border: '1px solid #222' },
};
