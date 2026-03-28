import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Search, Trash2, DollarSign, Lock, Unlock, Eye, EyeOff, Layers, Plus, AlertCircle, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import PaymentModal from '@/components/PaymentModal';
import CashSummaryModal from '@/components/CashSummaryModal';
import OpenCashierModal from '@/components/OpenCashierModal';
import CloseCashierModal from '@/components/CloseCashierModal';
import SuprimentoCaixaModal from '@/components/SuprimentoCaixaModal';
import RetiradaCaixaModal from '@/components/RetiradaCaixaModal';
import CaixaMovimentacoesTable from '@/components/CaixaMovimentacoesTable';
import PrintOrderModal from '@/components/PrintOrderModal';
import SalesHistoryModal from '@/components/SalesHistoryModal';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCaixaMovimentacoes } from '@/hooks/useCaixaMovimentacoes';
import { useCashier } from '@/hooks/useCashier';
import { useCombos } from '@/hooks/useCombos';

const PDVPage = () => {
  const [produtos, setProdutos] = useState([]);
  const [clientes, setClientes] = useState([]); 
  const [motoboys, setMotoboys] = useState([]); 
  const [vendedores, setVendedores] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState([]);
  const [desconto, setDesconto] = useState(0); 
  const [acrescimo, setAcrescimo] = useState(0); 
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);
  const [showBalance, setShowBalance] = useState(false);
  
  // Modals
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [showCashSummary, setShowCashSummary] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [reportStart, setReportStart] = useState('');
  const [reportEnd, setReportEnd] = useState('');
  const [reportPaymentMethod, setReportPaymentMethod] = useState('all');
  const [showOpenCashier, setShowOpenCashier] = useState(false); 
  const [showCloseCashier, setShowCloseCashier] = useState(false); 
  const [showSuprimento, setShowSuprimento] = useState(false);
  const [showRetirada, setShowRetirada] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [showSalesHistory, setShowSalesHistory] = useState(false);
  const [todaySalesTotal, setTodaySalesTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [clearingMovimentacoes, setClearingMovimentacoes] = useState(false);
  const searchInputRef = useRef(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Hooks
  const { cashierSession, getCurrentCashierSession, openCashier, closeCashier } = useCashier();
  const { fetchMovimentacoes, movimentacoes, ensureCaixaExists, caixaSaldo, getCaixaSaldo, registerSaleMovement } = useCaixaMovimentacoes();
  const { fetchComboInsumos } = useCombos();

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
    return clean;
  };

  const isNonCashPayment = (method) => {
    const key = normalizePaymentMethod(method);
    return key === 'fiado' || key === 'consumo';
  };

  // Derived state
  const isCashierOpen = !!cashierSession;
  const currentEmployee = cashierSession?.funcionario;
  const [activeCaixaId, setActiveCaixaId] = useState(null);

  const toggleBalanceVisibility = () => setShowBalance(!showBalance);

  const loadTodaySalesTotal = useCallback(async () => {
    if (!user) return;
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const startIso = start.toISOString();
      const endIso = end.toISOString();

      const [pagamentosRes, vendasRes] = await Promise.all([
        supabase
          .from('venda_pagamentos')
          .select('venda_id, valor, data_pagamento')
          .eq('user_id', user.id)
          .gte('data_pagamento', startIso)
          .lte('data_pagamento', endIso),
        (() => {
          let vendasQuery = supabase
            .from('vendas')
            .select('id, total, data_criacao, data_hora, status')
            .eq('user_id', user.id)
            .eq('status', 'concluido');

          vendasQuery = vendasQuery.or(`and(data_criacao.gte.${startIso},data_criacao.lte.${endIso}),and(data_hora.gte.${startIso},data_hora.lte.${endIso})`);

          return vendasQuery;
        })()
      ]);

      const pagamentos = pagamentosRes.data || [];
      const vendas = vendasRes.data || [];
      const paidSaleIds = new Set();
      let total = 0;

      pagamentos.forEach((p) => {
        if (p?.venda_id) paidSaleIds.add(p.venda_id);
        total += Number(p?.valor || 0);
      });

      vendas.forEach((v) => {
        if (paidSaleIds.has(v.id)) return;
        total += Number(v?.total || 0);
      });

      setTodaySalesTotal(total);
    } catch (err) {
      console.error('Error loading today sales total:', err);
    }
  }, [user]);
  
  const todayTotals = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const totals = { sales: todaySalesTotal, supplies: 0, withdrawals: 0, net: 0 };
    (movimentacoes || []).forEach((m) => {
      const dt = new Date(m.data_movimentacao);
      if (dt < start || dt > end) return;
      const val = Number(m.valor) || 0;
      if (m.tipo === 'suprimento') totals.supplies += val;
      else if (m.tipo === 'retirada') totals.withdrawals += val;
    });
    totals.net = totals.sales + totals.supplies - totals.withdrawals;
    return totals;
  }, [movimentacoes, todaySalesTotal]);
  const todayExpectedBalance = (Number(cashierSession?.saldo_inicial) || 0) + todayTotals.net;

  useEffect(() => {
    if (user) {
      loadProdutos();
      loadClientes();
      loadMotoboys();
      loadVendedores();
      getCurrentCashierSession();
      initializeCaixa();
      loadTodaySalesTotal();
      
      // REALTIME SUBSCRIPTIONS
      const productsSub = supabase
        .channel('pdv_produtos')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos', filter: `user_id=eq.${user.id}` }, () => {
           loadProdutos();
        })
        .subscribe();
        
      const caixaSub = supabase
        .channel('pdv_caixa')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'caixa_movimentos', filter: `user_id=eq.${user.id}` }, () => {
           handleRefreshMovimentacoes();
        })
        .subscribe();
        
      const vendasSub = supabase
        .channel('pdv_vendas')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vendas', filter: `user_id=eq.${user.id}` }, () => {
           handleRefreshMovimentacoes();
        })
        .subscribe();

      return () => { 
        productsSub.unsubscribe(); 
        caixaSub.unsubscribe();
        vendasSub.unsubscribe();
      };
    }
  }, [user, loadTodaySalesTotal]);

  const getFilteredMovimentacoes = () => {
    let data = movimentacoes || [];
    if (reportStart) {
      const start = new Date(reportStart);
      data = data.filter(m => new Date(m.data_movimentacao) >= start);
    }
    if (reportEnd) {
      const end = new Date(reportEnd);
      end.setHours(23,59,59,999);
      data = data.filter(m => new Date(m.data_movimentacao) <= end);
    }
    if (reportPaymentMethod && reportPaymentMethod !== 'all') {
      data = data.filter(m => (m.forma_pagamento || '').toString() === reportPaymentMethod);
    }
    return data;
  };

  const initializeCaixa = async () => {
    const caixa = await ensureCaixaExists();
    if (caixa) {
      setActiveCaixaId(caixa.id);
      await fetchMovimentacoes(caixa.id);
      await getCaixaSaldo(caixa.id);
    }
  };

  const handleRefreshMovimentacoes = async () => {
    if (!activeCaixaId) {
        const caixa = await ensureCaixaExists();
        if (caixa) setActiveCaixaId(caixa.id);
    }
    
    if (activeCaixaId) {
      await fetchMovimentacoes(activeCaixaId);
      await getCaixaSaldo(activeCaixaId);
    }

    await loadTodaySalesTotal();
  };

  const handleClearMovimentacoes = async () => {
    if (!activeCaixaId) {
      toast({ title: 'Caixa não selecionado', description: 'Nenhum caixa ativo encontrado.', variant: 'destructive' });
      return;
    }

    if (!window.confirm('Deseja realmente excluir todo o histórico de movimentações deste caixa? Esta ação é irreversível.')) return;

    setClearingMovimentacoes(true);
    try {
      const { error } = await supabase.from('caixa_movimentos').delete().eq('user_id', user.id).eq('caixa_id', activeCaixaId);
      if (error) throw error;

      toast({ title: 'Histórico limpo', description: 'Todas as movimentações foram removidas.', className: 'bg-[var(--layout-accent)] text-white' });
      await fetchMovimentacoes(activeCaixaId);
      await getCaixaSaldo(activeCaixaId);
    } catch (err) {
      console.error('Error clearing movimentacoes:', err);
      toast({ title: 'Erro ao limpar histórico', description: err.message || err, variant: 'destructive' });
    } finally {
      setClearingMovimentacoes(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showCashSummary || showOpenCashier || showCloseCashier || showSuprimento || showRetirada || showPrintModal || showSalesHistory) {
         if (e.key === 'Escape') {
          e.preventDefault();
          setShowOpenCashier(false);
          setShowCloseCashier(false);
          setShowSuprimento(false);
          setShowRetirada(false);
          setShowPrintModal(false);
          setShowSalesHistory(false);
          setShowCashSummary(false);
        }
        return;
      }
      if (isPaymentOpen) return;
      if (e.key === 'F2') { e.preventDefault(); isCashierOpen ? setShowCloseCashier(true) : setShowOpenCashier(true); }
      else if (e.key === 'F3') { e.preventDefault(); setShowRetirada(true); } 
      else if (e.key === 'F5') { e.preventDefault(); const value = prompt('Digite o desconto (R$):'); if (value) setDesconto(parseFloat(value) || 0); }
      else if (e.key === 'F6') { e.preventDefault(); const value = prompt('Digite o acréscimo (R$):'); if (value) setAcrescimo(parseFloat(value) || 0); }
      else if (e.key === 'F7' || e.key === 'F10') { e.preventDefault(); if (items.length > 0) setIsPaymentOpen(true); }
      else if (e.key === 'F8') { e.preventDefault(); cancelSale(); }
      else if (e.key === 'F9') { e.preventDefault(); setShowCashSummary(true); }
      else if (e.key === 'F12') { e.preventDefault(); setShowSalesHistory(true); }
      else if (e.ctrlKey && e.key === 'w') { e.preventDefault(); cancelSale(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, user, isPaymentOpen, showCashSummary, showOpenCashier, showCloseCashier, showSuprimento, showRetirada, showPrintModal, showSalesHistory, isCashierOpen]);

  const loadProdutos = async () => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativo', true);
      if (error) throw error;
      const enriched = await Promise.all((data || []).map(async (p) => {
        if (p.tipo === 'combo') {
          try {
            const insumos = await fetchComboInsumos(p.id);
            return { ...p, insumos };
          } catch (e) {
            console.error('Erro ao carregar insumos do combo', p.id, e);
            return { ...p, insumos: [] };
          }
        }
        return p;
      }));
      setProdutos(enriched);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const loadClientes = async () => {
    try { setLoadingClientes(true); const { data } = await supabase.from('pessoas').select('*').eq('user_id', user.id); setClientes(data || []); } catch (e) { console.error(e); } finally { setLoadingClientes(false); }
  };
  const loadMotoboys = async () => {
    try { const { data } = await supabase.from('motoboys').select('id,nome,telefone').eq('user_id', user.id).eq('status','ativo'); setMotoboys(data || []); } catch (e) { console.error(e); }
  };
  const loadVendedores = async () => {
    try { const { data } = await supabase.from('vendedores').select('id,nome').eq('user_id', user.id).eq('ativo', true); setVendedores(data || []); } catch (e) { console.error(e); }
  };

  const addSearchedProduct = () => {
    const produto = produtos.find(p => 
      p.codigo.toLowerCase() === searchTerm.toLowerCase() ||
      p.descricao.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (produto) { 
      addItem(produto); 
      setSearchTerm(''); 
    } else { 
      toast({ title: 'Produto não encontrado', variant: 'destructive' }); 
    }
  };

  const addItem = async (produto) => {
    if (!isCashierOpen) {
      toast({ title: 'Caixa Fechado', description: 'Abra o caixa antes de iniciar uma venda.', variant: 'destructive' });
      return;
    }

    if (produto.tipo === 'combo') {
      try {
        const insumos = await fetchComboInsumos(produto.id);
        if (!insumos || insumos.length === 0) {
           toast({ title: 'Erro de cadastro', description: 'Combo sem insumos.', variant: 'destructive' });
           return;
        }
        
        const existingIndex = items.findIndex(item => item.produtoId === produto.id);
        const currentQtyInCart = existingIndex >= 0 ? items[existingIndex].quantidade : 0;
        const totalQtyNeeded = currentQtyInCart + 1;

        for (const insumoRel of insumos) {
          const needed = parseFloat(insumoRel.quantidade) * totalQtyNeeded;
          const stock = parseFloat(insumoRel.produto.estoque || 0);
          if (stock < needed) {
            toast({ 
               title: 'Estoque insuficiente', 
               description: `Insumo ${insumoRel.produto.descricao} insuficiente para este combo.`, 
               variant: 'destructive' 
            });
            return;
          }
        }
      } catch (err) {
        console.error(err);
        return;
      }
    } 
    else {
      const stock = produto.estoque || 0;
      if (stock <= 0) {
        toast({ title: 'Estoque insuficiente', description: `O produto ${produto.descricao} não tem estoque disponível.`, variant: 'destructive' });
        return;
      }

      const existingIndex = items.findIndex(item => item.produtoId === produto.id);
      const currentQtyInCart = existingIndex >= 0 ? items[existingIndex].quantidade : 0;
      if (currentQtyInCart + 1 > stock) {
          toast({ title: 'Limite de estoque atingido', description: `Apenas ${stock} unidades disponíveis.`, variant: 'destructive' });
          return;
      }
    }

    const existingIndex = items.findIndex(item => item.produtoId === produto.id);
    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex].quantidade += 1;
      newItems[existingIndex].total = newItems[existingIndex].quantidade * newItems[existingIndex].precoUnitario;
      setItems(newItems);
    } else {
      const newItem = {
        produtoId: produto.id,
        codigo: produto.codigo,
        descricao: produto.descricao,
        unidade: produto.unidade,
        quantidade: 1,
        precoUnitario: parseFloat(produto.valor_venda),
        valorCusto: parseFloat(produto.valor_compra),
        total: parseFloat(produto.valor_venda),
        tipo: produto.tipo
      };
      setItems([...items, newItem]);
    }
  };

  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    setSelectedItemIndex(null);
  };

  const updateQuantity = (index, newQty) => {
    if (newQty <= 0) { removeItem(index); return; }
    
    const newItems = [...items];
    const item = newItems[index];
    const produto = produtos.find(p => p.id === item.produtoId);

    if (produto && produto.tipo !== 'combo') {
      if (newQty > (produto.estoque || 0)) {
         toast({ title: 'Estoque insuficiente', variant: 'destructive' });
         return;
      }
    }

    newItems[index].quantidade = newQty;
    newItems[index].total = newQty * newItems[index].precoUnitario;
    setItems(newItems);
  };

  const calculateSubtotal = () => items.reduce((sum, item) => sum + item.total, 0);
  const calculateDisplayTotal = () => {
    const subtotal = calculateSubtotal();
    return Math.max(0, subtotal - (desconto) + acrescimo); 
  };

  const cancelSale = () => {
    if (items.length > 0 && window.confirm('Deseja cancelar a venda atual?')) {
      resetSale();
      toast({ title: 'Venda cancelada' });
    }
  };
  const resetSale = () => { setItems([]); setDesconto(0); setAcrescimo(0); setSelectedItemIndex(null); setIsPaymentOpen(false); setLastSale(null); setShowPrintModal(false); };
  const handleOpenCashier = async (f, s, o) => { await openCashier(f, s, o); setShowOpenCashier(false); };
  const handleCloseCashier = async (s, o) => { await closeCashier(s, o); setShowCloseCashier(false); };

  const handlePaymentConfirm = async (finalData) => {
    if (!isCashierOpen) { 
      toast({ title: 'Caixa Fechado', description: 'Não é possível finalizar vendas com o caixa fechado.', variant: 'destructive' }); 
      throw new Error("Caixa Fechado");
    }

    if (items.length === 0) {
      toast({ title: 'Carrinho Vazio', description: 'Adicione produtos antes de finalizar.', variant: 'destructive' });
      throw new Error("Carrinho Vazio");
    }

    try {
      setLoading(true);

      for (const item of items) {
        if (item.tipo !== 'combo') {
          const product = produtos.find(p => p.id === item.produtoId);
          if (product && product.estoque < item.quantidade) {
            throw new Error(`Estoque insuficiente para: ${item.descricao}. Disponível: ${product.estoque}`);
          }
        }
      }

      const salePayload = {
        user_id: user.id,
        cliente_id: finalData.selectedClient?.id || null, 
        subtotal: finalData.subtotal,
        desconto: finalData.discountAmount,
        acrescimo: finalData.surchargeAmount,
        total: finalData.total,
        status: 'concluido',
        forma_pagamento: finalData.payments.length > 0 ? finalData.payments[0].method : 'multiplo', 
        observacoes: `Venda PDV - ${finalData.payments.length} pagamentos`,
        tipo_venda: finalData.tipo_venda || 'loja',
        motoboy_id: finalData.motoboy_id || null,
        endereco_entrega: finalData.endereco_entrega || null,
        observacoes_entrega: finalData.observacoes_entrega || null,
        vendedor_id: finalData.vendedor_id || null,
        data_hora: new Date().toISOString(),
        data_criacao: new Date().toISOString()
      };

      let vendaData = null;
      if (finalData.savedVenda) {
        vendaData = finalData.savedVenda;
      } else {
        const { data: vendaInserted, error: vendaError } = await supabase.from('vendas').insert([salePayload]).select().single();
        if (vendaError) throw vendaError;
        vendaData = vendaInserted;
      }

      if (!finalData.savedVenda) {
        const paymentRecords = finalData.payments.map(p => ({
          venda_id: vendaData.id,
          user_id: user.id,
          forma_pagamento: p.method,
          valor: p.value,
          data_pagamento: new Date().toISOString()
        }));

        if (paymentRecords.length > 0) {
          const { error: payError } = await supabase.from('venda_pagamentos').insert(paymentRecords);
          if (payError) throw payError; 
        }

        for (const item of items) {
          const { error: itemError } = await supabase.from('itens_venda').insert([{
              venda_id: vendaData.id,
              user_id: user.id,
              produto_id: item.produtoId,
              quantidade: item.quantidade,
              valor_unitario: item.precoUnitario,
              valor_custo: item.valorCusto,
              total: item.total
          }]);
          if (itemError) console.error("Error saving item:", itemError);

          if (item.tipo !== 'combo') {
            const produto = produtos.find(p => p.id === item.produtoId);
            if (produto) {
               const newStock = Math.max(0, produto.estoque - item.quantidade);
               await supabase.from('produtos').update({ estoque: newStock }).eq('id', item.produtoId);
            }
          }
        }
      }

      if (activeCaixaId) {
         const paymentsArr = Array.isArray(finalData.payments) ? finalData.payments : [];
         const cashPayments = paymentsArr.filter((p) => !isNonCashPayment(p?.method));
         const cashTotal = cashPayments.reduce((sum, p) => sum + (Number(p?.value) || 0), 0);
         const movimentoForma = cashPayments.length === 1
           ? normalizePaymentMethod(cashPayments[0]?.method)
           : (cashPayments.length > 1 ? 'multiplo' : null);

         if (cashTotal > 0) {
           await registerSaleMovement(
             activeCaixaId, 
             cashTotal, 
             vendaData.id, 
             vendaData.numero_venda, 
             caixaSaldo,
             movimentoForma
           );
         }

         await handleRefreshMovimentacoes();
      }

      try {
        const comboItems = items.filter(i => i.tipo === 'combo');
        const comboDesc = comboItems.length > 0 ? ` • Combos concluídos. Insumos baixados com sucesso.` : '';
        if (comboItems.length > 0) {
          console.log("Insumo depletion for combos occurred successfully.");
        }
        
        const rawTotal = (vendaData && vendaData.total) || finalData.total || 0;
        const totalNumber = typeof rawTotal === 'number' ? rawTotal : parseFloat(rawTotal) || 0;
        toast({ title: 'Venda finalizada!', description: `Total: R$ ${totalNumber.toFixed(2)}${comboDesc}`, className: 'bg-[var(--layout-accent)] text-white' });
      } catch (e) {
        console.error('Error building success toast:', e);
        toast({ title: 'Venda finalizada!', description: 'Venda concluída com sucesso.', className: 'bg-[var(--layout-accent)] text-white' });
      }
      
      const motoboyObj = finalData.tipo_venda === 'delivery' && finalData.motoboy_id ? motoboys.find(m => m.id === finalData.motoboy_id) : null;
      setLastSale({ venda: vendaData, itens: [...items], pagamentos: finalData.payments, motoboy: motoboyObj, cliente: finalData.selectedClient });
      setIsPaymentOpen(false);
      setShowPrintModal(true);
      
      try {
        window.dispatchEvent(new CustomEvent('venda.finalizada', { detail: { produtos: items } }));
      } catch (e) {}
      loadProdutos();
      
    } catch (error) {
      console.error('Error processing sale:', error);
      toast({ title: 'Erro ao processar venda', description: error.message, variant: 'destructive' });
      throw error; 
    } finally { 
      setLoading(false); 
    }
  };

  const getStockColorClass = (estoque) => {
    const qty = parseInt(estoque || 0);
    if (qty >= 10) return 'text-[var(--layout-accent)] font-bold';
    if (qty > 0) return 'text-[#FBBF24] font-bold';
    return 'text-[#EF4444] font-bold';
  };

  const filteredProdutos = produtos.filter(p =>
    p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.descricao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6">
      <Helmet> <title>PDV - FORTIN ERP PRO</title> </Helmet>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div> <h1 className="text-3xl font-bold text-white mb-2">PDV</h1> <p className="text-[var(--layout-text-muted)]">Ponto de Venda Profissional</p> </div>
        
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
           <Button onClick={() => isCashierOpen ? setShowCloseCashier(true) : setShowOpenCashier(true)} variant="outline" className="bg-[var(--layout-bg)] text-white border-[var(--layout-border)] hover:border-white transition-colors h-12 w-full sm:w-auto"> 
             {isCashierOpen ? 'FECHAR CAIXA' : 'ABRIR CAIXA'} 
           </Button>
           <Button onClick={() => setShowSuprimento(true)} disabled={!isCashierOpen} className="bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white h-12 px-6 font-bold flex items-center gap-2 w-full sm:w-auto">
             <Plus className="w-5 h-5" /> SUPRIMENTO
           </Button>
           <Button onClick={() => setShowRetirada(true)} disabled={!isCashierOpen} className="bg-[#EF4444] hover:bg-red-600 text-white h-12 px-6 font-bold flex items-center gap-2 w-full sm:w-auto">
             <Minus className="w-5 h-5" /> RETIRADA
           </Button>
           <Button onClick={() => setShowReports(!showReports)} disabled={!isCashierOpen} variant="outline" className="bg-[var(--layout-bg)] text-white border-[var(--layout-border)] hover:border-white transition-colors h-12 w-full sm:w-auto">
             RELATÓRIOS
           </Button>
        </div>

        <div className={`bg-[var(--layout-surface-2)] px-4 py-2 rounded-lg border border-[var(--layout-border)] flex flex-wrap items-center justify-between gap-4 w-full sm:w-auto ${!isCashierOpen ? 'opacity-75' : ''}`}>
           <div className="flex flex-col items-start sm:items-end">
             <span className="text-xs text-[var(--layout-text-muted)] uppercase font-bold">Status do Caixa</span>
             <div className={`flex items-center gap-1 font-bold ${isCashierOpen ? 'text-[var(--layout-accent)]' : 'text-red-400'}`}>
               {isCashierOpen ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />} {isCashierOpen ? 'ABERTO' : 'FECHADO'}
             </div>
             {isCashierOpen && currentEmployee && <span className="text-[10px] text-[var(--layout-text-muted)] mt-1">por {currentEmployee.nome}</span>}
           </div>
           {isCashierOpen && (
             <div className="bg-[var(--layout-bg)] px-3 py-1 rounded border border-[var(--layout-border)] flex items-center gap-3">
               <div>
                 <span className="text-xs text-[var(--layout-text-muted)] block">Saldo do Dia</span>
                 <div className="relative group w-24 text-right">
                   <div className="text-[var(--layout-accent)] font-mono font-bold">
                     {showBalance ? `R$ ${todayTotals.net.toFixed(2)}` : 'R$ ••••••'}
                   </div>
                   <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-56 rounded-lg border border-[var(--layout-border)] bg-[var(--layout-surface-2)] p-3 text-xs text-white shadow-xl opacity-0 translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0">
                     <div className="text-[10px] uppercase text-[var(--layout-text-muted)] font-bold mb-2">Detalhamento do Dia</div>
                     <div className="flex justify-between text-[var(--layout-text-muted)]">
                       <span>Vendas</span>
                       <span className="text-white font-mono">R$ {todayTotals.sales.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between text-[var(--layout-text-muted)] mt-1">
                       <span>Suprimentos</span>
                       <span className="text-white font-mono">R$ {todayTotals.supplies.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between text-[var(--layout-text-muted)] mt-1">
                       <span>Retiradas</span>
                       <span className="text-white font-mono">R$ {todayTotals.withdrawals.toFixed(2)}</span>
                     </div>
                   </div>
                 </div>
               </div>
               <button onClick={toggleBalanceVisibility} className="hover:opacity-80 transition-opacity"> {showBalance ? <EyeOff className="w-5 h-5 text-white" /> : <Eye className="w-5 h-5 text-white" />} </button>
             </div>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">

          {showReports && (
            <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-[99999] p-6 pointer-events-auto">
              <div className="relative z-[100000] bg-[var(--layout-bg)] rounded-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden shadow-2xl border border-[var(--layout-border)]">
                <div className="p-6 border-b border-[var(--layout-border)] flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-white">Relatórios de Movimentações</h3>
                    <p className="text-sm text-[var(--layout-text-muted)]">Filtre por período e forma de pagamento</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setReportStart(''); setReportEnd(''); setReportPaymentMethod('all'); }} className="px-3 py-2 rounded border border-[var(--layout-border)] text-[var(--layout-text-muted)]">Limpar</button>
                    <button onClick={() => setShowReports(false)} className="px-3 py-2 rounded bg-[var(--layout-accent)] text-white">Fechar</button>
                  </div>
                </div>

                <div className="p-6 space-y-4 overflow-auto">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm text-[var(--layout-text-muted)]">Data Início</label>
                      <input type="date" value={reportStart} onChange={(e) => setReportStart(e.target.value)} className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white" />
                    </div>
                    <div>
                      <label className="text-sm text-[var(--layout-text-muted)]">Data Fim</label>
                      <input type="date" value={reportEnd} onChange={(e) => setReportEnd(e.target.value)} className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white" />
                    </div>
                    <div>
                      <label className="text-sm text-[var(--layout-text-muted)]">Forma Pagamento</label>
                      <select value={reportPaymentMethod} onChange={(e) => setReportPaymentMethod(e.target.value)} className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2 text-white">
                        <option value="all">Todas</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="pix">PIX</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                        <option value="fiado">Fiado</option>
                        <option value="consumo">Consumo</option>
                        <option value="multiplo">Múltiplo</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(() => {
                      const filtered = getFilteredMovimentacoes();
                      const totalCount = filtered.length;
                      const totalValue = filtered.reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
                      const byPayment = filtered.reduce((acc, m) => {
                        const key = m.forma_pagamento || 'nao_informado';
                        acc[key] = acc[key] || { count: 0, total: 0 };
                        acc[key].count += 1;
                        acc[key].total += (parseFloat(m.valor) || 0);
                        return acc;
                      }, {});

                      return (
                        <>
                          <div className="bg-[var(--layout-surface-2)] p-4 rounded border border-[var(--layout-border)]">
                            <div className="text-xs text-[var(--layout-text-muted)] uppercase">Movimentos</div>
                            <div className="text-2xl font-bold text-white">{totalCount}</div>
                          </div>
                          <div className="bg-[var(--layout-surface-2)] p-4 rounded border border-[var(--layout-border)]">
                            <div className="text-xs text-[var(--layout-text-muted)] uppercase">Valor Total</div>
                            <div className="text-2xl font-bold text-[var(--layout-accent)]">R$ {totalValue.toFixed(2)}</div>
                          </div>
                          <div className="bg-[var(--layout-surface-2)] p-4 rounded border border-[var(--layout-border)]">
                            <div className="text-xs text-[var(--layout-text-muted)] uppercase">Por Forma</div>
                            <div className="text-sm text-gray-200 space-y-1 mt-2">
                              {Object.keys(byPayment).length === 0 ? <div className="text-[var(--layout-text-muted)]">Nenhum</div> : Object.entries(byPayment).map(([k, v]) => (
                                <div key={k} className="flex justify-between">
                                  <span className="capitalize">{k.replace('_', ' ')}</span>
                                  <span className="font-medium">{v.count} • R$ {v.total.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div>
                    <CaixaMovimentacoesTable movimentacoes={getFilteredMovimentacoes()} />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="relative z-50 mb-6">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--layout-text-muted)]" />
                <input 
                  ref={searchInputRef} 
                  type="text" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && addSearchedProduct()} 
                  placeholder="Buscar por código ou descrição..." 
                  disabled={!isCashierOpen} 
                  className="w-full pl-10 pr-4 py-3 bg-[var(--layout-surface-2)] text-white rounded-lg border border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] placeholder-gray-400 transition-all"
                />
              </div>
              <button 
                onClick={addSearchedProduct} 
                disabled={!isCashierOpen} 
                className="px-6 py-3 bg-[var(--layout-accent)] text-white rounded-lg font-semibold hover:bg-[var(--layout-accent-strong)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                Adicionar
              </button>
            </div>
          </div>
            
          {searchTerm && isCashierOpen && (
            <div className="relative z-40 mb-6 max-h-96 overflow-auto bg-[var(--layout-bg)] rounded-lg border border-[var(--layout-border)] shadow-2xl custom-scrollbar">
               {filteredProdutos.length > 0 ? (
                 <table className="w-full text-left border-collapse min-w-[640px]">
                   <thead className="bg-[var(--layout-bg)] sticky top-0 z-10 text-xs text-[var(--layout-text-muted)] uppercase font-bold">
                     <tr>
                       <th className="p-4">CÓDIGO</th>
                       <th className="p-4">DESCRIÇÃO</th>
                       <th className="p-4 text-center">ESTOQUE</th>
                       <th className="p-4 text-right">PREÇO</th>
                       <th className="p-4 text-center">AÇÕES</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-700">
                     {filteredProdutos.map((produto) => {
                       const isCombo = produto.tipo === 'combo';

                       let availableQty = null;
                       if (isCombo) {
                         const ins = produto.insumos || [];
                         if (ins.length === 0) {
                           availableQty = 0;
                         } else {
                           availableQty = ins.reduce((acc, rel) => {
                             try {
                               const stock = parseFloat(rel.produto?.estoque || 0);
                               const needed = parseFloat(rel.quantidade) || 1;
                               const canMake = Math.floor(stock / needed);
                               return acc === null ? canMake : Math.min(acc, canMake);
                             } catch (e) {
                               return acc === null ? 0 : Math.min(acc, 0);
                             }
                           }, null) ?? 0;
                         }
                       }

                       const stockForColor = isCombo ? availableQty : (produto.estoque || 0);
                       const isOutOfStock = isCombo ? (availableQty <= 0) : ((produto.estoque || 0) <= 0);

                       return (
                         <tr key={produto.id} className="hover:bg-[var(--layout-surface-2)] transition-colors">
                           <td className="p-4 text-white font-mono text-sm">{produto.codigo}</td>
                           <td className="p-4 text-white text-sm">
                             <div className="flex flex-col">
                               <span className="font-medium">{produto.descricao}</span>
                               {isCombo && (
                                 <span className="inline-flex items-center text-[10px] text-blue-400 gap-1 uppercase font-bold tracking-wider">
                                   <Layers className="w-3 h-3" /> Combo
                                 </span>
                               )}
                             </div>
                           </td>
                           <td className={`p-4 text-center text-sm ${getStockColorClass(stockForColor)}`}>
                             {isCombo ? (
                               <span className="text-[var(--layout-text-muted)] font-semibold">{availableQty} {produto.unidade || ''}</span>
                             ) : (
                               <span>{produto.estoque} {produto.unidade}</span>
                             )}
                           </td>
                           <td className="p-4 text-right text-[var(--layout-accent)] font-bold">
                             R$ {parseFloat(produto.valor_venda).toFixed(2)}
                           </td>
                           <td className="p-4 text-center">
                             <Button 
                               size="sm"
                               disabled={isOutOfStock}
                               onClick={() => { addItem(produto); setSearchTerm(''); }}
                               className={`h-9 w-9 p-0 rounded-full transition-all ${
                                 isOutOfStock
                                   ? 'bg-[var(--layout-border)] text-[var(--layout-text-muted)]'
                                   : 'bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white shadow-lg shadow-[var(--layout-accent)]/20'
                               }`}
                             >
                               {isOutOfStock ? <AlertCircle className="w-4 h-4" /> : <Plus className="w-5 h-5" />}
                             </Button>
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               ) : (
                 <div className="p-8 text-center text-[var(--layout-text-muted)]">
                   Nenhum produto encontrado para "{searchTerm}"
                 </div>
               )}
            </div>
          )}

          <div className="relative z-30 mb-6">
            <div className="bg-[var(--layout-surface-2)] rounded-lg overflow-hidden flex flex-col h-[420px] sm:h-[500px] border border-[var(--layout-border)]">
              <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full relative min-w-[500px]">
                  <thead className="bg-[var(--layout-bg)] sticky top-0 z-10 border-b border-[var(--layout-border)]">
                    <tr>
                      <th className="text-left py-4 px-4 text-[var(--layout-text-muted)] text-xs font-bold">CÓDIGO</th>
                      <th className="text-left py-4 px-4 text-[var(--layout-text-muted)] text-xs font-bold">DESCRIÇÃO</th>
                      <th className="text-center py-4 px-4 text-[var(--layout-text-muted)] text-xs font-bold">QTD</th>
                      <th className="text-right py-4 px-4 text-[var(--layout-text-muted)] text-xs font-bold">TOTAL</th>
                      <th className="text-center py-4 px-4 text-[var(--layout-text-muted)] text-xs font-bold">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                     {items.map((item, index) => (
                      <tr
                        key={index}
                        onClick={() => setSelectedItemIndex(index)}
                        className={`cursor-pointer transition-all ${
                          selectedItemIndex === index
                            ? 'bg-[var(--layout-accent)]/10 border-l-4 border-[var(--layout-accent)]'
                            : 'hover:bg-[var(--layout-bg)]'
                        }`}
                      >
                        <td className="py-4 px-4 text-white font-mono text-sm">{item.codigo}</td>
                        <td className="py-4 px-4 text-white text-sm">
                          <span className="font-medium">{item.descricao}</span>
                          {item.tipo === 'combo' && <span className="ml-2 text-[10px] bg-blue-900 text-blue-200 px-1.5 py-0.5 rounded font-bold uppercase">COMBO</span>}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); updateQuantity(index, item.quantidade - 1); }}
                              className="h-8 w-8 rounded border border-[var(--layout-border)] text-white hover:bg-[var(--layout-border)] disabled:opacity-50"
                              disabled={item.quantidade <= 1}
                              aria-label="Diminuir quantidade"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantidade}
                              onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                              className="w-16 bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded px-2 py-1 text-white text-center font-bold focus:border-[#3B82F6] outline-none"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); updateQuantity(index, item.quantidade + 1); }}
                              className="h-8 w-8 rounded border border-[var(--layout-border)] text-white hover:bg-[var(--layout-border)]"
                              aria-label="Aumentar quantidade"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right text-[var(--layout-accent)] font-bold text-sm">R$ {item.total.toFixed(2)}</td>
                        <td className="py-4 px-4 text-center"> 
                          <button onClick={(e) => { e.stopPropagation(); removeItem(index); }} className="text-red-400 hover:text-red-300 p-2 rounded-full hover:bg-red-400/10 transition-colors">
                            <Trash2 className="w-5 h-5" />
                          </button> 
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <div className="relative z-20">
             <div className="flex items-center justify-between mb-3">
               <h3 className="text-[var(--layout-text-muted)] text-sm font-bold uppercase flex items-center gap-2"><Layers className="w-4 h-4" /> Histórico de Movimentações</h3>
               <div className="flex items-center gap-2">
                 <button onClick={handleRefreshMovimentacoes} className="px-3 py-1 text-xs rounded border border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:bg-[var(--layout-border)]">Atualizar</button>
                 <button onClick={handleClearMovimentacoes} className={`px-3 py-1 text-xs rounded border ${clearingMovimentacoes ? 'border-[var(--layout-border)] text-[var(--layout-text-muted)] bg-gray-700' : 'border-red-500 text-red-400 hover:bg-red-600/10'}` } disabled={clearingMovimentacoes}>
                   {clearingMovimentacoes ? 'Limpando...' : 'Limpar Histórico'}
                 </button>
               </div>
             </div>
             <CaixaMovimentacoesTable movimentacoes={movimentacoes} />
          </div>

        </div>

        <div className="space-y-4">
          <div className="bg-[var(--layout-surface-2)] rounded-lg p-4 sm:p-6 space-y-4 shadow-lg border border-[var(--layout-border)]">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"> <DollarSign className="w-5 h-5 text-[var(--layout-accent)]" /> Financeiro </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2"> <span className="text-[var(--layout-text-muted)]">Subtotal</span> <span className="text-white font-medium text-lg"> R$ {calculateSubtotal().toFixed(2)} </span> </div>
              <div className="border-t border-[var(--layout-border)] pt-3"> <div className="flex justify-between items-center"> <span className="text-[var(--layout-text-muted)] text-sm">Desconto</span> <span className="text-red-400 font-medium">- R$ {(calculateSubtotal() * (desconto / 100)).toFixed(2)}</span> </div> </div>
              <div className="border-t border-[var(--layout-border)] pt-3"> <div className="flex justify-between items-center"> <span className="text-[var(--layout-text-muted)] text-sm">Acréscimo</span> <span className="text-[var(--layout-accent)] font-medium">+ R$ {acrescimo.toFixed(2)}</span> </div> </div>
              <div className="border-t border-[var(--layout-border)] pt-4 mt-2"> <div className="bg-[var(--layout-bg)] rounded-lg p-4 text-center border border-[var(--layout-border)]"> <span className="text-[var(--layout-accent)] font-black text-4xl tracking-tight"> R$ {calculateDisplayTotal().toFixed(2)} </span> </div> </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => items.length > 0 && setIsPaymentOpen(true)}
              disabled={items.length === 0 || !isCashierOpen}
              className="col-span-2 bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white py-6 sm:py-8 text-lg sm:text-xl font-bold shadow-xl shadow-[var(--layout-accent)]/10"
            >
              PAGAR (F10)
            </Button>
            <Button onClick={cancelSale} disabled={!isCashierOpen} variant="outline" className="col-span-2 text-[var(--layout-text-muted)] border-[var(--layout-border)] hover:bg-[var(--layout-border)]"> Cancelar (F8) </Button>
            <Button
              onClick={() => setShowCashSummary(true)}
              variant="outline"
              className="col-span-2 bg-[var(--layout-bg)] text-[var(--layout-accent)] border-[var(--layout-border)] hover:border-[var(--layout-accent)] transition-colors"
            >
              Resumo (F9)
            </Button>
          </div>
        </div>
      </div>

      <PaymentModal 
        isOpen={isPaymentOpen} 
        onClose={() => setIsPaymentOpen(false)} 
        saleData={{ 
          subtotal: calculateSubtotal(), 
          desconto, 
          acrescimo,
          items: items.map(i => ({
            id: i.produtoId,
            quantity: i.quantidade,
            price: i.precoUnitario,
            cost: i.valorCusto,
            descricao: i.descricao
          }))
        }} 
        clients={clientes} 
        loadingClients={loadingClientes} 
        onConfirm={handlePaymentConfirm} 
        motoboys={motoboys}
        sellers={vendedores}
        defaultSellerId={cashierSession?.funcionario_id}
      />
      <CashSummaryModal isOpen={showCashSummary} onClose={() => setShowCashSummary(false)} caixaId={activeCaixaId} />
      <OpenCashierModal isOpen={showOpenCashier} onClose={() => setShowOpenCashier(false)} onConfirm={handleOpenCashier} />
      <CloseCashierModal isOpen={showCloseCashier} onClose={() => setShowCloseCashier(false)} onConfirm={handleCloseCashier} session={cashierSession} />
      
      <SuprimentoCaixaModal 
        isOpen={showSuprimento} 
        onClose={() => setShowSuprimento(false)} 
        caixaId={activeCaixaId}
        cashierName={currentEmployee?.nome}
        currentBalance={caixaSaldo}
        displayBalance={todayExpectedBalance}
        onSuccess={handleRefreshMovimentacoes}
      />
      <RetiradaCaixaModal 
        isOpen={showRetirada} 
        onClose={() => setShowRetirada(false)} 
        caixaId={activeCaixaId}
        cashierName={currentEmployee?.nome}
        currentBalance={caixaSaldo}
        displayBalance={todayExpectedBalance}
        onSuccess={handleRefreshMovimentacoes}
      />

      <PrintOrderModal isOpen={showPrintModal} onClose={resetSale} venda={lastSale?.venda} itens={lastSale?.itens} pagamentos={lastSale?.pagamentos} motoboy={lastSale?.motoboy} cliente={lastSale?.cliente} />
      <SalesHistoryModal isOpen={showSalesHistory} onClose={() => setShowSalesHistory(false)} />
    </div>
  );
};
export default PDVPage;
