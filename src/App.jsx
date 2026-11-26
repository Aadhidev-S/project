import React, { useEffect, useState } from 'react';
import { FileText, FolderOpen } from 'lucide-react';
import PdfViewer from './PdfViewer';
import VaultDashboard from './VaultDashboard';

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function App() {
  const [view, setView] = useState('explorer'); // 'explorer' | 'viewer' | 'vault'
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFile, setActiveFile] = useState(null);

  useEffect(() => {
    async function loadDocs() {
      setLoading(true);
      try {
        const res = await fetch('/api/docs');
        const data = await res.json();
        setFiles(data.files || []);
      } catch {
        setFiles([]);
      }
      setLoading(false);
    }
    loadDocs();
  }, []);

  async function checkSecretCode(input) {
    if (!input.trim()) return false;
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: input.trim() }),
      });
      const data = await res.json();
      if (data.ok === true) {
        setView('vault');
        return true;
      }
    } catch {
      // Ignore network errors
    }
    return false;
  }

  // Hard unmount of vault when switching back
  if (view === 'vault') {
    return (
      <VaultDashboard
        onQuickSwitch={() => setView(activeFile ? 'viewer' : 'explorer')}
      />
    );
  }

  // PDF Viewer screen
  if (view === 'viewer' && activeFile) {
    return (
      <PdfViewer
        file={activeFile}
        onBack={() => setView('explorer')}
        onVerifyCode={checkSecretCode}
      />
    );
  }

  // File Explorer landing page
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FolderOpen size={20} color="#fff" />
          <h1 style={styles.title}>Documents</h1>
        </div>
        <span style={styles.count}>{files.length} files</span>
      </header>

      <main style={styles.main}>
        {loading ? (
          <div style={styles.empty}>Loading files...</div>
        ) : files.length === 0 ? (
          <div style={styles.empty}>No PDF documents found.</div>
        ) : (
          <div style={styles.grid}>
            {files.map((file) => (
              <button
                key={file.name}
                onClick={() => {
                  setActiveFile(file);
                  setView('viewer');
                }}
                style={styles.card}
              >
                <div style={styles.iconWrap}>
                  <FileText size={28} color="#e5e5e5" />
                </div>
                <div style={styles.fileInfo}>
                  <div style={styles.fileName} title={file.name}>
                    {file.name}
                  </div>
                  <div style={styles.fileMeta}>
                    {[formatBytes(file.size), file.updatedAt].filter(Boolean).join(' • ')}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#0a0a0a', color: '#f5f5f5', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#111', borderBottom: '1px solid #222' },
  title: { fontSize: 16, fontWeight: 600, letterSpacing: '0.2px' },
  count: { fontSize: 12, color: '#777' },
  main: { flex: 1, padding: 24, maxWidth: 1100, width: '100%', margin: '0 auto' },
  empty: { textAlign: 'center', color: '#777', marginTop: 80, fontSize: 14 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 },
  card: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14, padding: 16, background: '#141414', border: '1px solid #262626', borderRadius: 12, color: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' },
  iconWrap: { width: 48, height: 48, borderRadius: 10, background: '#1f1f1f', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  fileInfo: { width: '100%', overflow: 'hidden' },
  fileName: { fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 },
  fileMeta: { fontSize: 12, color: '#777' },
};
