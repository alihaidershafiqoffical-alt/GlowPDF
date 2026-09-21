import type { FC } from 'react';
import {
  RotateCw,
  Trash2,
  Copy,
  Plus,
  ChevronUp,
  ChevronDown,
  FilePlus2,
  Layers,
} from 'lucide-react';
import type { PageLayout } from './editorTypes';

interface PageThumbnailSidebarProps {
  pages: PageLayout[];
  activePageIndex: number;
  onSelectPage: (index: number) => void;
  onMovePage: (fromIndex: number, toIndex: number) => void;
  onRotatePage: (index: number) => void;
  onDeletePage: (index: number) => void;
  onDuplicatePage: (index: number) => void;
  onAddBlankPage: (afterIndex: number) => void;
  thumbnailUrls: Record<number, string>;
  isOpen: boolean;
  onToggleOpen?: () => void;
}

export const PageThumbnailSidebar: FC<PageThumbnailSidebarProps> = ({
  pages,
  activePageIndex,
  onSelectPage,
  onMovePage,
  onRotatePage,
  onDeletePage,
  onDuplicatePage,
  onAddBlankPage,
  thumbnailUrls,
  isOpen,
}) => {
  if (!isOpen) return null;

  return (
    <aside className="editor-thumbnail-sidebar">
      <div className="thumbnail-sidebar-header">
        <div className="sidebar-header-title">
          <Layers size={16} className="icon-accent" />
          <span>Pages ({pages.length})</span>
        </div>
        <button
          type="button"
          className="btn-add-page-sm"
          onClick={() => onAddBlankPage(pages.length - 1)}
          title="Add Blank Page"
        >
          <Plus size={14} />
          <span>Add</span>
        </button>
      </div>

      <div className="thumbnail-list-scroll">
        {pages.map((page, idx) => {
          const isActive = idx === activePageIndex;
          const thumbUrl = thumbnailUrls[page.originalPageIndex];

          return (
            <div
              key={`${page.originalPageIndex}_${idx}`}
              className={`thumbnail-card ${isActive ? 'active' : ''}`}
              onClick={() => onSelectPage(idx)}
            >
              {/* Header with Page Number & Actions */}
              <div className="thumbnail-card-header">
                <span className="page-badge">Page {idx + 1}</span>
                <div className="thumbnail-quick-actions" onClick={(e) => e.stopPropagation()}>
                  {idx > 0 && (
                    <button
                      type="button"
                      className="thumb-action-btn"
                      onClick={() => onMovePage(idx, idx - 1)}
                      title="Move Page Up"
                    >
                      <ChevronUp size={12} />
                    </button>
                  )}
                  {idx < pages.length - 1 && (
                    <button
                      type="button"
                      className="thumb-action-btn"
                      onClick={() => onMovePage(idx, idx + 1)}
                      title="Move Page Down"
                    >
                      <ChevronDown size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="thumb-action-btn"
                    onClick={() => onRotatePage(idx)}
                    title="Rotate 90° Clockwise"
                  >
                    <RotateCw size={12} />
                  </button>
                  <button
                    type="button"
                    className="thumb-action-btn"
                    onClick={() => onDuplicatePage(idx)}
                    title="Duplicate Page"
                  >
                    <Copy size={12} />
                  </button>
                  {pages.length > 1 && (
                    <button
                      type="button"
                      className="thumb-action-btn danger"
                      onClick={() => onDeletePage(idx)}
                      title="Delete Page"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Thumbnail Image Preview */}
              <div
                className="thumbnail-preview-wrap"
                style={{
                  transform: `rotate(${page.rotation}deg)`,
                  transition: 'transform 0.2s ease',
                }}
              >
                {page.isBlank ? (
                  <div className="blank-page-thumb">
                    <FilePlus2 size={24} className="icon-subtle" />
                    <span>Blank Page</span>
                  </div>
                ) : thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={`Page ${idx + 1} thumbnail`}
                    className="thumb-image"
                    loading="lazy"
                  />
                ) : (
                  <div className="thumb-loading-placeholder">
                    <div className="spinner-sm" />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Append Blank Page Button */}
        <button
          type="button"
          className="thumbnail-add-blank-card"
          onClick={() => onAddBlankPage(pages.length - 1)}
        >
          <Plus size={20} />
          <span>Add Blank Page</span>
        </button>
      </div>
    </aside>
  );
};
