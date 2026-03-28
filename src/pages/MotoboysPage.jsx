import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Search, Plus, Bike, Loader2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMotoboys } from '@/hooks/useMotoboys';
import MotoboysTable from '@/components/MotoboysTable';
import MotoboyCadastroModal from '@/components/MotoboyCadastroModal';

const MotoboysPage = () => {
  const { motoboys, loading, createMotoboy, updateMotoboy, deleteMotoboy } = useMotoboys();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos'); // todos, ativo, inativo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMotoboy, setEditingMotoboy] = useState(null);

  const handleCreate = async (data) => {
    await createMotoboy(data);
  };

  const handleUpdate = async (data) => {
    if (editingMotoboy) {
      await updateMotoboy(editingMotoboy.id, data);
    }
  };

  const handleEditClick = (motoboy) => {
    setEditingMotoboy(motoboy);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (motoboy) => {
    if (window.confirm(`Tem certeza que deseja excluir o motoboy ${motoboy.nome}?`)) {
      await deleteMotoboy(motoboy.id);
    }
  };

  const handleOpenNew = () => {
    setEditingMotoboy(null);
    setIsModalOpen(true);
  };

  // Filter Logic
  const filteredMotoboys = motoboys.filter(moto => {
    const matchesSearch = 
      moto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      moto.cpf.includes(searchTerm) ||
      (moto.telefone && moto.telefone.includes(searchTerm));
    
    const matchesStatus = statusFilter === 'todos' || moto.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 sm:p-6 bg-[var(--layout-bg)] min-h-full">
      <Helmet>
        <title>Motoboys - GestÃ£o de Entregadores</title>
      </Helmet>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-3">
            <Bike className="w-8 h-8 text-[var(--layout-accent)]" />
            Motoboys
          </h1>
          <p className="text-[var(--layout-text-muted)]">Gerencie sua frota de entregadores parceiros</p>
        </div>
        <Button 
          onClick={handleOpenNew}
          className="bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white font-bold shadow-lg shadow-[var(--layout-accent)]/20 w-full md:w-auto"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Motoboy
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)] mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--layout-text-muted)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, CPF ou telefone..."
            className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-[var(--layout-text-muted)] focus:border-[var(--layout-accent)] focus:outline-none"
          />
        </div>
        <div className="w-full md:w-48 relative">
           <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--layout-text-muted)]" />
           <select
             value={statusFilter}
             onChange={(e) => setStatusFilter(e.target.value)}
             className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg pl-10 pr-4 py-2.5 text-white appearance-none focus:border-[var(--layout-accent)] focus:outline-none cursor-pointer"
           >
             <option value="todos">Todos Status</option>
             <option value="ativo">Ativos</option>
             <option value="inativo">Inativos</option>
           </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--layout-text-muted)]">
            <Loader2 className="w-10 h-10 animate-spin mb-3 text-[var(--layout-accent)]" />
            <p>Carregando motoboys...</p>
          </div>
        ) : (
          <MotoboysTable 
            motoboys={filteredMotoboys}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
          />
        )}
      </div>

      <MotoboyCadastroModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={editingMotoboy ? handleUpdate : handleCreate}
        motoboy={editingMotoboy}
      />
    </div>
  );
};

export default MotoboysPage;


