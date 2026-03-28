import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Search, UserPlus, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFuncionarios } from '@/hooks/useFuncionarios';
import FuncionariosTable from '@/components/FuncionariosTable';
import CreateFuncionarioModal from '@/components/CreateFuncionarioModal';
import EditFuncionarioModal from '@/components/EditFuncionarioModal';
import DeleteFuncionarioConfirmation from '@/components/DeleteFuncionarioConfirmation';

const FuncionariosPage = () => {
  const [filters, setFilters] = useState({
    nome: '',
    cargo: 'Todos',
    status: 'Todos'
  });
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingFuncionario, setEditingFuncionario] = useState(null);
  const [deletingFuncionario, setDeletingFuncionario] = useState(null);

  const { 
    funcionarios, 
    loading, 
    fetchFuncionarios, 
    createFuncionario, 
    updateFuncionario, 
    deleteFuncionario 
  } = useFuncionarios();

  useEffect(() => {
    fetchFuncionarios();
  }, [fetchFuncionarios]);

  const handleFilter = () => {
    fetchFuncionarios({
      nome: filters.nome,
      cargo: filters.cargo,
      status: filters.status
    });
  };

  const clearFilters = () => {
    setFilters({ nome: '', cargo: 'Todos', status: 'Todos' });
    // Trigger fetch with cleared filters
    fetchFuncionarios({ nome: '', cargo: 'Todos', status: 'Todos' });
  };

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[var(--layout-bg)] animate-in fade-in duration-500">
      <Helmet>
        <title>FuncionÃ¡rios - FORTIN ERP PRO</title>
      </Helmet>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">FuncionÃ¡rios</h1>
          <p className="text-[var(--layout-text-muted)]">Gerencie sua equipe e colaboradores</p>
        </div>
        <Button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white font-bold w-full md:w-auto"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          NOVO FUNCIONÃRIO
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)] mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="relative">
            <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--layout-text-muted)]" />
              <input
                type="text"
                placeholder="Nome ou email..."
                value={filters.nome}
                onChange={(e) => setFilters(prev => ({ ...prev, nome: e.target.value }))}
                className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:border-[var(--layout-accent)] focus:outline-none"
              />
            </div>
          </div>
          
          <div>
            <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Cargo</label>
            <select
              value={filters.cargo}
              onChange={(e) => setFilters(prev => ({ ...prev, cargo: e.target.value }))}
              className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white text-sm focus:border-[var(--layout-accent)] focus:outline-none"
            >
              <option value="Todos">Todos</option>
              <option value="Vendedor">Vendedor</option>
              <option value="Gerente">Gerente</option>
              <option value="Caixa">Caixa</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div>
             <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Status</label>
             <select 
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white text-sm focus:border-[var(--layout-accent)] focus:outline-none"
             >
               <option value="Todos">Todos</option>
               <option value="Ativo">Ativo</option>
               <option value="Inativo">Inativo</option>
             </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={handleFilter}
              disabled={loading}
              className="flex-1 bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white font-bold"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4 mr-2" />}
              FILTRAR
            </Button>
            <Button 
              onClick={clearFilters}
              disabled={loading}
              variant="outline"
              className="bg-transparent border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:bg-[var(--layout-border)]"
            >
              LIMPAR
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="h-auto md:h-[calc(100vh-340px)] min-h-[400px]">
        {loading && funcionarios.length === 0 ? (
          <div className="flex justify-center items-center h-full text-[var(--layout-text-muted)]">
             <Loader2 className="w-8 h-8 animate-spin mr-2" /> Carregando...
          </div>
        ) : (
          <FuncionariosTable 
            funcionarios={funcionarios}
            onEdit={setEditingFuncionario}
            onDelete={setDeletingFuncionario}
          />
        )}
      </div>

      {/* Modals */}
      <CreateFuncionarioModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={createFuncionario}
      />

      <EditFuncionarioModal 
        isOpen={!!editingFuncionario}
        onClose={() => setEditingFuncionario(null)}
        funcionario={editingFuncionario}
        onSave={updateFuncionario}
      />

      <DeleteFuncionarioConfirmation 
        isOpen={!!deletingFuncionario}
        onClose={() => setDeletingFuncionario(null)}
        funcionario={deletingFuncionario}
        onConfirm={deleteFuncionario}
      />
    </div>
  );
};

export default FuncionariosPage;



