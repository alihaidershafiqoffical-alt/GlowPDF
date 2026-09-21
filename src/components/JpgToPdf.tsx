import { useState, useRef, useEffect, useCallback } from 'react';
import type { FC, DragEvent, ChangeEvent } from 'react';
import { PDFDocument } from 'pdf-lib';
import { 
  Upload, 
  FileImage, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  RotateCcw, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft,
  Loader2,
  Settings2
} from 'lucide-react';

interface JpgToPdfProps {
  onBack: () => void;
}

export interface ImageFileItem {
  id: string;
  file: File;
  name: string;
  size: string;
  bytes: number;
  width: number;
  height: number;
  previewUrl: string;
}

export type PageSizeOption = 'a4' | 'letter' | 'fit';
export type OrientationOption = 'auto' | 'portrait' | 'landscape';
export type MarginOption = 'none' | 'small' | 'medium';

interface ConversionResult {
  url: string;
  filename: string;
  totalBytes: number;
  pageCount: number;
  pageSize: PageSizeOption;
  orientation: OrientationOption;
  margin: MarginOption;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const JpgToPdf: FC<JpgToPdfProps> = ({ onBack }) => {
  const [items, setItems] = useState<ImageFileItem[]>([]);
  const [pageSize, setPageSize] = useState<PageSizeOption>('a4');
  const [orientation, setOrientation] = useState<OrientationOption>('auto');
  const [marginOption, setMarginOption] = useState<MarginOption>('small');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const cleanupUrls = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      cleanupUrls();
    };
  }, [cleanupUrls]);

  const validateAndProcessFiles = async (fileList: FileList | File[]) => {
    setErrorMessage(null);
    const validFiles: File[] = [];
    let hadInvalid = false;

    Array.from(fileList).forEach((file) => {
      const isJpg = 
        file.type === 'image/jpeg' || 
        file.type === 'image/jpg' || 
        file.name.toLowerCase().endsWith('.jpg') || 
        file.name.toLowerCase().endsWith('.jpeg');
      
      const isPng = 
        file.type === 'image/png' || 
        file.name.toLowerCase().endsWith('.png');

      if (isJpg || isPng) {
        validFiles.push(file);
      } else {
        hadInvalid = true;
      }
    });

    if (hadInvalid) {
      setErrorMessage('Some files were skipped. Only JPG, JPEG, and PNG images are supported.');
    }

    if (validFiles.length === 0) {
      return;
    }

    const newItems: ImageFileItem[] = [];

    for (const file of validFiles) {
      const id = `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`;
      const previewUrl = URL.createObjectURL(file);
      objectUrlsRef.current.push(previewUrl);

      // Extract image dimensions
      try {
        const img = new Image();
        img.src = previewUrl;
        await img.decode();
        newItems.push({
          id,
          file,
          name: file.name,
          size: formatFileSize(file.size),
          bytes: file.size,
          width: img.naturalWidth || 800,
          height: img.naturalHeight || 600,
          previewUrl
        });
      } catch {
        // Fallback dimensions if decode fails
        newItems.push({
          id,
          file,
          name: file.name,
          size: formatFileSize(file.size),
          bytes: file.size,
          width: 800,
          height: 600,
          previewUrl
        });
      }
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFiles(e.dataTransfer.files);
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

  const moveItem = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, moved);
    setItems(newItems);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setErrorMessage(null);
  };

  const handleReset = () => {
    setItems([]);
    setResult(null);
    setErrorMessage(null);
    cleanupUrls();
  };

  // Card HTML5 drag-and-drop reordering
  const onCardDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const onCardDragOver = (e: DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const updated = [...items];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, draggedItem);
    setDraggedIndex(targetIndex);
    setItems(updated);
  };

  const onCardDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleConvertToPdf = async () => {
    if (items.length === 0) {
      setErrorMessage('Please add at least one JPG image to convert.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressText('Initializing PDF generator...');

    try {
      const doc = await PDFDocument.create();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setProgressText(`Embedding image ${i + 1} of ${items.length}...`);
        await new Promise((r) => setTimeout(r, 15));

        const arrayBuffer = await item.file.arrayBuffer();
        let embeddedImage;

        if (item.file.type === 'image/png' || item.file.name.toLowerCase().endsWith('.png')) {
          embeddedImage = await doc.embedPng(arrayBuffer);
        } else {
          try {
            embeddedImage = await doc.embedJpg(arrayBuffer);
          } catch {
            // Fallback: draw through canvas if JPEG has unconventional color profile
            const canvas = document.createElement('canvas');
            canvas.width = item.width;
            canvas.height = item.height;
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.src = item.previewUrl;
            await img.decode();
            ctx?.drawImage(img, 0, 0);
            const fallbackBlob = await new Promise<Blob>((res) =>
              canvas.toBlob((b) => res(b!), 'image/jpeg', 0.95)
            );
            const fallbackBuffer = await fallbackBlob.arrayBuffer();
            embeddedImage = await doc.embedJpg(fallbackBuffer);
          }
        }

        let pageWidth: number;
        let pageHeight: number;

        if (pageSize === 'fit') {
          pageWidth = embeddedImage.width;
          pageHeight = embeddedImage.height;
        } else {
          // Standard page sizes (in points, 72 DPI)
          // A4: 595.28 x 841.89 pt
          // Letter: 612 x 792 pt
          const base = pageSize === 'letter' 
            ? { w: 612, h: 792 } 
            : { w: 595.28, h: 841.89 };

          let isLandscape = false;
          if (orientation === 'auto') {
            isLandscape = embeddedImage.width > embeddedImage.height;
          } else if (orientation === 'landscape') {
            isLandscape = true;
          } else {
            isLandscape = false;
          }

          if (isLandscape) {
            pageWidth = Math.max(base.w, base.h);
            pageHeight = Math.min(base.w, base.h);
          } else {
            pageWidth = Math.min(base.w, base.h);
            pageHeight = Math.max(base.w, base.h);
          }
        }

        const margin = pageSize === 'fit' ? 0 : marginOption === 'none' ? 0 : marginOption === 'small' ? 20 : 40;
        const availWidth = Math.max(10, pageWidth - margin * 2);
        const availHeight = Math.max(10, pageHeight - margin * 2);

        // Calculate fit scale strictly preserving aspect ratio
        const scale = Math.min(availWidth / embeddedImage.width, availHeight / embeddedImage.height);
        const drawWidth = embeddedImage.width * scale;
        const drawHeight = embeddedImage.height * scale;

        const x = margin + (availWidth - drawWidth) / 2;
        const y = margin + (availHeight - drawHeight) / 2;

        const page = doc.addPage([pageWidth, pageHeight]);
        page.drawImage(embeddedImage, {
          x,
          y,
          width: drawWidth,
          height: drawHeight,
        });
      }

      setProgressText('Finalizing PDF document...');
      const pdfBytes = await doc.save();
      const pdfBlob = new Blob([pdfBytes as unknown as ArrayBuffer], { type: 'application/pdf' });
      const pdfUrl = URL.createObjectURL(pdfBlob);
      objectUrlsRef.current.push(pdfUrl);

      const outputFilename = 'glowpdf_images.pdf';

      setResult({
        url: pdfUrl,
        filename: outputFilename,
        totalBytes: pdfBlob.size,
        pageCount: items.length,
        pageSize,
        orientation,
        margin: marginOption
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while converting images to PDF.';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
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
    <div className="jpg-to-pdf-page">
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
          <div className="tool-badge-pill tool-badge-jpg-to-pdf">JPG to PDF</div>
        </div>

        {/* Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Convert JPG to PDF</h1>
          <p className="tool-main-subtitle">
            Convert JPG and image files into high-quality PDF documents. Reorder pages, customize margins and orientation, 100% private in your browser.
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
          accept=".jpg,.jpeg,image/jpeg,.png,image/png"
          multiple
          style={{ display: 'none' }}
          id="jpg-to-pdf-input"
        />

        {/* COMPLETED / DOWNLOAD STATE */}
        {result ? (
          <div className="merge-result-card">
            <div className="result-icon-box" style={{ backgroundColor: '#fef3c7' }}>
              <CheckCircle2 size={36} color="#d97706" />
            </div>

            <h2 className="result-title">Images converted to PDF successfully!</h2>
            <p className="result-desc">
              Your images have been packaged into a structured, high-resolution PDF document with original image clarity preserved.
            </p>

            {/* Document stats */}
            <div className="jpg-stats-card">
              <div className="word-stat-item">
                <span className="word-stat-label">PDF File</span>
                <span className="word-stat-value" title={result.filename}>
                  {result.filename}
                </span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">Pages</span>
                <span className="word-stat-value">{result.pageCount}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">Size</span>
                <span className="word-stat-value">{formatFileSize(result.totalBytes)}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">Layout</span>
                <span className="word-stat-value">
                  {result.pageSize.toUpperCase()} • {result.orientation}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="result-actions-wrapper">
              <button
                type="button"
                className="btn-download-primary"
                onClick={handleDownload}
                style={{ backgroundColor: '#d97706' }}
              >
                <Download size={20} />
                <span>Download PDF</span>
              </button>

              <button
                type="button"
                className="btn-restart-action"
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                <span>Convert More Images</span>
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          /* UPLOAD DROPZONE */
          <div 
            className={`file-upload-dropzone ${isDraggingOver ? 'dragging-over' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload JPG images to convert to PDF"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="upload-icon-wrapper upload-icon-jpg-to-pdf">
              <Upload size={36} />
            </div>

            <h2 className="upload-main-text">Choose JPG Images</h2>
            <p className="upload-sub-text">or drag and drop your image files here</p>

            <button 
              type="button" 
              className="btn-select-files btn-select-jpg-to-pdf"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <FileImage size={18} />
              <span>Select JPG Files</span>
            </button>

            <p className="upload-privacy-note">
              100% private: Converted directly in your browser. No files leave your device.
            </p>
          </div>
        ) : (
          /* ARRANGE & SETTINGS WORKSPACE */
          <div className="arrange-container">
            {/* Toolbar */}
            <div className="arrange-toolbar">
              <div className="arrange-stats">
                <span className="file-count-badge" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
                  {items.length} {items.length === 1 ? 'image' : 'images'} selected
                </span>
                <span className="file-count-hint">
                  Drag cards or use arrow buttons to reorder pages
                </span>
              </div>

              <div className="arrange-toolbar-actions">
                <button
                  type="button"
                  className="btn-add-more"
                  onClick={() => fileInputRef.current?.click()}
                  title="Add more image files"
                >
                  <Plus size={16} />
                  <span>Add More Images</span>
                </button>
                <button
                  type="button"
                  className="btn-clear-all"
                  onClick={handleReset}
                  title="Clear all selected images"
                >
                  <Trash2 size={16} />
                  <span>Clear All</span>
                </button>
              </div>
            </div>

            {/* Grid of reorderable image cards */}
            <div className="pdf-cards-grid" role="list" aria-label="Images to convert">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`pdf-card-item ${draggedIndex === index ? 'is-dragged' : ''}`}
                  role="listitem"
                  draggable
                  onDragStart={() => onCardDragStart(index)}
                  onDragOver={(e) => onCardDragOver(e, index)}
                  onDragEnd={onCardDragEnd}
                >
                  <div className="pdf-card-header">
                    <span className="pdf-card-order">Page {index + 1}</span>
                    <button
                      type="button"
                      className="pdf-card-remove"
                      onClick={() => removeItem(item.id)}
                      title={`Remove ${item.name}`}
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Visual Image Preview */}
                  <div className="jpg-card-image-preview">
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="jpg-card-img"
                    />
                    <span className="jpg-card-dims-tag">
                      {item.width}×{item.height}
                    </span>
                  </div>

                  <div className="pdf-card-meta">
                    <p className="pdf-file-name" title={item.name}>
                      {item.name}
                    </p>
                    <span className="pdf-file-size">{item.size}</span>
                  </div>

                  <div className="pdf-card-controls">
                    <button
                      type="button"
                      className="order-btn"
                      disabled={index === 0}
                      onClick={() => moveItem(index, 'left')}
                      title="Move left"
                      aria-label={`Move ${item.name} left`}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="order-label">Reorder</span>
                    <button
                      type="button"
                      className="order-btn"
                      disabled={index === items.length - 1}
                      onClick={() => moveItem(index, 'right')}
                      title="Move right"
                      aria-label={`Move ${item.name} right`}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* PDF Page Settings Panel */}
            <div className="jpg-to-pdf-settings-card">
              <div className="jpg-settings-header">
                <Settings2 size={18} color="#d97706" />
                <h3 className="jpg-settings-title">PDF Page Settings</h3>
              </div>

              <div className="jpg-settings-grid">
                {/* Setting: Page Size */}
                <div className="jpg-setting-group">
                  <label className="jpg-setting-label">Page Size</label>
                  <div className="jpg-segmented-control">
                    <button
                      type="button"
                      className={`jpg-segmented-btn ${pageSize === 'a4' ? 'active' : ''}`}
                      onClick={() => setPageSize('a4')}
                    >
                      A4 Standard
                    </button>
                    <button
                      type="button"
                      className={`jpg-segmented-btn ${pageSize === 'letter' ? 'active' : ''}`}
                      onClick={() => setPageSize('letter')}
                    >
                      US Letter
                    </button>
                    <button
                      type="button"
                      className={`jpg-segmented-btn ${pageSize === 'fit' ? 'active' : ''}`}
                      onClick={() => setPageSize('fit')}
                    >
                      Fit to Image
                    </button>
                  </div>
                </div>

                {/* Setting: Orientation */}
                <div className="jpg-setting-group">
                  <label className="jpg-setting-label">Orientation</label>
                  <div className="jpg-segmented-control">
                    <button
                      type="button"
                      className={`jpg-segmented-btn ${orientation === 'auto' ? 'active' : ''}`}
                      onClick={() => setOrientation('auto')}
                      disabled={pageSize === 'fit'}
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      className={`jpg-segmented-btn ${orientation === 'portrait' ? 'active' : ''}`}
                      onClick={() => setOrientation('portrait')}
                      disabled={pageSize === 'fit'}
                    >
                      Portrait
                    </button>
                    <button
                      type="button"
                      className={`jpg-segmented-btn ${orientation === 'landscape' ? 'active' : ''}`}
                      onClick={() => setOrientation('landscape')}
                      disabled={pageSize === 'fit'}
                    >
                      Landscape
                    </button>
                  </div>
                </div>

                {/* Setting: Margin */}
                <div className="jpg-setting-group">
                  <label className="jpg-setting-label">Page Margins</label>
                  <div className="jpg-segmented-control">
                    <button
                      type="button"
                      className={`jpg-segmented-btn ${marginOption === 'none' ? 'active' : ''}`}
                      onClick={() => setMarginOption('none')}
                      disabled={pageSize === 'fit'}
                    >
                      No Margin
                    </button>
                    <button
                      type="button"
                      className={`jpg-segmented-btn ${marginOption === 'small' ? 'active' : ''}`}
                      onClick={() => setMarginOption('small')}
                      disabled={pageSize === 'fit'}
                    >
                      Small
                    </button>
                    <button
                      type="button"
                      className={`jpg-segmented-btn ${marginOption === 'medium' ? 'active' : ''}`}
                      onClick={() => setMarginOption('medium')}
                      disabled={pageSize === 'fit'}
                    >
                      Medium
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Convert Action Bar */}
            <div className="merge-action-bar">
              <button
                type="button"
                className="btn-merge-action btn-jpg-to-pdf-action"
                disabled={items.length === 0 || isProcessing}
                onClick={handleConvertToPdf}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={20} className="spinner-icon" />
                    <span>{progressText || 'Creating PDF...'}</span>
                  </>
                ) : (
                  <>
                    <FileImage size={20} />
                    <span>Convert {items.length} {items.length === 1 ? 'Image' : 'Images'} to PDF</span>
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
