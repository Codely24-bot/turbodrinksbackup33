import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const useCaixaMovimentacoes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [caixaSaldo, setCaixaSaldo] = useState(0);

  const getCaixaSaldo = useCallback(async (caixaId) => {
    if (!user || !caixaId) return 0;
    try {
      const { data, error } = await supabase
        .from('caixas')
        .select('saldo_atual')
        .eq('id', caixaId)
        .single();

      if (error) throw error;
      setCaixaSaldo(data?.saldo_atual || 0);
      return data?.saldo_atual || 0;
    } catch (error) {
      console.error('Error fetching caixa saldo:', error);
      return 0;
    }
  }, [user]);

  const fetchMovimentacoes = useCallback(async (caixaId) => {
    if (!user || !caixaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('caixa_movimentos')
        .select('*')
        .eq('user_id', user.id)
        .eq('caixa_id', caixaId)
        .order('data_movimentacao', { ascending: false });

      if (error) throw error;
      setMovimentacoes(data || []);

      // Also update saldo
      await getCaixaSaldo(caixaId);
    } catch (error) {
      console.error('Error fetching movimentacoes:', error);
      toast({
        title: 'Erro ao carregar movimentações',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast, getCaixaSaldo]);

  const addSuprimento = async (caixaId, valor, descricao, formaPagamento, saldoAnterior) => {
    if (!user || !caixaId) return false;
    setLoading(true);
    try {
      const valorNum = parseFloat(valor);
      const saldoAntNum = parseFloat(saldoAnterior || 0);
      const novoSaldo = saldoAntNum + valorNum;

      // 1. Insert Movement
      const { error: moveError } = await supabase
        .from('caixa_movimentos')
        .insert([{
          user_id: user.id,
          caixa_id: caixaId,
          tipo: 'suprimento',
          valor: valorNum,
          descricao,
          forma_pagamento: formaPagamento,
          saldo_anterior: saldoAntNum,
          saldo_novo: novoSaldo,
          data_movimentacao: new Date().toISOString()
        }]);

      if (moveError) throw moveError;

      // 2. Update Caixa
      await updateCaixaBalance(caixaId, valorNum, 'suprimento');

      toast({
        title: 'Suprimento realizado',
        description: 'Suprimento registrado com sucesso!',
        className: 'bg-[#00d084] text-white border-none'
      });

      await fetchMovimentacoes(caixaId);
      return true;
    } catch (error) {
      console.error('Error adding suprimento:', error);
      toast({
        title: 'Erro no suprimento',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const addRetirada = async (caixaId, valor, descricao, motivo, saldoAnterior) => {
    if (!user || !caixaId) return false;
    setLoading(true);
    try {
      const valorNum = parseFloat(valor);
      const saldoAntNum = parseFloat(saldoAnterior || 0);
      const novoSaldo = saldoAntNum - valorNum;

      if (novoSaldo < 0) {
        // Optional warning logic
      }

      // 1. Insert Movement
      const { error: moveError } = await supabase
        .from('caixa_movimentos')
        .insert([{
          user_id: user.id,
          caixa_id: caixaId,
          tipo: 'retirada',
          valor: valorNum,
          descricao,
          motivo,
          saldo_anterior: saldoAntNum,
          saldo_novo: novoSaldo,
          data_movimentacao: new Date().toISOString()
        }]);

      if (moveError) throw moveError;

      // 2. Update Caixa
      await updateCaixaBalance(caixaId, valorNum, 'retirada');

      toast({
        title: 'Retirada realizada',
        description: 'Retirada registrada com sucesso!',
        className: 'bg-[#00d084] text-white border-none'
      });

      await fetchMovimentacoes(caixaId);
      return true;
    } catch (error) {
      console.error('Error adding retirada:', error);
      toast({
        title: 'Erro na retirada',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const registerSaleMovement = async (caixaId, valorTotal, vendaId, numeroVenda, currentSaldo, formaPagamento = null) => {
    if (!user || !caixaId) return false;

    try {
      const valorNum = parseFloat(valorTotal);
      const saldoAntNum = parseFloat(currentSaldo || 0);
      const novoSaldo = saldoAntNum + valorNum;

      // 1. Record Movement
      const { error: moveError } = await supabase.from('caixa_movimentos').insert([{
        user_id: user.id,
        caixa_id: caixaId,
        tipo: 'venda',
        valor: valorNum,
        descricao: `Venda #${numeroVenda || vendaId}`,
        forma_pagamento: formaPagamento,
        saldo_anterior: saldoAntNum,
        saldo_novo: novoSaldo,
        data_movimentacao: new Date().toISOString()
      }]);

      if (moveError) throw moveError;

      // 2. Update Caixa Balance
      await updateCaixaBalance(caixaId, valorNum, 'venda');

      return true;
    } catch (error) {
      console.error("Error registering sale movement:", error);
      throw error; // Re-throw to be handled by the caller (PDVPage)
    }
  };

  // Helper to update caixa balance with fallback
  const updateCaixaBalance = async (caixaId, valor, tipo) => {
    let { error: rpcError } = await supabase
      .rpc(tipo === 'retirada' ? 'decrement_caixa_saldo' : 'increment_caixa_saldo', {
        p_caixa_id: caixaId,
        p_valor: valor,
        p_tipo: tipo
      });

    if (rpcError) {
      console.warn(`RPC ${tipo} failed, using fallback.`, rpcError);

      const { data: currentCaixa } = await supabase
        .from('caixas')
        .select('*')
        .eq('id', caixaId)
        .single();

      if (currentCaixa) {
        const currentSaldo = currentCaixa.saldo_atual || 0;
        let updates = {};

        if (tipo === 'retirada') {
          updates = {
            saldo_atual: currentSaldo - valor,
            total_retiradas: (currentCaixa.total_retiradas || 0) + valor
          };
        } else if (tipo === 'suprimento') {
          updates = {
            saldo_atual: currentSaldo + valor,
            total_suprimentos: (currentCaixa.total_suprimentos || 0) + valor
          };
        } else if (tipo === 'venda') {
          updates = {
            saldo_atual: currentSaldo + valor,
            total_vendas: (currentCaixa.total_vendas || 0) + valor
          };
        }

        const { error: updateError } = await supabase
          .from('caixas')
          .update(updates)
          .eq('id', caixaId);

        if (updateError) throw updateError;
      }
    }
  };

  const ensureCaixaExists = useCallback(async () => {
    if (!user) return null;
    try {
      let { data, error } = await supabase
        .from('caixas')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'aberto')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        const { data: anyCaixa } = await supabase
          .from('caixas')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (anyCaixa) return anyCaixa;

        const { data: newCaixa, error: createError } = await supabase
          .from('caixas')
          .insert([{ user_id: user.id, nome: 'Caixa Principal', saldo_atual: 0, saldo_inicial: 0 }])
          .select()
          .single();

        if (createError) throw createError;
        return newCaixa;
      }
      return data;
    } catch (e) {
      console.error("Error ensuring caixa:", e);
      return null;
    }
  }, [user]);

  return {
    loading,
    movimentacoes,
    caixaSaldo,
    fetchMovimentacoes,
    addSuprimento,
    addRetirada,
    registerSaleMovement,
    getCaixaSaldo,
    ensureCaixaExists
  };
};