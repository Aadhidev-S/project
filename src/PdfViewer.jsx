import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { MoreVertical, Search, ChevronLeft, ChevronRight } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://unpkg.com/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';

export default function PdfViewer({ files, activeFileUrl, onSelectFile, onVerifyCode }) {
  const canvasRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState('');

  // 3-dot menu & 3-tap version trigger
  const [menuOpen, setMenuOpen] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [modalCode, setModalCode] = useState('');
  const tapTimerRef = useRef(null);

  useEffect(() => {
    if (!activeFileUrl) return;
    let cancelled = false;

    pdfjsLib.getDocument(activeFileUrl).promise.then((doc) => {
      if (cancelled) return;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setPageNum(1);
      setSearchStatus('');
    });

    return () => { cancelled = true; };
  }, [activeFileUrl]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let renderTask;

    pdfDoc.getPage(pageNum).then((page) => {
      const viewport = page.getViewport({ scale: 1.35 });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      renderTask = page.render({ canvasContext: ctx, viewport });
    });

    return () => { if (renderTask) renderTask.cancel(); };
  }, [pdfDoc, pageNum]);

  async function handleSearchSubmit(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // 1. Secret check against Supabase first
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
        setSearchStatus(`Found on page ${i}`);
        return;
      }
    }
    setSearchStatus('No matches found');
  }

  function handleVersionTap() {
    clearTimeout(tapTimerRef.current);
    const next = tapCount + 1;
    if (next >= 3) {
      setTapCount(0);
      setMenuOpen(false);
      setCodeModalOpen(true);
    } else {
      setTapCount(next);
      tapTimerRef.current = setTimeout(() => setTapCount(0), 2000);
    }
  }

  async function handleModalSubmit(e) {
    e.preventDefault();
    const ok = await onVerifyCode(modalCode);
    if (!ok) {
      setModalCode('');
      setCodeModalOpen(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Toolbar */}
      <header style={styles.header}>
        <select
          value={activeFileUrl || ''}
          onChange={(e) => onSelectFile(e.target.value)}
          style={styles.select}
        >
          {files.length === 0 && <option>No PDFs in bucket</option>}
          {files.map((f) => (
            <option key={f.name} value={f.url}>{f.name}</option>
          ))}
        </select>

        <form onSubmit={handleSearchSubmit} style={styles.searchForm}>
          <Search size={16} color="#888" />
          <input
            type="text"
            placeholder="Find in document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          {searchStatus && <span style={{ fontSize: 12, color: '#888' }}>{searchStatus}</span>}
        </form>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(!menuOpen)} style={styles.iconBtn}>
            <MoreVertical size={18} />
          </button>

          {menuOpen && (
            <div style={styles.menu}>
              <div style={styles.menuItem}>Page {pageNum} of {numPages || 1}</div>
              <div onClick={handleVersionTap} style={{ ...styles.menuItem, cursor: 'pointer', color: '#888' }}>
                Version 1.4.2
              </div>
            </div>
          )}
        </div>
      </header>

      {/* PDF Canvas */}
      <main style={styles.main}>
        <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto', background: '#fff' }} />
        {numPages > 1 && (
          <div style={styles.pager}>
            <button disabled={pageNum <= 1} onClick={() => setPageNum((p) => p - 1)} style={styles.pillBtn}>
              <ChevronLeft size={16} /> Prev
            </button>
            <span>{pageNum} / {numPages}</span>
            <button disabled={pageNum >= numPages} onClick={() => setPageNum((p) => p + 1)} style={styles.pillBtn}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </main>

      {/* Hidden Code Modal (from 3-tap Version) */}
      {codeModalOpen && (
        <div style={styles.modalBackdrop} onClick={() => setCodeModalOpen(false)}>
          <form onSubmit={handleModalSubmit} onClick={(e) => e.stopPropagation()} style={styles.modal}>
            <input
              type="password"
              autoFocus
              placeholder="Access key"
              value={modalCode}
              onChange={(e) => setModalCode(e.target.value)}
              style={styles.modalInput}
            />
            <button type="submit" style={styles.pillBtn}>Continue</button>
          </form>
        </div>
      )}
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', background: '#111', borderBottom: '1px solid #222' },
  select: { background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: 6, padding: '6px 10px', maxWidth: 200 },
  searchForm: { display: 'flex', alignItems: 'center', gap: 8, background: '#1a1a1a', border: '1px solid #333', borderRadius: 999, padding: '6px 12px', flex: 1, maxWidth: 400 },
  searchInput: { background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '100%' },
  iconBtn: { background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 6 },
  menu: { position: 'absolute', right: 0, top: 38, background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, minWidth: 160, zIndex: 20, overflow: 'hidden' },
  menuItem: { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #222', userSelect: 'none' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, gap: 16 },
  pager: { display: 'flex', alignItems: 'center', gap: 16 },
  pillBtn: { display: 'flex', alignItems: 'center', gap: 4, background: '#000', color: '#fff', border: '1px solid #333', borderRadius: 999, padding: '6px 14px', cursor: 'pointer' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  modal: { background: '#111', border: '1px solid #333', borderRadius: 12, padding: 20, display: 'flex', gap: 10 },
  modalInput: { background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', color: '#fff', outline: 'none' },
};
