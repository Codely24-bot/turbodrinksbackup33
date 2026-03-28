import React from 'react';

const PanelCard = ({ title, subtitle, children, actions, className = '' }) => {
  return (
    <section
      className={`rounded-xl border border-[var(--layout-border)] bg-[var(--layout-bg)] p-5 shadow-lg shadow-black/10 ${className}`}
    >
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-lg font-bold text-white">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-[var(--layout-text-muted)]">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
};

export default PanelCard;
