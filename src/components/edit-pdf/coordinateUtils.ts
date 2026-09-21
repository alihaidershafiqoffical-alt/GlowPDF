import type { Point, Rect } from './editorTypes';

/**
 * Coordinate utility for GlowPDF Editor
 * Centralized translation between Screen CSS pixels, PDF.js viewport coordinates,
 * and standard PDF Point coordinates (72 points per inch, top-left origin).
 */

export interface PageViewportTransform {
  scale: number;
  rotation: number;
  pdfWidth: number;
  pdfHeight: number;
}

/** Convert Screen CSS pixel coordinates to PDF point coordinates */
export function screenToPdfPoint(
  screenX: number,
  screenY: number,
  scale: number
): Point {
  const safeScale = scale > 0 ? scale : 1;
  return {
    x: screenX / safeScale,
    y: screenY / safeScale,
  };
}

/** Convert PDF point coordinates to Screen CSS pixel coordinates */
export function pdfPointToScreen(
  pdfX: number,
  pdfY: number,
  scale: number
): Point {
  return {
    x: pdfX * scale,
    y: pdfY * scale,
  };
}

/** Convert PDF point rectangle to Screen CSS pixel rectangle */
export function pdfRectToScreen(rect: Rect, scale: number): Rect {
  return {
    x: rect.x * scale,
    y: rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

/** Convert Screen CSS pixel rectangle to PDF point rectangle */
export function screenRectToPdf(rect: Rect, scale: number): Rect {
  const safeScale = scale > 0 ? scale : 1;
  return {
    x: rect.x / safeScale,
    y: rect.y / safeScale,
    width: rect.width / safeScale,
    height: rect.height / safeScale,
  };
}

/** Convert element [x, y, width, height] to PyMuPDF bounding box [x0, y0, x1, y1] */
export function elementToPyMuPdfRect(x: number, y: number, width: number, height: number): [number, number, number, number] {
  return [
    Math.min(x, x + width),
    Math.min(y, y + height),
    Math.max(x, x + width),
    Math.max(y, y + height),
  ];
}

/** Test if a point is inside a rectangle */
export function isPointInRect(pt: Point, rect: Rect): boolean {
  return (
    pt.x >= rect.x &&
    pt.x <= rect.x + rect.width &&
    pt.y >= rect.y &&
    pt.y <= rect.y + rect.height
  );
}

/** Snap coordinate value to nearest grid threshold */
export function snapToGrid(val: number, gridSize = 5): number {
  return Math.round(val / gridSize) * gridSize;
}

/** Generate a unique ID for elements */
export function generateElementId(prefix = 'elem'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
