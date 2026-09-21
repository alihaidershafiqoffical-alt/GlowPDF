import { useState, useRef, useEffect, useCallback } from 'react';
import type { FC, DragEvent, ChangeEvent } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  FileText, 
  Download, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  Loader2, 
  Trash2, 
  Layers, 
  Check, 
  CheckSquare, 
  Square, 
  RefreshCw 
} from 'lucide-react';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface DeletePagesProps {
  onBack: () => void;
}

interface PageThumbnail {
  pageNumber: number;
  dataUrl?: string;
  isLoading: boolean;
}

interface ProcessResult {
  url: string;
  filename: string;
  totalBytes: number;
  pageCount: number;
  operation: 'delete' | 'extract';
  affectedCount: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const DeletePages: FC<DeletePagesProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState<string>('');

  const [result, setResult] = useState<ProcessResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const fileBufferRef = useRef<ArrayBuffer | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const cleanupObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      cleanupObjectUrls();
    };
  }, [cleanupObjectUrls]);

  // Render thumbnails using pdfjs-dist
  useEffect(() => {
    if (!file || !pdfDocRef.current || totalPages === 0) return;

    let isCancelled = false;
    const doc = pdfDocRef.current;

    const initialThumbnails: PageThumbnail[] = Array.from({ length: totalPages }, (_, i) => ({
      pageNumber: i + 1,
      isLoading: true,
    }));
    setThumbnails(initialThumbnails);

    const renderThumbnails = async () => {
      for (let i = 1; i <= totalPages; i++) {
        if (isCancelled) break;
        try {
          const page = await doc.getPage(i);
          const unscaledViewport = page.getViewport({ scale: 1 });
          const targetWidth = 140;
          const scale = targetWidth / unscaledViewport.width;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport, canvas }).promise;

            const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
            if (!isCancelled) {
              setThumbnails((prev) =>
                prev.map((item) =>
                  item.pageNumber === i ? { ...item, dataUrl, isLoading: false } : item
                )
              );
            }
          }
        } catch {
          if (!isCancelled) {
            setThumbnails((prev) =>
              prev.map((item) =>
                item.pageNumber === i ? { ...item, isLoading: false } : item
              )
            );
          }
        }
      }
    };

    renderThumbnails();

    return () => {
      isCancelled = true;
    };
  }, [file, totalPages]);

  const handleProcessFile = async (selectedFile: File) => {
    setErrorMessage(null);
    setResult(null);
    cleanupObjectUrls();

    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Only PDF files are supported. Please select a valid PDF.');
      return;
    }

    try {
      const buffer = await selectedFile.arrayBuffer();
      fileBufferRef.current = buffer;

      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) });
      const doc = await loadingTask.promise;
      pdfDocRef.current = doc;

      const numPages = doc.numPages;
      if (numPages < 1) {
        setErrorMessage('The selected PDF contains no pages.');
        return;
      }

      setFile(selectedFile);
      setTotalPages(numPages);
      setSelectedPages(new Set());
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not load PDF document. The file may be password protected or corrupted.'
      );
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

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleTogglePage = (pageNumber: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNumber)) {
        next.delete(pageNumber);
      } else {
        next.add(pageNumber);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedPages(new Set(Array.from({ length: totalPages }, (_, i) => i + 1)));
  };

  const handleDeselectAll = () => {
    setSelectedPages(new Set());
  };

  const handleInvertSelection = () => {
    setSelectedPages((prev) => {
      const next = new Set<number>();
      for (let i = 1; i <= totalPages; i++) {
        if (!prev.has(i)) {
          next.add(i);
        }
      }
      return next;
    });
  };

  // Operation 1: Delete selected pages
  const handleApplyDelete = async () => {
    if (!file || !fileBufferRef.current || totalPages === 0) return;

    if (selectedPages.size === 0) {
      setErrorMessage('Please select at least one page to delete.');
      return;
    }

    if (selectedPages.size >= totalPages) {
      setErrorMessage('Cannot delete all pages. At least one page must remain in the PDF.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressText('Loading PDF document...');

    try {
      const srcDoc = await PDFDocument.load(fileBufferRef.current, { ignoreEncryption: true });
      const newDoc = await PDFDocument.create();

      const remainingIndices: number[] = [];
      for (let i = 0; i < totalPages; i++) {
        if (!selectedPages.has(i + 1)) {
          remainingIndices.push(i);
        }
      }

      setProgressText(`Removing ${selectedPages.size} page(s)...`);
      const copiedPages = await newDoc.copyPages(srcDoc, remainingIndices);
      copiedPages.forEach((p) => newDoc.addPage(p));

      setProgressText('Compiling modified PDF...');
      const outputPdfBytes = await newDoc.save();

      const blob = new Blob([outputPdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      objectUrlsRef.current.push(url);

      const baseName = file.name.replace(/\.pdf$/i, '') || 'document';
      const downloadFilename = `${baseName}_pages_deleted.pdf`;

      setResult({
        url,
        filename: downloadFilename,
        totalBytes: outputPdfBytes.byteLength,
        pageCount: remainingIndices.length,
        operation: 'delete',
        affectedCount: selectedPages.size,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete selected pages.');
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  // Operation 2: Extract selected pages
  const handleApplyExtract = async () => {
    if (!file || !fileBufferRef.current || totalPages === 0) return;

    if (selectedPages.size === 0) {
      setErrorMessage('Please select at least one page to extract.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressText('Loading PDF document...');

    try {
      const srcDoc = await PDFDocument.load(fileBufferRef.current, { ignoreEncryption: true });
      const newDoc = await PDFDocument.create();

      const extractIndices = Array.from(selectedPages)
        .sort((a, b) => a - b)
        .map((p) => p - 1);

      setProgressText(`Extracting ${extractIndices.length} page(s)...`);
      const copiedPages = await newDoc.copyPages(srcDoc, extractIndices);
      copiedPages.forEach((p) => newDoc.addPage(p));

      setProgressText('Compiling extracted PDF...');
      const outputPdfBytes = await newDoc.save();

      const blob = new Blob([outputPdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      objectUrlsRef.current.push(url);

      const baseName = file.name.replace(/\.pdf$/i, '') || 'document';
      const downloadFilename = `${baseName}_pages_extracted.pdf`;

      setResult({
        url,
        filename: downloadFilename,
        totalBytes: outputPdfBytes.byteLength,
        pageCount: extractIndices.length,
        operation: 'extract',
        affectedCount: selectedPages.size,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to extract selected pages.');
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const handleReset = () => {
    cleanupObjectUrls();
    setFile(null);
    setTotalPages(0);
    setSelectedPages(new Set());
    setThumbnails([]);
    setResult(null);
    setErrorMessage(null);
    pdfDocRef.current = null;
    fileBufferRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="delete-pages-page">
      <div className="container">
        {/* Top bar navigation */}
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
          <div className="tool-badge-pill tool-badge-delete-pages">
            Delete / Extract Pages
          </div>
        </div>

        {/* Main Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Delete / Extract Pages</h1>
          <p className="tool-main-subtitle">
            Visually select pages to remove from your document, or extract your chosen pages into a clean new PDF file.
          </p>
        </div>

        {/* Error notification banner */}
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
          onChange={handleFileChange}
          accept="application/pdf,.pdf"
          style={{ display: 'none' }}
          id="delete-pages-file-input"
        />

        {/* View 1: Results State */}
        {result && file ? (
          <div className="merge-result-card">
            <div className="result-icon-box" style={{ backgroundColor: '#ccfbf1' }}>
              <CheckCircle2 size={36} color="#0d9488" />
            </div>

            <h2 className="result-title">
              {result.operation === 'delete'
                ? 'Pages deleted successfully!'
                : 'Pages extracted successfully!'}
            </h2>
            <p className="result-desc">
              {result.operation === 'delete'
                ? `Removed ${result.affectedCount} page(s). Your new PDF document now contains ${result.pageCount} page(s).`
                : `Extracted ${result.pageCount} page(s) into your new standalone PDF document.`}
            </p>

            {/* Document stats */}
            <div className="word-stats-card">
              <div className="word-stat-item">
                <span className="word-stat-label">File Name</span>
                <span className="word-stat-value" title={result.filename}>{result.filename}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">PDF Size</span>
                <span className="word-stat-value">{formatFileSize(result.totalBytes)}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">Pages</span>
                <span className="word-stat-value">{result.pageCount}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="result-actions-wrapper">
              <button
                type="button"
                className="btn-download-primary"
                onClick={handleDownload}
                style={{ backgroundColor: '#0d9488' }}
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
                <span>Process Another PDF</span>
              </button>
            </div>
          </div>
        ) : !file ? (
          /* View 2: Upload Dropzone */
          <div
            className={`file-upload-dropzone ${isDraggingOver ? 'dragging-over' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload PDF to delete or extract pages"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="upload-icon-wrapper upload-icon-delete-pages">
              <Layers size={36} />
            </div>

            <h2 className="upload-main-text">Choose PDF File</h2>
            <p className="upload-sub-text">or drag and drop your PDF document here</p>

            <button
              type="button"
              className="btn-select-files btn-select-delete-pages"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <FileText size={18} />
              <span>Select PDF File</span>
            </button>

            <p className="upload-privacy-note">
              🔒 100% Client-Side Processing • Your PDF never leaves your device
            </p>
          </div>
        ) : (
          /* View 3: Workspace Card & Page Selection */
          <div className="rotate-workspace">
            {/* File header bar */}
            <div className="rotate-file-bar">
              <div className="rotate-file-info">
                <div className="rotate-file-icon-box" style={{ backgroundColor: '#ccfbf1', color: '#0d9488' }}>
                  <FileText size={22} />
                </div>
                <div>
                  <div className="rotate-file-name" title={file.name}>
                    {file.name}
                  </div>
                  <div className="rotate-file-meta">
                    {formatFileSize(file.size)} • {totalPages} {totalPages === 1 ? 'page' : 'pages'}
                    <span className="rotate-status-badge" style={{ backgroundColor: '#ccfbf1', color: '#0d9488' }}>
                      {selectedPages.size} of {totalPages} selected
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn-change-file"
                onClick={() => fileInputRef.current?.click()}
              >
                Change PDF
              </button>
            </div>

            {/* Selection & Action Toolbar */}
            <div className="rotate-toolbar-card">
              <div className="rotate-toolbar-header">
                <div className="rotate-selection-helpers">
                  <button
                    type="button"
                    className="btn-selection-helper"
                    onClick={handleSelectAll}
                  >
                    <CheckSquare size={14} />
                    <span>Select All</span>
                  </button>
                  <button
                    type="button"
                    className="btn-selection-helper"
                    onClick={handleDeselectAll}
                  >
                    <Square size={14} />
                    <span>Deselect All</span>
                  </button>
                  <button
                    type="button"
                    className="btn-selection-helper"
                    onClick={handleInvertSelection}
                  >
                    <RefreshCw size={14} />
                    <span>Invert</span>
                  </button>
                </div>

                {/* Operations */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-delete-action"
                    onClick={handleApplyDelete}
                    disabled={isProcessing || selectedPages.size === 0 || selectedPages.size >= totalPages}
                    title={
                      selectedPages.size >= totalPages
                        ? 'At least one page must remain'
                        : selectedPages.size === 0
                        ? 'Select pages to delete'
                        : `Delete ${selectedPages.size} selected page(s)`
                    }
                  >
                    {isProcessing ? (
                      <Loader2 size={16} className="spinner-icon" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    <span>
                      {isProcessing ? progressText || 'Processing...' : `Delete Selected (${selectedPages.size})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="btn-extract-action"
                    onClick={handleApplyExtract}
                    disabled={isProcessing || selectedPages.size === 0}
                    title={
                      selectedPages.size === 0
                        ? 'Select pages to extract'
                        : `Extract ${selectedPages.size} selected page(s)`
                    }
                  >
                    {isProcessing ? (
                      <Loader2 size={16} className="spinner-icon" />
                    ) : (
                      <Layers size={16} />
                    )}
                    <span>
                      {isProcessing ? progressText || 'Processing...' : `Extract Selected (${selectedPages.size})`}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Thumbnail Grid */}
            <div className="rotate-grid-section">
              <div className="rotate-grid-header">
                <span className="rotate-grid-title">Page Previews</span>
                <span className="rotate-grid-hint">
                  Click any page or its checkbox to select or deselect it.
                </span>
              </div>

              <div className="rotate-pages-grid">
                {thumbnails.map((thumb) => {
                  const pageNum = thumb.pageNumber;
                  const isSelected = selectedPages.has(pageNum);

                  return (
                    <div
                      key={pageNum}
                      className={`delete-page-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleTogglePage(pageNum)}
                    >
                      {/* Checkbox */}
                      <div
                        className={`delete-thumb-checkbox ${isSelected ? 'checked' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePage(pageNum);
                        }}
                      >
                        {isSelected && <Check size={14} strokeWidth={3} />}
                      </div>

                      {/* Page badge */}
                      <div className="delete-thumb-badge">
                        #{pageNum}
                      </div>

                      {/* Thumbnail Image */}
                      <div className="rotate-thumb-preview-container">
                        {thumb.isLoading ? (
                          <div className="rotate-thumb-loading">
                            <Loader2 size={24} className="spinner-icon text-muted" />
                          </div>
                        ) : thumb.dataUrl ? (
                          <img
                            src={thumb.dataUrl}
                            alt={`Page ${pageNum}`}
                            className="rotate-thumb-img"
                          />
                        ) : (
                          <div className="rotate-thumb-placeholder">
                            <FileText size={32} />
                          </div>
                        )}
                      </div>

                      {/* Footer label */}
                      <div className="rotate-thumb-footer" style={{ color: isSelected ? '#0d9488' : undefined, fontWeight: isSelected ? 700 : 600 }}>
                        Page {pageNum}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
