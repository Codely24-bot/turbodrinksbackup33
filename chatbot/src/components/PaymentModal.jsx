import React, { useState, useEffect } from 'react';
import {
  X, Banknote, CreditCard, Smartphone, User, Receipt,
  Calculator, AlertCircle, DollarSign, Users, CheckCircle2,
  Search, Loader2, Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { usePaymentCalculations } from '@/hooks/usePaymentCalculations';
import { validatePaymentWithClient, validateDeliveryData } from '@/hooks/usePaymentCalculations';
import { validateRemainingValue, validateClientExists, buildDeliveryAddress } from '@/utils/paymentValidation';
import { validateComboInsumoStock } from '@/utils/validateComboInsumoStock';
import PaymentMethodCard from '@/components/PaymentMethodCard';
import PaymentSummaryTable from '@/components/PaymentSummaryTable';
import SaleTypeSelector from '@/components/SaleTypeSelector';
import DeliveryDataSection from '@/components/DeliveryDataSection';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient'; 
import { useAuth } from '@/contexts/AuthContext';
import { useCombos } from '@/hooks/useCombos';

const PaymentModal = ({
  isOpen,
  onClose,
  saleData,
  onConfirm,
  clients = [],
  loadingClients = false,
  motoboys = [],
  sellers = [],
  defaultSellerId = null
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { consumirInsumosDoCombos } = useCombos();

  // --- State Management ---
  const [discount, setDiscount] = useState(0);
  const [surcharge, setSurcharge] = useState(0);
  const [numPeople, setNumPeople] = useState(1);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [payers, setPayers] = useState([]); 
  const [activeMethodId, setActiveMethodId] = useState(null);
  const [currentInputValue, setCurrentInputValue] = useState('');
  const [payments, setPayments] = useState([]);
  const [discountError, setDiscountError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sale Type State
  const [saleType, setSaleType] = useState('loja');
  const [deliveryData, setDeliveryData] = useState({
    motoboy_id: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    observacoes: ''
  });
  const [deliveryErrors, setDeliveryErrors] = useState({});

  // Client Selection State
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  // Seller Selection State
  const [selectedSellerId, setSelectedSellerId] = useState('');

  // --- Calculations ---
  const {
    subtotal,
    discountAmount,
    surchargeAmount,
    total,
    totalPaid,
    remaining,
    change,
    perPerson
  } = usePaymentCalculations({
    subtotal: saleData?.subtotal || 0,
    discount,
    discountType: 'fixed',
    surcharge,
    surchargeType: 'fixed',
    numPeople,
    payments
  });

  const hasFiado = payments.some(p => p.method === 'fiado');

  useEffect(() => {
    if (splitEnabled) {
      const mapped = payers.map(p => ({ id: p.id, method: p.method, value: parseFloat(p.value) || 0, payerName: p.name }));
      setPayments(mapped);
    }
  }, [splitEnabled, payers]);

  // --- Effects ---
  useEffect(() => {
    if (isOpen && saleData) {
      setDiscount(saleData.desconto || 0);
      setSurcharge(saleData.acrescimo || 0);
      setPayments([]);
      setNumPeople(1);
      setActiveMethodId(null);
      setCurrentInputValue('');
      setSelectedClient(null);
      setClientSearchTerm('');
      setDiscountError(null);
      setSaleType('loja');
      setDeliveryData({
        motoboy_id: '',
        endereco: '',
        numero: '',
        complemento: '',
        bairro: '',
        observacoes: ''
      });
      setDeliveryErrors({});
      setIsProcessing(false);

      if (defaultSellerId && sellers.some(s => s.id === defaultSellerId)) {
        setSelectedSellerId(defaultSellerId);
      } else {
        setSelectedSellerId('');
      }
    }
  }, [isOpen, saleData, defaultSellerId, sellers]);

  // --- Handlers ---
  const handleMethodSelect = (methodId) => {
    if (methodId === 'fiado') {
      if (!validateClientExists(clients)) {
        toast({
          title: "Ação Indisponível",
          description: "Cadastre um cliente para usar o pagamento Fiado.",
          variant: "destructive"
        });
        return;
      }
    }

    if (activeMethodId === methodId) {
      setActiveMethodId(null);
      setCurrentInputValue('');
    } else {
      setActiveMethodId(methodId);
      if (remaining > 0) {
        setCurrentInputValue(remaining.toFixed(2));
      } else {
        setCurrentInputValue('');
      }
    }
  };

  const handleAddPayment = () => {
    const value = parseFloat(currentInputValue);
    if (!value || value <= 0) {
      toast({ title: "Valor Inválido", description: "O valor do pagamento deve ser maior que zero.", variant: "destructive" });
      return;
    }

    const newPayment = {
      id: Date.now().toString(),
      method: activeMethodId,
      value: value,
      timestamp: new Date()
    };

    setPayments([...payments, newPayment]);
    setActiveMethodId(null);
    setCurrentInputValue('');
  };

  const handleRemovePayment = (id) => {
    setPayments(payments.filter(p => p.id !== id));
  };

  // --- INTERNAL SAVE LOGIC ---
  const executeSave = async (finalData) => {
    try {
      if (!user) throw new Error("Usuário não autenticado");

      // 0. Pre-validate Combo Insumo Stocks to prevent overselling BEFORE inserting Venda
      const productIds = saleData.items.map(i => i.id || i.produtoId);
      const { data: prodTypes, error: prodError } = await supabase.from('produtos').select('id,tipo').in('id', productIds).eq('user_id', user.id);
      if (prodError) throw new Error('Erro ao buscar tipos de produto');
      const tipoMap = (prodTypes || []).reduce((acc, p) => ({ ...acc, [p.id]: p.tipo }), {});

      for (const item of saleData.items) {
        if (tipoMap[item.id] === 'combo') {
          const { valid, errors } = await validateComboInsumoStock(item.id, item.quantity);
          if (!valid) {
             throw new Error(`Estoque insuficiente de insumos para o combo: ${errors.join(', ')}`);
          }
        }
      }

      // 1. Get next sale number
      const { count } = await supabase.from('vendas').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      const numeroVenda = (count || 0) + 1;

      // 2. Insert Venda
      const { data: venda, error: vendaError } = await supabase
        .from('vendas')
        .insert({
          user_id: user.id,
          numero_venda: numeroVenda,
          subtotal: finalData.subtotal,
          desconto: finalData.discountAmount,
          acrescimo: finalData.surchargeAmount,
          total: finalData.total,
          forma_pagamento: finalData.payments.length === 1 ? finalData.payments[0].method : 'multiplo',
          observacoes: finalData.observacoes || null,
          tipo_venda: finalData.tipo_venda,
          status: 'concluido',
          cliente_id: finalData.selectedClient?.id || null,
          vendedor_id: finalData.vendedor_id || null,
          motoboy_id: finalData.motoboy_id || null,
          endereco_entrega: finalData.endereco_entrega || null,
          observacoes_entrega: finalData.observacoes_entrega || null,
          data_hora: new Date().toISOString(),
          data_criacao: new Date().toISOString()
        })
        .select()
        .single();

      if (vendaError) throw new Error(`Erro ao salvar venda: ${vendaError.message}`);

      // 3. Insert Itens Venda & Update Stock
      if (saleData.items && saleData.items.length > 0) {
        const itensToInsert = saleData.items.map(item => ({
          user_id: user.id,
          venda_id: venda.id,
          produto_id: item.id || item.produtoId,
          quantidade: item.quantity,
          valor_unitario: item.price,
          valor_custo: item.cost || 0,
          total: item.price * item.quantity,
          status: 'ativo'
        }));

        const { error: itemsError } = await supabase.from('itens_venda').insert(itensToInsert);
        if (itemsError) throw new Error(`Erro ao salvar itens: ${itemsError.message}`);

        const comboItems = [];
        for (const item of saleData.items) {
          const tipo = tipoMap[item.id || item.produtoId];
          if (tipo === 'combo') {
            comboItems.push({ produtoId: item.id || item.produtoId, quantidade: item.quantity, descricao: item.descricao || item.name, tipo: 'combo' });
            continue;
          }

          // Simple product: use RPC to decrement stock
          const { error: rpcError } = await supabase.rpc('decrement_estoque', {
            p_produto_id: item.id || item.produtoId,
            p_quantidade: item.quantity
          });
          if (rpcError) {
            console.error('Error decrementing stock for', item.id, rpcError);
            throw new Error(`Erro ao decrementar estoque do produto: ${rpcError.message || rpcError}`);
          }
        }

        // Consume insumos for all combo items safely via hook
        if (comboItems.length > 0) {
          const consumoResult = await consumirInsumosDoCombos(comboItems, user.id);
          if (!consumoResult.success) {
            console.error('Erro ao consumir insumos dos combos:', consumoResult.error);
            // Notice: If it fails here, Venda was already created. In a robust system, rollback should occur.
            // For now, throwing error prevents closing modal as successful but may leave orphaned Venda.
            throw new Error(`Erro ao processar estoque de combos: ${consumoResult.error}`);
          }
        }
      }

      // 4. Insert Payments
      if (finalData.payments && finalData.payments.length > 0) {
        const pagamentosToInsert = finalData.payments.map(p => ({
          user_id: user.id,
          venda_id: venda.id,
          forma_pagamento: p.method,
          valor: p.value,
          data_pagamento: new Date().toISOString()
        }));

        const { error: payError } = await supabase.from('venda_pagamentos').insert(pagamentosToInsert);
        if (payError) throw new Error(`Erro ao salvar pagamentos: ${payError.message}`);

        // 5. Handle "Fiado"
        const fiadoPayments = finalData.payments.filter(p => p.method === 'fiado');
        if (fiadoPayments.length > 0 && finalData.selectedClient) {
          const contasToInsert = fiadoPayments.map(p => {
            const vencimento = new Date();
            vencimento.setDate(vencimento.getDate() + 30);
            return {
              user_id: user.id,
              cliente_id: finalData.selectedClient.id,
              venda_id: venda.id,
              valor: p.value,
              status: 'pendente',
              data_vencimento: vencimento.toISOString().split('T')[0],
              observacoes: `Venda #${numeroVenda} - Fiado`,
              origem: 'venda'
            };
          });

          const { error: contaError } = await supabase.from('contas_receber').insert(contasToInsert);
          if (contaError) {
            console.error("Critical: Failed to create contas_receber record", contaError);
            toast({ title: "Atenção", description: "Venda salva, mas houve erro ao gerar conta a receber.", variant: "warning" });
          }
        }
      }

      return venda;
    } catch (error) {
      throw error;
    }
  };

  const handleFinalize = async () => {
    if (isProcessing) return;

    if (!validateRemainingValue(remaining)) {
      toast({ title: "Pagamento Incompleto", description: `Ainda faltam R$ ${remaining.toFixed(2)} para quitar a venda.`, variant: "destructive" });
      return;
    }

    if (discountError) {
      toast({ title: "Erro no Desconto", description: discountError, variant: "destructive" });
      return;
    }

    const clientValidation = validatePaymentWithClient(payments, selectedClient);
    if (!clientValidation.valid) {
      toast({ title: "Cliente Necessário", description: clientValidation.error, variant: "destructive" });
      return;
    }

    if (saleType === 'delivery') {
      const { isValid, errors } = validateDeliveryData(saleType, deliveryData.motoboy_id, deliveryData.endereco, deliveryData.numero, deliveryData.bairro);
      if (!isValid) {
        setDeliveryErrors(errors);
        toast({ title: "Dados de Entrega", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
        return;
      }
    }

    setIsProcessing(true);

    try {
      if (splitEnabled) {
        const sum = payers.reduce((s, p) => s + (parseFloat(p.value) || 0), 0);
        const diff = Math.abs(sum - total);
        if (diff > 0.05) {
          toast({ title: 'Divisão inválida', description: `Soma dos valores divididos difere do total.`, variant: 'destructive' });
          setIsProcessing(false);
          return;
        }
      }

      const finalData = {
        payments: splitEnabled ? payers.map(p => ({ id: p.id, method: p.method, value: parseFloat(p.value) || 0, payerName: p.name })) : payments,
        discount,
        discountType: 'fixed',
        surcharge,
        surchargeType: 'fixed',
        total,
        subtotal,
        discountAmount,
        surchargeAmount,
        selectedClient,
        tipo_venda: saleType,
        vendedor_id: selectedSellerId || null,
        observacoes: splitEnabled ? `Dividido: ${payers.map(p => `${p.name || '---'}(${p.method}): R$ ${(parseFloat(p.value) || 0).toFixed(2)}`).join('; ')}` : undefined
      };

      if (saleType === 'delivery') {
        finalData.motoboy_id = deliveryData.motoboy_id;
        finalData.endereco_entrega = buildDeliveryAddress(deliveryData.endereco, deliveryData.numero, deliveryData.complemento, deliveryData.bairro);
        finalData.observacoes_entrega = deliveryData.observacoes;
      }

      const savedVenda = await executeSave(finalData);
      await onConfirm({ ...finalData, savedVenda });

    } catch (error) {
      console.error("Payment Processing Error:", error);
      toast({ title: "Falha ao Finalizar", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const paymentMethods = [
    { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: 'var(--layout-accent)' },
    { id: 'pix', label: 'PIX', icon: Smartphone, color: '#3B82F6' },
    { id: 'debito', label: 'Débito', icon: CreditCard, color: '#8B5CF6' },
    { id: 'credito', label: 'Crédito', icon: CreditCard, color: '#F97316' },
    { id: 'fiado', label: 'Fiado', icon: User, color: '#FFA500', disabled: !validateClientExists(clients) },
    { id: 'consumo', label: 'Consumo', icon: Receipt, color: '#6B7280' },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--layout-bg)] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-[var(--layout-border)]"
      >
        <div className="bg-[var(--layout-surface-2)] border-b border-[var(--layout-border)] p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-[var(--layout-accent)]/20 p-2 rounded-lg">
              <Calculator className="w-6 h-6 text-[var(--layout-accent)]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Finalizar Venda</h2>
              <p className="text-[var(--layout-text-muted)] text-sm">Gerencie os pagamentos e valores</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--layout-text-muted)] hover:text-white p-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 custom-scrollbar">
          <div className="lg:col-span-7 space-y-6">
            <section>
              <h3 className="text-[var(--layout-text-muted)] text-sm uppercase tracking-wider mb-2 font-semibold">Tipo de Venda</h3>
              <SaleTypeSelector selectedType={saleType} onSelect={setSaleType} />
            </section>

            <AnimatePresence>
              {saleType === 'delivery' && (
                <section>
                  <DeliveryDataSection motoboys={motoboys} formData={deliveryData} onChange={setDeliveryData} errors={deliveryErrors} />
                </section>
              )}
            </AnimatePresence>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[var(--layout-surface-2)] p-4 rounded-xl border border-[var(--layout-border)]">
                <span className="text-[var(--layout-text-muted)] text-xs uppercase tracking-wider block mb-1">Subtotal</span>
                <span className="text-2xl font-bold text-white">R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="bg-[var(--layout-surface-2)] p-4 rounded-xl border border-[var(--layout-border)] relative">
                <span className="text-[var(--layout-text-muted)] text-xs uppercase tracking-wider block mb-1">Desconto (R$)</span>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--layout-text-muted)] text-lg font-bold">R$</span>
                  <input type="number" min="0" step="0.01" placeholder="0,00" value={discount === 0 ? '' : discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded px-3 py-2 text-red-400 font-bold focus:border-red-500 focus:outline-none" />
                </div>
              </div>
              <div className="bg-[var(--layout-surface-2)] p-4 rounded-xl border border-[var(--layout-border)]">
                <span className="text-[var(--layout-text-muted)] text-xs uppercase tracking-wider block mb-1">Acréscimo (R$)</span>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--layout-text-muted)] text-lg font-bold">R$</span>
                  <input type="number" min="0" step="0.01" placeholder="0,00" value={surcharge === 0 ? '' : surcharge} onChange={(e) => setSurcharge(parseFloat(e.target.value) || 0)} className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded px-3 py-2 text-[var(--layout-accent)] font-bold focus:border-[var(--layout-accent)] focus:outline-none" />
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="space-y-2">
                <label className="text-xs uppercase tracking-wider font-semibold text-[var(--layout-accent)] flex items-center gap-2">
                  <User className="w-4 h-4" /> Cliente (Opcional)
                </label>
                <div className="relative z-20">
                  <div
                    className={`relative bg-[var(--layout-bg)] border rounded-lg flex items-center px-3 py-2 ${
                      selectedClient
                        ? 'border-[var(--layout-accent)] bg-[var(--layout-accent)]/10'
                        : 'border-[var(--layout-border)] focus-within:border-[var(--layout-accent)]'
                    }`}
                  >
                    <Search className="w-5 h-5 text-[var(--layout-text-muted)] mr-2" />
                    <input id="client-search-input" type="text" placeholder={selectedClient ? selectedClient.nome : "Buscar cliente..."} value={clientSearchTerm} onChange={(e) => { setClientSearchTerm(e.target.value); setIsClientDropdownOpen(true); if (selectedClient) setSelectedClient(null); }} onFocus={() => setIsClientDropdownOpen(true)} className="bg-transparent border-none text-white w-full focus:outline-none placeholder-gray-500" />
                    {loadingClients && <Loader2 className="w-4 h-4 animate-spin text-[var(--layout-text-muted)]" />}
                    {selectedClient && <button onClick={() => { setSelectedClient(null); setClientSearchTerm(''); }} className="ml-2 text-red-400 hover:text-white"><X className="w-4 h-4" /></button>}
                  </div>
                  {isClientDropdownOpen && clientSearchTerm && !selectedClient && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg shadow-xl max-h-48 overflow-y-auto z-30">
                      {clients.filter(c => c.nome.toLowerCase().includes(clientSearchTerm.toLowerCase())).length > 0 ? (
                        clients.filter(c => c.nome.toLowerCase().includes(clientSearchTerm.toLowerCase())).map(client => (
                          <div key={client.id} onClick={() => { setSelectedClient(client); setClientSearchTerm(client.nome); setIsClientDropdownOpen(false); }} className="px-4 py-2 hover:bg-[var(--layout-border)] cursor-pointer flex justify-between items-center text-sm">
                            <span className="text-white font-medium">{client.nome}</span>
                            {client.cpf && <span className="text-[var(--layout-text-muted)] text-xs">{client.cpf}</span>}
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-[var(--layout-text-muted)] text-sm">Nenhum cliente encontrado</div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-2">
                <label className="text-xs uppercase tracking-wider font-semibold text-[var(--layout-accent)] flex items-center gap-2">
                  <Briefcase className="w-4 h-4" /> Vendedor (Opcional)
                </label>
                <div className="relative">
                  <select value={selectedSellerId} onChange={(e) => setSelectedSellerId(e.target.value)} className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-3 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none appearance-none">
                    <option value="">Sem vendedor</option>
                    {sellers.map(seller => <option key={seller.id} value={seller.id}>{seller.nome}</option>)}
                  </select>
                </div>
              </section>
            </div>

            <section>
              <h3 className="text-[var(--layout-text-muted)] text-sm uppercase tracking-wider mb-3 font-semibold">Formas de Pagamento</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {paymentMethods.map((pm) => (
                  <div key={pm.id} className="relative group">
                    <PaymentMethodCard {...pm} isActive={activeMethodId === pm.id} onSelect={() => !pm.disabled && handleMethodSelect(pm.id)} value={currentInputValue} onChangeValue={setCurrentInputValue} onAddPayment={handleAddPayment} />
                    {pm.disabled && (
                      <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm cursor-not-allowed z-10">
                        <span className="text-xs text-white bg-black/80 px-2 py-1 rounded">Requer Cliente</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="lg:col-span-5 flex flex-col h-full space-y-6">
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-[var(--layout-surface-2)] to-[var(--layout-border)] p-6 rounded-2xl border border-[var(--layout-border)] shadow-lg text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5"><DollarSign className="w-32 h-32 text-white" /></div>
                <span className="text-[var(--layout-text-muted)] text-sm uppercase tracking-wider font-semibold">Total a Pagar</span>
                <div className="text-5xl font-black text-white mt-2 tracking-tight">R$ {total.toFixed(2)}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--layout-surface-2)] p-4 rounded-xl border border-[var(--layout-border)]">
                  <span className="text-[var(--layout-text-muted)] text-xs uppercase block">Pago</span>
                  <span className="text-xl font-bold text-[var(--layout-accent)]">R$ {totalPaid.toFixed(2)}</span>
                </div>
                <div className={`p-4 rounded-xl border border-[var(--layout-border)] ${remaining > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-[var(--layout-accent)]/10 border-[var(--layout-accent)]/30'}`}>
                  <span className={remaining > 0 ? 'text-red-400 text-xs uppercase block' : 'text-[var(--layout-accent)] text-xs uppercase block'}>{remaining > 0 ? 'Faltante' : 'Quitado'}</span>
                  <span className={`text-xl font-bold ${remaining > 0 ? 'text-red-400' : 'text-[var(--layout-accent)]'}`}>R$ {remaining.toFixed(2)}</span>
                </div>
              </div>

              {change > 0 && (
                <div className="bg-[var(--layout-accent)] p-4 rounded-xl shadow-lg shadow-[var(--layout-accent)]/20 animate-pulse">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold text-lg">TROCO</span>
                    <span className="text-white font-black text-2xl">R$ {change.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col min-h-[200px]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[var(--layout-text-muted)] text-sm uppercase tracking-wider">Pagamentos Adicionados</h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[var(--layout-text-muted)]">Dividir Conta</label>
                    <input type="checkbox" checked={splitEnabled} onChange={(e) => {
                      const enabled = e.target.checked;
                      setSplitEnabled(enabled);
                      if (enabled && payers.length === 0) setPayers([{ id: Date.now().toString() + '_1', name: '', method: 'dinheiro', value: perPerson }, { id: (Date.now() + 1).toString() + '_2', name: '', method: 'dinheiro', value: perPerson }]);
                      else if (!enabled) { setPayers([]); setPayments([]); }
                    }} className="w-4 h-4" />
                  </div>
                  {payments.length > 0 && <button onClick={() => { setPayments([]); if (splitEnabled) setPayers([]); }} className="text-xs text-red-400 hover:text-red-300 underline">Limpar tudo</button>}
                </div>
              </div>
              <div className="flex-1">
                {splitEnabled ? (
                  <div className="space-y-3 bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
                    {payers.map((p, idx) => (
                      <div key={p.id} className="grid grid-cols-12 gap-2 items-center">
                        <input type="text" placeholder={`Pessoa ${idx + 1}`} value={p.name} onChange={(e) => setPayers(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))} className="col-span-5 bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded px-3 py-2 text-white" />
                        <select value={p.method} onChange={(e) => setPayers(prev => prev.map(x => x.id === p.id ? { ...x, method: e.target.value } : x))} className="col-span-3 bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded px-3 py-2 text-white">
                          {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.label}</option>)}
                        </select>
                        <input type="number" min="0" step="0.01" value={p.value} onChange={(e) => setPayers(prev => prev.map(x => x.id === p.id ? { ...x, value: e.target.value } : x))} className="col-span-3 bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded px-3 py-2 text-white" />
                        <div className="col-span-1 text-right"><button onClick={() => setPayers(prev => prev.filter(x => x.id !== p.id))} className="text-red-400 px-2">✕</button></div>
                      </div>
                    ))}
                    <div className="flex justify-between">
                      <button onClick={() => setPayers(prev => [...prev, { id: Date.now().toString(), name: '', method: 'dinheiro', value: (perPerson || 0).toFixed(2) }])} className="text-sm text-[var(--layout-text-muted)] bg-[var(--layout-surface-2)] px-3 py-1 rounded border border-[var(--layout-border)]">Adicionar Pessoa</button>
                      <div className="text-xs text-[var(--layout-text-muted)]">Total: R$ {payers.reduce((s, x) => s + (parseFloat(x.value) || 0), 0).toFixed(2)} / R$ {total.toFixed(2)}</div>
                    </div>
                  </div>
                ) : (
                  <PaymentSummaryTable payments={payments} onRemove={handleRemovePayment} onEdit={() => { }} subtotal={subtotal} discount={discountAmount} surcharge={surchargeAmount} total={total} />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--layout-surface-2)] border-t border-[var(--layout-border)] p-6 flex gap-4 shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1 h-12 text-base bg-transparent border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:bg-[var(--layout-border)] hover:text-white">
            Cancelar (Esc)
          </Button>
          <Button
            onClick={handleFinalize}
            disabled={isProcessing || remaining > 0.01 || !!discountError}
            className={`flex-1 h-12 text-base font-bold shadow-lg transition-all ${
              isProcessing || remaining > 0.01 || !!discountError
                ? 'bg-[var(--layout-border)] text-[var(--layout-text-muted)] cursor-not-allowed opacity-50'
                : 'bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white shadow-[var(--layout-accent)]/25'
            }`}
          >
            {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : remaining > 0.01 ? (
              <span className="flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Complete o pagamento</span>
            ) : (
              <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Finalizar Venda (Enter)</span>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentModal;
