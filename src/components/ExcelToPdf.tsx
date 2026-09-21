import { useState, useRef } from 'react';
import { apiFetch } from '../lib/api';
import type { FC, DragEvent, ChangeEvent } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  Loader2, 
  Info, 
  Layers, 
  Table, 
  Sparkles,
  FileCheck
} from 'lucide-react';

interface ExcelToPdfProps {
  onBack: () => void;
}

interface ConversionResult {
  url: string;
  downloadName: string;
  pdfBytes: number;
  originalBytes: number;
  pageCount: number;
  worksheets: number;
  rows: number;
  cells: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const ExcelToPdf: FC<ExcelToPdfProps> = ({ onBack }) => {
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

    const isExcel = selectedFile.name.toLowerCase().endsWith('.xlsx') || 
                    selectedFile.name.toLowerCase().endsWith('.xls') ||
                    selectedFile.type.includes('spreadsheet') ||
                    selectedFile.type.includes('excel');

    if (!isExcel) {
      setErrorMessage('Only Excel spreadsheets (.xlsx, .xls) are supported. Please select a valid Excel document.');
      return;
    }

    if (selectedFile.size === 0) {
      setErrorMessage('The selected Excel spreadsheet is empty.');
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
    setProgressText('Uploading spreadsheet to conversion engine...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProgressText('Analyzing worksheets, cell styling & table layout...');

      const response = await apiFetch('/api/convert-excel-to-pdf', {
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

      setProgressText('Rendering high-fidelity vector PDF pages...');
      const pdfBlob = await response.blob();
      const url = URL.createObjectURL(pdfBlob);

      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const baseName = file.name.replace(/\.(xlsx|xls)$/i, '') || 'spreadsheet';
      const downloadName = filenameMatch ? filenameMatch[1] : `${baseName}.pdf`;

      const pagesHeader = response.headers.get('X-Total-Pages');
      const pageCount = pagesHeader ? parseInt(pagesHeader, 10) : 1;

      const sheetsHeader = response.headers.get('X-Total-Worksheets');
      const worksheets = sheetsHeader ? parseInt(sheetsHeader, 10) : 1;

      const rowsHeader = response.headers.get('X-Total-Rows');
      const rows = rowsHeader ? parseInt(rowsHeader, 10) : 0;

      const cellsHeader = response.headers.get('X-Total-Cells');
      const cells = cellsHeader ? parseInt(cellsHeader, 10) : 0;

      setResult({
        url,
        downloadName,
        pdfBytes: pdfBlob.size,
        originalBytes: file.size,
        pageCount,
        worksheets,
        rows,
        cells
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
    setResult(null);
    setErrorMessage(null);
    setIsProcessing(false);
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.downloadName || 'spreadsheet.pdf';
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
          <div className="tool-badge-pill tool-badge-excel">
            <FileSpreadsheet size={14} className="mr-1 inline" />
            <span>Excel to PDF</span>
          </div>
        </div>

        {/* Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Convert Excel to PDF</h1>
          <p className="tool-main-subtitle">
            Convert Microsoft Excel spreadsheets (.xlsx, .xls) into standard PDF documents with worksheets, cell formatting, gridlines, and tables preserved.
          </p>
        </div>

        {/* Error Notification */}
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
          onChange={handleFileInputChange}
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          style={{ display: 'none' }}
          id="excel-input"
        />

        {/* COMPLETED / DOWNLOAD STATE */}
        {result && file ? (
          <div className="merge-result-card">
            <div className="result-icon-box" style={{ backgroundColor: '#dcfce7' }}>
              <CheckCircle2 size={36} color="#15803d" />
            </div>

            <h2 className="result-title">Spreadsheet Converted Successfully!</h2>
            <p className="result-desc">
              Your Excel spreadsheet has been transformed into a publication-ready PDF document with worksheets and cell structures intact.
            </p>

            {/* Badges Banner */}
            <div className="word-features-badges">
              <span className="word-feature-badge" style={{ backgroundColor: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' }}>
                <Layers size={14} />
                <span>Worksheets Preserved ({result.worksheets})</span>
              </span>
              <span className="word-feature-badge">
                <Table size={14} />
                <span>Table &amp; Border Alignment</span>
              </span>
              <span className="word-feature-badge">
                <FileCheck size={14} />
                <span>Vector Typography &amp; Gridlines</span>
              </span>
            </div>

            {/* Stats */}
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

            {/* Info Notice */}
            <div className="word-info-banner">
              <Info size={16} style={{ flexShrink: 0, color: '#16a34a' }} />
              <span>
                Engine Note: Rendered with high-precision table geometry. Worksheets are formatted into vector pages with automatic aspect ratio fitting.
              </span>
            </div>

            {/* Actions */}
            <div className="result-actions-wrapper">
              <button
                type="button"
                className="btn-download-primary btn-excel-action"
                onClick={handleDownload}
              >
                <Download size={20} />
                <span>Download PDF Document</span>
              </button>

              <button
                type="button"
                className="btn-restart-action"
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                <span>Convert Another Spreadsheet</span>
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
            aria-label="Upload Excel spreadsheet to convert to PDF"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="upload-icon-wrapper upload-icon-excel">
              <FileSpreadsheet size={36} />
            </div>

            <h2 className="upload-main-text">Choose Excel File to Convert</h2>
            <p className="upload-sub-text">or drag and drop your spreadsheet (.xlsx, .xls) here</p>

            <button 
              type="button" 
              className="btn-select-files btn-select-excel"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <FileSpreadsheet size={18} />
              <span>Select Excel File</span>
            </button>

            <p className="upload-privacy-note">
              100% private: Processed temporarily in-memory and deleted immediately. No files are stored.
            </p>
          </div>
        ) : (
          /* WORKSPACE CARD / CONVERT ACTION */
          <div className="word-workspace-card">
            <div className="split-file-header-card">
              <div className="split-file-icon-box" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>
                <FileSpreadsheet size={28} />
              </div>
              <div className="split-file-meta">
                <h3 className="split-file-name" title={file.name}>{file.name}</h3>
                <div className="split-file-details">
                  <span>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span className="excel-page-count-badge">Excel Document</span>
                </div>
              </div>
              <button 
                type="button" 
                className="btn-change-file"
                onClick={handleReset}
                title="Choose a different spreadsheet"
              >
                Change
              </button>
            </div>

            {/* Feature preview list */}
            <div className="word-features-panel">
              <div className="word-feature-item">
                <div className="word-feature-icon">
                  <Layers size={16} />
                </div>
                <div>
                  <span className="word-feature-title">Multi-Sheet Conversion</span>
                  <span className="word-feature-desc">All active worksheets rendered sequentially in correct sheet order.</span>
                </div>
              </div>

              <div className="word-feature-item">
                <div className="word-feature-icon">
                  <Table size={16} />
                </div>
                <div>
                  <span className="word-feature-title">Table &amp; Grid Fidelity</span>
                  <span className="word-feature-desc">Preserves cell formatting, numbers, formulas, borders, and column proportions.</span>
                </div>
              </div>

              <div className="word-feature-item">
                <div className="word-feature-icon">
                  <Sparkles size={16} />
                </div>
                <div>
                  <span className="word-feature-title">Dynamic Page Layout</span>
                  <span className="word-feature-desc">Automatic landscape or portrait orientation based on table width.</span>
                </div>
              </div>
            </div>

            {/* Convert action button */}
            <button
              type="button"
              className="btn-word-action btn-excel-action"
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
                  <Sparkles size={20} />
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
