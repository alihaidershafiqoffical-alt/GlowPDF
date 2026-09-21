/**
 * PDF.js worker entry with compatibility polyfills.
 *
 * The pdf.js worker is bundled as its own module, so polyfills loaded on the
 * main thread do NOT apply inside it. This entry polyfills the very new
 * TypedArray base-16/base-64 APIs (see ./pdfjsPolyfill.ts) BEFORE importing
 * the pdf.js worker code, so the worker can compute document fingerprints
 * on engines that lack the native implementations (e.g. Chromium 130).
 */
import './pdfjsPolyfill';
import 'pdfjs-dist/build/pdf.worker.min.mjs';
