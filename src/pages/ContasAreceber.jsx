import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Search, Plus, Edit, Trash2, CheckCircle, AlertCircle, XCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const ContasAreceber = () => {
  const [contas, setContas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    cliente_id: '',
    data_vencimento: '',
    valor: '',
    parcelas: '1',
    observacoes: '',
    status: 'pendente',
    origem: 'manual'
  });

  useEffect(() => {
    if (user) {
      loadData();
      const subscription = supabase
        .channel('contas_receber_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contas_receber', filter: `user_id=eq.${user.id}` }, () => {
          loadData();
        })
        .subscribe();
      return () => { subscription.unsubscribe(); };
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const { data: clientesData } = await supabase.from('pessoas').select('id, nome').eq('user_id', user.id);
      setClientes(clientesData || []);

      const { data: contasData, error } = await supabase
        .from('contas_receber')
        .select(`
          *,
          pessoas (id, nome)
        `)
        .eq('user_id', user.id)
        .order('data_vencimento', { ascending: true });

      if (error) throw error;
      setContas(contasData || []);
    } catch (error) {
      toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, user_id: user.id };
      
      if (editingId) {
        const { error } = await supabase.from('contas_receber').update(payload).eq('id', editingId);
        if (error) throw error;
        toast({ title: 'Conta atualizada com sucesso!' });
      } else {
        const { error } = await supabase.from('contas_receber').insert([payload]);
        if (error) throw error;
        toast({ title: 'Conta cadastrada com sucesso!' });
      }
      resetForm();
    } catch (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    }
  };

  const handleEdit = (conta) => {
    setFormData({
      cliente_id: conta.cliente_id || '',
      data_vencimento: conta.data_vencimento,
      valor: conta.valor,
      parcelas: conta.parcelas,
      observacoes: conta.observacoes || '',
      status: conta.status,
      origem: conta.origem
    });
    setEditingId(conta.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Deseja realmente excluir esta conta?')) {
      try {
        const { error } = await supabase.from('contas_receber').delete().eq('id', id);
        if (error) throw error;
        toast({ title: 'Conta excluída com sucesso!' });
      } catch (error) {
         toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      }
    }
  };

  const handleMarkAsPaid = async (id) => {
    try {
      const { error } = await supabase
        .from('contas_receber')
        .update({ status: 'pago', data_pagamento: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Conta marcada como paga!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({
      cliente_id: '',
      data_vencimento: '',
      valor: '',
      parcelas: '1',
      observacoes: '',
      status: 'pendente',
      origem: 'manual'
    });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const today = new Date().toISOString().split('T')[0];
  
  const totalReceber = contas
    .filter(c => c.status !== 'pago')
    .reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);

  const contasVencidas = contas.filter(c => 
    c.status !== 'pago' && c.data_vencimento < today
  ).length;

  const contasAVencer = contas.filter(c => 
    c.status !== 'pago' && c.data_vencimento >= today
  ).length;

  const totalRecebido = contas
    .filter(c => c.status === 'pago')
    .reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);

  const filteredContas = contas.filter(c => {
    const clienteNome = c.pessoas?.nome || 'Cliente não identificado';
    const matchesSearch = clienteNome.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesFilter = true;
    if (activeFilter === 'Pendente') matchesFilter = c.status === 'pendente' && c.data_vencimento >= today;
    if (activeFilter === 'Vencido') matchesFilter = c.status !== 'pago' && c.data_vencimento < today;
    if (activeFilter === 'Pago') matchesFilter = c.status === 'pago';

    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (conta) => {
    if (conta.status === 'pago') return <span className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--layout-accent)]/20 text-[var(--layout-accent)]">PAGO</span>;
    if (conta.data_vencimento < today) return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400">VENCIDO</span>;
    return <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400">PENDENTE</span>;
  };

  return (
    <div className="p-6 animate-in fade-in duration-500">
      <Helmet>
        <title>Contas a Receber - Dashboard</title>
      </Helmet>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Contas a Receber</h1>
        <p className="text-[var(--layout-text-muted)]">Gestão de recebimentos e fiados</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-[var(--layout-surface-2)] p-6 rounded-lg shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[var(--layout-text-muted)] text-sm font-medium uppercase">Total a Receber</p>
            <h3 className="text-2xl font-bold text-white mt-1">R$ {totalReceber.toFixed(2)}</h3>
          </div>
          <div className="p-3 bg-yellow-500/20 rounded-full">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-[var(--layout-surface-2)] p-6 rounded-lg shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[var(--layout-text-muted)] text-sm font-medium uppercase">Contas Vencidas</p>
            <h3 className="text-2xl font-bold text-white mt-1">{contasVencidas}</h3>
          </div>
          <div className="p-3 bg-red-500/20 rounded-full">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-[var(--layout-surface-2)] p-6 rounded-lg shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[var(--layout-text-muted)] text-sm font-medium uppercase">Contas a Vencer</p>
            <h3 className="text-2xl font-bold text-white mt-1">{contasAVencer}</h3>
          </div>
          <div className="p-3 bg-yellow-500/20 rounded-full">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-[var(--layout-surface-2)] p-6 rounded-lg shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[var(--layout-text-muted)] text-sm font-medium uppercase">Total Recebido</p>
            <h3 className="text-2xl font-bold text-[var(--layout-accent)] mt-1">R$ {totalRecebido.toFixed(2)}</h3>
          </div>
          <div className="p-3 bg-[var(--layout-accent)]/20 rounded-full">
            <CheckCircle className="w-8 h-8 text-[var(--layout-accent)]" />
          </div>
        </div>
      </div>

      <div className="bg-[var(--layout-surface-2)] rounded-lg p-6 shadow-lg border border-[var(--layout-border)]">
        <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--layout-text-muted)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente..."
              className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg pl-10 pr-4 py-2 text-white placeholder-[var(--layout-text-muted)] focus:border-[var(--layout-accent)] focus:outline-none"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
             {['Todos', 'Pendente', 'Vencido', 'Pago'].map((filter) => (
              <Button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                variant={activeFilter === filter ? 'default' : 'outline'}
                className={`whitespace-nowrap ${
                  activeFilter === filter 
                    ? 'bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white border-transparent' 
                    : 'bg-transparent border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:text-white hover:bg-[var(--layout-bg)]'
                }`}
              >
                {filter}
              </Button>
            ))}
            <Button 
              onClick={() => setIsFormOpen(true)}
              className="bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white whitespace-nowrap ml-2"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Conta
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--layout-border)]">
                <th className="py-3 px-4 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase">Cliente</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)] uppercase">Vencimento</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)] uppercase">Parcelas</th>
                <th className="py-3 px-4 text-right text-xs font-bold text-[var(--layout-text-muted)] uppercase">Valor</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)] uppercase">Status</th>
                <th className="py-3 px-4 text-right text-xs font-bold text-[var(--layout-text-muted)] uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredContas.map((conta) => (
                <tr key={conta.id} className="hover:bg-[var(--layout-border)] transition-colors">
                  <td className="py-3 px-4 text-white font-medium">{conta.pessoas?.nome || 'Cliente não identificado'}</td>
                  <td className="py-3 px-4 text-center text-[var(--layout-text-muted)]">
                    {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-center text-[var(--layout-text-muted)]">{conta.parcelas || 1}x</td>
                  <td className="py-3 px-4 text-right text-white font-bold">
                    R$ {parseFloat(conta.valor).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {getStatusBadge(conta)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      {conta.status !== 'pago' && (
                        <button 
                          onClick={() => handleMarkAsPaid(conta.id)}
                          title="Marcar como Pago"
                          className="p-1 text-[var(--layout-accent)] hover:bg-[var(--layout-accent)]/10 rounded transition-colors"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleEdit(conta)}
                        title="Editar"
                        className="p-1 text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(conta.id)}
                        title="Excluir"
                        className="p-1 text-red-400 hover:bg-red-400/10 rounded transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredContas.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-[var(--layout-text-muted)]">
                    Nenhuma conta encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--layout-surface-2)] rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto border border-[var(--layout-border)] shadow-xl">
            <div className="p-6 border-b border-[var(--layout-border)] flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">
                {editingId ? 'Editar Conta' : 'Nova Conta a Receber'}
              </h2>
              <button onClick={resetForm} className="text-[var(--layout-text-muted)] hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Cliente *</label>
                <select
                  required
                  value={formData.cliente_id}
                  onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                >
                  <option value="">Selecione um cliente</option>
                  {clientes.map(cliente => (
                    <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={formData.data_vencimento}
                    onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                    className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Parcelas</label>
                <input
                  type="number"
                  min="1"
                  value={formData.parcelas}
                  onChange={(e) => setFormData({ ...formData, parcelas: e.target.value })}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none h-24 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={resetForm}
                  variant="outline"
                  className="flex-1 bg-transparent border-[var(--layout-border)] text-white hover:bg-gray-700"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white"
                >
                  {editingId ? 'Atualizar' : 'Salvar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContasAreceber;
