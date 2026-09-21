import type { FC } from 'react';
import { ShieldAlert, X, Check, AlertTriangle } from 'lucide-react';

interface RedactionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  redactionCount: number;
}

export const RedactionConfirmModal: FC<RedactionConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  redactionCount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="tool-dialog-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="tool-dialog edit-redaction-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header header-warning">
          <div className="modal-title">
            <ShieldAlert size={22} className="icon-warning" />
            <span>Confirm Permanent Redaction</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="warning-callout-box">
            <AlertTriangle size={24} className="warning-callout-icon" />
            <div className="warning-callout-content">
              <strong>Irreversible Sanitization Notice</strong>
              <p>
                You have marked <strong>{redactionCount} area{redactionCount === 1 ? '' : 's'}</strong> for permanent redaction.
              </p>
            </div>
          </div>

          <p className="redaction-info-text">
            When you export your PDF, GlowPDF's security engine will permanently purge and overwrite the underlying text streams, vector paths, and image pixels in the marked areas.
          </p>
          <ul className="redaction-check-list">
            <li>✓ Redacted content cannot be extracted by copying or text search.</li>
            <li>✓ Redacted areas are permanently sanitized on export.</li>
            <li>✓ Unaffected document areas and formatting remain intact.</li>
          </ul>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Back to Editor
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <Check size={16} />
            <span>Confirm & Apply Redaction</span>
          </button>
        </div>
      </div>
    </div>
  );
};
