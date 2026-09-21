export type EditorTool =
  | 'select'
  | 'editText'
  | 'addText'
  | 'image'
  | 'draw'
  | 'rect'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'highlight'
  | 'underline'
  | 'strike'
  | 'comment'
  | 'whiteout'
  | 'redact'
  | 'signature'
  | 'watermark';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawingPath {
  id: string;
  points: Point[];
  color: string;
  strokeWidth: number;
  opacity: number;
}

export type ShapeType = 'rect' | 'circle' | 'line' | 'arrow';

export interface BaseElement {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  zIndex: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right';
  isEditedOriginal?: boolean;
  originalText?: string;
  originalRect?: [number, number, number, number];
}

export interface ImageElement extends BaseElement {
  type: 'image';
  imageData: string; // Data URI
  naturalWidth?: number;
  naturalHeight?: number;
  /** Identity of a pre-existing PDF image (from backend analysis).
   *  Set ONLY on elements created from /api/pdf/analyze so the export
   *  pipeline can distinguish moved originals from newly inserted images. */
  originId?: string;
}

export interface SignatureElement extends BaseElement {
  type: 'signature';
  imageData: string; // Data URI
  signatureType: 'draw' | 'type' | 'upload';
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: ShapeType;
  fillColor: string; // Hex or 'transparent'
  borderColor: string;
  borderWidth: number;
  points?: [Point, Point]; // For line / arrow
}

export interface DrawingElement extends BaseElement {
  type: 'drawing';
  paths: DrawingPath[];
}

export interface AnnotationElement extends BaseElement {
  type: 'annotation';
  annotationType: 'highlight' | 'underline' | 'strike' | 'comment';
  color: string;
  text?: string; // For comment note
}

export interface WhiteoutElement extends BaseElement {
  type: 'whiteout';
  color: string;
}

export interface RedactionElement extends BaseElement {
  type: 'redact';
  fillColor: string;
  isConfirmed?: boolean;
}

export type PdfElement =
  | TextElement
  | ImageElement
  | SignatureElement
  | ShapeElement
  | DrawingElement
  | AnnotationElement
  | WhiteoutElement
  | RedactionElement;

export interface ExtractedTextItem {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily?: string;
  color?: string;
  pageIndex: number;
}

export interface PageLayout {
  pageIndex: number;
  originalPageIndex: number;
  width: number; // in PDF points (72 DPI)
  height: number;
  /** Base /Rotate value from the PDF page dictionary (0, 90, 180, 270). */
  baseRotation?: number;
  /** User-applied extra rotation on top of baseRotation. */
  rotation: number;
  isBlank?: boolean;
}

export interface WatermarkConfig {
  text: string;
  color: string;
  fontSize: number;
  opacity: number;
  rotation: number;
  pages: 'all' | 'custom';
  customPages?: number[];
}

export interface EditorState {
  pages: PageLayout[];
  elements: PdfElement[];
  deletedOriginalPages: number[];
  watermark: WatermarkConfig | null;
}

export interface HistoryEntry {
  state: EditorState;
  actionDescription: string;
}
