import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const useCaixaOperacoes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [caixaStatus, setCaixaStatus] = useState({
    isOpen: false,
    saldoAtual: 0,
    dataAbertura: null,
    saldoInicial: 0
  });

  const fetchOperations = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('caixa_operacoes')
        .select('*')
        .eq('user_id', user.id)
        .gte('data_hora', today.toISOString())
        .order('data_hora', { ascending: false });

      if (error) throw error;

      setOperations(data || []);
      calculateStatus(data || []);
    } catch (error) {
      console.error('Erro ao buscar operações de caixa:', error);
      toast({
        title: 'Erro ao carregar caixa',
        description: 'Não foi possível carregar as informações do caixa.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const calculateStatus = (ops) => {
    const sortedOps = [...ops].sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));
    
    let isOpen = false;
    let saldo = 0;
    let dataAbertura = null;
    let saldoInicial = 0;

    for (const op of sortedOps) {
      if (op.tipo === 'abertura') {
        isOpen = true;
        saldo = Number(op.valor);
        saldoInicial = Number(op.valor);
        dataAbertura = op.data_hora;
      } else if (op.tipo === 'fechamento') {
        isOpen = false;
        saldo = 0;
        dataAbertura = null;
      } else if (op.tipo === 'suprimento') {
        if (isOpen) saldo += Number(op.valor);
      } else if (op.tipo === 'retirada') {
        if (isOpen) saldo -= Number(op.valor);
      }
    }
    
    setCaixaStatus({
      isOpen,
      saldoAtual: saldo,
      dataAbertura,
      saldoInicial
    });
  };

  const addOperation = async (tipo, valor, descricao, extras = {}) => {
    if (!user) return null;

    try {
      const newBalance = tipo === 'suprimento' || tipo === 'abertura' 
        ? caixaStatus.saldoAtual + valor 
        : caixaStatus.saldoAtual - valor;

      const { data, error } = await supabase
        .from('caixa_operacoes')
        .insert([{
          user_id: user.id,
          tipo,
          valor,
          saldo_anterior: caixaStatus.saldoAtual,
          saldo_atual: tipo === 'fechamento' ? 0 : newBalance,
          descricao,
          ...extras,
          data_hora: new Date().toISOString()
        }])
        .select()
        .maybeSingle(); // Changed from .single() to .maybeSingle() for safety

      if (error) throw error;
      if (!data) throw new Error("Operação realizada, mas nenhum dado retornado.");

      await fetchOperations();
      
      toast({
        title: 'Operação realizada',
        description: `Caixa: ${tipo.toUpperCase()} - R$ ${valor.toFixed(2)}`,
        className: 'bg-[#00d084] text-white border-none'
      });

      return data;
    } catch (error) {
      console.error(`Erro ao realizar ${tipo}:`, error);
      toast({
        title: 'Erro na operação',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchOperations();

    const subscription = supabase
      .channel('caixa_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'caixa_operacoes', filter: `user_id=eq.${user?.id}` }, 
        () => {
          fetchOperations();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchOperations, user]);

  return {
    operations,
    loading,
    caixaStatus,
    refresh: fetchOperations,
    abrirCaixa: (valor) => addOperation('abertura', valor, 'Abertura de Caixa'),
    fecharCaixa: (valorFinal, diff) => addOperation('fechamento', valorFinal, 'Fechamento de Caixa', { descricao: `Diferença: R$ ${diff}` }),
    adicionarSuprimento: (valor, descricao, origem) => addOperation('suprimento', valor, descricao, { origem }),
    realizarRetirada: (valor, descricao, motivo) => addOperation('retirada', valor, descricao, { motivo })
  };
};