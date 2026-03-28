import React from 'react';
import { Store, Bike } from 'lucide-react';
import { motion } from 'framer-motion';

const SaleTypeSelector = ({ selectedType, onSelect }) => {
  return (
    <div className="flex items-center gap-4 w-full">
      <button
        onClick={() => onSelect('loja')}
        className={`flex-1 relative flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all duration-200 ${
          selectedType === 'loja'
            ? 'bg-[var(--layout-accent)]/10 border-[var(--layout-accent)] text-white'
            : 'bg-[var(--layout-bg)] border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:border-[var(--layout-border)]'
        }`}
      >
        <Store className={`w-5 h-5 ${selectedType === 'loja' ? 'text-[var(--layout-accent)]' : 'text-[var(--layout-text-muted)]'}`} />
        <span
          className={`font-bold uppercase tracking-wider ${
            selectedType === 'loja' ? 'text-[var(--layout-accent)]' : 'text-[var(--layout-text-muted)]'
          }`}
        >
          Loja
        </span>
        {selectedType === 'loja' && (
          <motion.div
            layoutId="activeType"
            className="absolute inset-0 border-2 border-[var(--layout-accent)] rounded-lg"
            initial={false}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
      </button>

      <button
        onClick={() => onSelect('delivery')}
        className={`flex-1 relative flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all duration-200 ${
          selectedType === 'delivery'
            ? 'bg-[var(--layout-accent)]/10 border-[var(--layout-accent)] text-white'
            : 'bg-[var(--layout-bg)] border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:border-[var(--layout-border)]'
        }`}
      >
        <Bike
          className={`w-5 h-5 ${
            selectedType === 'delivery' ? 'text-[var(--layout-accent)]' : 'text-[var(--layout-text-muted)]'
          }`}
        />
        <span
          className={`font-bold uppercase tracking-wider ${
            selectedType === 'delivery' ? 'text-[var(--layout-accent)]' : 'text-[var(--layout-text-muted)]'
          }`}
        >
          Delivery
        </span>
        {selectedType === 'delivery' && (
          <motion.div
            layoutId="activeType"
            className="absolute inset-0 border-2 border-[var(--layout-accent)] rounded-lg"
            initial={false}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
      </button>
    </div>
  );
};

export default SaleTypeSelector;
