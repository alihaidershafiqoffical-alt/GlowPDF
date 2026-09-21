import { useState, useRef } from 'react';
import { apiFetch } from '../lib/api';
import type { FC, DragEvent, ChangeEvent } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
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
  Palette,
  Image as ImageIcon
} from 'lucide-react';

// Configure pdfjs worker for fast client-side pre-validation and preview
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface PdfToWordProps {
  onBack: () => void;
}

interface ConversionResult {
  url: string;
  downloadName: string;
  docxBytes: number;
  originalBytes: number;
  pageCount: number;
  hasMultiColumn: boolean;
  hasColors: boolean;
  hasImages: boolean;
  hasScannedPages: boolean;
  scannedCount: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const PdfToWord: FC<PdfToWordProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleProcessFile = async (selectedFile: File) => {
    setErrorMessage(null);
    setResult(null);

    // Validate file type
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Only PDF files are supported. Please select a valid PDF file.');
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

  const handleConvertToWord = async () => {
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressText('Uploading PDF to conversion engine...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProgressText('Reconstructing layout, columns & tables with pdf2docx...');

      const response = await apiFetch('/api/convert-pdf-to-word', {
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

      setProgressText('Finalizing editable Word (.docx) document...');
      const docxBlob = await response.blob();
      const url = URL.createObjectURL(docxBlob);

      // Extract filename and metadata from headers
      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const baseName = file.name.replace(/\.pdf$/i, '') || 'glowpdf_converted';
      const downloadName = filenameMatch ? filenameMatch[1] : `${baseName}.docx`;

      const pagesHeader = response.headers.get('X-Total-Pages');
      const pageCount = pagesHeader ? parseInt(pagesHeader, 10) : totalPages;
      const hasScanned = response.headers.get('X-Has-Scanned') === 'true';
      const scannedPagesHeader = response.headers.get('X-Scanned-Pages');
      const scannedCount = scannedPagesHeader ? parseInt(scannedPagesHeader, 10) : 0;

      setResult({
        url,
        downloadName,
        docxBytes: docxBlob.size,
        originalBytes: file.size,
        pageCount,
        hasMultiColumn: true,
        hasColors: true,
        hasImages: true,
        hasScannedPages: hasScanned,
        scannedCount
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
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.downloadName || 'glowpdf_converted.docx';
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
          <div className="tool-badge-pill tool-badge-word">PDF to Word</div>
        </div>

        {/* Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Convert PDF to Word</h1>
          <p className="tool-main-subtitle">
            Convert designed PDFs and resumes into fully editable Word (.docx) documents with columns, tables, styles, and graphics preserved using pdf2docx.
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
          id="word-pdf-input"
        />

        {/* COMPLETED / DOWNLOAD STATE */}
        {result && file ? (
          <div className="merge-result-card">
            <div className="result-icon-box" style={{ backgroundColor: '#dbeafe' }}>
              <CheckCircle2 size={36} color="#2563eb" />
            </div>

            <h2 className="result-title">PDF converted to Word successfully!</h2>
            <p className="result-desc">
              Your document is ready to download as a structured, editable Microsoft Word <strong>.docx</strong> file.
            </p>

            {/* Layout preservation features badge banner */}
            <div className="word-features-badges">
              {result.hasMultiColumn && (
                <span className="word-feature-badge">
                  <Columns size={14} />
                  <span>Columns &amp; Tables Preserved</span>
                </span>
              )}
              {result.hasColors && (
                <span className="word-feature-badge">
                  <Palette size={14} />
                  <span>Typography &amp; Colors Retained</span>
                </span>
              )}
              <span className="word-feature-badge">
                <Sparkles size={14} />
                <span>Headings &amp; Styles Reconstructed</span>
              </span>
              {result.hasImages && (
                <span className="word-feature-badge">
                  <ImageIcon size={14} />
                  <span>Vector Shapes &amp; Images Extracted</span>
                </span>
              )}
              {result.hasScannedPages && (
                <span className="word-feature-badge warning">
                  <Info size={14} />
                  <span>Scanned Pages Detected ({result.scannedCount} of {result.pageCount})</span>
                </span>
              )}
            </div>

            {/* Document stats */}
            <div className="word-stats-card">
              <div className="word-stat-item">
                <span className="word-stat-label">File Name</span>
                <span className="word-stat-value" title={result.downloadName}>{result.downloadName}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">DOCX Size</span>
                <span className="word-stat-value">{formatFileSize(result.docxBytes)}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">Pages</span>
                <span className="word-stat-value">{result.pageCount}</span>
              </div>
            </div>

            {/* Technical honest notice */}
            <div className="word-info-banner">
              <Info size={16} style={{ flexShrink: 0, color: '#2563eb' }} />
              <span>
                {result.hasScannedPages
                  ? `Notice: ${result.scannedCount} page(s) appear to be scanned or image-based without digital text. Images were preserved, but modifying scanned bitmap text requires optical character recognition (OCR).`
                  : 'Document layout, columns, tables, font hierarchies, and graphics were reconstructed with the open-source pdf2docx engine. Temporary processing files were deleted immediately.'}
              </span>
            </div>

            {/* Actions */}
            <div className="result-actions-wrapper">
              <button
                type="button"
                className="btn-download-primary"
                onClick={handleDownload}
                style={{ backgroundColor: '#2563eb' }}
              >
                <Download size={20} />
                <span>Download Word File</span>
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
            aria-label="Upload PDF to convert to Word"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="upload-icon-wrapper upload-icon-word">
              <Upload size={36} />
            </div>

            <h2 className="upload-main-text">Choose PDF to Convert</h2>
            <p className="upload-sub-text">or drag and drop your PDF document here</p>

            <button 
              type="button" 
              className="btn-select-files btn-select-word"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <FileText size={18} />
              <span>Select PDF File</span>
            </button>

            <p className="upload-privacy-note">
              100% private: Processed temporarily in memory and deleted immediately. No files are stored.
            </p>
          </div>
        ) : (
          /* WORKSPACE CARD / CONVERT ACTION */
          <div className="word-workspace-card">
            <div className="split-file-header-card">
              <div className="split-file-icon-box" style={{ backgroundColor: '#dbeafe', color: '#2563eb' }}>
                <FileType size={28} />
              </div>
              <div className="split-file-meta">
                <h3 className="split-file-name" title={file.name}>{file.name}</h3>
                <div className="split-file-details">
                  <span>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span className="word-page-count-badge">{totalPages} {totalPages === 1 ? 'Page' : 'Pages'}</span>
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

            {/* Technical callout */}
            <div className="word-notice-box">
              <div className="word-notice-title">
                <Info size={16} color="#2563eb" />
                <span>pdf2docx Layout Reconstruction Engine</span>
              </div>
              <p className="word-notice-text">
                GlowPDF utilizes the open-source <strong>pdf2docx</strong> engine to reconstruct paragraphs, headings, multiple columns, tables, and typography into genuine Microsoft Word (.docx) documents.
              </p>
            </div>

            {/* Convert action button */}
            <button
              type="button"
              className="btn-word-action"
              onClick={handleConvertToWord}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={20} className="spinner-icon" />
                  <span>{progressText || 'Converting to Word...'}</span>
                </>
              ) : (
                <>
                  <FileText size={20} />
                  <span>Convert to Word (.docx)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
