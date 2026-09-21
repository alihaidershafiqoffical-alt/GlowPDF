import { useState, useRef } from 'react';
import { apiFetch } from '../lib/api';
import type { FC, DragEvent, ChangeEvent } from 'react';
import { PDFDocument } from 'pdf-lib';
import { 
  Upload, 
  FileText, 
  Download, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft,
  Loader2,
  Minimize2,
  ArrowDown,
  Info
} from 'lucide-react';

interface CompressPdfProps {
  onBack: () => void;
}

interface CompressResult {
  url: string;
  originalBytes: number;
  compressedBytes: number;
  reducedPercent: number;
  isReduced: boolean;
  engine?: string;
}

type CompressLevel = 'extreme' | 'recommended' | 'low';

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const CompressPdf: FC<CompressPdfProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [level, setLevel] = useState<CompressLevel>('recommended');
  const [result, setResult] = useState<CompressResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleProcessFile = async (selectedFile: File) => {
    setErrorMessage(null);
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Only PDF files are supported. Please select a valid PDF.');
      return;
    }

    try {
      const buffer = await selectedFile.arrayBuffer();
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const count = doc.getPageCount();

      if (count < 1) {
        setErrorMessage('The selected PDF contains no pages.');
        return;
      }

      setFile(selectedFile);
      setTotalPages(count);
    } catch {
      setErrorMessage('Could not open the selected PDF. Please verify it is not corrupted or password-protected.');
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleCompress = async () => {
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const originalBytes = file.size;

    // 1. Try backend compression endpoint first
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('level', level);

      const resp = await apiFetch('/api/compress-pdf', {
        method: 'POST',
        body: formData,
      });

      if (resp.ok) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const origHdr = resp.headers.get('X-Original-Size');
        const compHdr = resp.headers.get('X-Compressed-Size');
        const pctHdr = resp.headers.get('X-Percent-Saved');
        const engineHdr = resp.headers.get('X-Engine') || 'GlowPDF Multi-tier Compressor';

        const origSize = origHdr ? parseInt(origHdr, 10) : originalBytes;
        const compSize = compHdr ? parseInt(compHdr, 10) : blob.size;
        const pctSaved = pctHdr ? parseFloat(pctHdr) : Math.max(0, Math.round(((origSize - compSize) / origSize) * 100));

        setResult({
          url,
          originalBytes: origSize,
          compressedBytes: compSize,
          reducedPercent: Math.round(pctSaved),
          isReduced: compSize < origSize,
          engine: engineHdr,
        });
        setIsProcessing(false);
        return;
      }
    } catch {
      // Backend is unreachable or network error; proceed cleanly to client-side fallback
    }

    // 2. Client-side fallback: Rebuild document with cleaned object streams & re-encoded structures
    try {
      const buffer = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const optimizedDoc = await PDFDocument.create();

      // Copy pages cleanly to strip unreferenced streams and revision bloat
      const copiedPages = await optimizedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      copiedPages.forEach((p) => optimizedDoc.addPage(p));

      // Save using object streams compression for maximal client-side compaction
      const optimizedBytes = await optimizedDoc.save({ useObjectStreams: true });
      const newSizeBytes = optimizedBytes.length;

      // Honest calculation - never fake numbers
      const isSmaller = newSizeBytes < originalBytes;
      const diff = originalBytes - newSizeBytes;
      const percentReduction = isSmaller
        ? Math.round((diff / originalBytes) * 100)
        : 0;

      // If optimized version is smaller, deliver optimizedBytes; otherwise deliver the original buffer
      const finalBytes = isSmaller ? optimizedBytes : new Uint8Array(buffer);
      const blob = new Blob([finalBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      setResult({
        url,
        originalBytes,
        compressedBytes: isSmaller ? newSizeBytes : originalBytes,
        reducedPercent: percentReduction,
        isReduced: isSmaller && percentReduction > 0,
        engine: 'Client-side Safe Stream Compressor',
      });
    } catch {
      setErrorMessage('Could not compress the PDF. Please check if the file is encrypted or corrupted.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    if (result?.url) {
      URL.revokeObjectURL(result.url);
    }
    setFile(null);
    setTotalPages(0);
    setResult(null);
    setErrorMessage(null);
  };

  const handleDownload = () => {
    if (!result || !file) return;
    const a = document.createElement('a');
    a.href = result.url;
    const baseName = file.name.replace(/\.pdf$/i, '');
    a.download = `${baseName}_compressed.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="compress-pdf-page">
      <div className="container">
        {/* Navigation Bar */}
        <div className="tool-top-bar">
          <button 
            type="button" 
            className="tool-back-btn" 
            onClick={onBack}
            aria-label="Back to all tools"
          >
            <ArrowLeft size={16} />
            <span>All Tools</span>
          </button>
          <div className="tool-badge-pill tool-badge-compress">Compress PDF</div>
        </div>

        {/* Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Compress PDF Document</h1>
          <p className="tool-main-subtitle">
            Optimize and reduce PDF file size while maintaining document structure and readability.
          </p>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="tool-alert-banner error" role="alert">
            <AlertCircle size={18} className="tool-alert-icon" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          id="compress-pdf-input"
        />

        {/* COMPLETED / DOWNLOAD STATE */}
        {result && file ? (
          <div className="merge-result-card">
            <div className="result-icon-box" style={{ backgroundColor: '#dcfce7' }}>
              <CheckCircle2 size={36} color="#16a34a" />
            </div>

            <h2 className="result-title">
              {result.isReduced ? 'PDF has been compressed!' : 'PDF optimization complete!'}
            </h2>

            {result.isReduced ? (
              <p className="result-desc">
                Your PDF file is now <strong>{result.reducedPercent}% smaller</strong>!
              </p>
            ) : (
              <p className="result-desc">
                This document is already highly optimized and could not be compressed further.
              </p>
            )}

            {/* Comparison Metrics Cards */}
            <div className="compress-comparison-card">
              <div className="compress-metric">
                <span className="compress-metric-label">Original Size</span>
                <span className="compress-metric-value">{formatFileSize(result.originalBytes)}</span>
              </div>

              <div className="compress-metric-arrow">
                <ArrowDown size={20} />
              </div>

              <div className="compress-metric highlight">
                <span className="compress-metric-label">New Size</span>
                <span className="compress-metric-value">{formatFileSize(result.compressedBytes)}</span>
              </div>

              {result.isReduced && (
                <div className="compress-badge-savings">
                  -{result.reducedPercent}%
                </div>
              )}
            </div>

            {!result.isReduced && (
              <div className="compress-info-banner">
                <Info size={16} />
                <span>
                  The file was cleaned and re-streamed safely, but was already near maximum compression.
                </span>
              </div>
            )}

            {result.engine && (
              <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: '#64748b' }}>
                Engine: <strong style={{ color: '#0f172a' }}>{result.engine}</strong>
              </div>
            )}

            <div className="result-actions">
              <button 
                type="button" 
                className="btn-download-main" 
                onClick={handleDownload}
              >
                <Download size={18} />
                <span>Download Compressed PDF</span>
              </button>
              <button 
                type="button" 
                className="btn-reset-secondary" 
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                <span>Compress Another PDF</span>
              </button>
            </div>
          </div>
        ) : !file ? (
          /* INITIAL UPLOAD STATE */
          <div
            className={`upload-dropzone ${isDraggingOver ? 'dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload PDF file to compress"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="upload-icon-circle upload-icon-compress">
              <Upload size={32} />
            </div>
            <h3 className="upload-prompt-title">Select a PDF file</h3>
            <p className="upload-prompt-subtitle">
              or drop PDF here
            </p>
            <button 
              type="button" 
              className="btn-select-files btn-select-compress"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Choose PDF File
            </button>
          </div>
        ) : (
          /* READY TO COMPRESS STATE */
          <div className="compress-workspace-card">
            {/* File Info Bar */}
            <div className="split-file-header">
              <div className="split-file-info">
                <div className="split-file-icon-box" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="split-file-name" title={file.name}>
                    {file.name}
                  </h3>
                  <div className="split-file-meta">
                    <span>{formatFileSize(file.size)}</span>
                    <span className="dot-sep">•</span>
                    <span className="compress-page-count-badge">
                      {totalPages} {totalPages === 1 ? 'page' : 'pages'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn-change-file"
                onClick={() => fileInputRef.current?.click()}
                title="Select a different PDF"
              >
                Change File
              </button>
            </div>

            {/* Compression Level Selector */}
            <div className="compress-level-section">
              <h4 className="compress-level-heading">Compression Level</h4>
              <div className="compress-level-grid">
                <div
                  className={`compress-level-card ${level === 'extreme' ? 'active' : ''}`}
                  onClick={() => setLevel('extreme')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setLevel('extreme')}
                >
                  <div className="compress-level-title">
                    <span>Extreme</span>
                  </div>
                  <p className="compress-level-desc">
                    Maximum size reduction. Downsamples high-res imagery for compact sharing.
                  </p>
                </div>

                <div
                  className={`compress-level-card ${level === 'recommended' ? 'active' : ''}`}
                  onClick={() => setLevel('recommended')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setLevel('recommended')}
                >
                  <div className="compress-level-title">
                    <span>Recommended</span>
                    <span className="compress-level-badge">Default</span>
                  </div>
                  <p className="compress-level-desc">
                    Optimal balance between reduced file size and document visual clarity.
                  </p>
                </div>

                <div
                  className={`compress-level-card ${level === 'low' ? 'active' : ''}`}
                  onClick={() => setLevel('low')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setLevel('low')}
                >
                  <div className="compress-level-title">
                    <span>Low</span>
                  </div>
                  <p className="compress-level-desc">
                    High visual quality with lighter compression for print and archival.
                  </p>
                </div>
              </div>
            </div>

            {/* Information notice */}
            <div className="compress-notice-box">
              <div className="compress-notice-title">
                <Minimize2 size={18} />
                <span>Multi-tier Engine Compression</span>
              </div>
              <p className="compress-notice-text">
                Your PDF is processed using high-performance stream deflation and object optimization with automatic client-side fallback. Unused streams and structural bloat are purged safely.
              </p>
            </div>

            {/* Action Bar */}
            <div className="split-action-bar">
              <button
                type="button"
                className="btn-compress-action"
                disabled={isProcessing}
                onClick={handleCompress}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={18} className="spinner-icon" />
                    <span>Compressing PDF...</span>
                  </>
                ) : (
                  <>
                    <Minimize2 size={18} />
                    <span>Compress PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
