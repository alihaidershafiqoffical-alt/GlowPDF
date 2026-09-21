import { useState, useRef, useEffect, useCallback } from 'react';
import type { FC, DragEvent, ChangeEvent, FormEvent } from 'react';
import { PDFDocument } from '@cantoo/pdf-lib';
import { 
  Unlock, 
  Upload, 
  FileText, 
  Download, 
  RotateCcw, 
  AlertCircle, 
  ArrowLeft, 
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  KeyRound,
  ShieldAlert
} from 'lucide-react';

interface UnlockPdfProps {
  onBack: () => void;
}

interface UnlockResult {
  url: string;
  originalBytes: number;
  unlockedBytes: number;
  pageCount: number;
  filename: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const UnlockPdf: FC<UnlockPdfProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [isProtected, setIsProtected] = useState<boolean>(false);
  const [pageCount, setPageCount] = useState<number>(0);
  
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<UnlockResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  // Cleanup object URLs on unmount or reset
  const cleanupUrls = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      cleanupUrls();
    };
  }, [cleanupUrls]);

  const handleProcessFile = async (selectedFile: File) => {
    setErrorMessage(null);
    setResult(null);
    setPassword('');

    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Only PDF files are supported. Please select a valid PDF file.');
      return;
    }

    try {
      const buffer = await selectedFile.arrayBuffer();
      setFileBytes(buffer);
      setFile(selectedFile);

      // Check whether document is encrypted or already open
      try {
        const doc = await PDFDocument.load(buffer);
        // If it loaded without error, the document is NOT password protected
        setPageCount(doc.getPageCount());
        setIsProtected(false);
        setErrorMessage('This PDF document is not password protected. No decryption is necessary.');
      } catch (loadErr: unknown) {
        const errMsg = loadErr instanceof Error ? loadErr.message : '';
        if (errMsg.includes('encrypted') || errMsg.includes('password') || errMsg.includes('EncryptedPDFError')) {
          setIsProtected(true);
          // Try to get page count by loading with ignoreEncryption
          try {
            const tempDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
            setPageCount(tempDoc.getPageCount());
          } catch {
            setPageCount(0);
          }
        } else {
          setErrorMessage('Could not open the selected PDF. Please verify it is a valid, uncorrupted document.');
          setFile(null);
          setFileBytes(null);
        }
      }
    } catch {
      setErrorMessage('Could not read the selected PDF file. Please try again.');
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

  const handleUnlock = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!file || !fileBytes) return;

    if (!password) {
      setErrorMessage('Please enter the password used to protect this PDF.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      let loadedDoc: PDFDocument;
      try {
        loadedDoc = await PDFDocument.load(fileBytes, { password });
      } catch (decryptErr: unknown) {
        const errMsg = decryptErr instanceof Error ? decryptErr.message : '';
        if (errMsg.toLowerCase().includes('password') || errMsg.toLowerCase().includes('incorrect')) {
          setErrorMessage('Incorrect password. Please enter the password used to protect this PDF.');
        } else {
          setErrorMessage('Failed to decrypt the document. The encryption standard may be unsupported.');
        }
        setIsProcessing(false);
        return;
      }

      // Create a clean, completely decrypted PDF by copying pages into an unencrypted PDFDocument
      const cleanDoc = await PDFDocument.create();
      const pageIndices = loadedDoc.getPageIndices();
      const copiedPages = await cleanDoc.copyPages(loadedDoc, pageIndices);
      copiedPages.forEach((p) => cleanDoc.addPage(p));

      // Preserve metadata if present
      try {
        if (loadedDoc.getTitle()) cleanDoc.setTitle(loadedDoc.getTitle()!);
        if (loadedDoc.getAuthor()) cleanDoc.setAuthor(loadedDoc.getAuthor()!);
        if (loadedDoc.getSubject()) cleanDoc.setSubject(loadedDoc.getSubject()!);
        if (loadedDoc.getKeywords()) {
          const kw = loadedDoc.getKeywords()!;
          cleanDoc.setKeywords(Array.isArray(kw) ? kw : [kw]);
        }
        if (loadedDoc.getProducer()) cleanDoc.setProducer(loadedDoc.getProducer()!);
        if (loadedDoc.getCreator()) cleanDoc.setCreator(loadedDoc.getCreator()!);
      } catch {
        // Continue if metadata copy encounters non-critical warnings
      }

      const unlockedBytes = await cleanDoc.save();
      const blob = new Blob([unlockedBytes as unknown as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      objectUrlsRef.current.push(url);

      setResult({
        url,
        originalBytes: file.size,
        unlockedBytes: unlockedBytes.length,
        pageCount: cleanDoc.getPageCount(),
        filename: 'glowpdf_unlocked.pdf'
      });

      // Clear password from memory
      setPassword('');
    } catch {
      setErrorMessage('An unexpected error occurred while generating the unlocked PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    cleanupUrls();
    setFile(null);
    setFileBytes(null);
    setIsProtected(false);
    setPageCount(0);
    setPassword('');
    setResult(null);
    setErrorMessage(null);
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
    <div className="unlock-pdf-page">
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
          <div className="tool-badge-pill tool-badge-unlock">Unlock PDF</div>
        </div>

        {/* Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Unlock PDF Password Security</h1>
          <p className="tool-main-subtitle">
            Remove password security and encryption from your PDF document so you can read, print, and edit without password prompts.
          </p>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className={`tool-alert-banner ${!isProtected && file ? 'info' : 'error'}`} role="alert">
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
          id="unlock-pdf-input"
        />

        {/* 1. COMPLETED / DOWNLOAD STATE */}
        {result ? (
          <div className="unlock-result-card">
            <div className="unlock-result-icon-box">
              <CheckCircle2 size={38} />
            </div>

            <h2 className="unlock-result-title">PDF Unlocked Successfully!</h2>
            <p className="unlock-result-subtitle">
              Password security and encryption have been completely removed. The document will now open directly in any PDF reader.
            </p>

            <div className="unlock-stats-box">
              <div className="unlock-stat-item">
                <span className="unlock-stat-label">File Name</span>
                <span className="unlock-stat-value" title={result.filename}>{result.filename}</span>
              </div>
              <div className="unlock-stat-item">
                <span className="unlock-stat-label">Pages Decrypted</span>
                <span className="unlock-stat-value">{result.pageCount} {result.pageCount === 1 ? 'page' : 'pages'}</span>
              </div>
              <div className="unlock-stat-item">
                <span className="unlock-stat-label">File Size</span>
                <span className="unlock-stat-value">{formatFileSize(result.unlockedBytes)}</span>
              </div>
              <div className="unlock-stat-item">
                <span className="unlock-stat-label">Security Status</span>
                <span className="unlock-stat-value" style={{ color: '#059669', fontWeight: 600 }}>Unrestricted</span>
              </div>
            </div>

            <div className="unlock-privacy-callout">
              <Unlock size={15} />
              <span>
                <strong>100% Client-Side Privacy:</strong> Decryption occurred entirely within your browser. Your password and file contents were never transmitted or stored.
              </span>
            </div>

            <div className="result-actions-wrapper">
              <button
                type="button"
                className="btn-download-primary btn-unlock-download"
                onClick={handleDownload}
              >
                <Download size={20} />
                <span>Download Unlocked PDF</span>
              </button>

              <button
                type="button"
                className="btn-restart-action"
                onClick={handleReset}
              >
                <RotateCcw size={17} />
                <span>Unlock Another PDF</span>
              </button>
            </div>
          </div>
        ) : file && isProtected ? (
          /* 2. PROTECTED PDF WORKSPACE / PASSWORD INPUT */
          <div className="unlock-workspace">
            {/* File info bar */}
            <div className="unlock-file-bar">
              <div className="unlock-file-info">
                <div className="unlock-file-icon-box">
                  <FileText size={22} />
                </div>
                <div>
                  <div className="unlock-file-name" title={file.name}>{file.name}</div>
                  <div className="unlock-file-meta">
                    {formatFileSize(file.size)} • {pageCount > 0 ? `${pageCount} pages • ` : ''}Password Protected
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn-unlock-change-file"
                onClick={() => fileInputRef.current?.click()}
              >
                Change PDF
              </button>
            </div>

            {/* Password Form Card */}
            <form className="unlock-form-card" onSubmit={handleUnlock}>
              <div className="unlock-form-header">
                <div className="unlock-form-icon-circle">
                  <KeyRound size={22} />
                </div>
                <div>
                  <h3 className="unlock-form-title">Enter Document Password</h3>
                  <p className="unlock-form-desc">
                    Type the password used to lock this file to permanently remove protection.
                  </p>
                </div>
              </div>

              <div className="unlock-input-group">
                <label htmlFor="unlock-password-input" className="unlock-label">
                  Document Password <span className="required-star">*</span>
                </label>
                <div className="unlock-input-wrapper">
                  <input
                    id="unlock-password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter document password..."
                    className="unlock-input"
                    autoComplete="current-password"
                    disabled={isProcessing}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="unlock-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div className="unlock-notice-banner">
                <Unlock size={15} className="unlock-notice-icon" />
                <span>
                  <strong>Decryption Policy:</strong> GlowPDF will remove all viewing and printing restrictions. The resulting document can be opened without credentials.
                </span>
              </div>

              <div className="unlock-submit-bar">
                <button
                  type="submit"
                  className="btn-unlock-submit"
                  disabled={!password || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={18} className="spin-icon" />
                      <span>Decrypting Document...</span>
                    </>
                  ) : (
                    <>
                      <Unlock size={18} />
                      <span>Unlock PDF</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : file && !isProtected ? (
          /* 3. NON-PROTECTED PDF STATE */
          <div className="unlock-workspace">
            <div className="unlock-file-bar">
              <div className="unlock-file-info">
                <div className="unlock-file-icon-box">
                  <FileText size={22} />
                </div>
                <div>
                  <div className="unlock-file-name" title={file.name}>{file.name}</div>
                  <div className="unlock-file-meta">
                    {formatFileSize(file.size)} • {pageCount} pages
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn-unlock-change-file"
                onClick={() => fileInputRef.current?.click()}
              >
                Change PDF
              </button>
            </div>

            <div className="unlock-form-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
              <ShieldAlert size={36} style={{ color: '#059669', margin: '0 auto 12px' }} />
              <h3 className="unlock-form-title">This Document Is Already Unlocked</h3>
              <p className="unlock-form-desc" style={{ maxWidth: '440px', margin: '0 auto 20px' }}>
                The selected PDF is not password protected. It already opens without any security prompt.
              </p>
              <button
                type="button"
                className="btn-restart-action"
                onClick={() => fileInputRef.current?.click()}
                style={{ margin: '0 auto' }}
              >
                <Upload size={16} />
                <span>Select a Protected PDF</span>
              </button>
            </div>
          </div>
        ) : (
          /* 4. INITIAL DROPZONE STATE */
          <div
            className={`file-upload-dropzone ${isDraggingOver ? 'dragging-over' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload password-protected PDF to unlock"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="upload-icon-wrapper upload-icon-unlock">
              <Unlock size={32} />
            </div>

            <h2 className="upload-main-text">Select Password-Protected PDF</h2>
            <p className="upload-sub-text">or drop protected PDF here</p>

            <button
              type="button"
              className="btn-select-files btn-select-unlock"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload size={18} />
              <span>Select PDF File</span>
            </button>

            <p className="upload-privacy-note">
              🔓 100% Client-Side Decryption • Password processed in-memory and never stored
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
