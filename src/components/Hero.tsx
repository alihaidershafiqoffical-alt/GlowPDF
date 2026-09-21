import type { FC } from 'react';
import { ArrowRight, Search, ShieldCheck } from 'lucide-react';

interface HeroProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onExploreClick: () => void;
}

export const Hero: FC<HeroProps> = ({
  searchQuery,
  onSearchChange,
  onExploreClick
}) => {
  return (
    <section className="hero-section">
      <div className="container">
        <div className="hero-pill">
          <span className="hero-pill-dot"></span>
          <span>Zero Account Required • 100% Free Online</span>
        </div>

        <h1 className="hero-title">
          Every tool you need to work with PDFs, <span>simple & fast</span>.
        </h1>

        <p className="hero-subtitle">
          GlowPDF makes working with PDF documents effortless. Merge, split, compress, 
          convert, and secure your files in seconds without creating an account.
        </p>

        <div className="hero-actions">
          <button 
            className="btn-hero-primary" 
            onClick={onExploreClick}
            id="hero-primary-cta"
          >
            <span>Explore All Tools</span>
            <ArrowRight size={18} />
          </button>

          <a href="#benefits-section" className="btn-hero-secondary">
            <ShieldCheck size={18} />
            <span>Why GlowPDF</span>
          </a>
        </div>

        {/* Quick Instant Search */}
        <div className="hero-search-wrapper">
          <Search className="hero-search-icon" size={20} />
          <input
            type="text"
            className="hero-search-input"
            placeholder="Search any PDF tool (e.g. Merge, Compress, JPG, Protect)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search PDF tools"
          />
          {searchQuery && (
            <button
              className="hero-search-clear"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
