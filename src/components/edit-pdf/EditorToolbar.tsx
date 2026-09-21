import { useState, useRef, useEffect } from 'react';
import type { FC, ChangeEvent } from 'react';
import {
  MousePointer,
  FileEdit,
  Type,
  Image as ImageIcon,
  PenTool,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Highlighter,
  Underline as UnderlineIcon,
  Strikethrough as StrikeIcon,
  MessageSquare,
  Eraser,
  ShieldAlert,
  Signature as SigIcon,
  Stamp,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import type { EditorTool, ShapeType } from './editorTypes';

interface EditorToolbarProps {
  activeTool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  currentPageIndex: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onOpenSignatureModal: () => void;
  onOpenWatermarkModal: () => void;
  onInsertImage: (e: ChangeEvent<HTMLInputElement>) => void;
  onSaveAndExport: () => void;
  isExporting: boolean;
}

export const EditorToolbar: FC<EditorToolbarProps> = ({
  activeTool,
  onSelectTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  onFitPage,
  currentPageIndex,
  totalPages,
  onPrevPage,
  onNextPage,
  onOpenSignatureModal,
  onOpenWatermarkModal,
  onInsertImage,
  onSaveAndExport,
  isExporting,
}) => {
  const [shapeDropdownOpen, setShapeDropdownOpen] = useState(false);
  const shapeDropdownRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shapeDropdownRef.current && !shapeDropdownRef.current.contains(e.target as Node)) {
        setShapeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleShapeSelect = (st: ShapeType) => {
    onSelectTool(st);
    setShapeDropdownOpen(false);
  };

  const isShapeActive = ['rect', 'circle', 'line', 'arrow'].includes(activeTool);

  return (
    <header className="editor-top-toolbar" role="toolbar" aria-label="PDF Editor Toolbar">
      {/* Hidden Image Input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={onInsertImage}
      />

      {/* Main Tool Group (Scrollable on small screens) */}
      <div className="toolbar-tools-scroll">
        {/* 1. Select / Pointer */}
        <button
          type="button"
          className={`toolbar-btn ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => onSelectTool('select')}
          title="Select & Move (V)"
          aria-label="Select and move elements"
        >
          <MousePointer size={18} />
          <span className="btn-label">Select</span>
        </button>

        {/* 2. Edit Existing Text */}
        <button
          type="button"
          className={`toolbar-btn ${activeTool === 'editText' ? 'active' : ''}`}
          onClick={() => onSelectTool('editText')}
          title="Edit Existing PDF Text"
          aria-label="Edit existing text"
        >
          <FileEdit size={18} />
          <span className="btn-label">Edit Text</span>
        </button>

        {/* 3. Add New Text */}
        <button
          type="button"
          className={`toolbar-btn ${activeTool === 'addText' ? 'active' : ''}`}
          onClick={() => onSelectTool('addText')}
          title="Add New Text (T)"
          aria-label="Add new text"
        >
          <Type size={18} />
          <span className="btn-label">Add Text</span>
        </button>

        {/* 4. Insert Image */}
        <button
          type="button"
          className={`toolbar-btn ${activeTool === 'image' ? 'active' : ''}`}
          onClick={() => imageInputRef.current?.click()}
          title="Insert Image (PNG, JPG)"
          aria-label="Insert image"
        >
          <ImageIcon size={18} />
          <span className="btn-label">Image</span>
        </button>

        {/* 5. Freehand Draw */}
        <button
          type="button"
          className={`toolbar-btn ${activeTool === 'draw' ? 'active' : ''}`}
          onClick={() => onSelectTool('draw')}
          title="Freehand Draw (P)"
          aria-label="Freehand drawing"
        >
          <PenTool size={18} />
          <span className="btn-label">Draw</span>
        </button>

        {/* 6. Shapes Dropdown */}
        <div className="toolbar-dropdown-wrap" ref={shapeDropdownRef}>
          <button
            type="button"
            className={`toolbar-btn ${isShapeActive ? 'active' : ''}`}
            onClick={() => setShapeDropdownOpen(!shapeDropdownOpen)}
            title="Shapes"
            aria-expanded={shapeDropdownOpen}
          >
            {activeTool === 'circle' ? (
              <Circle size={18} />
            ) : activeTool === 'line' ? (
              <Minus size={18} />
            ) : activeTool === 'arrow' ? (
              <ArrowRight size={18} />
            ) : (
              <Square size={18} />
            )}
            <span className="btn-label">Shapes</span>
            <ChevronDown size={12} className="dropdown-arrow" />
          </button>

          {shapeDropdownOpen && (
            <div className="toolbar-dropdown-menu">
              <button
                type="button"
                className={`dropdown-menu-item ${activeTool === 'rect' ? 'active' : ''}`}
                onClick={() => handleShapeSelect('rect')}
              >
                <Square size={16} />
                <span>Rectangle</span>
              </button>
              <button
                type="button"
                className={`dropdown-menu-item ${activeTool === 'circle' ? 'active' : ''}`}
                onClick={() => handleShapeSelect('circle')}
              >
                <Circle size={16} />
                <span>Circle / Oval</span>
              </button>
              <button
                type="button"
                className={`dropdown-menu-item ${activeTool === 'line' ? 'active' : ''}`}
                onClick={() => handleShapeSelect('line')}
              >
                <Minus size={16} />
                <span>Line</span>
              </button>
              <button
                type="button"
                className={`dropdown-menu-item ${activeTool === 'arrow' ? 'active' : ''}`}
                onClick={() => handleShapeSelect('arrow')}
              >
                <ArrowRight size={16} />
                <span>Arrow</span>
              </button>
            </div>
          )}
        </div>

        <div className="toolbar-separator" />

        {/* 7. Highlight */}
        <button
          type="button"
          className={`toolbar-btn ${activeTool === 'highlight' ? 'active' : ''}`}
          onClick={() => onSelectTool('highlight')}
          title="Highlight Text Area"
        >
          <Highlighter size={18} />
          <span className="btn-label">Highlight</span>
        </button>

        {/* 8. Underline */}
        <button
          type="button"
          className={`toolbar-btn ${activeTool === 'underline' ? 'active' : ''}`}
          onClick={() => onSelectTool('underline')}
          title="Underline Text Area"
        >
          <UnderlineIcon size={18} />
          <span className="btn-label">Underline</span>
        </button>

        {/* 9. Strikeout */}
        <button
          type="button"
          className={`toolbar-btn ${activeTool === 'strike' ? 'active' : ''}`}
          onClick={() => onSelectTool('strike')}
          title="Strikethrough Text Area"
        >
          <StrikeIcon size={18} />
          <span className="btn-label">Strike</span>
        </button>

        {/* 10. Comment / Sticky Note */}
        <button
          type="button"
          className={`toolbar-btn ${activeTool === 'comment' ? 'active' : ''}`}
          onClick={() => onSelectTool('comment')}
          title="Add Comment Note"
        >
          <MessageSquare size={18} />
          <span className="btn-label">Comment</span>
        </button>

        <div className="toolbar-separator" />

        {/* 11. Whiteout */}
        <button
          type="button"
          className={`toolbar-btn ${activeTool === 'whiteout' ? 'active' : ''}`}
          onClick={() => onSelectTool('whiteout')}
          title="Whiteout Area"
        >
          <Eraser size={18} />
          <span className="btn-label">Whiteout</span>
        </button>

        {/* 12. Redact */}
        <button
          type="button"
          className={`toolbar-btn btn-redact ${activeTool === 'redact' ? 'active' : ''}`}
          onClick={() => onSelectTool('redact')}
          title="Permanent Redaction (Purges sensitive text/images)"
        >
          <ShieldAlert size={18} />
          <span className="btn-label">Redact</span>
        </button>

        <div className="toolbar-separator" />

        {/* 13. Signature */}
        <button
          type="button"
          className="toolbar-btn"
          onClick={onOpenSignatureModal}
          title="Add Signature (Draw, Type, Upload)"
        >
          <SigIcon size={18} />
          <span className="btn-label">Signature</span>
        </button>

        {/* 14. Watermark */}
        <button
          type="button"
          className="toolbar-btn"
          onClick={onOpenWatermarkModal}
          title="Add Watermark"
        >
          <Stamp size={18} />
          <span className="btn-label">Watermark</span>
        </button>
      </div>

      {/* Right Controls: History, Zoom, Page Navigator, Export Button */}
      <div className="toolbar-right-controls">
        {/* Undo / Redo */}
        <div className="history-btn-group">
          <button
            type="button"
            className="toolbar-icon-btn"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo action"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="toolbar-icon-btn"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
            aria-label="Redo action"
          >
            <Redo2 size={16} />
          </button>
        </div>

        <div className="toolbar-separator" />

        {/* Zoom Controls */}
        <div className="zoom-btn-group">
          <button
            type="button"
            className="toolbar-icon-btn"
            onClick={onZoomOut}
            title="Zoom Out"
            disabled={zoom <= 0.4}
          >
            <ZoomOut size={16} />
          </button>
          <span className="zoom-percentage-text">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="toolbar-icon-btn"
            onClick={onZoomIn}
            title="Zoom In"
            disabled={zoom >= 2.5}
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            className="toolbar-icon-btn"
            onClick={onFitWidth}
            title="Fit to Width"
          >
            <Maximize2 size={15} />
          </button>
          <button
            type="button"
            className="toolbar-icon-btn"
            onClick={onFitPage}
            title="Fit to Page"
          >
            <Minimize2 size={15} />
          </button>
        </div>

        <div className="toolbar-separator" />

        {/* Page Navigation */}
        <div className="page-nav-group">
          <button
            type="button"
            className="toolbar-icon-btn"
            onClick={onPrevPage}
            disabled={currentPageIndex <= 0}
            title="Previous Page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="page-indicator-text">
            {currentPageIndex + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="toolbar-icon-btn"
            onClick={onNextPage}
            disabled={currentPageIndex >= totalPages - 1}
            title="Next Page"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="toolbar-separator" />

        {/* Save & Download Export Button */}
        <button
          type="button"
          className="btn-export-primary"
          onClick={onSaveAndExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <Loader2 size={16} className="spinner-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Download size={16} />
              <span>Save & Download PDF</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
