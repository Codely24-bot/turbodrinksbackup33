import React from 'react';

const ModuleShell = ({ title, subtitle, actions, children }) => {
  return (
    <div className="min-h-full bg-[var(--layout-surface-2)] p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mb-2 text-2xl sm:text-3xl font-bold text-white">{title}</h1>
          {subtitle ? <p className="text-[var(--layout-text-muted)]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
};

export default ModuleShell;
