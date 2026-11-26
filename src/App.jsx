import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react';
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
  const [currentPath, setCurrentPath] = useState('');
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFile, setActiveFile] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadDocs() {
      setLoading(true);
      try {
        const query = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
        const res = await fetch(`/api/docs${query}`);
        const data = await res.json();
        if (!cancelled) {
          setFolders(data.folders || []);
          setFiles(data.files || []);
        }
      } catch {
        if (!cancelled) {
          setFolders([]);
          setFiles([]);
        }
      }
      if (!cancelled) setLoading(false);
    }
    loadDocs();
    return () => {
      cancelled = true;
    };
  }, [currentPath]);

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

  function goUpFolder() {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
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

  const pathSegments = currentPath ? currentPath.split('/') : [];
  const totalItems = folders.length + files.length;

  // File Explorer landing page
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {currentPath ? (
            <button onClick={goUpFolder} style={styles.backBtn}>
              <ArrowLeft size={15} /> Back
            </button>
          ) : (
            <FolderOpen size={20} color="#fff" />
          )}

          {/* Breadcrumb Navigation */}
          <div style={styles.breadcrumbs}>
            <button
              onClick={() => setCurrentPath('')}
              style={{
                ...styles.crumbBtn,
                color: currentPath ? '#888' : '#fff',
                fontWeight: currentPath ? 400 : 600,
              }}
            >
              Documents
            </button>
            {pathSegments.map((seg, idx) => {
              const segPath = pathSegments.slice(0, idx + 1).join('/');
              const isLast = idx === pathSegments.length - 1;
              return (
                <React.Fragment key={segPath}>
                  <ChevronRight size={14} color="#555" style={{ flexShrink: 0 }} />
                  <button
                    onClick={() => setCurrentPath(segPath)}
                    style={{
                      ...styles.crumbBtn,
                      color: isLast ? '#fff' : '#888',
                      fontWeight: isLast ? 600 : 400,
                    }}
                  >
                    {seg}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <span style={styles.count}>{totalItems} items</span>
      </header>

      <main style={styles.main}>
        {loading ? (
          <div style={styles.empty}>Loading...</div>
        ) : totalItems === 0 ? (
          <div style={styles.empty}>This folder is empty.</div>
        ) : (
          <div style={styles.grid}>
            {/* Folders First */}
            {folders.map((folder) => (
              <button
                key={folder.path}
                onClick={() => setCurrentPath(folder.path)}
                style={styles.card}
              >
                <div style={styles.folderIconWrap}>
                  <Folder size={28} color="#f5f5f5" />
                </div>
                <div style={styles.fileInfo}>
                  <div style={styles.fileName} title={folder.name}>
                    {folder.name}
                  </div>
                  <div style={styles.fileMeta}>Folder</div>
                </div>
              </button>
            ))}

            {/* PDF Files */}
            {files.map((file) => (
              <button
                key={file.path}
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
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', background: '#111', borderBottom: '1px solid #222' },
  backBtn: { display: 'flex', alignItems: 'center', gap: 5, background: '#000', color: '#fff', border: '1px solid #333', borderRadius: 999, padding: '5px 12px', cursor: 'pointer', fontSize: 13, flexShrink: 0 },
  breadcrumbs: { display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', whiteSpace: 'nowrap' },
  crumbBtn: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, padding: '2px 4px' },
  count: { fontSize: 12, color: '#777', flexShrink: 0 },
  main: { flex: 1, padding: 20, maxWidth: 1100, width: '100%', margin: '0 auto' },
  empty: { textAlign: 'center', color: '#777', marginTop: 80, fontSize: 14 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 },
  card: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, padding: 16, background: '#141414', border: '1px solid #262626', borderRadius: 12, color: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' },
  folderIconWrap: { width: 48, height: 48, borderRadius: 10, background: '#262626', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 48, height: 48, borderRadius: 10, background: '#1f1f1f', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  fileInfo: { width: '100%', overflow: 'hidden' },
  fileName: { fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 },
  fileMeta: { fontSize: 12, color: '#777' },
};
