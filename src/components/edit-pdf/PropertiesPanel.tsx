import type { FC, ReactNode } from 'react';
import {
  Type,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Copy,
  Layers,
  Palette,
  Sliders,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Pencil,
  Highlighter,
  ShieldAlert,
  PenTool,
  Image as ImageIcon,
  HelpCircle,
} from 'lucide-react';
import type {
  PdfElement,
  TextElement,
  ImageElement,
  ShapeElement,
  AnnotationElement,
  SignatureElement,
  EditorTool,
} from './editorTypes';

interface PropertiesPanelProps {
  selectedElement: PdfElement | null;
  activeTool: EditorTool;
  onUpdateElement: (updated: PdfElement) => void;
  onDeleteElement: (id: string) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  onSelectElement: (id: string | null) => void;
  pageElements: PdfElement[];
  currentPageNumber: number;
  totalPageCount: number;
}

const FONT_FAMILIES = [
  { label: 'Helvetica / Arial', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Courier / Monospace', value: 'Courier, monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
];

const COLOR_PRESETS = [
  '#000000', '#1e293b', '#2563eb', '#16a34a',
  '#dc2626', '#d97706', '#9333ea', '#ffffff'
];

/** Human-readable labels for each tool */
const TOOL_LABELS: Record<string, string> = {
  select:    'Select & Move',
  editText:  'Edit Text',
  addText:   'Add Text',
  image:     'Insert Image',
  draw:      'Freehand Draw',
  rect:      'Rectangle',
  circle:    'Circle / Oval',
  line:      'Line',
  arrow:     'Arrow',
  highlight: 'Highlight',
  underline: 'Underline',
  strike:    'Strikethrough',
  comment:   'Comment',
  whiteout:  'Whiteout',
  redact:    'Redact',
  signature: 'Signature',
  watermark: 'Watermark',
};

/** Get visual metadata (icon, title, subtitle) for an element in the Layers panel */
function getElementSummary(el: PdfElement): { icon: ReactNode; title: string; subtitle: string } {
  switch (el.type) {
    case 'text': {
      const te = el as TextElement;
      return {
        icon: <Type size={14} className="icon-accent" />,
        title: te.isEditedOriginal ? 'Edited Original Text' : 'Text Box',
        subtitle: te.text ? `"${te.text.slice(0, 24)}${te.text.length > 24 ? '...' : ''}"` : 'Text',
      };
    }
    case 'image': {
      const ie = el as ImageElement;
      return {
        icon: <ImageIcon size={14} className="icon-accent" />,
        title: ie.originId ? 'Original Image' : 'Image',
        subtitle: `${Math.round(ie.width)} × ${Math.round(ie.height)} pt`,
      };
    }
    case 'signature':
      return {
        icon: <PenTool size={14} className="icon-accent" />,
        title: 'Signature',
        subtitle: 'Signature',
      };
    case 'shape': {
      const se = el as ShapeElement;
      let ShapeIcon = Square;
      if (se.shapeType === 'circle') ShapeIcon = Circle;
      if (se.shapeType === 'line') ShapeIcon = Minus;
      if (se.shapeType === 'arrow') ShapeIcon = ArrowUpRight;
      return {
        icon: <ShapeIcon size={14} className="icon-accent" />,
        title: `Shape (${se.shapeType})`,
        subtitle: `${se.fillColor === 'transparent' ? 'No Fill' : se.fillColor}, ${se.borderWidth}px border`,
      };
    }
    case 'drawing':
      return {
        icon: <Pencil size={14} className="icon-accent" />,
        title: 'Freehand Drawing',
        subtitle: 'Vector drawing',
      };
    case 'annotation':
      return {
        icon: <Highlighter size={14} className="icon-accent" />,
        title: 'Annotation',
        subtitle: (el as AnnotationElement).annotationType,
      };
    case 'whiteout':
      return {
        icon: <Square size={14} className="icon-subtle" />,
        title: 'Whiteout',
        subtitle: 'Whiteout patch',
      };
    case 'redact':
      return {
        icon: <ShieldAlert size={14} className="icon-danger" />,
        title: 'Redaction Area',
        subtitle: 'Permanent redaction',
      };
    default:
      return {
        icon: <Sliders size={14} className="icon-subtle" />,
        title: 'Element',
        subtitle: 'Object',
      };
  }
}

export const PropertiesPanel: FC<PropertiesPanelProps> = ({
  selectedElement,
  activeTool,
  onUpdateElement,
  onDeleteElement,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onDuplicateElement,
  onSelectElement,
  pageElements,
  currentPageNumber,
  totalPageCount,
}) => {
  const toolLabel = TOOL_LABELS[activeTool] ?? activeTool;
  // Sort elements on current page descending by zIndex (Top layer first)
  const sortedPageElements = [...pageElements].sort((a, b) => b.zIndex - a.zIndex);

  // Layer Toolbar Component for inspecting an element
  const renderLayerToolbar = (elId: string) => (
    <div className="prop-group">
      <label className="prop-label">Layer & Stacking Order</label>
      <div className="layer-toolbar-grid">
        <button
          type="button"
          className="btn-layer-action"
          onClick={() => onBringToFront(elId)}
          title="Bring to Front (Top Layer)"
        >
          <ChevronsUp size={14} />
          <span>Front</span>
        </button>
        <button
          type="button"
          className="btn-layer-action"
          onClick={() => onBringForward(elId)}
          title="Bring Forward 1 Level"
        >
          <ChevronUp size={14} />
          <span>Forward</span>
        </button>
        <button
          type="button"
          className="btn-layer-action"
          onClick={() => onSendBackward(elId)}
          title="Send Backward 1 Level"
        >
          <ChevronDown size={14} />
          <span>Backward</span>
        </button>
        <button
          type="button"
          className="btn-layer-action"
          onClick={() => onSendToBack(elId)}
          title="Send to Back (Bottom Layer)"
        >
          <ChevronsDown size={14} />
          <span>Back</span>
        </button>
        <button
          type="button"
          className="btn-layer-action"
          onClick={() => onDuplicateElement(elId)}
          title="Duplicate Object"
        >
          <Copy size={14} />
          <span>Duplicate</span>
        </button>
        <button
          type="button"
          className="btn-layer-danger"
          onClick={() => onDeleteElement(elId)}
          title="Delete Object"
        >
          <Trash2 size={14} />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );

  // Layers / Objects List Panel (rendered when no element selected or at bottom)
  const renderLayersPanelList = () => (
    <div className="layers-panel-section">
      <div className="layers-panel-header">
        <div className="layers-panel-title">
          <Layers size={16} className="icon-accent" />
          <span>Layers / Objects ({pageElements.length})</span>
        </div>
        {selectedElement && (
          <button
            type="button"
            className="btn-deselect-layer"
            onClick={() => onSelectElement(null)}
          >
            Deselect
          </button>
        )}
      </div>

      {sortedPageElements.length === 0 ? (
        <div className="layers-empty-box">
          <Layers size={22} className="icon-subtle" />
          <p>No editable objects on Page {currentPageNumber}. Use the toolbar to add text, images, shapes, or annotations.</p>
        </div>
      ) : (
        <div className="layers-scroll-list">
          {sortedPageElements.map((el, idx) => {
            const layerNum = sortedPageElements.length - idx;
            const summary = getElementSummary(el);
            const isSelected = selectedElement?.id === el.id;

            return (
              <div
                key={el.id}
                className={`layer-item-card ${isSelected ? 'active' : ''}`}
                onClick={() => onSelectElement(el.id)}
              >
                <span className="layer-tag">#{layerNum}</span>
                <span className="layer-icon-wrap">{summary.icon}</span>
                <div className="layer-meta">
                  <span className="layer-item-title">{summary.title}</span>
                  <span className="layer-item-sub">{summary.subtitle}</span>
                </div>
                <div className="layer-quick-tools">
                  <button
                    type="button"
                    className="btn-layer-quick"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBringForward(el.id);
                    }}
                    title="Bring Forward"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn-layer-quick"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSendBackward(el.id);
                    }}
                    title="Send Backward"
                  >
                    <ChevronDown size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn-layer-quick"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateElement(el.id);
                    }}
                    title="Duplicate"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn-layer-quick-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteElement(el.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // NO ELEMENT SELECTED: DOCUMENT & LAYERS INSPECTOR
  // ---------------------------------------------------------------------------
  if (!selectedElement) {
    return (
      <aside className="editor-properties-panel">
        <div className="properties-header">
          <Sliders size={18} className="icon-subtle" />
          <h4 className="properties-title">Document & Layers</h4>
        </div>
        <div className="properties-body">
          <div className="meta-card">
            <span className="meta-label">Current Page</span>
            <span className="meta-value">
              Page {currentPageNumber} of {totalPageCount}
            </span>
          </div>
          <div className="meta-card">
            <span className="meta-label">Active Tool</span>
            <span className="meta-value tool-badge">{toolLabel}</span>
          </div>

          {/* Render the Layers Panel */}
          {renderLayersPanelList()}

          <div className="properties-help-box">
            <HelpCircle size={15} />
            <p>
              Select any object on the canvas or from the Layers list to adjust its properties, text, colors, rotation, and layer order.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  // ---------------------------------------------------------------------------
  // TEXT ELEMENT PROPERTIES
  // ---------------------------------------------------------------------------
  if (selectedElement.type === 'text') {
    const el = selectedElement as TextElement;

    const updateText = (partial: Partial<TextElement>) => {
      onUpdateElement({ ...el, ...partial });
    };

    return (
      <aside className="editor-properties-panel">
        <div className="properties-header">
          <Type size={18} className="icon-accent" />
          <h4 className="properties-title">
            {el.isEditedOriginal ? 'Edit Original Text' : 'Text Properties'}
          </h4>
        </div>

        <div className="properties-body">
          {/* Text Content */}
          <div className="prop-group">
            <label className="prop-label">Text Content</label>
            <textarea
              className="prop-textarea"
              rows={3}
              value={el.text}
              onChange={(e) => updateText({ text: e.target.value })}
              placeholder="Type your text..."
            />
          </div>

          {/* Font Family */}
          <div className="prop-group">
            <label className="prop-label">Font Family</label>
            <select
              className="prop-select"
              value={el.fontFamily}
              onChange={(e) => updateText({ fontFamily: e.target.value })}
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Font Size & Color */}
          <div className="prop-row-2">
            <div className="prop-group">
              <label className="prop-label">Size ({el.fontSize} pt)</label>
              <input
                type="range"
                min={8}
                max={72}
                value={el.fontSize}
                onChange={(e) => updateText({ fontSize: Number(e.target.value) })}
                className="prop-range"
              />
            </div>
            <div className="prop-group">
              <label className="prop-label">Color</label>
              <div className="color-field-wrap">
                <input
                  type="color"
                  value={el.color.startsWith('#') ? el.color : '#000000'}
                  onChange={(e) => updateText({ color: e.target.value })}
                  className="color-picker-input"
                />
                <span className="color-hex-label">{el.color}</span>
              </div>
            </div>
          </div>

          {/* Color Presets */}
          <div className="prop-color-presets">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-dot-btn ${el.color === c ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => updateText({ color: c })}
              />
            ))}
          </div>

          {/* Formatting & Alignment Toolbar */}
          <div className="prop-group">
            <label className="prop-label">Formatting</label>
            <div className="btn-toolbar-group">
              <button
                type="button"
                className={`toggle-btn ${el.bold ? 'active' : ''}`}
                onClick={() => updateText({ bold: !el.bold })}
                title="Bold"
              >
                <Bold size={15} />
              </button>
              <button
                type="button"
                className={`toggle-btn ${el.italic ? 'active' : ''}`}
                onClick={() => updateText({ italic: !el.italic })}
                title="Italic"
              >
                <Italic size={15} />
              </button>
              <button
                type="button"
                className={`toggle-btn ${el.underline ? 'active' : ''}`}
                onClick={() => updateText({ underline: !el.underline })}
                title="Underline"
              >
                <Underline size={15} />
              </button>
              <div className="toolbar-divider" />
              <button
                type="button"
                className={`toggle-btn ${el.align === 'left' ? 'active' : ''}`}
                onClick={() => updateText({ align: 'left' })}
                title="Align Left"
              >
                <AlignLeft size={15} />
              </button>
              <button
                type="button"
                className={`toggle-btn ${el.align === 'center' ? 'active' : ''}`}
                onClick={() => updateText({ align: 'center' })}
                title="Align Center"
              >
                <AlignCenter size={15} />
              </button>
              <button
                type="button"
                className={`toggle-btn ${el.align === 'right' ? 'active' : ''}`}
                onClick={() => updateText({ align: 'right' })}
                title="Align Right"
              >
                <AlignRight size={15} />
              </button>
            </div>
          </div>

          {/* Rotation */}
          <div className="prop-group">
            <label className="prop-label">Rotation ({(el.rotation ?? 0)}°)</label>
            <div className="rotation-quick-btns">
              {[0, 90, 180, 270].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  className={`rotation-btn ${(el.rotation ?? 0) === deg ? 'active' : ''}`}
                  onClick={() => updateText({ rotation: deg })}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>

          {/* Layer Controls */}
          {renderLayerToolbar(el.id)}

          {/* Page Layers List accordion/section */}
          {renderLayersPanelList()}
        </div>
      </aside>
    );
  }

  // ---------------------------------------------------------------------------
  // SHAPE PROPERTIES
  // ---------------------------------------------------------------------------
  if (selectedElement.type === 'shape') {
    const el = selectedElement as ShapeElement;

    const updateShape = (partial: Partial<ShapeElement>) => {
      onUpdateElement({ ...el, ...partial });
    };

    return (
      <aside className="editor-properties-panel">
        <div className="properties-header">
          {el.shapeType === 'circle' ? <Circle size={18} className="icon-accent" /> : <Square size={18} className="icon-accent" />}
          <h4 className="properties-title">Shape Properties</h4>
        </div>

        <div className="properties-body">
          {/* Border Width & Color */}
          <div className="prop-row-2">
            <div className="prop-group">
              <label className="prop-label">Border Width ({el.borderWidth}px)</label>
              <input
                type="range"
                min={0}
                max={16}
                value={el.borderWidth}
                onChange={(e) => updateShape({ borderWidth: Number(e.target.value) })}
                className="prop-range"
              />
            </div>
            <div className="prop-group">
              <label className="prop-label">Border Color</label>
              <div className="color-field-wrap">
                <input
                  type="color"
                  value={el.borderColor.startsWith('#') ? el.borderColor : '#2563eb'}
                  onChange={(e) => updateShape({ borderColor: e.target.value })}
                  className="color-picker-input"
                />
              </div>
            </div>
          </div>

          {/* Fill Color */}
          <div className="prop-group">
            <label className="prop-label">Fill Color</label>
            <div className="fill-color-row">
              <button
                type="button"
                className={`fill-mode-btn ${el.fillColor === 'transparent' ? 'active' : ''}`}
                onClick={() => updateShape({ fillColor: 'transparent' })}
              >
                Transparent
              </button>
              <div className="color-field-wrap">
                <input
                  type="color"
                  value={el.fillColor === 'transparent' ? '#ffffff' : el.fillColor}
                  onChange={(e) => updateShape({ fillColor: e.target.value })}
                  className="color-picker-input"
                />
                <span className="color-hex-label">{el.fillColor}</span>
              </div>
            </div>
          </div>

          {/* Opacity */}
          <div className="prop-group">
            <label className="prop-label">Opacity ({Math.round((el.opacity ?? 1) * 100)}%)</label>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={el.opacity ?? 1}
              onChange={(e) => updateShape({ opacity: Number(e.target.value) })}
              className="prop-range"
            />
          </div>

          {/* Rotation */}
          <div className="prop-group">
            <label className="prop-label">Rotation ({(el.rotation ?? 0)}°)</label>
            <div className="rotation-quick-btns">
              {[0, 90, 180, 270].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  className={`rotation-btn ${(el.rotation ?? 0) === deg ? 'active' : ''}`}
                  onClick={() => updateShape({ rotation: deg })}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>

          {/* Layer Controls */}
          {renderLayerToolbar(el.id)}

          {/* Page Layers List */}
          {renderLayersPanelList()}
        </div>
      </aside>
    );
  }

  // ---------------------------------------------------------------------------
  // IMAGE / SIGNATURE PROPERTIES
  // ---------------------------------------------------------------------------
  if (selectedElement.type === 'image' || selectedElement.type === 'signature') {
    const el = selectedElement as ImageElement | SignatureElement;

    const updateImage = (partial: Partial<ImageElement>) => {
      onUpdateElement({ ...el, ...partial } as PdfElement);
    };

    return (
      <aside className="editor-properties-panel">
        <div className="properties-header">
          <Palette size={18} className="icon-accent" />
          <h4 className="properties-title">
            {el.type === 'signature' ? 'Signature Properties' : 'Image Properties'}
          </h4>
        </div>

        <div className="properties-body">
          {/* Dimensions: Width & Height */}
          <div className="prop-row-2">
            <div className="prop-group">
              <label className="prop-label">Width (pt)</label>
              <input
                type="number"
                min={10}
                max={2000}
                value={Math.round(el.width)}
                onChange={(e) => updateImage({ width: Math.max(10, Number(e.target.value)) })}
                className="prop-textarea"
                style={{ padding: '6px 8px', height: '34px' }}
              />
            </div>
            <div className="prop-group">
              <label className="prop-label">Height (pt)</label>
              <input
                type="number"
                min={10}
                max={2000}
                value={Math.round(el.height)}
                onChange={(e) => updateImage({ height: Math.max(10, Number(e.target.value)) })}
                className="prop-textarea"
                style={{ padding: '6px 8px', height: '34px' }}
              />
            </div>
          </div>

          {/* Opacity */}
          <div className="prop-group">
            <label className="prop-label">Opacity ({Math.round((el.opacity ?? 1) * 100)}%)</label>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={el.opacity ?? 1}
              onChange={(e) => updateImage({ opacity: Number(e.target.value) })}
              className="prop-range"
            />
          </div>

          {/* Rotation */}
          <div className="prop-group">
            <label className="prop-label">Rotation ({(el.rotation ?? 0)}°)</label>
            <div className="rotation-quick-btns">
              {[0, 90, 180, 270].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  className={`rotation-btn ${(el.rotation ?? 0) === deg ? 'active' : ''}`}
                  onClick={() => updateImage({ rotation: deg })}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>

          {/* Layer Controls */}
          {renderLayerToolbar(el.id)}

          {/* Page Layers List */}
          {renderLayersPanelList()}
        </div>
      </aside>
    );
  }

  // ---------------------------------------------------------------------------
  // ANNOTATION / WHITEOUT / REDACTION / DRAWING PROPERTIES
  // ---------------------------------------------------------------------------
  return (
    <aside className="editor-properties-panel">
      <div className="properties-header">
        <Sliders size={18} className="icon-accent" />
        <h4 className="properties-title">Element Properties</h4>
      </div>

      <div className="properties-body">
        {selectedElement.type === 'annotation' && (
          <div className="prop-group">
            <label className="prop-label">Annotation Color</label>
            <input
              type="color"
              value={(selectedElement as AnnotationElement).color || '#facc15'}
              onChange={(e) => onUpdateElement({ ...selectedElement, color: e.target.value } as PdfElement)}
              className="color-picker-input"
            />
          </div>
        )}

        {/* Layer Controls */}
        {renderLayerToolbar(selectedElement.id)}

        {/* Page Layers List */}
        {renderLayersPanelList()}
      </div>
    </aside>
  );
};

