import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function PdfViewer({ file, onBack, onVerifyCode }) {
  const canvasRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [loadingPdf, setLoadingPdf] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState('');

  // Track browser fullscreen state
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Load PDF document
  useEffect(() => {
    if (!file?.url) return;
    let cancelled = false;
    setLoadingPdf(true);
    setLoadError('');
    setPdfDoc(null);

    const loadingTask = pdfjsLib.getDocument({ url: file.url });
    loadingTask.promise
      .then((doc) => {
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNum(1);
        setSearchStatus('');
        setLoadingPdf(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('PDF load error:', err);
        setLoadError(err?.message || 'Failed to load PDF document.');
        setLoadingPdf(false);
      });

    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, [file?.url]);

  // Render active page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let renderTask;
    let cancelled = false;

    pdfDoc.getPage(pageNum).then((page) => {
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      renderTask = page.render({ canvasContext: ctx, viewport });
    });

    return () => {
      cancelled = true;
      if (renderTask) renderTask.cancel();
    };
  }, [pdfDoc, pageNum, scale]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  async function handleSearchSubmit(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // 1. Secret check against server first
    const unlocked = await onVerifyCode(searchQuery);
    if (unlocked) {
      setSearchQuery('');
      return;
    }

    // 2. Normal PDF text search fallback
    if (!pdfDoc) return;
    setSearchStatus('Searching...');
    const target = searchQuery.toLowerCase();

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item) => item.str).join(' ').toLowerCase();
      if (text.includes(target)) {
        setPageNum(i);
        setSearchStatus(`Page ${i}`);
        return;
      }
    }
    setSearchStatus('No matches');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      {/* Viewer Toolbar */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button onClick={onBack} style={styles.pillBtn}>
            <ArrowLeft size={15} /> Files
          </button>
          <span style={styles.fileTitle} title={file.name}>{file.name}</span>
        </div>

        <form onSubmit={handleSearchSubmit} style={styles.searchForm}>
          <Search size={15} color="#888" />
          <input
            type="text"
            placeholder="Find in document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          {searchStatus && <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>{searchStatus}</span>}
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => setScale((s) => Math.max(0.6, +(s - 0.2).toFixed(1)))}
            style={styles.iconBtn}
            title="Zoom Out"
          >
            <ZoomOut size={17} />
          </button>
          <span style={{ fontSize: 12, color: '#aaa', minWidth: 40, textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.4, +(s + 0.2).toFixed(1)))}
            style={styles.iconBtn}
            title="Zoom In"
          >
            <ZoomIn size={17} />
          </button>

          <button
            onClick={toggleFullscreen}
            style={styles.iconBtn}
            title={isFullscreen ? 'Minimize' : 'Maximize'}
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </header>

      {/* PDF Canvas Area */}
      <main style={styles.main}>
        {loadingPdf && <div style={styles.statusText}>Opening document...</div>}
        {loadError && <div style={{ ...styles.statusText, color: '#ff6b6b' }}>{loadError}</div>}

        <canvas
          ref={canvasRef}
          style={{
            display: loadingPdf || loadError ? 'none' : 'block',
            maxWidth: '100%',
            height: 'auto',
            background: '#fff',
            boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
          }}
        />

        {!loadingPdf && !loadError && numPages > 1 && (
          <div style={styles.pager}>
            <button disabled={pageNum <= 1} onClick={() => setPageNum((p) => p - 1)} style={styles.pillBtn}>
              <ChevronLeft size={16} /> Prev
            </button>
            <span style={{ fontSize: 13, color: '#ccc' }}>{pageNum} / {numPages}</span>
            <button disabled={pageNum >= numPages} onClick={() => setPageNum((p) => p + 1)} style={styles.pillBtn}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', background: '#111', borderBottom: '1px solid #222', flexWrap: 'wrap' },
  fileTitle: { fontSize: 13, color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 },
  searchForm: { display: 'flex', alignItems: 'center', gap: 8, background: '#1a1a1a', border: '1px solid #333', borderRadius: 999, padding: '6px 12px', flex: 1, minWidth: 180, maxWidth: 380 },
  searchInput: { background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '100%', fontSize: 13 },
  iconBtn: { background: 'transparent', border: 'none', color: '#e5e5e5', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, gap: 16, overflow: 'auto' },
  statusText: { marginTop: 60, fontSize: 14, color: '#888' },
  pager: { display: 'flex', alignItems: 'center', gap: 16 },
  pillBtn: { display: 'flex', alignItems: 'center', gap: 5, background: '#000', color: '#fff', border: '1px solid #333', borderRadius: 999, padding: '6px 14px', cursor: 'pointer', fontSize: 13 },
};
