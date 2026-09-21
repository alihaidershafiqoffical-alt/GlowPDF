import { useState } from 'react';
import type { FC } from 'react';
import { Stamp, X, Check } from 'lucide-react';
import type { WatermarkConfig } from './editorTypes';

interface WatermarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: WatermarkConfig) => void;
  currentConfig: WatermarkConfig | null;
  totalPages: number;
}

export const WatermarkModal: FC<WatermarkModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentConfig,
  totalPages,
}) => {
  const [text, setText] = useState(currentConfig?.text || 'CONFIDENTIAL');
  const [color, setColor] = useState(currentConfig?.color || '#94a3b8');
  const [fontSize, setFontSize] = useState(currentConfig?.fontSize || 42);
  const [opacity, setOpacity] = useState(currentConfig?.opacity || 0.25);
  const [rotation, setRotation] = useState(currentConfig?.rotation || 45);
  const [pagesMode, setPagesMode] = useState<'all' | 'custom'>(currentConfig?.pages || 'all');

  if (!isOpen) return null;

  const handleApply = () => {
    if (!text.trim()) return;
    onSave({
      text: text.trim(),
      color,
      fontSize,
      opacity,
      rotation,
      pages: pagesMode,
    });
    onClose();
  };

  return (
    <div className="tool-dialog-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="tool-dialog edit-watermark-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Stamp size={20} className="icon-accent" />
            <span>Watermark Document</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Watermark Text</label>
            <input
              type="text"
              className="form-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. CONFIDENTIAL, DRAFT, SAMPLE"
              maxLength={60}
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Font Size ({fontSize} pt)</label>
              <input
                type="range"
                min={20}
                max={90}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="form-range"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Opacity ({Math.round(opacity * 100)}%)</label>
              <input
                type="range"
                min={0.05}
                max={0.9}
                step={0.05}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="form-range"
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Rotation Angle ({rotation}°)</label>
              <input
                type="range"
                min={-90}
                max={90}
                step={5}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="form-range"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Watermark Color</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="color-input-field"
                />
                <span className="color-hex-text">{color}</span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Target Pages</label>
            <div className="radio-pills">
              <button
                type="button"
                className={`radio-pill ${pagesMode === 'all' ? 'selected' : ''}`}
                onClick={() => setPagesMode('all')}
              >
                All Pages ({totalPages})
              </button>
              <button
                type="button"
                className={`radio-pill ${pagesMode === 'custom' ? 'selected' : ''}`}
                onClick={() => setPagesMode('custom')}
              >
                First Page Only
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleApply}>
            <Check size={16} />
            <span>Apply Watermark</span>
          </button>
        </div>
      </div>
    </div>
  );
};
