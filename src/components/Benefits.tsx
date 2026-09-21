import type { FC } from 'react';
import { Sparkles, Zap, UserX, LayoutGrid } from 'lucide-react';

export const Benefits: FC = () => {
  const benefits = [
    {
      icon: <Sparkles size={24} />,
      title: 'Easy to Use',
      description: 'Streamlined, intuitive tool interface crafted so anyone can accomplish document tasks in just a few clicks.'
    },
    {
      icon: <Zap size={24} />,
      title: 'Fast & Lightweight',
      description: 'Optimized, modern frontend architecture that loads quickly with zero clutter or unnecessary distractions.'
    },
    {
      icon: <UserX size={24} />,
      title: 'No Account Required',
      description: 'Enjoy instant access with zero signup, no passwords to remember, and no personal email collection required.'
    },
    {
      icon: <LayoutGrid size={24} />,
      title: 'Simple Online PDF Tools',
      description: 'All essential everyday document actions—merging, converting, compressing, and protecting—gathered in one place.'
    }
  ];

  return (
    <section className="benefits-section" id="benefits-section">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">Why Choose GlowPDF</span>
          <h2 className="section-title">PDF tools built for speed and simplicity</h2>
          <p className="section-subtitle">
            Reliable, lightweight online document utilities designed to get your job done without friction.
          </p>
        </div>

        <div className="benefits-grid">
          {benefits.map((benefit, index) => (
            <div key={index} className="benefit-card">
              <div className="benefit-icon-wrapper">
                {benefit.icon}
              </div>
              <h3 className="benefit-title">{benefit.title}</h3>
              <p className="benefit-description">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
