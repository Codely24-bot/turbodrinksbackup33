import React, { useState, useEffect } from 'react';
import { X, ArrowUpCircle, User, Calendar, DollarSign, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useCaixaMovimentacoes } from '@/hooks/useCaixaMovimentacoes';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SuprimentoCaixaModal = ({ isOpen, onClose, caixaId, cashierName, currentBalance, displayBalance, onSuccess }) => {
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('Dinheiro');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addSuprimento } = useCaixaMovimentacoes();
  const { toast } = useToast();
  const baseBalance = parseFloat(displayBalance ?? currentBalance ?? 0);
  const previewBalance = baseBalance + (parseFloat(valor) || 0);

  useEffect(() => {
    if (isOpen) {
      setValor('');
      setDescricao('');
      setFormaPagamento('Dinheiro');
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const val = parseFloat(valor);
    if (!val || val <= 0) {
      toast({ title: 'Valor inválido', description: 'Digite um valor maior que zero.', variant: 'destructive' });
      return;
    }
    if (!descricao) {
      toast({ title: 'Descrição obrigatória', description: 'Por favor, informe uma descrição.', variant: 'destructive' });
      return;
    }

    if (!caixaId) {
       toast({ title: 'Erro de Caixa', description: 'Caixa não identificado.', variant: 'destructive' });
       return;
    }

    try {
      setIsSubmitting(true);
      // addSuprimento handles its own success/error toasts internally, but returns boolean for flow control
      const success = await addSuprimento(caixaId, valor, descricao, formaPagamento, currentBalance);
      
      if (success) {
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (error) {
       console.error("Unexpected error in modal submit:", error);
       toast({ title: 'Erro', description: 'Ocorreu um erro inesperado.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#1a2332] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col border border-gray-700"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-700 bg-[#00d084]/10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#00d084] flex items-center gap-2">
            <ArrowUpCircle className="w-6 h-6" />
            SUPRIMENTO DE CAIXA
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* Info Bar */}
        <div className="bg-[#2d3e52] px-6 py-3 flex justify-between items-center text-sm border-b border-gray-700">
           <div className="flex items-center gap-2 text-gray-300">
             <User className="w-4 h-4" /> <span>{cashierName || 'Operador'}</span>
           </div>
           <div className="flex items-center gap-2 text-gray-300">
             <Calendar className="w-4 h-4" /> <span>{format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
           </div>
        </div>

        {/* Balance Display */}
        <div className="px-6 py-4 bg-[#232f3e]">
           <span className="text-gray-400 text-xs uppercase block mb-1">Saldo do Dia</span>
           <span className="text-2xl font-bold text-white">R$ {parseFloat(displayBalance ?? currentBalance ?? 0).toFixed(2)}</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
             <label className="text-sm text-gray-300 block mb-1">Valor do Suprimento <span className="text-red-400">*</span></label>
             <div className="relative">
               <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
               <input 
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="w-full bg-[#151b26] border border-gray-600 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-[#00d084] focus:outline-none focus:ring-1 focus:ring-[#00d084]"
                  placeholder="0.00"
                  autoFocus
               />
             </div>
          </div>
          <div className="bg-[#232f3e] p-3 rounded-lg flex justify-between items-center text-sm border border-gray-700">
             <span className="text-gray-400">Saldo após suprimento</span>
             <span className={`font-bold font-mono ${previewBalance < 0 ? 'text-[#EF4444]' : 'text-[#00d084]'}`}>
               R$ {previewBalance.toFixed(2)}
             </span>
          </div>
          {previewBalance < 0 && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2">
              Atenção: o saldo ficará negativo.
            </div>
          )}

          <div>
             <label className="text-sm text-gray-300 block mb-1">Forma de Pagamento</label>
             <select
               value={formaPagamento}
               onChange={(e) => setFormaPagamento(e.target.value)}
               className="w-full bg-[#151b26] border border-gray-600 rounded-lg py-2.5 px-3 text-white focus:border-[#00d084] focus:outline-none"
             >
               <option value="Dinheiro">Dinheiro</option>
               <option value="Cheque">Cheque</option>
               <option value="Transferência">Transferência</option>
               <option value="Outro">Outro</option>
             </select>
          </div>

          <div>
             <label className="text-sm text-gray-300 block mb-1">Descrição <span className="text-red-400">*</span></label>
             <textarea
               value={descricao}
               onChange={(e) => setDescricao(e.target.value)}
               maxLength={500}
               rows={3}
               className="w-full bg-[#151b26] border border-gray-600 rounded-lg py-2 px-3 text-white focus:border-[#00d084] focus:outline-none resize-none"
               placeholder="Detalhes do suprimento..."
             />
             <div className="text-right text-xs text-gray-500 mt-1">{descricao.length}/500</div>
          </div>
        </form>

        {/* Footer */}
        <div className="bg-[#2a3a4a] border-t border-gray-700 p-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="border-gray-600 text-gray-300 hover:bg-gray-700">
            CANCELAR
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="bg-[#00d084] hover:bg-[#00b872] text-white font-bold min-w-[140px]"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CONFIRMAR SUPRIMENTO'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default SuprimentoCaixaModal;
