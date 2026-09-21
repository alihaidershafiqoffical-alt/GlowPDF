import { useState, useRef, useEffect } from 'react';
import type { FC, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  screenToPdfPoint,
  pdfRectToScreen,
  generateElementId,
} from './coordinateUtils';
import type {
  PageLayout,
  PdfElement,
  EditorTool,
  TextElement,
  ShapeElement,
  DrawingElement,
  AnnotationElement,
  WhiteoutElement,
  RedactionElement,
  Point,
  Rect,
  ExtractedTextItem,
} from './editorTypes';

interface PageCanvasProps {
  page: PageLayout;
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  scale: number;
  activeTool: EditorTool;
  elements: PdfElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onAddElement: (element: PdfElement) => void;
  onUpdateElement: (element: PdfElement) => void;
  onStartEditText: (item: ExtractedTextItem) => void;
}

type DragMode = 'none' | 'create' | 'move' | 'resize' | 'draw' | 'rotate';
type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rot';

export const PageCanvas: FC<PageCanvasProps> = ({
  page,
  pdfDoc,
  scale,
  activeTool,
  elements,
  selectedElementId,
  onSelectElement,
  onAddElement,
  onUpdateElement,
  onStartEditText,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  const [extractedTexts, setExtractedTexts] = useState<ExtractedTextItem[]>([]);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [dragStartPoint, setDragStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [currentDrawPath, setCurrentDrawPath] = useState<Point[]>([]);
  const [previewRect, setPreviewRect] = useState<Rect | null>(null);
  const [transientElement, setTransientElement] = useState<PdfElement | null>(null);
  const initialDragElementRef = useRef<PdfElement | null>(null);

  const pageElements = elements.filter((el) => el.pageIndex === page.pageIndex);
  const selectedElement = elements.find((el) => el.id === selectedElementId) || null;
  const [isVisible, setIsVisible] = useState<boolean>(true);

  // IntersectionObserver to lazy-render page canvas only when within 300px of viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      {
        rootMargin: '300px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Render PDF Page to Canvas via PDF.js
  useEffect(() => {
    if (page.isBlank || !pdfDoc || !isVisible) return;

    let isMounted = true;
    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const pdfPage = await pdfDoc.getPage(page.originalPageIndex + 1);
        if (!isMounted) return;

        const viewport = pdfPage.getViewport({
          scale: scale * window.devicePixelRatio,
          rotation: (pdfPage.rotate + page.rotation) % 360,
        });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / window.devicePixelRatio}px`;
        canvas.style.height = `${viewport.height / window.devicePixelRatio}px`;

        // pdf.js v6: `canvas` is required by the typings but must be null when
        // a canvasContext is supplied directly.
        const renderContext = {
          canvasContext: ctx,
          canvas: null,
          viewport,
        };

        const task = pdfPage.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;

        // Extract text layer items for text editing feature
        const textContent = await pdfPage.getTextContent();
        if (!isMounted) return;

        const items: ExtractedTextItem[] = [];
        // Use the DISPLAY orientation (page /Rotate + user rotation) so overlay
        // coordinates live in the same visible space the canvas shows — this is
        // also the coordinate space PyMuPDF uses on the backend for redactions.
        const unscaledViewport = pdfPage.getViewport({
          scale: 1.0,
          rotation: (pdfPage.rotate + page.rotation) % 360,
        });

        textContent.items.forEach((item, idx) => {
          if ('str' in item && item.str.trim()) {
            const tx = pdfjsLib.Util.transform(unscaledViewport.transform, item.transform);
            const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
            items.push({
              id: `txt_${page.pageIndex}_${idx}`,
              text: item.str,
              x: tx[4],
              y: tx[5] - fontHeight,
              width: item.width || item.str.length * fontHeight * 0.6,
              height: Math.max(fontHeight, item.height || 12),
              fontSize: fontHeight || 12,
              fontFamily: item.fontName,
              pageIndex: page.pageIndex,
            });
          }
        });
        setExtractedTexts(items);
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('[PDF Page Render Warning]', err);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, page.originalPageIndex, page.rotation, page.isBlank, scale, isVisible]);

  // Compute CSS dimensions
  const displayWidth = page.width * scale;
  const displayHeight = page.height * scale;

  // Convert Screen Event to PDF Coordinate Points
  const getEventPdfPoint = (e: ReactMouseEvent | ReactTouchEvent): Point => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    return screenToPdfPoint(screenX, screenY, scale);
  };

  // ---------------------------------------------------------------------------
  // INTERACTION HANDLERS: Mouse / Touch on Page
  // ---------------------------------------------------------------------------
  const handlePointerDown = (e: ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>) => {
    const pt = getEventPdfPoint(e);
    setDragStartPoint(pt);

    // 1. Tool: Add Text
    if (activeTool === 'addText') {
      const newText: TextElement = {
        id: generateElementId('txt'),
        type: 'text',
        pageIndex: page.pageIndex,
        x: pt.x,
        y: pt.y,
        width: 180,
        height: 40,
        text: 'Type text here...',
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontSize: 14,
        color: '#0f172a',
        bold: false,
        italic: false,
        underline: false,
        align: 'left',
        opacity: 1,
        zIndex: elements.length + 1,
      };
      onAddElement(newText);
      onSelectElement(newText.id);
      return;
    }

    // 2. Tool: Freehand Drawing
    if (activeTool === 'draw') {
      setDragMode('draw');
      setCurrentDrawPath([pt]);
      return;
    }

    // 3. Tool: Shapes, Whiteout, Redaction, Annotations (Drag-to-create box)
    if (['rect', 'circle', 'line', 'arrow', 'highlight', 'underline', 'strike', 'comment', 'whiteout', 'redact'].includes(activeTool)) {
      setDragMode('create');
      setPreviewRect({ x: pt.x, y: pt.y, width: 0, height: 0 });
      return;
    }

    // 4. Default: Deselect if clicked on empty page background
    if (activeTool === 'select') {
      onSelectElement(null);
    }
  };

  const handlePointerMove = (e: ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>) => {
    if (dragMode === 'none') return;
    const pt = getEventPdfPoint(e);

    if (dragMode === 'draw') {
      setCurrentDrawPath((prev) => [...prev, pt]);
      return;
    }

    if (dragMode === 'create') {
      const x = Math.min(dragStartPoint.x, pt.x);
      const y = Math.min(dragStartPoint.y, pt.y);
      const width = Math.abs(pt.x - dragStartPoint.x);
      const height = Math.abs(pt.y - dragStartPoint.y);
      setPreviewRect({ x, y, width, height });
      return;
    }

    if (dragMode === 'move' && initialDragElementRef.current) {
      const init = initialDragElementRef.current;
      const dx = pt.x - dragStartPoint.x;
      const dy = pt.y - dragStartPoint.y;
      setTransientElement({
        ...init,
        x: init.x + dx,
        y: init.y + dy,
      });
      return;
    }

    if (dragMode === 'rotate' && initialDragElementRef.current) {
      const init = initialDragElementRef.current;
      const centerX = init.x + init.width / 2;
      const centerY = init.y + init.height / 2;
      const dx = pt.x - centerX;
      const dy = pt.y - centerY;
      let angle = Math.round(Math.atan2(dy, dx) * (180 / Math.PI) + 90);
      angle = (angle % 360 + 360) % 360;
      setTransientElement({
        ...init,
        rotation: angle,
      });
      return;
    }

    if (dragMode === 'resize' && initialDragElementRef.current && activeHandle) {
      const init = initialDragElementRef.current;
      let { x, y, width, height } = init;
      const dx = pt.x - dragStartPoint.x;
      const dy = pt.y - dragStartPoint.y;

      if (activeHandle.includes('e')) width = Math.max(20, init.width + dx);
      if (activeHandle.includes('s')) height = Math.max(15, init.height + dy);
      if (activeHandle.includes('w')) {
        const newWidth = Math.max(20, init.width - dx);
        x = init.x + (init.width - newWidth);
        width = newWidth;
      }
      if (activeHandle.includes('n')) {
        const newHeight = Math.max(15, init.height - dy);
        y = init.y + (init.height - newHeight);
        height = newHeight;
      }
      setTransientElement({
        ...init,
        x,
        y,
        width,
        height,
      });
    }
  };

  const handlePointerUp = () => {
    if (transientElement && initialDragElementRef.current) {
      const init = initialDragElementRef.current;
      const curr = transientElement;
      if (
        curr.x !== init.x ||
        curr.y !== init.y ||
        curr.width !== init.width ||
        curr.height !== init.height ||
        curr.rotation !== init.rotation
      ) {
        onUpdateElement(curr);
      }
      setTransientElement(null);
      initialDragElementRef.current = null;
    }

    if (dragMode === 'draw' && currentDrawPath.length >= 2) {
      const newDraw: DrawingElement = {
        id: generateElementId('draw'),
        type: 'drawing',
        pageIndex: page.pageIndex,
        x: 0,
        y: 0,
        width: page.width,
        height: page.height,
        paths: [
          {
            id: generateElementId('path'),
            points: currentDrawPath,
            color: '#dc2626',
            strokeWidth: 3,
            opacity: 1,
          },
        ],
        zIndex: elements.length + 1,
      };
      onAddElement(newDraw);
      setCurrentDrawPath([]);
    } else if (dragMode === 'create' && previewRect) {
      const zIndex = elements.length + 1;
      const id = generateElementId(activeTool);

      // Determine if user clicked without dragging or dragged a very small distance (< 10px)
      const isTinyDrag = previewRect.width < 10 || previewRect.height < 10;
      const isBoxShape = ['rect', 'circle', 'whiteout', 'redact', 'highlight', 'underline', 'strike', 'comment'].includes(activeTool);
      
      const width = isTinyDrag ? (isBoxShape ? 120 : 100) : previewRect.width;
      const height = isTinyDrag ? (isBoxShape ? 80 : 40) : previewRect.height;
      const x = isTinyDrag ? Math.max(0, dragStartPoint.x - width / 2) : previewRect.x;
      const y = isTinyDrag ? Math.max(0, dragStartPoint.y - height / 2) : previewRect.y;

      if (['rect', 'circle', 'line', 'arrow'].includes(activeTool)) {
        const newShape: ShapeElement = {
          id,
          type: 'shape',
          shapeType: activeTool as any,
          pageIndex: page.pageIndex,
          x,
          y,
          width,
          height,
          borderColor: '#2563eb',
          fillColor: activeTool === 'rect' ? 'rgba(37, 99, 235, 0.15)' : activeTool === 'circle' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
          borderWidth: 2,
          opacity: 1,
          zIndex,
          points: [
            { x, y },
            { x: x + width, y: y + height },
          ],
        };
        onAddElement(newShape);
        onSelectElement(newShape.id);
      } else if (activeTool === 'whiteout') {
        const newWhiteout: WhiteoutElement = {
          id,
          type: 'whiteout',
          pageIndex: page.pageIndex,
          x,
          y,
          width,
          height,
          color: '#ffffff',
          zIndex,
        };
        onAddElement(newWhiteout);
        onSelectElement(newWhiteout.id);
      } else if (activeTool === 'redact') {
        const newRedaction: RedactionElement = {
          id,
          type: 'redact',
          pageIndex: page.pageIndex,
          x,
          y,
          width,
          height,
          fillColor: '#000000',
          zIndex,
        };
        onAddElement(newRedaction);
        onSelectElement(newRedaction.id);
      } else if (['highlight', 'underline', 'strike', 'comment'].includes(activeTool)) {
        const newAnnot: AnnotationElement = {
          id,
          type: 'annotation',
          annotationType: activeTool as any,
          pageIndex: page.pageIndex,
          x,
          y,
          width,
          height,
          color: activeTool === 'highlight' ? '#fde047' : '#dc2626',
          text: activeTool === 'comment' ? 'Note' : undefined,
          zIndex,
        };
        onAddElement(newAnnot);
        onSelectElement(newAnnot.id);
      }
      setPreviewRect(null);
    }

    setDragMode('none');
    setActiveHandle(null);
  };

  // Start element dragging
  const handleElementMouseDown = (e: ReactMouseEvent, elem: PdfElement) => {
    e.stopPropagation();
    if (activeTool !== 'select') return;
    onSelectElement(elem.id);
    setDragMode('move');
    const pt = getEventPdfPoint(e);
    setDragStartPoint(pt);
    initialDragElementRef.current = elem;
    setTransientElement(elem);
  };

  // Start handle resizing / rotating
  const handleResizeMouseDown = (e: ReactMouseEvent, handle: ResizeHandle) => {
    e.stopPropagation();
    if (!selectedElement) return;
    if (handle === 'rot') {
      setDragMode('rotate');
    } else {
      setDragMode('resize');
    }
    setActiveHandle(handle);
    const pt = getEventPdfPoint(e);
    setDragStartPoint(pt);
    initialDragElementRef.current = selectedElement;
    setTransientElement(selectedElement);
  };

  return (
    <div
      ref={containerRef}
      className={`pdf-page-canvas-container ${activeTool !== 'select' ? 'tool-active' : ''}`}
      style={{
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
      }}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
    >
      {/* 1. Underlying PDF Canvas */}
      {page.isBlank ? (
        <div className="blank-page-canvas-bg" style={{ width: displayWidth, height: displayHeight }} />
      ) : (
        <canvas ref={canvasRef} className="pdf-page-canvas" />
      )}

      {/* 2. Text Layer Overlay for "Edit Existing Text" Mode */}
      {activeTool === 'editText' && (
        <div className="extracted-text-layer">
          {extractedTexts.map((item) => {
            const screenX = item.x * scale;
            const screenY = item.y * scale;
            const screenW = item.width * scale;
            const screenH = item.height * scale;

            return (
              <div
                key={item.id}
                className="extracted-text-item"
                style={{
                  left: `${screenX}px`,
                  top: `${screenY}px`,
                  width: `${screenW}px`,
                  height: `${screenH}px`,
                  fontSize: `${item.fontSize * scale}px`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEditText(item);
                }}
                title={`Click to edit: "${item.text}"`}
              >
                {item.text}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Rendered Overlay Elements */}
      <div className="canvas-elements-overlay">
        {pageElements.map((baseElem) => {
          const elem = transientElement && transientElement.id === baseElem.id ? transientElement : baseElem;
          const isSelected = elem.id === selectedElementId;
          const screenRect = pdfRectToScreen(elem, scale);

          return (
            <div
              key={elem.id}
              className={`pdf-rendered-element ${isSelected ? 'selected' : ''} type-${elem.type}`}
              style={{
                left: `${screenRect.x}px`,
                top: `${screenRect.y}px`,
                width: `${screenRect.width}px`,
                height: `${screenRect.height}px`,
                transform: elem.rotation ? `rotate(${elem.rotation}deg)` : undefined,
                opacity: elem.opacity ?? 1,
                zIndex: elem.zIndex,
              }}
              onMouseDown={(e) => handleElementMouseDown(e, elem)}
            >
              {/* Element Renderers */}
              {elem.type === 'text' && (
                <div
                  className="elem-text-content"
                  style={{
                    fontFamily: elem.fontFamily,
                    fontSize: `${elem.fontSize * scale}px`,
                    // Edited originals cover the old glyphs in preview, matching
                    // the real redaction+rewrite the backend performs on export.
                    backgroundColor: elem.isEditedOriginal ? '#ffffff' : undefined,
                    color: elem.color,
                    fontWeight: elem.bold ? 'bold' : 'normal',
                    fontStyle: elem.italic ? 'italic' : 'normal',
                    textDecoration: elem.underline ? 'underline' : 'none',
                    textAlign: elem.align,
                  }}
                >
                  {elem.text}
                </div>
              )}

              {elem.type === 'image' && (
                <img src={elem.imageData} alt="Embedded" className="elem-image-content" />
              )}

              {elem.type === 'signature' && (
                <img src={elem.imageData} alt="Signature" className="elem-signature-content" />
              )}

              {elem.type === 'shape' && (
                elem.shapeType === 'line' || elem.shapeType === 'arrow' ? (
                  <svg className="elem-shape-svg" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <defs>
                      {elem.shapeType === 'arrow' && (
                        <marker
                          id={`arrowhead_${elem.id}`}
                          markerWidth="10"
                          markerHeight="7"
                          refX="9"
                          refY="3.5"
                          orient="auto"
                        >
                          <polygon points="0 0, 10 3.5, 0 7" fill={elem.borderColor || '#2563eb'} />
                        </marker>
                      )}
                    </defs>
                    <line
                      x1={0}
                      y1={0}
                      x2={screenRect.width}
                      y2={screenRect.height}
                      stroke={elem.borderColor || '#2563eb'}
                      strokeWidth={(elem.borderWidth || 2) * scale}
                      markerEnd={elem.shapeType === 'arrow' ? `url(#arrowhead_${elem.id})` : undefined}
                    />
                  </svg>
                ) : (
                  <div
                    className={`elem-shape-content shape-${elem.shapeType}`}
                    style={{
                      backgroundColor: elem.fillColor,
                      borderColor: elem.borderColor,
                      borderWidth: `${elem.borderWidth * scale}px`,
                      borderStyle: 'solid',
                      borderRadius: elem.shapeType === 'circle' ? '50%' : '2px',
                      width: '100%',
                      height: '100%',
                    }}
                  />
                )
              )}

              {elem.type === 'whiteout' && (
                <div
                  className="elem-whiteout-content"
                  style={{
                    backgroundColor: elem.color || '#ffffff',
                    width: '100%',
                    height: '100%',
                  }}
                />
              )}

              {elem.type === 'redact' && (
                <div
                  className="elem-redact-content"
                  style={{
                    backgroundColor: elem.fillColor || '#000000',
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <span className="redact-tag">REDACTED</span>
                </div>
              )}

              {elem.type === 'annotation' && (
                <div
                  className={`elem-annotation-content annot-${elem.annotationType}`}
                  style={{
                    backgroundColor: elem.annotationType === 'highlight' ? elem.color : undefined,
                    borderBottom: elem.annotationType === 'underline' ? `2px solid ${elem.color}` : undefined,
                    width: '100%',
                    height: '100%',
                    opacity: elem.annotationType === 'highlight' ? 0.45 : 1,
                  }}
                >
                  {elem.annotationType === 'strike' && <div className="annot-strike-line" style={{ backgroundColor: elem.color }} />}
                  {elem.annotationType === 'comment' && <div className="annot-comment-bubble">💬 {elem.text}</div>}
                </div>
              )}

              {elem.type === 'drawing' && (
                <svg className="elem-drawing-svg" viewBox={`0 0 ${page.width} ${page.height}`}>
                  {elem.paths.map((p) => (
                    <polyline
                      key={p.id}
                      points={p.points.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                      stroke={p.color}
                      strokeWidth={p.strokeWidth}
                      strokeOpacity={p.opacity}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </svg>
              )}

              {/* Selection Bounding Box & 8 Resize Handles + Rotation Handle */}
              {isSelected && activeTool === 'select' && (
                <div className="selection-bounding-box">
                  {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as ResizeHandle[]).map((h) => (
                    <div
                      key={h}
                      className={`resize-handle handle-${h}`}
                      onMouseDown={(e) => handleResizeMouseDown(e, h)}
                    />
                  ))}
                  <div
                    className="resize-handle handle-rot"
                    onMouseDown={(e) => handleResizeMouseDown(e, 'rot')}
                    title="Drag to rotate object"
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Live Freehand Drawing Path Preview */}
        {dragMode === 'draw' && currentDrawPath.length >= 2 && (
          <svg className="live-drawing-preview" viewBox={`0 0 ${page.width} ${page.height}`}>
            <polyline
              points={currentDrawPath.map((pt) => `${pt.x},${pt.y}`).join(' ')}
              stroke="#dc2626"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {/* Live Drag-Create Box Preview */}
        {dragMode === 'create' && previewRect && (
          <div
            className="create-box-preview"
            style={{
              left: `${previewRect.x * scale}px`,
              top: `${previewRect.y * scale}px`,
              width: `${previewRect.width * scale}px`,
              height: `${previewRect.height * scale}px`,
            }}
          />
        )}
      </div>
    </div>
  );
};
