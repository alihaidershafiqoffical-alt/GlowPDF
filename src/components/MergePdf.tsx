import { useState, useRef } from 'react';
import type { FC, DragEvent, ChangeEvent } from 'react';
import { PDFDocument } from 'pdf-lib';
import { 
  Upload, 
  FileText, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  RotateCcw, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft,
  Loader2
} from 'lucide-react';

interface PdfFileItem {
  id: string;
  file: File;
  name: string;
  size: string;
  pages: number | null;
}

interface MergePdfProps {
  onBack: () => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const MergePdf: FC<MergePdfProps> = ({ onBack }) => {
  const [items, setItems] = useState<PdfFileItem[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processFiles = async (fileList: FileList | File[]) => {
    setErrorMessage(null);
    const validPdfs: File[] = [];
    let hadInvalid = false;

    Array.from(fileList).forEach((file) => {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        validPdfs.push(file);
      } else {
        hadInvalid = true;
      }
    });

    if (hadInvalid) {
      setErrorMessage('Only PDF files are supported. Non-PDF files were ignored.');
    }

    if (validPdfs.length === 0) {
      return;
    }

    const newItems: PdfFileItem[] = [];

    for (const file of validPdfs) {
      const id = `${file.name}-${file.lastModified}-${Math.random()}`;
      let pageCount: number | null = null;

      try {
        const buffer = await file.arrayBuffer();
        const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        pageCount = doc.getPageCount();
      } catch {
        // Fallback gracefully if page counting encounters an issue
        pageCount = null;
      }

      newItems.push({
        id,
        file,
        name: file.name,
        size: formatFileSize(file.size),
        pages: pageCount,
      });
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
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

  const handleMerge = async () => {
    if (items.length < 2) {
      setErrorMessage('Please add at least 2 PDF files to merge.');
      return;
    }

    setIsMerging(true);
    setErrorMessage(null);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const item of items) {
        const buffer = await item.file.arrayBuffer();
        const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setMergedUrl(url);
    } catch {
      setErrorMessage('Unable to merge files. Please verify the files are valid, unencrypted PDFs.');
    } finally {
      setIsMerging(false);
    }
  };

  const handleReset = () => {
    if (mergedUrl) {
      URL.revokeObjectURL(mergedUrl);
    }
    setItems([]);
    setMergedUrl(null);
    setErrorMessage(null);
  };

  const handleDownload = () => {
    if (!mergedUrl) return;
    const a = document.createElement('a');
    a.href = mergedUrl;
    a.download = 'glowpdf_merged.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Drag and drop card reordering
  const onCardDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const onCardDragOver = (e: DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newItems = [...items];
    const [moved] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, moved);
    setDraggedIndex(targetIndex);
    setItems(newItems);
  };

  const onCardDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="merge-pdf-page">
      <div className="container">
        {/* Navigation Breadcrumb / Back button */}
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
          <div className="tool-badge-pill">Merge PDF</div>
        </div>

        {/* Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Merge PDF Files</h1>
          <p className="tool-main-subtitle">
            Combine multiple PDFs into a single document in your exact preferred order.
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
          multiple
          style={{ display: 'none' }}
          id="merge-pdf-input"
        />

        {/* COMPLETED / DOWNLOAD STATE */}
        {mergedUrl ? (
          <div className="merge-result-card">
            <div className="result-icon-box">
              <CheckCircle2 size={36} color="#16a34a" />
            </div>
            <h2 className="result-title">PDFs have been merged!</h2>
            <p className="result-desc">
              Your {items.length} PDF files were successfully combined into one document.
            </p>

            <div className="result-actions">
              <button 
                type="button" 
                className="btn-download-main" 
                onClick={handleDownload}
              >
                <Download size={18} />
                <span>Download Merged PDF</span>
              </button>
              <button 
                type="button" 
                className="btn-reset-secondary" 
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                <span>Merge More Files</span>
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          /* INITIAL UPLOAD STATE */
          <div
            className={`upload-dropzone ${isDraggingOver ? 'dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload PDF files"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="upload-icon-circle">
              <Upload size={32} />
            </div>
            <h3 className="upload-prompt-title">Select PDF files</h3>
            <p className="upload-prompt-subtitle">
              or drop PDFs here
            </p>
            <button 
              type="button" 
              className="btn-select-files"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Choose PDF Files
            </button>
          </div>
        ) : (
          /* ARRANGE & REORDER STATE */
          <div className="arrange-container">
            <div className="arrange-toolbar">
              <div className="arrange-stats">
                <span className="file-count-badge">
                  {items.length} {items.length === 1 ? 'file' : 'files'} selected
                </span>
                {items.length < 2 && (
                  <span className="file-count-hint">
                    Add at least 1 more file to enable merging
                  </span>
                )}
              </div>

              <div className="arrange-toolbar-actions">
                <button
                  type="button"
                  className="btn-add-more"
                  onClick={() => fileInputRef.current?.click()}
                  title="Add more PDF files"
                >
                  <Plus size={16} />
                  <span>Add More Files</span>
                </button>
                <button
                  type="button"
                  className="btn-clear-all"
                  onClick={handleReset}
                  title="Clear all selected files"
                >
                  <Trash2 size={16} />
                  <span>Clear All</span>
                </button>
              </div>
            </div>

            {/* Grid of reorderable file cards */}
            <div className="pdf-cards-grid" role="list" aria-label="PDF files list">
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
                    <span className="pdf-card-order">#{index + 1}</span>
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

                  <div className="pdf-card-preview">
                    <FileText size={40} className="pdf-file-icon" />
                    {item.pages !== null && (
                      <span className="pdf-pages-badge">
                        {item.pages} {item.pages === 1 ? 'page' : 'pages'}
                      </span>
                    )}
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
                    <span className="order-label">Order</span>
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

            {/* Bottom Merge Action Bar */}
            <div className="merge-action-bar">
              <button
                type="button"
                className="btn-merge-action"
                disabled={items.length < 2 || isMerging}
                onClick={handleMerge}
              >
                {isMerging ? (
                  <>
                    <Loader2 size={18} className="spinner-icon" />
                    <span>Merging PDFs...</span>
                  </>
                ) : (
                  <>
                    <span>Merge PDF ({items.length})</span>
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
