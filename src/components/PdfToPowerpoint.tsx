import { useState, useRef } from 'react';
import { apiFetch } from '../lib/api';
import type { FC, DragEvent, ChangeEvent } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  Upload, 
  Presentation, 
  Download, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  Loader2, 
  Info, 
  Sparkles, 
  FileText,
  Image as ImageIcon,
  Shapes,
  Lock
} from 'lucide-react';

// Configure pdfjs worker for fast client-side pre-validation and preview
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface PdfToPowerpointProps {
  onBack: () => void;
  onOpenUnlock?: () => void;
}

interface ConversionResult {
  url: string;
  downloadName: string;
  pptxBytes: number;
  originalBytes: number;
  slideCount: number;
  textBoxes: number;
  images: number;
  shapes: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const PdfToPowerpoint: FC<PdfToPowerpointProps> = ({ onBack, onOpenUnlock }) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPasswordError, setIsPasswordError] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleProcessFile = async (selectedFile: File) => {
    setErrorMessage(null);
    setIsPasswordError(false);
    setResult(null);
    setThumbnailUrl(null);

    const isPdf = selectedFile.name.toLowerCase().endsWith('.pdf') || selectedFile.type === 'application/pdf';

    if (!isPdf) {
      setErrorMessage('Only PDF documents (.pdf) are supported. Please choose a valid PDF file.');
      return;
    }

    if (selectedFile.size === 0) {
      setErrorMessage('The selected PDF document is empty.');
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

      // Generate first page thumbnail for rich preview
      try {
        const page1 = await pdf.getPage(1);
        const unscaledViewport = page1.getViewport({ scale: 1 });
        const targetWidth = 140;
        const scale = targetWidth / unscaledViewport.width;
        const viewport = page1.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page1.render({ canvasContext: ctx, viewport, canvas }).promise;
          setThumbnailUrl(canvas.toDataURL('image/jpeg', 0.85));
        }
      } catch {
        // Thumbnail generation is non-blocking fallback
      }
    } catch {
      // If pdfjs fails to open (e.g. password protected or format issue), still register file
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

  const handleConvertToPowerpoint = async () => {
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setIsPasswordError(false);
    setProgressText('Uploading PDF to conversion engine...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProgressText('Analyzing pages, layout geometry & typography...');

      const response = await apiFetch('/api/convert-pdf-to-powerpoint', {
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

        if (errDetail.toLowerCase().includes('password') || errDetail.toLowerCase().includes('protected')) {
          setIsPasswordError(true);
        }

        throw new Error(errDetail);
      }

      setProgressText('Reconstructing editable PowerPoint slides & objects...');
      const pptxBlob = await response.blob();
      const url = URL.createObjectURL(pptxBlob);

      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const baseName = file.name.replace(/\.pdf$/i, '') || 'presentation';
      const downloadName = filenameMatch ? filenameMatch[1] : `${baseName}.pptx`;

      const slidesHeader = response.headers.get('X-Slide-Count');
      const slideCount = slidesHeader ? parseInt(slidesHeader, 10) : (totalPages || 1);

      const textBoxesHeader = response.headers.get('X-Text-Boxes');
      const textBoxes = textBoxesHeader ? parseInt(textBoxesHeader, 10) : 0;

      const imagesHeader = response.headers.get('X-Images');
      const images = imagesHeader ? parseInt(imagesHeader, 10) : 0;

      const shapesHeader = response.headers.get('X-Shapes');
      const shapes = shapesHeader ? parseInt(shapesHeader, 10) : 0;

      setResult({
        url,
        downloadName,
        pptxBytes: pptxBlob.size,
        originalBytes: file.size,
        slideCount,
        textBoxes,
        images,
        shapes,
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred during PowerPoint conversion. Please verify the file and try again.'
      );
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    if (result) {
      URL.revokeObjectURL(result.url);
    }
    setFile(null);
    setTotalPages(0);
    setThumbnailUrl(null);
    setResult(null);
    setErrorMessage(null);
    setIsPasswordError(false);
    setProgressText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <section className="tool-page-wrapper">
      <div className="container tool-container">
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
          <div className="tool-badge-pill tool-badge-powerpoint">
            PDF to PowerPoint
          </div>
        </div>

        {/* Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Convert PDF to PowerPoint</h1>
          <p className="tool-main-subtitle">
            Turn your PDF presentations and documents into editable Microsoft PowerPoint (.pptx) slides with high fidelity, original dimensions, editable text, and images.
          </p>
        </div>

        {/* Error banner */}
        {errorMessage && (
          <div className="tool-alert-banner error" role="alert">
            <AlertCircle size={18} className="tool-alert-icon" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
              <span>{errorMessage}</span>
              {isPasswordError && onOpenUnlock && (
                <div>
                  <button
                    type="button"
                    onClick={onOpenUnlock}
                    className="btn-secondary"
                    style={{ 
                      fontSize: '0.85rem', 
                      padding: '0.35rem 0.75rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Lock size={14} />
                    <span>Go to Unlock PDF Tool</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          id="pdf-to-powerpoint-input"
        />

        {/* COMPLETED / DOWNLOAD STATE */}
        {result && file ? (
          <div className="merge-result-card">
            <div className="result-icon-box" style={{ backgroundColor: '#ffedd5' }}>
              <CheckCircle2 size={36} color="#ea580c" />
            </div>

            <h2 className="result-title">PDF converted to PowerPoint successfully!</h2>
            <p className="result-desc">
              Your presentation has been reconstructed into an editable Microsoft PowerPoint (.pptx) presentation.
            </p>

            {/* Layout preservation features badge banner */}
            <div className="word-features-badges">
              <span className="word-feature-badge">
                <Presentation size={14} />
                <span>1:1 Page-to-Slide Mapping ({result.slideCount} {result.slideCount === 1 ? 'Slide' : 'Slides'})</span>
              </span>
              {result.textBoxes > 0 && (
                <span className="word-feature-badge">
                  <FileText size={14} />
                  <span>Editable Text Boxes ({result.textBoxes})</span>
                </span>
              )}
              {result.images > 0 && (
                <span className="word-feature-badge">
                  <ImageIcon size={14} />
                  <span>Embedded Images Preserved ({result.images})</span>
                </span>
              )}
              {result.shapes > 0 && (
                <span className="word-feature-badge">
                  <Shapes size={14} />
                  <span>Shapes &amp; Accents ({result.shapes})</span>
                </span>
              )}
              <span className="word-feature-badge">
                <Sparkles size={14} />
                <span>Original Aspect Ratio &amp; Dimensions</span>
              </span>
            </div>

            {/* Presentation stats */}
            <div className="word-stats-card">
              <div className="word-stat-item">
                <span className="word-stat-label">File Name</span>
                <span className="word-stat-value" title={result.downloadName}>{result.downloadName}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">PowerPoint Size</span>
                <span className="word-stat-value">{formatFileSize(result.pptxBytes)}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">Slides</span>
                <span className="word-stat-value">{result.slideCount}</span>
              </div>
            </div>

            {/* Privacy notice */}
            <div className="word-info-banner">
              <Info size={16} style={{ flexShrink: 0, color: '#ea580c' }} />
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
                style={{ backgroundColor: '#ea580c' }}
              >
                <Download size={20} />
                <span>Download PowerPoint File</span>
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
            aria-label="Click or drag and drop a PDF document to convert to PowerPoint"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="upload-icon-wrapper upload-icon-powerpoint">
              <Presentation size={36} />
            </div>
            <h2 className="upload-main-text">Choose PDF to Convert</h2>
            <p className="upload-sub-text">
              or drag and drop your PDF presentation here
            </p>
            <button 
              type="button" 
              className="btn-select-files btn-select-powerpoint"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload size={18} />
              <span>Select PDF File</span>
            </button>
            <p className="upload-privacy-note">
              100% private: Processed in memory and deleted immediately &bull; Instant editable PPTX reconstruction
            </p>
          </div>
        ) : (
          /* FILE SELECTED & READY TO CONVERT */
          <div className="word-workspace-card">
            <div className="split-file-header">
              <div className="split-file-info">
                {thumbnailUrl ? (
                  <div className="split-file-thumb-box">
                    <img src={thumbnailUrl} alt="Slide 1 preview" className="split-file-thumb-img" />
                  </div>
                ) : (
                  <div className="split-file-icon-box" style={{ backgroundColor: '#ffedd5', color: '#ea580c' }}>
                    <Presentation size={26} />
                  </div>
                )}
                <div className="split-file-meta">
                  <h3 className="split-file-name" title={file.name}>
                    {file.name}
                  </h3>
                  <div className="split-file-details">
                    <span>{formatFileSize(file.size)}</span>
                    <span>•</span>
                    <span className="powerpoint-page-count-badge">
                      {totalPages > 0 ? `${totalPages} ${totalPages === 1 ? 'Slide' : 'Slides'}` : 'PDF Document'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn-change-file"
                onClick={handleReset}
                disabled={isProcessing}
                aria-label="Choose a different file"
              >
                Change
              </button>
            </div>

            {/* Technical callout notice */}
            <div className="word-notice-box">
              <div className="word-notice-title">
                <Info size={16} color="#ea580c" />
                <span>PDF to PowerPoint Slide Engine</span>
              </div>
              <p className="word-notice-text">
                GlowPDF maps each PDF page into a 1:1 PowerPoint slide, extracting paragraphs into native editable text boxes, preserving aspect ratios, and retaining embedded graphics at exact coordinate coordinates.
              </p>
            </div>

            {/* Action convert button */}
            <button
              type="button"
              className="btn-word-action btn-powerpoint-action"
              onClick={handleConvertToPowerpoint}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={20} className="spinner-icon" />
                  <span>{progressText || 'Converting to PowerPoint...'}</span>
                </>
              ) : (
                <>
                  <Presentation size={20} />
                  <span>Convert to PowerPoint (.pptx)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
