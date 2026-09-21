import type { FC } from 'react';
import { Sparkles } from 'lucide-react';
import type { ToolCategory } from '../types/tool';

interface FooterProps {
  onSelectCategory: (cat: ToolCategory) => void;
  onOpenTool?: (toolId: string) => void;
}

export const Footer: FC<FooterProps> = ({ onSelectCategory, onOpenTool }) => {
  const handleCategoryClick = (category: ToolCategory) => {
    onSelectCategory(category);
    const toolsEl = document.getElementById('tools-section');
    if (toolsEl) {
      toolsEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleToolClick = (toolId: string, categoryFallback: ToolCategory) => {
    if (onOpenTool) {
      onOpenTool(toolId);
    } else {
      handleCategoryClick(categoryFallback);
    }
  };

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <a href="#" className="brand-logo" aria-label="GlowPDF Home">
              <div className="brand-icon-wrapper">
                <Sparkles size={20} />
              </div>
              <span>GlowPDF</span>
            </a>
            <p className="footer-brand-desc">
              Simple, modern, and accessible online PDF tools designed for swift everyday document workflows. Completely free and account-free.
            </p>
          </div>

          <div>
            <h4 className="footer-column-title">Organize PDF</h4>
            <ul className="footer-links">
              <li>
                <button className="footer-link" onClick={() => handleToolClick('merge-pdf', 'organize')}>
                  Merge PDF
                </button>
              </li>
              <li>
                <button className="footer-link" onClick={() => handleToolClick('split-pdf', 'organize')}>
                  Split PDF
                </button>
              </li>
              <li>
                <button className="footer-link" onClick={() => handleToolClick('rotate-pdf', 'organize')}>
                  Rotate PDF
                </button>
              </li>
              <li>
                <button className="footer-link" onClick={() => handleCategoryClick('organize')}>
                  Extract Pages
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="footer-column-title">Convert PDF</h4>
            <ul className="footer-links">
              <li>
                <button className="footer-link" onClick={() => handleToolClick('word-to-pdf', 'convert')}>
                  Word to PDF
                </button>
              </li>
              <li>
                <button className="footer-link" onClick={() => handleToolClick('html-to-pdf', 'convert')}>
                  HTML to PDF
                </button>
              </li>
              <li>
                <button className="footer-link" onClick={() => handleToolClick('pdf-to-word', 'convert')}>
                  PDF to Word
                </button>
              </li>
              <li>
                <button className="footer-link" onClick={() => handleToolClick('pdf-to-powerpoint', 'convert')}>
                  PDF to PowerPoint
                </button>
              </li>
              <li>
                <button className="footer-link" onClick={() => handleToolClick('pdf-to-excel', 'convert')}>
                  PDF to Excel
                </button>
              </li>
              <li>
                <button className="footer-link" onClick={() => handleToolClick('pdf-to-jpg', 'convert')}>
                  PDF to JPG
                </button>
              </li>
              <li>
                <button className="footer-link" onClick={() => handleToolClick('jpg-to-pdf', 'convert')}>
                  JPG to PDF
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="footer-column-title">Security & More</h4>
            <ul className="footer-links">
              <li>
                <button className="footer-link" onClick={() => handleToolClick('protect-pdf', 'security')}>
                  Protect PDF
                </button>
              </li>
              <li>
                <button className="footer-link" onClick={() => handleToolClick('unlock-pdf', 'security')}>
                  Unlock PDF
                </button>
              </li>
              <li>
                <button className="footer-link" onClick={() => handleToolClick('watermark-pdf', 'security')}>
                  Watermark PDF
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>
            © {new Date().getFullYear()} GlowPDF. All rights reserved.
          </div>
          <div className="footer-bottom-links">
            <span>Free & Open Web Experience</span>
            <span>•</span>
            <span>No Account Required</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
