import { useState, useRef, useCallback, useEffect } from 'react';
import type { FC, DragEvent, ChangeEvent } from 'react';
import {
  PDFDocument,
  rgb,
  degrees,
  StandardFonts,
} from 'pdf-lib';
import {
  Upload,
  FileText,
  Download,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Stamp,
  Type,
  Image as ImageIcon,
  Settings2,
  Eye,
} from 'lucide-react';

interface WatermarkPdfProps {
  onBack: () => void;
}

type WatermarkType = 'text' | 'image';
type WatermarkPosition =
  | 'center'
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';
type PageRangeMode = 'all' | 'custom';

interface WatermarkResult {
  url: string;
  filename: string;
  totalBytes: number;
  pageCount: number;
  appliedToPages: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/** Parse page range string like "1-3, 5, 7-9" into 0-based indices */
const parsePageRange = (
  rangeStr: string,
  totalPages: number
): number[] | null => {
  const indices: Set<number> = new Set();
  const parts = rangeStr.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      if (n < 1 || n > totalPages) return null;
      indices.add(n - 1);
    } else if (/^\d+-\d+$/.test(part)) {
      const [a, b] = part.split('-').map(Number);
      if (a < 1 || b > totalPages || a > b) return null;
      for (let i = a; i <= b; i++) indices.add(i - 1);
    } else {
      return null;
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
};

/** Convert hex colour string to pdf-lib rgb() */
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
};

/** Calculate anchor point in PDF coordinates for a watermark element */
const calcPosition = (
  position: WatermarkPosition,
  pageWidth: number,
  pageHeight: number,
  elemWidth: number,
  elemHeight: number,
  margin = 36
): { x: number; y: number } => {
  const hw = elemWidth / 2;
  const hh = elemHeight / 2;

  const left = margin + hw;
  const centerX = pageWidth / 2;
  const right = pageWidth - margin - hw;
  const top = pageHeight - margin - hh;
  const centerY = pageHeight / 2;
  const bottom = margin + hh;

  const map: Record<WatermarkPosition, { x: number; y: number }> = {
    'top-left':     { x: left,    y: top    },
    'top-center':   { x: centerX, y: top    },
    'top-right':    { x: right,   y: top    },
    'middle-left':  { x: left,    y: centerY },
    center:         { x: centerX, y: centerY },
    'middle-right': { x: right,   y: centerY },
    'bottom-left':  { x: left,    y: bottom },
    'bottom-center':{ x: centerX, y: bottom },
    'bottom-right': { x: right,   y: bottom },
  };
  return map[position];
};

// Position grid options for UI
const POSITION_OPTIONS: { value: WatermarkPosition; label: string }[] = [
  { value: 'top-left',     label: 'Top Left'     },
  { value: 'top-center',   label: 'Top Center'   },
  { value: 'top-right',    label: 'Top Right'    },
  { value: 'middle-left',  label: 'Mid Left'     },
  { value: 'center',       label: 'Center'       },
  { value: 'middle-right', label: 'Mid Right'    },
  { value: 'bottom-left',  label: 'Bot Left'     },
  { value: 'bottom-center',label: 'Bot Center'   },
  { value: 'bottom-right', label: 'Bot Right'    },
];

export const WatermarkPdf: FC<WatermarkPdfProps> = ({ onBack }) => {
  // PDF file state
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Watermark options
  const [wmType, setWmType] = useState<WatermarkType>('text');
  const [wmText, setWmText] = useState('CONFIDENTIAL');
  const [wmFontSize, setWmFontSize] = useState(48);
  const [wmColor, setWmColor] = useState('#9333ea');
  const [wmOpacity, setWmOpacity] = useState(0.35);
  const [wmRotation, setWmRotation] = useState(-45);
  const [wmPosition, setWmPosition] = useState<WatermarkPosition>('center');
  const [wmImageScale, setWmImageScale] = useState(0.3);

  // Image watermark
  const [wmImageFile, setWmImageFile] = useState<File | null>(null);
  const [wmImagePreviewUrl, setWmImagePreviewUrl] = useState<string | null>(null);

  // Page range
  const [pageRangeMode, setPageRangeMode] = useState<PageRangeMode>('all');
  const [customRange, setCustomRange] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);

  // Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [result, setResult] = useState<WatermarkResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const revokeUrls = useCallback(() => {
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrlsRef.current = [];
  }, []);

  useEffect(() => () => revokeUrls(), [revokeUrls]);

  // ── PDF upload ────────────────────────────────────────────────────────────
  const handleProcessPdf = async (selectedFile: File) => {
    setErrorMessage(null);
    setResult(null);
    if (
      selectedFile.type !== 'application/pdf' &&
      !selectedFile.name.toLowerCase().endsWith('.pdf')
    ) {
      setErrorMessage('Please select a valid PDF file.');
      return;
    }
    try {
      const buf = await selectedFile.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const count = doc.getPageCount();
      if (count < 1) {
        setErrorMessage('The selected PDF contains no pages.');
        return;
      }
      setFile(selectedFile);
      setTotalPages(count);
      setCustomRange(`1-${count}`);
    } catch {
      setErrorMessage(
        'Could not open the PDF. Please verify it is not corrupted or password-protected.'
      );
    }
  };

  const handlePdfInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleProcessPdf(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files?.[0]) handleProcessPdf(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  // ── Image watermark upload ────────────────────────────────────────────────
  const handleImgInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isJpg = f.type === 'image/jpeg' || !!f.name.toLowerCase().match(/\.jpe?g$/);
    const isPng = f.type === 'image/png' || f.name.toLowerCase().endsWith('.png');
    if (!isJpg && !isPng) {
      setErrorMessage('Only JPG and PNG images are supported as watermarks.');
      return;
    }
    setErrorMessage(null);
    if (wmImagePreviewUrl) URL.revokeObjectURL(wmImagePreviewUrl);
    const previewUrl = URL.createObjectURL(f);
    setWmImageFile(f);
    setWmImagePreviewUrl(previewUrl);
    e.target.value = '';
  };

  // ── Range validation ──────────────────────────────────────────────────────
  const validateRange = (): number[] | null => {
    if (pageRangeMode === 'all') {
      return Array.from({ length: totalPages }, (_, i) => i);
    }
    const parsed = parsePageRange(customRange, totalPages);
    if (!parsed || parsed.length === 0) {
      setRangeError(
        `Invalid range. Use format like "1-3, 5, 7" (pages 1–${totalPages}).`
      );
      return null;
    }
    setRangeError(null);
    return parsed;
  };

  // ── Apply watermark ───────────────────────────────────────────────────────
  const handleApplyWatermark = async () => {
    if (!file) return;
    if (wmType === 'text' && !wmText.trim()) {
      setErrorMessage('Please enter watermark text.');
      return;
    }
    if (wmType === 'image' && !wmImageFile) {
      setErrorMessage('Please select an image to use as a watermark.');
      return;
    }

    const pageIndices = validateRange();
    if (!pageIndices) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressText('Loading PDF...');

    try {
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });

      // Embed image once if image watermark
      let embeddedImg: Awaited<ReturnType<typeof doc.embedJpg>> | null = null;
      if (wmType === 'image' && wmImageFile) {
        setProgressText('Embedding watermark image...');
        const imgBuf = await wmImageFile.arrayBuffer();
        const isJpg =
          wmImageFile.type === 'image/jpeg' ||
          !!wmImageFile.name.toLowerCase().match(/\.jpe?g$/);
        embeddedImg = isJpg
          ? await doc.embedJpg(imgBuf)
          : await doc.embedPng(imgBuf);
      }

      // Embed font once if text watermark
      const font =
        wmType === 'text'
          ? await doc.embedFont(StandardFonts.HelveticaBold)
          : null;

      const pages = doc.getPages();

      for (let idx = 0; idx < pageIndices.length; idx++) {
        const pageIdx = pageIndices[idx];
        setProgressText(
          `Applying watermark to page ${pageIdx + 1} (${idx + 1}/${pageIndices.length})...`
        );
        // yield to keep UI responsive on large PDFs
        await new Promise((r) => setTimeout(r, 4));

        const page = pages[pageIdx];
        const { width: pw, height: ph } = page.getSize();

        if (wmType === 'text' && font) {
          const text = wmText.trim();
          const approxTextWidth = font.widthOfTextAtSize(text, wmFontSize);
          const approxTextHeight = wmFontSize * 0.75;
          const c = hexToRgb(wmColor);

          const { x, y } = calcPosition(
            wmPosition,
            pw,
            ph,
            approxTextWidth,
            approxTextHeight
          );

          const rad = (wmRotation * Math.PI) / 180;
          const cosA = Math.cos(rad);
          const sinA = Math.sin(rad);
          const drawX = x - (approxTextWidth / 2 * cosA - approxTextHeight / 2 * sinA);
          const drawY = y - (approxTextWidth / 2 * sinA + approxTextHeight / 2 * cosA);

          page.drawText(text, {
            x: drawX,
            y: drawY,
            size: wmFontSize,
            font,
            color: rgb(c.r, c.g, c.b),
            opacity: wmOpacity,
            rotate: degrees(wmRotation),
          });
        } else if (wmType === 'image' && embeddedImg) {
          const scaledW = embeddedImg.width * wmImageScale;
          const scaledH = embeddedImg.height * wmImageScale;

          const { x, y } = calcPosition(wmPosition, pw, ph, scaledW, scaledH);
          const rad = (wmRotation * Math.PI) / 180;
          const cosA = Math.cos(rad);
          const sinA = Math.sin(rad);
          const drawX = x - (scaledW / 2 * cosA - scaledH / 2 * sinA);
          const drawY = y - (scaledW / 2 * sinA + scaledH / 2 * cosA);

          page.drawImage(embeddedImg, {
            x: drawX,
            y: drawY,
            width: scaledW,
            height: scaledH,
            opacity: wmOpacity,
            rotate: degrees(wmRotation),
          });
        }
      }

      setProgressText('Saving PDF...');
      const pdfBytes = await doc.save();
      const pdfBlob = new Blob([pdfBytes as unknown as ArrayBuffer], {
        type: 'application/pdf',
      });
      const pdfUrl = URL.createObjectURL(pdfBlob);
      objectUrlsRef.current.push(pdfUrl);

      const baseName = file.name.replace(/\.pdf$/i, '');
      const outputFilename = `${baseName}_watermarked.pdf`;

      setResult({
        url: pdfUrl,
        filename: outputFilename,
        totalBytes: pdfBlob.size,
        pageCount: totalPages,
        appliedToPages: pageIndices.length,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'An error occurred while applying the watermark.';
      setErrorMessage(`Processing failed: ${msg}`);
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setFile(null);
    setTotalPages(0);
    setResult(null);
    setErrorMessage(null);
    setRangeError(null);
    setWmImageFile(null);
    if (wmImagePreviewUrl) URL.revokeObjectURL(wmImagePreviewUrl);
    setWmImagePreviewUrl(null);
    revokeUrls();
  };

  // ── Computed preview position ─────────────────────────────────────────────
  const previewPositionStyle = (() => {
    const styleMap: Record<WatermarkPosition, React.CSSProperties> = {
      'top-left':     { top: '10%', left: '15%',  transform: 'translate(-50%, -50%)' },
      'top-center':   { top: '10%', left: '50%',  transform: 'translate(-50%, -50%)' },
      'top-right':    { top: '10%', left: '85%',  transform: 'translate(-50%, -50%)' },
      'middle-left':  { top: '50%', left: '15%',  transform: 'translate(-50%, -50%)' },
      center:         { top: '50%', left: '50%',  transform: 'translate(-50%, -50%)' },
      'middle-right': { top: '50%', left: '85%',  transform: 'translate(-50%, -50%)' },
      'bottom-left':  { top: '90%', left: '15%',  transform: 'translate(-50%, -50%)' },
      'bottom-center':{ top: '90%', left: '50%',  transform: 'translate(-50%, -50%)' },
      'bottom-right': { top: '90%', left: '85%',  transform: 'translate(-50%, -50%)' },
    };
    return styleMap[wmPosition];
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="watermark-pdf-page">
      <div className="container">

        {/* Top Bar */}
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
          <div className="tool-badge-pill tool-badge-watermark">Watermark PDF</div>
        </div>

        {/* Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Watermark PDF</h1>
          <p className="tool-main-subtitle">
            Stamp custom text or image watermarks across your PDF pages. Control
            position, opacity, and rotation — 100% private, processed in your browser.
          </p>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="tool-alert-banner error" role="alert">
            <AlertCircle size={18} className="tool-alert-icon" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Hidden file inputs */}
        <input
          type="file"
          ref={pdfInputRef}
          onChange={handlePdfInputChange}
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          id="watermark-pdf-file-input"
        />
        <input
          type="file"
          ref={imgInputRef}
          onChange={handleImgInputChange}
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          style={{ display: 'none' }}
          id="watermark-img-file-input"
        />

        {/* ── RESULT ─────────────────────────────────────────────────────── */}
        {result ? (
          <div className="merge-result-card">
            <div className="result-icon-box" style={{ backgroundColor: '#f3e8ff' }}>
              <CheckCircle2 size={36} color="#9333ea" />
            </div>
            <h2 className="result-title">Watermark applied!</h2>
            <p className="result-desc">
              Your PDF has been watermarked. Download it below.
            </p>

            <div className="word-stats-row">
              <div className="word-stat-item">
                <span className="word-stat-label">Total Pages</span>
                <span className="word-stat-value">{result.pageCount}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">Watermarked</span>
                <span className="word-stat-value">{result.appliedToPages}</span>
              </div>
              <div className="word-stat-item">
                <span className="word-stat-label">File Size</span>
                <span className="word-stat-value">{formatFileSize(result.totalBytes)}</span>
              </div>
            </div>

            <div className="result-actions-wrapper">
              <button
                type="button"
                className="btn-download-primary"
                onClick={handleDownload}
                style={{ backgroundColor: '#9333ea' }}
              >
                <Download size={20} />
                <span>Download Watermarked PDF</span>
              </button>
              <button
                type="button"
                className="btn-restart-action"
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                <span>Watermark Another PDF</span>
              </button>
            </div>
          </div>

        ) : !file ? (
          /* ── UPLOAD DROPZONE ───────────────────────────────────────────── */
          <div
            className={`file-upload-dropzone ${isDraggingOver ? 'dragging-over' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => pdfInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload PDF to watermark"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') pdfInputRef.current?.click();
            }}
          >
            <div className="upload-icon-wrapper upload-icon-watermark">
              <Upload size={36} />
            </div>
            <h2 className="upload-main-text">Choose PDF to Watermark</h2>
            <p className="upload-sub-text">or drag and drop your PDF here</p>
            <button
              type="button"
              className="btn-select-files btn-select-watermark"
              onClick={(e) => { e.stopPropagation(); pdfInputRef.current?.click(); }}
            >
              <FileText size={18} />
              <span>Select PDF File</span>
            </button>
            <p className="upload-privacy-note">
              100% private: Your file never leaves your browser. No uploads, no storage.
            </p>
          </div>

        ) : (
          /* ── WORKSPACE ─────────────────────────────────────────────────── */
          <div className="wm-workspace">

            {/* File bar */}
            <div className="wm-file-bar">
              <div className="wm-file-info">
                <div className="wm-file-icon-box">
                  <FileText size={22} />
                </div>
                <div>
                  <p className="wm-file-name" title={file.name}>{file.name}</p>
                  <p className="wm-file-meta">
                    {formatFileSize(file.size)}
                    <span className="dot-sep">·</span>
                    <span className="wm-page-badge">
                      {totalPages} {totalPages === 1 ? 'page' : 'pages'}
                    </span>
                  </p>
                </div>
              </div>
              <button type="button" className="btn-change-file" onClick={handleReset}>
                Change
              </button>
            </div>

            <div className="wm-two-col">
              {/* ── Options Panel ─────────────────────────────────────── */}
              <div className="wm-options-panel">

                {/* Type toggle */}
                <div className="wm-section">
                  <div className="wm-section-header">
                    <Settings2 size={15} color="#9333ea" />
                    <span className="wm-section-title">Watermark Type</span>
                  </div>
                  <div className="wm-type-toggle">
                    <button
                      type="button"
                      className={`wm-type-btn ${wmType === 'text' ? 'active' : ''}`}
                      onClick={() => setWmType('text')}
                    >
                      <Type size={15} />
                      <span>Text</span>
                    </button>
                    <button
                      type="button"
                      className={`wm-type-btn ${wmType === 'image' ? 'active' : ''}`}
                      onClick={() => setWmType('image')}
                    >
                      <ImageIcon size={15} />
                      <span>Image</span>
                    </button>
                  </div>
                </div>

                {/* Text options */}
                {wmType === 'text' && (
                  <div className="wm-section">
                    <div className="wm-field-group">
                      <label className="wm-field-label">Watermark Text</label>
                      <input
                        type="text"
                        className="wm-text-input"
                        value={wmText}
                        onChange={(e) => setWmText(e.target.value)}
                        placeholder="Enter watermark text…"
                        maxLength={80}
                      />
                    </div>
                    <div className="wm-two-fields">
                      <div className="wm-field-group">
                        <label className="wm-field-label">Font Size ({wmFontSize}pt)</label>
                        <input
                          type="range"
                          className="wm-range"
                          min={10}
                          max={120}
                          step={2}
                          value={wmFontSize}
                          onChange={(e) => setWmFontSize(Number(e.target.value))}
                        />
                        <div className="wm-range-labels"><span>10</span><span>120</span></div>
                      </div>
                      <div className="wm-field-group">
                        <label className="wm-field-label">Colour</label>
                        <div className="wm-color-row">
                          <input
                            type="color"
                            className="wm-color-input"
                            value={wmColor}
                            onChange={(e) => setWmColor(e.target.value)}
                          />
                          <span className="wm-color-hex">{wmColor.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Image options */}
                {wmType === 'image' && (
                  <div className="wm-section">
                    <div className="wm-field-group">
                      <label className="wm-field-label">Watermark Image</label>
                      {wmImagePreviewUrl ? (
                        <div className="wm-img-preview-row">
                          <img
                            src={wmImagePreviewUrl}
                            alt="Watermark preview"
                            className="wm-img-thumb"
                          />
                          <div className="wm-img-info">
                            <span className="wm-img-name">{wmImageFile?.name}</span>
                            <button
                              type="button"
                              className="wm-img-change"
                              onClick={() => imgInputRef.current?.click()}
                            >
                              Change Image
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="wm-img-select-btn"
                          onClick={() => imgInputRef.current?.click()}
                        >
                          <ImageIcon size={16} />
                          <span>Select Image (JPG / PNG)</span>
                        </button>
                      )}
                    </div>
                    <div className="wm-field-group">
                      <label className="wm-field-label">
                        Scale ({Math.round(wmImageScale * 100)}%)
                      </label>
                      <input
                        type="range"
                        className="wm-range"
                        min={5}
                        max={100}
                        step={5}
                        value={Math.round(wmImageScale * 100)}
                        onChange={(e) => setWmImageScale(Number(e.target.value) / 100)}
                      />
                      <div className="wm-range-labels"><span>5%</span><span>100%</span></div>
                    </div>
                  </div>
                )}

                {/* Shared controls: opacity + rotation */}
                <div className="wm-section">
                  <div className="wm-two-fields">
                    <div className="wm-field-group">
                      <label className="wm-field-label">
                        Opacity ({Math.round(wmOpacity * 100)}%)
                      </label>
                      <input
                        type="range"
                        className="wm-range"
                        min={5}
                        max={100}
                        step={5}
                        value={Math.round(wmOpacity * 100)}
                        onChange={(e) => setWmOpacity(Number(e.target.value) / 100)}
                      />
                      <div className="wm-range-labels"><span>5%</span><span>100%</span></div>
                    </div>
                    <div className="wm-field-group">
                      <label className="wm-field-label">Rotation ({wmRotation}°)</label>
                      <input
                        type="range"
                        className="wm-range"
                        min={-180}
                        max={180}
                        step={5}
                        value={wmRotation}
                        onChange={(e) => setWmRotation(Number(e.target.value))}
                      />
                      <div className="wm-range-labels"><span>-180°</span><span>180°</span></div>
                    </div>
                  </div>
                </div>

                {/* Position grid */}
                <div className="wm-section">
                  <div className="wm-field-label" style={{ marginBottom: 10 }}>Position</div>
                  <div className="wm-position-grid">
                    {POSITION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`wm-pos-btn ${wmPosition === opt.value ? 'active' : ''}`}
                        onClick={() => setWmPosition(opt.value)}
                        title={opt.label}
                        aria-label={opt.label}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Page range */}
                <div className="wm-section">
                  <div className="wm-section-header" style={{ marginBottom: 10 }}>
                    <Stamp size={15} color="#9333ea" />
                    <span className="wm-section-title">Apply To Pages</span>
                  </div>
                  <div className="wm-type-toggle">
                    <button
                      type="button"
                      className={`wm-type-btn ${pageRangeMode === 'all' ? 'active' : ''}`}
                      onClick={() => { setPageRangeMode('all'); setRangeError(null); }}
                    >
                      All Pages
                    </button>
                    <button
                      type="button"
                      className={`wm-type-btn ${pageRangeMode === 'custom' ? 'active' : ''}`}
                      onClick={() => setPageRangeMode('custom')}
                    >
                      Custom Range
                    </button>
                  </div>
                  {pageRangeMode === 'custom' && (
                    <div className="wm-field-group" style={{ marginTop: 10 }}>
                      <input
                        type="text"
                        className={`wm-text-input${rangeError ? ' wm-input-error' : ''}`}
                        value={customRange}
                        onChange={(e) => { setCustomRange(e.target.value); setRangeError(null); }}
                        placeholder={`e.g. 1-3, 5, 7-9 (max: ${totalPages})`}
                      />
                      <p className="wm-range-hint">
                        Comma-separated pages or ranges. Pages 1–{totalPages}.
                      </p>
                      {rangeError && (
                        <p className="wm-range-error">{rangeError}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Apply button */}
                <button
                  type="button"
                  className="btn-wm-apply"
                  disabled={isProcessing}
                  onClick={handleApplyWatermark}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={18} className="spinner-icon" />
                      <span>{progressText || 'Processing…'}</span>
                    </>
                  ) : (
                    <>
                      <Stamp size={18} />
                      <span>Apply Watermark</span>
                    </>
                  )}
                </button>
              </div>

              {/* ── Preview Panel ──────────────────────────────────────── */}
              <div className="wm-preview-panel">
                <div className="wm-preview-header">
                  <Eye size={15} color="#9333ea" />
                  <span className="wm-section-title">Preview</span>
                  <span className="wm-preview-note">Approximate — actual PDF may vary</span>
                </div>

                <div className="wm-preview-page">
                  {/* Page content lines */}
                  <div className="wm-preview-lines">
                    {[1,2,3,4,5,6,7].map((i) => (
                      <div
                        key={i}
                        className="wm-preview-line"
                        style={{ width: `${55 + (i % 3) * 15}%` }}
                      />
                    ))}
                  </div>

                  {/* Watermark overlay */}
                  <div
                    className="wm-preview-mark"
                    style={{
                      ...previewPositionStyle,
                      opacity: wmOpacity,
                      transform: `${previewPositionStyle.transform ?? ''} rotate(${wmRotation}deg)`,
                    }}
                  >
                    {wmType === 'text' ? (
                      <span
                        style={{
                          fontSize: Math.max(8, Math.min(wmFontSize * 0.38, 28)),
                          fontWeight: 700,
                          color: wmColor,
                          whiteSpace: 'nowrap',
                          fontFamily: 'sans-serif',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {wmText || 'Watermark'}
                      </span>
                    ) : wmImagePreviewUrl ? (
                      <img
                        src={wmImagePreviewUrl}
                        alt="watermark"
                        style={{
                          width: `${Math.max(20, wmImageScale * 100)}px`,
                          height: 'auto',
                          maxWidth: '80%',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Select image</span>
                    )}
                  </div>
                </div>

                {/* Legend */}
                <div className="wm-preview-legend">
                  <span>Type: <strong>{wmType}</strong></span>
                  <span>Position: <strong>{wmPosition.replace(/-/g, ' ')}</strong></span>
                  <span>Opacity: <strong>{Math.round(wmOpacity * 100)}%</strong></span>
                  <span>Rotation: <strong>{wmRotation}°</strong></span>
                  <span>Pages: <strong>{pageRangeMode === 'all' ? 'All' : customRange}</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
