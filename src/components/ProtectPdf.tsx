import { useState, useRef, useEffect, useCallback } from 'react';
import type { FC, DragEvent, ChangeEvent, FormEvent } from 'react';
import { PDFDocument } from '@cantoo/pdf-lib';
import { 
  Lock, 
  Upload, 
  FileText, 
  Download, 
  RotateCcw, 
  AlertCircle, 
  ArrowLeft, 
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  KeyRound
} from 'lucide-react';

interface ProtectPdfProps {
  onBack: () => void;
}

interface ProtectResult {
  url: string;
  originalBytes: number;
  protectedBytes: number;
  pageCount: number;
  filename: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const ProtectPdf: FC<ProtectPdfProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<ProtectResult | null>(null);
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

    // Validate file type
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Only PDF files are supported. Please select a valid PDF file.');
      return;
    }

    try {
      const buffer = await selectedFile.arrayBuffer();

      // Check if file is already encrypted
      try {
        const doc = await PDFDocument.load(buffer);
        const count = doc.getPageCount();

        if (count < 1) {
          setErrorMessage('The selected PDF contains no pages.');
          return;
        }

        setFile(selectedFile);
        setTotalPages(count);
      } catch (loadErr: unknown) {
        const errMsg = loadErr instanceof Error ? loadErr.message : '';
        if (errMsg.includes('encrypted')) {
          setErrorMessage('This PDF is already password-protected. Please select an unprotected PDF.');
          return;
        }
        throw loadErr;
      }
    } catch {
      setErrorMessage('Could not open the selected PDF. Please verify it is a valid, uncorrupted document.');
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

  const handleProtect = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!file) return;

    if (!password) {
      setErrorMessage('Please enter a password to protect your PDF.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const doc = await PDFDocument.load(buffer);

      // Perform real AES-256 encryption using @cantoo/pdf-lib (in-browser Web Crypto)
      doc.encrypt({
        userPassword: password,
        ownerPassword: `${password}_owner_${Math.random().toString(36).slice(2, 10)}`,
        permissions: {
          printing: 'highResolution',
          modifying: false,
          copying: false,
          annotating: false,
          fillingForms: true,
          contentAccessibility: true,
          documentAssembly: false
        }
      });

      const protectedBytes = await doc.save();
      const blob = new Blob([protectedBytes as unknown as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      objectUrlsRef.current.push(url);

      setResult({
        url,
        originalBytes: file.size,
        protectedBytes: protectedBytes.length,
        pageCount: doc.getPageCount(),
        filename: 'glowpdf_protected.pdf'
      });

      // Clear password inputs from memory as security hygiene
      setPassword('');
      setConfirmPassword('');
    } catch {
      setErrorMessage('Could not encrypt the PDF. Please check if the file format has an unsupported structure.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    cleanupUrls();
    setFile(null);
    setTotalPages(0);
    setPassword('');
    setConfirmPassword('');
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

  const isPasswordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const isFormValid = file && password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  return (
    <div className="protect-pdf-page">
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
          <div className="tool-badge-pill tool-badge-protect">Protect PDF</div>
        </div>

        {/* Header */}
        <div className="tool-main-header">
          <h1 className="tool-main-title">Protect PDF with Password</h1>
          <p className="tool-main-subtitle">
            Encrypt your PDF with standard AES-256 security. Require a password to view or open the document.
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
          id="protect-pdf-input"
        />

        {/* COMPLETED / DOWNLOAD STATE */}
        {result ? (
          <div className="protect-result-card">
            <div className="protect-result-icon-box">
              <ShieldCheck size={38} />
            </div>

            <h2 className="protect-result-title">PDF Protected Successfully!</h2>
            <p className="protect-result-subtitle">
              Your document has been encrypted. Compatible PDF readers will now require your password to view the content.
            </p>

            <div className="protect-stats-box">
              <div className="protect-stat-item">
                <span className="protect-stat-label">File Name</span>
                <span className="protect-stat-value" title={result.filename}>{result.filename}</span>
              </div>
              <div className="protect-stat-item">
                <span className="protect-stat-label">Pages</span>
                <span className="protect-stat-value">{result.pageCount} {result.pageCount === 1 ? 'page' : 'pages'}</span>
              </div>
              <div className="protect-stat-item">
                <span className="protect-stat-label">File Size</span>
                <span className="protect-stat-value">{formatFileSize(result.protectedBytes)}</span>
              </div>
              <div className="protect-stat-item">
                <span className="protect-stat-label">Encryption</span>
                <span className="protect-stat-value" style={{ color: '#059669', fontWeight: 600 }}>Standard AES-256</span>
              </div>
            </div>

            <div className="protect-privacy-callout">
              <Lock size={15} />
              <span>
                <strong>100% Client-Side Privacy:</strong> Protection was applied directly inside your browser. Your password was never transmitted, logged, or saved.
              </span>
            </div>

            <div className="result-actions-wrapper">
              <button
                type="button"
                className="btn-download-primary btn-protect-download"
                onClick={handleDownload}
              >
                <Download size={20} />
                <span>Download Protected PDF</span>
              </button>

              <button
                type="button"
                className="btn-restart-action"
                onClick={handleReset}
              >
                <RotateCcw size={17} />
                <span>Protect Another PDF</span>
              </button>
            </div>
          </div>
        ) : file ? (
          /* WORKSPACE / PASSWORD SETUP STATE */
          <div className="protect-workspace">
            {/* File info bar */}
            <div className="protect-file-bar">
              <div className="protect-file-info">
                <div className="protect-file-icon-box">
                  <FileText size={22} />
                </div>
                <div>
                  <div className="protect-file-name" title={file.name}>{file.name}</div>
                  <div className="protect-file-meta">
                    {formatFileSize(file.size)} • {totalPages} {totalPages === 1 ? 'page' : 'pages'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn-protect-change-file"
                onClick={() => fileInputRef.current?.click()}
              >
                Change PDF
              </button>
            </div>

            {/* Password Form Card */}
            <form className="protect-form-card" onSubmit={handleProtect}>
              <div className="protect-form-header">
                <div className="protect-form-icon-circle">
                  <KeyRound size={22} />
                </div>
                <div>
                  <h3 className="protect-form-title">Set Document Password</h3>
                  <p className="protect-form-desc">
                    Anyone opening this document will be prompted to enter this password.
                  </p>
                </div>
              </div>

              <div className="protect-input-grid">
                {/* Password field */}
                <div className="protect-input-group">
                  <label htmlFor="protect-password-input" className="protect-label">
                    Document Password <span className="required-star">*</span>
                  </label>
                  <div className="protect-input-wrapper">
                    <input
                      id="protect-password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password..."
                      className="protect-input"
                      autoComplete="new-password"
                      disabled={isProcessing}
                    />
                    <button
                      type="button"
                      className="protect-eye-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* Confirm password field */}
                <div className="protect-input-group">
                  <label htmlFor="protect-confirm-input" className="protect-label">
                    Confirm Password <span className="required-star">*</span>
                  </label>
                  <div className={`protect-input-wrapper ${isPasswordMismatch ? 'has-error' : ''}`}>
                    <input
                      id="protect-confirm-input"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password..."
                      className="protect-input"
                      autoComplete="new-password"
                      disabled={isProcessing}
                    />
                    <button
                      type="button"
                      className="protect-eye-btn"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>

                  {isPasswordMismatch && (
                    <span className="protect-validation-error">
                      Passwords do not match
                    </span>
                  )}
                </div>
              </div>

              <div className="protect-notice-banner">
                <Lock size={15} className="protect-notice-icon" />
                <span>
                  <strong>Important:</strong> PDF password protection cannot be restored if forgotten. Make sure to keep a secure copy of your password.
                </span>
              </div>

              <div className="protect-submit-bar">
                <button
                  type="submit"
                  className="btn-protect-submit"
                  disabled={!isFormValid || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={18} className="spin-icon" />
                      <span>Encrypting Document...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={18} />
                      <span>Protect PDF</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* INITIAL DROPZONE STATE */
          <div
            className={`file-upload-dropzone ${isDraggingOver ? 'dragging-over' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload PDF to password protect"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="upload-icon-wrapper upload-icon-protect">
              <Lock size={32} />
            </div>

            <h2 className="upload-main-text">Select PDF file to Protect</h2>
            <p className="upload-sub-text">or drop PDF here</p>

            <button
              type="button"
              className="btn-select-files btn-select-protect"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload size={18} />
              <span>Select PDF File</span>
            </button>

            <p className="upload-privacy-note">
              🔒 100% Client-Side Encryption • Your file and password never leave your browser
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
