import { useState, useEffect, useRef, useCallback } from 'react';
import type { FC, DragEvent, ChangeEvent } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { 
  Upload, 
  Image as ImageIcon, 
  Download, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft,
  Loader2,
  Check,
  CheckSquare,
  Square,
  FileArchive,
  Sliders,
  Eye,
  Info
} from 'lucide-react';

// Configure pdfjs worker for fast client-side rendering
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface PdfToJpgProps {
  onBack: () => void;
}

type SelectionMode = 'all' | 'selected';
type JpgQuality = 'standard' | 'high';

interface ConvertedPage {
  pageNumber: number;
  blob: Blob;
  url: string;
  width: number;
  height: number;
  size: number;
}

interface JpgResult {
  downloadUrl: string;
  downloadFilename: string;
  isZip: boolean;
  totalBytes: number;
  pageCount: number;
  pages: ConvertedPage[];
  quality: JpgQuality;
}

interface PageThumbnail {
  pageNumber: number;
  dataUrl?: string;
  isLoading: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getBaseName = (filename: string): string => {
  return filename.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'document';
};

export const PdfToJpg: FC<PdfToJpgProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('all');
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [quality, setQuality] = useState<JpgQuality>('standard');
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressText, setProgressText] = useState<string>('');
  
  const [result, setResult] = useState<JpgResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
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

  // Load and render low-res thumbnails when PDF is loaded
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
          // Scale to fit ~140px width
          const targetWidth = 140;
          const scale = targetWidth / unscaledViewport.width;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext('2d');

          if (ctx) {
            // Fill white background for JPEG/transparent canvas
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
      setErrorMessage('Only PDF documents are supported. Please select a valid PDF file.');
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

      pdfDocRef.current = pdf;
      setFile(selectedFile);
      setTotalPages(count);
      // Default: select all pages
      const allPagesSet = new Set(Array.from({ length: count }, (_, i) => i + 1));
      setSelectedPages(allPagesSet);
      setSelectionMode('all');
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

  const handleSelectMode = (mode: SelectionMode) => {
    setSelectionMode(mode);
    if (mode === 'all') {
      setSelectedPages(new Set(Array.from({ length: totalPages }, (_, i) => i + 1)));
    }
  };

  const togglePageSelection = (pageNum: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum)) {
        next.delete(pageNum);
      } else {
        next.add(pageNum);
      }
      return next;
    });
    if (selectionMode === 'all') {
      setSelectionMode('selected');
    }
  };

  const handleSelectAll = () => {
    setSelectedPages(new Set(Array.from({ length: totalPages }, (_, i) => i + 1)));
  };

  const handleClearSelection = () => {
    setSelectedPages(new Set());
    setSelectionMode('selected');
  };

  const handleReset = () => {
    setFile(null);
    setTotalPages(0);
    setSelectionMode('all');
    setSelectedPages(new Set());
    setThumbnails([]);
    setResult(null);
    setErrorMessage(null);
    pdfDocRef.current = null;
    cleanupObjectUrls();
  };

  const handleConvertToJpg = async () => {
    if (!file || !pdfDocRef.current || totalPages < 1) return;

    const pagesToConvert = Array.from(selectedPages).sort((a, b) => a - b);
    if (pagesToConvert.length === 0) {
      setErrorMessage('Please select at least one page to convert.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressPercent(5);
    setProgressText('Initializing PDF rendering engine...');

    const doc = pdfDocRef.current;
    const baseName = getBaseName(file.name);
    // Quality settings
    const scale = quality === 'high' ? 2.0 : 1.5;
    const jpegQuality = quality === 'high' ? 0.92 : 0.85;

    try {
      const convertedPages: ConvertedPage[] = [];
      let totalConvertedBytes = 0;

      for (let i = 0; i < pagesToConvert.length; i++) {
        const pageNum = pagesToConvert[i];
        const progress = Math.round(10 + (i / pagesToConvert.length) * 75);
        setProgressPercent(progress);
        setProgressText(`Rendering page ${pageNum} (${i + 1} of ${pagesToConvert.length})...`);

        // Yield briefly so UI renders progress bar
        await new Promise((resolve) => setTimeout(resolve, 10));

        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error(`Failed to initialize 2D canvas context for page ${pageNum}`);
        }

        // Solid white background for transparent PDF elements
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => {
              if (b) resolve(b);
              else reject(new Error(`Failed to encode JPG for page ${pageNum}`));
            },
            'image/jpeg',
            jpegQuality
          );
        });

        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.push(url);

        totalConvertedBytes += blob.size;
        convertedPages.push({
          pageNumber: pageNum,
          blob,
          url,
          width: canvas.width,
          height: canvas.height,
          size: blob.size
        });
      }

      setProgressPercent(90);

      // Package output: single JPG or multi-page ZIP
      if (pagesToConvert.length === 1) {
        setProgressPercent(100);
        setProgressText('Conversion complete!');

        const singlePage = convertedPages[0];
        const downloadFilename = `${baseName}_page_${singlePage.pageNumber}.jpg`;

        setResult({
          downloadUrl: singlePage.url,
          downloadFilename,
          isZip: false,
          totalBytes: singlePage.size,
          pageCount: 1,
          pages: convertedPages,
          quality
        });
      } else {
        setProgressText(`Packaging ${pagesToConvert.length} JPG files into ZIP...`);
        setProgressPercent(93);

        const zip = new JSZip();
        const padLength = totalPages > 99 ? 3 : totalPages > 9 ? 2 : 1;

        convertedPages.forEach((cp) => {
          const paddedNum = String(cp.pageNumber).padStart(padLength, '0');
          zip.file(`${baseName}_page_${paddedNum}.jpg`, cp.blob);
        });

        const zipBlob = await zip.generateAsync(
          { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
          (metadata) => {
            setProgressPercent(93 + Math.round((metadata.percent / 100) * 6));
          }
        );

        const zipUrl = URL.createObjectURL(zipBlob);
        objectUrlsRef.current.push(zipUrl);

        setProgressPercent(100);
        setProgressText('Conversion complete!');

        const downloadFilename = `${baseName}_pdf_to_jpg.zip`;

        setResult({
          downloadUrl: zipUrl,
          downloadFilename,
          isZip: true,
          totalBytes: zipBlob.size,
          pageCount: convertedPages.length,
          pages: convertedPages,
          quality
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while converting PDF to JPG.';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.downloadUrl;
    a.download = result.downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadSinglePage = (page: ConvertedPage) => {
    if (!file) return;
    const baseName = getBaseName(file.name);
    const a = document.createElement('a');
    a.href = page.url;
    a.download = `${baseName}_page_${page.pageNumber}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="pdf-to-jpg-page">
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
          <div className="tool-badge-pill tool-badge-jpg">PDF to JPG</div>
        </div>

        {/* Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Convert PDF to JPG</h1>
          <p className="tool-main-subtitle">
            Render your PDF pages into high-resolution JPG images directly in your browser. Fast, 100% private, and client-side.
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
          id="jpg-pdf-input"
        />

        {/* COMPLETED / DOWNLOAD STATE */}
        {result && file ? (
          <div className="merge-result-card">
            <div className="result-icon-box" style={{ backgroundColor: '#e0e7ff' }}>
              <CheckCircle2 size={36} color="#4f46e5" />
            </div>

            <h2 className="result-title">PDF converted to JPG successfully!</h2>
            <p className="result-desc">
              {result.isZip
                ? `All ${result.pageCount} selected pages have been rendered and packaged into a ZIP archive.`
                : 'Your page has been rendered into a high-resolution JPG image.'}
            </p>

            {/* Document stats */}
            <div className="jpg-stats-card">
              <div className="word-stat-item">
                <span className="word-stat-label">Output File</span>
                <span className="word-stat-value" title={result.downloadFilename}>
                  {result.downloadFilename}
                </span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">File Size</span>
                <span className="word-stat-value">{formatFileSize(result.totalBytes)}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">Pages</span>
                <span className="word-stat-value">{result.pageCount}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">Quality</span>
                <span className="word-stat-value">
                  {result.quality === 'high' ? 'High (2.0x)' : 'Standard (1.5x)'}
                </span>
              </div>
            </div>

            {/* Converted images preview carousel / grid */}
            <div className="jpg-result-preview-section">
              <h3 className="jpg-result-preview-title">
                <Eye size={16} />
                <span>Rendered Image Preview</span>
              </h3>
              <div className="jpg-result-preview-grid">
                {result.pages.map((p) => (
                  <div key={p.pageNumber} className="jpg-result-preview-item">
                    <img
                      src={p.url}
                      alt={`Page ${p.pageNumber}`}
                      className="jpg-result-preview-img"
                    />
                    <div className="jpg-result-preview-meta">
                      <span className="jpg-preview-page-num">Page {p.pageNumber}</span>
                      <span className="jpg-preview-dims">{p.width}×{p.height}</span>
                      {result.isZip && (
                        <button
                          type="button"
                          className="btn-download-single-jpg"
                          onClick={() => handleDownloadSinglePage(p)}
                          title={`Download Page ${p.pageNumber} JPG`}
                        >
                          <Download size={13} />
                          <span>JPG</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="result-actions-wrapper">
              <button
                type="button"
                className="btn-download-primary"
                onClick={handleDownload}
                style={{ backgroundColor: '#4f46e5' }}
              >
                {result.isZip ? <FileArchive size={20} /> : <Download size={20} />}
                <span>
                  {result.isZip
                    ? `Download All JPGs (${result.pageCount} Pages .zip)`
                    : 'Download JPG Image'}
                </span>
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
            aria-label="Upload PDF to convert to JPG"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="upload-icon-wrapper upload-icon-jpg">
              <Upload size={36} />
            </div>

            <h2 className="upload-main-text">Choose PDF to Convert</h2>
            <p className="upload-sub-text">or drag and drop your PDF document here</p>

            <button 
              type="button" 
              className="btn-select-files btn-select-jpg"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <ImageIcon size={18} />
              <span>Select PDF File</span>
            </button>

            <p className="upload-privacy-note">
              100% private: Processed directly in your browser. No files leave your device.
            </p>
          </div>
        ) : (
          /* WORKSPACE CARD / PAGE SELECTION / CONVERT ACTION */
          <div className="jpg-workspace-card">
            {/* Document Header Card */}
            <div className="split-file-header">
              <div className="split-file-info">
                <div className="split-file-icon-box" style={{ backgroundColor: '#e0e7ff', color: '#4f46e5' }}>
                  <ImageIcon size={26} />
                </div>
                <div className="split-file-meta">
                  <h3 className="split-file-name" title={file.name}>{file.name}</h3>
                  <div className="split-file-details">
                    <span>{formatFileSize(file.size)}</span>
                    <span>•</span>
                    <span className="jpg-page-count-badge">
                      {totalPages} {totalPages === 1 ? 'Page' : 'Pages'}
                    </span>
                  </div>
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

            {/* Selection Mode Switch */}
            <div className="jpg-options-section">
              <div className="jpg-section-title-row">
                <label className="jpg-section-label">Pages to Convert</label>
                <div className="jpg-selection-mode-toggle">
                  <button
                    type="button"
                    className={`jpg-mode-btn ${selectionMode === 'all' ? 'active' : ''}`}
                    onClick={() => handleSelectMode('all')}
                  >
                    All Pages ({totalPages})
                  </button>
                  <button
                    type="button"
                    className={`jpg-mode-btn ${selectionMode === 'selected' ? 'active' : ''}`}
                    onClick={() => handleSelectMode('selected')}
                  >
                    Select Pages ({selectedPages.size})
                  </button>
                </div>
              </div>

              {/* Page Selection Controls */}
              <div className="jpg-selection-actions-bar">
                <div className="jpg-selection-count">
                  <span className="jpg-count-highlight">{selectedPages.size}</span> of {totalPages} pages selected
                </div>
                <div className="jpg-selection-buttons">
                  <button
                    type="button"
                    className="jpg-action-link-btn"
                    onClick={handleSelectAll}
                  >
                    <CheckSquare size={14} />
                    <span>Select All</span>
                  </button>
                  <button
                    type="button"
                    className="jpg-action-link-btn"
                    onClick={handleClearSelection}
                  >
                    <Square size={14} />
                    <span>Clear Selection</span>
                  </button>
                </div>
              </div>

              {/* Page Thumbnails Grid */}
              <div className="jpg-thumbnails-grid">
                {thumbnails.map((thumb) => {
                  const isSelected = selectedPages.has(thumb.pageNumber);
                  return (
                    <div
                      key={thumb.pageNumber}
                      className={`jpg-page-thumbnail-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => togglePageSelection(thumb.pageNumber)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Page ${thumb.pageNumber} ${isSelected ? 'selected' : 'not selected'}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          togglePageSelection(thumb.pageNumber);
                        }
                      }}
                    >
                      {/* Selection Badge */}
                      <div className={`jpg-thumb-checkbox ${isSelected ? 'checked' : ''}`}>
                        {isSelected ? <Check size={12} strokeWidth={3} /> : null}
                      </div>

                      {/* Thumbnail Preview */}
                      <div className="jpg-thumb-preview-container">
                        {thumb.isLoading ? (
                          <div className="jpg-thumb-loading">
                            <Loader2 size={18} className="spinner-icon" />
                          </div>
                        ) : thumb.dataUrl ? (
                          <img
                            src={thumb.dataUrl}
                            alt={`Page ${thumb.pageNumber}`}
                            className="jpg-thumb-img"
                            loading="lazy"
                          />
                        ) : (
                          <div className="jpg-thumb-placeholder">
                            <ImageIcon size={22} color="#94a3b8" />
                          </div>
                        )}
                      </div>

                      {/* Page Label */}
                      <div className="jpg-thumb-footer">
                        <span>Page {thumb.pageNumber}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quality / Resolution Setting */}
            <div className="jpg-quality-section">
              <label className="jpg-section-label">
                <Sliders size={15} />
                <span>Image Quality &amp; Resolution</span>
              </label>
              <div className="jpg-quality-options">
                <label className={`jpg-quality-card ${quality === 'standard' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="jpgQuality"
                    value="standard"
                    checked={quality === 'standard'}
                    onChange={() => setQuality('standard')}
                  />
                  <div className="jpg-quality-info">
                    <span className="jpg-quality-name">Standard Quality</span>
                    <span className="jpg-quality-desc">150 DPI • Balanced file size &amp; fast rendering</span>
                  </div>
                </label>

                <label className={`jpg-quality-card ${quality === 'high' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="jpgQuality"
                    value="high"
                    checked={quality === 'high'}
                    onChange={() => setQuality('high')}
                  />
                  <div className="jpg-quality-info">
                    <span className="jpg-quality-name">High Quality</span>
                    <span className="jpg-quality-desc">300 DPI • Ultra-sharp text &amp; detailed graphics</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Processing Progress Bar */}
            {isProcessing && (
              <div className="jpg-progress-container">
                <div className="jpg-progress-header">
                  <span className="jpg-progress-text">{progressText}</span>
                  <span className="jpg-progress-percent">{progressPercent}%</span>
                </div>
                <div className="jpg-progress-track">
                  <div 
                    className="jpg-progress-bar"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Info Notice */}
            <div className="jpg-privacy-box">
              <Info size={16} color="#4f46e5" style={{ flexShrink: 0 }} />
              <span>
                {selectedPages.size === 1
                  ? 'A single JPG file will be generated and downloaded directly.'
                  : `All ${selectedPages.size} selected pages will be rendered as JPG images and packaged into a convenient ZIP archive.`}
              </span>
            </div>

            {/* Convert Button */}
            <button
              type="button"
              className="btn-jpg-action"
              onClick={handleConvertToJpg}
              disabled={isProcessing || selectedPages.size === 0}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={20} className="spinner-icon" />
                  <span>Converting PDF to JPG...</span>
                </>
              ) : (
                <>
                  <ImageIcon size={20} />
                  <span>
                    Convert {selectedPages.size} {selectedPages.size === 1 ? 'Page' : 'Pages'} to JPG
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
