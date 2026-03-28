import React from 'react';
import { ShoppingCart, DollarSign, TrendingUp, BarChart3, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MetricCard = ({ title, value, icon: Icon, color, loading, prefix = "" }) => (
  <motion.div 
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-[var(--layout-surface-2)] p-6 rounded-lg shadow-lg border border-[var(--layout-border)] relative overflow-hidden"
  >
    <div className={`absolute top-0 right-0 p-4 opacity-10`}>
      <Icon className={`w-24 h-24 ${color}`} />
    </div>
    
    <div className="relative z-10">
      <p className="text-[var(--layout-text-muted)] text-sm font-medium uppercase tracking-wider">{title}</p>
      <div className="flex items-center gap-3 mt-2">
        <div className={`p-2 rounded-lg bg-white/5`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
        {loading ? (
           <div className="h-8 w-24 bg-white/10 rounded animate-pulse" />
        ) : (
          <motion.h3 
            key={value}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-2xl font-bold text-white"
          >
            {prefix} {typeof value === 'number' ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}
          </motion.h3>
        )}
      </div>
    </div>
  </motion.div>
);

const RelatorioCards = ({ totalVendas, valorBruto, lucroTotal, ticketMedio, loading }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <MetricCard 
        title="Total de Vendas" 
        value={totalVendas} 
        icon={ShoppingCart} 
        color="text-blue-400"
        loading={loading}
        prefix=""
      />
      <MetricCard 
        title="Valor Bruto" 
        value={valorBruto} 
        icon={DollarSign} 
        color="text-emerald-400"
        loading={loading}
        prefix="R$"
      />
      <MetricCard 
        title="Lucro Total" 
        value={lucroTotal} 
        icon={TrendingUp} 
        color="text-[var(--layout-accent)]"
        loading={loading}
        prefix="R$"
      />
      <MetricCard 
        title="Ticket Médio" 
        value={ticketMedio} 
        icon={BarChart3} 
        color="text-purple-400"
        loading={loading}
        prefix="R$"
      />
    </div>
  );
};

export default RelatorioCards;
