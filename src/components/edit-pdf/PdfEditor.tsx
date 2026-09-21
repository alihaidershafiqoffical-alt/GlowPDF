import { useState, useRef, useEffect, useCallback } from 'react';
import type { FC, ChangeEvent } from 'react';
// TypedArray toHex/toBase64 polyfill for the MAIN thread (display canvas path);
// the worker-side copy runs inside the worker entry (../../lib/pdfWorker.ts).
import '../../lib/pdfjsPolyfill';
import * as pdfjsLib from 'pdfjs-dist';
// Worker entry that polyfills TypedArray toHex/toBase64 BEFORE pdf.js worker
// code runs (main-thread polyfills do not reach inside the module worker).
import pdfWorkerUrl from '../../lib/pdfWorker.ts?worker&url';
import { apiFetch } from '../../lib/api';
import { EditorToolbar } from './EditorToolbar';
import { PageThumbnailSidebar } from './PageThumbnailSidebar';
import { PageCanvas } from './PageCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { SignatureModal } from './SignatureModal';
import { WatermarkModal } from './WatermarkModal';
import { RedactionConfirmModal } from './RedactionConfirmModal';
import { generateElementId, elementToPyMuPdfRect } from './coordinateUtils';
import {
  createInitialHistory,
  pushHistoryState,
  undoHistory,
  redoHistory,
  type HistoryState,
} from './historyManager';
import type {
  EditorState,
  EditorTool,
  PdfElement,
  PageLayout,
  TextElement,
  ImageElement,
  ExtractedTextItem,
} from './editorTypes';

/** Existing image reported by the backend /api/pdf/analyze call. */
interface AnalyzedImage {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imageData: string | null;
  pageIndex: number;
}

interface PdfEditorProps {
  file: File;
  onBack?: () => void;
  onExportSuccess: (blob: Blob, filename: string) => void;
  onError: (errorMsg: string) => void;
}

export const PdfEditor: FC<PdfEditorProps> = ({
  file,
  onBack: _onBack,
  onExportSuccess,
  onError,
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  // Original existing images (from backend analysis) — used to detect
  // move/resize/delete of pre-existing PDF images at export time.
  const originalImagesRef = useRef<AnalyzedImage[]>([]);
  // Shared module worker (polyfilled) — reused across document loads & cleanup.
  const sharedWorkerRef = useRef<pdfjsLib.PDFWorker | null>(null);
  const getSharedWorker = useCallback((): pdfjsLib.PDFWorker => {
    if (!sharedWorkerRef.current) {
      sharedWorkerRef.current = new pdfjsLib.PDFWorker({
        // pdfjs-dist's typing incorrectly declares `port` as null-only.
        port: new Worker(pdfWorkerUrl, { type: 'module' }) as unknown as null,
      });
    }
    return sharedWorkerRef.current;
  }, []);
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Modals
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isWatermarkModalOpen, setIsWatermarkModalOpen] = useState(false);
  const [isRedactionModalOpen, setIsRedactionModalOpen] = useState(false);

  // Undo / Redo History State
  const [history, setHistory] = useState<HistoryState>(() =>
    createInitialHistory({
      pages: [],
      elements: [],
      deletedOriginalPages: [],
      watermark: null,
    })
  );

  const editorState = history.present;
  const viewportScrollRef = useRef<HTMLDivElement | null>(null);
  // Teardown handle for the current document's loading task.
  const pdfDocRefCleanup = useRef<(() => void) | null>(null);

  const [isScannedPdf, setIsScannedPdf] = useState<boolean>(false);

  // Load PDF Document & Metadata
  useEffect(() => {
    let isMounted = true;
    const loadPdf = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          worker: getSharedWorker(),
        });
        pdfDocRefCleanup.current = () => {
          try {
            loadingTask.destroy();
          } catch {
            /* already destroyed */
          }
        };
        const doc = await loadingTask.promise;
        if (!isMounted) return;
        setPdfDoc(doc);

        const initialPages: PageLayout[] = [];
        let totalTextCharCount = 0;

        for (let i = 0; i < doc.numPages; i++) {
          const page = await doc.getPage(i + 1);
          const viewport = page.getViewport({ scale: 1.0 });
          initialPages.push({
            pageIndex: i,
            originalPageIndex: i,
            width: viewport.width,
            height: viewport.height,
            baseRotation: ((page.rotate % 360) + 360) % 360,
            rotation: 0,
          });

          const tc = await page.getTextContent();
          totalTextCharCount += tc.items.reduce(
            (sum, item) => sum + ('str' in item ? item.str.trim().length : 0),
            0
          );
        }

        setIsScannedPdf(totalTextCharCount < 5);

        const initialState: EditorState = {
          pages: initialPages,
          elements: [],
          deletedOriginalPages: [],
          watermark: null,
        };

        setHistory(createInitialHistory(initialState));

        // ---------------------------------------------------------------------
        // Backend content analysis: expose EXISTING images as editable objects
        // (existing TEXT is intentionally still extracted client-side in
        // PageCanvas via pdf.js — same coordinates, zero extra latency).
        // ---------------------------------------------------------------------
        try {
          const formData = new FormData();
          formData.append('file', file);
          const analyzeRes = await apiFetch('/api/pdf/analyze', {
            method: 'POST',
            body: formData,
          });
          if (analyzeRes.ok) {
            const analysis = await analyzeRes.json();
            const analyzedImages: AnalyzedImage[] = analysis.pages?.flatMap(
              (p: { images?: AnalyzedImage[] }) => p.images ?? []
            ) ?? [];
            originalImagesRef.current = analyzedImages;
            if (analyzedImages.length > 0) {
              const imgElements: PdfElement[] = analyzedImages
                .filter((ai) => !!ai.imageData)
                .map((ai) => ({
                  id: generateElementId('img_exist'),
                  type: 'image' as const,
                  pageIndex: ai.pageIndex,
                  x: ai.x,
                  y: ai.y,
                  width: ai.width,
                  height: ai.height,
                  imageData: ai.imageData as string,
                  opacity: 1,
                  rotation: 0,
                  zIndex: 0,
                  // Identity tag: marks this element as a pre-existing PDF
                  // image (moved/resized/deleted via `image_edits` at export,
                  // never double-sent as a new `images` insert).
                  originId: ai.id,
                }));
              if (imgElements.length > 0) {
                setHistory(
                  createInitialHistory({
                    ...initialState,
                    elements: [...imgElements, ...initialState.elements],
                  })
                );
              }
            }
          } else {
            console.warn('[Analyze] backend analysis unavailable:', analyzeRes.status);
          }
        } catch (analyzeErr) {
          console.warn('[Analyze] failed (existing images stay read-only):', analyzeErr);
        }

        // Generate thumbnails sequentially in background to keep UI responsive on large PDFs
        (async () => {
          for (const p of initialPages) {
            if (!isMounted) break;
            try {
              const page = await doc.getPage(p.originalPageIndex + 1);
              const thumbViewport = page.getViewport({ scale: 0.2 });
              const canvas = document.createElement('canvas');
              canvas.width = thumbViewport.width;
              canvas.height = thumbViewport.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                await page.render({ canvasContext: ctx, viewport: thumbViewport, canvas }).promise;
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                if (isMounted) {
                  setThumbnails((prev) => ({ ...prev, [p.originalPageIndex]: dataUrl }));
                }
              }
              // Yield to main event loop between pages
              await new Promise((res) => setTimeout(res, 5));
            } catch (e) {
              console.warn('[Thumbnail Error]', e);
            }
          }
        })();
      } catch (err: any) {
        if (isMounted) {
          const msg = (err?.message || '').toLowerCase();
          const name = (err?.name || '').toLowerCase();
          if (name.includes('password') || msg.includes('password')) {
            onError('This PDF document is password-protected. Please unlock it using GlowPDF\'s Unlock tool before editing.');
          } else if (name.includes('invalidpdf') || msg.includes('invalid pdf') || msg.includes('corrupt')) {
            onError('This PDF file appears to be corrupted or invalid. Please check the file and try again.');
          } else {
            onError(`Failed to load PDF document: ${err.message || 'Corrupted or unsupported file'}`);
          }
        }
      }
    };

    loadPdf();
    return () => {
      isMounted = false;
      // Destroy the loading task (kills this document + its worker connection
      // bookkeeping); the shared worker itself stays alive for remounts.
      pdfDocRefCleanup.current?.();
      pdfDocRefCleanup.current = null;
      setPdfDoc(null);
    };
  }, [file, onError, getSharedWorker]);

  // Push new state into history
  const updateEditorState = useCallback((newState: EditorState) => {
    setHistory((prev) => pushHistoryState(prev, newState));
  }, []);

  // History Actions
  const handleUndo = useCallback(() => {
    setHistory((prev) => undoHistory(prev));
  }, []);

  const handleRedo = useCallback(() => {
    setHistory((prev) => redoHistory(prev));
  }, []);

  const copiedElementRef = useRef<PdfElement | null>(null);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid intercepting inside text inputs
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedElementId) {
          const el = editorState.elements.find((item) => item.id === selectedElementId);
          if (el) {
            copiedElementRef.current = structuredClone(el);
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (copiedElementRef.current) {
          e.preventDefault();
          const source = copiedElementRef.current;
          const pageElems = editorState.elements
            .filter((el) => el.pageIndex === activePageIndex)
            .sort((a, b) => a.zIndex - b.zIndex);
          const maxZ = pageElems.length > 0 ? Math.max(...pageElems.map((e) => e.zIndex)) : 0;

          const prefixMap: Record<string, string> = {
            text: 'txt_pst',
            image: 'img_pst',
            shape: 'shp_pst',
            drawing: 'drw_pst',
            signature: 'sig_pst',
            annotation: 'ann_pst',
            whiteout: 'wht_pst',
            redact: 'rdc_pst',
          };

          const newId = generateElementId(prefixMap[source.type] || 'elem_pst');
          const pasted: PdfElement = {
            ...structuredClone(source),
            id: newId,
            pageIndex: activePageIndex,
            x: source.x + 20,
            y: source.y + 20,
            zIndex: maxZ + 1,
          };

          handleAddElement(pasted);
          setSelectedElementId(newId);
          setActiveTool('select');
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedElementId) {
          e.preventDefault();
          handleDuplicateElement(selectedElementId);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementId) {
          e.preventDefault();
          const newElements = editorState.elements.filter((el) => el.id !== selectedElementId);
          updateEditorState({ ...editorState, elements: newElements });
          setSelectedElementId(null);
        }
      } else if (e.key === 'Escape') {
        setSelectedElementId(null);
        setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorState, selectedElementId, activePageIndex, handleUndo, handleRedo, updateEditorState]);

  // ---------------------------------------------------------------------------
  // ELEMENT & LAYER ACTIONS
  // ---------------------------------------------------------------------------
  const getPageElementsSorted = useCallback(
    (pageIdx: number) => {
      return editorState.elements
        .filter((el) => el.pageIndex === pageIdx)
        .sort((a, b) => a.zIndex - b.zIndex);
    },
    [editorState.elements]
  );

  const handleAddElement = (element: PdfElement) => {
    updateEditorState({
      ...editorState,
      elements: [...editorState.elements, element],
    });
  };

  const handleUpdateElement = (updated: PdfElement) => {
    const newElements = editorState.elements.map((el) =>
      el.id === updated.id ? updated : el
    );
    updateEditorState({
      ...editorState,
      elements: newElements,
    });
  };

  const handleDeleteElement = (id: string) => {
    const newElements = editorState.elements.filter((el) => el.id !== id);
    updateEditorState({
      ...editorState,
      elements: newElements,
    });
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
  };

  const handleBringToFront = (id: string) => {
    const el = editorState.elements.find((e) => e.id === id);
    if (!el) return;
    const pageElems = getPageElementsSorted(el.pageIndex);
    const maxZ = pageElems.length > 0 ? Math.max(...pageElems.map((e) => e.zIndex)) : 0;
    handleUpdateElement({ ...el, zIndex: maxZ + 1 });
  };

  const handleSendToBack = (id: string) => {
    const el = editorState.elements.find((e) => e.id === id);
    if (!el) return;
    const pageElems = getPageElementsSorted(el.pageIndex);
    const minZ = pageElems.length > 0 ? Math.min(...pageElems.map((e) => e.zIndex)) : 1;
    handleUpdateElement({ ...el, zIndex: Math.max(1, minZ - 1) });
  };

  const handleBringForward = (id: string) => {
    const el = editorState.elements.find((e) => e.id === id);
    if (!el) return;
    const pageElems = getPageElementsSorted(el.pageIndex);
    const idx = pageElems.findIndex((e) => e.id === id);
    if (idx < 0 || idx >= pageElems.length - 1) return; // Already at top
    const nextEl = pageElems[idx + 1];
    const targetZ = nextEl.zIndex >= el.zIndex ? nextEl.zIndex + 1 : el.zIndex + 1;
    const updatedElements = editorState.elements.map((e) => {
      if (e.id === el.id) return { ...e, zIndex: targetZ };
      return e;
    });
    updateEditorState({ ...editorState, elements: updatedElements });
  };

  const handleSendBackward = (id: string) => {
    const el = editorState.elements.find((e) => e.id === id);
    if (!el) return;
    const pageElems = getPageElementsSorted(el.pageIndex);
    const idx = pageElems.findIndex((e) => e.id === id);
    if (idx <= 0) return; // Already at bottom
    const prevEl = pageElems[idx - 1];
    const targetZ = Math.max(1, prevEl.zIndex <= el.zIndex ? prevEl.zIndex - 1 : el.zIndex - 1);
    const updatedElements = editorState.elements.map((e) => {
      if (e.id === el.id) return { ...e, zIndex: targetZ };
      return e;
    });
    updateEditorState({ ...editorState, elements: updatedElements });
  };

  const handleDuplicateElement = (id: string) => {
    const el = editorState.elements.find((e) => e.id === id);
    if (!el) return;
    const pageElems = getPageElementsSorted(el.pageIndex);
    const maxZ = pageElems.length > 0 ? Math.max(...pageElems.map((e) => e.zIndex)) : 0;

    const prefixMap: Record<string, string> = {
      text: 'txt_dup',
      image: 'img_dup',
      shape: 'shp_dup',
      drawing: 'drw_dup',
      signature: 'sig_dup',
      annotation: 'ann_dup',
      whiteout: 'wht_dup',
      redact: 'rdc_dup',
    };

    const newId = generateElementId(prefixMap[el.type] || 'elem_dup');
    const duplicated: PdfElement = {
      ...JSON.parse(JSON.stringify(el)),
      id: newId,
      x: el.x + 15,
      y: el.y + 15,
      zIndex: maxZ + 1,
    };

    handleAddElement(duplicated);
    setSelectedElementId(newId);
    setActiveTool('select');
  };

  // Start in-place editing of existing PDF text item
  const handleStartEditText = (item: ExtractedTextItem) => {
    const editedTextElem: TextElement = {
      id: generateElementId('txt_edit'),
      type: 'text',
      pageIndex: item.pageIndex,
      x: item.x,
      y: item.y,
      width: Math.max(item.width, 120),
      height: Math.max(item.height, 30),
      text: item.text,
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontSize: item.fontSize,
      color: item.color || '#000000',
      bold: false,
      italic: false,
      underline: false,
      align: 'left',
      opacity: 1,
      zIndex: editorState.elements.length + 1,
      isEditedOriginal: true,
      originalText: item.text,
      originalRect: [item.x, item.y, item.x + item.width, item.y + item.height],
    };

    handleAddElement(editedTextElem);
    setSelectedElementId(editedTextElem.id);
    setActiveTool('select');
  };

  // Image Upload handler
  const handleInsertImage = (e: ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const dataUrl = loadEvt.target?.result as string;
      const curPage = editorState.pages[activePageIndex] || editorState.pages[0];
      const newImg: ImageElement = {
        id: generateElementId('img'),
        type: 'image',
        pageIndex: curPage.pageIndex,
        x: 50,
        y: 50,
        width: 160,
        height: 120,
        imageData: dataUrl,
        opacity: 1,
        rotation: 0,
        zIndex: editorState.elements.length + 1,
      };
      handleAddElement(newImg);
      setSelectedElementId(newImg.id);
      setActiveTool('select');
    };
    reader.readAsDataURL(imgFile);
    e.target.value = '';
  };

  // Signature Save handler
  const handleSaveSignature = (imageData: string, sigType: 'draw' | 'type' | 'upload') => {
    const curPage = editorState.pages[activePageIndex] || editorState.pages[0];
    const newSig = {
      id: generateElementId('sig'),
      type: 'signature' as const,
      signatureType: sigType,
      pageIndex: curPage.pageIndex,
      x: 60,
      y: curPage.height - 120,
      width: 180,
      height: 70,
      imageData,
      opacity: 1,
      rotation: 0,
      zIndex: editorState.elements.length + 1,
    };
    handleAddElement(newSig);
    setSelectedElementId(newSig.id);
    setActiveTool('select');
  };

  // ---------------------------------------------------------------------------
  // PAGE MANAGEMENT ACTIONS
  // ---------------------------------------------------------------------------
  const handleMovePage = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= editorState.pages.length || toIndex >= editorState.pages.length) return;
    const newPages = [...editorState.pages];
    const [moved] = newPages.splice(fromIndex, 1);
    newPages.splice(toIndex, 0, moved);
    // Re-index pages
    const reindexed = newPages.map((p, idx) => ({ ...p, pageIndex: idx }));
    updateEditorState({ ...editorState, pages: reindexed });
    setActivePageIndex(toIndex);
  };

  const handleRotatePage = (index: number) => {
    const newPages = editorState.pages.map((p, idx) =>
      idx === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p
    );
    updateEditorState({ ...editorState, pages: newPages });
  };

  const handleDeletePage = (index: number) => {
    if (editorState.pages.length <= 1) return;
    const targetPage = editorState.pages[index];
    const newPages = editorState.pages
      .filter((_, idx) => idx !== index)
      .map((p, idx) => ({ ...p, pageIndex: idx }));
    const newDeleted = targetPage.originalPageIndex !== undefined
      ? [...editorState.deletedOriginalPages, targetPage.originalPageIndex]
      : editorState.deletedOriginalPages;
    // Remove elements on deleted page
    const newElements = editorState.elements.filter((el) => el.pageIndex !== index);
    updateEditorState({
      ...editorState,
      pages: newPages,
      deletedOriginalPages: newDeleted,
      elements: newElements,
    });
    setActivePageIndex(Math.max(0, index - 1));
  };

  const handleDuplicatePage = (index: number) => {
    const target = editorState.pages[index];
    if (!target) return;
    const newPage: PageLayout = {
      ...target,
      pageIndex: index + 1,
    };
    const newPages = [...editorState.pages];
    newPages.splice(index + 1, 0, newPage);
    const reindexed = newPages.map((p, idx) => ({ ...p, pageIndex: idx }));
    updateEditorState({ ...editorState, pages: reindexed });
    setActivePageIndex(index + 1);
  };

  const handleAddBlankPage = (afterIndex: number) => {
    const prevPage = editorState.pages[afterIndex] || { width: 595.28, height: 841.89 };
    const newBlankPage: PageLayout = {
      pageIndex: afterIndex + 1,
      originalPageIndex: -1,
      width: prevPage.width,
      height: prevPage.height,
      rotation: 0,
      isBlank: true,
    };
    const newPages = [...editorState.pages];
    newPages.splice(afterIndex + 1, 0, newBlankPage);
    const reindexed = newPages.map((p, idx) => ({ ...p, pageIndex: idx }));
    updateEditorState({ ...editorState, pages: reindexed });
    setActivePageIndex(afterIndex + 1);
  };

  // ---------------------------------------------------------------------------
  // ZOOM & VIEWPORT CONTROLS
  // ---------------------------------------------------------------------------
  const handleZoomIn = () => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)));
  const handleFitWidth = () => {
    const viewportWidth = viewportScrollRef.current?.clientWidth || 800;
    const curPage = editorState.pages[activePageIndex] || { width: 595.28 };
    const newZoom = Math.max(0.4, Math.min(2.0, (viewportWidth - 80) / curPage.width));
    setZoom(+newZoom.toFixed(2));
  };
  const handleFitPage = () => {
    const viewportHeight = viewportScrollRef.current?.clientHeight || 600;
    const curPage = editorState.pages[activePageIndex] || { height: 841.89 };
    const newZoom = Math.max(0.4, Math.min(1.5, (viewportHeight - 60) / curPage.height));
    setZoom(+newZoom.toFixed(2));
  };

  // ---------------------------------------------------------------------------
  // EXPORT & DOWNLOAD (Backend Processing Pipeline)
  // ---------------------------------------------------------------------------
  const handleSaveAndExport = async () => {
    const redactionCount = editorState.elements.filter((el) => el.type === 'redact').length;
    if (redactionCount > 0 && !isRedactionModalOpen) {
      setIsRedactionModalOpen(true);
      return;
    }

    setIsExporting(true);
    try {
      // Build backend payload
      const pageOperations = {
        order: editorState.pages.filter((p) => !p.isBlank).map((p) => p.originalPageIndex),
        rotations: editorState.pages.reduce((acc, p) => {
          if (p.rotation !== 0 && !p.isBlank) acc[p.originalPageIndex] = p.rotation;
          return acc;
        }, {} as Record<number, number>),
        deleted_pages: editorState.deletedOriginalPages,
        // Blank pages positioned by their index in the FINAL page list; the
        // backend inserts them in ascending order after reordering/deletion.
        blank_pages: editorState.pages
          .map((p, idx) => (p.isBlank ? { position: idx, width: p.width, height: p.height } : null))
          .filter((b): b is { position: number; width: number; height: number } => b !== null),
      };

      const pageRot = (idx: number): number => {
        const p = editorState.pages[idx];
        if (!p) return 0;
        return (((p.baseRotation ?? 0) + p.rotation) % 360 + 360) % 360;
      };

      const textEdits = editorState.elements
        .filter((el) => el.type === 'text' && (el as TextElement).isEditedOriginal)
        .map((el) => {
          const te = el as TextElement;
          return {
            page: te.pageIndex,
            original_rect: te.originalRect || elementToPyMuPdfRect(te.x, te.y, te.width, te.height),
            new_x: te.x,
            new_y: te.y,
            new_text: te.text,
            font_family: te.fontFamily,
            font_size: te.fontSize,
            color: te.color,
            bold: te.bold,
            italic: te.italic,
            align: te.align,
            page_rotation: pageRot(te.pageIndex),
            z_index: te.zIndex ?? 0,
          };
        });

      const addedTexts = editorState.elements
        .filter((el) => el.type === 'text' && !(el as TextElement).isEditedOriginal)
        .map((el) => {
          const te = el as TextElement;
          return {
            page: te.pageIndex,
            x: te.x,
            y: te.y,
            width: te.width,
            height: te.height,
            text: te.text,
            font_family: te.fontFamily,
            font_size: te.fontSize,
            color: te.color,
            bold: te.bold,
            italic: te.italic,
            underline: te.underline,
            align: te.align,
            opacity: te.opacity ?? 1,
            rotation: te.rotation ?? 0,
            z_index: te.zIndex ?? 0,
          };
        });

      // NEW images inserted by the user — every pre-existing image carries an
      // `originId` tag from analysis, so any image element WITHOUT one is a
      // genuine user insert.
      const images = editorState.elements
        .filter((el) => el.type === 'image')
        .filter((el) => !(el as ImageElement).originId)
        .map((el) => {
          const ie = el as ImageElement;
          return {
            page: ie.pageIndex,
            x: ie.x,
            y: ie.y,
            width: ie.width,
            height: ie.height,
            image_data: ie.imageData,
            opacity: ie.opacity ?? 1,
            rotation: ie.rotation ?? 0,
            z_index: ie.zIndex ?? 0,
          };
        });

      // Existing-image modifications: moved / resized / rotated / deleted.
      const imageEdits = originalImagesRef.current
        .map((oi) => {
          const current = editorState.elements.find(
            (el) =>
              el.type === 'image' &&
              Math.abs(el.x - oi.x) < 0.5 &&
              Math.abs(el.y - oi.y) < 0.5 &&
              Math.abs(el.width - oi.width) < 0.5 &&
              Math.abs(el.height - oi.height) < 0.5 &&
              el.pageIndex === oi.pageIndex
          );
          if (current) return null; // untouched → leave original untouched
          const replacement = editorState.elements.find(
            (el) => el.type === 'image' && (el as ImageElement).imageData === oi.imageData && el.pageIndex === oi.pageIndex && el !== current
          );
          return {
            page: oi.pageIndex,
            original_bbox: [oi.x, oi.y, oi.x + oi.width, oi.y + oi.height] as [number, number, number, number],
            action: replacement ? 'replace' : 'delete',
            x: replacement?.x ?? 0,
            y: replacement?.y ?? 0,
            width: replacement?.width ?? 0,
            height: replacement?.height ?? 0,
            rotation: (replacement as ImageElement | undefined)?.rotation ?? 0,
            image_data: replacement ? (replacement as ImageElement).imageData : null,
            z_index: replacement?.zIndex ?? 0,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      const signatures = editorState.elements
        .filter((el) => el.type === 'signature')
        .map((el) => ({
          page: el.pageIndex,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          image_data: (el as any).imageData,
          opacity: el.opacity ?? 1,
          rotation: el.rotation ?? 0,
          z_index: el.zIndex ?? 0,
        }));

      const drawings = editorState.elements
        .filter((el) => el.type === 'drawing')
        .map((el) => ({
          page: el.pageIndex,
          paths: (el as any).paths,
          z_index: el.zIndex ?? 0,
        }));

      const shapes = editorState.elements
        .filter((el) => el.type === 'shape')
        .map((el) => {
          const se = el as any;
          return {
            page: se.pageIndex,
            type: se.shapeType,
            x: se.x,
            y: se.y,
            width: se.width,
            height: se.height,
            points: se.points ? [[se.points[0].x, se.points[0].y], [se.points[1].x, se.points[1].y]] : undefined,
            fill_color: se.fillColor,
            border_color: se.borderColor,
            border_width: se.borderWidth,
            opacity: se.opacity ?? 1,
            rotation: se.rotation ?? 0,
            z_index: se.zIndex ?? 0,
          };
        });

      const annotations = editorState.elements
        .filter((el) => el.type === 'annotation')
        .map((el) => {
          const ae = el as any;
          return {
            page: ae.pageIndex,
            type: ae.annotationType,
            rect: elementToPyMuPdfRect(ae.x, ae.y, ae.width, ae.height),
            color: ae.color,
            text: ae.text,
            page_rotation: pageRot(ae.pageIndex),
            z_index: ae.zIndex ?? 0,
          };
        });

      const whiteouts = editorState.elements
        .filter((el) => el.type === 'whiteout')
        .map((el) => ({
          page: el.pageIndex,
          rect: elementToPyMuPdfRect(el.x, el.y, el.width, el.height),
          color: (el as any).color || '#ffffff',
          page_rotation: pageRot(el.pageIndex),
          z_index: el.zIndex ?? 0,
        }));

      const redactions = editorState.elements
        .filter((el) => el.type === 'redact')
        .map((el) => ({
          page: el.pageIndex,
          rect: elementToPyMuPdfRect(el.x, el.y, el.width, el.height),
          fill_color: (el as any).fillColor || '#000000',
          page_rotation: pageRot(el.pageIndex),
          z_index: el.zIndex ?? 0,
        }));

      const watermarks = editorState.watermark ? [editorState.watermark] : [];

      const operationsPayload = {
        page_operations: pageOperations,
        text_edits: textEdits,
        added_texts: addedTexts,
        images,
        signatures,
        drawings,
        shapes,
        annotations,
        image_edits: imageEdits,
        whiteouts,
        redactions,
        watermarks,
      };

      const formData = new FormData();
      formData.append('file', file);
      formData.append('operations', JSON.stringify(operationsPayload));

      const response = await apiFetch('/api/pdf/edit', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errDetail = 'Export failed';
        try {
          const errJson = await response.json();
          errDetail = errJson.detail || errDetail;
        } catch {
          errDetail = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errDetail);
      }

      const outBlob = await response.blob();
      const filename = `edited_${file.name.replace(/\.[^/.]+$/, '')}.pdf`;
      onExportSuccess(outBlob, filename);
    } catch (err: any) {
      console.error('[Export Error]', err);
      onError(err.message || 'An error occurred while saving your edited PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const selectedElement = editorState.elements.find((el) => el.id === selectedElementId) || null;
  const curPage = editorState.pages[activePageIndex];

  return (
    <div className="pdf-editor-workspace">
      {/* 1. Top Action Toolbar */}
      <EditorToolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitWidth={handleFitWidth}
        onFitPage={handleFitPage}
        currentPageIndex={activePageIndex}
        totalPages={editorState.pages.length}
        onPrevPage={() => setActivePageIndex((p) => Math.max(0, p - 1))}
        onNextPage={() => setActivePageIndex((p) => Math.min(editorState.pages.length - 1, p + 1))}
        onOpenSignatureModal={() => setIsSignatureModalOpen(true)}
        onOpenWatermarkModal={() => setIsWatermarkModalOpen(true)}
        onInsertImage={handleInsertImage}
        onSaveAndExport={handleSaveAndExport}
        isExporting={isExporting}
      />

      {/* 2. Main Studio Body: Left Thumbnails + Center Viewport + Right Inspector */}
      <div className="editor-main-studio">
        {/* Left Thumbnail Sidebar */}
        <PageThumbnailSidebar
          pages={editorState.pages}
          activePageIndex={activePageIndex}
          onSelectPage={setActivePageIndex}
          onMovePage={handleMovePage}
          onRotatePage={handleRotatePage}
          onDeletePage={handleDeletePage}
          onDuplicatePage={handleDuplicatePage}
          onAddBlankPage={handleAddBlankPage}
          thumbnailUrls={thumbnails}
          isOpen={true}
        />

        {/* Center Multi-Page Canvas Viewport */}
        <main
          className="editor-canvas-viewport"
          ref={viewportScrollRef}
          data-tool={activeTool}
        >
          {curPage ? (
            <div className="page-canvas-wrapper">
              {isScannedPdf && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    backgroundColor: '#fef3c7',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    color: '#92400e',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    maxWidth: '595px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>📷</span>
                  <span>
                    <strong>Scanned / Image PDF Detected:</strong> Embedded text is rasterized into image pixels and cannot be directly selected. Use <em>Whiteout</em>, <em>Redact</em>, or <em>Add Text</em> to modify content.
                  </span>
                </div>
              )}
              <PageCanvas
                page={curPage}
                pdfDoc={pdfDoc}
                scale={zoom}
                activeTool={activeTool}
                elements={editorState.elements}
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
                onAddElement={handleAddElement}
                onUpdateElement={handleUpdateElement}
                onStartEditText={handleStartEditText}
              />
            </div>
          ) : (
            <div className="editor-canvas-loading">
              <div className="canvas-loading-page-skeleton" />
              <p className="canvas-loading-text">
                Preparing your document<span className="loading-dots" />
              </p>
            </div>
          )}
        </main>

        {/* Right Contextual Properties Panel */}
        <PropertiesPanel
          selectedElement={selectedElement}
          activeTool={activeTool}
          onUpdateElement={handleUpdateElement}
          onDeleteElement={handleDeleteElement}
          onBringForward={handleBringForward}
          onSendBackward={handleSendBackward}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
          onDuplicateElement={handleDuplicateElement}
          onSelectElement={setSelectedElementId}
          pageElements={editorState.elements.filter((el) => el.pageIndex === activePageIndex)}
          currentPageNumber={activePageIndex + 1}
          totalPageCount={editorState.pages.length}
        />
      </div>

      {/* Modals */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={handleSaveSignature}
      />

      <WatermarkModal
        isOpen={isWatermarkModalOpen}
        onClose={() => setIsWatermarkModalOpen(false)}
        onSave={(wm) => updateEditorState({ ...editorState, watermark: wm })}
        currentConfig={editorState.watermark}
        totalPages={editorState.pages.length}
      />

      <RedactionConfirmModal
        isOpen={isRedactionModalOpen}
        onClose={() => setIsRedactionModalOpen(false)}
        onConfirm={handleSaveAndExport}
        redactionCount={editorState.elements.filter((el) => el.type === 'redact').length}
      />
    </div>
  );
};
