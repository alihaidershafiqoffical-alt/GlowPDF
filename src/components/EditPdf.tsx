import { useState, useRef, useCallback, useEffect } from 'react';
import type { FC, DragEvent, ChangeEvent } from 'react';
import {
  Upload,
  FileText,
  Download,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  FileEdit,
  Sparkles,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { PdfEditor } from './edit-pdf/PdfEditor';

interface EditPdfProps {
  onBack: () => void;
}

interface ExportResult {
  url: string;
  filename: string;
  totalBytes: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const EditPdf: FC<EditPdfProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  // Cleanup object URLs on unmount
  const cleanupObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  }, []);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'PDF Editor — GlowPDF';
    return () => {
      document.title = prevTitle;
      cleanupObjectUrls();
    };
  }, [cleanupObjectUrls]);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.pdf') && selectedFile.type !== 'application/pdf') {
      setErrorMessage('Please upload a valid PDF document.');
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 50 MB limit.');
      return;
    }

    setErrorMessage(null);
    setExportResult(null);
    setFile(selectedFile);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
    e.target.value = '';
  };

  const handleExportSuccess = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.push(url);
    setExportResult({
      url,
      filename,
      totalBytes: blob.size,
    });
  };

  const handleStartNewEdit = () => {
    cleanupObjectUrls();
    setFile(null);
    setExportResult(null);
    setErrorMessage(null);
  };

  const handleContinueEditing = () => {
    setExportResult(null);
  };

  return (
    <>
      {file && !exportResult ? (
        /* ACTIVE PDF EDITOR STUDIO */
        <div className="tool-editor-wrapper">
          <PdfEditor
            file={file}
            onBack={handleStartNewEdit}
            onExportSuccess={handleExportSuccess}
            onError={(msg) => setErrorMessage(msg)}
          />
        </div>
      ) : (
        /* TOOL CONTAINER FOR PRE-UPLOAD & SUCCESS STATES */
        <div className="merge-pdf-page">
          <div className="container">
            {/* Top Navigation Bar */}
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
              <div className="tool-badge-pill" style={{ color: '#4f46e5', backgroundColor: '#eef2ff' }}>
                PDF Editor
              </div>
            </div>

            {/* Main Header */}
            <div className="tool-main-header">
              <h1 className="tool-main-title">PDF Editor</h1>
              <p className="tool-main-subtitle">
                Add text, draw, insert shapes & images, annotate, and sanitize sensitive data with permanent redaction.
              </p>
            </div>

            {/* Error Notification Banner */}
            {errorMessage && (
              <div className="tool-alert-banner error" role="alert">
                <AlertCircle size={18} className="tool-alert-icon" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleInputChange}
              style={{ display: 'none' }}
              id="edit-pdf-input"
            />

            {/* DOWNLOAD / SUCCESS STATE */}
            {exportResult ? (
              <div className="merge-result-card">
                <div className="result-icon-box">
                  <CheckCircle2 size={36} color="#16a34a" />
                </div>
                <h2 className="result-title">Your PDF has been edited!</h2>
                <p className="result-desc">
                  All text edits, annotations, images, and permanent redactions were successfully applied and saved.
                </p>

                <div
                  className="result-file-info"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    margin: '20px 0',
                    padding: '12px 20px',
                    backgroundColor: 'var(--bg-app, #f8fafc)',
                    borderRadius: 'var(--radius-md, 8px)',
                    border: '1px solid var(--border-light, #e2e8f0)',
                  }}
                >
                  <FileText size={24} style={{ color: 'var(--brand-primary, #6366f1)', flexShrink: 0 }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{exportResult.filename}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>{formatFileSize(exportResult.totalBytes)}</div>
                  </div>
                </div>

                <div className="result-actions" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                  <a
                    href={exportResult.url}
                    download={exportResult.filename}
                    className="btn-download-main"
                    style={{ textDecoration: 'none' }}
                  >
                    <Download size={18} />
                    <span>Download Edited PDF</span>
                  </a>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="btn-reset-secondary"
                      onClick={handleContinueEditing}
                    >
                      <FileEdit size={16} />
                      <span>Continue Editing</span>
                    </button>
                    <button
                      type="button"
                      className="btn-reset-secondary"
                      onClick={handleStartNewEdit}
                    >
                      <RotateCcw size={16} />
                      <span>Edit Another PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* UPLOAD DROPZONE STATE */
              <>
                <div
                  className={`upload-dropzone ${isDraggingOver ? 'dragging' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload PDF file to edit"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <div className="upload-icon-circle">
                    <Upload size={32} />
                  </div>
                  <h3 className="upload-prompt-title">Select PDF file</h3>
                  <p className="upload-prompt-subtitle">or drop PDF file here</p>

                  <button
                    type="button"
                    className="btn-select-files"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    Select PDF file
                  </button>
                </div>

                {/* Features Highlights */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '20px',
                    maxWidth: '850px',
                    margin: '48px auto 0',
                  }}
                >
                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface, #ffffff)',
                      border: '1px solid var(--border-light, #e2e8f0)',
                      borderRadius: 'var(--radius-lg, 12px)',
                      padding: '24px',
                      textAlign: 'center',
                      boxShadow: 'var(--shadow-xs, 0 1px 2px 0 rgba(0,0,0,0.05))',
                    }}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: 'var(--radius-md, 8px)',
                        backgroundColor: 'var(--brand-light, #eeeffe)',
                        color: 'var(--brand-primary, #6366f1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                      }}
                    >
                      <Sparkles size={24} />
                    </div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: '8px' }}>
                      Edit & Add Objects
                    </h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary, #475569)', lineHeight: 1.5 }}>
                      Directly modify text, add rich vector text boxes, shapes, drawings, and images.
                    </p>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface, #ffffff)',
                      border: '1px solid var(--border-light, #e2e8f0)',
                      borderRadius: 'var(--radius-lg, 12px)',
                      padding: '24px',
                      textAlign: 'center',
                      boxShadow: 'var(--shadow-xs, 0 1px 2px 0 rgba(0,0,0,0.05))',
                    }}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: 'var(--radius-md, 8px)',
                        backgroundColor: '#fef3c7',
                        color: '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                      }}
                    >
                      <ShieldCheck size={24} />
                    </div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: '8px' }}>
                      Permanent Redaction
                    </h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary, #475569)', lineHeight: 1.5 }}>
                      Sanitize sensitive text and images permanently so data cannot be recovered.
                    </p>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface, #ffffff)',
                      border: '1px solid var(--border-light, #e2e8f0)',
                      borderRadius: 'var(--radius-lg, 12px)',
                      padding: '24px',
                      textAlign: 'center',
                      boxShadow: 'var(--shadow-xs, 0 1px 2px 0 rgba(0,0,0,0.05))',
                    }}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: 'var(--radius-md, 8px)',
                        backgroundColor: '#dcfce7',
                        color: '#16a34a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                      }}
                    >
                      <Zap size={24} />
                    </div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: '8px' }}>
                      Vector Export
                    </h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary, #475569)', lineHeight: 1.5 }}>
                      Clean rendering and vector burning ensures documents remain crisp and compact.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
