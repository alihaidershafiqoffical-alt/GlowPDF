import { useState, useEffect, lazy, Suspense } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ToolsGrid } from './components/ToolsGrid';
import { Benefits } from './components/Benefits';
import { Footer } from './components/Footer';
import { TOOLS_DATA } from './data/tools';
import type { ToolCategory } from './types/tool';

// Lazy-load all 19 tool modules on demand to keep initial bundle size lightweight (<200 kB)
const EditPdf = lazy(() => import('./components/EditPdf').then(m => ({ default: m.EditPdf })));
const MergePdf = lazy(() => import('./components/MergePdf').then(m => ({ default: m.MergePdf })));
const SplitPdf = lazy(() => import('./components/SplitPdf').then(m => ({ default: m.SplitPdf })));
const CompressPdf = lazy(() => import('./components/CompressPdf').then(m => ({ default: m.CompressPdf })));
const PdfToWord = lazy(() => import('./components/PdfToWord').then(m => ({ default: m.PdfToWord })));
const PdfToJpg = lazy(() => import('./components/PdfToJpg').then(m => ({ default: m.PdfToJpg })));
const JpgToPdf = lazy(() => import('./components/JpgToPdf').then(m => ({ default: m.JpgToPdf })));
const WatermarkPdf = lazy(() => import('./components/WatermarkPdf').then(m => ({ default: m.WatermarkPdf })));
const ProtectPdf = lazy(() => import('./components/ProtectPdf').then(m => ({ default: m.ProtectPdf })));
const UnlockPdf = lazy(() => import('./components/UnlockPdf').then(m => ({ default: m.UnlockPdf })));
const RotatePdf = lazy(() => import('./components/RotatePdf').then(m => ({ default: m.RotatePdf })));
const WordToPdf = lazy(() => import('./components/WordToPdf').then(m => ({ default: m.WordToPdf })));
const HtmlToPdf = lazy(() => import('./components/HtmlToPdf').then(m => ({ default: m.HtmlToPdf })));
const DeletePages = lazy(() => import('./components/DeletePages').then(m => ({ default: m.DeletePages })));
const PdfToPowerpoint = lazy(() => import('./components/PdfToPowerpoint').then(m => ({ default: m.PdfToPowerpoint })));
const PowerpointToPdf = lazy(() => import('./components/PowerpointToPdf').then(m => ({ default: m.PowerpointToPdf })));
const PdfToExcel = lazy(() => import('./components/PdfToExcel').then(m => ({ default: m.PdfToExcel })));
const ExcelToPdf = lazy(() => import('./components/ExcelToPdf').then(m => ({ default: m.ExcelToPdf })));
const PdfToPdfa = lazy(() => import('./components/PdfToPdfa').then(m => ({ default: m.PdfToPdfa })));

const ToolLoadingFallback = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
    <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <span style={{ color: 'var(--text-secondary, #64748b)', fontWeight: 600 }}>Loading Glow PDF Tool...</span>
  </div>
);

const VALID_TOOLS = ['edit-pdf', 'merge-pdf', 'split-pdf', 'compress-pdf', 'pdf-to-word', 'pdf-to-powerpoint', 'powerpoint-to-pdf', 'pdf-to-excel', 'excel-to-pdf', 'pdf-to-pdfa', 'pdf-to-jpg', 'jpg-to-pdf', 'word-to-pdf', 'html-to-pdf', 'watermark-pdf', 'protect-pdf', 'unlock-pdf', 'rotate-pdf', 'delete-pages'];

export function App() {
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTool, setActiveTool] = useState<string | null>(() => {
    const hash = window.location.hash.replace('#', '');
    return VALID_TOOLS.includes(hash) ? hash : null;
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (VALID_TOOLS.includes(hash)) {
        setActiveTool(hash);
      } else if (!window.location.hash) {
        setActiveTool(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleOpenTool = (toolId: string) => {
    setActiveTool(toolId);
    window.location.hash = toolId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToHome = () => {
    setActiveTool(null);
    window.location.hash = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExploreClick = () => {
    handleBackToHome();
    setSelectedCategory('all');
    setTimeout(() => {
      const toolsEl = document.getElementById('tools-section');
      if (toolsEl) {
        toolsEl.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  };

  const handleSelectCategory = (cat: string | ToolCategory) => {
    if (activeTool) {
      handleBackToHome();
    }
    setSelectedCategory(cat as ToolCategory);
    setTimeout(() => {
      const toolsEl = document.getElementById('tools-section');
      if (toolsEl) {
        toolsEl.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  };

  return (
    <div className="app-container">
      <Navbar 
        onSelectCategory={handleSelectCategory} 
        onHomeClick={handleBackToHome}
        onOpenEditPdf={() => handleOpenTool('edit-pdf')}
        onOpenMergePdf={() => handleOpenTool('merge-pdf')}
        onOpenSplitPdf={() => handleOpenTool('split-pdf')}
        onOpenCompressPdf={() => handleOpenTool('compress-pdf')}
        onOpenPdfToWord={() => handleOpenTool('pdf-to-word')}
        onOpenPdfToJpg={() => handleOpenTool('pdf-to-jpg')}
        onOpenJpgToPdf={() => handleOpenTool('jpg-to-pdf')}
        onOpenTool={handleOpenTool}
      />
      <main>
        <Suspense fallback={<ToolLoadingFallback />}>
          {activeTool === 'edit-pdf' ? (
            <EditPdf onBack={handleBackToHome} />
          ) : activeTool === 'merge-pdf' ? (
            <MergePdf onBack={handleBackToHome} />
          ) : activeTool === 'split-pdf' ? (
            <SplitPdf onBack={handleBackToHome} />
          ) : activeTool === 'compress-pdf' ? (
            <CompressPdf onBack={handleBackToHome} />
          ) : activeTool === 'pdf-to-word' ? (
            <PdfToWord onBack={handleBackToHome} />
          ) : activeTool === 'pdf-to-powerpoint' ? (
            <PdfToPowerpoint onBack={handleBackToHome} onOpenUnlock={() => handleOpenTool('unlock-pdf')} />
          ) : activeTool === 'powerpoint-to-pdf' ? (
            <PowerpointToPdf onBack={handleBackToHome} />
          ) : activeTool === 'pdf-to-excel' ? (
            <PdfToExcel onBack={handleBackToHome} onOpenUnlock={() => handleOpenTool('unlock-pdf')} />
          ) : activeTool === 'excel-to-pdf' ? (
            <ExcelToPdf onBack={handleBackToHome} />
          ) : activeTool === 'pdf-to-jpg' ? (
            <PdfToJpg onBack={handleBackToHome} />
          ) : activeTool === 'jpg-to-pdf' ? (
            <JpgToPdf onBack={handleBackToHome} />
          ) : activeTool === 'word-to-pdf' ? (
            <WordToPdf onBack={handleBackToHome} />
          ) : activeTool === 'html-to-pdf' ? (
            <HtmlToPdf onBack={handleBackToHome} />
          ) : activeTool === 'watermark-pdf' ? (
            <WatermarkPdf onBack={handleBackToHome} />
          ) : activeTool === 'protect-pdf' ? (
            <ProtectPdf onBack={handleBackToHome} />
          ) : activeTool === 'unlock-pdf' ? (
            <UnlockPdf onBack={handleBackToHome} />
          ) : activeTool === 'rotate-pdf' ? (
            <RotatePdf onBack={handleBackToHome} />
          ) : activeTool === 'delete-pages' ? (
            <DeletePages onBack={handleBackToHome} />
          ) : activeTool === 'pdf-to-pdfa' ? (
            <PdfToPdfa onBack={handleBackToHome} />
          ) : (
            <>
              <Hero
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onExploreClick={handleExploreClick}
              />
              <ToolsGrid
                tools={TOOLS_DATA}
                selectedCategory={selectedCategory}
                onSelectCategory={handleSelectCategory}
                searchQuery={searchQuery}
                onOpenTool={handleOpenTool}
              />
              <Benefits />
            </>
          )}
        </Suspense>
      </main>
      <Footer onSelectCategory={handleSelectCategory} onOpenTool={handleOpenTool} />
    </div>
  );
}

export default App;
