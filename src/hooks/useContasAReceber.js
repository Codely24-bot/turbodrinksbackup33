import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const useContasAReceber = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [contas, setContas] = useState([]);
  const [summary, setSummary] = useState({
    totalCount: 0,
    totalReceivable: 0,
    totalReceived: 0,
    overdueCount: 0
  });

  const fetchContas = useCallback(async (filters = {}) => {
    if (!user) {
      console.log("useContasAReceber: No user found, skipping fetch.");
      return;
    }

    setLoading(true);
    console.log("🔄 useContasAReceber: Fetching data with filters:", filters);

    try {
      // Base query on 'contas_receber'
      let query = supabase
        .from('contas_receber')
        .select(`
          *,
          cliente:pessoas(id, nome, cpf, telefone),
          venda:vendas(numero_venda, total, data_hora)
        `)
        .eq('user_id', user.id)
        .order('data_vencimento', { ascending: true });

      // Apply Filters
      if (filters.status && filters.status !== 'Todos') {
        const statusMap = { 'Pendente': 'pendente', 'Pago': 'pago', 'Vencido': 'pendente' };
        query = query.eq('status', statusMap[filters.status] || filters.status);
        
        if (filters.status === 'Vencido') {
          const today = new Date().toISOString().split('T')[0];
          query = query.lt('data_vencimento', today);
        }
      }

      if (filters.clienteId && filters.clienteId !== 'todos') {
        query = query.eq('cliente_id', filters.clienteId);
      }

      if (filters.startDate) {
        query = query.gte('data_vencimento', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('data_vencimento', filters.endDate);
      }

      // Execute Query
      const { data, error } = await query;

      if (error) {
        console.error('❌ useContasAReceber: Supabase Error:', error);
        throw error;
      }

      console.log(`✅ useContasAReceber: Successfully fetched ${data?.length || 0} records.`);
      
      // Log sample data to check structure
      if (data && data.length > 0) {
        console.groupCollapsed("📋 Sample Contas Record (First Item)");
        console.log(data[0]);
        console.groupEnd();
      } else {
        console.log("ℹ️ useContasAReceber: No records found.");
      }

      const contasData = data || [];
      setContas(contasData);
      calculateSummary(contasData);

    } catch (error) {
      console.error('🔥 useContasAReceber: Exception caught:', error);
      toast({
        title: 'Erro ao carregar contas',
        description: error.message || "Falha ao comunicar com o servidor.",
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const calculateSummary = (data) => {
    const today = new Date().toISOString().split('T')[0];
    
    const summaryData = data.reduce((acc, curr) => {
      const valor = parseFloat(curr.valor || 0);
      const isPaid = curr.status === 'pago';
      const isOverdue = !isPaid && curr.data_vencimento < today;

      return {
        totalCount: acc.totalCount + 1,
        totalReceivable: acc.totalReceivable + (!isPaid ? valor : 0),
        totalReceived: acc.totalReceived + (isPaid ? valor : 0),
        overdueCount: acc.overdueCount + (isOverdue ? 1 : 0)
      };
    }, { totalCount: 0, totalReceivable: 0, totalReceived: 0, overdueCount: 0 });

    setSummary(summaryData);
  };

  const markAsPaid = async (contaId, paymentData) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: conta } = await supabase.from('contas_receber').select('*').eq('id', contaId).single();
      if (!conta) throw new Error("Conta não encontrada");

      const { data: caixa } = await supabase.from('caixas').select('*').eq('user_id', user.id).eq('status', 'aberto').single();

      const { error: updateError } = await supabase
        .from('contas_receber')
        .update({
          status: 'pago',
          data_pagamento: paymentData.dataPagamento,
          observacoes: paymentData.observacoes 
            ? `${conta.observacoes || ''} | Pagamento: ${paymentData.observacoes}` 
            : conta.observacoes,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', contaId);

      if (updateError) throw updateError;

      if (caixa) {
        const valor = parseFloat(conta.valor);
        await supabase.from('caixa_movimentos').insert({
          user_id: user.id,
          caixa_id: caixa.id,
          tipo: 'suprimento',
          valor: valor,
          descricao: `Recebimento Fiado - Cliente: ${paymentData.clienteName || 'N/A'}`,
          forma_pagamento: paymentData.formaPagamento,
          saldo_anterior: caixa.saldo_atual,
          saldo_novo: (caixa.saldo_atual || 0) + valor,
          data_movimentacao: new Date().toISOString()
        });

        await supabase.rpc('increment_caixa_saldo', {
          p_caixa_id: caixa.id,
          p_valor: valor,
          p_tipo: 'suprimento'
        });
      }

      toast({ title: 'Sucesso', description: 'Conta marcada como paga!', className: 'bg-green-600 text-white' });
      await fetchContas();

    } catch (error) {
      console.error('Erro ao marcar como pago:', error);
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Keep existing functions
  const editConta = async (id, data) => {
    try {
      setLoading(true);
      const { error } = await supabase.from('contas_receber').update({...data, atualizado_em: new Date().toISOString()}).eq('id', id);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Conta atualizada com sucesso!' });
      await fetchContas();
    } catch (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const deleteConta = async (id) => {
    try {
      setLoading(true);
      const { error } = await supabase.from('contas_receber').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Conta excluída com sucesso!' });
      await fetchContas();
    } catch (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return {
    contas,
    summary,
    loading,
    fetchContas,
    markAsPaid,
    editConta,
    deleteConta
  };
};