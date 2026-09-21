import { useState, useRef } from 'react';
import { apiFetch } from '../lib/api';
import type { FC, DragEvent, ChangeEvent } from 'react';
import { 
  Presentation, 
  Download, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  Loader2, 
  Info, 
  FileText,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Table
} from 'lucide-react';

interface PowerpointToPdfProps {
  onBack: () => void;
}

interface ConversionResult {
  url: string;
  downloadName: string;
  pdfBytes: number;
  originalBytes: number;
  pageCount: number;
  images: number;
  tables: number;
  shapes: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const PowerpointToPdf: FC<PowerpointToPdfProps> = ({ onBack }) => {
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

    const isPptx = selectedFile.name.toLowerCase().endsWith('.pptx') || 
                   selectedFile.name.toLowerCase().endsWith('.ppt') ||
                   selectedFile.type.includes('presentation') ||
                   selectedFile.type.includes('powerpoint');

    if (!isPptx) {
      setErrorMessage('Only PowerPoint presentations (.pptx, .ppt) are supported. Please select a valid PowerPoint file.');
      return;
    }

    if (selectedFile.size === 0) {
      setErrorMessage('The selected PowerPoint presentation is empty.');
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
    setProgressText('Uploading presentation to conversion engine...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProgressText('Analyzing slides, typography & layout geometry...');

      const response = await apiFetch('/api/convert-powerpoint-to-pdf', {
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

      setProgressText('Rendering high-fidelity vector PDF pages...');
      const pdfBlob = await response.blob();
      const url = URL.createObjectURL(pdfBlob);

      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const baseName = file.name.replace(/\.(pptx|ppt)$/i, '') || 'presentation';
      const downloadName = filenameMatch ? filenameMatch[1] : `${baseName}.pdf`;

      const pagesHeader = response.headers.get('X-Total-Pages') || response.headers.get('X-Total-Slides');
      const pageCount = pagesHeader ? parseInt(pagesHeader, 10) : 1;

      const imagesHeader = response.headers.get('X-Images');
      const images = imagesHeader ? parseInt(imagesHeader, 10) : 0;

      const tablesHeader = response.headers.get('X-Tables');
      const tables = tablesHeader ? parseInt(tablesHeader, 10) : 0;

      const shapesHeader = response.headers.get('X-Shapes');
      const shapes = shapesHeader ? parseInt(shapesHeader, 10) : 0;

      setResult({
        url,
        downloadName,
        pdfBytes: pdfBlob.size,
        originalBytes: file.size,
        pageCount,
        images,
        tables,
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
    setResult(null);
    setErrorMessage(null);
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
            PowerPoint to PDF
          </div>
        </div>

        {/* Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Convert PowerPoint to PDF</h1>
          <p className="tool-main-subtitle">
            Convert Microsoft PowerPoint presentations (.pptx, .ppt) into standardized, high-fidelity PDF documents with slides, text, formatting, tables, and images preserved.
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
          accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
          style={{ display: 'none' }}
          id="powerpoint-to-pdf-input"
        />

        {/* COMPLETED / DOWNLOAD STATE */}
        {result && file ? (
          <div className="merge-result-card">
            <div className="result-icon-box" style={{ backgroundColor: '#ffedd5' }}>
              <CheckCircle2 size={36} color="#ea580c" />
            </div>

            <h2 className="result-title">PowerPoint converted to PDF successfully!</h2>
            <p className="result-desc">
              Your presentation is ready to download as a high-quality, standardized PDF document.
            </p>

            {/* Layout preservation features badge banner */}
            <div className="word-features-badges">
              <span className="word-feature-badge">
                <Layers size={14} />
                <span>1:1 Slide-to-Page Layout ({result.pageCount} {result.pageCount === 1 ? 'Page' : 'Pages'})</span>
              </span>
              <span className="word-feature-badge">
                <FileText size={14} />
                <span>Vector Typography Retained</span>
              </span>
              {result.images > 0 && (
                <span className="word-feature-badge">
                  <ImageIcon size={14} />
                  <span>Embedded Graphics Preserved ({result.images})</span>
                </span>
              )}
              {result.tables > 0 && (
                <span className="word-feature-badge">
                  <Table size={14} />
                  <span>Structured Tables Preserved ({result.tables})</span>
                </span>
              )}
              <span className="word-feature-badge">
                <Sparkles size={14} />
                <span>Original Dimensions &amp; Geometry</span>
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
                <span className="word-stat-label">Slides</span>
                <span className="word-stat-value">{result.pageCount}</span>
              </div>
            </div>

            {/* Privacy notice */}
            <div className="word-info-banner">
              <Info size={16} style={{ flexShrink: 0, color: '#ea580c' }} />
              <span>
                100% private: Processed in memory and temporary files deleted immediately. No presentation files are stored.
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
                <span>Download PDF File</span>
              </button>

              <button
                type="button"
                className="btn-restart-action"
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                <span>Convert Another Presentation</span>
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
            aria-label="Upload PowerPoint presentation to convert to PDF"
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

            <h2 className="upload-main-text">Choose PowerPoint Presentation</h2>
            <p className="upload-sub-text">or drag and drop your PowerPoint (.pptx) file here</p>

            <button 
              type="button" 
              className="btn-select-files btn-select-powerpoint"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Presentation size={18} />
              <span>Select PowerPoint File</span>
            </button>

            <p className="upload-privacy-note">
              100% private: Processed in memory and deleted immediately &bull; Instant standardized PDF generation
            </p>
          </div>
        ) : (
          /* WORKSPACE CARD / CONVERT ACTION */
          <div className="word-workspace-card">
            <div className="split-file-header">
              <div className="split-file-info">
                <div className="split-file-icon-box" style={{ backgroundColor: '#ffedd5', color: '#ea580c' }}>
                  <Presentation size={28} />
                </div>
                <div className="split-file-meta">
                  <h3 className="split-file-name" title={file.name}>{file.name}</h3>
                  <div className="split-file-details">
                    <span>{formatFileSize(file.size)}</span>
                    <span>•</span>
                    <span className="powerpoint-page-count-badge">
                      PowerPoint Presentation (.pptx)
                    </span>
                  </div>
                </div>
              </div>

              <button 
                type="button" 
                className="btn-change-file"
                onClick={handleReset}
                title="Choose a different presentation"
              >
                Change
              </button>
            </div>

            {/* Technical callout */}
            <div className="word-notice-box">
              <div className="word-notice-title">
                <Info size={16} color="#ea580c" />
                <span>PowerPoint to PDF Slide Engine</span>
              </div>
              <p className="word-notice-text">
                GlowPDF reconstructs each slide into a dedicated vector PDF page, preserving text formatting, slide geometry, tables, vector shapes, and embedded graphics with zero file retention.
              </p>
            </div>

            {/* Convert action button */}
            <button
              type="button"
              className="btn-word-action btn-powerpoint-action"
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
    </section>
  );
};
