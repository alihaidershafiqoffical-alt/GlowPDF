import { useState, useRef } from 'react';
import { apiFetch } from '../lib/api';
import type { FC, DragEvent, ChangeEvent } from 'react';
import { 
  Upload, 
  FileText, 
  Download, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  Loader2, 
  Info, 
  FileType, 
  Columns, 
  Sparkles, 
  Table 
} from 'lucide-react';

interface WordToPdfProps {
  onBack: () => void;
}

interface ConversionResult {
  url: string;
  downloadName: string;
  pdfBytes: number;
  originalBytes: number;
  pageCount: number;
  paragraphs: number;
  tables: number;
  hasTables: boolean;
  hasHeadings: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const WordToPdf: FC<WordToPdfProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleProcessFile = (selectedFile: File) => {
    setErrorMessage(null);
    setResult(null);

    const isDocx = selectedFile.name.toLowerCase().endsWith('.docx') || 
      selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (!isDocx) {
      setErrorMessage('Only Microsoft Word (.docx) documents are supported. Please choose a valid .docx file.');
      return;
    }

    if (selectedFile.size === 0) {
      setErrorMessage('The selected Word document is empty.');
      return;
    }

    setFile(selectedFile);
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

  const handleConvertToPdf = async () => {
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressText('Uploading Word document to conversion engine...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProgressText('Reconstructing headings, styling, tables & paragraphs...');

      const response = await apiFetch('/api/convert-word-to-pdf', {
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
          errDetail = `Server error (${response.status}: ${response.statusText})`;
        }
        throw new Error(errDetail);
      }

      setProgressText('Generating standardized PDF document...');
      const pdfBlob = await response.blob();
      const url = URL.createObjectURL(pdfBlob);

      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const baseName = file.name.replace(/\.docx$/i, '') || 'glowpdf_converted';
      const downloadName = filenameMatch ? filenameMatch[1] : `${baseName}.pdf`;

      const pagesHeader = response.headers.get('X-Total-Pages');
      const pageCount = pagesHeader ? parseInt(pagesHeader, 10) : 1;

      const paragraphsHeader = response.headers.get('X-Paragraphs');
      const paragraphs = paragraphsHeader ? parseInt(paragraphsHeader, 10) : 0;

      const tablesHeader = response.headers.get('X-Tables');
      const tables = tablesHeader ? parseInt(tablesHeader, 10) : 0;

      const hasTables = response.headers.get('X-Has-Tables') === 'true' || tables > 0;
      const hasHeadings = response.headers.get('X-Has-Headings') === 'true';

      setResult({
        url,
        downloadName,
        pdfBytes: pdfBlob.size,
        originalBytes: file.size,
        pageCount,
        paragraphs,
        tables,
        hasTables,
        hasHeadings,
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred during Word to PDF conversion.'
      );
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const handleReset = () => {
    if (result && result.url) {
      URL.revokeObjectURL(result.url);
    }
    setFile(null);
    setResult(null);
    setErrorMessage(null);
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.downloadName || 'glowpdf_converted.pdf';
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
          <div className="tool-badge-pill tool-badge-word" style={{ backgroundColor: '#e0f2fe', color: '#0284c7' }}>
            Word to PDF
          </div>
        </div>

        {/* Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Convert Word to PDF</h1>
          <p className="tool-main-subtitle">
            Convert Microsoft Word (.docx) documents into professional, high-grade PDF files with headings, tables, formatting, and page structure preserved.
          </p>
        </div>

        {/* Error banner */}
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
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: 'none' }}
          id="word-to-pdf-input"
        />

        {/* COMPLETED / DOWNLOAD STATE */}
        {result && file ? (
          <div className="merge-result-card">
            <div className="result-icon-box" style={{ backgroundColor: '#e0f2fe' }}>
              <CheckCircle2 size={36} color="#0284c7" />
            </div>

            <h2 className="result-title">Word document converted to PDF successfully!</h2>
            <p className="result-desc">
              Your document is ready to download as a standardized, print-ready PDF file.
            </p>

            {/* Layout preservation features badge banner */}
            <div className="word-features-badges">
              {result.hasTables && (
                <span className="word-feature-badge">
                  <Table size={14} />
                  <span>Tables &amp; Grids Formatted ({result.tables})</span>
                </span>
              )}
              {result.hasHeadings && (
                <span className="word-feature-badge">
                  <Columns size={14} />
                  <span>Headings &amp; Typography Retained</span>
                </span>
              )}
              <span className="word-feature-badge">
                <Sparkles size={14} />
                <span>Text, Styles &amp; Alignment Preserved</span>
              </span>
            </div>

            {/* Document stats */}
            <div className="word-stats-card">
              <div className="word-stat-item">
                <span className="word-stat-label">File Name</span>
                <span className="word-stat-value" title={result.downloadName}>{result.downloadName}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">PDF Size</span>
                <span className="word-stat-value">{formatFileSize(result.pdfBytes)}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">Pages</span>
                <span className="word-stat-value">{result.pageCount}</span>
              </div>
            </div>

            {/* Privacy notice */}
            <div className="word-info-banner">
              <Info size={16} style={{ flexShrink: 0, color: '#0284c7' }} />
              <span>
                100% private: Converted in memory and temporary files deleted immediately. No document data is stored.
              </span>
            </div>

            {/* Actions */}
            <div className="result-actions-wrapper">
              <button
                type="button"
                className="btn-download-primary"
                onClick={handleDownload}
                style={{ backgroundColor: '#0284c7' }}
              >
                <Download size={20} />
                <span>Download PDF File</span>
              </button>

              <button
                type="button"
                className="btn-restart-action"
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                <span>Convert Another Word Document</span>
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
            aria-label="Upload Word document to convert to PDF"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="upload-icon-wrapper upload-icon-word" style={{ backgroundColor: '#e0f2fe', color: '#0284c7' }}>
              <Upload size={36} />
            </div>

            <h2 className="upload-main-text">Choose Word (.docx) to Convert</h2>
            <p className="upload-sub-text">or drag and drop your Microsoft Word document here</p>

            <button 
              type="button" 
              className="btn-select-files btn-select-word"
              style={{ backgroundColor: '#0284c7' }}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <FileText size={18} />
              <span>Select Word Document</span>
            </button>

            <p className="upload-privacy-note">
              100% private: Processed temporarily in memory and deleted immediately. No files are stored.
            </p>
          </div>
        ) : (
          /* WORKSPACE CARD / CONVERT ACTION */
          <div className="word-workspace-card">
            <div className="split-file-header">
              <div className="split-file-info">
                <div className="split-file-icon-box" style={{ backgroundColor: '#e0f2fe', color: '#0284c7' }}>
                  <FileType size={28} />
                </div>
                <div className="split-file-meta">
                  <h3 className="split-file-name" title={file.name}>{file.name}</h3>
                  <div className="split-file-details">
                    <span>{formatFileSize(file.size)}</span>
                    <span>•</span>
                    <span className="word-page-count-badge" style={{ backgroundColor: '#e0f2fe', color: '#0284c7' }}>
                      Word Document (.docx)
                    </span>
                  </div>
                </div>
              </div>
              <button 
                type="button" 
                className="btn-change-file"
                onClick={handleReset}
                title="Choose a different Word document"
              >
                Change
              </button>
            </div>

            {/* Technical callout */}
            <div className="word-notice-box">
              <div className="word-notice-title">
                <Info size={16} color="#0284c7" />
                <span>Word to PDF Document Engine</span>
              </div>
              <p className="word-notice-text">
                GlowPDF reconstructs headings, paragraphs, typography, tables, and alignment into a genuine standardized PDF with zero file retention.
              </p>
            </div>

            {/* Convert action button */}
            <button
              type="button"
              className="btn-word-action"
              style={{ backgroundColor: '#0284c7' }}
              onClick={handleConvertToPdf}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={20} className="spinner-icon" />
                  <span>{progressText || 'Converting to PDF...'}</span>
                </>
              ) : (
                <>
                  <FileText size={20} />
                  <span>Convert to PDF</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
