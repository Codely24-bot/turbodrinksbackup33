import React from 'react';

const MetricCard = ({ label, value, hint, tone = 'text-white' }) => {
  return (
    <div className="rounded-xl border border-[var(--layout-border)] bg-[var(--layout-bg)] p-4 shadow-lg shadow-black/10">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">{label}</div>
      <div className={`mt-3 text-3xl font-black ${tone}`}>{value}</div>
      {hint ? <div className="mt-2 text-sm text-[var(--layout-text-muted)]">{hint}</div> : null}
    </div>
  );
};

export default MetricCard;
