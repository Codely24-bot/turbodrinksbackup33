import React from 'react';
import { Filter, X, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

const RelatorioFiltros = ({ startDate, endDate, onStartDateChange, onEndDateChange, onFilter, onReset, loading }) => {
  return (
    <div className="bg-[var(--layout-surface-2)] p-4 rounded-lg border border-[var(--layout-border)] mb-6 animate-in slide-in-from-top-2">
      <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
        <div className="flex items-center gap-2 text-white font-medium">
          <Filter className="w-5 h-5 text-[var(--layout-accent)]" />
          <span>Filtros de Período</span>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--layout-text-muted)]" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="w-full sm:w-auto bg-[var(--layout-bg)] text-white text-sm rounded-md pl-9 pr-3 py-2 border border-[var(--layout-border)] focus:border-[var(--layout-accent)] outline-none transition-colors"
              />
            </div>
            <span className="text-[var(--layout-text-muted)] text-sm">até</span>
            <div className="relative w-full sm:w-auto">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--layout-text-muted)]" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="w-full sm:w-auto bg-[var(--layout-bg)] text-white text-sm rounded-md pl-9 pr-3 py-2 border border-[var(--layout-border)] focus:border-[var(--layout-accent)] outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button 
              onClick={onFilter}
              disabled={loading}
              className="bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white flex-1 sm:flex-none h-9"
            >
              {loading ? 'Atualizando...' : 'Filtrar'}
            </Button>
            
            <Button 
              onClick={onReset}
              variant="outline"
              className="bg-transparent border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:text-white hover:bg-[var(--layout-surface-2)] flex-1 sm:flex-none h-9"
            >
              <X className="w-4 h-4 mr-1" />
              Limpar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelatorioFiltros;
