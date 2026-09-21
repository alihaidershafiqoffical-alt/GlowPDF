import { useState, useRef } from 'react';
import type { FC, DragEvent, ChangeEvent } from 'react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { 
  Upload, 
  FileText, 
  Download, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft,
  Loader2,
  Scissors,
  Layers,
  FileArchive
} from 'lucide-react';

interface SplitPdfProps {
  onBack: () => void;
}

type SplitMode = 'range' | 'all';

interface SplitResult {
  url: string;
  filename: string;
  isZip: boolean;
  itemCount: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const SplitPdf: FC<SplitPdfProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [splitMode, setSplitMode] = useState<SplitMode>('range');
  const [rangeFrom, setRangeFrom] = useState<number>(1);
  const [rangeTo, setRangeTo] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<SplitResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleProcessFile = async (selectedFile: File) => {
    setErrorMessage(null);
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Only PDF files are supported. Please select a valid PDF.');
      return;
    }

    try {
      const buffer = await selectedFile.arrayBuffer();
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const count = doc.getPageCount();

      if (count < 1) {
        setErrorMessage('The selected PDF contains no pages.');
        return;
      }

      setFile(selectedFile);
      setTotalPages(count);
      setRangeFrom(1);
      setRangeTo(count);
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

  // Validate range
  const isRangeValid = 
    splitMode === 'all' || 
    (!isNaN(rangeFrom) && 
     !isNaN(rangeTo) && 
     rangeFrom >= 1 && 
     rangeTo <= totalPages && 
     rangeFrom <= rangeTo);

  const handleSplit = async () => {
    if (!file || totalPages < 1) return;

    if (!isRangeValid) {
      setErrorMessage(`Please specify a valid page range between 1 and ${totalPages}.`);
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const baseName = file.name.replace(/\.pdf$/i, '');

      if (splitMode === 'all') {
        // Mode 1: Split every page into individual PDF files and package into a ZIP
        const zip = new JSZip();

        for (let i = 0; i < totalPages; i++) {
          const singleDoc = await PDFDocument.create();
          const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
          singleDoc.addPage(copiedPage);
          const pdfBytes = await singleDoc.save();
          
          const padLength = totalPages >= 100 ? 3 : totalPages >= 10 ? 2 : 1;
          const pageNumStr = String(i + 1).padStart(padLength, '0');
          zip.file(`${baseName}_page_${pageNumStr}.pdf`, pdfBytes);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);

        setResult({
          url,
          filename: `${baseName}_split_pages.zip`,
          isZip: true,
          itemCount: totalPages,
        });
      } else {
        // Mode 2: Extract a selected page range into one combined PDF
        const rangeDoc = await PDFDocument.create();
        const pageIndices: number[] = [];
        for (let p = rangeFrom; p <= rangeTo; p++) {
          pageIndices.push(p - 1);
        }

        const copiedPages = await rangeDoc.copyPages(srcDoc, pageIndices);
        copiedPages.forEach((p) => rangeDoc.addPage(p));
        const pdfBytes = await rangeDoc.save();

        const pdfBlob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(pdfBlob);

        setResult({
          url,
          filename: `${baseName}_p${rangeFrom}-p${rangeTo}.pdf`,
          isZip: false,
          itemCount: pageIndices.length,
        });
      }
    } catch {
      setErrorMessage('Failed to split PDF. Please ensure the document is not password-protected.');
    } finally {
      setIsProcessing(false);
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
    setSplitMode('range');
    setRangeFrom(1);
    setRangeTo(1);
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
    <div className="split-pdf-page">
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
          <div className="tool-badge-pill tool-badge-split">Split PDF</div>
        </div>

        {/* Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Split PDF Document</h1>
          <p className="tool-main-subtitle">
            Extract a specific range of pages or split every page into separate individual documents.
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
          id="split-pdf-input"
        />

        {/* COMPLETED / DOWNLOAD STATE */}
        {result ? (
          <div className="merge-result-card">
            <div className="result-icon-box">
              {result.isZip ? (
                <FileArchive size={36} color="#16a34a" />
              ) : (
                <CheckCircle2 size={36} color="#16a34a" />
              )}
            </div>
            <h2 className="result-title">PDF split successfully!</h2>
            <p className="result-desc">
              {result.isZip
                ? `Split every page into ${result.itemCount} separate PDFs, packaged in a single ZIP archive.`
                : `Extracted ${result.itemCount} ${result.itemCount === 1 ? 'page' : 'pages'} into a new PDF document.`}
            </p>

            <div className="result-actions">
              <button 
                type="button" 
                className="btn-download-main" 
                onClick={handleDownload}
              >
                <Download size={18} />
                <span>
                  {result.isZip ? 'Download ZIP Archive' : 'Download Split PDF'}
                </span>
              </button>
              <button 
                type="button" 
                className="btn-reset-secondary" 
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                <span>Split Another PDF</span>
              </button>
            </div>
          </div>
        ) : !file ? (
          /* INITIAL UPLOAD STATE */
          <div
            className={`upload-dropzone ${isDraggingOver ? 'dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload PDF file to split"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="upload-icon-circle upload-icon-split">
              <Upload size={32} />
            </div>
            <h3 className="upload-prompt-title">Select a PDF file</h3>
            <p className="upload-prompt-subtitle">
              or drop PDF here
            </p>
            <button 
              type="button" 
              className="btn-select-files btn-select-split"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Choose PDF File
            </button>
          </div>
        ) : (
          /* CONFIGURE SPLIT OPTIONS STATE */
          <div className="split-workspace-card">
            {/* File Info Bar */}
            <div className="split-file-header">
              <div className="split-file-info">
                <div className="split-file-icon-box">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="split-file-name" title={file.name}>
                    {file.name}
                  </h3>
                  <div className="split-file-meta">
                    <span>{formatFileSize(file.size)}</span>
                    <span className="dot-sep">•</span>
                    <span className="split-page-count-badge">
                      {totalPages} {totalPages === 1 ? 'page' : 'pages'} total
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn-change-file"
                onClick={() => fileInputRef.current?.click()}
                title="Select a different PDF"
              >
                Change File
              </button>
            </div>

            {/* Split Mode Selector */}
            <div className="split-modes-container">
              <h4 className="split-section-label">Select Split Mode</h4>
              
              <div className="split-mode-options" role="radiogroup" aria-label="Split Options">
                {/* Option 1: Page Range */}
                <div
                  className={`split-mode-card ${splitMode === 'range' ? 'selected' : ''}`}
                  onClick={() => setSplitMode('range')}
                  role="radio"
                  aria-checked={splitMode === 'range'}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSplitMode('range');
                  }}
                >
                  <div className="split-mode-card-header">
                    <div className="split-mode-radio">
                      <div className="split-radio-inner" />
                    </div>
                    <div className="split-mode-title-wrap">
                      <div className="split-mode-title">
                        <Scissors size={18} />
                        <span>Extract Page Range</span>
                      </div>
                      <p className="split-mode-desc">
                        Extract a custom range of consecutive pages into one PDF.
                      </p>
                    </div>
                  </div>

                  {splitMode === 'range' && (
                    <div className="split-range-inputs-box" onClick={(e) => e.stopPropagation()}>
                      <div className="range-input-group">
                        <label htmlFor="range-from" className="range-input-label">From Page</label>
                        <input
                          id="range-from"
                          type="number"
                          min={1}
                          max={totalPages}
                          value={rangeFrom}
                          onChange={(e) => setRangeFrom(parseInt(e.target.value, 10) || 1)}
                          className="range-number-input"
                        />
                      </div>
                      <span className="range-to-sep">to</span>
                      <div className="range-input-group">
                        <label htmlFor="range-to" className="range-input-label">To Page</label>
                        <input
                          id="range-to"
                          type="number"
                          min={1}
                          max={totalPages}
                          value={rangeTo}
                          onChange={(e) => setRangeTo(parseInt(e.target.value, 10) || 1)}
                          className="range-number-input"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Option 2: Extract Every Page */}
                <div
                  className={`split-mode-card ${splitMode === 'all' ? 'selected' : ''}`}
                  onClick={() => setSplitMode('all')}
                  role="radio"
                  aria-checked={splitMode === 'all'}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSplitMode('all');
                  }}
                >
                  <div className="split-mode-card-header">
                    <div className="split-mode-radio">
                      <div className="split-radio-inner" />
                    </div>
                    <div className="split-mode-title-wrap">
                      <div className="split-mode-title">
                        <Layers size={18} />
                        <span>Extract All Pages</span>
                      </div>
                      <p className="split-mode-desc">
                        Separate every page into its own individual PDF and package into a ZIP.
                      </p>
                    </div>
                  </div>

                  {splitMode === 'all' && (
                    <div className="split-info-pill">
                      Produces {totalPages} separate PDF files packaged in a ZIP archive.
                    </div>
                  )}
                </div>
              </div>

              {!isRangeValid && (
                <div className="range-validation-error">
                  Please enter a valid page range between 1 and {totalPages}.
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="split-action-bar">
              <button
                type="button"
                className="btn-split-action"
                disabled={!isRangeValid || isProcessing}
                onClick={handleSplit}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={18} className="spinner-icon" />
                    <span>Splitting PDF...</span>
                  </>
                ) : (
                  <>
                    <Scissors size={18} />
                    <span>
                      {splitMode === 'all' 
                        ? `Split Into ${totalPages} Pages (ZIP)` 
                        : `Extract Pages ${rangeFrom}-${rangeTo}`}
                    </span>
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
