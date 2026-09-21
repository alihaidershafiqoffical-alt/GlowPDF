import { useState, useRef } from 'react';
import { apiFetch } from '../lib/api';
import type { FC, DragEvent, ChangeEvent } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  Archive, 
  Download, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  Loader2, 
  ShieldCheck, 
  Sparkles,
  Info,
  FileCheck,
  Award
} from 'lucide-react';

// Configure pdfjs worker for fast client-side pre-validation and preview
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface PdfToPdfaProps {
  onBack: () => void;
}

interface ConversionResult {
  url: string;
  downloadName: string;
  pdfBytes: number;
  originalBytes: number;
  standard: string;
  engine: string;
  pageCount: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const PdfToPdfa: FC<PdfToPdfaProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [standard, setStandard] = useState<string>('PDF/A-2b');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleProcessFile = async (selectedFile: File) => {
    setErrorMessage(null);
    setResult(null);

    if (!selectedFile.name.toLowerCase().endsWith('.pdf') && selectedFile.type !== 'application/pdf') {
      setErrorMessage('Only PDF files (.pdf) are supported. Please select a valid PDF document.');
      return;
    }

    if (selectedFile.size === 0) {
      setErrorMessage('The selected PDF file is empty.');
      return;
    }

    try {
      const buffer = await selectedFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdf = await loadingTask.promise;
      const count = pdf.numPages;

      if (count < 1) {
        setErrorMessage('The selected PDF contains no pages.');
        return;
      }

      setFile(selectedFile);
      setTotalPages(count);
    } catch {
      // Fallback if pdfjs parsing fails on certain complex PDFs
      setFile(selectedFile);
      setTotalPages(1);
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

  const handleConvertToPdfa = async () => {
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressText('Uploading PDF document to conversion engine...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('standard', standard);

      setProgressText('Validating ISO color profiles, font embeddings & XMP metadata...');

      const response = await apiFetch('/api/convert-pdf-to-pdfa', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errDetail = 'Conversion failed.';
        try {
          const errJson = await response.json();
          if (errJson && errJson.detail) {
            errDetail = errJson.detail;
          }
        } catch {
          errDetail = `Server returned an error (${response.status}: ${response.statusText})`;
        }
        throw new Error(errDetail);
      }

      setProgressText('Finalizing ISO archival PDF/A document...');
      const pdfBlob = await response.blob();
      const url = URL.createObjectURL(pdfBlob);

      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const baseName = file.name.replace(/\.pdf$/i, '') || 'archival_document';
      const downloadName = filenameMatch ? filenameMatch[1] : `${baseName}_PDFA.pdf`;

      const stdHeader = response.headers.get('X-PDFA-Standard') || standard;
      const engineHeader = response.headers.get('X-Engine') || 'PyMuPDF Archival Engine';

      setResult({
        url,
        downloadName,
        pdfBytes: pdfBlob.size,
        originalBytes: file.size,
        standard: stdHeader,
        engine: engineHeader,
        pageCount: totalPages || 1
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Conversion failed.';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
      setProgressText('');
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
    setIsProcessing(false);
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.downloadName || 'archival_document_PDFA.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="pdf-to-word-page">
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
          <div className="tool-badge-pill tool-badge-pdfa">
            <Archive size={14} className="mr-1 inline" />
            <span>PDF to PDF/A</span>
          </div>
        </div>

        {/* Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Convert PDF to PDF/A</h1>
          <p className="tool-main-subtitle">
            Transform standard PDF documents into ISO-compliant archival PDF/A files for long-term digital preservation and legal compliance.
          </p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="tool-alert-banner error" role="alert">
            <AlertCircle size={18} className="tool-alert-icon" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          id="pdfa-input"
        />

        {/* COMPLETED / DOWNLOAD STATE */}
        {result && file ? (
          <div className="merge-result-card">
            <div className="result-icon-box" style={{ backgroundColor: '#fef3c7' }}>
              <CheckCircle2 size={36} color="#d97706" />
            </div>

            <h2 className="result-title">Archival PDF/A Created Successfully!</h2>
            <p className="result-desc">
              Your document has been transformed into standard <strong>{result.standard}</strong> with embedded fonts and device-independent color spaces.
            </p>

            {/* Badges Banner */}
            <div className="word-features-badges">
              <span className="word-feature-badge" style={{ backgroundColor: '#fef3c7', color: '#b45309', borderColor: '#fde68a' }}>
                <ShieldCheck size={14} />
                <span>ISO Standard Compliant ({result.standard})</span>
              </span>
              <span className="word-feature-badge">
                <FileCheck size={14} />
                <span>Device-Independent Color &amp; XMP Metadata</span>
              </span>
              <span className="word-feature-badge">
                <Award size={14} />
                <span>Font Embedding &amp; Device Neutrality</span>
              </span>
            </div>

            {/* Stats */}
            <div className="word-stats-card">
              <div className="word-stat-item">
                <span className="word-stat-label">File Name</span>
                <span className="word-stat-value" title={result.downloadName}>{result.downloadName}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">Archival Size</span>
                <span className="word-stat-value">{formatFileSize(result.pdfBytes)}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">Pages</span>
                <span className="word-stat-value">{result.pageCount}</span>
              </div>
            </div>

            {/* Info Notice */}
            <div className="word-info-banner">
              <Info size={16} style={{ flexShrink: 0, color: '#d97706' }} />
              <span>
                ISO Archival Notice: PDF/A guarantees long-term readability by restricting device-dependent features, embedding all fonts, and enforcing standardized color profiles.
              </span>
            </div>

            {/* Actions */}
            <div className="result-actions-wrapper">
              <button
                type="button"
                className="btn-download-primary btn-pdfa-action"
                onClick={handleDownload}
              >
                <Download size={20} />
                <span>Download PDF/A Document</span>
              </button>

              <button
                type="button"
                className="btn-restart-action"
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                <span>Convert Another PDF</span>
              </button>
            </div>
          </div>
        ) : !file ? (
          /* UPLOAD DROPZONE */
          <div 
            className={`file-upload-dropzone ${isDraggingOver ? 'dragging-over' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload PDF to convert to PDF/A"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="upload-icon-wrapper upload-icon-pdfa">
              <Archive size={36} />
            </div>

            <h2 className="upload-main-text">Choose PDF to Convert</h2>
            <p className="upload-sub-text">or drag and drop your PDF document here</p>

            <button 
              type="button" 
              className="btn-select-files btn-select-pdfa"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Archive size={18} />
              <span>Select PDF File</span>
            </button>

            <p className="upload-privacy-note">
              100% private: Standardized in-memory and deleted immediately. No files are stored.
            </p>
          </div>
        ) : (
          /* WORKSPACE CARD / CONVERT ACTION */
          <div className="word-workspace-card">
            <div className="split-file-header-card">
              <div className="split-file-icon-box" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>
                <Archive size={28} />
              </div>
              <div className="split-file-meta">
                <h3 className="split-file-name" title={file.name}>{file.name}</h3>
                <div className="split-file-details">
                  <span>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span className="pdfa-page-count-badge">{totalPages} {totalPages === 1 ? 'Page' : 'Pages'}</span>
                </div>
              </div>
              <button 
                type="button" 
                className="btn-change-file"
                onClick={handleReset}
                title="Choose a different PDF"
              >
                Change
              </button>
            </div>

            {/* Standard Selection */}
            <div style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.75rem' }}>
                <ShieldCheck size={18} style={{ color: '#d97706', marginRight: '0.5rem' }} />
                Select ISO PDF/A Archival Standard
              </label>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {[
                  { id: 'PDF/A-2b', name: 'PDF/A-2b (Recommended)', desc: 'Modern ISO 19005-2 standard with transparency & font embedding' },
                  { id: 'PDF/A-1b', name: 'PDF/A-1b', desc: 'Basic ISO 19005-1 visual preservation standard' },
                  { id: 'PDF/A-3b', name: 'PDF/A-3b', desc: 'ISO 19005-3 allows embedded external attachments' }
                ].map((std) => {
                  const isSelected = standard === std.id;
                  return (
                    <button
                      key={std.id}
                      type="button"
                      onClick={() => setStandard(std.id)}
                      style={{
                        padding: '0.875rem 1rem',
                        borderRadius: '0.5rem',
                        border: isSelected ? '1px solid #d97706' : '1px solid #334155',
                        backgroundColor: isSelected ? 'rgba(217, 119, 6, 0.12)' : 'rgba(30, 41, 59, 0.5)',
                        color: isSelected ? '#ffffff' : '#cbd5e1',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: isSelected ? '#fbbf24' : '#f8fafc' }}>
                        {std.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem', lineHeight: '1.35' }}>
                        {std.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Feature callout */}
            <div className="word-notice-box">
              <div className="word-notice-title">
                <Info size={16} color="#d97706" />
                <span>GlowPDF ISO Archival Conversion Engine</span>
              </div>
              <p className="word-notice-text">
                Ensures long-term archiving compliance by enforcing device-neutral colors, embedding required fonts, and removing disallowed dynamic features (JavaScript, external actions).
              </p>
            </div>

            {/* Convert action button */}
            <button
              type="button"
              className="btn-word-action btn-pdfa-action"
              onClick={handleConvertToPdfa}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={20} className="spinner-icon" />
                  <span>{progressText || 'Converting to PDF/A...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  <span>Convert to {standard}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};