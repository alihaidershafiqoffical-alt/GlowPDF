import { useState, useRef, useEffect, useCallback } from 'react';
import type { FC, DragEvent, ChangeEvent } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, degrees } from 'pdf-lib';
import {
  Upload,
  FileText,
  Download,
  RotateCcw,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  CheckSquare,
  Square,
  RefreshCw,
  Sliders,
  Check,
  Info
} from 'lucide-react';

// Configure pdfjs worker for fast client-side rendering
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface RotatePdfProps {
  onBack: () => void;
}

type SelectionMode = 'all' | 'selected';

interface PageThumbnail {
  pageNumber: number;
  dataUrl?: string;
  isLoading: boolean;
}

interface RotateResult {
  url: string;
  downloadFilename: string;
  totalBytes: number;
  pageCount: number;
  rotatedCount: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const RotatePdf: FC<RotatePdfProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('all');
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  
  // Per-page rotation deltas in degrees (0, 90, 180, 270)
  const [pageRotations, setPageRotations] = useState<number[]>([]);
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  
  const [result, setResult] = useState<RotateResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const fileBufferRef = useRef<ArrayBuffer | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  // Cleanup object URLs on unmount or reset
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
      isLoading: true
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

  // Handle file selection
  const handleProcessFile = async (selectedFile: File) => {
    setErrorMessage(null);
    setResult(null);
    cleanupObjectUrls();

    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Only PDF files are supported. Please select a valid PDF file.');
      return;
    }

    try {
      const buffer = await selectedFile.arrayBuffer();
      fileBufferRef.current = buffer;

      const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
      const doc = await loadingTask.promise;
      pdfDocRef.current = doc;

      const numPages = doc.numPages;
      if (numPages === 0) {
        setErrorMessage('The selected PDF contains no pages.');
        return;
      }

      setFile(selectedFile);
      setTotalPages(numPages);
      setPageRotations(Array.from({ length: numPages }, () => 0));
      // Select all by default
      setSelectedPages(new Set(Array.from({ length: numPages }, (_, i) => i + 1)));
      setSelectionMode('all');
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

  // Toggle selection of a single page
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

  // Rotate single page by delta degrees (+90, +180, +270)
  const handleRotateSinglePage = (pageIndex: number, delta: number) => {
    setPageRotations((prev) => {
      const next = [...prev];
      const current = next[pageIndex] || 0;
      next[pageIndex] = (((current + delta) % 360) + 360) % 360;
      return next;
    });
  };

  // Batch rotate targeted pages
  const handleBatchRotate = (delta: number) => {
    setPageRotations((prev) => {
      const next = [...prev];
      for (let i = 0; i < totalPages; i++) {
        const pageNum = i + 1;
        if (selectionMode === 'all' || selectedPages.has(pageNum)) {
          const current = next[i] || 0;
          next[i] = (((current + delta) % 360) + 360) % 360;
        }
      }
      return next;
    });
  };

  // Reset all rotations
  const handleResetRotations = () => {
    setPageRotations(Array.from({ length: totalPages }, () => 0));
  };

  // Apply rotations and generate genuine PDF using pdf-lib
  const handleApplyRotation = async () => {
    if (!file || !fileBufferRef.current || totalPages === 0) return;

    // Check if any page has a rotation applied
    const hasAnyRotation = pageRotations.some((deg) => deg !== 0);
    if (!hasAnyRotation) {
      setErrorMessage('No rotation has been selected yet. Please rotate one or more pages before saving.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressText('Opening PDF document...');

    try {
      const pdfDoc = await PDFDocument.load(fileBufferRef.current, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();

      setProgressText('Applying page rotations...');
      let rotatedCount = 0;

      pages.forEach((page, index) => {
        const delta = pageRotations[index] || 0;
        if (delta !== 0) {
          rotatedCount++;
          const existingAngle = page.getRotation().angle; // e.g. 0, 90, 180, 270
          const finalAngle = (((existingAngle + delta) % 360) + 360) % 360;
          page.setRotation(degrees(finalAngle));
        }
      });

      setProgressText('Compiling rotated PDF...');
      const outputPdfBytes = await pdfDoc.save();

      const blob = new Blob([outputPdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      objectUrlsRef.current.push(url);

      const downloadFilename = 'glowpdf_rotated.pdf';

      setResult({
        url,
        downloadFilename,
        totalBytes: outputPdfBytes.byteLength,
        pageCount: totalPages,
        rotatedCount
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while rotating the PDF.'
      );
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const handleReset = () => {
    setFile(null);
    setTotalPages(0);
    setSelectedPages(new Set());
    setPageRotations([]);
    setThumbnails([]);
    setResult(null);
    setErrorMessage(null);
    cleanupObjectUrls();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Total pages currently rotated
  const activeRotatedCount = pageRotations.filter((deg) => deg !== 0).length;

  return (
    <div className="rotate-pdf-page">
      <div className="container">
        {/* Navigation Breadcrumb */}
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
          <div className="tool-badge-pill tool-badge-rotate">Rotate PDF</div>
        </div>

        {/* Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Rotate PDF Pages</h1>
          <p className="tool-main-subtitle">
            Rotate individual pages or your entire document. Preview page layouts and rotate 90°, 180°, or 270° clockwise with full quality preservation.
          </p>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          id="rotate-pdf-file-input"
        />

        {/* Error Alert */}
        {errorMessage && (
          <div className="tool-alert-banner error" role="alert">
            <AlertCircle size={18} className="tool-alert-icon" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* View 1: Success / Download Result */}
        {result ? (
          <div className="merge-result-card">
            <div className="result-icon-box" style={{ backgroundColor: '#ffedd5' }}>
              <CheckCircle2 size={36} color="#ea580c" />
            </div>
            <h2 className="result-title">PDF rotated successfully!</h2>
            <p className="result-desc">
              Your rotated PDF document has been created and is ready to download.
            </p>

            {/* Document stats */}
            <div className="word-stats-card">
              <div className="word-stat-item">
                <span className="word-stat-label">File Name</span>
                <span className="word-stat-value" title={result.downloadFilename}>{result.downloadFilename}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">Total Pages</span>
                <span className="word-stat-value">{result.pageCount}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">Rotated</span>
                <span className="word-stat-value" style={{ color: '#ea580c' }}>{result.rotatedCount} of {result.pageCount}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">File Size</span>
                <span className="word-stat-value">{formatFileSize(result.totalBytes)}</span>
              </div>
            </div>

            {/* Privacy notice */}
            <div className="word-info-banner">
              <Info size={16} style={{ flexShrink: 0, color: '#ea580c' }} />
              <span>
                100% private: Processed client-side in your browser. Your document never leaves your device.
              </span>
            </div>

            {/* Actions */}
            <div className="result-actions-wrapper">
              <a
                href={result.url}
                download={result.downloadFilename}
                className="btn-download-primary"
                style={{ backgroundColor: '#ea580c' }}
              >
                <Download size={20} />
                <span>Download Rotated PDF</span>
              </a>

              <button
                type="button"
                className="btn-restart-action"
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                <span>Rotate Another PDF</span>
              </button>
            </div>
          </div>
        ) : !file ? (
          /* View 2: Upload Dropzone */
          <div
            className={`file-upload-dropzone ${isDraggingOver ? 'dragging-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload PDF to rotate"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="upload-icon-wrapper upload-icon-rotate">
              <RotateCw size={34} />
            </div>
            <h2 className="upload-main-text">Select PDF to Rotate</h2>
            <p className="upload-sub-text">or drop PDF file here</p>
            <button
              type="button"
              className="btn-select-files btn-select-rotate"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload size={18} />
              <span>Select PDF File</span>
            </button>
            <p className="upload-privacy-note">
              🔒 100% Client-Side Processing &bull; Your PDF never leaves your browser
            </p>
          </div>
        ) : (
          /* View 3: Interactive Rotation Workspace */
          <div className="rotate-workspace">
            {/* Document Info Header Bar */}
            <div className="rotate-file-bar">
              <div className="rotate-file-info">
                <div className="rotate-file-icon-box">
                  <FileText size={22} />
                </div>
                <div>
                  <div className="rotate-file-name" title={file.name}>
                    {file.name}
                  </div>
                  <div className="rotate-file-meta">
                    {formatFileSize(file.size)} • {totalPages} {totalPages === 1 ? 'page' : 'pages'}
                    {activeRotatedCount > 0 && (
                      <span className="rotate-status-badge">
                        {activeRotatedCount} {activeRotatedCount === 1 ? 'page' : 'pages'} rotated
                      </span>
                    )}
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

            {/* Rotation Control Toolbar */}
            <div className="rotate-toolbar-card">
              <div className="rotate-toolbar-header">
                <div className="rotate-toolbar-title-group">
                  <Sliders size={18} className="text-brand" />
                  <span className="rotate-toolbar-title">Rotation Controls</span>
                </div>

                {/* Scope Toggle: All Pages vs Selected Pages */}
                <div className="rotate-scope-toggle">
                  <button
                    type="button"
                    className={`rotate-scope-btn ${selectionMode === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectionMode('all')}
                  >
                    All Pages ({totalPages})
                  </button>
                  <button
                    type="button"
                    className={`rotate-scope-btn ${selectionMode === 'selected' ? 'active' : ''}`}
                    onClick={() => setSelectionMode('selected')}
                  >
                    Selected Pages ({selectedPages.size})
                  </button>
                </div>
              </div>

              <div className="rotate-toolbar-actions">
                <div className="rotate-direction-buttons">
                  <button
                    type="button"
                    className="btn-rotate-action"
                    onClick={() => handleBatchRotate(270)}
                    title="Rotate 90° counter-clockwise (270° clockwise)"
                  >
                    <RotateCcw size={16} />
                    <span>Left 90°</span>
                  </button>

                  <button
                    type="button"
                    className="btn-rotate-action primary"
                    onClick={() => handleBatchRotate(90)}
                    title="Rotate 90° clockwise"
                  >
                    <RotateCw size={16} />
                    <span>Right 90°</span>
                  </button>

                  <button
                    type="button"
                    className="btn-rotate-action"
                    onClick={() => handleBatchRotate(180)}
                    title="Rotate 180°"
                  >
                    <RefreshCw size={16} />
                    <span>180°</span>
                  </button>

                  {activeRotatedCount > 0 && (
                    <button
                      type="button"
                      className="btn-rotate-action reset"
                      onClick={handleResetRotations}
                      title="Reset all rotations to original orientation"
                    >
                      <RotateCcw size={16} />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                {/* Quick Selection Buttons if in Selected Pages mode */}
                {selectionMode === 'selected' && (
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
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail Grid Preview */}
            <div className="rotate-grid-section">
              <div className="rotate-grid-header">
                <span className="rotate-grid-title">Page Preview</span>
                <span className="rotate-grid-hint">
                  {selectionMode === 'selected'
                    ? 'Click any page to select/deselect it, or hover to rotate it individually.'
                    : 'Hover over any page to rotate it individually, or use the controls above.'}
                </span>
              </div>

              <div className="rotate-pages-grid">
                {thumbnails.map((thumb, index) => {
                  const pageNum = thumb.pageNumber;
                  const isSelected = selectedPages.has(pageNum);
                  const rotationDelta = pageRotations[index] || 0;

                  return (
                    <div
                      key={pageNum}
                      className={`rotate-page-card ${isSelected && selectionMode === 'selected' ? 'selected' : ''}`}
                      onClick={() => {
                        if (selectionMode === 'selected') {
                          handleTogglePage(pageNum);
                        }
                      }}
                    >
                      {/* Checkbox (shown in selected mode) */}
                      {selectionMode === 'selected' && (
                        <div
                          className={`rotate-thumb-checkbox ${isSelected ? 'checked' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePage(pageNum);
                          }}
                        >
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                      )}

                      {/* Current Rotation Badge */}
                      {rotationDelta !== 0 && (
                        <div className="rotate-thumb-badge">
                          +{rotationDelta}°
                        </div>
                      )}

                      {/* Thumbnail Container with Smooth CSS Rotation */}
                      <div className="rotate-thumb-preview-container">
                        {thumb.isLoading ? (
                          <div className="rotate-thumb-loading">
                            <Loader2 size={24} className="spin-icon text-muted" />
                          </div>
                        ) : thumb.dataUrl ? (
                          <div
                            className="rotate-thumb-transform-wrapper"
                            style={{
                              transform: `rotate(${rotationDelta}deg)`,
                              transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                          >
                            <img
                              src={thumb.dataUrl}
                              alt={`Page ${pageNum}`}
                              className="rotate-thumb-img"
                            />
                          </div>
                        ) : (
                          <div className="rotate-thumb-placeholder">
                            <FileText size={28} />
                          </div>
                        )}

                        {/* Quick Rotate Button On Hover */}
                        <button
                          type="button"
                          className="rotate-thumb-quick-btn"
                          title="Rotate 90° Clockwise"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRotateSinglePage(index, 90);
                          }}
                        >
                          <RotateCw size={14} />
                        </button>
                      </div>

                      {/* Card Footer: Page Number */}
                      <div className="rotate-thumb-footer">
                        <span>Page {pageNum}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="rotate-submit-bar">
              <div className="rotate-submit-info">
                <span>
                  {activeRotatedCount > 0 ? (
                    <strong>{activeRotatedCount} of {totalPages} {totalPages === 1 ? 'page' : 'pages'} will be rotated</strong>
                  ) : (
                    'No pages rotated yet. Use buttons above or hover on any page.'
                  )}
                </span>
              </div>

              <button
                type="button"
                className="btn-primary-lg btn-apply-rotate"
                disabled={isProcessing || activeRotatedCount === 0}
                onClick={handleApplyRotation}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={20} className="spin-icon" />
                    <span>{progressText || 'Rotating PDF...'}</span>
                  </>
                ) : (
                  <>
                    <RotateCw size={18} />
                    <span>Apply Rotation & Download</span>
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
