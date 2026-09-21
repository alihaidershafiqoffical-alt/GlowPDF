import { useState, useRef, useEffect } from 'react';
import type { FC, MouseEvent, TouchEvent, ChangeEvent } from 'react';
import { PenTool, Type, Upload, X, Trash2, Check } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageData: string, signatureType: 'draw' | 'type' | 'upload') => void;
}

const SCRIPT_FONTS = [
  { name: 'Dancing Script', font: 'Dancing Script, cursive', style: 'italic' },
  { name: 'Great Vibes', font: 'Great Vibes, cursive', style: 'normal' },
  { name: 'Caveat', font: 'Caveat, cursive', style: 'normal' },
  { name: 'Sacramento', font: 'Sacramento, cursive', style: 'normal' },
];

export const SignatureModal: FC<SignatureModalProps> = ({ isOpen, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const [typedName, setTypedName] = useState('John Doe');
  const [selectedFontIndex, setSelectedFontIndex] = useState(0);
  const [penColor, setPenColor] = useState('#0f172a');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  // Initialize canvas
  useEffect(() => {
    if (isOpen && activeTab === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = penColor;
        ctx.lineWidth = 2.5;
      }
    }
  }, [isOpen, activeTab, penColor]);

  if (!isOpen) return null;

  const startDrawing = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    hasDrawnRef.current = true;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.5;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      setUploadedImage(loadEvt.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawnRef.current) return;
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl, 'draw');
    } else if (activeTab === 'type') {
      if (!typedName.trim()) return;
      // Render typed signature to offscreen canvas
      const offscreen = document.createElement('canvas');
      offscreen.width = 500;
      offscreen.height = 160;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.fillStyle = penColor;
        ctx.font = `44px ${SCRIPT_FONTS[selectedFontIndex].font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(typedName, 250, 80);
        onSave(offscreen.toDataURL('image/png'), 'type');
      }
    } else if (activeTab === 'upload') {
      if (uploadedImage) {
        onSave(uploadedImage, 'upload');
      }
    }
    onClose();
  };

  return (
    <div className="tool-dialog-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="tool-dialog edit-signature-modal" onClick={(e) => e.stopPropagation()}>
        <div className="signature-modal-header">
          <div className="signature-modal-title">
            <PenTool size={20} className="icon-accent" />
            <span>Create Signature</span>
          </div>
          <button className="signature-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="signature-tabs">
          <button
            type="button"
            className={`signature-tab-btn ${activeTab === 'draw' ? 'active' : ''}`}
            onClick={() => setActiveTab('draw')}
          >
            <PenTool size={16} />
            <span>Draw</span>
          </button>
          <button
            type="button"
            className={`signature-tab-btn ${activeTab === 'type' ? 'active' : ''}`}
            onClick={() => setActiveTab('type')}
          >
            <Type size={16} />
            <span>Type</span>
          </button>
          <button
            type="button"
            className={`signature-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={16} />
            <span>Upload</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="signature-body">
          {activeTab === 'draw' && (
            <div className="signature-draw-area">
              <div className="canvas-wrapper">
                <canvas
                  ref={canvasRef}
                  width={480}
                  height={180}
                  className="signature-canvas"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <div className="signature-draw-tools">
                <div className="color-presets">
                  {['#0f172a', '#1d4ed8', '#dc2626'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`color-dot ${penColor === c ? 'selected' : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setPenColor(c)}
                    />
                  ))}
                </div>
                <button type="button" className="btn-secondary-sm" onClick={clearCanvas}>
                  <Trash2 size={14} />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'type' && (
            <div className="signature-type-area">
              <input
                type="text"
                className="signature-name-input"
                placeholder="Type your name..."
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                maxLength={40}
              />
              <div className="font-options-grid">
                {SCRIPT_FONTS.map((sf, idx) => (
                  <div
                    key={sf.name}
                    className={`font-option-card ${selectedFontIndex === idx ? 'selected' : ''}`}
                    onClick={() => setSelectedFontIndex(idx)}
                  >
                    <span style={{ fontFamily: sf.font, fontStyle: sf.style, fontSize: '26px', color: penColor }}>
                      {typedName || 'Your Signature'}
                    </span>
                    <span className="font-name-label">{sf.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="signature-upload-area">
              {uploadedImage ? (
                <div className="uploaded-preview-box">
                  <img src={uploadedImage} alt="Uploaded Signature" className="uploaded-sig-img" />
                  <button type="button" className="btn-secondary-sm" onClick={() => setUploadedImage(null)}>
                    <Trash2 size={14} />
                    <span>Choose Different Image</span>
                  </button>
                </div>
              ) : (
                <label className="signature-dropzone">
                  <Upload size={32} className="upload-icon" />
                  <span className="dropzone-text">Click or drag signature image (PNG, JPG)</span>
                  <span className="dropzone-hint">Transparent PNG works best</span>
                  <input type="file" accept="image/png,image/jpeg" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="signature-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleApply}>
            <Check size={16} />
            <span>Apply Signature</span>
          </button>
        </div>
      </div>
    </div>
  );
};
