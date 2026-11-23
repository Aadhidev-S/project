import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import PdfViewer from './PdfViewer';
import VaultDashboard from './VaultDashboard';

export default function App() {
  const [view, setView] = useState('docs'); // 'docs' | 'vault'
  const [files, setFiles] = useState([]);
  const [activeFileUrl, setActiveFileUrl] = useState(null);

  useEffect(() => {
    async function loadDocs() {
      const { data, error } = await supabase.storage.from('documents').list();
      if (error || !data) return;

      const pdfs = data
        .filter((f) => f.name.toLowerCase().endsWith('.pdf'))
        .map((f) => ({
          name: f.name,
          url: supabase.storage.from('documents').getPublicUrl(f.name).data.publicUrl,
        }));

      setFiles(pdfs);
      if (pdfs.length > 0) setActiveFileUrl(pdfs[0].url);
    }
    loadDocs();
  }, []);

  async function checkSecretCode(input) {
    if (!input.trim()) return false;
    const { data, error } = await supabase.rpc('verify_vault_code', {
      input_code: input.trim(),
    });
    if (!error && data === true) {
      setView('vault');
      return true;
    }
    return false;
  }

  // Hard unmount: switching back to 'docs' completely destroys the vault DOM & audio
  if (view === 'vault') {
    return <VaultDashboard onQuickSwitch={() => setView('docs')} />;
  }

  return (
    <PdfViewer
      files={files}
      activeFileUrl={activeFileUrl}
      onSelectFile={setActiveFileUrl}
      onVerifyCode={checkSecretCode}
    />
  );
}
