import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Search, Filter, RefreshCw, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useSalesHistory } from '@/hooks/useSalesHistory';
import SalesHistoryTable from '@/components/SalesHistoryTable';
import EditSaleModal from '@/components/EditSaleModal';
import DeleteSaleConfirmation from '@/components/DeleteSaleConfirmation';
import PrintReportModal from '@/components/PrintReportModal';

const HistoricoVendasPage = () => {
  // Filter States
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoVenda, setTipoVenda] = useState('todos');
  const [status, setStatus] = useState('todos');

  // Modals State
  const [editingSale, setEditingSale] = useState(null);
  const [deletingSale, setDeletingSale] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Hook
  const { 
    sales, 
    loading, 
    fetchSalesWithFilters, 
    updateSale, 
    deleteSale,
    getSalesSummary
  } = useSalesHistory();

  // Initial Fetch
  useEffect(() => {
    handleFilter();
  }, []); 

  const handleFilter = () => {
    fetchSalesWithFilters({
      startDate,
      endDate,
      searchTerm,
      tipoVenda,
      status
    });
  };

  const handleClearFilters = () => {
    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    setSearchTerm('');
    setTipoVenda('todos');
    setStatus('todos');
    // We can trigger fetch immediately or wait for user to click Filter again
    // Usually better UX to fetch immediately on reset
    setTimeout(() => {
       fetchSalesWithFilters({
        startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
        searchTerm: '',
        tipoVenda: 'todos',
        status: 'todos'
      });
    }, 100);
  };

  const { totalSales, totalRevenue, averageTicket, totalItems } = getSalesSummary();

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[var(--layout-bg)] animate-in fade-in duration-500">
      <Helmet>
        <title>HistÃ³rico de Vendas - FORTIN ERP PRO</title>
      </Helmet>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">HistÃ³rico de Vendas</h1>
          <p className="text-[var(--layout-text-muted)]">Consulte, gerencie e imprima relatÃ³rios de vendas</p>
        </div>
        <Button 
          onClick={() => setShowPrintModal(true)}
          className="bg-[var(--layout-surface-2)] hover:bg-[var(--layout-border)] text-white border border-[var(--layout-border)] w-full md:w-auto"
        >
          <Printer className="w-4 h-4 mr-2" />
          Imprimir RelatÃ³rios
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
          <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Vendas Totais</span>
          <div className="text-2xl font-bold text-white mt-1">{totalSales}</div>
        </div>
        <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
          <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Faturamento</span>
          <div className="text-2xl font-bold text-[var(--layout-accent)] mt-1">R$ {totalRevenue.toFixed(2)}</div>
        </div>
        <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
          <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Ticket MÃ©dio</span>
          <div className="text-2xl font-bold text-blue-400 mt-1">R$ {averageTicket.toFixed(2)}</div>
        </div>
        <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
          <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Itens Vendidos</span>
          <div className="text-2xl font-bold text-orange-400 mt-1">{totalItems}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)] mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div className="lg:col-span-1">
            <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--layout-text-muted)]" />
              <input
                type="text"
                placeholder="NÂº pedido ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:border-[var(--layout-accent)] focus:outline-none"
              />
            </div>
          </div>
          
          <div>
            <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">PerÃ­odo</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-2 py-2 text-white text-sm focus:border-[var(--layout-accent)] focus:outline-none"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-2 py-2 text-white text-sm focus:border-[var(--layout-accent)] focus:outline-none"
              />
            </div>
          </div>

          <div>
             <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Tipo de Venda</label>
             <select 
              value={tipoVenda}
              onChange={(e) => setTipoVenda(e.target.value)}
              className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white text-sm focus:border-[var(--layout-accent)] focus:outline-none"
             >
               <option value="todos">Todos</option>
               <option value="loja">Loja</option>
               <option value="delivery">Delivery</option>
             </select>
          </div>

          <div>
             <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Status</label>
             <select 
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white text-sm focus:border-[var(--layout-accent)] focus:outline-none"
             >
               <option value="todos">Todos</option>
               <option value="completa">Completa</option>
               <option value="cancelado">Cancelada</option>
             </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={handleFilter}
              disabled={loading}
              className="flex-1 bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white font-bold"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4 mr-2" />}
              FILTRAR
            </Button>
            <Button 
              onClick={handleClearFilters}
              disabled={loading}
              variant="outline"
              className="bg-transparent border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:bg-gray-700"
            >
              LIMPAR
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="h-auto md:h-[calc(100vh-400px)] min-h-[400px]">
        <SalesHistoryTable 
          sales={sales}
          onEdit={(sale) => setEditingSale(sale)}
          onDelete={(sale) => setDeletingSale(sale)}
        />
      </div>

      {/* Modals */}
      <EditSaleModal 
        isOpen={!!editingSale}
        onClose={() => setEditingSale(null)}
        sale={editingSale}
        onSave={updateSale}
      />

      <DeleteSaleConfirmation 
        isOpen={!!deletingSale}
        onClose={() => setDeletingSale(null)}
        sale={deletingSale}
        onConfirm={deleteSale}
      />

      <PrintReportModal 
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        salesData={sales} // Pass current filtered sales
      />

    </div>
  );
};

export default HistoricoVendasPage;


