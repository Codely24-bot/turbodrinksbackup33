import React, { useState, useEffect, useCallback } from 'react';
import { X, Wallet, ArrowUpCircle, ArrowDownCircle, DollarSign, Calculator, ShoppingCart, TrendingUp, CreditCard, Smartphone, FileText, Utensils } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCaixaMovimentacoes } from '@/hooks/useCaixaMovimentacoes';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const CashSummaryModal = ({ isOpen, onClose, caixaId }) => {
  const { user } = useAuth();
  const { ensureCaixaExists } = useCaixaMovimentacoes();
  const [currentCaixaId, setCurrentCaixaId] = useState(caixaId);
  const [loading, setLoading] = useState(true);

  const normalizeMethod = (method) => {
    const raw = (method || '').toString().trim().toLowerCase();
    const clean = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (clean.includes('dinheiro')) return 'dinheiro';
    if (clean.includes('pix')) return 'pix';
    if (clean.includes('debito')) return 'debito';
    if (clean.includes('credito')) return 'credito';
    if (clean.includes('fiado')) return 'fiado';
    if (clean.includes('consumo')) return 'consumo';
    return null;
  };

  const applySalesDateRange = (query, startIso, endIso) =>
    query.or(`and(data_criacao.gte.${startIso},data_criacao.lte.${endIso}),and(data_hora.gte.${startIso},data_hora.lte.${endIso})`);
  
  // State for all summary data
  const [summaryData, setSummaryData] = useState({
    salesCount: 0,
    totalSales: 0,
    totalCost: 0,
    profit: 0,
    payments: {
      dinheiro: 0,
      pix: 0,
      debito: 0,
      credito: 0,
      fiado: 0,
      consumo: 0
    },
    suprimentos: 0,
    retiradas: 0,
    saldoInicial: 0,
    saldoFinal: 0,
    history: []
  });

  const loadData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // 1. Ensure Caixa ID
      let cid = currentCaixaId || caixaId;
      if (!cid) {
         const caixa = await ensureCaixaExists();
         if (caixa) {
           cid = caixa.id;
           setCurrentCaixaId(caixa.id);
         }
      }
      
      if (!cid) {
        setLoading(false);
        return;
      }

      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      const todayEnd = new Date();
      todayEnd.setHours(23,59,59,999);
      const startIso = todayStart.toISOString();
      const endIso = todayEnd.toISOString();

      // 2. Fetch Caixa Details (Saldo Inicial)
      const { data: caixaData } = await supabase
        .from('caixas')
        .select('saldo_inicial, created_at')
        .eq('id', cid)
        .single();

      const { data: aberturaData } = await supabase
        .from('caixa_movimentacoes')
        .select('saldo_inicial, data_hora')
        .eq('user_id', user.id)
        .eq('tipo', 'abertura')
        .gte('data_hora', startIso)
        .lte('data_hora', endIso)
        .order('data_hora', { ascending: false })
        .limit(1)
        .maybeSingle();

      const saldoInicial = parseFloat((aberturaData?.saldo_inicial ?? caixaData?.saldo_inicial) || 0);

      // 3. Fetch Sales Data (Today)

      let vendasQuery = supabase
        .from('vendas')
        .select(`
          id, 
          total, 
          forma_pagamento, 
          itens_venda (
            valor_custo,
            quantidade
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'concluido');

      vendasQuery = applySalesDateRange(vendasQuery, startIso, endIso);

      const { data: vendas, error: vendasError } = await vendasQuery;

      if (vendasError) console.error("Error fetching vendas:", vendasError);

      // Calculate Sales Metrics
      let salesCount = vendas?.length || 0;
      let totalSales = 0;
      let totalCost = 0;
      const payments = { dinheiro: 0, pix: 0, debito: 0, credito: 0, fiado: 0, consumo: 0 };

      vendas?.forEach(venda => {
        totalSales += Number(venda.total);
        
        // Calculate cost from items
        if (venda.itens_venda) {
          venda.itens_venda.forEach(item => {
            totalCost += (Number(item.valor_custo || 0) * Number(item.quantidade || 0));
          });
        }
      });

      const { data: pagamentos } = await supabase
        .from('venda_pagamentos')
        .select('venda_id, forma_pagamento, valor, data_pagamento')
        .eq('user_id', user.id)
        .gte('data_pagamento', startIso)
        .lte('data_pagamento', endIso);

      const paidSaleIds = new Set();

      (pagamentos || []).forEach((p) => {
        if (p?.venda_id) paidSaleIds.add(p.venda_id);
        const key = normalizeMethod(p?.forma_pagamento);
        if (!key) return;
        payments[key] += Number(p?.valor || 0);
      });

      vendas?.forEach((v) => {
        if (paidSaleIds.has(v.id)) return;
        const key = normalizeMethod(v?.forma_pagamento);
        if (!key) return;
        payments[key] += Number(v?.total || 0);
      });

      // 4. Fetch Movements (Suprimentos/Retiradas)
      const { data: movimentos, error: movError } = await supabase
        .from('caixa_movimentos')
        .select('*')
        .eq('caixa_id', cid)
        .eq('user_id', user.id)
        .gte('data_movimentacao', startIso)
        .lte('data_movimentacao', endIso)
        .order('data_movimentacao', { ascending: false });

      if (movError) console.error("Error fetching movimentos:", movError);

      let suprimentos = 0;
      let retiradas = 0;
      
      movimentos?.forEach(m => {
        if (m.tipo === 'suprimento') suprimentos += Number(m.valor);
        if (m.tipo === 'retirada') retiradas += Number(m.valor);
      });

      // 5. Final Calculation
      const profit = totalSales - totalCost;
      // FORMULA: Final = Initial + Sales + Supplies - Withdrawals
      const saldoFinal = saldoInicial + totalSales + suprimentos - retiradas;

      setSummaryData({
        salesCount,
        totalSales,
        totalCost,
        profit,
        payments,
        suprimentos,
        retiradas,
        saldoInicial,
        saldoFinal,
        history: movimentos?.slice(0, 20) || []
      });

    } catch (error) {
      console.error("Error loading summary:", error);
    } finally {
      setLoading(false);
    }
  }, [user, caixaId, currentCaixaId, ensureCaixaExists]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--layout-bg)] rounded-xl w-full max-w-5xl h-[90vh] flex flex-col border border-[var(--layout-border)] shadow-2xl overflow-hidden"
      >
        {/* HEADER */}
        <div className="bg-[var(--layout-surface-2)] border-b border-[var(--layout-border)] p-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[var(--layout-accent)]" />
              RESUMO DO CAIXA (F9)
            </h2>
            <p className="text-[var(--layout-text-muted)] text-xs mt-0.5 capitalize">
              {format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-[var(--layout-text-muted)] hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 custom-scrollbar">
          
          {loading ? (
             <div className="flex items-center justify-center h-full text-[var(--layout-text-muted)] animate-pulse">Carregando dados...</div>
          ) : (
            <>
              {/* CARDS SUPERIORES */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard 
                  icon={<ShoppingCart className="w-6 h-6 text-[var(--layout-accent)]" />} 
                  title="VENDAS REALIZADAS" 
                  value={summaryData.salesCount} 
                  subText="Quantidade Total"
                  color="bg-[var(--layout-surface-2)] border border-[var(--layout-border)]" 
                  textColor="text-white"
                />
                <SummaryCard 
                  icon={<DollarSign className="w-6 h-6 text-[var(--layout-accent)]" />} 
                  title="TOTAL VENDIDO" 
                  value={formatCurrency(summaryData.totalSales)} 
                  subText="Faturamento Bruto"
                  color="bg-[var(--layout-surface-2)] border border-[var(--layout-border)]" 
                  textColor="text-white"
                />
                <SummaryCard 
                  icon={<TrendingUp className="w-6 h-6 text-[var(--layout-accent)]" />} 
                  title="LUCRO ESTIMADO" 
                  value={formatCurrency(summaryData.profit)} 
                  subText="Faturamento - Custo"
                  color="bg-[var(--layout-surface-2)] border border-[var(--layout-border)]" 
                  textColor="text-white"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT: Payments & Operations */}
                <div className="lg:col-span-2 space-y-6">
                  
                  <div>
                    <h3 className="text-[var(--layout-text-muted)] text-xs font-bold uppercase mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Detalhamento por Pagamento
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <PaymentCard icon={<DollarSign className="w-4 h-4" />} label="Dinheiro" value={summaryData.payments.dinheiro} color="border-[var(--layout-accent)] text-[var(--layout-accent)]" />
                      <PaymentCard icon={<Smartphone className="w-4 h-4" />} label="Pix" value={summaryData.payments.pix} color="border-[var(--layout-accent)] text-[var(--layout-accent)]" />
                      <PaymentCard icon={<CreditCard className="w-4 h-4" />} label="Débito" value={summaryData.payments.debito} color="border-[var(--layout-accent)] text-[var(--layout-accent)]" />
                      <PaymentCard icon={<CreditCard className="w-4 h-4" />} label="Crédito" value={summaryData.payments.credito} color="border-[var(--layout-accent)] text-[var(--layout-accent)]" />
                      <PaymentCard icon={<FileText className="w-4 h-4" />} label="Fiado" value={summaryData.payments.fiado} color="border-[var(--layout-accent)] text-[var(--layout-accent)]" />
                      <PaymentCard icon={<Utensils className="w-4 h-4" />} label="Consumo" value={summaryData.payments.consumo} color="border-[var(--layout-accent)] text-[var(--layout-accent)]" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[var(--layout-text-muted)] text-xs font-bold uppercase mb-3 flex items-center gap-2">
                      <Wallet className="w-4 h-4" /> Operações de Caixa
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[var(--layout-surface-2)] p-4 rounded-lg border border-[var(--layout-border)] flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <div className="p-2 bg-[var(--layout-accent)]/20 rounded-lg text-[var(--layout-accent)]">
                             <ArrowUpCircle className="w-6 h-6" />
                           </div>
                           <div>
                             <span className="text-xs text-[var(--layout-text-muted)] block uppercase font-bold">Suprimentos</span>
                             <span className="text-xl font-bold text-[var(--layout-accent)]">{formatCurrency(summaryData.suprimentos)}</span>
                           </div>
                         </div>
                      </div>
                      <div className="bg-[var(--layout-surface-2)] p-4 rounded-lg border border-[var(--layout-border)] flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#EF4444]/20 rounded-lg text-[#EF4444]">
                              <ArrowDownCircle className="w-6 h-6" />
                            </div>
                            <div>
                             <span className="text-xs text-[var(--layout-text-muted)] block uppercase font-bold">Retiradas</span>
                             <span className="text-xl font-bold text-[#EF4444]">{formatCurrency(summaryData.retiradas)}</span>
                            </div>
                         </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* RIGHT: Final Result */}
                <div className="space-y-6">
                  <div className="bg-[var(--layout-surface-2)] rounded-xl border border-[var(--layout-border)] overflow-hidden shadow-lg h-full">
                    <div className="p-4 border-b border-[var(--layout-border)] bg-[var(--layout-bg)]">
                      <h3 className="font-bold text-white text-center">BALANÇO GERAL</h3>
                    </div>
                    <div className="p-6 space-y-4">
                      <BalanceRow label="Saldo Inicial" value={summaryData.saldoInicial} />
                      <BalanceRow label="Total de Vendas" value={summaryData.totalSales} isPositive />
                      <BalanceRow label="Total Suprimentos" value={summaryData.suprimentos} isPositive />
                      <BalanceRow label="Total Retiradas" value={summaryData.retiradas} isNegative />
                      
                      <div className="pt-4 border-t border-[var(--layout-border)] mt-4">
                        <span className="text-xs text-[var(--layout-text-muted)] uppercase font-bold text-center block mb-1">Saldo Final em Caixa</span>
                        <div className="bg-[var(--layout-bg)] rounded-lg p-4 border border-[var(--layout-accent)]/30 text-center relative overflow-hidden group">
                           <div className="absolute inset-0 bg-[var(--layout-accent)]/5 group-hover:bg-[var(--layout-accent)]/10 transition-colors"></div>
                           <span className="text-3xl font-black text-[var(--layout-accent)] relative z-10">
                             {formatCurrency(summaryData.saldoFinal)}
                           </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* HISTORY */}
              <div className="mt-6">
                <h3 className="text-[var(--layout-text-muted)] text-xs font-bold uppercase mb-3">Últimas Movimentações</h3>
                <div className="bg-[var(--layout-surface-2)] rounded-lg border border-[var(--layout-border)] overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[var(--layout-bg)] text-[var(--layout-text-muted)] text-xs uppercase font-bold">
                      <tr>
                        <th className="px-4 py-3">Data/Hora</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Descrição</th>
                        <th className="px-4 py-3 text-right">Valor</th>
                        <th className="px-4 py-3 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--layout-border)] text-[var(--layout-text-muted)]">
                      {summaryData.history.length > 0 ? (
                        summaryData.history.map((mov) => {
                          const isPositive = mov.tipo === 'suprimento' || mov.tipo === 'venda' || mov.tipo === 'abertura';
                          return (
                            <tr key={mov.id} className="hover:bg-[var(--layout-surface-2)] transition-colors">
                              <td className="px-4 py-3 font-mono text-xs">{format(new Date(mov.data_movimentacao), "dd/MM HH:mm", { locale: ptBR })}</td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                                  {mov.tipo}
                                </span>
                              </td>
                              <td className="px-4 py-3 truncate max-w-[200px]">{mov.descricao || '-'}</td>
                              <td className={`px-4 py-3 text-right font-mono font-bold ${isPositive ? 'text-[var(--layout-accent)]' : 'text-[#EF4444]'}`}>
                                {isPositive ? '+' : '-'} {formatCurrency(mov.valor)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-white">
                                {formatCurrency(mov.saldo_novo)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="5" className="px-4 py-8 text-center text-[var(--layout-text-muted)]">Nenhuma movimentação registrada hoje.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>
      </motion.div>
    </div>
  );
};

const SummaryCard = ({ icon, title, value, subText, color, textColor }) => (
  <div className={`${color} rounded-lg p-5 shadow-lg relative overflow-hidden group`}>
    <div className="absolute right-0 top-0 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform">
      <div className="w-24 h-24 bg-white rounded-full"></div>
    </div>
    <div className="relative z-10">
      <div className="flex items-center gap-3 mb-2 opacity-90">
        {icon}
        <span className={`text-xs font-bold uppercase tracking-wider ${textColor} opacity-80`}>{title}</span>
      </div>
      <div className={`text-3xl font-black ${textColor} mb-1`}>{value}</div>
      <div className={`text-[10px] ${textColor} opacity-70`}>{subText}</div>
    </div>
  </div>
);

const PaymentCard = ({ icon, label, value, color }) => (
  <div className={`bg-[var(--layout-surface-2)] border-l-4 ${color} p-3 rounded-r-lg shadow-sm flex flex-col justify-between h-20`}>
    <div className="flex items-center justify-between">
    <span className="text-[var(--layout-text-muted)] text-[10px] uppercase font-bold flex items-center gap-1">
        {icon} {label}
      </span>
    </div>
    <span className="text-lg font-bold text-white font-mono">
      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
    </span>
  </div>
);

const BalanceRow = ({ label, value, isPositive, isNegative }) => {
  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  
  let colorClass = "text-white";
  let sign = "";
  if (isPositive) { colorClass = "text-[var(--layout-accent)]"; sign = "+"; }
  if (isNegative) { colorClass = "text-[#EF4444]"; sign = "-"; }

  return (
    <div className="flex justify-between items-center border-b border-[var(--layout-border)] pb-2 last:border-0 last:pb-0">
      <span className="text-[var(--layout-text-muted)] text-sm">{label}</span>
      <span className={`font-mono font-bold ${colorClass}`}>
        {sign} {formatCurrency(value)}
      </span>
    </div>
  );
};

export default CashSummaryModal;
