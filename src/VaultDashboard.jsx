import React, { useState } from 'react';
import { ArrowLeft, Youtube, Globe } from 'lucide-react';

function extractYouTubeId(input) {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default function VaultDashboard({ onQuickSwitch }) {
  const [activeApp, setActiveApp] = useState('youtube'); // 'youtube' | 'browser'
  const [ytInput, setYtInput] = useState('');
  const [videoId, setVideoId] = useState('dQw4w9WgXcQ'); // Default test video

  function handleLoadVideo(e) {
    e.preventDefault();
    const id = extractYouTubeId(ytInput);
    if (id) {
      setVideoId(id);
      setYtInput('');
    }
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

      {/* Container Body */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 16 }}>
        {activeApp === 'youtube' && (
          <>
            <form onSubmit={handleLoadVideo} style={{ display: 'flex', gap: 8, maxWidth: 600 }}>
              <input
                type="text"
                placeholder="Paste YouTube URL or Video ID..."
                value={ytInput}
                onChange={(e) => setYtInput(e.target.value)}
                style={styles.input}
              />
              <button type="submit" style={styles.quickSwitch}>Load</button>
            </form>

            <div style={styles.playerWrap}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
                title="Player"
                style={{ width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </>
        )}

        {activeApp === 'browser' && (
          <div style={styles.placeholder}>
            <Globe size={32} color="#555" />
            <p style={{ color: '#888' }}>Web Proxy Container — wired up in Phase 2.</p>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#0e0e0e', borderBottom: '1px solid #222' },
  quickSwitch: { display: 'flex', alignItems: 'center', gap: 6, background: '#000', color: '#fff', border: '1px solid #333', borderRadius: 999, padding: '6px 14px', cursor: 'pointer', fontSize: 13 },
  tabBtn: { display: 'flex', alignItems: 'center', gap: 6, color: '#fff', border: '1px solid #2a2a2a', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 },
  input: { flex: 1, background: '#141414', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', color: '#fff', outline: 'none' },
  playerWrap: { flex: 1, minHeight: '70vh', borderRadius: 12, overflow: 'hidden', border: '1px solid #222', background: '#000' },
  placeholder: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, border: '1px dashed #2a2a2a', borderRadius: 12 },
};
