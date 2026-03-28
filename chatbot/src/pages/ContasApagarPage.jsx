import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Search, Plus, Edit, Trash2, CheckCircle, AlertCircle, XCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const ContasApagarPage = () => {
  const [contas, setContas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesPeriodTotal, setSalesPeriodTotal] = useState(0);
  const [salesPeriod, setSalesPeriod] = useState('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loadingSalesTotal, setLoadingSalesTotal] = useState(false);
  const [loadingSalesPeriod, setLoadingSalesPeriod] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    descricao: '',
    fornecedor: '',
    data_vencimento: '',
    valor: '',
    observacoes: '',
    status: 'pendente'
  });

  useEffect(() => {
    if (user) {
      loadContas();
      loadSalesTotals();
      const subscription = supabase
        .channel('contas_pagar_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contas_pagar', filter: `user_id=eq.${user.id}` }, () => {
          loadContas();
          loadSalesTotals();
        })
        .subscribe();
      return () => { subscription.unsubscribe(); };
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadSalesPeriodTotal();
    }
  }, [user, salesPeriod, customStart, customEnd]);

  const loadContas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contas_pagar')
        .select('*')
        .eq('user_id', user.id)
        .order('data_vencimento', { ascending: true });

      if (error) throw error;
      setContas(data || []);
    } catch (error) {
      toast({ title: 'Erro ao carregar contas', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const parseLocalDate = (dateStr, endOfDay = false) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    const [year, month, day] = parts;
    return new Date(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
    );
  };

  const applySalesDateRange = (query, startIso, endIso) =>
    query.or(`and(data_criacao.gte.${startIso},data_criacao.lte.${endIso}),and(data_hora.gte.${startIso},data_hora.lte.${endIso})`);

  const loadSalesTotals = async () => {
    if (!user) return;
    setLoadingSalesTotal(true);
    try {
      const { data, error } = await supabase
        .from('vendas')
        .select('total')
        .eq('user_id', user.id)
        .eq('status', 'concluido');
      if (error) throw error;

      const total = (data || []).reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0);
      setSalesTotal(total);
    } catch (error) {
      console.error('Erro ao carregar vendas totais:', error);
    } finally {
      setLoadingSalesTotal(false);
    }
  };

  const loadSalesPeriodTotal = async () => {
    if (!user) return;
    setLoadingSalesPeriod(true);
    try {
      let start = null;
      let end = null;

      if (salesPeriod === 'week') {
        end = new Date();
        end.setHours(23, 59, 59, 999);
        start = new Date();
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
      } else if (salesPeriod === 'month') {
        end = new Date();
        end.setHours(23, 59, 59, 999);
        start = new Date();
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
      } else if (salesPeriod === 'custom') {
        start = parseLocalDate(customStart, false);
        end = parseLocalDate(customEnd, true);
        if (!start || !end) {
          setSalesPeriodTotal(0);
          setLoadingSalesPeriod(false);
          return;
        }
      }

      const startIso = start.toISOString();
      const endIso = end.toISOString();

      let vendasQuery = supabase
        .from('vendas')
        .select('total, data_criacao, data_hora')
        .eq('user_id', user.id)
        .eq('status', 'concluido');

      vendasQuery = applySalesDateRange(vendasQuery, startIso, endIso);

      const { data, error } = await vendasQuery;
      if (error) throw error;

      const total = (data || []).reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0);
      setSalesPeriodTotal(total);
    } catch (error) {
      console.error('Erro ao carregar vendas por perÃ­odo:', error);
    } finally {
      setLoadingSalesPeriod(false);
    }
  };

  const getTargetCaixa = async () => {
    const { data: openCaixa } = await supabase
      .from('caixas')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'aberto')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openCaixa) return openCaixa;

    const { data: latestCaixa } = await supabase
      .from('caixas')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return latestCaixa || null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, user_id: user.id };
      
      if (editingId) {
        const { error } = await supabase.from('contas_pagar').update(payload).eq('id', editingId);
        if (error) throw error;
        toast({ title: 'Conta atualizada com sucesso!' });
      } else {
        const { error } = await supabase.from('contas_pagar').insert([payload]);
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
      descricao: conta.descricao,
      fornecedor: conta.fornecedor || '',
      data_vencimento: conta.data_vencimento,
      valor: conta.valor,
      observacoes: conta.observacoes || '',
      status: conta.status
    });
    setEditingId(conta.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Deseja realmente excluir esta conta?')) {
      try {
        const { error } = await supabase.from('contas_pagar').delete().eq('id', id);
        if (error) throw error;
        toast({ title: 'Conta excluÃ­da com sucesso!' });
      } catch (error) {
         toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      }
    }
  };

  const handleMarkAsPaid = async (conta) => {
    try {
      const now = new Date().toISOString();
      const valor = parseFloat(conta.valor) || 0;

      const { error: updateError } = await supabase
        .from('contas_pagar')
        .update({ status: 'pago', data_pagamento: now })
        .eq('id', conta.id);
      if (updateError) throw updateError;

      const caixa = await getTargetCaixa();
      if (!caixa) {
        await supabase
          .from('contas_pagar')
          .update({ status: 'pendente', data_pagamento: null })
          .eq('id', conta.id);

        toast({
          title: 'Caixa nÃ£o encontrado',
          description: 'NÃ£o foi possÃ­vel localizar um caixa para registrar a saÃ­da.',
          variant: 'destructive'
        });
        return;
      }

      const saldoAnterior = parseFloat(caixa.saldo_atual || 0);
      const saldoNovo = saldoAnterior - valor;

      const { error: moveError } = await supabase.from('caixa_movimentos').insert([{
        user_id: user.id,
        caixa_id: caixa.id,
        tipo: 'retirada',
        valor,
        descricao: `Conta paga: ${conta.descricao}`,
        motivo: 'conta_pagar',
        saldo_anterior: saldoAnterior,
        saldo_novo: saldoNovo,
        data_movimentacao: now
      }]);

      if (moveError) throw moveError;

      const { error: rpcError } = await supabase.rpc('decrement_caixa_saldo', {
        p_caixa_id: caixa.id,
        p_valor: valor,
        p_tipo: 'retirada'
      });

      if (rpcError) {
        const { error: updateCaixaError } = await supabase
          .from('caixas')
          .update({
            saldo_atual: saldoNovo,
            total_retiradas: (caixa.total_retiradas || 0) + valor
          })
          .eq('id', caixa.id);
        if (updateCaixaError) throw updateCaixaError;
      }

      toast({ title: 'Conta marcada como paga e caixa atualizado!' });
    } catch (error) {
      await supabase
        .from('contas_pagar')
        .update({ status: 'pendente', data_pagamento: null })
        .eq('id', conta.id);
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({
      descricao: '',
      fornecedor: '',
      data_vencimento: '',
      valor: '',
      observacoes: '',
      status: 'pendente'
    });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const today = new Date().toISOString().split('T')[0];
  
  const totalPagar = contas
    .filter(c => c.status !== 'pago')
    .reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);

  const contasVencidas = contas.filter(c => 
    c.status !== 'pago' && c.data_vencimento < today
  ).length;

  const contasAVencer = contas.filter(c => 
    c.status !== 'pago' && c.data_vencimento >= today
  ).length;

  const totalPago = contas
    .filter(c => c.status === 'pago')
    .reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);

  const filteredContas = contas.filter(c => {
    const matchesSearch = 
      c.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.fornecedor && c.fornecedor.toLowerCase().includes(searchTerm.toLowerCase()));
    
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
    <div className="p-4 sm:p-6 animate-in fade-in duration-500">
      <Helmet>
        <title>Contas a Pagar - Dashboard</title>
      </Helmet>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Contas a Pagar</h1>
        <p className="text-[var(--layout-text-muted)]">GestÃ£o financeira de saÃ­das</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
        <div className="bg-[var(--layout-surface-2)] p-4 sm:p-6 rounded-lg shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[var(--layout-text-muted)] text-sm font-medium uppercase">Total a Pagar</p>
            <h3 className="text-2xl font-bold text-white mt-1">R$ {totalPagar.toFixed(2)}</h3>
          </div>
          <div className="p-3 bg-red-500/20 rounded-full">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-[var(--layout-surface-2)] p-4 sm:p-6 rounded-lg shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[var(--layout-text-muted)] text-sm font-medium uppercase">Vendas Totais</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {loadingSalesTotal ? '...' : `R$ ${salesTotal.toFixed(2)}`}
            </h3>
          </div>
          <div className="p-3 bg-[var(--layout-accent)]/20 rounded-full">
            <CheckCircle className="w-8 h-8 text-[var(--layout-accent)]" />
          </div>
        </div>
        <div className="bg-[var(--layout-surface-2)] p-4 sm:p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[var(--layout-text-muted)] text-sm font-medium uppercase">Vendas por PerÃ­odo</p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {loadingSalesPeriod ? '...' : `R$ ${salesPeriodTotal.toFixed(2)}`}
              </h3>
            </div>
          </div>
          <div className="flex gap-2 mb-3 flex-wrap">
            {[
              { key: 'week', label: '1 Semana' },
              { key: 'month', label: '1 MÃªs' },
              { key: 'custom', label: 'Personalizado' }
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSalesPeriod(opt.key)}
                className={`px-3 py-1 rounded text-xs font-semibold border ${
                  salesPeriod === opt.key
                    ? 'bg-[var(--layout-accent)] text-white border-transparent'
                    : 'bg-transparent border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:text-white hover:bg-[var(--layout-bg)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {salesPeriod === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-2 py-1 text-white text-xs focus:border-[var(--layout-accent)] focus:outline-none"
              />
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-2 py-1 text-white text-xs focus:border-[var(--layout-accent)] focus:outline-none"
              />
            </div>
          )}
        </div>
        <div className="bg-[var(--layout-surface-2)] p-4 sm:p-6 rounded-lg shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[var(--layout-text-muted)] text-sm font-medium uppercase">Contas Vencidas</p>
            <h3 className="text-2xl font-bold text-white mt-1">{contasVencidas}</h3>
          </div>
          <div className="p-3 bg-red-500/20 rounded-full">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-[var(--layout-surface-2)] p-4 sm:p-6 rounded-lg shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[var(--layout-text-muted)] text-sm font-medium uppercase">Contas a Vencer</p>
            <h3 className="text-2xl font-bold text-white mt-1">{contasAVencer}</h3>
          </div>
          <div className="p-3 bg-yellow-500/20 rounded-full">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-[var(--layout-surface-2)] p-4 sm:p-6 rounded-lg shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[var(--layout-text-muted)] text-sm font-medium uppercase">Total Pago</p>
            <h3 className="text-2xl font-bold text-[var(--layout-accent)] mt-1">R$ {totalPago.toFixed(2)}</h3>
          </div>
          <div className="p-3 bg-[var(--layout-accent)]/20 rounded-full">
            <CheckCircle className="w-8 h-8 text-[var(--layout-accent)]" />
          </div>
        </div>
      </div>

      <div className="bg-[var(--layout-surface-2)] rounded-lg p-4 sm:p-6 shadow-lg border border-[var(--layout-border)]">
        <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--layout-text-muted)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por descriÃ§Ã£o ou fornecedor..."
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
              className="bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white whitespace-nowrap ml-0 md:ml-2"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Conta
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--layout-border)]">
                <th className="py-3 px-4 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase">DescriÃ§Ã£o</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase">Fornecedor</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)] uppercase">Vencimento</th>
                <th className="py-3 px-4 text-right text-xs font-bold text-[var(--layout-text-muted)] uppercase">Valor</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)] uppercase">Status</th>
                <th className="py-3 px-4 text-right text-xs font-bold text-[var(--layout-text-muted)] uppercase">AÃ§Ãµes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredContas.map((conta) => (
                <tr key={conta.id} className="hover:bg-[var(--layout-border)] transition-colors">
                  <td className="py-3 px-4 text-white font-medium">{conta.descricao}</td>
                  <td className="py-3 px-4 text-[var(--layout-text-muted)]">{conta.fornecedor}</td>
                  <td className="py-3 px-4 text-center text-[var(--layout-text-muted)]">
                    {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}
                  </td>
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
                          onClick={() => handleMarkAsPaid(conta)}
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
            <div className="p-4 sm:p-6 border-b border-[var(--layout-border)] flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">
                {editingId ? 'Editar Conta' : 'Nova Conta a Pagar'}
              </h2>
              <button onClick={resetForm} className="text-[var(--layout-text-muted)] hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">DescriÃ§Ã£o *</label>
                <input
                  type="text"
                  required
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Fornecedor *</label>
                <input
                  type="text"
                  required
                  value={formData.fornecedor}
                  onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">ObservaÃ§Ãµes</label>
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

export default ContasApagarPage;


