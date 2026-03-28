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

  const normalizePaymentMethod = (method) => {
    const raw = (method || '').toString().trim().toLowerCase();
    if (!raw) return null;
    const clean = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (clean.includes('dinheiro')) return 'dinheiro';
    if (clean.includes('pix')) return 'pix';
    if (clean.includes('debito')) return 'debito';
    if (clean.includes('credito')) return 'credito';
    if (clean.includes('fiado')) return 'fiado';
    if (clean.includes('consumo')) return 'consumo';
    if (clean.includes('cheque')) return 'cheque';
    if (clean.includes('outro')) return 'outro';
    return clean;
  };

  const buildPaymentIso = (dateStr) => {
    if (!dateStr) return new Date().toISOString();
    const safe = `${dateStr}T12:00:00`;
    return new Date(safe).toISOString();
  };

  const buildDayRange = (dateStr) => {
    const base = dateStr || new Date().toISOString().split('T')[0];
    const start = new Date(`${base}T00:00:00`);
    const end = new Date(`${base}T23:59:59`);
    end.setMilliseconds(999);
    return { startIso: start.toISOString(), endIso: end.toISOString(), dateStr: base };
  };

  const pickContaDay = (conta) => {
    if (!conta) return null;
    const raw =
      conta.data_pagamento ||
      conta.atualizado_em ||
      conta.data_vencimento ||
      conta.created_at;
    if (!raw) return null;
    try {
      if (raw.includes('T')) return raw.split('T')[0];
      return raw;
    } catch (e) {
      return null;
    }
  };

  const applyStockUpdate = async (produtoId, newStock) => {
    if (!produtoId || !user) return;
    await supabase
      .from('produtos')
      .update({ estoque: newStock })
      .eq('id', produtoId)
      .eq('user_id', user.id);
  };

  const restoreComboInsumos = async (comboId, quantidadeCombos) => {
    if (!comboId || !quantidadeCombos) return;
    const { data: insumos, error } = await supabase
      .from('combo_insumos')
      .select(`
        quantidade,
        insumo_id,
        produto:produtos!combo_insumos_insumo_id_fkey (
          id,
          estoque
        )
      `)
      .eq('combo_id', comboId);

    if (error) {
      console.warn('Erro ao buscar insumos do combo para estorno:', error);
      return;
    }

    for (const rel of insumos || []) {
      const currentStock = parseFloat(rel?.produto?.estoque || 0);
      const qty = parseFloat(rel?.quantidade || 0) * Number(quantidadeCombos || 0);
      const newStock = currentStock + qty;
      await applyStockUpdate(rel.insumo_id, newStock);
    }
  };

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
      const paymentMethod = normalizePaymentMethod(paymentData?.formaPagamento);
      const paymentDateIso = buildPaymentIso(paymentData?.dataPagamento);
      const paymentDay = (paymentData?.dataPagamento || new Date().toISOString().split('T')[0]);

      let vendaInfo = null;
      if (conta?.venda_id) {
        const { data: vendaData } = await supabase
          .from('vendas')
          .select('id, numero_venda, data_hora, data_criacao')
          .eq('id', conta.venda_id)
          .maybeSingle();
        vendaInfo = vendaData || null;
      }

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

      if (conta?.venda_id) {
        try {
          const { data: pagamentosExist } = await supabase
            .from('venda_pagamentos')
            .select('id, forma_pagamento, valor')
            .eq('user_id', user.id)
            .eq('venda_id', conta.venda_id);

          let updatedPaymentId = null;
          if (pagamentosExist && pagamentosExist.length > 0) {
            const match = pagamentosExist.find((p) =>
              normalizePaymentMethod(p?.forma_pagamento) === 'fiado' &&
              Math.abs(Number(p?.valor || 0) - Number(conta?.valor || 0)) < 0.01
            );
            const fallback = pagamentosExist.find((p) => normalizePaymentMethod(p?.forma_pagamento) === 'fiado');
            const target = match || fallback;

            if (target) {
              const { error: updPayError } = await supabase
                .from('venda_pagamentos')
                .update({
                  forma_pagamento: paymentMethod || target.forma_pagamento,
                  data_pagamento: paymentDateIso
                })
                .eq('id', target.id);

              if (!updPayError) updatedPaymentId = target.id;
            }
          }

          if (!updatedPaymentId) {
            await supabase.from('venda_pagamentos').insert({
              user_id: user.id,
              venda_id: conta.venda_id,
              forma_pagamento: paymentMethod || (paymentData?.formaPagamento || 'dinheiro'),
              valor: Number(conta?.valor || 0),
              data_pagamento: paymentDateIso
            });
          }

          const { data: allPays } = await supabase
            .from('venda_pagamentos')
            .select('forma_pagamento')
            .eq('user_id', user.id)
            .eq('venda_id', conta.venda_id);

          if (allPays && allPays.length > 0) {
            const methods = new Set(
              allPays
                .map((p) => normalizePaymentMethod(p?.forma_pagamento))
                .filter(Boolean)
            );
            const newForma = methods.size > 1 ? 'multiplo' : Array.from(methods)[0];
            if (newForma) {
              await supabase.from('vendas').update({ forma_pagamento: newForma }).eq('id', conta.venda_id);
            }
          }

          if (vendaInfo) {
            const desc = `Venda #${vendaInfo.numero_venda || vendaInfo.id}`;
            await supabase
              .from('caixa_movimentos')
              .update({ forma_pagamento: paymentMethod || (paymentData?.formaPagamento || 'dinheiro') })
              .eq('user_id', user.id)
              .eq('tipo', 'venda')
              .eq('descricao', desc);
          }
        } catch (reconcileError) {
          console.warn('Erro ao reconciliar pagamento da venda:', reconcileError);
        }
      }

      if (caixa) {
        const valor = parseFloat(conta.valor);
        const vendaDateRaw = vendaInfo?.data_hora || vendaInfo?.data_criacao;
        const vendaDay = vendaDateRaw ? new Date(vendaDateRaw).toISOString().split('T')[0] : null;
        const shouldTreatAsSale = Boolean(vendaInfo && vendaDay && vendaDay === paymentDay);

        if (shouldTreatAsSale) {
          const { startIso, endIso } = buildDayRange(paymentDay);
          const { data: existingMove } = await supabase
            .from('caixa_movimentos')
            .select('id')
            .eq('user_id', user.id)
            .eq('caixa_id', caixa.id)
            .eq('tipo', 'suprimento')
            .eq('valor', valor)
            .gte('data_movimentacao', startIso)
            .lte('data_movimentacao', endIso)
            .ilike('descricao', 'Recebimento Fiado%')
            .order('data_movimentacao', { ascending: false })
            .limit(1)
            .maybeSingle();

          const vendaDesc = `Venda #${vendaInfo?.numero_venda || vendaInfo?.id}`;

          if (existingMove?.id) {
            await supabase
              .from('caixa_movimentos')
              .update({
                tipo: 'venda',
                descricao: vendaDesc,
                forma_pagamento: paymentMethod || paymentData.formaPagamento
              })
              .eq('id', existingMove.id);
          } else {
            await supabase.from('caixa_movimentos').insert({
              user_id: user.id,
              caixa_id: caixa.id,
              tipo: 'venda',
              valor: valor,
              descricao: vendaDesc,
              forma_pagamento: paymentMethod || paymentData.formaPagamento,
              saldo_anterior: caixa.saldo_atual,
              saldo_novo: (caixa.saldo_atual || 0) + valor,
              data_movimentacao: new Date().toISOString()
            });

            await supabase.rpc('increment_caixa_saldo', {
              p_caixa_id: caixa.id,
              p_valor: valor,
              p_tipo: 'venda'
            });
          }
        } else {
          await supabase.from('caixa_movimentos').insert({
            user_id: user.id,
            caixa_id: caixa.id,
            tipo: 'suprimento',
            valor: valor,
            descricao: `Recebimento Fiado - Cliente: ${paymentData.clienteName || 'N/A'}`,
            forma_pagamento: paymentMethod || paymentData.formaPagamento,
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
      const { data: conta, error: contaError } = await supabase
        .from('contas_receber')
        .select('*')
        .eq('id', id)
        .single();
      if (contaError) throw contaError;

      const vendaId = conta?.venda_id || null;
      let vendaData = null;
      if (vendaId) {
        const { data: vendaInfo } = await supabase
          .from('vendas')
          .select('id, numero_venda')
          .eq('id', vendaId)
          .maybeSingle();
        vendaData = vendaInfo || null;
      }

      // Restore stock (including combo insumos)
      if (vendaId) {
        const { data: itens } = await supabase
          .from('itens_venda')
          .select('produto_id, quantidade, produto:produtos(id, tipo, estoque)')
          .eq('venda_id', vendaId);

        for (const item of itens || []) {
          const produto = item?.produto;
          const qty = Number(item?.quantidade || 0);
          if (!produto || !qty) continue;

          if (produto?.tipo === 'combo') {
            await restoreComboInsumos(produto.id || item.produto_id, qty);
          } else {
            const currentStock = parseFloat(produto?.estoque || 0);
            const newStock = currentStock + qty;
            await applyStockUpdate(produto.id || item.produto_id, newStock);
          }
        }
      }

      // Remove caixa movements linked to this sale/payment and fix caixa totals
      const movimentosParaRemover = [];
      if (vendaData) {
        const descs = [
          `Venda #${vendaData.numero_venda || vendaData.id}`,
          `Venda #${vendaId}`
        ];

        const { data: movsSale } = await supabase
          .from('caixa_movimentos')
          .select('id, caixa_id, tipo, valor')
          .eq('user_id', user.id)
          .eq('tipo', 'venda')
          .in('descricao', descs);

        if (movsSale && movsSale.length > 0) movimentosParaRemover.push(...movsSale);
      }

      const contaDay = pickContaDay(conta);
      if (contaDay) {
        const { startIso, endIso } = buildDayRange(contaDay);
        const { data: movsFiado } = await supabase
          .from('caixa_movimentos')
          .select('id, caixa_id, tipo, valor')
          .eq('user_id', user.id)
          .eq('tipo', 'suprimento')
          .eq('valor', Number(conta?.valor || 0))
          .gte('data_movimentacao', startIso)
          .lte('data_movimentacao', endIso)
          .ilike('descricao', 'Recebimento Fiado%');

        if (movsFiado && movsFiado.length > 0) movimentosParaRemover.push(...movsFiado);
      }

      const movimentosUnicos = Array.from(
        new Map((movimentosParaRemover || []).map((m) => [m.id, m])).values()
      );

      if (movimentosUnicos.length > 0) {
        const totalsByCaixa = movimentosUnicos.reduce((acc, mov) => {
          const caixaId = mov.caixa_id;
          if (!caixaId) return acc;
          if (!acc[caixaId]) {
            acc[caixaId] = { saldoDelta: 0, vendasDelta: 0, suprimentosDelta: 0 };
          }
          const val = Number(mov?.valor || 0);
          if (mov.tipo === 'venda') {
            acc[caixaId].saldoDelta -= val;
            acc[caixaId].vendasDelta -= val;
          } else if (mov.tipo === 'suprimento') {
            acc[caixaId].saldoDelta -= val;
            acc[caixaId].suprimentosDelta -= val;
          }
          return acc;
        }, {});

        for (const [caixaId, deltas] of Object.entries(totalsByCaixa)) {
          const { data: caixaAtual } = await supabase
            .from('caixas')
            .select('id, saldo_atual, total_vendas, total_suprimentos')
            .eq('id', caixaId)
            .single();

          if (!caixaAtual) continue;
          const nextSaldo = Number(caixaAtual.saldo_atual || 0) + Number(deltas.saldoDelta || 0);
          const nextVendas = Number(caixaAtual.total_vendas || 0) + Number(deltas.vendasDelta || 0);
          const nextSup = Number(caixaAtual.total_suprimentos || 0) + Number(deltas.suprimentosDelta || 0);

          await supabase
            .from('caixas')
            .update({
              saldo_atual: nextSaldo,
              total_vendas: nextVendas,
              total_suprimentos: nextSup
            })
            .eq('id', caixaId);
        }

        const ids = movimentosUnicos.map((m) => m.id);
        for (let i = 0; i < ids.length; i += 50) {
          const chunk = ids.slice(i, i + 50);
          await supabase.from('caixa_movimentos').delete().in('id', chunk);
        }
      }

      // Delete related records
      if (vendaId) {
        await supabase.from('itens_venda').delete().eq('venda_id', vendaId);
        await supabase.from('venda_pagamentos').delete().eq('venda_id', vendaId);
        await supabase.from('vendas_itens_historico').delete().eq('venda_id', vendaId);
        await supabase.from('vendas').delete().eq('id', vendaId).eq('user_id', user.id);
      }

      const { error } = await supabase.from('contas_receber').delete().eq('id', id);
      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Conta excluída e venda removida por completo!' });
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
