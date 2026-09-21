import { useState } from 'react';
import type { FC } from 'react';
import { 
  Files, 
  Scissors, 
  Minimize2, 
  FileText, 
  Image, 
  FileImage, 
  Stamp, 
  Lock, 
  Unlock, 
  RotateCw, 
  Layers, 
  ArrowRight,
  Globe,
  Presentation,
  FileSpreadsheet,
  FileEdit
} from 'lucide-react';
import type { ToolItem, ToolCategory } from '../types/tool';
import { COMPLETED_TOOLS } from '../data/tools';

interface ToolsGridProps {
  tools: ToolItem[];
  selectedCategory: ToolCategory;
  onSelectCategory: (cat: ToolCategory) => void;
  searchQuery: string;
  onOpenTool?: (toolId: string) => void;
}

// Icon mapper for dynamic icons
const renderToolIcon = (iconName: string, size = 24) => {
  switch (iconName) {
    case 'FileEdit': return <FileEdit size={size} />;
    case 'Files': return <Files size={size} />;
    case 'Scissors': return <Scissors size={size} />;
    case 'Minimize2': return <Minimize2 size={size} />;
    case 'FileText': return <FileText size={size} />;
    case 'Image': return <Image size={size} />;
    case 'FileImage': return <FileImage size={size} />;
    case 'Stamp': return <Stamp size={size} />;
    case 'Lock': return <Lock size={size} />;
    case 'Unlock': return <Unlock size={size} />;
    case 'RotateCw': return <RotateCw size={size} />;
    case 'Layers': return <Layers size={size} />;
    case 'Globe': return <Globe size={size} />;
    case 'Presentation': return <Presentation size={size} />;
    case 'FileSpreadsheet': return <FileSpreadsheet size={size} />;
    default: return <FileText size={size} />;
  }
};

const CATEGORIES: { id: ToolCategory; label: string }[] = [
  { id: 'all', label: 'All Tools' },
  { id: 'organize', label: 'Organize PDF' },
  { id: 'optimize', label: 'Optimize & Compress' },
  { id: 'convert', label: 'Convert PDF' },
  { id: 'security', label: 'Security & Pages' },
];

export const ToolsGrid: FC<ToolsGridProps> = ({
  tools,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onOpenTool
}) => {
  const [activeDialogTool, setActiveDialogTool] = useState<ToolItem | null>(null);

  const handleToolClick = (tool: ToolItem) => {
    if (COMPLETED_TOOLS.includes(tool.id) && onOpenTool) {
      onOpenTool(tool.id);
      return;
    }
    setActiveDialogTool(tool);
  };

  // Filter tools by category and search query
  const filteredTools = tools.filter((tool) => {
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = query === '' || 
      tool.name.toLowerCase().includes(query) || 
      tool.description.toLowerCase().includes(query) ||
      tool.categoryLabel.toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });

  return (
    <section className="tools-section" id="tools-section">
      <div className="container">
        <div className="tools-header">
          <div>
            <h2 className="tools-heading">
              Popular PDF Tools
              <span className="tools-count-badge">
                {filteredTools.length} {filteredTools.length === 1 ? 'tool' : 'tools'}
              </span>
            </h2>
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Tool categories">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                role="tab"
                aria-selected={selectedCategory === cat.id}
                className={`filter-tab-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => onSelectCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {filteredTools.length > 0 ? (
          <div className="tools-grid">
            {filteredTools.map((tool) => (
              <div
                key={tool.id}
                className="tool-card"
                onClick={() => handleToolClick(tool)}
                role="button"
                tabIndex={0}
                aria-label={`Open ${tool.name} tool`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleToolClick(tool);
                  }
                }}
              >
                <div 
                  className="tool-icon-box"
                  style={
                    COMPLETED_TOOLS.includes(tool.id)
                      ? { backgroundColor: tool.badgeBg, color: tool.iconColor }
                      : { backgroundColor: '#f1f5f9', color: '#64748b', filter: 'grayscale(100%)', opacity: 0.75 }
                  }
                >
                  {renderToolIcon(tool.iconName)}
                </div>

                <h3 className="tool-name">{tool.name}</h3>
                <p className="tool-description">{tool.description}</p>

                <div className="tool-card-footer">
                  <span className="tool-badge-category">{tool.categoryLabel}</span>
                  <span className="tool-action-arrow" aria-hidden="true">
                    <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="tools-empty-state">
            <h3 className="tools-empty-title">No tools found</h3>
            <p className="tools-empty-text">
              We couldn't find any tool matching "{searchQuery}". Try a different keyword or reset filters.
            </p>
            <button
              className="btn-primary-sm"
              onClick={() => {
                onSelectCategory('all');
              }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Informative Tool Preview Modal (No fake processing) */}
      {activeDialogTool && (
        <div 
          className="tool-dialog-backdrop" 
          onClick={() => setActiveDialogTool(null)}
          role="dialog"
          aria-modal="true"
        >
          <div 
            className="tool-dialog" 
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="tool-dialog-icon"
              style={
                COMPLETED_TOOLS.includes(activeDialogTool.id)
                  ? { 
                      backgroundColor: activeDialogTool.badgeBg, 
                      color: activeDialogTool.iconColor 
                    }
                  : {
                      backgroundColor: '#f1f5f9',
                      color: '#64748b',
                      filter: 'grayscale(100%)',
                      opacity: 0.75
                    }
              }
            >
              {renderToolIcon(activeDialogTool.iconName, 30)}
            </div>

            <h3 className="tool-dialog-title">{activeDialogTool.name}</h3>
            <p className="tool-dialog-text">
              {activeDialogTool.description}
            </p>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
              ℹ️ GlowPDF Step 1: Tool Navigation & Discovery. PDF processing workflows will be integrated in upcoming steps.
            </p>

            <button 
              className="tool-dialog-close"
              onClick={() => setActiveDialogTool(null)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
