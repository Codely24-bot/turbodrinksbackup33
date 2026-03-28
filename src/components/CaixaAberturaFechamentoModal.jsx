import React, { useState, useEffect } from 'react';
import { 
  X, Lock, Unlock, AlertCircle, Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const CaixaAberturaFechamentoModal = ({ isOpen, onClose, isCaixaOpen, session, onConfirm }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    const val = parseFloat(inputValue);
    if (isNaN(val) || val < 0) {
        toast({ title: 'Valor inválido', variant: 'destructive' });
        return;
    }

    setLoading(true);
    try {
        await onConfirm(user.id, val, isCaixaOpen ? "Fechamento de Caixa" : "Abertura de Caixa");
        onClose();
    } catch (error) {
       console.error(error);
       toast({ title: 'Erro na operação', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#1a2332] rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col border border-gray-700"
      >
        <div className={`p-6 border-b border-gray-700 flex items-center justify-between ${isCaixaOpen ? 'bg-red-500/10' : 'bg-[#00d084]/10'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isCaixaOpen ? 'bg-red-500 text-white' : 'bg-[#00d084] text-white'}`}>
              {isCaixaOpen ? <Lock className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isCaixaOpen ? 'text-red-400' : 'text-[#00d084]'}`}>
                {isCaixaOpen ? 'FECHAR CAIXA' : 'ABRIR CAIXA'}
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
           <div>
             <label className="text-sm font-medium text-gray-300 mb-2 block">
               {isCaixaOpen ? 'Saldo Final em Dinheiro' : 'Fundo de Troco (Valor Inicial)'}
             </label>
             <div className="relative">
               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</span>
               <input
                 autoFocus
                 type="number"
                 min="0"
                 step="0.01"
                 value={inputValue}
                 onChange={(e) => setInputValue(e.target.value)}
                 className="w-full bg-[#151b26] border border-gray-600 rounded-lg py-3 pl-10 pr-4 text-white text-lg font-bold focus:border-[#00d084] focus:outline-none"
                 placeholder="0.00"
               />
             </div>
           </div>
        </div>

        <div className="bg-[#2a3a4a] border-t border-gray-700 p-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="border-gray-600 text-gray-300 hover:bg-gray-700">
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !inputValue}
            className={`min-w-[140px] font-bold ${isCaixaOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-[#00d084] hover:bg-[#00b872]'}`}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isCaixaOpen ? 'CONFIRMAR FECHAMENTO' : 'CONFIRMAR ABERTURA')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default CaixaAberturaFechamentoModal;