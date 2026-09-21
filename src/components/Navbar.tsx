import { useState, useRef, useEffect } from 'react';
import type { FC } from 'react';
import { Sparkles, Menu, X, ChevronDown } from 'lucide-react';
import { COMPLETED_TOOLS } from '../data/tools';

interface NavbarProps {
  onSelectCategory?: (category: string) => void;
  onHomeClick?: () => void;
  onOpenMergePdf?: () => void;
  onOpenSplitPdf?: () => void;
  onOpenCompressPdf?: () => void;
  onOpenPdfToWord?: () => void;
  onOpenPdfToJpg?: () => void;
  onOpenJpgToPdf?: () => void;
  onOpenEditPdf?: () => void;
  onOpenTool?: (toolId: string) => void;
}

type ConverterDirection = 'to' | 'from';
type ConverterType = 'jpg' | 'word' | 'ppt' | 'excel' | 'html' | 'pdfa';

interface ConverterMenuItem {
  id: string;
  title: string;
  type: ConverterType;
  highlight?: boolean;
}

const CONVERT_TO_PDF_ITEMS: ConverterMenuItem[] = [
  { id: 'jpg-to-pdf', title: 'JPG to PDF', type: 'jpg' },
  { id: 'word-to-pdf', title: 'WORD to PDF', type: 'word' },
  { id: 'powerpoint-to-pdf', title: 'POWERPOINT to PDF', type: 'ppt' },
  { id: 'excel-to-pdf', title: 'EXCEL to PDF', type: 'excel' },
  { id: 'html-to-pdf', title: 'HTML to PDF', type: 'html' },
];

const CONVERT_FROM_PDF_ITEMS: ConverterMenuItem[] = [
  { id: 'pdf-to-jpg', title: 'PDF to JPG', type: 'jpg' },
  { id: 'pdf-to-word', title: 'PDF to WORD', type: 'word', highlight: true },
  { id: 'pdf-to-powerpoint', title: 'PDF to POWERPOINT', type: 'ppt' },
  { id: 'pdf-to-excel', title: 'PDF to EXCEL', type: 'excel' },
  { id: 'pdf-to-pdfa', title: 'PDF to PDF/A', type: 'pdfa' },
];

interface ToolMenuItem {
  id: string;
  title: string;
}

const OPTIMIZE_ITEMS: ToolMenuItem[] = [
  { id: 'compress-pdf', title: 'Compress PDF' },
];

const EDIT_ITEMS: ToolMenuItem[] = [
  { id: 'edit-pdf', title: 'PDF Editor' },
  { id: 'rotate-pdf', title: 'Rotate PDF' },
  { id: 'merge-pdf', title: 'Merge PDF' },
  { id: 'split-pdf', title: 'Split PDF' },
  { id: 'delete-pages', title: 'Delete Pages' },
];

const SECURITY_ITEMS: ToolMenuItem[] = [
  { id: 'unlock-pdf', title: 'Unlock PDF' },
  { id: 'protect-pdf', title: 'Protect PDF' },
  { id: 'watermark-pdf', title: 'Watermark PDF' },
];

// Dual-tile composite badge matching user's exact reference
const renderConverterIcon = (direction: ConverterDirection, type: ConverterType, isCompleted = true) => {
  const iconFilterStyle = isCompleted ? undefined : { filter: 'grayscale(100%)', opacity: 0.75 };
  if (direction === 'to') {
    return (
      <svg style={iconFilterStyle} className="mega-item-icon" viewBox="0 0 28 26" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Top-left source card */}
        {type === 'jpg' && (
          <g>
            <rect x="1" y="1" width="13" height="13" rx="2.5" fill="#fef9c3" stroke="#fef08a" strokeWidth="0.8" />
            <path d="M3.5 10.5 L6.5 6.5 L9.5 10.5 Z" fill="#ca8a04" />
            <circle cx="10" cy="4.5" r="1.2" fill="#ca8a04" />
          </g>
        )}
        {type === 'word' && (
          <g>
            <rect x="1" y="1" width="13" height="13" rx="2.5" fill="#dbeafe" stroke="#bfdbfe" strokeWidth="0.8" />
            <text x="7.5" y="10.5" fontSize="8.5" fontWeight="800" textAnchor="middle" fill="#1d4ed8" fontFamily="sans-serif">W</text>
          </g>
        )}
        {type === 'ppt' && (
          <g>
            <rect x="1" y="1" width="13" height="13" rx="2.5" fill="#ffedd5" stroke="#fed7aa" strokeWidth="0.8" />
            <text x="7.5" y="10.5" fontSize="8.5" fontWeight="800" textAnchor="middle" fill="#c2410c" fontFamily="sans-serif">P</text>
          </g>
        )}
        {type === 'excel' && (
          <g>
            <rect x="1" y="1" width="13" height="13" rx="2.5" fill="#dcfce7" stroke="#bbf7d0" strokeWidth="0.8" />
            <text x="7.5" y="10.5" fontSize="8.5" fontWeight="800" textAnchor="middle" fill="#15803d" fontFamily="sans-serif">X</text>
          </g>
        )}
        {type === 'html' && (
          <g>
            <rect x="1" y="1" width="13" height="13" rx="2.5" fill="#fef3c7" stroke="#fde68a" strokeWidth="0.8" />
            <circle cx="7.5" cy="7.5" r="4.2" stroke="#b45309" strokeWidth="0.9" fill="none" />
            <ellipse cx="7.5" cy="7.5" rx="1.8" ry="4.2" stroke="#b45309" strokeWidth="0.8" fill="none" />
            <line x1="3.3" y1="7.5" x2="11.7" y2="7.5" stroke="#b45309" strokeWidth="0.8" />
          </g>
        )}

        {/* Bottom-right target PDF badge with arrow */}
        <rect
          x="11"
          y="9"
          width="13"
          height="13"
          rx="2.5"
          fill={
            type === 'jpg'
              ? '#eab308'
              : type === 'word'
              ? '#2563eb'
              : type === 'ppt'
              ? '#ea580c'
              : type === 'excel'
              ? '#16a34a'
              : '#eab308'
          }
        />
        <path
          d="M14.5 12.5 L19.5 17.5 M19.5 13.5 L19.5 17.5 L15.5 17.5"
          stroke="#ffffff"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // direction === 'from'
  return (
    <svg style={iconFilterStyle} className="mega-item-icon" viewBox="0 0 28 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Top-left PDF source tile with arrow */}
      <rect
        x="1"
        y="1"
        width="13"
        height="13"
        rx="2.5"
        fill={
          type === 'jpg'
            ? '#fef9c3'
            : type === 'word'
            ? '#dbeafe'
            : type === 'ppt'
            ? '#ffedd5'
            : type === 'excel'
            ? '#dcfce7'
            : '#e0f2fe'
        }
        stroke={
          type === 'jpg'
            ? '#fef08a'
            : type === 'word'
            ? '#bfdbfe'
            : type === 'ppt'
            ? '#fed7aa'
            : type === 'excel'
            ? '#bbf7d0'
            : '#bae6fd'
        }
        strokeWidth="0.8"
      />
      <path
        d="M4.5 4.5 L9.5 9.5 M9.5 5.5 L9.5 9.5 L5.5 9.5"
        stroke={
          type === 'jpg'
            ? '#ca8a04'
            : type === 'word'
            ? '#2563eb'
            : type === 'ppt'
            ? '#ea580c'
            : type === 'excel'
            ? '#16a34a'
            : '#0284c7'
        }
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Bottom-right target format badge */}
      {type === 'jpg' && (
        <g>
          <rect x="11" y="9" width="13" height="13" rx="2.5" fill="#eab308" />
          <path d="M13.5 18.5 L16.5 14.5 L19.5 18.5 Z" fill="#ffffff" />
          <circle cx="20" cy="12.5" r="1.2" fill="#ffffff" />
        </g>
      )}
      {type === 'word' && (
        <g>
          <rect x="11" y="9" width="13" height="13" rx="2.5" fill="#2563eb" />
          <text x="17.5" y="18.5" fontSize="8.5" fontWeight="800" textAnchor="middle" fill="#ffffff" fontFamily="sans-serif">W</text>
        </g>
      )}
      {type === 'ppt' && (
        <g>
          <rect x="11" y="9" width="13" height="13" rx="2.5" fill="#ea580c" />
          <text x="17.5" y="18.5" fontSize="8.5" fontWeight="800" textAnchor="middle" fill="#ffffff" fontFamily="sans-serif">P</text>
        </g>
      )}
      {type === 'excel' && (
        <g>
          <rect x="11" y="9" width="13" height="13" rx="2.5" fill="#16a34a" />
          <text x="17.5" y="18.5" fontSize="8.5" fontWeight="800" textAnchor="middle" fill="#ffffff" fontFamily="sans-serif">X</text>
        </g>
      )}
      {type === 'pdfa' && (
        <g>
          <rect x="11" y="9" width="13" height="13" rx="2.5" fill="#0284c7" />
          <text x="17.5" y="18.2" fontSize="7.5" fontWeight="800" textAnchor="middle" fill="#ffffff" fontFamily="sans-serif">/A</text>
        </g>
      )}
    </svg>
  );
};

const renderOptimizeIcon = (_id: string, isCompleted = true) => {
  const iconFilterStyle = isCompleted ? undefined : { filter: 'grayscale(100%)', opacity: 0.75 };
  return (
    <svg style={iconFilterStyle} className="mega-item-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4.5" fill="#16a34a" />
      <path d="M5.5 5.5L9.5 9.5M9.5 5.5V9.5H5.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 18.5L14.5 14.5M14.5 18.5V14.5H18.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 5.5L14.5 9.5M18.5 9.5H14.5V5.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 18.5L9.5 14.5M5.5 14.5H9.5V18.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const renderEditIcon = (id: string, isCompleted = true) => {
  const iconFilterStyle = isCompleted ? undefined : { filter: 'grayscale(100%)', opacity: 0.75 };
  if (id === 'edit-pdf') {
    return (
      <svg style={iconFilterStyle} className="mega-item-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4.5" fill="#0284c7" />
        {/* Pencil body */}
        <path d="M14.5 5.5L18.5 9.5L9 19H5V15L14.5 5.5Z" fill="#ffffff" fillOpacity="0.9" />
        {/* Pencil tip highlight */}
        <path d="M14.5 5.5L18.5 9.5L16.5 11.5L12.5 7.5L14.5 5.5Z" fill="#ffffff" />
      </svg>
    );
  }
  if (id === 'rotate-pdf') {
    return (
      <svg style={iconFilterStyle} className="mega-item-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4.5" fill="#8b5cf6" />
        <path d="M15 7.5V5L18 7.5H15Z" fill="#ffffff" />
        <path d="M8 12C8 9.79 9.79 8 12 8C13.5 8 14.8 8.8 15.4 10" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M9 16.5V19L6 16.5H9Z" fill="#ffffff" />
        <path d="M16 12C16 14.21 14.21 16 12 16C10.5 16 9.2 15.2 8.6 14" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === 'merge-pdf') {
    return (
      <svg style={iconFilterStyle} className="mega-item-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4.5" fill="#8b5cf6" />
        <rect x="5.5" y="7" width="8" height="11" rx="1.5" fill="#ffffff" fillOpacity="0.75" />
        <rect x="9" y="4.5" width="8.5" height="11.5" rx="1.5" fill="#ffffff" />
        <path d="M12 11.5L14 13.5L12 15.5" stroke="#8b5cf6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === 'split-pdf') {
    return (
      <svg style={iconFilterStyle} className="mega-item-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4.5" fill="#8b5cf6" />
        <circle cx="7.5" cy="7.5" r="2" stroke="#ffffff" strokeWidth="1.3" />
        <circle cx="7.5" cy="16.5" r="2" stroke="#ffffff" strokeWidth="1.3" />
        <path d="M9 9L16 16M9 15L16 8" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === 'delete-pages') {
    return (
      <svg style={iconFilterStyle} className="mega-item-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4.5" fill="#8b5cf6" />
        <rect x="6" y="5.5" width="9" height="12" rx="1.5" stroke="#ffffff" strokeWidth="1.4" fill="none" />
        <path d="M8.5 9.5L12.5 13.5M12.5 9.5L8.5 13.5" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
};

const renderSecurityIcon = (id: string, isCompleted = true) => {
  const iconFilterStyle = isCompleted ? undefined : { filter: 'grayscale(100%)', opacity: 0.75 };
  if (id === 'unlock-pdf') {
    return (
      <svg style={iconFilterStyle} className="mega-item-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4.5" fill="#2563eb" />
        <rect x="6.5" y="10.5" width="11" height="8" rx="2" fill="#ffffff" />
        <path d="M8.5 10.5V7C8.5 5.34 9.84 4 11.5 4C13.16 4 14.5 5.34 14.5 7" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="14.5" r="1.3" fill="#2563eb" />
      </svg>
    );
  }
  if (id === 'protect-pdf') {
    return (
      <svg style={iconFilterStyle} className="mega-item-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4.5" fill="#2563eb" />
        <path d="M12 4L18 6.5V11.5C18 15.5 15.5 18.8 12 20C8.5 18.8 6 15.5 6 11.5V6.5L12 4Z" fill="#ffffff" />
        <path d="M10 11.5L11.5 13L14.5 9.5" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === 'watermark-pdf') {
    return (
      <svg style={iconFilterStyle} className="mega-item-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4.5" fill="#8b5cf6" />
        <path d="M12 5V10" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 10C8 8.2 16 8.2 16 10L17 14H7L8 10Z" fill="#ffffff" />
        <rect x="5.5" y="15" width="13" height="2.5" rx="1" fill="#ffffff" />
      </svg>
    );
  }
  return null;
};

export const Navbar: FC<NavbarProps> = ({ 
  onSelectCategory,
  onHomeClick,
  onOpenMergePdf,
  onOpenSplitPdf,
  onOpenCompressPdf,
  onOpenPdfToWord,
  onOpenPdfToJpg,
  onOpenJpgToPdf,
  onOpenEditPdf,
  onOpenTool
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [converterDropdownOpen, setConverterDropdownOpen] = useState(false);
  const [allToolsDropdownOpen, setAllToolsDropdownOpen] = useState(false);
  const [mobileConvertExpanded, setMobileConvertExpanded] = useState(false);
  const [mobileAllToolsExpanded, setMobileAllToolsExpanded] = useState(false);

  const converterRef = useRef<HTMLLIElement | null>(null);
  const allToolsRef = useRef<HTMLLIElement | null>(null);
  const converterTimerRef = useRef<NodeJS.Timeout | null>(null);
  const allToolsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        converterRef.current && !converterRef.current.contains(target) &&
        allToolsRef.current && !allToolsRef.current.contains(target)
      ) {
        setConverterDropdownOpen(false);
        setAllToolsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (converterTimerRef.current) clearTimeout(converterTimerRef.current);
      if (allToolsTimerRef.current) clearTimeout(allToolsTimerRef.current);
    };
  }, []);

  const handleConverterMouseEnter = () => {
    if (converterTimerRef.current) clearTimeout(converterTimerRef.current);
    setConverterDropdownOpen(true);
    setAllToolsDropdownOpen(false);
  };

  const handleConverterMouseLeave = () => {
    converterTimerRef.current = setTimeout(() => {
      setConverterDropdownOpen(false);
    }, 180);
  };

  const handleAllToolsMouseEnter = () => {
    if (allToolsTimerRef.current) clearTimeout(allToolsTimerRef.current);
    setAllToolsDropdownOpen(true);
    setConverterDropdownOpen(false);
  };

  const handleAllToolsMouseLeave = () => {
    allToolsTimerRef.current = setTimeout(() => {
      setAllToolsDropdownOpen(false);
    }, 180);
  };

  const handleLogoClick = () => {
    if (onHomeClick) {
      onHomeClick();
    } else if (onSelectCategory) {
      onSelectCategory('all');
    }
    setMobileMenuOpen(false);
    setConverterDropdownOpen(false);
    setAllToolsDropdownOpen(false);
  };

  const handleMergeClick = () => {
    if (onOpenMergePdf) {
      onOpenMergePdf();
    } else if (onSelectCategory) {
      onSelectCategory('organize');
    }
    setMobileMenuOpen(false);
    setConverterDropdownOpen(false);
    setAllToolsDropdownOpen(false);
  };

  const handleSplitClick = () => {
    if (onOpenSplitPdf) {
      onOpenSplitPdf();
    } else if (onSelectCategory) {
      onSelectCategory('organize');
    }
    setMobileMenuOpen(false);
    setConverterDropdownOpen(false);
    setAllToolsDropdownOpen(false);
  };

  const handleCompressClick = () => {
    if (onOpenCompressPdf) {
      onOpenCompressPdf();
    } else if (onSelectCategory) {
      onSelectCategory('optimize');
    }
    setMobileMenuOpen(false);
    setConverterDropdownOpen(false);
    setAllToolsDropdownOpen(false);
  };

  const handleEditClick = () => {
    if (onOpenEditPdf) {
      onOpenEditPdf();
    } else if (onOpenTool) {
      onOpenTool('edit-pdf');
    } else if (onSelectCategory) {
      onSelectCategory('organize');
    }
    setMobileMenuOpen(false);
    setConverterDropdownOpen(false);
    setAllToolsDropdownOpen(false);
  };

  const handleItemClick = (toolId: string, category: string) => {
    setConverterDropdownOpen(false);
    setAllToolsDropdownOpen(false);
    setMobileMenuOpen(false);

    if (toolId === 'edit-pdf' && onOpenEditPdf) {
      onOpenEditPdf();
    } else if (toolId === 'merge-pdf' && onOpenMergePdf) {
      onOpenMergePdf();
    } else if (toolId === 'split-pdf' && onOpenSplitPdf) {
      onOpenSplitPdf();
    } else if (toolId === 'compress-pdf' && onOpenCompressPdf) {
      onOpenCompressPdf();
    } else if (toolId === 'pdf-to-word' && onOpenPdfToWord) {
      onOpenPdfToWord();
    } else if (toolId === 'pdf-to-jpg' && onOpenPdfToJpg) {
      onOpenPdfToJpg();
    } else if (toolId === 'jpg-to-pdf' && onOpenJpgToPdf) {
      onOpenJpgToPdf();
    } else if (onOpenTool) {
      onOpenTool(toolId);
    } else if (onSelectCategory) {
      onSelectCategory(category);
    }
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <button 
          type="button" 
          className="brand-logo" 
          aria-label="GlowPDF Home"
          onClick={handleLogoClick}
        >
          <div className="brand-icon-wrapper">
            <Sparkles size={20} />
          </div>
          <span>GlowPDF</span>
          <span className="brand-badge">Free</span>
        </button>

        <nav aria-label="Main Navigation">
          <ul className="nav-links">
            {/* 1. EDIT PDF */}
            <li>
              <button 
                type="button"
                className="nav-link nav-link-highlight" 
                onClick={handleEditClick}
              >
                PDF EDITOR
              </button>
            </li>

            {/* 2. MERGE PDF */}
            <li>
              <button 
                type="button"
                className="nav-link" 
                onClick={handleMergeClick}
              >
                MERGE PDF
              </button>
            </li>

            {/* 3. SPLIT PDF */}
            <li>
              <button 
                type="button"
                className="nav-link" 
                onClick={handleSplitClick}
              >
                SPLIT PDF
              </button>
            </li>

            {/* 4. COMPRESS PDF */}
            <li>
              <button 
                type="button"
                className="nav-link" 
                onClick={handleCompressClick}
              >
                COMPRESS PDF
              </button>
            </li>

            {/* 4. CONVERT PDF MEGA DROPDOWN */}
            <li 
              className="nav-item-dropdown" 
              ref={converterRef}
              onMouseEnter={handleConverterMouseEnter}
              onMouseLeave={handleConverterMouseLeave}
            >
              <button
                type="button"
                className={`nav-link-dropdown-trigger ${converterDropdownOpen ? 'open' : ''}`}
                onClick={() => {
                  setConverterDropdownOpen(!converterDropdownOpen);
                  setAllToolsDropdownOpen(false);
                }}
                aria-expanded={converterDropdownOpen}
                aria-haspopup="true"
              >
                <span>CONVERT PDF</span>
                <ChevronDown size={14} className={`dropdown-chevron ${converterDropdownOpen ? 'open' : ''}`} />
              </button>

              {converterDropdownOpen && (
                <div className="mega-dropdown-menu convert-dropdown-menu" role="menu">
                  {/* Top pointer notch */}
                  <div className="dropdown-arrow-notch convert-notch" />

                  {/* Column 1: CONVERT TO PDF */}
                  <div className="mega-dropdown-column">
                    <div className="mega-column-title">CONVERT TO PDF</div>
                    <ul className="mega-dropdown-list">
                      {CONVERT_TO_PDF_ITEMS.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="mega-dropdown-item-btn"
                            onClick={() => handleItemClick(item.id, 'convert')}
                          >
                            {renderConverterIcon('to', item.type, COMPLETED_TOOLS.includes(item.id))}
                            <span className="mega-item-title">{item.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Column 2: CONVERT FROM PDF */}
                  <div className="mega-dropdown-column">
                    <div className="mega-column-title">CONVERT FROM PDF</div>
                    <ul className="mega-dropdown-list">
                      {CONVERT_FROM_PDF_ITEMS.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="mega-dropdown-item-btn"
                            onClick={() => handleItemClick(item.id, 'convert')}
                          >
                            {renderConverterIcon('from', item.type, COMPLETED_TOOLS.includes(item.id))}
                            <span className={`mega-item-title ${item.highlight ? 'highlight' : ''}`}>
                              {item.title}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </li>

            {/* 5. ALL PDF TOOLS MEGA DROPDOWN */}
            <li 
              className="nav-item-dropdown" 
              ref={allToolsRef}
              onMouseEnter={handleAllToolsMouseEnter}
              onMouseLeave={handleAllToolsMouseLeave}
            >
              <button
                type="button"
                className={`nav-link-dropdown-trigger ${allToolsDropdownOpen ? 'open' : ''}`}
                onClick={() => {
                  setAllToolsDropdownOpen(!allToolsDropdownOpen);
                  setConverterDropdownOpen(false);
                }}
                aria-expanded={allToolsDropdownOpen}
                aria-haspopup="true"
              >
                <span>ALL PDF TOOLS</span>
                <ChevronDown size={14} className={`dropdown-chevron ${allToolsDropdownOpen ? 'open' : ''}`} />
              </button>

              {allToolsDropdownOpen && (
                <div className="mega-dropdown-menu all-tools-dropdown-menu" role="menu">
                  {/* Top pointer notch */}
                  <div className="dropdown-arrow-notch all-tools-notch" />

                  {/* Column 1: OPTIMIZE PDF */}
                  <div className="mega-dropdown-column">
                    <div className="mega-column-title">OPTIMIZE PDF</div>
                    <ul className="mega-dropdown-list">
                      {OPTIMIZE_ITEMS.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="mega-dropdown-item-btn"
                            onClick={() => handleItemClick(item.id, 'optimize')}
                          >
                            {renderOptimizeIcon(item.id, COMPLETED_TOOLS.includes(item.id))}
                            <span className="mega-item-title">{item.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Column 2: CONVERT TO PDF */}
                  <div className="mega-dropdown-column">
                    <div className="mega-column-title">CONVERT TO PDF</div>
                    <ul className="mega-dropdown-list">
                      {CONVERT_TO_PDF_ITEMS.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="mega-dropdown-item-btn"
                            onClick={() => handleItemClick(item.id, 'convert')}
                          >
                            {renderConverterIcon('to', item.type, COMPLETED_TOOLS.includes(item.id))}
                            <span className="mega-item-title">{item.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Column 3: CONVERT FROM PDF */}
                  <div className="mega-dropdown-column">
                    <div className="mega-column-title">CONVERT FROM PDF</div>
                    <ul className="mega-dropdown-list">
                      {CONVERT_FROM_PDF_ITEMS.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="mega-dropdown-item-btn"
                            onClick={() => handleItemClick(item.id, 'convert')}
                          >
                            {renderConverterIcon('from', item.type, COMPLETED_TOOLS.includes(item.id))}
                            <span className={`mega-item-title ${item.highlight ? 'highlight' : ''}`}>
                              {item.title}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Column 4: PDF EDITOR */}
                  <div className="mega-dropdown-column">
                    <div className="mega-column-title">PDF EDITOR</div>
                    <ul className="mega-dropdown-list">
                      {EDIT_ITEMS.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="mega-dropdown-item-btn"
                            onClick={() => handleItemClick(item.id, 'organize')}
                          >
                            {renderEditIcon(item.id, COMPLETED_TOOLS.includes(item.id))}
                            <span className="mega-item-title">{item.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Column 5: PDF SECURITY */}
                  <div className="mega-dropdown-column">
                    <div className="mega-column-title">PDF SECURITY</div>
                    <ul className="mega-dropdown-list">
                      {SECURITY_ITEMS.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="mega-dropdown-item-btn"
                            onClick={() => handleItemClick(item.id, 'security')}
                          >
                            {renderSecurityIcon(item.id, COMPLETED_TOOLS.includes(item.id))}
                            <span className="mega-item-title">{item.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </li>
          </ul>
        </nav>

        {/* Mobile menu toggle only - NO login or sign up buttons */}
        <div className="nav-actions">
          <button 
            type="button"
            className="mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <ul className="mobile-nav-list">
          <li className="mobile-nav-item">
            <button type="button" className="mobile-nav-btn" onClick={handleMergeClick}>
              MERGE PDF
            </button>
          </li>
          <li className="mobile-nav-item">
            <button type="button" className="mobile-nav-btn" onClick={handleSplitClick}>
              SPLIT PDF
            </button>
          </li>
          <li className="mobile-nav-item">
            <button type="button" className="mobile-nav-btn" onClick={handleCompressClick}>
              COMPRESS PDF
            </button>
          </li>

          {/* Mobile Convert PDF Accordion */}
          <li className="mobile-nav-item">
            <button
              type="button"
              className="mobile-accordion-toggle"
              onClick={() => setMobileConvertExpanded(!mobileConvertExpanded)}
            >
              <span>CONVERT PDF</span>
              <ChevronDown size={16} className={`dropdown-chevron ${mobileConvertExpanded ? 'open' : ''}`} />
            </button>

            {mobileConvertExpanded && (
              <div className="mobile-convert-panel">
                <div className="mobile-convert-col">
                  <div className="mega-column-title">CONVERT TO PDF</div>
                  <ul className="mega-dropdown-list">
                    {CONVERT_TO_PDF_ITEMS.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="mega-dropdown-item-btn"
                          onClick={() => handleItemClick(item.id, 'convert')}
                        >
                          {renderConverterIcon('to', item.type, COMPLETED_TOOLS.includes(item.id))}
                          <span className="mega-item-title">{item.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mobile-convert-col" style={{ marginTop: '16px' }}>
                  <div className="mega-column-title">CONVERT FROM PDF</div>
                  <ul className="mega-dropdown-list">
                    {CONVERT_FROM_PDF_ITEMS.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="mega-dropdown-item-btn"
                          onClick={() => handleItemClick(item.id, 'convert')}
                        >
                          {renderConverterIcon('from', item.type, COMPLETED_TOOLS.includes(item.id))}
                          <span className={`mega-item-title ${item.highlight ? 'highlight' : ''}`}>
                            {item.title}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </li>

          {/* Mobile All Tools Accordion */}
          <li className="mobile-nav-item">
            <button
              type="button"
              className="mobile-accordion-toggle"
              onClick={() => setMobileAllToolsExpanded(!mobileAllToolsExpanded)}
            >
              <span>ALL PDF TOOLS</span>
              <ChevronDown size={16} className={`dropdown-chevron ${mobileAllToolsExpanded ? 'open' : ''}`} />
            </button>

            {mobileAllToolsExpanded && (
              <div className="mobile-convert-panel">
                <div className="mobile-convert-col">
                  <div className="mega-column-title">OPTIMIZE PDF</div>
                  <ul className="mega-dropdown-list">
                    {OPTIMIZE_ITEMS.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="mega-dropdown-item-btn"
                          onClick={() => handleItemClick(item.id, 'optimize')}
                        >
                          {renderOptimizeIcon(item.id, COMPLETED_TOOLS.includes(item.id))}
                          <span className="mega-item-title">{item.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mobile-convert-col" style={{ marginTop: '16px' }}>
                  <div className="mega-column-title">PDF EDITOR</div>
                  <ul className="mega-dropdown-list">
                    {EDIT_ITEMS.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="mega-dropdown-item-btn"
                          onClick={() => handleItemClick(item.id, 'organize')}
                        >
                          {renderEditIcon(item.id, COMPLETED_TOOLS.includes(item.id))}
                          <span className="mega-item-title">{item.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mobile-convert-col" style={{ marginTop: '16px' }}>
                  <div className="mega-column-title">PDF SECURITY</div>
                  <ul className="mega-dropdown-list">
                    {SECURITY_ITEMS.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="mega-dropdown-item-btn"
                          onClick={() => handleItemClick(item.id, 'security')}
                        >
                          {renderSecurityIcon(item.id, COMPLETED_TOOLS.includes(item.id))}
                          <span className="mega-item-title">{item.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </li>
        </ul>
      </div>
    </header>
  );
};
