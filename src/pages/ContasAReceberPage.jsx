import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { 
  CreditCard, DollarSign, CheckCircle2, AlertTriangle, RefreshCw, 
  Filter, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useContasAReceber } from '@/hooks/useContasAReceber';
import ContasAReceberTable from '@/components/ContasAReceberTable';
import MarcarComoPagoModal from '@/components/MarcarComoPagoModal';
import EditarVendaFiadoModal from '@/components/EditarVendaFiadoModal';
import ExcluirVendaFiadoModal from '@/components/ExcluirVendaFiadoModal';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const ContasAReceberPage = () => {
  const { user } = useAuth();
  const { 
    contas, 
    summary, 
    loading, 
    fetchContas, 
    markAsPaid, 
    editConta, 
    deleteConta 
  } = useContasAReceber();

  const [filters, setFilters] = useState({
    status: 'Todos',
    clienteId: 'todos',
    startDate: '',
    endDate: ''
  });

  const [clientes, setClientes] = useState([]);
  const [activeModal, setActiveModal] = useState(null);
  const [selectedConta, setSelectedConta] = useState(null);

  // Initial fetch and logging
  useEffect(() => {
    console.log("🚀 ContasAReceberPage: Initializing...");
    if (user) {
      fetchContas(filters);
      
      // Fetch Clients for filter
      const loadClientes = async () => {
        try {
          const { data, error } = await supabase
            .from('pessoas')
            .select('id, nome')
            .eq('user_id', user.id)
            .order('nome');
          
          if (error) throw error;
          setClientes(data || []);
        } catch (err) {
          console.error("❌ Error loading clients:", err);
        }
      };
      loadClientes();
    }
  }, [user]); // Run once when user loads

  // Refetch when filters change (debounced manually via effect)
  useEffect(() => {
    if (user) {
      console.log("🔍 Filters changed, refetching...", filters);
      fetchContas(filters);
    }
  }, [filters.status, filters.clienteId, filters.startDate, filters.endDate]);

  const handleOpenModal = (type, conta) => {
    console.log(`Open modal: ${type}`, conta);
    setSelectedConta(conta);
    setActiveModal(type);
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setSelectedConta(null);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
      <Helmet>
        <title>Contas a Receber - Dashboard</title>
      </Helmet>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-[var(--layout-accent)]" />
            CONTAS A RECEBER
          </h1>
          <p className="text-[var(--layout-text-muted)] mt-1">Gerencie suas vendas em fiado e recebimentos</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          {/* Debug Button - visible in development/demo */}
           <Button 
            onClick={() => window.debugDB && window.debugDB()} 
            variant="ghost" 
            className="text-[var(--layout-text-muted)] text-xs uppercase w-full sm:w-auto"
            title="Open Console to see logs"
          >
            Debug DB (Console)
          </Button>
          
          <Button 
            onClick={() => fetchContas(filters)} 
            variant="outline"
            className="bg-[var(--layout-bg)] border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:text-white hover:bg-[var(--layout-border)] w-full sm:w-auto"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-900/20 border border-blue-500/30 rounded-xl p-4 sm:p-6 shadow-lg backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-400 text-sm font-bold uppercase tracking-wider">Total de Contas</p>
              <h3 className="text-3xl font-black text-white mt-2">{summary.totalCount}</h3>
            </div>
            <div className="bg-blue-500/20 p-3 rounded-lg">
              <CreditCard className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-600/20 to-red-900/20 border border-red-500/30 rounded-xl p-4 sm:p-6 shadow-lg backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-red-400 text-sm font-bold uppercase tracking-wider">A Receber</p>
              <h3 className="text-3xl font-black text-white mt-2">R$ {summary.totalReceivable.toFixed(2)}</h3>
            </div>
            <div className="bg-red-500/20 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-red-400" />
            </div>
          </div>
        </div>

      <div className="bg-gradient-to-br from-[var(--layout-accent)]/20 to-green-900/20 border border-[var(--layout-accent)]/30 rounded-xl p-4 sm:p-6 shadow-lg backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[var(--layout-accent)] text-sm font-bold uppercase tracking-wider">Recebido</p>
              <h3 className="text-3xl font-black text-white mt-2">R$ {summary.totalReceived.toFixed(2)}</h3>
            </div>
            <div className="bg-[var(--layout-accent)]/20 p-3 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-[var(--layout-accent)]" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-600/20 to-orange-900/20 border border-orange-500/30 rounded-xl p-4 sm:p-6 shadow-lg backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-orange-400 text-sm font-bold uppercase tracking-wider">Vencidas</p>
              <h3 className="text-3xl font-black text-white mt-2">{summary.overdueCount}</h3>
            </div>
            <div className="bg-orange-500/20 p-3 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-[var(--layout-bg)] rounded-xl border border-[var(--layout-border)] p-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        <div className="flex items-center gap-2 text-[var(--layout-text-muted)] text-sm font-medium whitespace-nowrap">
          <Filter className="w-4 h-4" /> Filtros:
        </div>
        
        <select
          value={filters.status}
          onChange={(e) => setFilters({...filters, status: e.target.value})}
          className="w-full sm:w-auto bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[var(--layout-accent)]"
        >
          <option value="Todos">Todos Status</option>
          <option value="Pendente">Pendente</option>
          <option value="Pago">Pago</option>
          <option value="Vencido">Vencido</option>
        </select>

        <select
          value={filters.clienteId}
          onChange={(e) => setFilters({...filters, clienteId: e.target.value})}
          className="w-full sm:w-auto bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[var(--layout-accent)] max-w-[200px]"
        >
          <option value="todos">Todos Clientes</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto">
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({...filters, startDate: e.target.value})}
            className="w-full sm:w-auto bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[var(--layout-accent)]"
          />
          <span className="text-[var(--layout-text-muted)]">até</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({...filters, endDate: e.target.value})}
            className="w-full sm:w-auto bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[var(--layout-accent)]"
          />
        </div>
      </div>

      {/* Main Table */}
      <ContasAReceberTable 
        data={contas} 
        loading={loading}
        onMarkAsPaid={(conta) => handleOpenModal('pay', conta)}
        onEdit={(conta) => handleOpenModal('edit', conta)}
        onDelete={(conta) => handleOpenModal('delete', conta)}
      />

      {/* Modals */}
      <MarcarComoPagoModal 
        isOpen={activeModal === 'pay'}
        onClose={handleCloseModal}
        conta={selectedConta}
        onConfirm={markAsPaid}
      />
      
      <EditarVendaFiadoModal 
        isOpen={activeModal === 'edit'}
        onClose={handleCloseModal}
        conta={selectedConta}
        clientes={clientes}
        onConfirm={editConta}
      />

      <ExcluirVendaFiadoModal 
        isOpen={activeModal === 'delete'}
        onClose={handleCloseModal}
        conta={selectedConta}
        onConfirm={deleteConta}
      />
    </div>
  );
};

export default ContasAReceberPage;
