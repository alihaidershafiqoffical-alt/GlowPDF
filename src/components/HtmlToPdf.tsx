import { useState, useRef } from 'react';
import { apiFetch } from '../lib/api';
import type { FC, DragEvent, ChangeEvent } from 'react';
import { 
  Upload, 
  Code, 
  FileCode, 
  Download, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  Loader2, 
  Info, 
  Sparkles, 
  Globe,
  Sliders,
  Palette,
  FileText
} from 'lucide-react';

interface HtmlToPdfProps {
  onBack: () => void;
}

interface ConversionResult {
  url: string;
  downloadName: string;
  pdfBytes: number;
  originalBytes?: number;
  pageCount: number;
  engine: string;
}

type InputMode = 'file' | 'code' | 'url';
type PageSize = 'a4' | 'letter';
type Orientation = 'portrait' | 'landscape';
type MarginSize = 'normal' | 'small' | 'none';

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sample Invoice & Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 30px;
      color: #1e293b;
      background: #f8fafc;
    }
    .header-card {
      background: linear-gradient(135deg, #b45309 0%, #d97706 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 24px;
      box-shadow: 0 10px 15px -3px rgba(180, 83, 9, 0.2);
    }
    .header-card h1 {
      margin: 0 0 8px 0;
      font-size: 26px;
      font-weight: 800;
    }
    .header-card p {
      margin: 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .grid-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: white;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .stat-title {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 700;
    }
    .stat-value {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
    }
    th {
      background: #f8fafc;
      font-weight: 700;
      color: #475569;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      background: #fef3c7;
      color: #b45309;
    }
  </style>
</head>
<body>
  <div class="header-card">
    <h1>Quarterly Performance Report</h1>
    <p>Generated dynamically using GlowPDF Real Browser Engine</p>
  </div>

  <div class="grid-stats">
    <div class="stat-card">
      <div class="stat-title">Fidelity</div>
      <div class="stat-value">100% Native</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Engine</div>
      <div class="stat-value">Chromium</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Visual CSS</div>
      <div class="stat-value">Full Support</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Document Element</th>
        <th>Visual Quality</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Gradients &amp; Shadows</td>
        <td>High-Fidelity CSS3 Rendering</td>
        <td><span class="badge">Preserved</span></td>
      </tr>
      <tr>
        <td>Tables &amp; Layouts</td>
        <td>Exact Grid / Flex Alignment</td>
        <td><span class="badge">Preserved</span></td>
      </tr>
      <tr>
        <td>Typography &amp; Fonts</td>
        <td>Standardized Print DPI</td>
        <td><span class="badge">Active</span></td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;

export const HtmlToPdf: FC<HtmlToPdfProps> = ({ onBack }) => {
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [htmlCode, setHtmlCode] = useState<string>('');
  const [webUrl, setWebUrl] = useState<string>('');
  
  // Page Options
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [margin, setMargin] = useState<MarginSize>('normal');
  const [printBackground, setPrintBackground] = useState<boolean>(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleProcessFile = (selectedFile: File) => {
    setErrorMessage(null);
    setResult(null);

    const isHtml = selectedFile.name.toLowerCase().endsWith('.html') || 
      selectedFile.name.toLowerCase().endsWith('.htm') ||
      selectedFile.type === 'text/html';

    if (!isHtml) {
      setErrorMessage('Only HTML (.html, .htm) files are supported. Please choose a valid HTML file.');
      return;
    }

    if (selectedFile.size === 0) {
      setErrorMessage('The selected HTML file is empty.');
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
    if (inputMode === 'file' && !file) return;
    if (inputMode === 'code' && !htmlCode.trim()) {
      setErrorMessage('Please enter some HTML code or load the sample template.');
      return;
    }
    if (inputMode === 'url' && !webUrl.trim()) {
      setErrorMessage('Please enter a website URL to convert.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressText(inputMode === 'url' ? 'Fetching webpage and launching Chromium...' : 'Submitting HTML to Chromium rendering engine...');

    try {
      const formData = new FormData();
      if (inputMode === 'file' && file) {
        formData.append('file', file);
      } else if (inputMode === 'code') {
        formData.append('html_text', htmlCode);
      } else if (inputMode === 'url') {
        formData.append('url', webUrl.trim());
      }
      formData.append('page_size', pageSize);
      formData.append('orientation', orientation);
      formData.append('margin', margin);
      formData.append('print_background', printBackground ? 'true' : 'false');

      setProgressText('Rendering CSS layout, typography & visual styling...');

      const response = await apiFetch('/api/convert-html-to-pdf', {
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

      setProgressText('Generating standardized, print-grade PDF document...');
      const pdfBlob = await response.blob();
      const url = URL.createObjectURL(pdfBlob);

      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      
      let defaultName = 'glowpdf_html_to_pdf.pdf';
      if (inputMode === 'file' && file) {
        const base = file.name.replace(/\.html?$/i, '');
        defaultName = `${base}.pdf`;
      }
      const downloadName = filenameMatch ? filenameMatch[1] : defaultName;

      const pagesHeader = response.headers.get('X-Total-Pages');
      const pageCount = pagesHeader ? parseInt(pagesHeader, 10) : 1;
      const engine = response.headers.get('X-Engine') || 'chromium';

      setResult({
        url,
        downloadName,
        pdfBytes: pdfBlob.size,
        originalBytes: file ? file.size : new Blob([htmlCode]).size,
        pageCount,
        engine,
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred during HTML to PDF conversion.'
      );
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const handleReset = () => {
    if (result && result.url) {
      URL.revokeObjectURL(result.url);
    }
    setFile(null);
    setHtmlCode('');
    setResult(null);
    setErrorMessage(null);
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.downloadName || 'glowpdf_html_to_pdf.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleLoadSample = () => {
    setHtmlCode(SAMPLE_HTML);
    setErrorMessage(null);
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
          <div className="tool-badge-pill" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>
            HTML to PDF
          </div>
        </div>

        {/* Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Convert HTML to PDF</h1>
          <p className="tool-main-subtitle">
            Convert HTML documents, CSS styling, tables, and web graphics into standardized, high-fidelity PDF documents using a real browser rendering engine.
          </p>
        </div>

        {/* Error banner */}
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
          accept=".html,.htm,text/html"
          style={{ display: 'none' }}
          id="html-to-pdf-input"
        />

        {/* COMPLETED / DOWNLOAD STATE */}
        {result ? (
          <div className="merge-result-card">
            <div className="result-icon-box" style={{ backgroundColor: '#fef3c7' }}>
              <CheckCircle2 size={36} color="#b45309" />
            </div>

            <h2 className="result-title">HTML converted to PDF successfully!</h2>
            <p className="result-desc">
              Your HTML page and CSS styling have been rendered with visual fidelity and exported as a standardized PDF.
            </p>

            {/* Layout preservation features badge banner */}
            <div className="word-features-badges">
              <span className="word-feature-badge">
                <Globe size={14} />
                <span>Real Chromium Browser Engine</span>
              </span>
              <span className="word-feature-badge">
                <Sparkles size={14} />
                <span>CSS3 Layout, Colors &amp; Fonts Preserved</span>
              </span>
              <span className="word-feature-badge">
                <Palette size={14} />
                <span>Gradients &amp; Background Graphics Retained</span>
              </span>
            </div>

            {/* Document stats */}
            <div className="word-stats-card">
              <div className="word-stat-item">
                <span className="word-stat-label">Output File</span>
                <span className="word-stat-value" title={result.downloadName}>{result.downloadName}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">PDF Size</span>
                <span className="word-stat-value">{formatFileSize(result.pdfBytes)}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">Page Count</span>
                <span className="word-stat-value">{result.pageCount}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">Format</span>
                <span className="word-stat-value" style={{ textTransform: 'uppercase' }}>
                  {pageSize} • {orientation}
                </span>
              </div>
            </div>

            {/* Privacy notice */}
            <div className="word-info-banner">
              <Info size={16} style={{ flexShrink: 0, color: '#b45309' }} />
              <span>
                100% private: Processed temporarily in memory and deleted immediately. No user files or documents are retained.
              </span>
            </div>

            {/* Actions */}
            <div className="result-actions-wrapper">
              <button
                type="button"
                className="btn-download-primary"
                onClick={handleDownload}
                style={{ backgroundColor: '#b45309' }}
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
                <span>Convert Another HTML Document</span>
              </button>
            </div>
          </div>
        ) : (
          /* WORKSPACE CARD WITH INPUT + OPTIONS */
          <div className="word-workspace-card" style={{ maxWidth: '840px', margin: '0 auto' }}>
            {/* Input Mode Selector */}
            <div style={{
              display: 'flex',
              gap: '8px',
              padding: '6px',
              background: '#f1f5f9',
              borderRadius: '10px',
              marginBottom: '20px'
            }}>
              <button
                type="button"
                onClick={() => { setInputMode('file'); setErrorMessage(null); }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: inputMode === 'file' ? '#ffffff' : 'transparent',
                  color: inputMode === 'file' ? '#b45309' : '#64748b',
                  boxShadow: inputMode === 'file' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                <Upload size={16} />
                <span>Upload HTML File</span>
              </button>
              <button
                type="button"
                onClick={() => { setInputMode('code'); setErrorMessage(null); }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: inputMode === 'code' ? '#ffffff' : 'transparent',
                  color: inputMode === 'code' ? '#b45309' : '#64748b',
                  boxShadow: inputMode === 'code' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                <Code size={16} />
                <span>Direct HTML Code</span>
              </button>
              <button
                type="button"
                onClick={() => { setInputMode('url'); setErrorMessage(null); }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: inputMode === 'url' ? '#ffffff' : 'transparent',
                  color: inputMode === 'url' ? '#b45309' : '#64748b',
                  boxShadow: inputMode === 'url' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                <Globe size={16} />
                <span>Webpage URL</span>
              </button>
            </div>

            {inputMode === 'file' ? (
              !file ? (
                /* FILE DROPZONE */
                <div 
                  className={`file-upload-dropzone ${isDraggingOver ? 'dragging-over' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload HTML file"
                  style={{ minHeight: '220px', padding: '30px 20px', border: '2px dashed #cbd5e1', borderRadius: '12px' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <div className="upload-icon-wrapper" style={{ backgroundColor: '#fef3c7', color: '#b45309', margin: '0 auto 16px' }}>
                    <FileCode size={36} />
                  </div>

                  <h2 className="upload-main-text" style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0' }}>
                    Choose HTML (.html) File
                  </h2>
                  <p className="upload-sub-text" style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
                    or drag &amp; drop your HTML file here
                  </p>

                  <button 
                    type="button" 
                    className="btn-select-files"
                    style={{ backgroundColor: '#b45309', color: '#ffffff', padding: '10px 22px', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <FileText size={18} />
                    <span>Select HTML Document</span>
                  </button>
                </div>
              ) : (
                /* SELECTED FILE CARD */
                <div className="split-file-header-card" style={{ marginBottom: '20px' }}>
                  <div className="split-file-icon-box" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>
                    <FileCode size={28} />
                  </div>
                  <div className="split-file-meta">
                    <h3 className="split-file-name" title={file.name}>{file.name}</h3>
                    <div className="split-file-details">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span className="word-page-count-badge" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>
                        HTML Document
                      </span>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    className="btn-change-file"
                    onClick={() => setFile(null)}
                    title="Choose a different file"
                  >
                    Change
                  </button>
                </div>
              )
            ) : inputMode === 'code' ? (
              /* RAW HTML EDITOR */
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label htmlFor="html-code-textarea" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Paste or Type HTML / CSS Code:
                  </label>
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#b45309',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Sparkles size={13} />
                    <span>Load Sample Template</span>
                  </button>
                </div>
                <textarea
                  id="html-code-textarea"
                  value={htmlCode}
                  onChange={(e) => setHtmlCode(e.target.value)}
                  placeholder="<!DOCTYPE html><html><head><style>...</style></head><body><h1>Hello World</h1></body></html>"
                  rows={9}
                  style={{
                    width: '100%',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    backgroundColor: '#f8fafc',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                  spellCheck={false}
                />
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', textAlign: 'right' }}>
                  {htmlCode.length} characters • {htmlCode.split('\n').length} lines
                </div>
              </div>
            ) : (
              /* URL INPUT */
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="webpage-url-input" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                  Enter Webpage URL (http:// or https://):
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Globe size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      id="webpage-url-input"
                      type="url"
                      value={webUrl}
                      onChange={(e) => setWebUrl(e.target.value)}
                      placeholder="https://en.wikipedia.org/wiki/PDF"
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 38px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        color: '#0f172a',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setWebUrl('https://en.wikipedia.org/wiki/PDF')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      color: '#b45309',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Load Sample URL
                  </button>
                </div>
              </div>
            )}

            {/* PAGE SETTINGS PANEL */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Sliders size={16} color="#b45309" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>PDF Page Settings</span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '14px'
              }}>
                {/* Page Size */}
                <div>
                  <label htmlFor="html-pdf-page-size" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Page Size
                  </label>
                  <select
                    id="html-pdf-page-size"
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as PageSize)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#1e293b'
                    }}
                  >
                    <option value="a4">A4 (Standard 210 × 297 mm)</option>
                    <option value="letter">US Letter (8.5 × 11 in)</option>
                  </select>
                </div>

                {/* Orientation */}
                <div>
                  <label htmlFor="html-pdf-orientation" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Orientation
                  </label>
                  <select
                    id="html-pdf-orientation"
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as Orientation)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#1e293b'
                    }}
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>

                {/* Margins */}
                <div>
                  <label htmlFor="html-pdf-margins" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Margins
                  </label>
                  <select
                    id="html-pdf-margins"
                    value={margin}
                    onChange={(e) => setMargin(e.target.value as MarginSize)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#1e293b'
                    }}
                  >
                    <option value="normal">Normal (15 mm)</option>
                    <option value="small">Small (6 mm)</option>
                    <option value="none">None (0 mm)</option>
                  </select>
                </div>

                {/* Background Graphics */}
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#334155',
                    cursor: 'pointer',
                    paddingBottom: '8px'
                  }}>
                    <input
                      type="checkbox"
                      checked={printBackground}
                      onChange={(e) => setPrintBackground(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#b45309' }}
                    />
                    <span>Background Graphics</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Convert Action Button */}
            <button
              type="button"
              className="btn-word-action"
              style={{
                backgroundColor: '#b45309',
                boxShadow: '0 4px 14px rgba(180, 83, 9, 0.35)',
                color: '#ffffff',
                width: '100%',
                padding: '14px 20px',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 700,
                border: 'none',
                cursor: (inputMode === 'file' && !file) || (inputMode === 'code' && !htmlCode.trim()) || (inputMode === 'url' && !webUrl.trim()) || isProcessing ? 'not-allowed' : 'pointer',
                opacity: (inputMode === 'file' && !file) || (inputMode === 'code' && !htmlCode.trim()) || (inputMode === 'url' && !webUrl.trim()) || isProcessing ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onClick={handleConvertToPdf}
              disabled={(inputMode === 'file' && !file) || (inputMode === 'code' && !htmlCode.trim()) || (inputMode === 'url' && !webUrl.trim()) || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={20} className="spinner-icon" />
                  <span>{progressText || 'Converting HTML to PDF...'}</span>
                </>
              ) : (
                <>
                  <Globe size={20} />
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

export default HtmlToPdf;
