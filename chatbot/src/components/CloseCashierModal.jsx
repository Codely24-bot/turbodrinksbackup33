import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const CloseCashierModal = ({ isOpen, onClose, onConfirm, session }) => {
  const { user } = useAuth();
  const [saldoFinal, setSaldoFinal] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState({
    dinheiro: 0,
    pix: 0,
    debito: 0,
    credito: 0,
    fiado: 0,
    consumo: 0
  });
  const [opsSummary, setOpsSummary] = useState({
    suprimentos: 0,
    retiradas: 0
  });

  // Totals are calculated only for the current day (00:00 -> now)
  const totalVendas = Object.values(paymentSummary).reduce((acc, v) => acc + (Number(v) || 0), 0);
  const saldoEsperadoDia =
    (Number(session?.saldo_inicial) || 0) +
    totalVendas +
    (Number(opsSummary.suprimentos) || 0) -
    (Number(opsSummary.retiradas) || 0);
  const diferenca = (parseFloat(saldoFinal) || 0) - saldoEsperadoDia;
  const saldoFinalPreview = parseFloat(saldoFinal) || 0;

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

  const loadPaymentSummary = useCallback(async () => {
    if (!user || !session?.data_hora) return;
    setLoadingPayments(true);
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      const startIso = start.toISOString();
      const endIso = end.toISOString();

      const paymentsBase = { dinheiro: 0, pix: 0, debito: 0, credito: 0, fiado: 0, consumo: 0 };

      const [pagamentosRes, vendasRes, movimentosRes] = await Promise.all([
        supabase
          .from('venda_pagamentos')
          .select('id, venda_id, forma_pagamento, valor, data_pagamento')
          .eq('user_id', user.id)
          .gte('data_pagamento', startIso)
          .lte('data_pagamento', endIso),
        (() => {
          let vendasQuery = supabase
            .from('vendas')
            .select('id, total, forma_pagamento, data_criacao, data_hora, status')
            .eq('user_id', user.id)
            .eq('status', 'concluido');

          vendasQuery = vendasQuery.or(`and(data_criacao.gte.${startIso},data_criacao.lte.${endIso}),and(data_hora.gte.${startIso},data_hora.lte.${endIso})`);

          return vendasQuery;
        })(),
        supabase
          .from('caixa_movimentos')
          .select('tipo, valor, data_movimentacao')
          .eq('user_id', user.id)
          .in('tipo', ['suprimento', 'retirada'])
          .gte('data_movimentacao', startIso)
          .lte('data_movimentacao', endIso)
      ]);

      const pagamentos = pagamentosRes.data || [];
      const vendas = vendasRes.data || [];
      const movimentos = movimentosRes.data || [];

      const paidSaleIds = new Set();

      pagamentos.forEach((p) => {
        if (p?.venda_id) paidSaleIds.add(p.venda_id);
        const key = normalizeMethod(p?.forma_pagamento);
        if (!key) return;
        paymentsBase[key] += Number(p?.valor || 0);
      });

      vendas.forEach((v) => {
        if (paidSaleIds.has(v.id)) return;
        const key = normalizeMethod(v?.forma_pagamento);
        if (!key) return;
        paymentsBase[key] += Number(v?.total || 0);
      });

      const opsBase = { suprimentos: 0, retiradas: 0 };
      movimentos.forEach((m) => {
        const val = Number(m?.valor || 0);
        if (m?.tipo === 'suprimento') opsBase.suprimentos += val;
        if (m?.tipo === 'retirada') opsBase.retiradas += val;
      });

      setPaymentSummary(paymentsBase);
      setOpsSummary(opsBase);
    } catch (err) {
      console.error('Error loading payment summary:', err);
    } finally {
      setLoadingPayments(false);
    }
  }, [user, session]);

  useEffect(() => {
    if (isOpen) {
      loadPaymentSummary();
    }
  }, [isOpen, loadPaymentSummary]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const saldo = parseFloat(saldoFinal);
    if (isNaN(saldo) || saldo < 0) return alert("Saldo final inválido.");

    onConfirm(saldo, observacoes);
  };

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[#1a2332] rounded-xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden"
        >
          <div className="bg-[#2d3e52] p-4 border-b border-gray-600 flex justify-between items-center">
            <div className="flex items-center gap-2 text-white font-bold">
              <Lock className="w-5 h-5 text-red-500" />
              <span>FECHAR CAIXA</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            <div className="bg-[#2d3e52] rounded p-4 space-y-2 text-sm border border-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-400">Funcionário:</span>
                <span className="text-white font-bold">{session.funcionario?.nome || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Abertura:</span>
                <span className="text-white">{session.data_hora ? format(new Date(session.data_hora), 'HH:mm') : '-'}</span>
              </div>
              <div className="border-t border-gray-600 pt-2 flex justify-between">
                <span className="text-gray-400">Saldo Inicial:</span>
                <span className="text-white">R$ {Number(session.saldo_inicial).toFixed(2)}</span>
              </div>
               <div className="flex justify-between">
                <span className="text-gray-400">Total Vendas (Dia):</span>
                <span className="text-[#00d084]">R$ {totalVendas.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Suprimentos (Dia):</span>
                <span className="text-[#00d084]">R$ {Number(opsSummary.suprimentos || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Retiradas (Dia):</span>
                <span className="text-red-400">R$ {Number(opsSummary.retiradas || 0).toFixed(2)}</span>
              </div>
               <div className="flex justify-between font-bold text-base pt-1">
                <span className="text-white">Saldo Esperado (Dia):</span>
                <span className="text-[#00d084]">R$ {saldoEsperadoDia.toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-[#2d3e52] rounded p-4 space-y-3 text-sm border border-gray-600">
              <div className="text-xs text-gray-400 uppercase font-bold">Detalhamento por Pagamento</div>
              {loadingPayments ? (
                <div className="text-gray-400 text-sm">Carregando...</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <PaymentItem label="Dinheiro" value={paymentSummary.dinheiro} color="text-[#00d084]" />
                  <PaymentItem label="Pix" value={paymentSummary.pix} color="text-[#3B82F6]" />
                  <PaymentItem label="Debito" value={paymentSummary.debito} color="text-[#8B5CF6]" />
                  <PaymentItem label="Credito" value={paymentSummary.credito} color="text-[#F97316]" />
                  <PaymentItem label="Fiado" value={paymentSummary.fiado} color="text-[#8B5CF6]" />
                  <PaymentItem label="Consumo" value={paymentSummary.consumo} color="text-[#F97316]" />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block uppercase font-bold">Saldo Final (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={saldoFinal}
                onChange={(e) => setSaldoFinal(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white focus:border-[#00d084] focus:outline-none text-lg font-mono"
              />
            </div>
            <div className="bg-[#2d3e52] rounded p-3 text-sm border border-gray-600 flex justify-between items-center">
              <span className="text-gray-400">Saldo após fechamento</span>
              <span className={`font-mono font-bold ${saldoFinalPreview < 0 ? 'text-[#EF4444]' : 'text-white'}`}>
                R$ {saldoFinalPreview.toFixed(2)}
              </span>
            </div>
            {saldoFinalPreview < 0 && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2">
                Atenção: o saldo ficará negativo.
              </div>
            )}

            <div className={`text-center p-2 rounded ${diferenca >= 0 ? 'bg-[#00d084]/10 text-[#00d084]' : 'bg-red-500/10 text-red-500'}`}>
              <span className="text-xs font-bold uppercase block">Diferença</span>
              <span className="font-mono font-bold text-lg">
                {diferenca > 0 ? '+' : ''}R$ {diferenca.toFixed(2)}
              </span>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block uppercase font-bold">Observações</label>
              <textarea
                rows="3"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white resize-none focus:border-[#00d084] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
              <Button
                type="button"
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
              >
                CANCELAR
              </Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-500/20"
              >
                FECHAR CAIXA
              </Button>
            </div>
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const PaymentItem = ({ label, value, color }) => (
  <div className="bg-[#1f2a3a] rounded px-3 py-2 border border-gray-700 flex items-center justify-between">
    <span className="text-[10px] uppercase text-gray-400 font-bold">{label}</span>
    <span className={`font-mono font-bold ${color || 'text-white'}`}>
      R$ {Number(value || 0).toFixed(2)}
    </span>
  </div>
);

export default CloseCashierModal;
