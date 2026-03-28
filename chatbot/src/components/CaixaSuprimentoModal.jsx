import React, { useState } from 'react';
import { X, ArrowUpCircle, DollarSign, AlertTriangle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const CaixaSuprimentoModal = ({ isOpen, onClose, caixaData }) => {
  const { adicionarSuprimento } = caixaData;
  const { isOpen: isCaixaOpen, saldoAtual } = caixaData.caixaStatus;
  
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [origem, setOrigem] = useState('Banco');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const val = parseFloat(valor);
    if (isNaN(val) || val <= 0) return;

    setLoading(true);
    try {
      await adicionarSuprimento(val, descricao || 'Suprimento de Caixa', { origem });
      onClose();
      setValor('');
      setDescricao('');
    } catch (error) {
      // handled by hook
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentVal = parseFloat(valor) || 0;
  const newBalance = saldoAtual + currentVal;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#1a2332] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col border border-gray-700"
      >
        <div className="p-6 border-b border-gray-700 bg-[#00d084]/10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#00d084] flex items-center gap-2">
            <ArrowUpCircle className="w-6 h-6" />
            SUPRIMENTO DE CAIXA (F4)
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {!isCaixaOpen && (
             <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 p-4 rounded-lg flex gap-3">
               <AlertTriangle className="w-5 h-5 shrink-0" />
               <div className="text-sm">
                 <strong className="block">Caixa Fechado</strong>
                 É necessário abrir o caixa antes de realizar suprimentos.
               </div>
             </div>
          )}

          {/* Balance Card */}
          <div className="bg-[#2d3e52] p-4 rounded-lg border border-gray-700 flex justify-between items-center">
            <span className="text-gray-400 text-sm">Saldo Atual em Caixa</span>
            <span className="text-2xl font-bold text-[#00d084]">R$ {saldoAtual.toFixed(2)}</span>
          </div>

          <div className="space-y-4">
             <div>
               <label className="text-sm text-gray-300 block mb-1">Valor a Adicionar</label>
               <div className="relative">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</span>
                 <input
                   disabled={!isCaixaOpen}
                   autoFocus
                   type="number"
                   min="0.01"
                   step="0.01"
                   value={valor}
                   onChange={(e) => setValor(e.target.value)}
                   className="w-full bg-[#151b26] border border-gray-600 rounded-lg py-3 pl-10 text-white font-bold focus:border-[#00d084] focus:outline-none disabled:opacity-50"
                   placeholder="0.00"
                 />
               </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="text-sm text-gray-300 block mb-1">Origem</label>
                  <select 
                    disabled={!isCaixaOpen}
                    value={origem}
                    onChange={(e) => setOrigem(e.target.value)}
                    className="w-full bg-[#151b26] border border-gray-600 rounded-lg py-2 px-3 text-white focus:outline-none disabled:opacity-50"
                  >
                    <option value="Banco">Saque Banco</option>
                    <option value="Caixa Anterior">Caixa Anterior</option>
                    <option value="Gerente">Aporte Gerente</option>
                    <option value="Outro">Outro</option>
                  </select>
               </div>
               <div>
                  <label className="text-sm text-gray-300 block mb-1">Descrição (Opcional)</label>
                  <input
                    disabled={!isCaixaOpen}
                    type="text"
                    maxLength={200}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    className="w-full bg-[#151b26] border border-gray-600 rounded-lg py-2 px-3 text-white focus:outline-none disabled:opacity-50"
                    placeholder="Detalhes..."
                  />
               </div>
             </div>

             <div className="bg-[#232f3e] p-3 rounded-lg flex justify-between items-center text-sm border border-gray-700">
                <span className="text-gray-400">Saldo Após Suprimento</span>
                <span className="font-bold font-mono text-[#00d084]">
                  R$ {newBalance.toFixed(2)}
                </span>
             </div>
          </div>
        </div>

        <div className="bg-[#2a3a4a] border-t border-gray-700 p-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="border-gray-600 text-gray-300 hover:bg-gray-700">
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !valor || currentVal <= 0 || !isCaixaOpen}
            className="bg-[#00d084] hover:bg-[#00b872] font-bold min-w-[140px]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CONFIRMAR'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default CaixaSuprimentoModal;